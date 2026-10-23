import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dashboardFixtures } from '../tests/fixtures/dashboard.mjs'

export async function startDashboardPreview({ port = 8790, root, fixture = dashboardFixtures() } = {}) {
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const publicRoot = root || await (async () => {
    for (const dir of ['.output/public', '.edgeone/assets']) {
      const resolved = path.join(project, dir)
      if (await fs.stat(path.join(resolved, 'dashboard/index.html')).then(() => true, () => false)) return resolved
    }
    throw new Error('请先执行 npm run generate，再启动本地演示。')
  })()
  // 示例只由这个本地服务器提供，不写入 public、不进入生产接口。
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname === '/api/dashboard') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ ...fixture.data, updatedAt: Date.now() }))
        return
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      let file = path.resolve(publicRoot, relative)
      if (!file.startsWith(path.resolve(publicRoot) + path.sep) && file !== path.resolve(publicRoot)) throw new Error('NOT_FOUND')
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html')
      const body = await fs.readFile(file)
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
      res.end(body)
    } catch { res.writeHead(404); res.end('Not Found') }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startDashboardPreview()
  console.log(`本地模拟看板：http://127.0.0.1:${server.address().port}/dashboard/`)
}
