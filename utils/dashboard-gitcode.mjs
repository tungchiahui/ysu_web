import { safeDashboardUrl } from './dashboard-data.mjs'

const API = 'https://api.gitcode.com/api/v5'
const MAX_AGE = 24 * 60 * 60_000
const cleanName = (value, fallback) => typeof value === 'string' && value.trim() && !value.includes('@') ? value.trim().slice(0, 100) : fallback
const empty = () => ({ enabled: false, unavailable: false, contributors: [], events: [], sources: [] })

function repository(value) {
  if (typeof value !== 'string' || value.length > 300 || !/^https:\/\//.test(value)) throw new Error('INVALID_GITCODE_REPOS')
  const url = new URL(value)
  if (url.hostname !== 'gitcode.com' || url.username || url.password || url.port || url.search || url.hash) throw new Error('INVALID_GITCODE_REPOS')
  const repo = url.pathname.replace(/\/$/, '').replace(/\.git$/, '').slice(1)
  if (!/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(repo) || repo.split('/').some(part => part === '.' || part === '..')) throw new Error('INVALID_GITCODE_REPOS')
  return { key: repo.toLowerCase(), repo, href: `https://gitcode.com/${repo}` }
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

export function createDashboardGitcode({ json, now = Date.now }) {
  const cache = new Map(), pending = new Map()
  async function cached(key, ttl, read) {
    const entry = cache.get(key)
    if (entry && now() < entry.next) return entry.at !== undefined && now() - entry.at > MAX_AGE ? { ...entry, value: null, at: undefined } : entry
    if (!pending.has(key)) pending.set(key, Promise.resolve().then(read).then(value => {
      const fresh = { value, at: now(), next: now() + ttl, unavailable: false }
      cache.set(key, fresh)
      return fresh
    }).catch(() => {
      const stale = entry && now() - entry.at <= MAX_AGE
      const failed = { value: stale ? entry.value : null, at: stale ? entry.at : undefined, next: now() + 60_000, unavailable: true }
      cache.set(key, failed)
      return failed
    }).finally(() => pending.delete(key)))
    return pending.get(key)
  }

  return async env => {
    let repos, mappings
    try {
      repos = dashboardGitcodeRepositories(env)
      if (!repos.length) return empty()
      mappings = peopleMap(env.DASHBOARD_GITCODE_PEOPLE)
    }
    catch { return { ...empty(), enabled: true, unavailable: true, configurationError: true } }
    const results = await Promise.all(repos.map(async source => {
      const { repo, key } = source
      const token = env.DASHBOARD_GITCODE_TOKEN
      const headers = { 'User-Agent': 'YSU-Team-Dashboard', Accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const ttl = token ? 10 * 60_000 : 30 * 60_000
      const base = `${API}/repos/${repo}`
      const [people, events] = await Promise.all([
        cached(`${key}:people`, ttl, async () => {
          const value = await json(`${base}/contributors?type=authors`, { headers })
          if (!Array.isArray(value) || value.some(person => !person || !Number.isSafeInteger(person.contributions) || person.contributions < 0)) throw new Error('INVALID_CONTRIBUTORS')
          return value.map(person => ({ ...identity(person, mappings, key), count: person.contributions }))
        }),
        cached(`${key}:events`, ttl, async () => {
          const value = await json(`${base}/events?per_page=20`, { headers })
          const events = value?.events
          if (!Array.isArray(events)) throw new Error('INVALID_CODE_EVENTS')
          return events.slice(0, 20).flatMap((event, index) => {
            if (!event || event.filter_sensitive) return []
            const action = gitcodeActions[String(event.action_name || '').toLowerCase()]
            const at = Date.parse(event.created_at)
            if (!action || !Number.isFinite(at) || at > now() + 60_000) return []
            const person = { ...event.author, login: event.author?.username || event.author_username }
            const actor = person.login || person.name || person.email ? identity(person, mappings) : { name: 'GitCode' }
            const eventId = /^[a-z\d_-]+$/i.test(String(event.id || '')) ? event.id : `${at}:${index}`
            return [{ id: `${key}:${eventId}`, repo, actor: actor.name, action, at, href: source.href }]
          })
        })
      ])
      return { source, people, events }
    }))
    const people = new Map(), events = [], sources = []
    for (const { source, people: rows, events: recent } of results) {
      const unavailable = !rows || !recent || rows.unavailable || recent.unavailable
      const stamps = [rows?.at, recent?.at].filter(Number.isFinite)
      sources.push({ key: source.key, repo: source.repo, href: source.href, unavailable,
        contributionsUnavailable: !rows || rows.unavailable, eventsUnavailable: !recent || recent.unavailable,
        updatedAt: stamps.length ? Math.min(...stamps) : undefined })
      for (const person of rows?.value || []) {
        const existing = people.get(person.identity)
        if (existing) {
          existing.count += person.count
          if (!existing.avatar) existing.avatar = person.avatar
          if (!existing.href) existing.href = person.href
        }
        else people.set(person.identity, { ...person })
      }
      events.push(...recent?.value || [])
    }
    const stamps = sources.map(source => source.updatedAt).filter(Number.isFinite)
    return {
      enabled: true, unavailable: sources.some(source => source.unavailable), sources,
      updatedAt: stamps.length ? Math.min(...stamps) : undefined,
      contributors: [...people.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8)
        .map(({ identity: _identity, ...person }, index) => ({ ...person, key: `gitcode-person-${index + 1}` })),
      events: events.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, 20)
    }
  }
}
