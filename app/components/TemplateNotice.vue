<script setup lang="ts">
import { site } from '~/data/site'
</script>

<template>
  <aside v-if="site.templateMode" class="template-notice" aria-label="资料迁移说明">
    网站资料正在迁移，成员、Wiki、新闻、成绩、配图及招新联系方式暂沿用原站模板。
  </aside>
</template>
