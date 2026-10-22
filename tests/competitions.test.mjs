import test from 'node:test'
import assert from 'node:assert/strict'
import { competitions } from '../app/data/competitions.ts'
import { prepareCompetitions, competitionTimeLeft } from '../app/utils/competitions.ts'

const event = { name: '测试赛事', startsAt: '2027-01-01T09:00:00+08:00', dateStatus: 'confirmed', enabled: true }

test('实际赛事默认待定，不把猜测时间作为正式赛程', () => {
  assert.deepEqual(competitions.map(item => item.name), ['2027 RMUL 山东站', '2027 RMUC'])
  assert(prepareCompetitions(competitions).every(item => item.target === null && item.dateStatus === 'pending'))
  assert.equal(competitionTimeLeft(null, Date.now()).state, 'pending')
})

test('明确按北京时间解析，错误日期、缺失时区及矛盾状态阻止构建', () => {
  assert.equal(prepareCompetitions([event])[0].target, Date.parse('2027-01-01T01:00:00Z'))
  assert.doesNotThrow(() => prepareCompetitions([{ ...event, startsAt: '2028-02-29T09:00:00+08:00' }]))
  for (const startsAt of [null, '2027-01-01', '2027-01-01T09:00:00', '2027-01-01T09:00:00Z', '2027-02-29T09:00:00+08:00', '2027-02-30T09:00:00+08:00', '2027-01-01T24:00:00+08:00']) {
    assert.throws(() => prepareCompetitions([{ ...event, startsAt }]), /app\/data\/competitions.ts/)
  }
  assert.throws(() => prepareCompetitions([{ ...event, dateStatus: 'pending' }]), /同时更新 dateStatus/)
  assert.throws(() => prepareCompetitions([{ ...event, dateStatus: 'unknown' }]), /日期状态/)
  assert.throws(() => prepareCompetitions([{ ...event, name: ' ' }]), /名称/)
  assert.throws(() => prepareCompetitions([event, event]), /重复/)
  assert.throws(() => prepareCompetitions([{ ...event, enabled: 'false' }]), /enabled/)
})

test('跨日与秒边界倒计时准确，到期后不出现负数', () => {
  const target = prepareCompetitions([event])[0].target
  assert.deepEqual(competitionTimeLeft(target, target - 86400_000 - 3661_000), { state: 'counting', days: 1, clock: '01:01:01' })
  assert.deepEqual(competitionTimeLeft(target, target - 1), { state: 'counting', days: 0, clock: '00:00:01' })
  assert.deepEqual(competitionTimeLeft(target, target), { state: 'reached', days: 0, clock: '00:00:00' })
  assert.deepEqual(competitionTimeLeft(target, target + 86400_000), { state: 'reached', days: 0, clock: '00:00:00' })
  assert.equal(competitionTimeLeft(target, 0).state, 'waiting')
})
