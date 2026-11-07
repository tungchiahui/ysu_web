<script setup lang="ts">
import { site } from '~/data/site'
const route = useRoute()
const props = withDefaults(defineProps<{ refined?: boolean }>(), { refined: false })

type Theme = 'light' | 'dark'

const navItems = [
  { label: '首页', to: '/' },
  { label: '成果', to: '/research' },
  { label: '项目', to: '/projects' },
  { label: '成员', to: '/team' },
  { label: '看板', to: '/dashboard' },
  { label: '新闻', to: '/news' },
  { label: 'Wiki', to: '/wiki' },
  { label: '纳新', to: '/recruitment' },
  { label: '联系', to: '/contact' }
]

const theme = ref<Theme>('light')
const showMobileNav = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const menuNav = ref<HTMLElement | null>(null)
const themeButton = ref<HTMLButtonElement | null>(null)
const closeMenuOnResize = () => {
  if (window.innerWidth > (props.refined ? 1100 : 920)) closeMobileNav()
}
let previousOverflow = ''
const onMenuKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Tab' && showMobileNav.value) {
    const controls = [...(menuNav.value?.querySelectorAll<HTMLAnchorElement>('a[href]') || []), themeButton.value, menuButton.value].filter((item) => item !== null)
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  if (event.key === 'Escape' && showMobileNav.value) {
    closeMobileNav()
    menuButton.value?.focus()
  }
}
watch(showMobileNav, open => {
  if (!import.meta.client) return
  if (open) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void nextTick(() => menuNav.value?.querySelector<HTMLAnchorElement>('a[href]')?.focus())
  } else document.body.style.overflow = previousOverflow
})

const isActive = (to: string) => {
  if (to === '/') {
    return route.path === '/'
  }

  return route.path.startsWith(to)
}

const applyTheme = (nextTheme: Theme, persist = true) => {
  theme.value = nextTheme

  if (!import.meta.client) return

  document.documentElement.dataset.theme = nextTheme

  if (persist) {
    localStorage.setItem('ysu-theme', nextTheme)
  }
}

const preferredTheme = () => {
  if (!import.meta.client) return 'light'

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const toggleTheme = () => {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

const closeMobileNav = () => {
  showMobileNav.value = false
}

const toggleMobileNav = () => {
  showMobileNav.value = !showMobileNav.value
}

const themeLabel = computed(() => theme.value === 'dark' ? '切换浅色模式' : '切换深色模式')
const mobileNavLabel = computed(() => showMobileNav.value ? '关闭导航菜单' : '打开导航菜单')

watch(() => route.fullPath, () => {
  closeMobileNav()
})

onMounted(() => {
  document.addEventListener('keydown', onMenuKeydown)
  window.addEventListener('resize', closeMenuOnResize, { passive: true })
  const storedTheme = localStorage.getItem('ysu-theme')
  applyTheme(storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : preferredTheme(), Boolean(storedTheme))
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onMenuKeydown)
  window.removeEventListener('resize', closeMenuOnResize)
  if (showMobileNav.value) document.body.style.overflow = previousOverflow
})
</script>

<template>
  <header class="site-header" :class="{ 'refined-header': refined }">
    <NuxtLink class="brand" to="/" aria-label="返回首页">
      <img class="brand-logo" :src="site.logo" :alt="site.logoAlt">
      <span class="brand-copy">
        <span class="brand-title">{{ refined ? site.shortName : site.headerName }}</span>
        <span class="brand-subtitle"><template v-if="refined"><span>{{ site.university }}</span><span class="brand-college"> · {{ site.college }}</span></template><template v-else>{{ site.tagline }}</template></span>
      </span>
    </NuxtLink>

    <div class="header-actions">
      <button
        v-if="showMobileNav"
        class="mobile-nav-backdrop"
        type="button"
        aria-label="关闭导航"
        @click="closeMobileNav"
      />

      <nav
        ref="menuNav"
        id="site-navigation"
        class="site-nav"
        :class="{ 'is-open': showMobileNav }"
        aria-label="主导航"
      >
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          class="nav-link"
          :class="{ active: isActive(item.to) }"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          :to="item.to"
          @click="closeMobileNav"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <button
        ref="themeButton"
        class="theme-toggle"
        type="button"
        :aria-label="themeLabel"
        :title="themeLabel"
        @click="toggleTheme"
      >
        <span class="theme-toggle-icon" aria-hidden="true">
          <svg v-if="refined && theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
          <svg v-else-if="refined" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" /></svg>
          <span v-else>{{ theme === 'dark' ? '☀' : '☾' }}</span>
        </span>
        <span class="visually-hidden">{{ themeLabel }}</span>
      </button>

      <button
        ref="menuButton"
        class="nav-toggle"
        :class="{ 'is-open': showMobileNav }"
        type="button"
        :aria-expanded="showMobileNav"
        aria-controls="site-navigation"
        :aria-label="mobileNavLabel"
        :title="mobileNavLabel"
        @click="toggleMobileNav"
      >
        <span class="nav-toggle-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span class="visually-hidden">{{ mobileNavLabel }}</span>
      </button>
    </div>
  </header>
</template>
