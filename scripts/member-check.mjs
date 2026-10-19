import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseDocument } from 'yaml'
import { z } from '@nuxt/content'
import { createMemberSchema } from '../utils/member-schema.mjs'

export async function checkMembers(root = process.cwd()) {
  const schema = createMemberSchema(z)
  const errors = []
  const names = new Set()
  const files = []
  async function collect(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) await collect(file)
      else if (/\.md$/i.test(entry.name)) files.push(file)
    }
  }
  await collect(path.join(root, 'content/members'))
  for (const file of files) {
    const relative = path.relative(root, file)
    const text = await fs.readFile(file, 'utf8')
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    if (!frontmatter) { errors.push(`${relative}: 缺少 YAML frontmatter`); continue }
    const doc = parseDocument(frontmatter[1], { uniqueKeys: true })
    if (doc.errors.length) { errors.push(...doc.errors.map(error => `${relative}: ${error.message}`)); continue }
    const result = schema.safeParse(doc.toJS())
    if (!result.success) {
      errors.push(...result.error.issues.map(issue => `${relative}: ${issue.path.join('.') || 'frontmatter'} — ${issue.message}`))
      continue
    }
    const person = result.data
    if (names.has(person.name)) errors.push(`${relative}: 姓名重复，会导致详情页地址冲突`)
    names.add(person.name)
    if (path.basename(file, '.md') !== person.name) errors.push(`${relative}: 文件名必须与 name 一致`)
    if (person.image) {
      const publicRoot = path.resolve(root, 'public') + path.sep
      const image = path.resolve(root, 'public', `.${person.image}`)
      if (!image.startsWith(publicRoot)) errors.push(`${relative}: 图片路径超出 public 目录`)
      else {
        try { if (!(await fs.stat(image)).isFile()) throw new Error('not a file') }
        catch { errors.push(`${relative}: 头像文件不存在 ${person.image}`) }
      }
    }
  }
  if (!files.length) errors.push('content/members: 至少需要一份人员档案')
  return { files: files.length, errors }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await checkMembers()
    if (result.errors.length) {
      console.error(`成员检查失败，共 ${result.errors.length} 个问题：\n${result.errors.map(error => `- ${error}`).join('\n')}`)
      process.exitCode = 1
    } else console.log(`成员检查通过：${result.files} 份档案，字段、赛季、组别、职务和头像均正常。`)
  } catch (error) { console.error(`成员检查失败：${error.message}`); process.exitCode = 1 }
}
