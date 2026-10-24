<script setup lang="ts">
import { site } from '~/data/site'
import { competitions } from '~/data/competitions'
import { prepareCompetitions, competitionTimeLeft } from '~/utils/competitions'
import { dashboardGridLayout, dashboardTaskPages, dashboardMemberPath, dashboardTaskState, dashboardTaskGroups, selectDashboardTasks, dashboardRanks, type DashboardData, type DashboardTask } from '~/utils/dashboard'
import { DASHBOARD_PREFERENCES_KEY, dashboardPreferences, readDashboardPreferences } from '../../../utils/dashboard-experience.mjs'
import { dashboardCodeProfile } from '../../../utils/dashboard-members.mjs'

useHead({ title: `任务看板 | ${site.shortName}`, meta: [{ name: 'robots', content: 'noindex, nofollow' }], bodyAttrs: { class: 'dashboard-tech' } })
const route = useRoute()
const router = useRouter()
const screen = ref(false)
const fullscreen = ref(false)
const displayMessage = ref('')
const selectedTaskId = ref<string | null>(null)
const showCompletion = ref(false)
const viewportFitsScreen = ref(false)
const desktopPagination = ref(false)
const showSyncDetails = ref(false)
const fixedScreen = computed(() => screen.value && viewportFitsScreen.value)
const paginated = computed(() => desktopPagination.value || fixedScreen.value)
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
const dashboardPage = ref<HTMLElement | null>(null)
const layout = ref({ columns: 1, rows: 2, size: 2 })
const fixedGridHeight = ref<number | null>(null)
const taskMeasure = ref<HTMLElement | null>(null)
const measurementTime = ref(0)
const taskPages = ref([{ start: 0, end: 2, height: 0, rows: 1 }])
const { data: members } = await useAsyncData('dashboard:members', () => queryCollection('members').select('name', 'image', 'links').all())
const codeProfile = (person: { name: string; href?: string; login?: string; memberName?: string }) => dashboardCodeProfile(person, members.value || [], site.logo)
const memberNames = computed(() => (members.value || []).map(member => member.name))
const memberProfile = (name: string) => ({
  href: dashboardMemberPath(name, memberNames.value),
  image: members.value?.find(member => member.name === name)?.image || ''
})
let layoutObserver: ResizeObserver | undefined
let layoutFrame = 0
let authorization = ''
let request: AbortController | undefined
let pollTimer: ReturnType<typeof setTimeout> | undefined
let clockTimer: ReturnType<typeof setInterval> | undefined
let lastRotation = 0
let preferencesLoaded = false
let ownsFullscreen = false
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
const pageSize = computed(() => {
  const page = taskPages.value[pageIndex.value]
  return page ? page.end - page.start : layout.value.size
})
const pages = computed(() => paginated.value ? Math.max(1, taskPages.value.length) : 1)
const pageTasks = computed(() => paginated.value ? visibleTasks.value.slice(taskPages.value[pageIndex.value]?.start || 0, taskPages.value[pageIndex.value]?.end || layout.value.size) : visibleTasks.value)
const rankedTasks = computed<DashboardTask[]>(() => selectDashboardTasks(tasks.value, { status: 'all', group: selectedGroup.value }))
const todoRanks = computed(() => dashboardRanks(rankedTasks.value, 'todo'))
const doneRanks = computed(() => dashboardRanks(rankedTasks.value, 'done'))
const activeTask = computed(() => tasks.value.find(task => task.id === selectedTaskId.value))
const overlayOpen = computed(() => Boolean(activeTask.value || showCompletion.value))
const completionScope = computed(() => `${selectedGroup.value === 'all' ? '全部组别' : selectedGroup.value}${search.value.trim() ? ' · 当前关键词筛选' : ''}`)
const development = computed(() => data.value?.development || data.value?.github)
const developmentEvents = computed(() => development.value?.events || [])
const updateInterrupted = computed(() => Boolean(data.value && (data.value.stale || message.value || currentTime.value - data.value.updatedAt > 90_000)))
const formatTime = (value?: number | null) => value ? new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
}).format(value) : '未设置'
const clock = computed(() => currentTime.value ? new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
}).format(currentTime.value) : '')

watch([selectedStatus, selectedGroup, search, paginated], () => { pageIndex.value = 0; lastRotation = currentTime.value })
watch(pages, value => { pageIndex.value = Math.min(pageIndex.value, value - 1) })
watch(activeTask, task => { if (!task) selectedTaskId.value = null })
watch(data, value => { if (!value) { selectedTaskId.value = null; showCompletion.value = false } })
watch([selectedGroup, selectedStatus, screen, autoRotate], () => {
  if (!import.meta.client || !preferencesLoaded) return
  try {
    localStorage.setItem(DASHBOARD_PREFERENCES_KEY, JSON.stringify(dashboardPreferences({
      version: 1, group: selectedGroup.value, status: selectedStatus.value, screen: screen.value, autoRotate: autoRotate.value
    })))
  } catch { displayMessage.value = '浏览器未允许保存显示偏好，设置仅本次有效。' }
}, { flush: 'post' })
// 静态页首次水合会暂时恢复预渲染地址；路由就绪后同步最终的查询参数。
watch(() => route.query.screen, () => {
  if (!import.meta.client) return
  const explicit = new URLSearchParams(window.location.search).get('screen')
  if (explicit !== null) screen.value = explicit === '1'
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
    if (!result.ok || !Array.isArray(body?.tasks) || !(body?.development || body?.github)) throw new Error('DATA_UNAVAILABLE')
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
  selectedTaskId.value = null
  showCompletion.value = false
  message.value = ''
  phase.value = 'locked'
  clearTimeout(pollTimer)
}

function setScreen(value: boolean) {
  screen.value = value
  document.body.classList.toggle('dashboard-screen', screen.value)
  lastRotation = currentTime.value
  if (new URLSearchParams(window.location.search).has('screen')) void router.replace({ query: { ...route.query, screen: value ? '1' : '0' } })
}
const toggleScreen = () => setScreen(!screen.value)
function openTask(id: string) { showCompletion.value = false; selectedTaskId.value = id }
function openCard(event: MouseEvent, id: string) {
  if (!(event.target instanceof Element) || event.target.closest('a, button, input, select')) return
  openTask(id)
}
async function toggleFullscreen() {
  displayMessage.value = ''
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else {
      setScreen(true)
      if (!document.documentElement.requestFullscreen || !document.fullscreenEnabled) throw new Error('UNAVAILABLE')
      await document.documentElement.requestFullscreen()
      ownsFullscreen = true
    }
  } catch { displayMessage.value = '浏览器未能切换全屏，可继续使用大屏模式。' }
}
const syncFullscreen = () => {
  fullscreen.value = Boolean(document.fullscreenElement)
  if (!fullscreen.value) ownsFullscreen = false
  void nextTick(resizeScreen)
}
function escapeFullscreen(event: KeyboardEvent) {
  if (event.key === 'Escape' && !overlayOpen.value && ownsFullscreen && document.fullscreenElement) {
    event.preventDefault()
    void document.exitFullscreen().catch(() => { displayMessage.value = '暂时无法退出全屏，请使用浏览器的退出全屏操作。' })
  }
}
function resetDisplay() {
  search.value = ''
  selectedGroup.value = 'all'
  selectedStatus.value = 'todo'
  autoRotate.value = true
  setScreen(false)
  displayMessage.value = '已恢复默认显示设置。'
}

const resumeRefresh = () => {
  if (document.hidden) return
  currentTime.value = Date.now()
  if (!['locked', 'closed'].includes(phase.value)) void refresh()
}
const resizeScreen = () => {
  if (!layoutFrame) layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; measureScreen() })
}
const measureScreen = () => {
  const candidate = screen.value && window.matchMedia('(min-width: 1200px) and (min-height: 700px)').matches
  // 先按固定大屏样式实测，避免普通模式较大的间距误判为没有空间。
  dashboardPage.value?.classList.toggle('is-fixed-screen', candidate)
  const occupied = [...(dashboardPage.value?.children || [])].filter(element =>
    element.matches('.dashboard-heading, .dashboard-notice, .dashboard-toolbar, .dashboard-stats, .dashboard-competitions'))
    .reduce((total, element) => {
      const style = getComputedStyle(element)
      return total + element.getBoundingClientRect().height + (Number.parseFloat(style.marginTop) || 0) + (Number.parseFloat(style.marginBottom) || 0)
    }, 0)
  // 短屏或顶部内容较多时解除固定高度，避免任务面板被压成零高度。
  const developmentPanel = dashboardPage.value?.querySelector<HTMLElement>('.dashboard-development')
  const developmentReserve = developmentPanel ? Math.min(260, Math.max(160, window.innerHeight * .18)) + 16 : 0
  viewportFitsScreen.value = candidate && window.innerHeight - 32 - occupied - developmentReserve >= 360
  dashboardPage.value?.classList.toggle('is-fixed-screen', fixedScreen.value)
  desktopPagination.value = window.matchMedia('(min-width: 1000px)').matches
  if (!taskList.value) {
    const panel = dashboardPage.value?.querySelector<HTMLElement>('.dashboard-tasks')
    const style = panel && getComputedStyle(panel)
    fixedGridHeight.value = fixedScreen.value && developmentPanel && panel && style ? Math.ceil(
      [...panel.children].reduce((total, element) => {
        const childStyle = getComputedStyle(element)
        return total + element.getBoundingClientRect().height + (Number.parseFloat(childStyle.marginTop) || 0) + (Number.parseFloat(childStyle.marginBottom) || 0)
      }, 0) + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth)
    ) : null

    return
  }
  let box = taskList.value.getBoundingClientRect()
  // 桌面普通模式用独立的视口预算分页，不使用完整任务列表的高度，避免反馈增长；窄屏连续滚动。
  const fontSize = Number.parseFloat(getComputedStyle(taskList.value).fontSize) || 16
  let gap = fixedScreen.value ? 10 : 14
  let columns = dashboardGridLayout(box.width, 0, gap, fontSize).columns
  if (taskMeasure.value) {
    taskMeasure.value.style.width = `${box.width}px`
    taskMeasure.value.style.setProperty('--dashboard-columns', String(columns))
  }
  let cardHeights = [...(taskMeasure.value?.children || [])].map(element => element.getBoundingClientRect().height)
  let cardHeight = Math.max(...cardHeights, 180 * Math.max(1, fontSize / 16))
  const grid = dashboardPage.value?.querySelector<HTMLElement>('.dashboard-grid')
  const panel = taskList.value.closest<HTMLElement>('.dashboard-tasks')
  const pager = panel?.querySelector<HTMLElement>('.dashboard-pagination')
  // 以页面边界计算独立预算，不再从已经收紧的列表高度反推容量，避免越算越少。
  const panelStyle = panel && getComputedStyle(panel)
  const panelBottom = panelStyle ? Number.parseFloat(panelStyle.paddingBottom) + Number.parseFloat(panelStyle.borderBottomWidth) : 0
  const chrome = panel ? box.top - panel.getBoundingClientRect().top + (pager?.getBoundingClientRect().height || 0) + panelBottom : 0
  const available = dashboardPage.value && grid ? dashboardPage.value.getBoundingClientRect().bottom - grid.getBoundingClientRect().top : 0
  let height = fixedScreen.value ? Math.max(0, available - developmentReserve - chrome) : Math.max(300, Math.min(window.innerHeight * .62, 900))
  const firstRowsHeight = cardHeights.length > columns
    ? Math.max(...cardHeights.slice(0, columns)) + gap + Math.max(...cardHeights.slice(columns, columns * 2)) : cardHeight
  // 浏览器工具栏或缩放挤占高度时允许页面滚动，不把大量任务压成一行。
  if (fixedScreen.value && height < firstRowsHeight) {
    viewportFitsScreen.value = false
    dashboardPage.value?.classList.remove('is-fixed-screen')
    fixedGridHeight.value = null
    box = taskList.value.getBoundingClientRect()
    gap = 14
    columns = dashboardGridLayout(box.width, 0, gap, fontSize).columns
    if (taskMeasure.value) {
      taskMeasure.value.style.width = `${box.width}px`
      taskMeasure.value.style.setProperty('--dashboard-columns', String(columns))
    }
    cardHeights = [...(taskMeasure.value?.children || [])].map(element => element.getBoundingClientRect().height)
    cardHeight = Math.max(...cardHeights, 180 * Math.max(1, fontSize / 16))
    height = Math.max(300, Math.min(window.innerHeight * .62, 900))
  }
  layout.value = dashboardGridLayout(box.width, height, gap, fontSize, cardHeight)
  taskPages.value = dashboardTaskPages(cardHeights.length ? cardHeights : visibleTasks.value.map(() => cardHeight), columns, height, gap)
  const currentPage = taskPages.value[Math.min(pageIndex.value, taskPages.value.length - 1)]
  fixedGridHeight.value = fixedScreen.value && developmentPanel && currentPage ? Math.ceil(chrome + currentPage.height) : null
}
watch(taskList, (element, previous) => {
  if (previous) layoutObserver?.unobserve(previous)
  if (element) layoutObserver?.observe(element)
  void nextTick(resizeScreen)
}, { flush: 'post' })
watch(taskMeasure, () => { void nextTick(resizeScreen) })
watch([screen, showSyncDetails], () => { void nextTick(resizeScreen) })
watch([data, selectedGroup, search, selectedStatus, pageIndex, () => pageTasks.value.length], () => { measurementTime.value = currentTime.value; void nextTick(resizeScreen) }, { flush: 'post' })
onMounted(() => {
  currentTime.value = Date.now()
  lastRotation = currentTime.value
  let saved = readDashboardPreferences(null)
  try { saved = readDashboardPreferences(localStorage.getItem(DASHBOARD_PREFERENCES_KEY)) } catch { /* 显示仍可正常使用。 */ }
  selectedGroup.value = saved.group
  selectedStatus.value = saved.status
  autoRotate.value = saved.autoRotate
  const explicit = new URLSearchParams(window.location.search).get('screen')
  screen.value = explicit === null ? saved.screen : explicit === '1'
  preferencesLoaded = true
  layoutObserver = new ResizeObserver(resizeScreen)
  if (taskList.value) layoutObserver.observe(taskList.value)
  resizeScreen()
  document.body.classList.toggle('dashboard-screen', screen.value)
  clockTimer = setInterval(() => {
    if (document.hidden) return
    currentTime.value = Date.now()
    if (fixedScreen.value && autoRotate.value && !overlayOpen.value && !document.hidden && pages.value > 1 && currentTime.value - lastRotation >= 15_000) {
      pageIndex.value = (pageIndex.value + 1) % pages.value
      lastRotation = currentTime.value
    }
  }, 1000)
  document.addEventListener('visibilitychange', resumeRefresh)
  window.addEventListener('resize', resizeScreen)
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('keydown', escapeFullscreen)
  syncFullscreen()
  void refresh()
})
onBeforeUnmount(() => {
  layoutObserver?.disconnect()
  cancelAnimationFrame(layoutFrame)
  disposed = true
  request?.abort()
  clearTimeout(pollTimer)
  clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', resumeRefresh)
  window.removeEventListener('resize', resizeScreen)
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('keydown', escapeFullscreen)
  if (ownsFullscreen && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  document.body.classList.remove('dashboard-screen')
})
</script>

<template>
  <main ref="dashboardPage" class="dashboard-page" :class="{ 'is-screen': screen, 'is-fixed-screen': fixedScreen, 'is-paginated': paginated, 'is-gated': !data, 'has-development-layout': fixedGridHeight !== null }" :style="{ '--dashboard-grid-height': fixedGridHeight === null ? undefined : `${fixedGridHeight}px` }">
    <header class="dashboard-heading">
      <NuxtLink class="dashboard-identity" to="/" :aria-label="`${site.university}${site.shortName}，返回首页`">
        <span class="dashboard-insignia"><img :src="site.logo" :alt="site.logoAlt" width="96" height="96"></span>
        <div><strong class="dashboard-team-name">{{ site.university }}{{ site.shortName }}</strong><span class="dashboard-brand-caption">{{ site.englishName }}</span></div>
      </NuxtLink>
      <div class="dashboard-heading-center">
        <div class="dashboard-title-block"><p class="eyebrow">Mission Control</p><h1>任务看板</h1></div>
        <section v-if="eventCountdowns.length" class="dashboard-heading-competitions" aria-label="赛事倒计时">
          <article v-for="event in eventCountdowns" :key="event.name" class="dashboard-heading-event" :class="{ 'is-reached': event.state === 'reached' }">
            <div class="dashboard-heading-event-info">
              <h2><img src="/images/competitions/robomaster.png" alt="RoboMaster" width="1021" height="663">{{ event.name }}</h2>
              <div class="dashboard-heading-event-meta">
                <span v-if="event.dateStatus !== 'pending'" class="dashboard-heading-event-status" :class="event.dateStatus">{{ event.dateStatus === 'historical' ? `去年同期参考（${event.referenceYear}）` : event.dateStatus === 'tentative' ? '暂定' : '已确认' }}</span>
                <time v-if="event.target !== null" :datetime="event.startsAt || undefined" :title="`${formatEventTime(event.target)} · 北京时间${event.dateStatus === 'historical' ? ' · 同期推算' : ''}`">{{ formatTime(event.target) }} · 北京时间</time>
              </div>
            </div>
            <div class="dashboard-heading-event-count">
              <template v-if="event.state === 'counting'"><span class="visually-hidden">{{ event.dateStatus === 'historical' ? '距离参考日期' : '距离赛事' }}</span><strong>{{ event.days }}<small> 天</small></strong><span>{{ event.clock }}</span></template>
              <strong v-else>{{ event.state === 'pending' ? '日期待定' : event.state === 'waiting' ? '正在校时…' : '已到达节点' }}</strong>
            </div>
          </article>
        </section>
      </div>
      <div class="dashboard-header-controls">
        <p class="dashboard-clock">{{ clock || '任务进展，一目了然。' }}</p>
        <div class="dashboard-actions">
        <span class="dashboard-connection" :class="{ 'is-online': phase === 'ready' && !updateInterrupted }"><i aria-hidden="true" />{{ loading ? '正在同步' : phase === 'ready' ? updateInterrupted ? '等待更新' : '数据已同步' : phase === 'locked' ? '等待解锁' : '暂未连接' }}</span>
        <button type="button" :disabled="loading" @click="refresh">{{ loading ? '更新中…' : '刷新' }}</button>
        <button type="button" :aria-pressed="screen" @click="toggleScreen">{{ screen ? '退出大屏' : '大屏模式' }}</button>
        <button type="button" :aria-pressed="fullscreen" @click="toggleFullscreen">{{ fullscreen ? '退出全屏' : '浏览器全屏' }}</button>
        <button v-if="data && authorization" type="button" @click="lock">锁定</button>
        </div>
      </div>
    </header>
    <p v-if="displayMessage" class="dashboard-notice" role="status">{{ displayMessage }}</p>

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
      <div class="dashboard-toolbar">
        <div class="dashboard-filters">
          <div class="dashboard-query"><label for="task-search" class="visually-hidden">搜索任务</label><input id="task-search" v-model="search" type="search" placeholder="搜索任务、执行人或备注"><label for="task-group" class="visually-hidden">组别</label><select id="task-group" v-model="selectedGroup"><option value="all">全部组别</option><option v-for="group in groups" :key="group" :value="group">{{ group }}</option></select></div>
          <p class="dashboard-update"><span :class="{ interrupted: updateInterrupted }" />{{ updateInterrupted ? '等待更新' : '自动更新中' }} · {{ formatTime(data.updatedAt) }} <button type="button" class="dashboard-text-button" @click="resetDisplay">重置显示</button></p>
        </div>
        <section class="dashboard-stats" aria-label="任务概览">
          <div><span>待办任务</span><strong>{{ counts.todo + counts.overdue }}</strong></div>
          <div class="dashboard-overdue"><span>已逾期</span><strong>{{ counts.overdue }}</strong></div>
          <div><span>已完成</span><strong>{{ counts.done }}</strong><button type="button" class="dashboard-text-button dashboard-trend-trigger" aria-label="查看完成趋势" @click="selectedTaskId = null; showCompletion = true">完成趋势 →</button></div>
        </section>
      </div>
      <div v-if="paginated && visibleTasks.length" ref="taskMeasure" class="dashboard-task-measure dashboard-task-list" aria-hidden="true" inert>
        <article v-for="task in visibleTasks" :key="task.id" class="dashboard-task" :class="dashboardTaskState(task, measurementTime)"><DashboardTaskContent :task="task" :current-time="measurementTime" :paginated="true" :profile-for="memberProfile" /></article>
      </div>
      <div class="dashboard-grid">
        <section class="dashboard-panel dashboard-tasks" aria-label="任务列表">
          <div class="dashboard-panel-heading"><h2>任务进展</h2><span>{{ visibleTasks.length }} 项</span></div>
          <div class="dashboard-tabs" aria-label="任务状态筛选"><button v-for="status in statuses" :key="status.value" type="button" :aria-pressed="selectedStatus === status.value" :class="{ active: selectedStatus === status.value }" @click="selectedStatus = status.value">{{ status.label }} <span>{{ status.count }}</span></button></div>
          <div v-if="pageTasks.length" ref="taskList" class="dashboard-task-list" :style="{ '--dashboard-columns': layout.columns, '--dashboard-rows': layout.rows }">
            <article v-for="task in pageTasks" :key="task.id" class="dashboard-task" :class="dashboardTaskState(task, currentTime)" @click="openCard($event, task.id)">
              <DashboardTaskContent :task="task" :current-time="currentTime" :paginated="paginated" :profile-for="memberProfile" @open="openTask" />
            </article>
          </div>
          <div v-else class="dashboard-empty">{{ tasks.length ? '没有匹配的任务。' : '暂无任务，新的进展会显示在这里。' }}</div>
          <div v-if="paginated && pageTasks.length" class="dashboard-pagination" aria-label="任务分页"><button type="button" aria-label="上一页任务" :disabled="pages === 1" @click="pageIndex = (pageIndex + pages - 1) % pages">上一页</button><span>{{ pageIndex + 1 }} / {{ pages }} <small>每页 {{ pageSize }} 项</small></span><button type="button" aria-label="下一页任务" :disabled="pages === 1" @click="pageIndex = (pageIndex + 1) % pages">下一页</button><button v-if="fixedScreen" type="button" :disabled="pages === 1" :aria-pressed="autoRotate" @click="autoRotate = !autoRotate">{{ autoRotate ? '暂停轮播' : '继续轮播' }}</button></div>
        </section>

        <aside class="dashboard-ranks" aria-label="个人任务统计">
          <section v-for="rank in [{ label: '待办任务榜', rows: todoRanks }, { label: '已完成任务榜', rows: doneRanks }]" :key="rank.label" class="dashboard-panel">
            <DashboardAutoScroll :label="rank.label" :suspended="overlayOpen" heading-class="dashboard-panel-heading">
            <template #heading><h2>{{ rank.label }}</h2></template>
            <ol v-if="rank.rows.length" class="dashboard-rank-list"><li v-for="(person, index) in rank.rows" :key="person.key" :style="{ '--rank-width': `${person.count / (rank.rows[0]?.count || 1) * 100}%` }"><span class="dashboard-rank-number">{{ String(index + 1).padStart(2, '0') }}</span><DashboardMember class="dashboard-rank-name" :person="person" :profile="memberProfile(person.name)" /><strong>{{ person.count }}<small> 项</small></strong></li></ol>
            <p v-else class="dashboard-empty">暂无记录</p>
            </DashboardAutoScroll>
          </section>
        </aside>
      </div>

      <section v-if="development?.enabled" class="dashboard-panel dashboard-development" aria-label="研发动态">
        <div class="dashboard-panel-heading"><h2>研发动态 <small class="dashboard-code-platform">GitCode</small></h2><div class="dashboard-development-controls"><span>{{ development.configurationError ? '仓库配置待检查' : development.syncing ? '分批同步中，当前为部分结果' : development.unavailable ? '部分数据暂不可用' : `更新于 ${formatTime(development.updatedAt)}` }}</span><button v-if="development.organization || development.sources?.length" type="button" class="dashboard-text-button" :aria-expanded="showSyncDetails" aria-controls="dashboard-sync-details" @click="showSyncDetails = !showSyncDetails">{{ showSyncDetails ? '收起同步详情 ↑' : '同步详情 ↓' }}</button></div></div>
        <div v-if="showSyncDetails" id="dashboard-sync-details">
          <p v-if="development.organization" class="dashboard-code-scope"><a :href="development.organization.href" target="_blank" rel="noopener noreferrer">{{ development.organization.name }}</a><span>{{ development.organization.unavailable ? '组织列表更新中断' : development.organization.includedCount === 0 ? '当前可读取范围内没有纳入的代码仓库' : '组织代码仓库' }}</span><span v-if="development.organization.includedCount !== undefined">已同步 {{ development.sources?.filter(source => !source.pending && !source.unavailable).length || 0 }} / {{ development.organization.includedCount }}<template v-if="development.organization.excludedCount"> · 已排除 {{ development.organization.excludedCount }}</template></span><time v-if="development.organization.updatedAt">列表更新 {{ formatTime(development.organization.updatedAt) }}</time></p>
          <ul v-if="development.sources?.length" class="dashboard-code-sources" aria-label="代码仓库同步状态" tabindex="0"><li v-for="source in development.sources" :key="source.key" :class="{ 'is-unavailable': source.unavailable || source.pending }"><a :href="source.href" target="_blank" rel="noopener noreferrer">{{ source.repo }}</a><small v-if="source.fork">Fork</small><span>{{ source.pending ? (source.unavailable ? '等待同步 · 部分失败' : '等待同步') : source.unavailable ? '更新中断' : '已同步' }}</span><time v-if="source.updatedAt" :datetime="new Date(source.updatedAt).toISOString()">{{ formatTime(source.updatedAt) }}</time></li></ul>
        </div>
        <div class="dashboard-development-grid">
          <DashboardAutoScroll label="代码贡献榜" :suspended="overlayOpen"><template #heading><h3>代码贡献榜 <small>{{ development.syncing ? '部分仓库 · 提交次数' : '提交次数' }}</small></h3></template><ol v-if="development.contributors.length" class="dashboard-code-ranks"><li v-for="person in development.contributors" :key="person.key || person.name"><DashboardCodeContributor :person="person" :profile="codeProfile(person)" /></li></ol><p v-else class="dashboard-empty">{{ development.syncing ? '正在同步贡献记录' : development.unavailable ? '暂时无法读取贡献记录' : '暂无贡献记录' }}</p></DashboardAutoScroll>
          <DashboardAutoScroll label="最近更新" :suspended="overlayOpen"><template #heading><h3>最近更新</h3></template><ul v-if="developmentEvents.length" class="dashboard-events"><li v-for="event in developmentEvents" :key="event.id"><time>{{ formatTime(event.at) }}</time><div class="dashboard-event-content"><DashboardCodeIdentity :profile="codeProfile({ name: event.actor, href: event.actorHref, login: event.actorLogin })" /><span>{{ event.action }}</span><a class="dashboard-event-repo" :href="event.href" target="_blank" rel="noopener noreferrer">{{ event.repo }} <span aria-hidden="true">↗</span></a></div></li></ul><p v-else class="dashboard-empty">{{ development.syncing ? '正在同步研发动态' : development.unavailable ? '暂时无法读取研发动态' : '暂无研发动态' }}</p></DashboardAutoScroll>
        </div>
      </section>
    </template>
    <DashboardTaskDetails v-if="activeTask" :task="activeTask" :now="currentTime" :profile-for="memberProfile" @close="selectedTaskId = null" />
    <DashboardCompletion v-if="data && showCompletion" :tasks="scopedTasks" :now="currentTime" :scope="completionScope" @close="showCompletion = false" />
  </main>
</template>

<style src="~/assets/css/dashboard.css" />
