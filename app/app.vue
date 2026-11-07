<script setup lang="ts">
const route = useRoute()
const editorialPreview = computed(() => !/^\/dashboard(?:\/|$)/.test(route.path))
</script>

<template>
  <div class="site-shell" :class="{ 'editorial-shell': editorialPreview }">
    <SiteHeader :refined="editorialPreview" />
    <NuxtPage />
    <SiteFooter :refined="editorialPreview" />
  </div>
</template>
