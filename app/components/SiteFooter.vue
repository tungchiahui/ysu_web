<script setup lang="ts">
import { site } from '~/data/site'
</script>

<template>
  <footer class="site-footer">
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
          <a :href="site.weibo" target="_blank" rel="noopener noreferrer">战队微博</a>
        </div>
      </div>

      <div class="footer-records">
        <span class="footer-copyright">© {{ site.copyrightYear }} {{ site.fullName }}</span>
        <a v-for="record in site.records" :key="record.href" :href="record.href" target="_blank" rel="noopener noreferrer">{{ record.label }}</a>
      </div>
    </div>
  </footer>
</template>
