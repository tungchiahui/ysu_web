<script setup lang="ts">
import { site } from '~/data/site'
import { dashboardTaskState, selectDashboardTasks, dashboardRanks, type DashboardData, type DashboardTask } from '~/utils/dashboard'

useHead({ title: `任务看板 | ${site.shortName}`, meta: [{ name: 'robots', content: 'noindex, nofollow' }], bodyAttrs: { class: 'dashboard-tech' } })
const route = useRoute()
const screen = ref(false)
const data = shallowRef<DashboardData | null>(null)
const phase = ref('loading')
const message = ref('')
const loading = ref(false)
const accessCode = ref('')
const selectedStatus = ref('todo')
const selectedGroup = ref('all')
const search = ref('')
const currentTime = ref(0)
const pageIndex = ref(0)
const autoRotate = ref(true)
const screenPageSize = ref(6)
let authorization = ''
let request: AbortController | undefined
let pollTimer: ReturnType<typeof setTimeout> | undefined
let clockTimer: ReturnType<typeof setInterval> | undefined
let lastRotation = 0
let disposed = false
let generation = 0

const tasks = computed(() => data.value?.tasks || [])
const groups = computed(() => [...new Set(tasks.value.map(task => task.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')))
const scopedTasks = computed<DashboardTask[]>(() => selectDashboardTasks(tasks.value, { status: 'all', group: selectedGroup.value, search: search.value, now: currentTime.value }))
const counts = computed(() => ({
  todo: scopedTasks.value.filter(task => dashboardTaskState(task, currentTime.value) === 'todo').length,
  overdue: scopedTasks.value.filter(task => dashboardTaskState(task, currentTime.value) === 'overdue').length,
  done: scopedTasks.value.filter(task => task.status === 'done').length
}))
const statuses = computed(() => [
  { value: 'todo', label: '未完成', count: counts.value.todo },
  { value: 'overdue', label: '已逾期', count: counts.value.overdue },
  { value: 'done', label: '已完成', count: counts.value.done }
])
const visibleTasks = computed<DashboardTask[]>(() => selectDashboardTasks(tasks.value, {
  status: selectedStatus.value, group: selectedGroup.value, search: search.value, now: currentTime.value
}))
const pageSize = computed(() => screen.value ? screenPageSize.value : 6)
const pages = computed(() => Math.max(1, Math.ceil(visibleTasks.value.length / pageSize.value)))
const pageTasks = computed(() => visibleTasks.value.slice(pageIndex.value * pageSize.value, (pageIndex.value + 1) * pageSize.value))
const rankedTasks = computed(() => tasks.value.filter(task => selectedGroup.value === 'all' || task.group === selectedGroup.value))
const todoRanks = computed(() => dashboardRanks(rankedTasks.value, 'todo'))
const doneRanks = computed(() => dashboardRanks(rankedTasks.value, 'done'))
const nextDeadline = computed(() => scopedTasks.value.filter(task => task.status !== 'done' && task.deadline !== null && task.deadline > currentTime.value)
  .sort((a, b) => a.deadline! - b.deadline!)[0])
const countdown = computed(() => {
  if (!nextDeadline.value?.deadline) return '暂无待到期任务'
  const seconds = Math.max(0, Math.floor((nextDeadline.value.deadline - currentTime.value) / 1000))
  return `${Math.floor(seconds / 86400)} 天 ${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})
const githubEvents = computed(() => {
  const events = data.value?.github.events || []
  const size = screen.value ? 2 : 5
  const start = Math.floor(currentTime.value / 20_000) % Math.max(1, Math.ceil(events.length / size)) * size
  return events.slice(start, start + size)
})
const updateInterrupted = computed(() => Boolean(data.value && (data.value.stale || message.value || currentTime.value - data.value.updatedAt > 90_000)))
const priorityLabels = { high: '高优先级', medium: '中优先级', low: '低优先级' }
const formatTime = (value?: number | null) => value ? new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
}).format(value) : '未设置'
const clock = computed(() => currentTime.value ? new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
}).format(currentTime.value) : '')

watch([selectedStatus, selectedGroup, search, pageSize], () => { pageIndex.value = 0; lastRotation = currentTime.value })
watch(pages, value => { pageIndex.value = Math.min(pageIndex.value, value - 1) })
// 静态页首次水合会暂时恢复预渲染地址；路由就绪后同步最终的查询参数。
watch(() => route.query.screen, value => {
  screen.value = value === '1'
  if (import.meta.client) document.body.classList.toggle('dashboard-screen', screen.value)
}, { flush: 'post' })

function scheduleRefresh() {
  clearTimeout(pollTimer)
  if (disposed || ['locked', 'closed'].includes(phase.value)) return
  pollTimer = setTimeout(() => { if (!document.hidden) void refresh(); else scheduleRefresh() }, 30_000)
}

async function refresh() {
  if (loading.value || disposed) return
  const ticket = ++generation
  loading.value = true
  const controller = new AbortController()
  request = controller
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const result = await fetch('/api/dashboard', { signal: controller.signal, cache: 'no-store', headers: authorization ? { Authorization: `Bearer ${authorization}` } : {} })
    const body = result.headers.get('Content-Type')?.includes('application/json') ? await result.json() : null
    if (ticket !== generation || disposed) return
    if (result.status === 401) {
      data.value = null
      phase.value = 'locked'
      message.value = authorization ? '口令不正确，请重新输入。' : ''
      authorization = ''
      return
    }
    if (result.status === 404 || body?.code === 'NOT_CONFIGURED') {
      data.value = null
      phase.value = 'closed'
      message.value = '看板尚未开放，请联系团队负责人。'
      return
    }
    if (!result.ok || !Array.isArray(body?.tasks) || !body?.github) throw new Error('DATA_UNAVAILABLE')
    data.value = body
    if (selectedGroup.value !== 'all' && !groups.value.includes(selectedGroup.value)) selectedGroup.value = 'all'
    phase.value = 'ready'
    message.value = ''
  } catch {
    if (!disposed && ticket === generation) {
      phase.value = data.value ? 'ready' : 'error'
      message.value = data.value ? '更新暂时中断，正在显示上次结果。' : '暂时无法获取任务，请稍后重试。'
    }
  } finally {
    clearTimeout(timeout)
    if (ticket === generation) {
      loading.value = false
      scheduleRefresh()
    }
  }
}

function unlock() {
  authorization = accessCode.value.trim()
  accessCode.value = ''
  void refresh()
}

function lock() {
  generation++
  request?.abort()
  loading.value = false
  authorization = ''
  data.value = null
  message.value = ''
  phase.value = 'locked'
  clearTimeout(pollTimer)
}

function toggleScreen() {
  screen.value = !screen.value
  document.body.classList.toggle('dashboard-screen', screen.value)
  lastRotation = currentTime.value
}

const resumeRefresh = () => { if (!document.hidden && !['locked', 'closed'].includes(phase.value)) void refresh() }
const resizeScreen = () => {
  screenPageSize.value = window.innerWidth < 1200 ? 6 : (window.innerWidth >= 1600 ? 3 : 2) * (window.innerHeight >= 1000 ? 2 : 1)
}
onMounted(() => {
  currentTime.value = Date.now()
  lastRotation = currentTime.value
  screen.value = new URLSearchParams(window.location.search).get('screen') === '1'
  resizeScreen()
  document.body.classList.toggle('dashboard-screen', screen.value)
  clockTimer = setInterval(() => {
    currentTime.value = Date.now()
    if (screen.value && autoRotate.value && !document.hidden && pages.value > 1 && currentTime.value - lastRotation >= 15_000) {
      pageIndex.value = (pageIndex.value + 1) % pages.value
      lastRotation = currentTime.value
    }
  }, 1000)
  document.addEventListener('visibilitychange', resumeRefresh)
  window.addEventListener('resize', resizeScreen)
  void refresh()
})
onBeforeUnmount(() => {
  disposed = true
  request?.abort()
  clearTimeout(pollTimer)
  clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', resumeRefresh)
  window.removeEventListener('resize', resizeScreen)
  document.body.classList.remove('dashboard-screen')
})
</script>

<template>
  <main class="dashboard-page" :class="{ 'is-screen': screen }">
    <header class="dashboard-heading">
      <div class="dashboard-identity">
        <span class="dashboard-insignia" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><path d="M32 3 57 17v30L32 61 7 47V17Z"/><path d="m15 22 17 8 17-8-7 15-10 9-10-9Z"/><path d="m22 27 10 6 10-6M32 33v13M7 17l8 5m42-5-8 5"/></svg></span>
        <div><p class="eyebrow">{{ site.shortName }} / Mission Control</p><h1>任务看板</h1><p class="dashboard-clock">{{ clock || '任务进展，一目了然。' }}</p></div>
      </div>
      <div class="dashboard-actions">
        <span class="dashboard-connection" :class="{ 'is-online': phase === 'ready' && !updateInterrupted }"><i aria-hidden="true" />{{ loading ? '正在同步' : phase === 'ready' ? updateInterrupted ? '等待更新' : '数据已同步' : phase === 'locked' ? '等待解锁' : '暂未连接' }}</span>
        <button type="button" :disabled="loading" @click="refresh">{{ loading ? '更新中…' : '刷新' }}</button>
        <button type="button" :aria-pressed="screen" @click="toggleScreen">{{ screen ? '退出大屏' : '大屏模式' }}</button>
        <button v-if="data && authorization" type="button" @click="lock">锁定</button>
      </div>
    </header>

    <section v-if="phase === 'locked'" class="dashboard-gate" aria-labelledby="dashboard-unlock-title">
      <div class="dashboard-radar" aria-hidden="true"><span /><i /></div>
      <p class="eyebrow">Team Access</p><h2 id="dashboard-unlock-title">队内任务看板</h2><p>输入访问口令，查看团队任务进展。</p>
      <form @submit.prevent="unlock"><label for="dashboard-code" class="visually-hidden">访问口令</label><input id="dashboard-code" v-model="accessCode" type="password" required maxlength="1000" autocomplete="current-password" placeholder="访问口令"><button type="submit" :disabled="loading">{{ loading ? '验证中…' : '进入看板' }}</button></form>
      <p v-if="message" role="alert" class="dashboard-warning">{{ message }}</p>
    </section>
    <section v-else-if="!data" class="dashboard-gate" aria-live="polite">
      <div class="dashboard-radar" aria-hidden="true"><span /><i /></div>
      <h2>{{ phase === 'loading' ? '正在读取任务…' : phase === 'closed' ? '看板尚未开放' : '暂时无法更新' }}</h2>
      <p>{{ message || '稍等片刻，正在获取最新进展。' }}</p>
      <button v-if="phase === 'error'" type="button" :disabled="loading" @click="refresh">重新加载</button>
    </section>

    <template v-else>
      <p v-if="data.demo" class="dashboard-notice">本地演示数据</p>
      <p v-if="updateInterrupted" role="status" class="dashboard-notice dashboard-warning">{{ message || '更新暂时中断，正在显示上次结果。' }} 上次更新 {{ formatTime(data.updatedAt) }}</p>
      <div class="dashboard-filters">
        <div class="dashboard-query"><label for="task-search" class="visually-hidden">搜索任务</label><input id="task-search" v-model="search" type="search" placeholder="搜索任务、执行人或备注"><label for="task-group" class="visually-hidden">组别</label><select id="task-group" v-model="selectedGroup"><option value="all">全部组别</option><option v-for="group in groups" :key="group" :value="group">{{ group }}</option></select></div>
        <p class="dashboard-update"><span :class="{ interrupted: updateInterrupted }" />{{ updateInterrupted ? '等待更新' : '自动更新中' }} · {{ formatTime(data.updatedAt) }}</p>
      </div>
      <section class="dashboard-stats" aria-label="任务概览">
        <div><span>待办任务</span><strong>{{ counts.todo + counts.overdue }}</strong></div>
        <div class="dashboard-overdue"><span>已逾期</span><strong>{{ counts.overdue }}</strong></div>
        <div><span>已完成</span><strong>{{ counts.done }}</strong></div>
        <div class="dashboard-countdown"><span>距离最近截止</span><strong>{{ countdown }}</strong><small v-if="nextDeadline">{{ nextDeadline.title }}</small></div>
      </section>

      <div class="dashboard-grid">
        <section class="dashboard-panel dashboard-tasks" aria-label="任务列表">
          <div class="dashboard-panel-heading"><h2>任务进展</h2><span>{{ visibleTasks.length }} 项</span></div>
          <div class="dashboard-tabs" aria-label="任务状态筛选"><button v-for="status in statuses" :key="status.value" type="button" :aria-pressed="selectedStatus === status.value" :class="{ active: selectedStatus === status.value }" @click="selectedStatus = status.value">{{ status.label }} <span>{{ status.count }}</span></button></div>
          <div v-if="pageTasks.length" class="dashboard-task-list">
            <article v-for="task in pageTasks" :key="task.id" class="dashboard-task" :class="dashboardTaskState(task, currentTime)">
              <div class="dashboard-task-top"><span v-if="task.group" class="dashboard-tag">{{ task.group }}</span><span class="dashboard-priority" :class="task.priority">{{ priorityLabels[task.priority] }}</span></div>
              <h3>{{ task.title }}</h3>
              <div class="dashboard-assignees"><span class="dashboard-label">执行人</span><span v-if="!task.assignees.length">待分配</span><span v-for="person in task.assignees" :key="person.key" class="dashboard-person"><img v-if="person.avatar" :src="person.avatar" alt="" loading="lazy" referrerpolicy="no-referrer"><span v-else class="dashboard-avatar" aria-hidden="true">{{ person.name.slice(0, 1) }}</span>{{ person.name }}</span></div>
              <p v-if="task.note" class="dashboard-note">{{ task.note }}</p>
              <div class="dashboard-task-meta"><span :class="{ 'dashboard-danger': dashboardTaskState(task, currentTime) === 'overdue' }">{{ task.status === 'done' ? `完成于 ${formatTime(task.completedAt)}` : `截止 ${formatTime(task.deadline)}` }}</span><span v-if="task.publisher">发布人 {{ task.publisher }}</span></div>
            </article>
          </div>
          <div v-else class="dashboard-empty">{{ tasks.length ? '没有匹配的任务。' : '暂无任务，新的进展会显示在这里。' }}</div>
          <div v-if="pages > 1" class="dashboard-pagination"><button type="button" aria-label="上一页任务" @click="pageIndex = (pageIndex + pages - 1) % pages">上一页</button><span>{{ pageIndex + 1 }} / {{ pages }}</span><button type="button" aria-label="下一页任务" @click="pageIndex = (pageIndex + 1) % pages">下一页</button><button v-if="screen" type="button" :aria-pressed="autoRotate" @click="autoRotate = !autoRotate">{{ autoRotate ? '暂停轮播' : '继续轮播' }}</button></div>
        </section>

        <aside class="dashboard-ranks" aria-label="个人任务统计">
          <section v-for="rank in [{ label: '待办任务榜', rows: todoRanks }, { label: '已完成任务榜', rows: doneRanks }]" :key="rank.label" class="dashboard-panel">
            <div class="dashboard-panel-heading"><h2>{{ rank.label }}</h2><span>按任务数</span></div>
            <ol v-if="rank.rows.length" class="dashboard-rank-list"><li v-for="(person, index) in rank.rows.slice(0, screen ? 4 : 8)" :key="person.key" :style="{ '--rank-width': `${person.count / (rank.rows[0]?.count || 1) * 100}%` }"><span class="dashboard-rank-number">{{ String(index + 1).padStart(2, '0') }}</span><img v-if="person.avatar" :src="person.avatar" alt="" loading="lazy" referrerpolicy="no-referrer"><span v-else class="dashboard-avatar" aria-hidden="true">{{ person.name.slice(0, 1) }}</span><span class="dashboard-rank-name">{{ person.name }}</span><strong>{{ person.count }}<small> 项</small></strong></li></ol>
            <p v-else class="dashboard-empty">暂无记录</p>
          </section>
        </aside>
      </div>

      <section v-if="data.github.enabled" class="dashboard-panel dashboard-development" aria-label="研发动态">
        <div class="dashboard-panel-heading"><h2>研发动态</h2><span>{{ data.github.unavailable ? '更新暂时中断' : `更新于 ${formatTime(data.github.updatedAt)}` }}</span></div>
        <div class="dashboard-development-grid">
          <div><h3>代码贡献榜</h3><ol v-if="data.github.contributors.length" class="dashboard-code-ranks"><li v-for="person in data.github.contributors" :key="person.name"><a :href="person.href" target="_blank" rel="noopener noreferrer"><img v-if="person.avatar" :src="person.avatar" alt="" loading="lazy"><span>{{ person.name }}</span><strong>{{ person.count }}</strong></a></li></ol><p v-else class="dashboard-empty">暂无贡献记录</p></div>
          <div><h3>最近更新</h3><ul v-if="githubEvents.length" class="dashboard-events"><li v-for="event in githubEvents" :key="event.id"><a :href="event.href" target="_blank" rel="noopener noreferrer"><time>{{ formatTime(event.at) }}</time><span><strong>{{ event.actor }}</strong> {{ event.action }}<small>{{ event.repo }}</small></span><span aria-hidden="true">↗</span></a></li></ul><p v-else class="dashboard-empty">暂无研发动态</p></div>
        </div>
      </section>
    </template>
  </main>
</template>

<style src="~/assets/css/dashboard.css" />
