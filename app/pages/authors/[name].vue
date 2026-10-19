<script setup lang="ts">
import { site } from '~/data/site'
import { wikiAuthorProfiles, wikiPagesByAuthor } from '~~/utils/wiki-authors.mjs'

definePageMeta({ key: route => route.path })
const route = useRoute()
const name = String(route.params.name || '')
const { data: pages } = await useAsyncData('wiki:author-pages', () =>
  queryCollection('wiki').select('path', 'title', 'authors', 'docRoot', 'docTitle', 'isWikiIndex').all()
)
const { data: members } = await useAsyncData('wiki:author-members', () =>
  queryCollection('members').select('name', 'image').all()
)
const articles = computed(() => wikiPagesByAuthor(pages.value || [], name))
const profile = computed(() => wikiAuthorProfiles([name], members.value, site.logo)[0])

if (!articles.value.length) {
  throw createError({ statusCode: 404, statusMessage: '作者不存在' })
}
useHead({ title: `${name} | ${site.shortName} Wiki 作者` })
</script>

<template>
  <main>
    <section class="page-hero wiki-hero wiki-author-hero">
      <img :src="profile.image" :alt="`${name} 头像`" width="96" height="96">
      <div>
        <p class="eyebrow">Wiki 作者</p>
        <h1>{{ name }}</h1>
        <p>共署名 {{ articles.length }} 篇教程与章节</p>
        <NuxtLink v-if="profile.href.startsWith('/team/')" :to="profile.href">查看成员资料</NuxtLink>
      </div>
    </section>
    <section class="wiki-section">
      <div class="section-heading"><h2>署名文章</h2></div>
      <ul class="wiki-author-articles">
        <li v-for="article in articles" :key="article.path">
          <NuxtLink :to="article.path">
            <span>{{ article.docTitle }}</span>
            <strong>{{ article.title }}</strong>
          </NuxtLink>
        </li>
      </ul>
      <NuxtLink to="/wiki">返回 Wiki 知识库</NuxtLink>
    </section>
  </main>
</template>
