import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseDocument } from 'yaml'
import { z } from '@nuxt/content'
import { newsFrontmatterFields, getNewsContentMeta } from '../utils/news-content-meta.mjs'

const root = process.cwd()
const schema = z.object(newsFrontmatterFields(z)).strict()
const errors = []
const files = (await fs.readdir(path.join(root, 'content/news'))).filter(file => file.endsWith('.md'))

for (const file of files) {
  const source = await fs.readFile(path.join(root, 'content/news', file), 'utf8')
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) { errors.push(`${file}: 缺少 frontmatter`); continue }
  const document = parseDocument(match[1], { uniqueKeys: true })
  if (document.errors.length) { errors.push(`${file}: YAML 格式错误`); continue }
  const result = schema.safeParse(document.toJS())
  if (!result.success) errors.push(...result.error.issues.map(issue => `${file}: ${issue.message}`))
  const { date } = getNewsContentMeta(`news/${file.replace(/\.md$/, '')}`, source)
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(file) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    errors.push(`${file}: 文件名须以有效日期 YYYY-MM-DD- 开头`)
  }
  for (const image of source.matchAll(/!\[[^\]]*\]\((\/images\/[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const imagePath = path.resolve(root, 'public', `.${image[1]}`)
    if (!imagePath.startsWith(`${path.join(root, 'public/images')}${path.sep}`)) {
      errors.push(`${file}: 图片路径越界`)
      continue
    }
    try { await fs.access(imagePath) } catch { errors.push(`${file}: 图片不存在 ${image[1]}`) }
  }
}

if (errors.length) {
  console.error(`新闻检查失败，共 ${errors.length} 个问题：\n${errors.join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`新闻检查通过：${files.length} 篇，手写字段仅 title/authors，日期及正文图片正常。`)
}
