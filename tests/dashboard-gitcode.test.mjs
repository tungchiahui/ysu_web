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
