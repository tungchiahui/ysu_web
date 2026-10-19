import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getWikiContentMeta } from '../utils/wiki-content-meta.ts'

const root = process.cwd()
const contentDir = path.join(root, 'content')
const publicDir = path.join(root, '.output/public')
const errors = []
let count = 0

async function inspect(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { await inspect(file); continue }
    if (!/\.mdc?$/i.test(entry.name)) continue
    const stem = path.relative(contentDir, file).replace(/\\/g, '/').replace(/\.mdc?$/i, '')
    const meta = getWikiContentMeta(stem)
    if (!meta) { errors.push(`${stem}: 无法计算 Wiki 地址`); continue }
    count++
    const target = path.join(publicDir, meta.path, 'index.html')
    try {
      const html = await fs.readFile(target, 'utf8')
      if (!html.trim() || !html.includes('wiki-article-header')) errors.push(`${meta.path}: 页面为空或缺少文章标题区域`)
    } catch (error) { errors.push(`${meta.path}: 无法读取生成页面 (${error.code || error.message})`) }
  }
}

await inspect(path.join(contentDir, 'wiki'))
if (errors.length) {
  console.error(`Wiki 产物检查失败：\n${errors.map(error => `- ${error}`).join('\n')}`)
  process.exitCode = 1
} else console.log(`Wiki 产物检查通过：${count} 个页面均已生成且非空。`)
