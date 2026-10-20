<script setup lang="ts">
import { site } from '~/data/site'
import {
  robomasterAchievements,
  robomasterAwardEntryCount,
  robomasterYearRange
} from '~/data/robomaster-achievements'

useHead({
  title: `成果 | ${site.fullName}`
})

const highlights = [
  { value: robomasterYearRange, label: '历年赛事记录' },
  { value: String(robomasterAwardEntryCount), label: '获奖记录' },
  { value: 'RoboMaster', label: '核心赛事方向' }
]
</script>

<template>
  <main>
    <section class="page-hero research-hero">
      <div>
        <p class="eyebrow">多方面综合发展</p>
        <h1>我们的成果</h1>
        <p>
          燕鹰战队 RoboMaster 历年比赛成绩。
        </p>
      </div>
    </section>

    <section class="stats-band research-stats" aria-label="成果概览">
      <div v-for="item in highlights" :key="item.label" class="stat-item">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
    </section>

    <section class="achievement-section">
      <div class="section-heading">
        <p class="eyebrow">历史成绩</p>
        <h2>RoboMaster 赛场记录</h2>
      </div>

      <div class="achievement-timeline">
        <article v-for="achievement in robomasterAchievements" :key="achievement.year" class="achievement-card">
          <div class="achievement-year">{{ achievement.year }}</div>
          <ul>
            <li v-for="item in achievement.items" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>
    </section>
  </main>
</template>
