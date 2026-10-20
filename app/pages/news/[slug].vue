<script setup lang="ts">
import { site } from '~/data/site'
type NewsItem = Record<string, any>

const route = useRoute()
const slug = decodeURIComponent(String(route.params.slug ?? ''))
const newsPath = `/news/${slug}`

const { data: page } = await useAsyncData<NewsItem | null>(`news:${slug}`, () =>
  queryCollection('news').path(newsPath).first() as Promise<NewsItem | null>
)

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: '新闻不存在'
  })
}

useHead(() => ({
  title: `${page.value?.title || '新闻'} | ${site.shortName}`
}))

const formatDate = (value: unknown) => {
  const text = String(value ?? '')
  if (!text) return '未标注日期'

  return text.replace(/-/g, '.')
}

</script>

<template>
  <main v-if="page">
    <section class="page-hero news-hero">
      <div>
        <p class="eyebrow">{{ formatDate(page.date) }}</p>
        <h1>{{ page.title }}</h1>
        <p v-if="page.summary">{{ page.summary }}</p>
      </div>
    </section>

    <article class="news-detail">
      <div class="news-detail-meta">
        <span v-if="page.authors?.length">{{ page.authors.join('、') }}</span>
        <span>{{ formatDate(page.date) }}</span>
      </div>

      <div class="content-prose">
        <ContentRenderer :value="page" />
      </div>

      <NuxtLink class="text-link" to="/news">返回新闻列表</NuxtLink>
    </article>
  </main>
</template>
