import { safeDashboardUrl } from './dashboard-data.mjs'

const API = 'https://api.gitcode.com/api/v5'
const MAX_AGE = 24 * 60 * 60_000
const cleanName = (value, fallback) => typeof value === 'string' && value.trim() && !value.includes('@') ? value.trim().slice(0, 100) : fallback
const empty = () => ({ enabled: false, unavailable: false, contributors: [], events: [], sources: [] })
const diagnosticCodes = new Set(['SYNC_BUDGET_EXCEEDED', 'INVALID_ORGANIZATION_REPOS', 'INVALID_ORGANIZATION_REPO',
  'INVALID_ORGANIZATION_NAMESPACE', 'INVALID_ORGANIZATION_PAGINATION', 'ORGANIZATION_REPO_LIMIT',
  'INVALID_CONTRIBUTORS', 'INVALID_CODE_EVENTS', 'INVALID_CODE_PERSON', 'CONFLICTING_CODE_PERSON',
  'ABORT_LISTENERS_UNSUPPORTED', 'ABORT_SIGNAL_UNSUPPORTED', 'INVALID_TOKEN_FORMAT', 'UPSTREAM_FETCH_FAILED',
  'UPSTREAM_BODY_FAILED', 'INVALID_REQUEST_HEADERS', 'UPSTREAM_REDIRECT', 'INVALID_GITCODE_REPOS',
  'OPAQUE_REDIRECT', 'OPAQUE_RESPONSE', 'INVALID_HTTP_RESPONSE'])
function diagnostic(error) {
  if (error?.message === 'UPSTREAM_UNAUTHORIZED') return 'HTTP_401'
  if (/^UPSTREAM_HTTP_[1-5]\d\d$/.test(error?.message || '')) return error.message.replace('UPSTREAM_', '')
  if (Number.isInteger(error?.status) && error.status >= 300 && error.status <= 599) return `HTTP_${error.status}`
  if (error?.name === 'SyntaxError') return 'INVALID_JSON_RESPONSE'
  if (error?.name === 'TypeError') return 'TYPE_ERROR'
  return diagnosticCodes.has(error?.message) ? error.message : 'READ_FAILED'
}

function repositoryPath(repo) {
  if (typeof repo !== 'string' || repo.length > 300 || !/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(repo) || repo.split('/').some(part => part === '.' || part === '..')) throw new Error('INVALID_GITCODE_REPOS')
  return { key: repo.toLowerCase(), repo, href: `https://gitcode.com/${repo}` }
}

function repository(value) {
  if (typeof value !== 'string' || value.length > 300 || !/^https:\/\//.test(value)) throw new Error('INVALID_GITCODE_REPOS')
  const url = new URL(value)
  if (url.hostname !== 'gitcode.com' || url.username || url.password || url.port || url.search || url.hash) throw new Error('INVALID_GITCODE_REPOS')
  const repo = url.pathname.replace(/\/$/, '').replace(/\.git$/, '').slice(1)
  return repositoryPath(repo)
}

export function dashboardGitcodeRepositories(env) {
  const raw = String(env.DASHBOARD_GITCODE_REPOS || '')
  if (raw.length > 4000) throw new Error('INVALID_GITCODE_REPOS')
  const rows = raw.split(',').map(value => value.trim()).filter(Boolean)
  const repos = new Map()
  for (const value of rows) {
    const row = repository(value.startsWith('https://') ? value : `https://gitcode.com/${value}`)
    repos.set(row.key, row)
  }
  if (repos.size > 5) throw new Error('INVALID_GITCODE_REPOS')
  return [...repos.values()]
}

export function dashboardGitcodeOrganization(env) {
  const raw = String(env.DASHBOARD_GITCODE_ORG || '').trim()
  if (!raw) return ''
  let name = raw
  if (raw.startsWith('https://')) {
    const url = new URL(raw)
    if (url.hostname !== 'gitcode.com' || url.username || url.password || url.port || url.search || url.hash) throw new Error('INVALID_GITCODE_ORG')
    name = url.pathname.replace(/\/$/, '').slice(1)
  }
  if (!/^[a-z\d_.-]{1,100}$/i.test(name) || ['.', '..'].includes(name)) throw new Error('INVALID_GITCODE_ORG')
  return name
}

function exclusions(env, org) {
  const raw = String(env.DASHBOARD_GITCODE_EXCLUDE_REPOS || '')
  if (raw.length > 16000) throw new Error('INVALID_GITCODE_EXCLUSIONS')
  return new Set(raw.split(',').map(value => value.trim()).filter(Boolean).map(value => {
    const source = repository(value.startsWith('https://') ? value : `https://gitcode.com/${value}`)
    if (org && source.repo.split('/')[0].toLowerCase() !== org.toLowerCase()) throw new Error('INVALID_GITCODE_EXCLUSIONS')
    return source.key
  }))
}

function peopleMap(raw) {
  const result = new Map()
  if (!raw) return result
  if (typeof raw !== 'string' || raw.length > 16000) throw new Error('INVALID_GITCODE_PEOPLE')
  const rows = JSON.parse(raw)
  if (!Array.isArray(rows) || rows.length > 100) throw new Error('INVALID_GITCODE_PEOPLE')
  for (const person of rows) {
    if (!person || typeof person.name !== 'string' || !person.name.trim() || person.name.length > 100 || person.name.includes('@') || !Array.isArray(person.accounts) || !person.accounts.length || person.accounts.length > 20 || Object.keys(person).some(key => !['name', 'accounts'].includes(key))) throw new Error('INVALID_GITCODE_PEOPLE')
    for (const account of person.accounts) {
      if (typeof account !== 'string' || account.length > 300 || !/^(login|author|email):[^\s].*$/u.test(account)) throw new Error('INVALID_GITCODE_PEOPLE')
      const key = account.replace(/^login:(.*)$/, (_, name) => `login:${name.toLowerCase()}`).replace(/^email:(.*)$/, (_, email) => `email:${email.toLowerCase()}`)
      if (result.has(key) && result.get(key) !== person.name.trim()) throw new Error('INVALID_GITCODE_PEOPLE')
      result.set(key, person.name.trim())
    }
  }
  return result
}

function identity(person, mappings, scope = '') {
  const login = typeof person.login === 'string' && /^[a-z\d_.-]+(?:\[bot\])?$/i.test(person.login) ? person.login : ''
  const author = typeof person.name === 'string' ? person.name.trim() : ''
  const email = typeof person.email === 'string' ? person.email.trim().toLowerCase() : ''
  if (!login && !author && !email) throw new Error('INVALID_CODE_PERSON')
  const keys = [login && `login:${login.toLowerCase()}`, email && `email:${email}`, author && `author:${author}`].filter(Boolean)
  const names = [...new Set(keys.map(key => mappings.get(key)).filter(Boolean))]
  if (names.length > 1) throw new Error('CONFLICTING_CODE_PERSON')
  const memberName = names[0] || ''
  return {
    identity: memberName ? `member:${memberName}` : email ? `email:${email}` : login ? `login:${login.toLowerCase()}` : `${scope}:author:${author}`,
    memberName, name: memberName || cleanName(author, login || '未匹配作者'),
    avatar: safeDashboardUrl(person.avatar_url), href: login ? `https://gitcode.com/${login}` : ''
  }
}

const gitcodeActions = { push: '推送了代码', pushed: '推送了代码', 'pushed to': '推送了代码', 'pushed new': '推送了代码', merged: '合并了代码', accepted: '合并了代码', opened: '创建了事项', closed: '关闭了事项', reopened: '重新打开了事项', commented: '发表了评论', created: '创建了仓库内容', released: '发布了版本' }

// 一次响应最多等待8秒、同时最多4个GitCode请求；下一次轮询从未轮到的任务继续。
export function createDashboardGitcode({ json, now = Date.now, budgetMs = 8000, concurrency = 4 } = {}) {
  const scopes = new Map()
  return async env => {
    let org, configured, excluded, mappings
    try {
      org = dashboardGitcodeOrganization(env)
      configured = org ? [] : dashboardGitcodeRepositories(env)
      excluded = exclusions(env, org)
      if (!org && !configured.length) return empty()
      mappings = peopleMap(env.DASHBOARD_GITCODE_PEOPLE)
    } catch { return { ...empty(), enabled: true, unavailable: true, configurationError: true } }
    const scope = JSON.stringify([org.toLowerCase(), configured.map(row => row.key), [...excluded].sort(), env.DASHBOARD_GITCODE_TOKEN || '', env.DASHBOARD_GITCODE_PEOPLE || ''])
    if (!scopes.has(scope)) {
      if (scopes.size >= 4) scopes.delete(scopes.keys().next().value)
      scopes.set(scope, { cache: new Map(), pending: new Map(), cursor: 0 })
    }
    const state = scopes.get(scope)
    if (!state.readPending) state.readPending = read(env, org, configured, excluded, mappings, state).finally(() => { state.readPending = undefined })
    return state.readPending
  }

  async function read(env, org, configured, excluded, mappings, state) {
    const { cache, pending } = state
    const headers = { 'User-Agent': 'YSU-Team-Dashboard', Accept: 'application/json' }
    if (env.DASHBOARD_GITCODE_TOKEN) headers.Authorization = `Bearer ${env.DASHBOARD_GITCODE_TOKEN}`
    const ttl = env.DASHBOARD_GITCODE_TOKEN ? 10 * 60_000 : 30 * 60_000
    const controller = new AbortController()
    let rejectBudget
    const interrupted = new Promise((_, reject) => { rejectBudget = reject })
    const timer = setTimeout(() => {
      rejectBudget(new Error('SYNC_BUDGET_EXCEEDED'))
      controller.abort()
    }, budgetMs)
    const snapshot = entry => entry && entry.at !== undefined && now() - entry.at > MAX_AGE ? { ...entry, value: null, at: undefined } : entry
    async function request(url) {
      const signal = controller.signal
      if (env.DASHBOARD_GITCODE_TOKEN && !/^[\x21-\x7e]{1,4096}$/.test(env.DASHBOARD_GITCODE_TOKEN)) throw new Error('INVALID_TOKEN_FORMAT')
      if (!signal) throw new Error('ABORT_SIGNAL_UNSUPPORTED')
      if (signal.aborted) throw new Error('SYNC_BUDGET_EXCEEDED')
      return Promise.race([json(url, { headers, signal, redirect: 'manual' }), interrupted])
    }
    async function cached(key, load) {
      const entry = cache.get(key)
      if (entry && now() < entry.next) return snapshot(entry)
      let stage = 'REQUEST'
      if (!pending.has(key)) pending.set(key, Promise.resolve().then(() => load(value => { stage = value })).then(value => {
        const fresh = { value, at: now(), next: now() + ttl, unavailable: false }
        cache.set(key, fresh)
        return fresh
      }).catch(error => {
        const stale = entry && entry.at !== undefined && now() - entry.at <= MAX_AGE
        const failed = { value: stale ? entry.value : null, at: stale ? entry.at : undefined, next: now() + 60_000, unavailable: true, reason: diagnostic(error), failureStage: stage }
        cache.set(key, failed)
        return failed
      }).finally(() => pending.delete(key)))
      return pending.get(key)
    }

    try {
      let repos = configured, discovery
      if (org) {
        discovery = await cached('organization', async markStage => {
          const found = new Map(), seenPages = new Set(), ids = new Map()
          // 上限仅防止上游无限分页；超过时明确失败，不使用前10000项伪装完整列表。
          for (let page = 1; page <= 100; page++) {
            markStage('REQUEST')
            const value = await request(`${API}/orgs/${encodeURIComponent(org)}/repos?type=all&repo_type=code&per_page=100&page=${page}`)
            markStage('PARSE')
            if (!Array.isArray(value) || value.length > 100) throw new Error('INVALID_ORGANIZATION_REPOS')
            const pageKeys = []
            for (const row of value) {
              if (!row || (row.repo_type !== undefined && row.repo_type !== 'code')) throw new Error('INVALID_ORGANIZATION_REPO')
              // API 结构化路径用于定位项目，不将展示名称当地址，也无需再次解析完整URL。
              const structured = row.path !== undefined || row.namespace?.path !== undefined
              if (structured && (typeof row.path !== 'string' || typeof row.namespace?.path !== 'string')) throw new Error('INVALID_ORGANIZATION_REPO')
              const source = repositoryPath(structured ? `${row.namespace.path}/${row.path}` : row.full_name)
              if (source.repo.split('/')[0].toLowerCase() !== org.toLowerCase()) throw new Error('INVALID_ORGANIZATION_NAMESPACE')
              if (row.fork !== undefined && typeof row.fork !== 'boolean') throw new Error('INVALID_ORGANIZATION_REPO')
              pageKeys.push(source.key)
              if (row.id !== undefined) {
                if (!Number.isSafeInteger(row.id) || row.id < 0) throw new Error('INVALID_ORGANIZATION_REPO')
                const previous = ids.get(row.id)
                if (previous) found.delete(previous)
                ids.set(row.id, source.key)
              }
              found.set(source.key, { ...source, fork: Boolean(row.fork) })
            }
            if (value.length < 100) return [...found.values()].sort((a, b) => a.key.localeCompare(b.key))
            const signature = JSON.stringify(pageKeys.sort())
            if (seenPages.has(signature)) throw new Error('INVALID_ORGANIZATION_PAGINATION')
            seenPages.add(signature)
          }
          throw new Error('ORGANIZATION_REPO_LIMIT')
        })
        repos = discovery.value || []
      }
      const discoveredCount = repos.length
      repos = repos.filter(source => !excluded.has(source.key))
      const organization = org ? {
        name: org, href: `https://gitcode.com/${org}`, unavailable: discovery.unavailable,
        authenticated: Boolean(env.DASHBOARD_GITCODE_TOKEN), reason: discovery.reason, failureStage: discovery.failureStage,
        updatedAt: discovery.at, discoveredCount: discovery.value ? discoveredCount : undefined,
        includedCount: discovery.value ? repos.length : undefined, excludedCount: discovery.value ? discoveredCount - repos.length : undefined
      } : undefined
      const liveKeys = new Set(repos.flatMap(source => [`${source.key}:people`, `${source.key}:events`]))
      for (const key of cache.keys()) if (key !== 'organization' && !liveKeys.has(key)) cache.delete(key)
      const jobs = repos.flatMap(source => ['people', 'events'].map(kind => ({ source, kind })))
      let taken = 0
      const start = state.cursor % Math.max(1, jobs.length)
      async function worker() {
        while (taken < jobs.length && !controller.signal.aborted) {
          const index = (start + taken++) % jobs.length
          state.cursor = (index + 1) % jobs.length
          const { source, kind } = jobs[index]
          const base = `${API}/repos/${source.repo}`
          await cached(`${source.key}:${kind}`, async markStage => {
            if (kind === 'people') {
              const value = await request(`${base}/contributors?type=authors`)
              markStage('PARSE')
              if (!Array.isArray(value) || value.some(person => !person || !Number.isSafeInteger(person.contributions) || person.contributions < 0)) throw new Error('INVALID_CONTRIBUTORS')
              return value.map(person => ({ ...identity(person, mappings, source.key), count: person.contributions }))
            }
            const value = await request(`${base}/events?per_page=20`)
            markStage('PARSE')
            if (!Array.isArray(value?.events)) throw new Error('INVALID_CODE_EVENTS')
            return value.events.slice(0, 20).flatMap((event, index) => {
              if (!event || event.filter_sensitive) return []
              const action = gitcodeActions[String(event.action_name || '').toLowerCase()]
              const at = Date.parse(event.created_at)
              if (!action || !Number.isFinite(at) || at > now() + 60_000) return []
              const person = { ...event.author, login: event.author?.username || event.author_username }
              const actor = person.login || person.name || person.email ? identity(person, mappings) : { name: 'GitCode' }
              const eventId = /^[a-z\d_-]+$/i.test(String(event.id || '')) ? event.id : `${at}:${index}`
              return [{ id: `${source.key}:${eventId}`, repo: source.repo, actor: actor.name, action, at, href: source.href }]
            })
          })
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
      const people = new Map(), events = [], sources = []
      for (const source of repos) {
        const rows = snapshot(cache.get(`${source.key}:people`)), recent = snapshot(cache.get(`${source.key}:events`))
        const stamps = [rows?.at, recent?.at].filter(Number.isFinite)
        sources.push({ key: source.key, repo: source.repo, href: source.href, fork: source.fork,
          pending: !rows || !recent || rows.next <= now() || recent.next <= now(), unavailable: Boolean(rows?.unavailable || recent?.unavailable),
          contributionsUnavailable: !rows || rows.unavailable, eventsUnavailable: !recent || recent.unavailable,
          contributionsReason: rows?.reason, eventsReason: recent?.reason,
          contributionsFailureStage: rows?.failureStage, eventsFailureStage: recent?.failureStage,
          updatedAt: stamps.length ? Math.min(...stamps) : undefined })
        for (const person of rows?.value || []) {
          const existing = people.get(person.identity)
          if (existing) {
            existing.count += person.count
            if (!existing.avatar) existing.avatar = person.avatar
            if (!existing.href) existing.href = person.href
          } else people.set(person.identity, { ...person })
        }
        events.push(...recent?.value || [])
      }
      const stamps = sources.map(source => source.updatedAt).filter(Number.isFinite)
      return {
        enabled: true, unavailable: Boolean(discovery?.unavailable || sources.some(source => source.unavailable)),
        syncing: sources.some(source => source.pending), organization, sources,
        updatedAt: stamps.length ? Math.min(...stamps) : undefined,
        contributors: [...people.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8)
          .map(({ identity: _identity, ...person }, index) => ({ ...person, key: `gitcode-person-${index + 1}` })),
        events: events.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, 20)
      }
    } finally { clearTimeout(timer) }
  }
}
