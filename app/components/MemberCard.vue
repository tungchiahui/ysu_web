<script setup lang="ts">
import { site } from '~/data/site'
import { memberLinks, memberRoleText, memberSeasonText, type Member } from '~/utils/members'

const props = withDefaults(defineProps<{ member: Member; compact?: boolean; directory?: boolean; season?: string }>(), { season: 'all' })
const externalLinks = computed(() => memberLinks(props.member))
const memberPath = computed(() => `/team/${encodeURIComponent(props.member.name)}`)
const infoRows = computed(() => [
  { label: '职务', value: memberRoleText(props.member, props.season) },
  { label: '学院', value: props.member.affiliation },
  { label: '部门', value: props.member.department },
  { label: '头衔', value: props.member.titles?.join('、') },
  { label: '赛季', value: memberSeasonText(props.member, props.season) },
  { label: '年级', value: props.member.kind === 'student' && props.member.grade ? `${props.member.grade} 级` : '' }
].filter(item => item.value))
</script>

<template>
  <article v-if="directory" class="roster-person">
    <NuxtLink class="roster-person-main" :to="memberPath">
      <div class="roster-photo" :class="{ 'is-default': !member.image }"><img :src="member.image || site.logo" :alt="`${member.name} 头像`" width="144" height="144" loading="lazy"></div>
      <div class="roster-person-copy"><h3>{{ member.name }}</h3><p class="roster-role">{{ memberRoleText(member, season) }}</p><dl class="roster-person-details"><div v-for="row in infoRows.filter(item => item.label !== '职务')" :key="row.label" :class="{ 'roster-detail-wide': row.label === '头衔' }"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl></div>
    </NuxtLink>
    <nav v-if="externalLinks.length" class="roster-person-links" :aria-label="`${member.name} 的个人链接`"><a v-for="link in externalLinks" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}<span class="visually-hidden">（新窗口打开）</span></a></nav>
  </article>
  <article v-else class="member-card" :class="{ compact }">
    <NuxtLink class="member-card-main" :to="memberPath">
      <div class="member-photo"><img :src="member.image || site.logo" :alt="`${member.name} 头像`" loading="lazy"></div>
      <div class="member-card-body">
        <div class="member-card-head"><h3>{{ member.name }}</h3></div>
        <div class="member-info-list">
          <div v-for="row in infoRows" :key="row.label" class="member-info-row"><span>{{ row.label }}</span><strong>{{ row.value }}</strong></div>
        </div>
      </div>
    </NuxtLink>
    <div v-if="externalLinks.length && !compact" class="member-card-links">
      <a v-for="link in externalLinks" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
    </div>
  </article>
</template>
