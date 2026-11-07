<script setup lang="ts">
import { site } from '~/data/site'
withDefaults(defineProps<{ refined?: boolean }>(), { refined: false })
</script>

<template>
  <footer v-if="refined" class="refined-footer">
    <div class="refined-footer-inner">
      <div class="refined-footer-main">
        <div class="refined-footer-identity">
          <NuxtLink class="refined-footer-brand" to="/" aria-label="燕鹰战队，返回首页"><img :src="site.logo" :alt="site.logoAlt" width="64" height="64"><span>{{ site.shortName }}</span></NuxtLink>
          <p class="refined-footer-affiliation">{{ site.university }} · {{ site.college }}</p>
          <p class="refined-footer-motto">{{ site.tagline }}</p>
        </div>
        <nav class="refined-footer-nav" aria-label="战队导航"><h2>战队</h2><NuxtLink to="/research">赛事成果</NuxtLink><NuxtLink to="/projects">研发项目</NuxtLink><NuxtLink to="/team">团队成员</NuxtLink><NuxtLink to="/news">新闻动态</NuxtLink></nav>
        <nav class="refined-footer-nav" aria-label="学习与协作"><h2>学习与协作</h2><NuxtLink to="/wiki">Wiki 知识库</NuxtLink><NuxtLink to="/dashboard">任务看板</NuxtLink><NuxtLink to="/recruitment">加入我们</NuxtLink></nav>
        <div class="refined-footer-contact"><h2>保持联系</h2><a class="refined-footer-email" :href="`mailto:${site.contacts.email}`">{{ site.contacts.email }}</a><nav aria-label="战队社交平台"><a v-for="link in site.contacts.socials" :key="link.label" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}<span class="visually-hidden">（新窗口打开）</span></a></nav><NuxtLink class="refined-footer-contact-link" to="/contact">联系方式 <EditorialArrow /></NuxtLink></div>
      </div>
      <div class="refined-footer-bottom"><span>© {{ site.copyrightYear }} {{ site.fullName }}</span><div v-if="site.records.length" class="refined-footer-records"><a v-for="record in site.records" :key="record.href" :href="record.href" target="_blank" rel="noopener noreferrer">{{ record.label }}</a></div></div>
    </div>
  </footer>
  <footer v-else class="site-footer">
    <div class="footer-inner">
      <div class="footer-main">
        <div class="footer-brand">
          <img :src="site.logo" :alt="site.logoAlt">
          <div>
            <strong>{{ site.fullName }}</strong>
            <span>{{ site.university }} · {{ site.college }}</span>
          </div>
        </div>

        <div class="footer-links">
          <a :href="`mailto:${site.contacts.email}`">邮箱</a>
          <a v-for="link in site.contacts.socials" :key="link.label" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
        </div>
      </div>

      <div class="footer-records">
        <span class="footer-copyright">© {{ site.copyrightYear }} {{ site.fullName }}</span>
        <a v-for="record in site.records" :key="record.href" :href="record.href" target="_blank" rel="noopener noreferrer">{{ record.label }}</a>
      </div>
    </div>
  </footer>
</template>
