<script setup lang="ts">
import { site } from '~/data/site'
const route = useRoute()

type Theme = 'light' | 'dark'

const navItems = [
  { label: '首页', to: '/' },
  { label: '成果', to: '/research' },
  { label: '项目', to: '/projects' },
  { label: '成员', to: '/team' },
  { label: '新闻', to: '/news' },
  { label: 'Wiki', to: '/wiki' },
  { label: '纳新', to: '/recruitment' },
  { label: '联系', to: '/contact' }
]

const theme = ref<Theme>('light')
const showMobileNav = ref(false)
const navToggle = ref<HTMLButtonElement | null>(null)

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

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
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

const dismissMobileNav = () => {
  if (!showMobileNav.value) return
  closeMobileNav()
  navToggle.value?.focus()
}

const themeLabel = computed(() =>
  theme.value === 'dark' ? '切换浅色模式' : '切换深色模式'
)
const mobileNavLabel = computed(() =>
  showMobileNav.value ? '关闭导航菜单' : '打开导航菜单'
)

watch(
  () => route.fullPath,
  () => {
    closeMobileNav()
  }
)

onMounted(() => {
  const storedTheme = localStorage.getItem('ysu-theme')
  applyTheme(
    storedTheme === 'light' || storedTheme === 'dark'
      ? storedTheme
      : preferredTheme(),
    Boolean(storedTheme)
  )
})
</script>

<template>
  <header class="site-header" @keydown.esc="dismissMobileNav">
    <NuxtLink class="brand" to="/" aria-label="返回首页">
      <img class="brand-logo" :src="site.logo" :alt="site.logoAlt" />
      <span class="brand-copy">
        <span class="brand-title">{{ site.headerName }}</span>
        <span class="brand-subtitle">YAN YING / ROBOTICS</span>
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
        id="site-navigation"
        class="site-nav"
        :class="{ 'is-open': showMobileNav }"
        aria-label="主导航"
      >
        <NuxtLink
          v-for="(item, index) in navItems"
          :key="item.to"
          class="nav-link"
          :class="{ active: isActive(item.to) }"
          :to="item.to"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          @click="closeMobileNav"
        >
          <span class="nav-number" aria-hidden="true">{{
            String(index + 1).padStart(2, '0')
          }}</span
          >{{ item.label }}
        </NuxtLink>
      </nav>

      <button
        class="theme-toggle"
        type="button"
        :aria-label="themeLabel"
        :title="themeLabel"
        @click="toggleTheme"
      >
        <svg
          class="theme-toggle-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <template v-if="theme === 'dark'">
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"
            />
          </template>
          <path v-else d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z" />
        </svg>
        <span class="visually-hidden">{{ themeLabel }}</span>
      </button>

      <button
        ref="navToggle"
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
