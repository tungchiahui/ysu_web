<script setup lang="ts">
import { site } from '~/data/site'
import { homePromoSlides } from '~/data/home-promos'

useHead({ title: site.fullName })
const heroVideo = ref<HTMLVideoElement | null>(null)
const featureSections = site.homeFeatures
let motionPreference: MediaQueryList | undefined
const syncMotion = () => {
  const video = heroVideo.value
  if (!video) return
  if (motionPreference?.matches) video.pause()
  else void video.play().catch(() => {})
}
onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', syncMotion)
  syncMotion()
})
onBeforeUnmount(() => motionPreference?.removeEventListener('change', syncMotion))
</script>

<template>
  <main class="home-frontpage">
    <section class="home-hero home-hero-wide" aria-labelledby="home-title">
      <video ref="heroVideo" class="hero-video" :src="site.heroMedia.video" :poster="site.heroMedia.poster" autoplay muted loop playsinline preload="metadata" aria-label="RoboMaster 赛事影像" />
      <div class="hero-shade" />
      <div class="hero-content">
        <h1 id="home-title">{{ site.shortName }}</h1>
        <p class="home-school">{{ site.university }} · {{ site.college }}</p>
        <p class="hero-summary">{{ site.description }}</p>
        <div class="editorial-actions">
          <NuxtLink class="editorial-action primary" to="/recruitment">加入我们 <EditorialArrow /></NuxtLink>
          <NuxtLink class="editorial-action secondary" to="/projects">查看项目 <EditorialArrow /></NuxtLink>
        </div>
        <nav class="home-socials" aria-label="社交平台">
          <a v-for="link in site.contacts.socials" :key="link.label" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}<span class="visually-hidden">（新窗口打开）</span></a>
        </nav>
      </div>
    </section>
    <dl class="home-overview editorial-wrap" aria-label="团队概览">
      <div v-for="fact in site.overview" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div>
    </dl>

    <section class="home-stories-section editorial-wrap" aria-labelledby="home-stories-title">
      <div class="editorial-section-heading"><h2 id="home-stories-title">赛场与团队</h2><span>燕鹰战队</span></div>
      <div class="home-stories">
        <article v-for="(slide, index) in homePromoSlides" :key="slide.href" class="home-story" :class="{ 'home-story-lead': index === 0 }">
          <NuxtLink class="home-story-link" :to="slide.href">
            <div class="home-story-media"><img :src="slide.image" :alt="slide.imageAlt" :style="{ objectPosition: slide.position }" width="1620" height="1080" loading="lazy"></div>
            <div class="home-story-copy"><h3>{{ slide.title }}</h3><p>{{ slide.summary }}</p><span class="editorial-link">{{ slide.cta }} <EditorialArrow /></span></div>
          </NuxtLink>
        </article>
      </div>
    </section>

    <section class="home-features-section editorial-wrap" aria-labelledby="home-features-title">
      <div class="editorial-section-heading"><h2 id="home-features-title">在燕鹰</h2><span>学习、实践与记录</span></div>
      <div class="home-feature-grid">
        <article v-for="(section, index) in featureSections" :key="section.title" class="home-feature" :class="{ 'home-feature-wide': index < 2, 'home-feature-reverse': index === 1, 'home-feature-brief': index >= 4 }">
          <NuxtLink class="home-feature-media" :to="section.href" :aria-label="section.cta"><img :src="section.image" :alt="section.imageAlt" width="1620" height="1080" loading="lazy"></NuxtLink>
          <div class="home-feature-copy"><h3>{{ section.title }}</h3><p v-for="paragraph in section.text" :key="paragraph">{{ paragraph }}</p><NuxtLink class="editorial-link" :to="section.href">{{ section.cta }} <EditorialArrow /></NuxtLink></div>
        </article>
      </div>
    </section>
  </main>
</template>
