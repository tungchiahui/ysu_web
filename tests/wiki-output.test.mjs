import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkWikiOutput, validateWikiOutput } from '../scripts/wiki-output-check.mjs'

test('使用指定产物目录检查，保留 EO 缺失或空白页面的失败检查', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ysu-wiki-output-'))
  const route = 'wiki/2026-10-19-test'
  const html = '<header class="wiki-article-header"><h1>Test</h1></header>'
  const localDir = path.join(root, '.output/public')
  const eoDir = path.join(root, '.edgeone/assets')
  try {
    await fs.mkdir(path.join(root, 'content/wiki/2026-10-19-test'), { recursive: true })
    await fs.writeFile(path.join(root, 'content/wiki/2026-10-19-test/index.md'), '---\ntitle: Test\n---\n')
    await fs.mkdir(path.join(eoDir, route), { recursive: true })
    const eoPage = path.join(eoDir, route, 'index.html')
    await fs.writeFile(eoPage, html)
    // EO 目录正常时，本地默认目录不存在也应通过。
    assert.deepEqual(await checkWikiOutput(root, eoDir), { count: 1, errors: [] })
    await validateWikiOutput(eoDir, root)
    // 即使留有可用的本地旧产物，也不能掩盖 EO 本次输出的问题。
    await fs.mkdir(path.join(localDir, route), { recursive: true })
    await fs.writeFile(path.join(localDir, route, 'index.html'), html)
    assert.deepEqual(await checkWikiOutput(root, localDir), { count: 1, errors: [] })
    await fs.writeFile(eoPage, ' ')
    await assert.rejects(validateWikiOutput(eoDir, root), /页面为空或缺少文章标题区域/)
    await fs.writeFile(eoPage, '<html><body>empty shell</body></html>')
    await assert.rejects(validateWikiOutput(eoDir, root), /页面为空或缺少文章标题区域/)
    await fs.unlink(eoPage)
    await assert.rejects(validateWikiOutput(eoDir, root), /ENOENT/)
    assert.deepEqual(await checkWikiOutput(root, localDir), { count: 1, errors: [] })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
