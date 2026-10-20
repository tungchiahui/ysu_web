<script setup lang="ts">
import { site } from '~/data/site'
type NewsItem = Record<string, any>

useHead({
  title: `新闻 | ${site.fullName}`
})

const { data: rawNews } = await useAsyncData<NewsItem[]>('news:list', () =>
  queryCollection('news').all() as Promise<NewsItem[]>
)

const newsList = computed(() =>
  [...(rawNews.value ?? [])].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
)

const formatDate = (value: unknown) => {
  const text = String(value ?? '')
  if (!text) return '未标注日期'

  return text.replace(/-/g, '.')
}

const stats = computed(() => [
  { value: newsList.value.length, label: '新闻记录' },
  { value: newsList.value[0]?.date ? formatDate(newsList.value[0].date) : '持续更新', label: '最近更新' },
  { value: site.primaryCompetition, label: '赛事方向' }
])
</script>

<template>
  <main>
    <section class="page-hero news-hero">
      <div>
        <p class="eyebrow">Newsroom</p>
        <h1>新闻动态</h1>
        <p>
          记录燕鹰战队的赛事进展、校内活动与新闻公告。
        </p>
      </div>
    </section>

    <section class="stats-band research-stats" aria-label="新闻概览">
      <div v-for="item in stats" :key="item.label" class="stat-item">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
    </section>

    <section class="news-section">
      <div class="section-heading">
        <p class="eyebrow">Latest</p>
        <h2>最新记录</h2>
      </div>

      <div v-if="newsList.length" class="news-list">
        <article v-for="item in newsList" :key="item.path" class="news-card">
          <NuxtLink class="news-card-main" :to="item.path">
            <span v-if="item.image" class="news-card-media">
              <img :src="item.image" :alt="item.title" loading="lazy">
            </span>
            <span class="news-card-copy">
              <span class="news-date">{{ formatDate(item.date) }}</span>
              <span v-if="item.authors?.length" class="news-date">{{ item.authors.join('、') }}</span>
              <h3>{{ item.title }}</h3>
              <span class="news-card-summary">{{ item.summary || item.description || '查看完整新闻内容。' }}</span>
            </span>
          </NuxtLink>

        </article>
      </div>

      <div v-else class="empty-state">还没有新闻内容。</div>
    </section>
  </main>
</template>
