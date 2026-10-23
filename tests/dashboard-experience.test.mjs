import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardUrgency, dashboardNextDeadlines, dashboardPreferences, readDashboardPreferences, dashboardCompletionStats } from '../utils/dashboard-experience.mjs'

const parse = value => Date.parse(value + '+08:00')
const task = (id, overrides = {}) => ({ id, status: 'todo', deadline: null, completedAt: null, priority: 'medium', ...overrides })

test('临近截止按北京时间区分今日、跨日24小时及三天，边界不误报', () => {
  const now = parse('2026-10-22T23:00:00')
  const urgency = (value, extra = {}) => dashboardUrgency(task('x', { deadline: parse(value), ...extra }), now)
  assert.equal(urgency('2026-10-22T23:00:00').level, 'overdue')
  assert.equal(urgency('2026-10-22T23:59:59').level, 'today')
  assert.equal(urgency('2026-10-23T00:00:00').level, 'soon')
  assert.equal(urgency('2026-10-23T23:00:00').level, 'soon')
  assert.equal(urgency('2026-10-25T23:00:00').level, 'upcoming')
  assert.equal(urgency('2026-10-25T23:00:01'), null)
  assert.equal(urgency('2026-10-22T23:59:59', { status: 'done' }), null)
  assert.equal(dashboardUrgency(task('x'), now), null)
})

test('相同最近截止任务完整返回，排序稳定，排除已完成、已逾期及无日期', () => {
  const now = parse('2026-10-22T12:00:00'), deadline = now + 1000
  const rows = [task('z', { deadline }), task('a', { deadline }), task('priority', { deadline, priority: 'high' }),
    task('done', { deadline, status: 'done' }), task('overdue', { deadline: now }), task('empty'), task('later', { deadline: deadline + 1 })]
  assert.deepEqual(dashboardNextDeadlines(rows, now).map(row => row.id), ['priority', 'a', 'z'])
  assert.deepEqual(dashboardNextDeadlines(rows, deadline).map(row => row.id), ['later'])
  assert.deepEqual(dashboardNextDeadlines([], now), [])
})

test('显示偏好严格白名单保存，不接受口令、任务数据及无效结构', () => {
  const defaults = { version: 1, group: 'all', status: 'todo', screen: false, autoRotate: true }
  assert.deepEqual(readDashboardPreferences('broken'), defaults)
  assert.deepEqual(readDashboardPreferences('[]'), defaults)
  assert.deepEqual(readDashboardPreferences('{"version":99,"screen":true}'), defaults)
  assert.deepEqual(dashboardPreferences({ version: 1, group: '机械组', status: 'done', screen: true, autoRotate: false, authorization: 'never-save', tasks: ['private'] }),
    { version: 1, group: '机械组', status: 'done', screen: true, autoRotate: false })
  assert.deepEqual(dashboardPreferences({ version: 1, group: {}, status: 'unknown', screen: 'true', autoRotate: 0 }), defaults)
  assert.equal(dashboardPreferences({ version: 1, group: 'x'.repeat(101) }).group, 'all')
})

test('完成统计以北京时间周一及最近七个自然日为界，不计未来或缺失完成时间', () => {
  const now = parse('2026-10-26T00:30:00') // 周一
  const rows = [
    task('monday', { status: 'done', completedAt: parse('2026-10-26T00:00:00'), deadline: parse('2026-10-26T00:00:00') }),
    task('sunday', { status: 'done', completedAt: parse('2026-10-25T23:59:59'), deadline: parse('2026-10-25T22:00:00') }),
    task('late', { status: 'done', completedAt: parse('2026-10-26T00:20:00'), deadline: parse('2026-10-26T00:10:00') }),
    task('noDeadline', { status: 'done', completedAt: parse('2026-10-26T00:10:00') }),
    task('old', { status: 'done', completedAt: parse('2026-10-19T23:59:59') }),
    task('missing', { status: 'done' }),
    task('future', { status: 'done', completedAt: now + 1 }),
    task('notDone', { completedAt: now - 1 })
  ]
  const result = dashboardCompletionStats(rows, now)
  assert.equal(result.weekCount, 3)
  assert.equal(result.recentCount, 4)
  assert.equal(result.days[0].date, '2026-10-20')
  assert.equal(result.days[6].count, 3)
  assert.equal(result.missingTimeCount, 2)
  assert.equal(result.onTimeRate, 50)
  assert.equal(result.eligibleCount, 2)
  assert.equal(result.weekWithoutDeadline, 1)
})

test('没有完成时间时不编造零值趋势或按时率，有效空任务与跨年日期正常', () => {
  const now = parse('2027-01-01T10:00:00')
  const missing = dashboardCompletionStats([task('missing', { status: 'done' })], now)
  assert.equal(missing.available, false)
  assert.equal(missing.onTimeRate, null)
  assert.equal(dashboardCompletionStats([], now).available, true)
  const result = dashboardCompletionStats([task('year', { status: 'done', completedAt: parse('2026-12-31T23:59:59') })], now)
  assert.equal(result.weekCount, 1)
  assert.equal(result.days.at(-2).date, '2026-12-31')
  assert.equal(result.onTimeRate, null)
})

test('研发人员按成员GitCode主页账号对应，头像姓名和站内介绍来自同一档案', async () => {
  const { dashboardCodeProfile } = await import('../utils/dashboard-members.mjs')
  const logo = '/images/team.jpg'
  const members = [{ name: '成员甲', image: '/images/member.jpg', links: { gitcode: 'https://gitcode.com/Example-Member/' } }]
  for (const person of [{ name: 'GitCode昵称', href: 'https://gitcode.com/example-member' },
    { name: '别名', login: 'EXAMPLE-MEMBER' }, { name: 'example-member', href: 'https://gitcode.com/team/repo' }]) {
    const profile = dashboardCodeProfile(person, members, logo)
    assert.equal(profile.name, '成员甲')
    assert.equal(profile.href, `/team/${encodeURIComponent('成员甲')}`)
    assert.equal(profile.image, '/images/member.jpg')
    assert.equal(profile.external, false)
  }
  assert.equal(dashboardCodeProfile({ name: 'example-member' }, [{ ...members[0], image: '' }], logo).image, logo)
})

test('未填GitCode、非个人主页或重复账号不误连队员，未知作者用队徽及可信GitCode地址', async () => {
  const { dashboardCodeProfile, gitcodeProfileLogin } = await import('../utils/dashboard-members.mjs')
  const logo = '/images/team.jpg', member = { name: '成员甲', image: '/images/member.jpg' }
  for (const links of [undefined, { github: 'https://github.com/example' }, { gitcode: 'https://gitcode.com/team/repo' },
    { gitcode: 'https://gitcode.com.evil.test/example' }, { gitcode: 'https://user:pass@gitcode.com/example' }]) {
    const profile = dashboardCodeProfile({ name: 'example', href: 'https://gitcode.com/team/repo', avatar: 'https://outside.example.test/avatar.png' }, [{ ...member, links }], logo)
    assert.equal(profile.name, 'example')
    assert.equal(profile.image, logo)
    assert.equal(profile.href, 'https://gitcode.com/team/repo')
    assert.equal(profile.external, true)
  }
  const duplicate = [member, { name: '成员乙' }].map(row => ({ ...row, links: { gitcode: 'https://gitcode.com/example' } }))
  assert.equal(dashboardCodeProfile({ name: 'example' }, duplicate, logo).external, true)
  assert.equal(dashboardCodeProfile({ name: '成员甲' }, [member], logo).external, true)
  assert.equal(dashboardCodeProfile({ name: 'unknown', href: 'https://github.com/unknown' }, [], logo).href, 'https://gitcode.com')
  for (const href of ['https://gitcode.com/.', 'https://gitcode.com/..', 'http://gitcode.com/example', 'https://gitcode.com/example?token=private']) assert.equal(gitcodeProfileLogin(href), '')
})
