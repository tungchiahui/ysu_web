export const DASHBOARD_FIELD_NAMES = {
  title: ['任务名称'], group: ['所属组别', '组别'], assignees: ['执行人'], publisher: ['发布人'],
  deadline: ['截止时间', '最晚截止日期'], priority: ['优先级'], status: ['完成状态', '完成情况'],
  completedAt: ['完成时间'], note: ['备注']
}

function text(value) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : item?.text || '').join('').trim()
  return ''
}

export function safeDashboardUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

function people(value) {
  const rows = Array.isArray(value) ? value : value ? [value] : []
  const seen = new Set()
  return rows.flatMap(item => {
    const name = typeof item === 'string' ? item.trim() : text(item?.name)
    const key = typeof item?.id === 'string' ? item.id : name
    if (!name || seen.has(key)) return []
    seen.add(key)
    return [{ key, name, avatar: safeDashboardUrl(item?.avatar_url) }]
  })
}

function timestamp(value) {
  if (value === undefined || value === null || value === '') return null
  const number = typeof value === 'number' || /^\d+$/.test(String(value)) ? Number(value) : Date.parse(value)
  if (!Number.isFinite(number) || number < 946684800000 || number > 4102444800000) throw new Error('INVALID_TASK_DATE')
  return number
}

// 根据可用区域计算容量，尺寸与卡片样式的最小可读尺寸保持一致。
export function dashboardGridLayout(width, height, gap = 10, fontSize = 16) {
  const scale = Math.max(1, fontSize / 16)
  const columns = Math.max(1, Math.floor((Math.max(0, width) + gap) / (360 * scale + gap)))
  const rows = Math.max(1, Math.floor((Math.max(0, height) + gap) / (260 * scale + gap)))
  return { columns, rows, size: columns * rows }
}

export function dashboardMemberPath(name, profileNames = []) {
  return profileNames.includes(name) ? `/team/${encodeURIComponent(name)}` : ''
}

export function dashboardTaskGroups(task) {
  return Array.isArray(task.groups) ? task.groups : task.group ? [task.group] : []
}

export function normalizeDashboardRecords(records, overrides = {}) {
  const names = { ...DASHBOARD_FIELD_NAMES }
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(names, key) || typeof value !== 'string' || !value.trim()) throw new Error('INVALID_FIELD_MAP')
    names[key] = [value.trim()]
  }
  return records.flatMap(record => {
    const fields = record.fields || {}
    const field = key => names[key].map(name => fields[name]).find(value => value !== undefined && value !== null && value !== '')
    const title = text(field('title'))
    if (!title) return []
    if (typeof record.record_id !== 'string' || !record.record_id) throw new Error('INVALID_TASK_ID')
    const status = text(field('status'))
    if (!['未完成', '已完成'].includes(status)) throw new Error('INVALID_TASK_STATUS')
    const priority = text(field('priority'))
    const groupValue = field('group')
    const groups = [...new Set((Array.isArray(groupValue) ? groupValue : [groupValue])
      .map(value => text(value).slice(0, 100)).filter(Boolean))]
    return [{
      id: String(record.record_id), title: title.slice(0, 500), group: groups.join('、'), groups,
      assignees: people(field('assignees')), publishers: people(field('publisher')), publisher: people(field('publisher')).map(person => person.name).join('、'),
      deadline: timestamp(field('deadline')), completedAt: timestamp(field('completedAt')),
      priority: /^(高|紧急|P0)(?:$|[-－：:])/i.test(priority) ? 'high' : /^(低|P2)(?:$|[-－：:])/i.test(priority) ? 'low' : 'medium',
      status: status === '已完成' ? 'done' : 'todo', note: text(field('note')).slice(0, 3000)
    }]
  })
}

export function dashboardTaskState(task, now = Date.now()) {
  return task.status === 'done' ? 'done' : task.deadline !== null && task.deadline <= now ? 'overdue' : 'todo'
}

export function selectDashboardTasks(tasks, { status = 'todo', group = 'all', search = '', now = Date.now() } = {}) {
  const keyword = search.trim().toLowerCase()
  return tasks.filter(task => (status === 'all' || dashboardTaskState(task, now) === status)
    && (group === 'all' || dashboardTaskGroups(task).includes(group))
    && (!keyword || [task.title, task.group, task.publisher, task.note, ...task.assignees.map(person => person.name)].join(' ').toLowerCase().includes(keyword)))
    .sort((a, b) => status === 'done' ? (b.completedAt || 0) - (a.completedAt || 0)
      : (a.deadline ?? Infinity) - (b.deadline ?? Infinity) || ['high', 'medium', 'low'].indexOf(a.priority) - ['high', 'medium', 'low'].indexOf(b.priority))
}

export function dashboardRanks(tasks, status) {
  const totals = new Map()
  for (const task of tasks) {
    if (task.status !== status) continue
    for (const person of task.assignees) {
      const entry = totals.get(person.key) || { ...person, count: 0 }
      entry.count++
      totals.set(person.key, entry)
    }
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')).slice(0, 8)
}
