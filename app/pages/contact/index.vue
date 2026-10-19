<script setup lang="ts">
import { site } from '~/data/site'
useHead({
  title: `联系 | ${site.fullName}`
})

const contactCards = [
  { title: '邮箱', value: site.contacts.email, text: '适合招新咨询、网站反馈等联系。', href: `mailto:${site.contacts.email}` },
  { title: '实验室地址', value: site.contacts.addressName, text: site.contacts.address, href: site.contacts.map },
  { title: '合作微信', value: site.contacts.wechat, text: '合作或赛事交流可通过微信沟通。', href: '' }
]
const socialLinks = site.contacts.socials
</script>

<template>
  <main>
    <section class="page-hero contact-hero">
      <div>
        <p class="eyebrow">Contact Us</p>
        <h1>联系我们</h1>
        <p>
          {{ site.fullName }}欢迎热爱机器人的同学加入，也欢迎企业、校内外团队与我们交流合作。
        </p>
      </div>
    </section>

    <section class="contact-overview">
      <div class="contact-lead">
        <p class="eyebrow">{{ site.englishName }}</p>
        <h2>找到我们，或者先发一封邮件</h2>
        <p>
          招新、合作、赛事交流和官网信息反馈入口汇总。现阶段联系方式沿用原站模板。
        </p>
        <div class="join-actions">
          <a class="action-button primary" :href="`mailto:${site.contacts.email}`">发送邮件</a>
          <a
            class="action-button"
            :href="site.contacts.map"
            target="_blank"
            rel="noopener noreferrer"
          >
            查看位置
          </a>
        </div>
      </div>

      <div class="contact-visual">
        <img src="/images/team/robot-collaboration.jpg" alt="燕鹰战队成员协作调试机器人">
      </div>
    </section>

    <section class="contact-card-grid" aria-label="联系方式">
      <article v-for="card in contactCards" :key="card.title" class="contact-card">
        <span>{{ card.title }}</span>
        <a
          v-if="card.href"
          :href="card.href"
          :target="card.href.startsWith('http') ? '_blank' : undefined"
          :rel="card.href.startsWith('http') ? 'noopener noreferrer' : undefined"
        >
          {{ card.value }}
        </a>
        <strong v-else>{{ card.value }}</strong>
        <p>{{ card.text }}</p>
      </article>
    </section>

    <section class="contact-section">
      <div class="section-heading">
        <p class="eyebrow">Online</p>
        <h2>线上入口</h2>
      </div>

      <div class="social-strip">
        <a
          v-for="link in socialLinks"
          :key="link.label"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ link.label }}
        </a>
      </div>
    </section>

    <section v-if="site.analytics.enabled" class="analytics-section">
      <div class="section-heading">
        <p class="eyebrow">网站数据</p>
        <h2>访问统计</h2>
      </div>

      <iframe
        class="analytics-frame"
        :src="site.analytics.share"
        loading="lazy"
        :title="`${site.shortName}网站统计（模板）`"
      />
    </section>
  </main>
</template>
