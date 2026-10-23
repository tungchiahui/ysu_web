import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardGitcodeRepositories, createDashboardGitcode } from '../utils/dashboard-gitcode.mjs'
import { createDashboardService } from '../utils/dashboard-service.mjs'

const instant = Date.parse('2026-10-23T00:00:00Z'), at = '2026-10-22T23:00:00Z'
const config = { DASHBOARD_GITCODE_REPOS: 'team/robot,team/docs' }
function upstream(calls = []) {
  return async (url, options) => {
    calls.push({ url: String(url), ...options })
    const docs = url.includes('/team/docs/')
    if (url.includes('/contributors')) return [{ name: docs ? 'Author Two' : 'Author One', email: docs ? 'private-two@example.test' : 'private-one@example.test', contributions: docs ? 3 : 5 }]
    return { events: [{ id: docs ? 11 : 10, action_name: 'pushed', author: { username: docs ? 'coder-two' : 'coder-one', name: docs ? 'Author Two' : 'Author One' }, created_at: at }], has_next_page: false }
  }
}

test('只接GitCode：支持完整地址、简写、克隆地址并去重，忽略原GitHub变量', () => {
  const repos = dashboardGitcodeRepositories({ DASHBOARD_GITCODE_REPOS: 'team/robot,https://gitcode.com/team/docs.git/,https://gitcode.com/team/robot' })
  assert.deepEqual(repos.map(row => row.repo), ['team/robot', 'team/docs'])
  assert.equal(dashboardGitcodeRepositories({ DASHBOARD_GITHUB_REPOS: 'team/repo' }).length, 0)
})

test('拒绝GitHub及其它主机、用户信息、查询、端口、非法路径和超过五个仓库', () => {
  for (const url of ['https://github.com/a/b', 'http://gitcode.com/a/b', 'https://gitcode.com.evil.test/a/b', 'https://user:pass@gitcode.com/a/b', 'https://gitcode.com:8443/a/b', 'https://gitcode.com/a/b?access_token=never', 'https://gitcode.com/a/b#readme', 'https://gitcode.com/a/b/issues', 'https://gitcode.com/a/%2e%2f']) {
    assert.throws(() => dashboardGitcodeRepositories({ DASHBOARD_GITCODE_REPOS: url }))
  }
  assert.throws(() => dashboardGitcodeRepositories({ DASHBOARD_GITCODE_REPOS: Array.from({ length: 6 }, (_, i) => `team/repo-${i}`).join(',') }))
})

test('作者与动态转展示字段，令牌只进请求头，邮箱不发送到网页', async () => {
  const calls = [], read = createDashboardGitcode({ json: upstream(calls), now: () => instant })
  const data = await read({ ...config, DASHBOARD_GITCODE_TOKEN: 'gitcode-test-token-only' })
  assert.equal(data.sources.length, 2)
  assert.deepEqual(data.contributors.map(person => person.count), [5, 3])
  assert.equal(data.events[0].action, '推送了代码')
  assert.equal(data.events.find(event => event.repo === 'team/robot').actor, 'Author One')
  assert(!JSON.stringify(data).includes('@example.test'))
  assert(!JSON.stringify(data).includes('test-token-only'))
  for (const call of calls) {
    assert.equal(new URL(call.url).origin, 'https://api.gitcode.com')
    assert.equal(new URL(call.url).searchParams.has('access_token'), false)
    assert.equal(call.headers.Authorization, 'Bearer gitcode-test-token-only')
  }
  assert(calls.some(call => call.url.endsWith('contributors?type=authors')))
})

test('多账号、作者与邮箱映射合并人员，动态同步姓名，映射不泄露邮箱', async () => {
  const people = JSON.stringify([{ name: '示例成员甲', accounts: ['email:PRIVATE-ONE@example.test', 'author:Author Two', 'login:coder-one', 'login:coder-two'] }])
  const data = await createDashboardGitcode({ json: upstream(), now: () => instant })({ ...config, DASHBOARD_GITCODE_PEOPLE: people })
  assert.equal(data.contributors.length, 1)
  assert.equal(data.contributors[0].name, '示例成员甲')
  assert.equal(data.contributors[0].memberName, '示例成员甲')
  assert.equal(data.contributors[0].count, 8)
  assert(data.events.every(event => event.actor === '示例成员甲'))
  assert(!JSON.stringify(data).includes('@example.test'))
})

test('不同邮箱同名不合并，无邮箱同名跨仓库也不自动合并', async () => {
  for (const email of [true, false]) {
    const data = await createDashboardGitcode({ now: () => instant, json: async (url, options) => url.includes('/contributors')
      ? [{ name: '同名', email: email ? (url.includes('/docs/') ? 'one@example.test' : 'two@example.test') : undefined, contributions: 2 }]
      : upstream()(url, options) })(config)
    assert.equal(data.contributors.length, 2)
    assert.notEqual(data.contributors[0].key, data.contributors[1].key)
  }
})

test('GitCode贡献接口返回超过100位作者时仍完整汇总，再截取榜单前8名', async () => {
  const data = await createDashboardGitcode({ now: () => instant, json: async url => url.includes('/contributors')
    ? Array.from({ length: 120 }, (_, index) => ({ name: `作者${index}`, email: `author-${index}@example.test`, contributions: index + 1 }))
    : { events: [] } })({ DASHBOARD_GITCODE_REPOS: 'team/robot' })
  assert.equal(data.contributors.length, 8)
  assert.equal(data.contributors[0].name, '作者119')
  assert.equal(data.contributors[0].count, 120)
})

test('单仓库单项失败不影响另一个模块和其它仓库，错误不当作零条成功', async () => {
  const data = await createDashboardGitcode({ now: () => instant, json: async (url, options) => {
    if (url.includes('/robot/contributors')) throw new Error('private upstream error')
    return upstream()(url, options)
  } })(config)
  assert.equal(data.unavailable, true)
  assert.equal(data.contributors[0].count, 3)
  assert.equal(data.events.length, 2)
  assert.equal(data.sources[0].contributionsUnavailable, true)
  assert.equal(data.sources[0].eventsUnavailable, false)
  assert.equal(data.sources[1].unavailable, false)
  assert(!JSON.stringify(data).includes('private upstream error'))
})

test('缓存合并并发请求，失败后退避，旧值和更新时间最多保留一天', async () => {
  let clock = instant, fail = false
  const calls = [], base = upstream(calls)
  const read = createDashboardGitcode({ now: () => clock, json: async (url, options) => {
    if (fail && url.includes('/robot/')) { calls.push({ url }); throw new Error('down') }
    return base(url, options)
  } })
  const settings = { ...config, DASHBOARD_GITCODE_TOKEN: 'test-only' }
  await Promise.all([read(settings), read(settings), read(settings)])
  assert.equal(calls.length, 4)
  clock += 11 * 60_000; fail = true
  const stale = await read(settings)
  assert.equal(stale.contributors.find(person => person.name === 'Author One').count, 5)
  assert.equal(stale.sources[0].updatedAt, instant)
  assert.equal(stale.sources[0].unavailable, true)
  const count = calls.length
  await read(settings)
  assert.equal(calls.length, count)
  clock = instant + 24 * 60 * 60_000 + 1
  const expired = await read(settings)
  assert.equal(expired.contributors.length, 1)
  assert.equal(expired.sources[0].updatedAt, undefined)
  assert.equal(expired.contributors[0].name, 'Author Two')
})

test('未知及敏感事件、无效日期、危险头像和邮件名称不直接展示', async () => {
  const data = await createDashboardGitcode({ now: () => instant, json: async url => url.includes('/contributors')
    ? [{ name: 'private@example.test', email: 'private@example.test', contributions: 5, avatar_url: 'javascript:alert(1)' }]
    : { events: [
      { action_name: 'unknown', created_at: at }, { action_name: 'pushed', created_at: 'invalid' },
      { action_name: 'pushed', created_at: at, filter_sensitive: true },
      { action_name: 'pushed', created_at: at, author: { name: 'private@example.test' } }
    ] } })({ DASHBOARD_GITCODE_REPOS: 'team/robot' })
  assert.equal(data.events.length, 1)
  assert.equal(data.contributors[0].avatar, '')
  assert.equal(data.contributors[0].href, '')
  assert(!JSON.stringify(data).includes('private@example.test'))
})

test('无配置隐藏，错误配置或人员冲突明确报错且不访问GitCode', async () => {
  const calls = [], read = createDashboardGitcode({ json: upstream(calls), now: () => instant })
  assert.equal((await read({})).enabled, false)
  for (const settings of [{ DASHBOARD_GITCODE_REPOS: 'https://github.com/a/b' }, { ...config, DASHBOARD_GITCODE_PEOPLE: '{}' }, { ...config, DASHBOARD_GITCODE_PEOPLE: JSON.stringify([{ name: '甲', accounts: ['login:dev'] }, { name: '乙', accounts: ['login:DEV'] }]) }]) {
    const data = await read(settings)
    assert.equal(data.configurationError, true)
    assert.equal(data.unavailable, true)
  }
  assert.equal(calls.length, 0)
})

test('上游格式错误不伪装为空贡献，正常动态继续展示', async () => {
  for (const invalid of [[{ name: 'wrong', contributions: -1 }], [{ name: 'wrong', contributions: '3' }], [{ contributions: 1 }], { message: 'not an array' }]) {
    const data = await createDashboardGitcode({ now: () => instant, json: async (url, options) => url.includes('/contributors') ? invalid : upstream()(url, options) })({ DASHBOARD_GITCODE_REPOS: 'team/robot' })
    assert.equal(data.sources[0].contributionsUnavailable, true)
    assert.equal(data.events.length, 1)
  }
})

test('更换凭证或人员配置不复用旧缓存，接口兼容缓存中的旧页面', async () => {
  const calls = [], base = upstream(calls)
  const service = createDashboardService({ now: () => instant, fetcher: async (url, options) => {
    if (String(url).includes('open.feishu.cn')) return Response.json(String(url).includes('/auth/')
      ? { code: 0, tenant_access_token: 'test-tenant' } : { code: 0, data: { items: [], has_more: false } })
    return Response.json(await base(String(url), options))
  } })
  const settings = { DASHBOARD_ENABLED: 'true', DASHBOARD_PUBLIC: 'true', FEISHU_APP_ID: 'test', FEISHU_APP_SECRET: 'test', FEISHU_BITABLE_APP_TOKEN: 'test', FEISHU_BITABLE_TABLE_ID: 'test', DASHBOARD_GITCODE_REPOS: 'team/robot' }
  const request = new Request('https://example.test/api/dashboard')
  const first = await (await service({ request, env: settings })).json()
  assert.deepEqual(first.development, first.github)
  await service({ request, env: settings })
  assert.equal(calls.length, 2)
  await service({ request, env: { ...settings, DASHBOARD_GITCODE_TOKEN: 'rotated-test-only' } })
  assert.equal(calls.length, 4)
  const mapped = await (await service({ request, env: { ...settings, DASHBOARD_GITCODE_PEOPLE: JSON.stringify([{ name: '成员甲', accounts: ['author:Author One'] }]) } })).json()
  assert.equal(mapped.development.contributors[0].name, '成员甲')
  assert.equal(calls.length, 6)
})

const organizationConfig = { DASHBOARD_GITCODE_ORG: 'team', DASHBOARD_GITCODE_TOKEN: 'org-test-token-only' }
const organizationRows = count => Array.from({ length: count }, (_, i) => ({ id: i + 1, full_name: `team/repo-${String(i).padStart(3, '0')}`, repo_type: 'code', fork: i === 1 }))
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

test('组织配置仅接受GitCode组织路径，优先于旧单仓库设置，错误排除项不发请求', async () => {
  const { dashboardGitcodeOrganization } = await import('../utils/dashboard-gitcode.mjs')
  assert.equal(dashboardGitcodeOrganization({ DASHBOARD_GITCODE_ORG: ' https://gitcode.com/ysu_RM/ ' }), 'ysu_RM')
  for (const name of ['https://evil.test/team', 'https://gitcode.com/team/repo', 'https://gitcode.com/team?access_token=bad', 'https://user:pass@gitcode.com/team', '.', '..', 'team/repo']) assert.throws(() => dashboardGitcodeOrganization({ DASHBOARD_GITCODE_ORG: name }))
  const calls = []
  const read = createDashboardGitcode({ json: async url => { calls.push(url); return [] } })
  assert.equal((await read({ ...organizationConfig, DASHBOARD_GITCODE_REPOS: 'old-invalid-ignored' })).organization.includedCount, 0)
  assert.equal(calls.length, 1)
  assert(!calls[0].includes('/repos/old-invalid'))
  assert.equal((await read({ ...organizationConfig, DASHBOARD_GITCODE_EXCLUDE_REPOS: 'other/repo' })).configurationError, true)
  assert.equal(calls.length, 1)
})

test('完整读取205个组织仓库，超过100项分页、排除与同路径去重，最多4个请求并发', async () => {
  const rows = organizationRows(205), pages = [], calls = []
  let active = 0, maximum = 0
  const read = createDashboardGitcode({ now: () => instant, json: async (url, options) => {
    calls.push(url)
    assert.equal(options.headers.Authorization, 'Bearer org-test-token-only')
    active++; maximum = Math.max(maximum, active)
    await pause(1)
    try {
      const address = new URL(url)
      if (address.pathname.includes('/orgs/')) {
        const page = Number(address.searchParams.get('page')); pages.push(page)
        assert.equal(address.searchParams.get('type'), 'all')
        assert.equal(address.searchParams.get('repo_type'), 'code')
        assert.equal(address.searchParams.get('per_page'), '100')
        return rows.slice((page - 1) * 100, page * 100)
      }
      return url.includes('/contributors') ? [{ name: 'Example Author', email: 'private-org@example.test', contributions: 1 }] : { events: [] }
    } finally { active-- }
  } })
  const data = await read({ ...organizationConfig, DASHBOARD_GITCODE_EXCLUDE_REPOS: 'team/repo-000,https://gitcode.com/team/repo-000.git/' })
  assert.deepEqual(pages, [1, 2, 3])
  assert(maximum <= 4)
  assert.equal(data.organization.discoveredCount, 205)
  assert.equal(data.organization.excludedCount, 1)
  assert.equal(data.sources.length, 204)
  assert.equal(data.contributors[0].count, 204)
  assert.equal(data.sources.find(source => source.repo === 'team/repo-001').fork, true)
  assert(!calls.some(url => url.includes('/repos/team/repo-000/')))
  assert(!JSON.stringify(data).includes('private-org@example.test'))
  assert(!JSON.stringify(data).includes('org-test-token-only'))
  assert.equal(data.syncing, false)
  assert.equal(data.unavailable, false)
})

test('整页100项继续读空尾页；同仓库或同ID不会重复累计，Fork不会擅自丢弃', async () => {
  let pages = 0
  const rows = organizationRows(100)
  const full = await createDashboardGitcode({ json: async url => {
    if (url.includes('/orgs/')) { pages++; return pages === 1 ? rows : [] }
    return url.includes('/contributors') ? [] : { events: [] }
  } })(organizationConfig)
  assert.equal(pages, 2)
  assert.equal(full.sources.length, 100)
  const duplicates = await createDashboardGitcode({ json: async url => url.includes('/orgs/')
    ? [{ id: 1, full_name: 'team/old' }, { id: 1, full_name: 'team/renamed', fork: true }, { id: 1, full_name: 'team/renamed', fork: true }]
    : url.includes('/contributors') ? [{ name: 'Author', contributions: 2 }] : { events: [] } })(organizationConfig)
  assert.deepEqual(duplicates.sources.map(source => source.repo), ['team/renamed'])
  assert.equal(duplicates.contributors[0].count, 2)
})

test('组织分页重复、跨组织、非法地址或后续页失败，不用不完整目录或旧手动仓库伪装成功', async () => {
  const cases = [
    () => organizationRows(100),
    () => [{ id: 1, full_name: 'other/repo' }],
    () => [{ full_name: 'team/repo?access_token=never' }],
    () => [{ full_name: 'team/repo', repo_type: 'model' }],
    () => ({ message: 'bad-format' }),
    page => { if (page === 1) return organizationRows(100); throw new Error('page2-private-error') }
  ]
  for (const pageResult of cases) {
    const calls = []
    const data = await createDashboardGitcode({ json: async url => {
      calls.push(url)
      return pageResult(Number(new URL(url).searchParams.get('page')))
    } })({ ...organizationConfig, DASHBOARD_GITCODE_REPOS: 'team/old-manual' })
    assert.equal(data.organization.unavailable, true)
    assert.equal(data.organization.includedCount, undefined)
    assert.equal(data.sources.length, 0)
    assert(!calls.some(url => url.includes('/repos/team/')))
    assert(!JSON.stringify(data).includes('page2-private-error'))
  }
})

test('组织目录缓存自动纳入新增仓库、移除离开仓库；目录失败最多回退一天并保留真实更新时间', async () => {
  let clock = instant, stage = 0, lists = 0
  const read = createDashboardGitcode({ now: () => clock, json: async url => {
    if (url.includes('/orgs/')) {
      lists++
      if (stage === 2) throw new Error('list-down')
      return [{ full_name: stage === 0 ? 'team/old' : 'team/new' }]
    }
    return url.includes('/contributors') ? [{ name: 'Author', contributions: 2 }] : { events: [] }
  } })
  assert.equal((await read(organizationConfig)).sources[0].repo, 'team/old')
  await read(organizationConfig)
  assert.equal(lists, 1)
  stage = 1; clock += 11 * 60_000
  const changed = await read(organizationConfig)
  assert.deepEqual(changed.sources.map(source => source.repo), ['team/new'])
  const changedAt = clock
  stage = 2; clock += 11 * 60_000
  const stale = await read(organizationConfig)
  assert.equal(stale.organization.unavailable, true)
  assert.equal(stale.organization.updatedAt, changedAt)
  assert.equal(stale.sources[0].repo, 'team/new')
  clock = changedAt + 24 * 60 * 60_000 + 1
  const expired = await read(organizationConfig)
  assert.equal(expired.sources.length, 0)
  assert.equal(expired.organization.updatedAt, undefined)
})

test('截止时间中止慢请求，剩余仓库明确等待同步，下次轮询继续而非永久只读前几个', async () => {
  let clock = instant, slow = true, active = 0, maximum = 0, aborted = 0
  const read = createDashboardGitcode({ now: () => clock, budgetMs: 30, json: async (url, options) => {
    if (url.includes('/orgs/')) return organizationRows(12)
    active++; maximum = Math.max(maximum, active)
    try {
      if (slow) await new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { aborted++; reject(new Error('aborted')) }, { once: true }))
      return url.includes('/contributors') ? [{ name: 'Author', email: 'same@example.test', contributions: 1 }] : { events: [] }
    } finally { active-- }
  } })
  const partial = await read(organizationConfig)
  assert.equal(partial.sources.length, 12)
  assert.equal(partial.syncing, true)
  assert(partial.sources.some(source => source.pending))
  assert.equal(aborted, 4)
  assert(maximum <= 4)
  slow = false; clock += 30_000
  const next = await read(organizationConfig)
  assert.equal(next.syncing, false)
  assert(next.sources.slice(2).every(source => !source.unavailable))
  clock += 31_000
  const complete = await read(organizationConfig)
  assert.equal(complete.unavailable, false)
  assert.equal(complete.contributors[0].count, 12)
})

test('组织和排除项变化隔离缓存，并发轮询共用一次同步；排除全部保留明确组织空状态', async () => {
  let calls = 0
  const read = createDashboardGitcode({ json: async url => {
    calls++
    if (url.includes('/orgs/')) return [{ full_name: url.includes('/orgs/team/') ? 'team/repo' : 'another/repo' }]
    return url.includes('/contributors') ? [] : { events: [] }
  } })
  await Promise.all([read(organizationConfig), read(organizationConfig), read(organizationConfig)])
  assert.equal(calls, 3)
  const excluded = await read({ ...organizationConfig, DASHBOARD_GITCODE_EXCLUDE_REPOS: 'team/repo' })
  assert.equal(calls, 4)
  assert.equal(excluded.organization.includedCount, 0)
  assert.equal(excluded.organization.excludedCount, 1)
  assert.equal(excluded.unavailable, false)
  const another = await read({ ...organizationConfig, DASHBOARD_GITCODE_ORG: 'another' })
  assert.equal(another.sources[0].repo, 'another/repo')
  assert.equal(calls, 7)
})

test('服务组织模式隔离范围，并把同步取消信号传给上游，GitCode慢响应不拖垮飞书任务', async () => {
  let aborted = 0
  const service = createDashboardService({ fetcher: async (url, options) => {
    if (String(url).includes('open.feishu.cn')) return Response.json(String(url).includes('/auth/')
      ? { code: 0, tenant_access_token: 'test-tenant' } : { code: 0, data: { items: [], has_more: false } })
    if (String(url).includes('/orgs/')) return Response.json(organizationRows(4))
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { aborted++; reject(new Error('slow-upstream')) }, { once: true }))
  } })
  const env = { DASHBOARD_ENABLED: 'true', DASHBOARD_PUBLIC: 'true', FEISHU_APP_ID: 'test', FEISHU_APP_SECRET: 'test', FEISHU_BITABLE_APP_TOKEN: 'test', FEISHU_BITABLE_TABLE_ID: 'test', ...organizationConfig }
  const started = Date.now()
  const result = await service({ request: new Request('https://example.test/api/dashboard'), env })
  assert.equal(result.status, 200)
  assert(Date.now() - started < 9500)
  const body = await result.json()
  assert.deepEqual(body.tasks, [])
  assert.equal(body.development.sources.length, 4)
  assert.equal(body.development.syncing, true)
  assert.equal(aborted, 4)
  const excluded = await (await service({ request: new Request('https://example.test/api/dashboard'), env: { ...env, DASHBOARD_GITCODE_EXCLUDE_REPOS: organizationRows(4).map(row => row.full_name).join(',') } })).json()
  assert.equal(excluded.development.sources.length, 0)
})

test('缓存到期但尚未轮到刷新时，保留上次结果并明确等待同步', async () => {
  let clock = instant, slow = false
  const read = createDashboardGitcode({ now: () => clock, budgetMs: 25, json: async (url, options) => {
    if (url.includes('/orgs/')) return organizationRows(6)
    if (slow) await new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
    return url.includes('/contributors') ? [{ name: 'Author', email: 'same@example.test', contributions: 1 }] : { events: [] }
  } })
  const first = await read(organizationConfig)
  assert.equal(first.syncing, false)
  slow = true; clock += 11 * 60_000
  const partial = await read(organizationConfig)
  assert.equal(partial.contributors[0].count, 6)
  assert.equal(partial.syncing, true)
  assert(partial.sources.slice(2).every(source => source.pending && source.updatedAt === instant))
})
