import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// These are generated mirrors. Edit the source repository, never these directories.
const root = process.cwd()
const config = JSON.parse(await fs.readFile(path.join(root, 'content-source.json'), 'utf8'))
const repository = process.env.CONTENT_REPOSITORY || config.repository
const ref = process.env.CONTENT_REF || config.ref
const localPath = process.env.CONTENT_LOCAL_PATH
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'ysu-content-'))
let staging

function git(args, cwd, env = {}) {
  const result = spawnSync('git', ['-c', 'credential.helper=', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env },
    maxBuffer: 1024 * 1024
  })
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr.trim() || 'Git 操作失败')
  }
  return result.stdout.trim()
}

try {
  let source
  let revision
  if (localPath) {
    source = path.resolve(root, localPath)
    if (source === root || source.startsWith(`${root}${path.sep}`)) {
      throw new Error('CONTENT_LOCAL_PATH 必须指向网站目录之外的内容仓库。')
    }
    revision = 'local-working-tree'
  } else {
    if (!repository || !ref || String(ref).startsWith('-')) {
      throw new Error('请配置有效的内容仓库地址与分支、标签或提交版本。')
    }
    const authEnv = {}
    if (process.env.CONTENT_GIT_TOKEN) {
      const askpass = path.join(work, 'askpass.cjs')
      await fs.writeFile(askpass,
        '#!/usr/bin/env node\nprocess.stdout.write(/username/i.test(process.argv[2] || "") ? "x-access-token\\n" : (process.env.CONTENT_GIT_TOKEN + "\\n"))\n',
        { mode: 0o700 })
      authEnv.GIT_ASKPASS = askpass
    }
    source = path.join(work, 'checkout')
    await fs.mkdir(source)
    git(['init', '--quiet'], source)
    git(['remote', 'add', 'origin', repository], source)
    git(['fetch', '--quiet', '--depth', '1', 'origin', ref], source, authEnv)
    git(['checkout', '--quiet', '--detach', 'FETCH_HEAD'], source)
    revision = git(['rev-parse', 'HEAD'], source)
  }

  // Validate before replacing any usable local snapshot.
  for (const dir of ['content/members', 'content/news', 'content/wiki', 'public', 'data']) {
    if (!(await fs.stat(path.join(source, dir))).isDirectory()) {
      throw new Error(`内容仓库缺少目录：${dir}`)
    }
  }
  for (const file of ['site.json', 'achievements.json', 'home-promos.json']) {
    JSON.parse(await fs.readFile(path.join(source, 'data', file), 'utf8'))
  }

  staging = await fs.mkdtemp(path.join(root, '.content-sync-'))
  const targets = [['content', 'content'], ['public', 'public'], ['data', '.content-data']]
  for (const [from, to] of targets) {
    await fs.cp(path.join(source, from), path.join(staging, to), { recursive: true })
  }
  await fs.writeFile(path.join(staging, '.content-data', 'source.json'),
    JSON.stringify({ repository: localPath ? 'local' : repository, ref, revision }, null, 2) + '\n')

  const replaced = []
  try {
    for (const [, to] of targets) {
      const dest = path.join(root, to)
      const backup = path.join(staging, `${to}.backup`)
      let existed = true
      try { await fs.rename(dest, backup) } catch (error) {
        if (error.code !== 'ENOENT') throw error
        existed = false
      }
      replaced.push({ dest, backup, existed })
      await fs.rename(path.join(staging, to), dest)
    }
  } catch (error) {
    for (const { dest, backup, existed } of replaced.reverse()) {
      await fs.rm(dest, { recursive: true, force: true })
      if (existed) await fs.rename(backup, dest)
    }
    throw error
  }
  console.log(`内容已同步：${localPath ? '本地工作目录' : revision.slice(0, 12)}。成员、新闻、Wiki 与媒体均已就绪。`)
} catch (error) {
  console.error(`内容同步失败：${error.message}`)
  process.exitCode = 1
} finally {
  if (staging) await fs.rm(staging, { recursive: true, force: true })
  await fs.rm(work, { recursive: true, force: true })
}
