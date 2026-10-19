import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { getWikiContentMeta } from '../utils/wiki-content-meta.ts'

export async function checkWikiOutput(root, publicDir) {
  const contentDir = path.join(root, 'content')
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
  return { count, errors }
}

export async function validateWikiOutput(publicDir, root = process.cwd()) {
  const result = await checkWikiOutput(root, publicDir)
  const directory = path.relative(root, publicDir) || '.'
  if (result.errors.length) {
    throw new Error(`Wiki 产物检查失败（目录：${directory}）：\n${result.errors.map(error => `- ${error}`).join('\n')}`)
  }
  console.log(`Wiki 产物检查通过：${result.count} 个页面均已生成且非空（目录：${directory}）。`)
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await validateWikiOutput(path.resolve(process.argv[2] || '.output/public'))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
