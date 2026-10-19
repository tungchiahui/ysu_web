<script setup lang="ts">
import { site } from '~/data/site'
import { memberGroups, memberLinks, memberRoleText, memberSeasonText, memberSeasons, seasonRoleText, type Member } from '~/utils/members'

const route = useRoute()
const slug = String(route.params.slug || '')
const { data: member } = await useAsyncData(`members:${slug}`, () =>
  queryCollection('members').where('name', '=', slug).first() as Promise<Member | null>)
if (!member.value) throw createError({ statusCode: 404, statusMessage: '成员不存在' })
const { data: rawMembers } = await useAsyncData('members:related', () => queryCollection('members').all() as Promise<Member[]>)
useHead(() => ({ title: `${member.value?.name || '成员'} | ${site.shortName}` }))
const externalLinks = computed(() => member.value ? memberLinks(member.value) : [])
const currentSeasons = computed(() => member.value ? memberSeasons(member.value) : [])
const relatedMembers = computed(() => {
  const current = member.value
  if (!current) return []
  const years = new Set(current.seasons.map(item => item.year))
  const groups = new Set(memberGroups(current))
  return [...(rawMembers.value || [])].filter(item => item.name !== current.name && item.kind === current.kind)
    .map(item => ({ item, score: (item.seasons.some(record => years.has(record.year)) ? 2 : 0) + (memberGroups(item).some(group => groups.has(group)) ? 1 : 0) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, 'zh-CN'))
    .slice(0, 3).map(item => item.item)
})
</script>

<template>
  <main v-if="member">
    <section class="member-profile-hero">
      <div class="member-profile-photo"><img :src="member.image || site.logo" :alt="`${member.name} 头像`"></div>
      <div class="member-profile-copy">
        <p class="eyebrow">{{ member.kind === 'teacher' ? '指导老师' : memberGroups(member).join('、') }}</p>
        <h1>{{ member.name }}</h1>
        <p class="profile-role">{{ memberRoleText(member) }}</p>
        <div class="profile-tags">
          <span>{{ member.university }}</span><span>{{ member.affiliation }}</span>
          <span v-if="member.kind === 'student' && member.grade">{{ member.grade }} 级</span>
          <span v-if="member.kind === 'teacher'">{{ memberSeasonText(member) }}</span>
          <span v-if="member.department">{{ member.department }}</span>
          <span v-for="title in member.titles || []" :key="title">{{ title }}</span>
        </div>
        <ul v-if="member.kind === 'student'" class="profile-lines" aria-label="赛季任职">
          <li v-for="record in currentSeasons" :key="record.year">{{ record.year }} 赛季 · {{ seasonRoleText(record) }}</li>
        </ul>
        <div v-if="externalLinks.length" class="profile-links">
          <a v-for="link in externalLinks" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
        </div>
      </div>
    </section>
    <section class="member-profile-content" :class="{ 'no-related': !relatedMembers.length }">
      <article class="member-prose"><ContentRenderer :value="member" /></article>
      <aside v-if="relatedMembers.length" class="related-members">
        <div class="section-heading compact"><p class="eyebrow">Related</p><h2>相关成员</h2></div>
        <div class="related-member-list"><MemberCard v-for="item in relatedMembers" :key="item.name" :member="item" compact /></div>
      </aside>
    </section>
  </main>
</template>
