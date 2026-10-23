<script setup lang="ts">
import { NuxtLink } from '#components'
import type { DashboardDevelopment } from '~/utils/dashboard'
const props = defineProps<{ person: DashboardDevelopment['contributors'][number]; profile: { href: string; image: string } }>()
const failedAvatar = ref('')
const avatar = computed(() => props.person.avatar || props.profile.image)
const external = computed(() => !props.profile.href && Boolean(props.person.href))
</script>

<template>
  <component :is="profile.href ? NuxtLink : person.href ? 'a' : 'span'" class="dashboard-code-person"
    :to="profile.href || undefined" :href="external ? person.href : undefined" :target="external ? '_blank' : undefined" :rel="external ? 'noopener noreferrer' : undefined">
    <img v-if="avatar && failedAvatar !== avatar" :src="avatar" alt="" loading="lazy" referrerpolicy="no-referrer" @error="failedAvatar = avatar">
    <span v-else class="dashboard-avatar" aria-hidden="true">{{ person.name.slice(0, 1) }}</span>
    <span class="dashboard-code-person-name">{{ person.name }}</span>
    <strong :aria-label="`${person.count} 次提交`">{{ person.count }}</strong>
  </component>
</template>
