<script setup lang="ts">
import { site } from '~/data/site'
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-invitation">
        <div>
          <p class="eyebrow">NEXT CHAPTER / 与燕鹰同行</p>
          <h2>下一台机器人，<br />等你一起完成。</h2>
        </div>
        <NuxtLink class="footer-join" to="/recruitment"
          >加入我们 <span aria-hidden="true"><ArrowUpRight /></span
        ></NuxtLink>
      </div>
      <div class="footer-main">
        <div class="footer-brand">
          <img :src="site.logo" :alt="site.logoAlt" />
          <div>
            <strong>{{ site.fullName }}</strong>
            <span>{{ site.university }} · {{ site.college }}</span>
          </div>
        </div>

        <div class="footer-links">
          <a :href="`mailto:${site.contacts.email}`">邮箱</a>
          <a
            v-for="link in site.contacts.socials"
            :key="link.label"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            >{{ link.label }}</a
          >
        </div>
      </div>

      <div class="footer-records">
        <span class="footer-copyright"
          >© {{ site.copyrightYear }} {{ site.fullName }}</span
        >
        <a
          v-for="record in site.records"
          :key="record.href"
          :href="record.href"
          target="_blank"
          rel="noopener noreferrer"
          >{{ record.label }}</a
        >
      </div>
    </div>
  </footer>
</template>
