import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from '@nuxt/content'
import { getNewsContentMeta, newsFrontmatterFields } from '../utils/news-content-meta.mjs'

test('只允许标题与作者列表，空作者合法，拒绝旧字段与重复作者', () => {
  const schema = z.object(newsFrontmatterFields(z)).strict()
  assert.equal(schema.safeParse({ title: '新闻', authors: [] }).success, true)
  assert.equal(schema.safeParse({ title: '新闻', authors: ['甲', '乙'] }).success, true)
  for (const extra of ['date', 'author', 'tags', 'image', 'summary', 'bvid']) {
    assert.equal(schema.safeParse({ title: '新闻', authors: [], [extra]: '旧字段' }).success, false)
  }
  assert.equal(schema.safeParse({ title: '新闻', authors: ['甲', '甲'] }).success, false)
  assert.equal(schema.safeParse({ title: '新闻', authors: [' '] }).success, false)
})

test('日期来自文件名，封面来自正文第一张图，摘要保留段落原意', () => {
  const source = '---\ntitle: 新闻\nauthors: []\n---\n\n燕鹰获得**一等奖**，详情见[比赛公告](https://example.com)。\n\n![合影](/images/news/team.jpg)\n\n![另一张图](/images/news/other.jpg)'
  assert.deepEqual(getNewsContentMeta('news/2026-04-14-result', source), {
    date: '2026-04-14', image: '/images/news/team.jpg', summary: '燕鹰获得一等奖，详情见比赛公告。'
  })
})

test('没有配图时保持空封面，跳过标题、图片与来源段落', () => {
  assert.deepEqual(getNewsContentMeta('news/2025-11-14-notice', '# 标题\n\n![图](/images/a.jpg)\n\n公告正文。\n\n原文：[链接](https://example.com)'), {
    date: '2025-11-14', image: '/images/a.jpg', summary: '公告正文。'
  })
  assert.equal(getNewsContentMeta('news/2025-11-14-notice', '公告正文。').image, null)
  assert.equal(getNewsContentMeta('wiki/course', 'Wiki 正文'), null)
})
