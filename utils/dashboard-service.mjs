import { normalizeDashboardRecords, safeDashboardUrl } from './dashboard-data.mjs'

const FEISHU = 'https://open.feishu.cn/open-apis'
const GITHUB = 'https://api.github.com'
const TASK_TTL = 30_000
const STALE_TTL = 15 * 60_000

function response(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ...extra }
  })
}

async function sameSecret(a, b) {
  const encode = value => new TextEncoder().encode(value)
  const [left, right] = await Promise.all([a, b].map(value => crypto.subtle.digest('SHA-256', encode(value))))
  const x = new Uint8Array(left), y = new Uint8Array(right)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

export function createDashboardService({ fetcher = globalThis.fetch, now = Date.now } = {}) {
  const handlers = new Map()
  return context => {
    const env = context.env || {}
    const keys = ['DASHBOARD_ENABLED', 'DASHBOARD_PUBLIC', 'DASHBOARD_ACCESS_CODE', 'FEISHU_APP_ID', 'FEISHU_APP_SECRET',
      'FEISHU_BITABLE_APP_TOKEN', 'FEISHU_BITABLE_TABLE_ID', 'FEISHU_BITABLE_VIEW_ID', 'FEISHU_FIELD_MAP', 'DASHBOARD_GITHUB_REPOS', 'DASHBOARD_GITHUB_TOKEN']
    const scope = JSON.stringify(keys.map(key => env[key] || ''))
    if (!handlers.has(scope)) {
      if (handlers.size >= 4) handlers.delete(handlers.keys().next().value)
      handlers.set(scope, createScopedService({ fetcher, now }))
    }
    return handlers.get(scope)(context)
  }
}

function createScopedService({ fetcher, now }) {
  // 仅为当前运行实例中的临时缓存；业务记录始终由飞书保存。
  let token, tokenPending, taskCache, taskPending, githubCache, githubPending

  async function json(url, options = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const result = await fetcher(url, { ...options, signal: controller.signal, redirect: 'error' })
      if (!result.ok) throw new Error(result.status === 401 ? 'UPSTREAM_UNAUTHORIZED' : 'UPSTREAM_UNAVAILABLE')
      if (result.status === 204) return []
      return await result.json()
    } finally { clearTimeout(timer) }
  }

  async function tenantToken(env) {
    if (token && token.until > now()) return token.value
    if (!tokenPending) tokenPending = (async () => {
      const result = await json(`${FEISHU}/auth/v3/tenant_access_token/internal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET })
      })
      if (result.code !== 0 || !result.tenant_access_token) throw new Error('FEISHU_AUTH_FAILED')
      token = { value: result.tenant_access_token, until: now() + Math.max(0, (Number(result.expire) || 7200) - 60) * 1000 }
      return token.value
    })().finally(() => { tokenPending = undefined })
    return tokenPending
  }

  async function readTasks(env) {
    const records = [], seenPages = new Set()
    let pageToken = ''
    for (let page = 0; page < 4; page++) {
      const url = new URL(`${FEISHU}/bitable/v1/apps/${encodeURIComponent(env.FEISHU_BITABLE_APP_TOKEN)}/tables/${encodeURIComponent(env.FEISHU_BITABLE_TABLE_ID)}/records`)
      url.searchParams.set('page_size', '500')
      if (pageToken) url.searchParams.set('page_token', pageToken)
      if (env.FEISHU_BITABLE_VIEW_ID) url.searchParams.set('view_id', env.FEISHU_BITABLE_VIEW_ID)
      let result
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          result = await json(url.href, { headers: { Authorization: `Bearer ${await tenantToken(env)}` } })
          if ([99991661, 99991663, 99991668].includes(result.code)) throw new Error('UPSTREAM_UNAUTHORIZED')
          break
        } catch (error) {
          if (attempt || error.message !== 'UPSTREAM_UNAUTHORIZED') throw error
          token = undefined
        }
      }
      if (result.code !== 0 || !Array.isArray(result.data?.items)) throw new Error('FEISHU_READ_FAILED')
      records.push(...result.data.items)
      if (!result.data.has_more) {
        const tasks = normalizeDashboardRecords(records, JSON.parse(env.FEISHU_FIELD_MAP || '{}'))
        if (records.some(record => Object.keys(record.fields || {}).length) && !tasks.length) throw new Error('INVALID_FIELD_MAP')
        return tasks
      }
      pageToken = result.data.page_token
      if (!pageToken || seenPages.has(pageToken)) throw new Error('INVALID_PAGINATION')
      seenPages.add(pageToken)
    }
    throw new Error('TASK_LIMIT_EXCEEDED')
  }

  async function tasks(env) {
    if (taskCache && now() - taskCache.at < TASK_TTL) return { ...taskCache, stale: false }
    if (!taskPending) taskPending = readTasks(env).then(value => {
      taskCache = { value, at: now() }
      return { ...taskCache, stale: false }
    }).catch(error => {
      if (taskCache && now() - taskCache.at <= STALE_TTL) return { ...taskCache, stale: true }
      throw error
    }).finally(() => { taskPending = undefined })
    return taskPending
  }

  async function readGithub(env, repos) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'YSU-Team-Dashboard', 'X-GitHub-Api-Version': '2022-11-28' }
    if (env.DASHBOARD_GITHUB_TOKEN) headers.Authorization = `Bearer ${env.DASHBOARD_GITHUB_TOKEN}`
    const contributors = new Map(), events = []
    await Promise.all(repos.map(async repo => {
      const meta = await json(`${GITHUB}/repos/${repo}`, { headers })
      if (meta.private !== false) throw new Error('PRIVATE_REPOSITORY')
      const [people, recent] = await Promise.all([
        json(`${GITHUB}/repos/${repo}/contributors?per_page=100`, { headers }),
        json(`${GITHUB}/repos/${repo}/events?per_page=20`, { headers })
      ])
      if (!Array.isArray(people) || !Array.isArray(recent)) throw new Error('GITHUB_UNAVAILABLE')
      for (const person of people) {
        if (!/^[a-z\d-]+$/i.test(person.login) || !Number.isFinite(person.contributions)) continue
        const row = contributors.get(person.login) || { name: person.login, count: 0, avatar: safeDashboardUrl(person.avatar_url), href: `https://github.com/${person.login}` }
        row.count += person.contributions
        contributors.set(person.login, row)
      }
      const labels = { PushEvent: '推送了代码', PullRequestEvent: '更新了 Pull Request', IssuesEvent: '更新了 Issue', ReleaseEvent: '发布了版本', CreateEvent: '创建了分支或标签' }
      for (const event of recent) {
        if (!Object.hasOwn(labels, event.type)) continue
        events.push({ id: `${repo}:${event.id}`, repo, actor: event.actor?.login || 'GitHub',
          action: labels[event.type], at: Date.parse(event.created_at) || 0, href: `https://github.com/${repo}` })
      }
    }))
    return { enabled: true, contributors: [...contributors.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8),
      events: events.sort((a, b) => b.at - a.at).slice(0, 20), updatedAt: now(), unavailable: false }
  }

  async function github(env) {
    const repos = [...new Set(String(env.DASHBOARD_GITHUB_REPOS || '').split(',').map(value => value.trim()).filter(Boolean))]
    if (!repos.length) return { enabled: false, contributors: [], events: [], unavailable: false }
    if (repos.length > 5 || repos.some(repo => !/^[a-z\d-]+\/[a-z\d_.-]+$/i.test(repo))) {
      return { enabled: true, contributors: [], events: [], unavailable: true }
    }
    const ttl = env.DASHBOARD_GITHUB_TOKEN ? 10 * 60_000 : 30 * 60_000
    if (githubCache && now() - githubCache.updatedAt < ttl) return githubCache
    if (!githubPending) githubPending = readGithub(env, repos).then(value => {
      githubCache = value
      return value
    }).catch(() => ({ ...(githubCache && now() - githubCache.updatedAt < 24 * 60 * 60_000 ? githubCache : { enabled: true, contributors: [], events: [] }), unavailable: true }))
      .finally(() => { githubPending = undefined })
    return githubPending
  }

  return async function handle({ request, env = {} }) {
    if (request.method !== 'GET') return response({ code: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET' })
    const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_BITABLE_APP_TOKEN', 'FEISHU_BITABLE_TABLE_ID']
    const isPublic = env.DASHBOARD_PUBLIC === 'true'
    if (env.DASHBOARD_ENABLED !== 'true' || required.some(key => !env[key]) || (!isPublic && !/^[\x21-\x7e]{12,128}$/.test(String(env.DASHBOARD_ACCESS_CODE || '')))) {
      return response({ code: 'NOT_CONFIGURED', message: '看板尚未开放，请联系团队负责人。' }, 503)
    }
    if (!isPublic) {
      const authorization = request.headers.get('Authorization') || ''
      const code = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
      if (!code || code.length > 1000 || !await sameSecret(code, env.DASHBOARD_ACCESS_CODE)) {
        return response({ code: 'ACCESS_REQUIRED', message: '请输入正确的访问口令。' }, 401)
      }
    }
    try {
      const [data, development] = await Promise.all([tasks(env), github(env)])
      return response({ tasks: data.value, updatedAt: data.at, stale: data.stale, refreshSeconds: 30, github: development })
    } catch (error) {
      const reasons = ['INVALID_FIELD_MAP', 'INVALID_TASK_STATUS', 'INVALID_TASK_DATE', 'INVALID_TASK_ID', 'TASK_LIMIT_EXCEEDED', 'INVALID_PAGINATION', 'FEISHU_AUTH_FAILED', 'FEISHU_READ_FAILED']
      const reason = reasons.includes(error.message) ? error.message : 'UPSTREAM_UNAVAILABLE'
      return response({ code: 'DATA_UNAVAILABLE', reason, message: '暂时无法更新任务，请稍后重试。' }, 502)
    }
  }
}
