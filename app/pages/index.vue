<script setup lang="ts">
import { site } from '~/data/site'
import { homePromoAutoplayMs, homePromoSlides } from '~/data/home-promos'

useHead({ title: site.fullName })

const heroLinks = [
  { label: '战队微博', href: site.weibo, external: true },
  ...site.contacts.socials.map(link => ({ ...link, external: true })),
  { label: '加入我们', href: '/recruitment', external: false }
]
const featureSections = site.homeFeatures
const stats = site.overview
</script>

<template>
  <main>
    <section class="home-hero">
      <video
        class="hero-video"
        src="/images/backgroundvideo.mp4"
        poster="/images/background.jpg"
        autoplay
        muted
        loop
        playsinline
      />
      <div class="hero-shade" />

      <div class="hero-content">
        <p class="eyebrow">{{ site.university }} · {{ site.college }}</p>
        <h1>{{ site.shortName }}</h1>
        <p class="hero-summary">
          {{ site.description }}
        </p>
        <a class="hero-source" :href="site.introSources[0].url" target="_blank" rel="noopener noreferrer">简介参考：燕山大学官方介绍 ↗</a>

        <div class="hero-actions" aria-label="常用链接">
          <a
            v-for="link in heroLinks"
            :key="link.label"
            class="button"
            :class="{ primary: link.label === '加入我们' }"
            :href="link.href"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noopener noreferrer' : undefined"
          >
            {{ link.label }}
          </a>
        </div>
      </div>
    </section>

    <section class="stats-band" aria-label="团队概览">
      <div v-for="stat in stats" :key="stat.label" class="stat-item">
        <strong>{{ stat.value }}</strong>
        <span>{{ stat.label }}</span>
      </div>
    </section>

    <HomePromoCarousel :slides="homePromoSlides" :autoplay-ms="homePromoAutoplayMs" />

    <section class="feature-stack" aria-label="首页内容">
      <article
        v-for="(section, index) in featureSections"
        :key="section.title"
        class="feature-row"
        :class="{ reversed: index % 2 === 1 }"
      >
        <div class="feature-media">
          <img :src="section.image" :alt="section.imageAlt">
        </div>

        <div class="feature-copy">
          <p class="eyebrow">{{ section.kicker }}</p>
          <h2>{{ section.title }}</h2>
          <p v-for="paragraph in section.text" :key="paragraph">
            {{ paragraph }}
          </p>
          <a class="text-link" :href="section.href">{{ section.cta }}</a>
        </div>
      </article>
    </section>
  </main>
</template>
