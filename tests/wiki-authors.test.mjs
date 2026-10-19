import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from '@nuxt/content'
import { wikiFrontmatterFields, resolveWikiAuthors, wikiAuthorProfiles } from '../utils/wiki-authors.mjs'

const schema = z.object(wikiFrontmatterFields(z)).strict()

test('Wiki 接受单人、多人、缺省和显式空作者列表', () => {
  for (const page of [{ title: '章节' }, { title: '章节', authors: ['董佳辉'] }, { title: '章节', authors: ['董佳辉', '张三'] }, { title: '章节', authors: [] }]) {
    assert.equal(schema.safeParse(page).success, true)
  }
})

test('Wiki 拒绝错误作者格式、空姓名、重复姓名和手填自动字段', () => {
  for (const page of [{ title: '' }, { title: '章节', authors: '董佳辉' }, { title: '章节', authors: null }, { title: '章节', authors: [' '] }, { title: '章节', authors: ['董佳辉', '董佳辉'] }, { title: '章节', authors: ['董佳辉', ' 董佳辉 '] }, { title: '章节', path: '/other' }]) {
    assert.equal(schema.safeParse(page).success, false)
  }
})

test('章节作者覆盖首页作者，缺省或数据库 null 继承首页', () => {
  const index = { authors: ['董佳辉'] }
  assert.deepEqual(resolveWikiAuthors({}, index), ['董佳辉'])
  assert.deepEqual(resolveWikiAuthors({ authors: null }, index), ['董佳辉'])
  assert.deepEqual(resolveWikiAuthors({ authors: ['张三'] }, index), ['张三'])
})

test('显式空数组关闭继承，没有作者时返回空列表', () => {
  assert.deepEqual(resolveWikiAuthors({ authors: [] }, { authors: ['董佳辉'] }), [])
  assert.deepEqual(resolveWikiAuthors({}, {}), [])
  assert.deepEqual(resolveWikiAuthors(null, null), [])
})


test('成员作者使用实际头像与编码后的详情地址，外部作者没有无效链接', () => {
  const profiles = wikiAuthorProfiles(['董佳辉', '外部作者'], [{ name: '董佳辉', image: '/images/member_photo/董佳辉.jpg' }], '/images/default.jpg')
  assert.deepEqual(profiles[0], { name: '董佳辉', image: '/images/member_photo/董佳辉.jpg', href: '/team/%E8%91%A3%E4%BD%B3%E8%BE%89' })
  assert.deepEqual(profiles[1], { name: '外部作者', image: '/images/default.jpg', href: null })
  assert.equal(wikiAuthorProfiles(['董佳辉'], [{ name: '董佳辉' }], '/images/default.jpg')[0].image, '/images/default.jpg')
})
