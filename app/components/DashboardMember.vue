<script setup lang="ts">
import { NuxtLink } from '#components'
import type { DashboardPerson } from '~/utils/dashboard'
defineProps<{ person: DashboardPerson; profile: { href: string; image: string } }>()
</script>

<template>
  <component :is="profile.href ? NuxtLink : 'span'" class="dashboard-person" :to="profile.href || undefined" :title="profile.href ? `查看${person.name}的成员介绍` : undefined">
    <img v-if="person.avatar || profile.image" :src="person.avatar || profile.image" alt="" loading="lazy" referrerpolicy="no-referrer">
    <span v-else class="dashboard-avatar" aria-hidden="true">{{ person.name.slice(0, 1) }}</span>
    <span>{{ person.name }}</span>
  </component>
</template>
