<script setup lang="ts">
import { site } from '~/data/site'
import { competitions } from '~/data/competitions'
import { prepareCompetitions, competitionTimeLeft } from '~/utils/competitions'
import { dashboardGridLayout, dashboardMemberPath, dashboardTaskState, dashboardTaskGroups, selectDashboardTasks, dashboardRanks, type DashboardData, type DashboardTask } from '~/utils/dashboard'

useHead({ title: `任务看板 | ${site.shortName}`, meta: [{ name: 'robots', content: 'noindex, nofollow' }], bodyAttrs: { class: 'dashboard-tech' } })
const route = useRoute()
const screen = ref(false)
const viewportFitsScreen = ref(false)
const paginated = computed(() => screen.value && viewportFitsScreen.value)
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
const taskList = ref<HTMLElement | null>(null)
const layout = ref({ columns: 1, rows: 2, size: 2 })
const { data: members } = await useAsyncData('dashboard:members', () => queryCollection('members').select('name', 'image').all())
const memberNames = computed(() => (members.value || []).map(member => member.name))
const memberProfile = (name: string) => ({
  href: dashboardMemberPath(name, memberNames.value),
  image: members.value?.find(member => member.name === name)?.image || ''
})
let layoutObserver: ResizeObserver | undefined
let authorization = ''
let request: AbortController | undefined
let pollTimer: ReturnType<typeof setTimeout> | undefined
let clockTimer: ReturnType<typeof setInterval> | undefined
let lastRotation = 0
let disposed = false
let generation = 0

const competitionSchedule = prepareCompetitions(competitions).filter(event => event.enabled)
const eventCountdowns = computed(() => competitionSchedule.map(event => ({ ...event, ...competitionTimeLeft(event.target, currentTime.value) })))
const formatEventTime = (value: number) => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
}).format(value)

const tasks = computed(() => data.value?.tasks || [])
const groups = computed(() => [...new Set<string>(tasks.value.flatMap(dashboardTaskGroups))].sort((a, b) => a.localeCompare(b, 'zh-CN')))
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
const pageSize = computed(() => layout.value.size)
const pages = computed(() => paginated.value ? Math.max(1, Math.ceil(visibleTasks.value.length / pageSize.value)) : 1)
const pageTasks = computed(() => paginated.value ? visibleTasks.value.slice(pageIndex.value * pageSize.value, (pageIndex.value + 1) * pageSize.value) : visibleTasks.value)
const rankedTasks = computed<DashboardTask[]>(() => selectDashboardTasks(tasks.value, { status: 'all', group: selectedGroup.value }))
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

watch([selectedStatus, selectedGroup, search, pageSize, paginated], () => { pageIndex.value = 0; lastRotation = currentTime.value })
watch(pages, value => { pageIndex.value = Math.min(pageIndex.value, value - 1) })
// 静态页首次水合会暂时恢复预渲染地址；路由就绪后同步最终的查询参数。
watch(() => route.query.screen, () => {
  if (!import.meta.client) return
  screen.value = new URLSearchParams(window.location.search).get('screen') === '1'
  document.body.classList.toggle('dashboard-screen', screen.value)
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
    const entering = !data.value
    data.value = body
    if (selectedGroup.value !== 'all' && !groups.value.includes(selectedGroup.value)) selectedGroup.value = 'all'
    phase.value = 'ready'
    message.value = ''
    if (entering) {
      await nextTick()
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
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
  viewportFitsScreen.value = window.matchMedia('(min-width: 1200px) and (min-height: 700px)').matches
  if (!taskList.value) return
  const box = taskList.value.getBoundingClientRect()
  // 只有固定桌面大屏按高度分页；手机、平板和普通模式完整展示筛选结果，直接向下滚动。
  const fontSize = Number.parseFloat(getComputedStyle(taskList.value).fontSize) || 16
  layout.value = dashboardGridLayout(box.width, paginated.value ? box.height : 260, paginated.value ? 10 : 14, fontSize)
}
watch(taskList, (element, previous) => {
  if (previous) layoutObserver?.unobserve(previous)
  if (element) layoutObserver?.observe(element)
  void nextTick(resizeScreen)
}, { flush: 'post' })
watch(screen, () => { void nextTick(resizeScreen) })
onMounted(() => {
  currentTime.value = Date.now()
  lastRotation = currentTime.value
  screen.value = new URLSearchParams(window.location.search).get('screen') === '1'
  layoutObserver = new ResizeObserver(resizeScreen)
  if (taskList.value) layoutObserver.observe(taskList.value)
  resizeScreen()
  document.body.classList.toggle('dashboard-screen', screen.value)
  clockTimer = setInterval(() => {
    currentTime.value = Date.now()
    if (paginated.value && autoRotate.value && !document.hidden && pages.value > 1 && currentTime.value - lastRotation >= 15_000) {
      pageIndex.value = (pageIndex.value + 1) % pages.value
      lastRotation = currentTime.value
    }
  }, 1000)
  document.addEventListener('visibilitychange', resumeRefresh)
  window.addEventListener('resize', resizeScreen)
  void refresh()
})
onBeforeUnmount(() => {
  layoutObserver?.disconnect()
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
  <main class="dashboard-page" :class="{ 'is-screen': screen, 'is-gated': !data }">
    <header class="dashboard-heading">
      <NuxtLink class="dashboard-identity" to="/" :aria-label="`${site.university}${site.shortName}，返回首页`">
        <span class="dashboard-insignia"><img :src="site.logo" :alt="site.logoAlt" width="96" height="96"></span>
        <div><strong class="dashboard-team-name">{{ site.university }}{{ site.shortName }}</strong><span class="dashboard-brand-caption">{{ site.englishName }}</span></div>
      </NuxtLink>
      <div class="dashboard-title-block"><p class="eyebrow">Mission Control</p><h1>任务看板</h1></div>
      <div class="dashboard-header-controls">
        <p class="dashboard-clock">{{ clock || '任务进展，一目了然。' }}</p>
        <div class="dashboard-actions">
        <span class="dashboard-connection" :class="{ 'is-online': phase === 'ready' && !updateInterrupted }"><i aria-hidden="true" />{{ loading ? '正在同步' : phase === 'ready' ? updateInterrupted ? '等待更新' : '数据已同步' : phase === 'locked' ? '等待解锁' : '暂未连接' }}</span>
        <button type="button" :disabled="loading" @click="refresh">{{ loading ? '更新中…' : '刷新' }}</button>
        <button type="button" :aria-pressed="screen" @click="toggleScreen">{{ screen ? '退出大屏' : '大屏模式' }}</button>
        <button v-if="data && authorization" type="button" @click="lock">锁定</button>
        </div>
      </div>
    </header>

    <section v-if="phase === 'locked'" class="dashboard-gate dashboard-access" :class="{ 'is-verifying': loading }" :aria-busy="loading" aria-labelledby="dashboard-unlock-title">
      <div class="dashboard-gate-visual" aria-hidden="true"><div class="dashboard-radar"><span /><i /></div><span class="dashboard-gate-signal">YSU / MISSION CONTROL</span></div>
      <div class="dashboard-gate-content">
        <p class="eyebrow">Team Access / 队内入口</p><h2 id="dashboard-unlock-title">每一份进展<br>都在这里汇聚</h2><p>输入访问口令，查看团队任务进展。</p>
        <form @submit.prevent="unlock"><label for="dashboard-code">访问口令</label><div class="dashboard-code-row"><input id="dashboard-code" v-model="accessCode" :disabled="loading" type="password" required maxlength="1000" autocomplete="current-password" placeholder="输入队内访问口令"><button type="submit" :disabled="loading">{{ loading ? '验证中…' : '进入看板 →' }}</button></div></form>
        <p v-if="message" role="alert" class="dashboard-warning">{{ message }}</p>
        <p class="dashboard-access-hint"><i aria-hidden="true" />仅本次页面有效 · 离开后重新验证</p>
      </div>
      <div v-if="loading" class="dashboard-unlocking" role="status" aria-live="polite">
        <span class="dashboard-loading-orbit" aria-hidden="true"><i /><img :src="site.logo" alt="" width="68" height="68"></span>
        <strong>正在进入任务看板</strong>
        <p>正在验证口令并同步任务…</p>
        <span class="dashboard-loading-track" aria-hidden="true"><i /></span>
      </div>
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

      <section v-if="eventCountdowns.length" class="dashboard-competitions" aria-label="赛事倒计时">
        <article v-for="event in eventCountdowns" :key="event.name" class="dashboard-panel dashboard-competition" :class="{ 'is-reached': event.state === 'reached' }">
          <div class="dashboard-competition-info">
            <h2>{{ event.name }}<span v-if="event.dateStatus !== 'pending'" class="dashboard-event-status" :class="event.dateStatus">{{ event.dateStatus === 'tentative' ? '暂定' : '已确认' }}</span></h2>
            <time v-if="event.target !== null" :datetime="event.startsAt || undefined">{{ formatEventTime(event.target) }} · 北京时间</time>
          </div>
          <div class="dashboard-competition-remaining">
            <template v-if="event.state === 'counting'"><span class="dashboard-event-label">距离赛事</span><strong>{{ event.days }}<small> 天</small></strong><span class="dashboard-event-clock">{{ event.clock }}</span></template>
            <strong v-else class="dashboard-event-message">{{ event.state === 'pending' ? '日期待定' : event.state === 'waiting' ? '正在校时…' : '已到达节点' }}</strong>
          </div>
        </article>
      </section>

      <div class="dashboard-grid">
        <section class="dashboard-panel dashboard-tasks" aria-label="任务列表">
          <div class="dashboard-panel-heading"><h2>任务进展</h2><span>{{ visibleTasks.length }} 项</span></div>
          <div class="dashboard-tabs" aria-label="任务状态筛选"><button v-for="status in statuses" :key="status.value" type="button" :aria-pressed="selectedStatus === status.value" :class="{ active: selectedStatus === status.value }" @click="selectedStatus = status.value">{{ status.label }} <span>{{ status.count }}</span></button></div>
          <div v-if="pageTasks.length" ref="taskList" class="dashboard-task-list" :style="{ '--dashboard-columns': layout.columns, '--dashboard-rows': layout.rows }">
            <article v-for="task in pageTasks" :key="task.id" class="dashboard-task" :class="dashboardTaskState(task, currentTime)">
              <div class="dashboard-task-top"><span v-if="task.group" class="dashboard-tag" :title="task.group">{{ task.group }}</span><span class="dashboard-priority" :class="task.priority">{{ priorityLabels[task.priority] }}</span></div>
              <h3 :title="task.title">{{ task.title }}</h3>
              <div class="dashboard-assignees"><span class="dashboard-label">执行人</span><span v-if="!task.assignees.length">待分配</span><DashboardMember v-for="person in task.assignees" :key="person.key" :person="person" :profile="memberProfile(person.name)" /></div>
              <p v-if="task.note" class="dashboard-note" :title="task.note">{{ task.note }}</p>
              <div class="dashboard-task-meta"><span :class="{ 'dashboard-danger': dashboardTaskState(task, currentTime) === 'overdue' }">{{ task.status === 'done' ? `完成于 ${formatTime(task.completedAt)}` : `截止 ${formatTime(task.deadline)}` }}</span><span v-if="task.publisher" class="dashboard-publishers">发布人 <DashboardMember v-for="person in task.publishers || [{ key: task.publisher, name: task.publisher, avatar: '' }]" :key="person.key" :person="person" :profile="memberProfile(person.name)" /></span></div>
            </article>
          </div>
          <div v-else class="dashboard-empty">{{ tasks.length ? '没有匹配的任务。' : '暂无任务，新的进展会显示在这里。' }}</div>
          <div v-if="paginated && pageTasks.length" class="dashboard-pagination" aria-label="任务分页"><button type="button" aria-label="上一页任务" :disabled="pages === 1" @click="pageIndex = (pageIndex + pages - 1) % pages">上一页</button><span>{{ pageIndex + 1 }} / {{ pages }} <small>每页 {{ pageSize }} 项</small></span><button type="button" aria-label="下一页任务" :disabled="pages === 1" @click="pageIndex = (pageIndex + 1) % pages">下一页</button><button v-if="screen" type="button" :disabled="pages === 1" :aria-pressed="autoRotate" @click="autoRotate = !autoRotate">{{ autoRotate ? '暂停轮播' : '继续轮播' }}</button></div>
        </section>

        <aside class="dashboard-ranks" aria-label="个人任务统计">
          <section v-for="rank in [{ label: '待办任务榜', rows: todoRanks }, { label: '已完成任务榜', rows: doneRanks }]" :key="rank.label" class="dashboard-panel">
            <div class="dashboard-panel-heading"><h2>{{ rank.label }}</h2><span>按任务数</span></div>
            <ol v-if="rank.rows.length" class="dashboard-rank-list"><li v-for="(person, index) in rank.rows.slice(0, screen ? 4 : 8)" :key="person.key" :style="{ '--rank-width': `${person.count / (rank.rows[0]?.count || 1) * 100}%` }"><span class="dashboard-rank-number">{{ String(index + 1).padStart(2, '0') }}</span><DashboardMember class="dashboard-rank-name" :person="person" :profile="memberProfile(person.name)" /><strong>{{ person.count }}<small> 项</small></strong></li></ol>
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
