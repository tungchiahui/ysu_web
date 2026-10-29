<script setup lang="ts">
import { site } from '~/data/site'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import mediumZoom from 'medium-zoom'
import { createWikiAnchorScroller } from '~/utils/wiki-anchor-scroll'
import { getActiveWikiHeadingId, getWikiTocScrollTop } from '~/utils/wiki-toc-scroll'
import { compareWikiChapters, numberWikiChapters } from '~~/utils/wiki-chapters'
import { resolveWikiAuthors, wikiAuthorProfiles } from '~~/utils/wiki-authors.mjs'

interface TocDisplayLink {
  id: string
  text: string
  depth: number
  level: number
  number: string
}

interface WikiPage {
  path: string
  stem?: string
  title: string
  authors?: string[] | null
  date?: string
  chapter?: string
  chapterOrder?: string
  chapterDepth?: number
  docKey?: string
  docRoot?: string
  docTitle?: string
  isWikiDoc?: boolean
  isWikiIndex?: boolean
  body?: unknown
  [key: string]: unknown
}

const route = useRoute()
const cleanPath = computed(() => route.path.replace(/\/$/, '') || '/')

const { data: page, pending } = await useAsyncData<WikiPage | null>(
  computed(() => `wiki-page-${cleanPath.value}`),
  () => queryCollection('wiki').path(cleanPath.value).first() as Promise<WikiPage | null>,
  { watch: [cleanPath] }
)

if (!pending.value && !page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Wiki 页面不存在',
    fatal: true
  })
}

const pageDocKey = computed(() => page.value?.docKey || '')

const { data: docItems } = await useAsyncData<WikiPage[]>(
  computed(() => `wiki-doc-items-${pageDocKey.value || cleanPath.value}`),
  async () => {
    const docKey = page.value?.docKey

    if (!docKey) {
      return []
    }

    return await queryCollection('wiki')
      .where('docKey', '=', docKey)
      .select(
        'path',
        'stem',
        'title',
        'authors',
        'date',
        'chapterOrder',
        'chapterDepth',
        'docKey',
        'docRoot',
        'docTitle',
        'isWikiDoc',
        'isWikiIndex'
      )
      .all() as WikiPage[]
  },
  { watch: [pageDocKey] }
)

const docIndex = computed(() => docItems.value?.find((item) => item.isWikiIndex && normalizePath(item.path) === normalizePath(page.value?.docRoot || '')) || null)
const pageAuthors = computed(() => resolveWikiAuthors(page.value, docIndex.value))
const { data: authorMembers } = await useAsyncData('wiki:author-members', () =>
  queryCollection('members').select('name', 'image').all()
)
const pageAuthorProfiles = computed(() => wikiAuthorProfiles(pageAuthors.value, authorMembers.value, site.logo))
const chapterItems = computed(() =>
  numberWikiChapters((docItems.value || []).filter((item) => !item.isWikiIndex))
    .sort(compareWikiChapters)
)
const docNavigationItems = computed(() => [
  ...(docIndex.value ? [docIndex.value] : []),
  ...chapterItems.value
])
const currentChapter = computed(() =>
  chapterItems.value.find((item) => normalizePath(item.path) === normalizePath(cleanPath.value))?.chapter
)

const currentNavIndex = computed(() =>
  docNavigationItems.value.findIndex((item) => normalizePath(item.path) === normalizePath(cleanPath.value))
)

const previousPage = computed(() => {
  const index = currentNavIndex.value
  return index > 0 ? docNavigationItems.value[index - 1] : null
})

const nextPage = computed(() => {
  const index = currentNavIndex.value
  return index >= 0 && index < docNavigationItems.value.length - 1
    ? docNavigationItems.value[index + 1]
    : null
})

const docTitle = computed(() =>
  docIndex.value?.title || page.value?.docTitle || page.value?.title || 'Wiki'
)

const pageTitle = computed(() => {
  if (!page.value) return '加载中...'
  return currentChapter.value ? `${currentChapter.value} ${page.value.title}` : page.value.title
})

useHead(() => ({
  title: `${pageTitle.value} | ${site.shortName} Wiki`,
  meta: [
    { name: 'description', content: page.value?.title || '' },
    { property: 'og:title', content: pageTitle.value }
  ]
}))

const contentRoot = ref<HTMLElement | null>(null)
const tocSidebar = ref<HTMLElement | null>(null)
const showDocNav = ref(false)
const showToc = ref(false)
const activeHeadingId = ref('')
const readingProgress = ref(0)
const tocLinks = ref<TocDisplayLink[]>([])
const defaultHeadingScrollOffset = 108
const pendingAnchorId = ref('')
let initialHashHandled = false
let anchorScroller: ReturnType<typeof createWikiAnchorScroller> | null = null
let anchorHighlight: Animation | null = null
const imageLoadCleanupFns: Array<() => void> = []
let headingScrollOffset = defaultHeadingScrollOffset
let headingElements: HTMLElement[] = []
let zoomInstance: ReturnType<typeof mediumZoom> | null = null
let viewportSyncFrame: number | null = null
let contentResizeObserver: ResizeObserver | null = null

const hasMobileDrawer = computed(() => showDocNav.value || showToc.value)

const syncHeadingScrollOffset = () => {
  const heading = document.querySelector('.wiki-content-body h2, .wiki-content-body h3, .wiki-content-body h4, .wiki-content-body h5, .wiki-content-body h6') as HTMLElement | null
  const offset = heading
    ? Number.parseFloat(window.getComputedStyle(heading).scrollMarginTop)
    : NaN

  headingScrollOffset = Number.isFinite(offset) ? offset : defaultHeadingScrollOffset
}

const updateReadingProgress = () => {
  const trackLength = document.documentElement.scrollHeight - window.innerHeight
  if (trackLength <= 0) {
    readingProgress.value = 0
    return
  }

  readingProgress.value = Math.min(100, Math.max(0, (window.scrollY / trackLength) * 100))
}

const updateActiveHeading = () => {
  if (!tocLinks.value.length || !headingElements.length) {
    activeHeadingId.value = ''
    return
  }

  activeHeadingId.value = getActiveWikiHeadingId(headingElements, headingScrollOffset)
}

const syncActiveToc = () => {
  const sidebar = tocSidebar.value
  if (!sidebar || !activeHeadingId.value || sidebar.clientHeight <= 0) return
  if (window.matchMedia('(max-width: 860px)').matches && !showToc.value) return
  const link = sidebar.querySelector<HTMLElement>('.toc-link.is-active')
  if (!link) return

  const bounds = sidebar.getBoundingClientRect()
  const top = getWikiTocScrollTop({
    top: bounds.top + sidebar.clientTop,
    height: sidebar.clientHeight,
    scrollTop: sidebar.scrollTop
  }, link.getBoundingClientRect())
  // Scroll only the directory; scrollIntoView would also move the article.
  if (Math.abs(sidebar.scrollTop - top) > 1) sidebar.scrollTop = top
}

watch([activeHeadingId, showToc, tocSidebar], syncActiveToc, { flush: 'post' })

const updateViewportState = () => {
  updateReadingProgress()
  updateActiveHeading()
}

const scheduleViewportSync = () => {
  if (viewportSyncFrame !== null) return

  viewportSyncFrame = window.requestAnimationFrame(() => {
    viewportSyncFrame = null
    updateViewportState()
  })
}

const clearViewportSyncFrame = () => {
  if (viewportSyncFrame === null) return

  window.cancelAnimationFrame(viewportSyncFrame)
  viewportSyncFrame = null
}

const buildTocFromDom = () => {
  const headings = Array.from(
    contentRoot.value?.querySelectorAll('h2, h3, h4, h5, h6') || []
  ) as HTMLElement[]

  headingElements = headings
  const result: TocDisplayLink[] = []
  const counters: number[] = []
  let previousTagLevel = 0
  let previousLogicalLevel = 1

  headings.forEach((heading) => {
    if (!heading.id) return

    const tagLevel = Number(heading.tagName.slice(1))
    if (!Number.isFinite(tagLevel)) return

    let logicalLevel = 1
    if (previousTagLevel === 0) {
      logicalLevel = 1
    } else if (tagLevel > previousTagLevel) {
      logicalLevel = Math.min(previousLogicalLevel + 1, 5)
    } else if (tagLevel === previousTagLevel) {
      logicalLevel = previousLogicalLevel
    } else {
      logicalLevel = Math.max(1, previousLogicalLevel - (previousTagLevel - tagLevel))
    }

    counters[logicalLevel - 1] = (counters[logicalLevel - 1] || 0) + 1
    counters.length = logicalLevel

    const cloned = heading.cloneNode(true) as HTMLElement
    cloned.querySelectorAll('.heading-number').forEach((node) => node.remove())

    result.push({
      id: heading.id,
      text: (cloned.textContent || '').trim(),
      depth: tagLevel,
      level: logicalLevel,
      number: counters.join('.')
    })

    previousTagLevel = tagLevel
    previousLogicalLevel = logicalLevel
  })

  tocLinks.value = result
}

const applyHeadingDecorations = () => {
  const headingMap = new Map(tocLinks.value.map((item) => [item.id, item.number]))

  headingElements.forEach((element) => {
    const number = headingMap.get(element.id)

    element.querySelector('.heading-number')?.remove()
    if (!number) return

    const numberSpan = document.createElement('span')
    numberSpan.className = 'heading-number'
    numberSpan.textContent = `${number} `
    numberSpan.setAttribute('aria-hidden', 'true')
    element.prepend(numberSpan)
  })
}

const enhanceCodeBlocks = () => {
  const codeBlocks = document.querySelectorAll('.wiki-content-body pre') as NodeListOf<HTMLElement>

  codeBlocks.forEach((block) => {
    if (block.querySelector('.code-toolbar')) return

    const code = block.querySelector('code')
    const classes = [
      ...Array.from(block.classList),
      ...(code ? Array.from(code.classList) : [])
    ]
    const langClass = classes.find((className) => className.startsWith('language-'))
    const language = langClass ? langClass.replace('language-', '').toUpperCase() : 'CODE'

    const toolbar = document.createElement('div')
    toolbar.className = 'code-toolbar'

    const langLabel = document.createElement('span')
    langLabel.className = 'code-language'
    langLabel.textContent = language
    toolbar.appendChild(langLabel)

    const copyButton = document.createElement('button')
    copyButton.className = 'code-copy-btn'
    copyButton.type = 'button'
    copyButton.textContent = '复制'

    copyButton.addEventListener('click', async () => {
      const text = code?.textContent || ''

      try {
        await navigator.clipboard.writeText(text)
        copyButton.textContent = '已复制'
        copyButton.classList.add('copied')
        setTimeout(() => {
          copyButton.textContent = '复制'
          copyButton.classList.remove('copied')
        }, 1800)
      } catch (error) {
        console.error('复制失败:', error)
      }
    })

    toolbar.appendChild(copyButton)
    block.insertBefore(toolbar, block.firstChild)
  })
}

const enhanceTables = () => {
  const tables = document.querySelectorAll('.wiki-content-body table') as NodeListOf<HTMLTableElement>

  tables.forEach((table) => {
    if (table.parentElement?.classList.contains('table-scroll')) return

    const wrapper = document.createElement('div')
    wrapper.className = 'table-scroll'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })
}

const initImageZoom = () => {
  if (zoomInstance) {
    zoomInstance.detach()
  }

  zoomInstance = mediumZoom('.wiki-content-body img', {
    margin: 24,
    background: 'rgba(0, 0, 0, 0.8)',
    scrollOffset: 0
  })
}

const getHeadingTargetTop = (id: string) => {
  const element = document.getElementById(id)
  if (!element) return null

  const top = element.getBoundingClientRect().top + window.scrollY - headingScrollOffset
  return Math.max(0, Math.min(top, document.documentElement.scrollHeight - window.innerHeight))
}

const clearImageLoadListeners = () => {
  imageLoadCleanupFns.forEach((fn) => fn())
  imageLoadCleanupFns.length = 0
}

const correctHeadingPosition = () => anchorScroller?.refresh()

const warmImagesBeforeHeading = (id: string) => {
  const heading = document.getElementById(id)
  if (!heading) return
  contentRoot.value?.querySelectorAll('img').forEach((image) => {
    // DOM order includes images directly before the heading even if collapsed
    // placeholders currently share its coordinates. No network timeout needed.
    if (image.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING) {
      image.loading = 'eager'
    }
  })
}

const highlightAnchor = (id: string) => {
  anchorHighlight?.cancel()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const heading = document.getElementById(id)
  if (!heading) return
  anchorHighlight = heading.animate([
    { backgroundColor: 'var(--wiki-accent-soft)', boxShadow: '0 0 0 8px var(--wiki-accent-soft)' },
    { backgroundColor: 'transparent', boxShadow: '0 0 0 0px transparent' }
  ], { duration: 1100, easing: 'ease-out' })
}

const decodeAnchorHash = (hash: string) => {
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
  if (!rawHash) return ''

  try {
    return decodeURIComponent(rawHash)
  } catch {
    return rawHash
  }
}

const updateUrlHash = (id: string) => {
  const nextHash = `#${encodeURIComponent(id)}`
  if (window.location.hash === nextHash) return

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${nextHash}`
  )
}

const navigateToHeading = (
  id: string,
  behavior: ScrollBehavior = 'smooth',
  shouldUpdateHash = false
) => {
  cancelPendingAnchorScroll()
  pendingAnchorId.value = id

  if (getHeadingTargetTop(id) === null) {
    pendingAnchorId.value = ''
    return false
  }

  if (shouldUpdateHash) updateUrlHash(id)
  let highlighted = false
  anchorScroller = createWikiAnchorScroller({
    target: () => getHeadingTargetTop(id),
    position: () => window.scrollY,
    // Explicit instant bypasses the site's global CSS scroll-behavior: smooth.
    write: top => window.scrollTo({ top, behavior: 'instant' }),
    requestFrame: callback => window.requestAnimationFrame(callback),
    cancelFrame: frame => window.cancelAnimationFrame(frame),
    reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onArrive: () => {
      updateViewportState()
      if (!highlighted) {
        highlighted = true
        if (behavior === 'smooth') highlightAnchor(id)
      }
    }
  })
  initialHashHandled = true
  warmImagesBeforeHeading(id)
  anchorScroller.refresh(behavior === 'smooth')

  return true
}

const scrollToCurrentHash = (behavior: ScrollBehavior = 'auto') => {
  const id = decodeAnchorHash(window.location.hash || route.hash)
  if (!id) return
  navigateToHeading(id, behavior)
}

const handleHashChange = () => {
  if (window.location.hash) scrollToCurrentHash('smooth')
  else cancelPendingAnchorScroll()
}

const cancelPendingAnchorScroll = () => {
  pendingAnchorId.value = ''
  anchorScroller?.cancel()
  anchorScroller = null
  anchorHighlight?.cancel()
}

const setupImageLoadReflowSync = () => {
  clearImageLoadListeners()

  const images = document.querySelectorAll('.wiki-content-body img') as NodeListOf<HTMLImageElement>
  images.forEach((image) => {
    if (image.complete) return

    const handleImageSettled = () => {
      scheduleViewportSync()
      if (pendingAnchorId.value) {
        correctHeadingPosition()
      }
    }

    image.addEventListener('load', handleImageSettled, { once: true })
    image.addEventListener('error', handleImageSettled, { once: true })
    imageLoadCleanupFns.push(() => {
      image.removeEventListener('load', handleImageSettled)
      image.removeEventListener('error', handleImageSettled)
    })
  })
}

const setupContentResizeSync = () => {
  contentResizeObserver?.disconnect()
  contentResizeObserver = null

  const content = document.querySelector('.wiki-content-body')
  if (!content) return

  contentResizeObserver = new ResizeObserver(() => {
    scheduleViewportSync()
    if (pendingAnchorId.value) {
      correctHeadingPosition()
    }
  })
  contentResizeObserver.observe(content)
}

const enhanceContent = () => {
  cancelPendingAnchorScroll()
  clearViewportSyncFrame()
  clearImageLoadListeners()
  syncHeadingScrollOffset()
  buildTocFromDom()
  enhanceCodeBlocks()
  enhanceTables()
  initImageZoom()
  applyHeadingDecorations()
  setupImageLoadReflowSync()
  setupContentResizeSync()
  updateViewportState()
}

const scrollToHeading = (id: string) => {
  const hasScrolled = navigateToHeading(id, 'smooth', true)
  if (!hasScrolled) {
    closeDrawers()
    return
  }

  closeDrawers()
}

const closeDrawers = () => {
  showDocNav.value = false
  showToc.value = false
}

const isCurrentPath = (path?: string) => normalizePath(path || '') === normalizePath(cleanPath.value)
const isTocActive = (id: string) => activeHeadingId.value === id

const handleWindowScroll = () => {
  scheduleViewportSync()
}

const handleWindowResize = () => {
  syncHeadingScrollOffset()
  syncActiveToc()
  scheduleViewportSync()
  if (pendingAnchorId.value) {
    correctHeadingPosition()
  }
}

watch(hasMobileDrawer, (isOpen) => {
  if (import.meta.client) {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    document.body.classList.toggle('wiki-drawer-open', isOpen)
  }
})

let initializedContent: HTMLElement | null = null
useWikiContentReady(contentRoot, () => {
  const restoreAnchor = pendingAnchorId.value
  const firstRender = initializedContent !== contentRoot.value
  initializedContent = contentRoot.value
  if (firstRender) initialHashHandled = false
  enhanceContent()
  if (restoreAnchor) navigateToHeading(restoreAnchor, 'auto')
  else if (!initialHashHandled) scrollToCurrentHash('auto')
})

watch(() => route.hash, (hash) => {
  if (!import.meta.client) return
  if (!hash) {
    cancelPendingAnchorScroll()
    return
  }

  const id = decodeAnchorHash(hash)
  if (id) {
    navigateToHeading(id, 'smooth')
  }
})

watch(cleanPath, () => {
  cancelPendingAnchorScroll()
  initialHashHandled = false
})

const handleAnchorInterruption = () => {
  initialHashHandled = true
  cancelPendingAnchorScroll()
}

const handleContentAnchorClick = (event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = (event.target as Element)?.closest('a')
  if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search || !url.hash) return
  if (navigateToHeading(decodeAnchorHash(url.hash), 'smooth', true)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
  window.addEventListener('resize', handleWindowResize, { passive: true })
  window.addEventListener('hashchange', handleHashChange)
  window.addEventListener('wheel', handleAnchorInterruption, { passive: true })
  window.addEventListener('touchstart', handleAnchorInterruption, { passive: true })
  window.addEventListener('keydown', handleAnchorInterruption)
  updateViewportState()
  scrollToCurrentHash('auto')
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('hashchange', handleHashChange)
  window.removeEventListener('wheel', handleAnchorInterruption)
  window.removeEventListener('touchstart', handleAnchorInterruption)
  window.removeEventListener('keydown', handleAnchorInterruption)
  cancelPendingAnchorScroll()
  clearViewportSyncFrame()
  clearImageLoadListeners()
  contentResizeObserver?.disconnect()
  contentResizeObserver = null
  document.body.style.overflow = ''
  document.body.classList.remove('wiki-drawer-open')

  if (zoomInstance) {
    zoomInstance.detach()
  }
})

function normalizePath(path: string) {
  return path.replace(/\/$/, '') || '/'
}
</script>

<template>
  <div class="wiki-doc-page">
    <div class="reading-progress-bar" :style="{ width: `${readingProgress}%` }" />

    <Transition name="fade">
      <button
        v-if="hasMobileDrawer"
        class="wiki-drawer-backdrop"
        aria-label="关闭导航"
        @click="closeDrawers"
      />
    </Transition>

    <div v-if="pending" class="loading-state">
      <div class="loading-spinner" />
      <p>加载中...</p>
    </div>

    <div v-else-if="page" class="wiki-shell">
      <aside
        v-if="docNavigationItems.length"
        class="wiki-doc-sidebar"
        :class="{ 'is-open': showDocNav }"
      >
        <div class="sidebar-header">
          <NuxtLink to="/wiki" class="sidebar-back">Wiki</NuxtLink>
          <button class="sidebar-close" type="button" @click="closeDrawers">关闭</button>
        </div>

        <NuxtLink :to="docIndex?.path || page.docRoot || '/wiki'" class="doc-title-link">
          {{ docTitle }}
        </NuxtLink>

        <nav class="doc-nav" aria-label="文档章节">
          <NuxtLink
            v-for="item in docNavigationItems"
            :key="item.path"
            :to="item.path"
            class="doc-nav-link"
            :class="{ 'is-active': isCurrentPath(item.path), 'is-index': item.isWikiIndex }"
            :style="{ '--doc-depth': String(item.chapterDepth || 0) }"
            @click="closeDrawers"
          >
            <span v-if="item.chapter" class="doc-nav-number">{{ item.chapter }}</span>
            <span>{{ item.isWikiIndex ? '首页' : item.title }}</span>
          </NuxtLink>
        </nav>
      </aside>

      <main class="wiki-main">
        <div class="mobile-actions">
          <button
            v-if="docNavigationItems.length"
            type="button"
            aria-label="打开章节目录"
            @click="showDocNav = true"
          >
            <span class="mobile-action-icon" aria-hidden="true">§</span>
            <span>章节</span>
          </button>
          <button
            type="button"
            aria-label="打开页内目录"
            :disabled="!tocLinks.length"
            @click="showToc = true"
          >
            <span class="mobile-action-icon" aria-hidden="true">#</span>
            <span>页内</span>
          </button>
        </div>

        <nav class="wiki-breadcrumb" aria-label="当前位置">
          <NuxtLink to="/wiki">Wiki</NuxtLink>
          <span>/</span>
          <NuxtLink v-if="docIndex" :to="docIndex.path">{{ docTitle }}</NuxtLink>
          <span v-else>{{ docTitle }}</span>
        </nav>

        <article class="wiki-article">
          <header class="wiki-article-header">
            <div v-if="currentChapter" class="chapter-kicker">
              第 {{ currentChapter }} 节
            </div>
            <h1>{{ page.title }}</h1>
            <div v-if="pageAuthorProfiles.length" class="wiki-authors" aria-label="文章作者">
              <span class="wiki-authors-label">作者：</span>
              <NuxtLink v-for="author in pageAuthorProfiles" :key="author.name" class="wiki-author" :to="author.href" :aria-label="`查看作者 ${author.name} 的资料`">
                <img :src="author.image" alt="" width="32" height="32" loading="lazy">
                <span>{{ author.name }}</span>
              </NuxtLink>
            </div>
          </header>

          <div ref="contentRoot" class="wiki-content-body" @click.capture="handleContentAnchorClick">
            <ContentRenderer :value="page" />
          </div>

          <footer v-if="previousPage || nextPage" class="wiki-page-navigation">
            <NuxtLink v-if="previousPage" :to="previousPage.path" class="page-nav-link page-nav-prev">
              <span class="page-nav-label">上一节</span>
              <span class="page-nav-title">
                {{ previousPage.chapter ? `${previousPage.chapter} ` : '' }}{{ previousPage.title }}
              </span>
            </NuxtLink>

            <NuxtLink v-if="nextPage" :to="nextPage.path" class="page-nav-link page-nav-next">
              <span class="page-nav-label">下一节</span>
              <span class="page-nav-title">
                {{ nextPage.chapter ? `${nextPage.chapter} ` : '' }}{{ nextPage.title }}
              </span>
            </NuxtLink>
          </footer>
        </article>
      </main>

      <aside
        v-if="tocLinks.length"
        ref="tocSidebar"
        class="wiki-toc-sidebar"
        :class="{ 'is-open': showToc }"
      >
        <div class="sidebar-header">
          <span class="toc-heading">本页目录</span>
          <button class="sidebar-close" type="button" @click="closeDrawers">关闭</button>
        </div>

        <nav class="toc-nav" aria-label="本页目录">
          <a
            v-for="link in tocLinks"
            :key="link.id"
            :href="`#${link.id}`"
            class="toc-link"
            :class="{ 'is-active': isTocActive(link.id) }"
            :aria-current="isTocActive(link.id) ? 'location' : undefined"
            :style="{ '--toc-level': String(link.level) }"
            @click.prevent="scrollToHeading(link.id)"
          >
            <span class="toc-number">{{ link.number }}</span>
            <span>{{ link.text }}</span>
          </a>
        </nav>
      </aside>
    </div>
  </div>
</template>
