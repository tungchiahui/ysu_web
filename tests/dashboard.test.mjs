import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardGridLayout, dashboardMemberPath, normalizeDashboardRecords, dashboardTaskState, selectDashboardTasks, dashboardRanks, safeDashboardUrl } from '../utils/dashboard-data.mjs'
import { createDashboardService } from '../utils/dashboard-service.mjs'
import { dashboardFixtures } from './fixtures/dashboard.mjs'
import { onRequest } from '../edge-functions/api/dashboard.js'

const instant = Date.parse('2027-01-01T00:00:00+08:00')
const env = { DASHBOARD_ENABLED: 'true', DASHBOARD_ACCESS_CODE: 'test-access-code-only',
  FEISHU_APP_ID: 'cli_test', FEISHU_APP_SECRET: 'secret-test-only', FEISHU_BITABLE_APP_TOKEN: 'base_test', FEISHU_BITABLE_TABLE_ID: 'tbl_test' }
const context = (options = {}) => ({ env, request: new Request('https://example.test/api/dashboard', { headers: { Authorization: `Bearer ${env.DASHBOARD_ACCESS_CODE}` } }), ...options })
const reply = body => Response.json(body)
const records = dashboardFixtures(instant).records

test('EO 路由入口提供 onRequest，未配置时返回关闭状态 JSON', async () => {
  const result = await onRequest({ request: new Request('https://example.test/api/dashboard'), env: {} })
  assert.equal(result.status, 503)
  assert.match(result.headers.get('Content-Type'), /application\/json/)
  assert.equal((await result.json()).code, 'NOT_CONFIGURED')
})
function upstream(calls = []) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), ...options })
    if (String(url).includes('/auth/')) return reply({ code: 0, tenant_access_token: 'tenant-test-only', expire: 7200 })
    return reply({ code: 0, data: { items: records, has_more: false } })
  }
}

test('飞书字段兼容文章写法，返回白名单字段并按人员标识去重', () => {
  const task = normalizeDashboardRecords([{ record_id: 'record', fields: {
    任务名称: [{ text: '<img src=x onerror=alert(1)>' }], 组别: '机械组', 完成情况: '未完成', 最晚截止日期: instant,
    执行人: [{ id: 'person', name: '张三', email: 'private@example.test', avatar_url: 'javascript:alert(1)' }, { id: 'person', name: '张三' }],
    发布人: { id: 'author', name: '李四' }, 优先级: 'P0-高', 内部资料: 'never-return'
  } }])[0]
  assert.equal(task.title, '<img src=x onerror=alert(1)>')
  assert.equal(task.group, '机械组')
  assert.equal(task.deadline, instant)
  assert.equal(task.priority, 'high')
  assert.deepEqual(task.assignees, [{ key: 'person', name: '张三', avatar: '' }])
  assert.equal(task.publisher, '李四')
  assert(!JSON.stringify(task).includes('private@example.test'))
  assert(!JSON.stringify(task).includes('never-return'))
  assert.equal(safeDashboardUrl('https://user:password@example.test'), '')
})

test('字段映射、错误状态及日期处理，不将错误表格伪装成空待办', () => {
  const input = [{ record_id: 'id', fields: { 标题: '任务', 状态: '已完成' } }]
  assert.equal(normalizeDashboardRecords(input, { title: '标题', status: '状态' })[0].status, 'done')
  assert.throws(() => normalizeDashboardRecords(input, { typo: '标题' }), /INVALID_FIELD_MAP/)
  assert.throws(() => normalizeDashboardRecords([{ record_id: 'id', fields: { 任务名称: '任务', 完成状态: '正在进行' } }]), /INVALID_TASK_STATUS/)
  assert.throws(() => normalizeDashboardRecords([{ record_id: 'id', fields: { 任务名称: '任务', 完成状态: '未完成', 截止时间: 'bad date' } }]), /INVALID_TASK_DATE/)
})

test('现有任务表的部门多选分别筛选，不拼接标签或重复计任务', () => {
  const tasks = normalizeDashboardRecords([{ record_id: 'task', fields: {
    任务详情: '多部门任务', 负责人: [{ id: 'person', name: '成员' }],
    '负责人.部门': ['哨兵组', '机械组', '组长', '机械组'], 完成情况: '未完成', 最晚截止日期: instant
  } }], { title: '任务详情', assignees: '负责人', group: '负责人.部门' })
  assert.deepEqual(tasks[0].groups, ['哨兵组', '机械组', '组长'])
  assert.equal(tasks[0].group, '哨兵组、机械组、组长')
  assert.equal(tasks[0].completedAt, null)
  assert.equal(selectDashboardTasks(tasks, { status: 'all', group: '机械组' }).length, 1)
  assert.equal(selectDashboardTasks(tasks, { status: 'all', group: '哨兵组' }).length, 1)
  assert.equal(selectDashboardTasks(tasks, { status: 'all', group: '算法组' }).length, 0)
  assert.equal(dashboardRanks(selectDashboardTasks(tasks, { status: 'all', group: '机械组' }), 'todo')[0].count, 1)
})

test('截止边界实时进入逾期，已完成任务不逾期，无截止任务排最后', () => {
  const tasks = dashboardFixtures(instant).data.tasks
  const task = tasks[0]
  assert.equal(dashboardTaskState(task, task.deadline - 1), 'todo')
  assert.equal(dashboardTaskState(task, task.deadline), 'overdue')
  assert.equal(dashboardTaskState({ ...task, status: 'done' }, task.deadline + 1), 'done')
  const pending = selectDashboardTasks(tasks, { now: instant })
  assert.equal(pending.length, 7)
  assert.equal(pending.at(-1).deadline, null)
  assert.equal(selectDashboardTasks(tasks, { status: 'overdue', now: instant }).length, 2)
  assert.equal(selectDashboardTasks(tasks, { status: 'done', now: instant }).length, 3)
  assert.equal(selectDashboardTasks(tasks, { group: '运营组', status: 'all', search: '归档', now: instant }).length, 0)
  assert.equal(selectDashboardTasks(tasks, { status: 'all', search: '示例成员甲', now: instant }).length, 3)
})

test('任务榜按执行人统计，多人任务各记一次，同名不同标识不合并', () => {
  const rows = dashboardRanks([
    { status: 'todo', assignees: [{ key: '1', name: '同名' }, { key: '2', name: '同名' }] },
    { status: 'done', assignees: [{ key: '1', name: '同名' }] },
    { status: 'todo', assignees: [{ key: '1', name: '同名' }] }
  ], 'todo')
  assert.deepEqual(rows.map(row => [row.key, row.count]), [['1', 2], ['2', 1]])
})

test('未配置、错误口令及写入请求均不访问上游，响应不缓存', async () => {
  const calls = [], handler = createDashboardService({ fetcher: upstream(calls) })
  const closed = await handler(context({ env: {} }))
  assert.equal(closed.status, 503)
  assert.equal((await closed.json()).code, 'NOT_CONFIGURED')
  const locked = await handler(context({ request: new Request('https://example.test/api/dashboard') }))
  assert.equal(locked.status, 401)
  assert.equal(locked.headers.get('Cache-Control'), 'no-store')
  const wrong = await handler(context({ request: new Request('https://example.test/api/dashboard', { headers: { Authorization: 'Bearer wrong' } }) }))
  assert.equal(wrong.status, 401)
  const write = await handler(context({ request: new Request('https://example.test/api/dashboard', { method: 'POST' }) }))
  assert.equal(write.status, 405)
  assert.equal(calls.length, 0)
})

test('分页读取完整任务，复用令牌和缓存，缓存命中仍需口令', async () => {
  const calls = []
  const handler = createDashboardService({ now: () => instant, fetcher: async (url, options = {}) => {
    calls.push({ url: String(url), ...options })
    if (String(url).includes('/auth/')) return reply({ code: 0, tenant_access_token: 'tenant-test-only', expire: 7200 })
    const second = new URL(url).searchParams.get('page_token') === 'next'
    return reply({ code: 0, data: { items: second ? records.slice(6) : records.slice(0, 6), has_more: !second, page_token: second ? '' : 'next' } })
  } })
  const result = await handler(context())
  const body = await result.json()
  assert.equal(body.tasks.length, 12)
  assert.equal(body.github.enabled, false)
  assert(!JSON.stringify(body).includes('tenant-test-only'))
  await handler(context())
  assert.equal(calls.length, 3)
  assert(calls.every(call => call.method === undefined || call.url.includes('/auth/')))
  const unauthorized = await handler(context({ request: new Request('https://example.test/api/dashboard') }))
  assert.equal(unauthorized.status, 401)
  assert.equal(calls.length, 3)
})

test('并发请求合并上游读取，凭证改变后的请求不会复用旧数据', async () => {
  const calls = [], handler = createDashboardService({ fetcher: upstream(calls), now: () => instant })
  await Promise.all([handler(context()), handler(context()), handler(context())])
  assert.equal(calls.length, 2)
  await handler(context({ env: { ...env, FEISHU_APP_SECRET: 'rotated-secret-only' } }))
  assert.equal(calls.length, 4)
})

test('上游失败保留15分钟内的上次结果，超过期限报错而不是返回空任务', async () => {
  let time = instant, fail = false
  const fetcher = upstream()
  const handler = createDashboardService({ now: () => time, fetcher: (...args) => {
    if (fail) throw new Error('private upstream detail must not leak')
    return fetcher(...args)
  } })
  await handler(context())
  fail = true; time += 31_000
  const stale = await (await handler(context())).json()
  assert.equal(stale.stale, true)
  assert.equal(stale.tasks.length, 12)
  time += 15 * 60_000
  const error = await handler(context())
  assert.equal(error.status, 502)
  assert.equal((await error.json()).code, 'DATA_UNAVAILABLE')
})

test('失效飞书令牌自动刷新一次，读取失败不会泄露上游返回', async () => {
  let auth = 0, read = 0
  const handler = createDashboardService({ fetcher: async url => {
    if (String(url).includes('/auth/')) return reply({ code: 0, tenant_access_token: `token-${++auth}`, expire: 7200 })
    read++
    return read === 1 ? reply({ code: 99991663, msg: 'expired' }) : reply({ code: 0, data: { items: [], has_more: false } })
  } })
  assert.equal((await handler(context())).status, 200)
  assert.equal(auth, 2)
  assert.equal(read, 2)
})

test('分页异常、超过2000条与字段错误不返回残缺成功结果', async () => {
  for (const data of [
    { items: records, has_more: true, page_token: 'same' },
    { items: records, has_more: true },
    { items: [{ record_id: 'id', fields: { 错误标题: 'wrong' } }], has_more: false }
  ]) {
    const handler = createDashboardService({ fetcher: async url => String(url).includes('/auth/')
      ? reply({ code: 0, tenant_access_token: 'token' }) : reply({ code: 0, data }) })
    assert.equal((await handler(context())).status, 502)
  }
  let pages = 0
  const handler = createDashboardService({ fetcher: async url => String(url).includes('/auth/')
    ? reply({ code: 0, tenant_access_token: 'token' })
    : reply({ code: 0, data: { items: Array.from({ length: 500 }, () => records[0]), has_more: true, page_token: `next-${++pages}` } }) })
  const result = await handler(context())
  assert.equal(result.status, 502)
  assert.equal((await result.json()).reason, 'TASK_LIMIT_EXCEEDED')
  assert.equal(pages, 4)
})

test('公开访问必须显式开启，空口令不会自动使私有看板公开', async () => {
  const handler = createDashboardService({ fetcher: upstream() })
  const request = new Request('https://example.test/api/dashboard')
  assert.equal((await handler({ request, env: { ...env, DASHBOARD_ACCESS_CODE: '' } })).status, 503)
  assert.equal((await handler({ request, env: { ...env, DASHBOARD_ACCESS_CODE: '', DASHBOARD_PUBLIC: 'true' } })).status, 200)
})

test('可选GitCode读取仓库统计，独立缓存并隔离故障', async () => {
  const calls = [], fetcher = upstream(calls)
  const handler = createDashboardService({ now: () => instant, fetcher: async (url, options) => {
    if (!String(url).startsWith('https://api.gitcode.com/')) return fetcher(url, options)
    calls.push({ url })
    if (String(url).includes('/contributors')) return reply([{ name: 'developer', email: 'private@example.test', contributions: 8 }])
    return reply({ events: [{ id: 1, action_name: 'pushed', author: { username: 'developer' }, created_at: '2026-12-31T16:00:00Z' }] })
  } })
  const config = context({ env: { ...env, DASHBOARD_GITCODE_REPOS: 'example/robot' } })
  const body = await (await handler(config)).json()
  assert.equal(body.development.contributors[0].count, 8)
  assert.equal(body.development.events[0].action, '推送了代码')
  assert(!JSON.stringify(body).includes('private@example.test'))
  await handler(config)
  assert.equal(calls.length, 4)
  const broken = await (await handler(context({ env: { ...env, DASHBOARD_GITCODE_REPOS: 'https://malicious.test/' } }))).json()
  assert.equal(broken.tasks.length, 12)
  assert.equal(broken.development.unavailable, true)
  const isolated = createDashboardService({ fetcher: async (url, options) => String(url).startsWith('https://api.gitcode.com/')
    ? new Response('unavailable', { status: 500 }) : fetcher(url, options) })
  const result = await (await isolated(config)).json()
  assert.equal(result.tasks.length, 12)
  assert.equal(result.development.unavailable, true)
  assert.deepEqual(result.development.events, [])
})

test('面板容量随真实可用宽高增长，窄屏至少保留一列一行', () => {
  assert.deepEqual(dashboardGridLayout(330, 210), { columns: 1, rows: 1, size: 1 })
  assert.deepEqual(dashboardGridLayout(1060, 680), { columns: 2, rows: 2, size: 4 })
  assert.deepEqual(dashboardGridLayout(2470, 1370), { columns: 6, rows: 5, size: 30 })
  assert.equal(dashboardGridLayout(1060, 910).size, 6)
  assert.equal(dashboardGridLayout(1060, 910, 10, 20).size, 4)
  assert.equal(dashboardGridLayout(0, 0).size, 1)
})

test('紧凑卡片按实际行高增加容量，不因屏幕较高拉伸卡片', () => {
  assert.deepEqual(dashboardGridLayout(1060, 680, 10, 16, 224), { columns: 2, rows: 2, size: 4 })
  assert.deepEqual(dashboardGridLayout(1060, 700, 10, 16, 224), { columns: 2, rows: 3, size: 6 })
  assert.equal(dashboardGridLayout(1060, 700, 10, 16).size, 4)
  assert.equal(dashboardGridLayout(1060, 700, 10, 16, NaN).size, 4)
})

test('成员入口直达已有档案，缺少档案时不生成链接', () => {
  assert.equal(dashboardMemberPath('成员甲', ['成员甲']), '/team/' + encodeURIComponent('成员甲'))
  assert.equal(dashboardMemberPath('成员乙 & /'), '')
  const task = normalizeDashboardRecords([{ record_id: 'publisher-test', fields: {
    任务名称: '任务', 完成情况: '未完成', 发布人: [{ id: 'p', name: '成员甲', avatar_url: 'https://example.test/avatar.png', email: 'private@example.test' }]
  } }])[0]
  assert.deepEqual(task.publishers, [{ key: 'p', name: '成员甲', avatar: 'https://example.test/avatar.png' }])
  assert(!JSON.stringify(task).includes('private@example.test'))
})
