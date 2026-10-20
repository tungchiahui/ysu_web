<script setup lang="ts">
import { site } from '~/data/site'
import { homePromoAutoplayMs, homePromoSlides } from '~/data/home-promos'

useHead({ title: site.fullName })

const featureSections = site.homeFeatures
const stats = site.overview
const heroVideo = ref<HTMLVideoElement | null>(null)
const isFilmPaused = ref(false)

const toggleFilm = async () => {
  const video = heroVideo.value
  if (!video) return
  if (!video.paused) video.pause()
  else
    await video.play().catch(() => {
      isFilmPaused.value = true
    })
}

onMounted(() => {
  const video = heroVideo.value
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) video?.pause()
  isFilmPaused.value = video?.paused ?? true
})
</script>

<template>
  <main class="home-page">
    <section class="home-hero">
      <div class="hero-content">
        <p class="eyebrow">{{ site.university }} · {{ site.college }}</p>
        <p class="hero-wordmark" aria-hidden="true">YAN YING / ROBOTICS</p>
        <h1>
          燕鹰<span>战队</span><i aria-hidden="true"><ArrowUpRight /></i>
        </h1>
        <p class="hero-statement">把想法，做成机器人。</p>
        <p class="hero-summary">{{ site.description }}</p>
        <div class="hero-actions" aria-label="常用链接">
          <NuxtLink class="button primary" to="/recruitment"
            >加入燕鹰 <span aria-hidden="true"><ArrowUpRight /></span
          ></NuxtLink>
          <NuxtLink class="button" to="/wiki"
            >探索知识库 <span aria-hidden="true">→</span></NuxtLink
          >
        </div>
        <div class="hero-socials" aria-label="关注战队">
          <a
            v-for="link in site.contacts.socials"
            :key="link.label"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            >{{ link.label }} <span aria-hidden="true"><ArrowUpRight /></span
          ></a>
        </div>
      </div>

      <figure class="hero-film">
        <div class="hero-film-frame">
          <video
            ref="heroVideo"
            class="hero-video"
            :src="site.heroMedia.video"
            :poster="site.heroMedia.poster"
            autoplay
            muted
            loop
            playsinline
            aria-label="RoboMaster 赛事影像"
            @play="isFilmPaused = false"
            @pause="isFilmPaused = true"
          />
          <div class="hero-film-shade" />
          <span class="hero-film-label">ENGINEER. BUILD. COMPETE.</span>
          <button
            class="hero-film-toggle"
            type="button"
            :aria-label="isFilmPaused ? '播放赛事影像' : '暂停赛事影像'"
            @click="toggleFilm"
          >
            <span aria-hidden="true">{{ isFilmPaused ? '▶' : 'Ⅱ' }}</span>
          </button>
          <div class="hero-film-caption">
            <span>从工作台，<br />走向真实赛场。</span
            ><span aria-hidden="true"><ArrowUpRight /></span>
          </div>
        </div>
        <figcaption>
          <span>01 / 赛场视角</span
          ><a
            :href="site.heroMedia.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            >{{ site.heroMedia.sourceLabel }} <ArrowUpRight
          /></a>
        </figcaption>
      </figure>
    </section>

    <section class="stats-band" aria-label="团队概览">
      <div v-for="stat in stats" :key="stat.label" class="stat-item">
        <strong>{{ stat.value }}</strong>
        <span>{{ stat.label }}</span>
      </div>
    </section>

    <div class="home-section-heading">
      <div>
        <p class="eyebrow">IN FOCUS / 战队切片</p>
        <h2>热爱，有迹可循。</h2>
      </div>
      <span class="section-aside">设计 · 实践 · 协作</span>
    </div>
    <HomePromoCarousel
      :slides="homePromoSlides"
      :autoplay-ms="homePromoAutoplayMs"
    />

    <div class="home-section-heading">
      <div>
        <p class="eyebrow">EXPLORE / 走近燕鹰</p>
        <h2>每一份积累，通向下一程。</h2>
      </div>
      <NuxtLink class="text-link" to="/team"
        >认识队员 <ArrowUpRight
      /></NuxtLink>
    </div>

    <section class="feature-stack" aria-label="首页内容">
      <article
        v-for="(section, index) in featureSections"
        :key="section.title"
        class="feature-row"
      >
        <NuxtLink
          class="feature-media"
          :to="section.href"
          :aria-label="section.cta"
        >
          <img :src="section.image" :alt="section.imageAlt" loading="lazy" />
          <span class="feature-number" aria-hidden="true">{{
            String(index + 1).padStart(2, '0')
          }}</span>
        </NuxtLink>

        <div class="feature-copy">
          <p class="eyebrow">{{ section.kicker }}</p>
          <h2>{{ section.title }}</h2>
          <p v-for="paragraph in section.text" :key="paragraph">
            {{ paragraph }}
          </p>
          <NuxtLink class="text-link" :to="section.href"
            >{{ section.cta }} <span aria-hidden="true"><ArrowUpRight /></span
          ></NuxtLink>
        </div>
      </article>
    </section>
  </main>
</template>
