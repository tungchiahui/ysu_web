<script setup lang="ts">
import { site } from '~/data/site'
useHead({
  title: `项目 | ${site.fullName}`
})
</script>

<template>
  <main>
    <section class="page-hero projects-hero">
      <div>
        <p class="eyebrow">Projects</p>
        <h1>项目</h1>
        <p>项目页面内容正在整理。</p>
      </div>
    </section>
    <section class="project-scene" aria-label="机器人研发现场"><img src="/images/team/robot-workbench.jpg" alt="燕鹰战队队员在工作区调试机器人" width="1620" height="1080"></section>
  </main>
</template>
