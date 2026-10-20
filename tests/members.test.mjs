import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { z } from '@nuxt/content'
import { createMemberSchema } from '../utils/member-schema.mjs'
import { matchesMember, memberRoleText, memberSeasonText, hasMemberSeason, seasonFilterLabel } from '../app/utils/members.ts'
import { checkMembers } from '../scripts/member-check.mjs'

const schema = createMemberSchema(z)
const student = { kind: 'student', name: '测试学生', affiliation: '电气工程学院', grade: 2026, seasons: [{ year: 2027, group: '算法组', roles: ['成员'] }] }
const teacher = { kind: 'teacher', name: '测试老师', affiliation: '机械工程学院', seasons: [] }
const valid = value => assert.equal(schema.safeParse(value).success, true)
const invalid = value => assert.equal(schema.safeParse(value).success, false)

test('人员字段拒绝旧分类、梯队、缺失学生任职及错误年份', () => {
  valid(student)
  valid(teacher)
  invalid({ ...student, university: '燕山大学' })
  invalid({ ...teacher, university: '山东理工大学' })
  for (const group of ['控制组', '电路组', '运营', '梯队']) invalid({ ...student, seasons: [{ year: 2027, group, roles: ['成员'] }] })
  invalid({ ...student, grade: '2026' })
  invalid({ ...student, seasons: [] })
  invalid({ ...student, seasons: [student.seasons[0], student.seasons[0]] })
  invalid({ ...student, tier: '梯队' })
  invalid({ ...student, advisor: 2028 })
  invalid({ ...teacher, grade: 2026 })
  invalid({ ...teacher, seasons: student.seasons })
})

test('职务支持兼任并拒绝矛盾或重复身份', () => {
  valid({ ...student, seasons: [{ year: 2027, group: '算法组', roles: ['副队长', '组长'] }] })
  for (const roles of [['教练'], ['成员', '组长'], ['队长', '副队长'], ['组长', '组长']]) {
    invalid({ ...student, seasons: [{ year: 2027, group: '算法组', roles }] })
  }
})

test('组别与职务筛选不会拼接不同赛季的任职', () => {
  const history = { ...student, seasons: [{ year: 2027, group: '机械组', roles: ['队长'] }, { year: 2028, group: '算法组', roles: ['组长'] }] }
  const filter = { season: 'all', kind: 'all', group: '算法组', role: '队长', search: '' }
  assert.equal(matchesMember(history, filter), false)
  assert.equal(matchesMember(history, { ...filter, role: '组长' }), true)
  assert.equal(matchesMember(history, { ...filter, season: '2027', role: '组长' }), false)
  assert.equal(memberRoleText(history, '2028'), '算法组组长')
  assert.equal(memberRoleText(student, '2027'), '算法组成员')
})

test('运营组资料可校验，筛选和职务展示使用对应赛季', () => {
  const operations = { ...student, seasons: [
    { year: 2027, group: '运营组', roles: ['副队长', '组长'] },
    { year: 2026, group: '算法组', roles: ['成员'] }
  ] }
  valid(operations)
  const filter = { season: '2027', kind: 'student', group: '运营组', role: '组长', search: '运营' }
  assert.equal(matchesMember(operations, filter), true)
  assert.equal(matchesMember(operations, { ...filter, season: '2026' }), false)
  assert.equal(matchesMember(operations, { ...filter, season: 'all', role: '成员' }), false)
  assert.equal(memberRoleText(operations, '2027'), '副队长、运营组组长')
  const member = { ...student, seasons: [{ year: 2027, group: '运营组', roles: ['成员'] }] }
  valid(member)
  assert.equal(memberRoleText(member, '2027'), '运营组成员')
})

test('老师按实际指导赛季显示，不参与学生职务筛选', () => {
  assert.equal(hasMemberSeason(teacher, '2027'), true)
  assert.equal(hasMemberSeason({ ...teacher, seasons: [{ year: 2026 }] }, '2027'), false)
  assert.equal(matchesMember(teacher, { season: 'all', kind: 'teacher', group: 'all', role: 'all', search: '' }), true)
  assert.equal(matchesMember(teacher, { season: 'all', kind: 'teacher', group: 'all', role: '成员', search: '' }), false)
  assert.equal(memberSeasonText({ ...teacher, seasons: [{ year: 2024 }, { year: 2025 }, { year: 2026 }] }), '2024–2026')
})

test('赛季值仅显示四位年份，顶部筛选显示两位年份加赛季', () => {
  assert.equal(memberSeasonText(student), '2027')
  assert.equal(memberSeasonText(teacher), '不限')
  assert.equal(memberSeasonText({ ...teacher, seasons: [{ year: 2027 }, { year: 2029 }] }), '2027、2029')
  assert.equal(seasonFilterLabel(2027), '27赛季')
  assert.equal(seasonFilterLabel(2007), '07赛季')
  assert.equal(memberRoleText({ ...student, seasons: [...student.seasons, { year: 2028, group: '算法组', roles: ['组长'] }] }), '2028：算法组组长；2027：算法组成员')
})

test('原始 YAML 校验报告错误字段及不存在的头像', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ysu-member-check-'))
  try {
    const dir = path.join(root, 'content/members')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, '测试老师.md'), '---\nkind: teacher\nname: 测试老师\naffiliation: 机械工程学院\nimage: /images/missing.jpg\n---\n')
    let result = await checkMembers(root)
    assert(result.errors.some(error => error.includes('头像文件不存在')))
    await fs.writeFile(path.join(dir, '测试老师.md'), '---\nkind: teacher\nkind: student\n---\n')
    result = await checkMembers(root)
    assert(result.errors.some(error => /unique|重复/i.test(error)))
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})
