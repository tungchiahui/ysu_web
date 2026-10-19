<script setup lang="ts">
import { site } from '~/data/site'
import {
  roboconAchievements,
  roboconAwardEntryCount,
  roboconYearRange
} from '~/data/robocon-achievements'

useHead({
  title: `成果 | ${site.fullName}`
})

const highlights = [
  { value: roboconYearRange, label: '连续沉淀的赛事记录' },
  { value: String(roboconAwardEntryCount), label: '公开展示奖项条目' },
  { value: 'Robocon', label: '核心赛事方向' }
]
</script>

<template>
  <main>
    <section class="page-hero research-hero">
      <div>
        <p class="eyebrow">多方面综合发展</p>
        <h1>{{ site.templateMode ? '成果展示模板' : '我们的成果' }}</h1>
        <p>
          现阶段保留原站赛事成绩作为展示模板，燕鹰战队的正式成果将陆续整理。
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
        <h2>Robocon 赛场记录</h2>
      </div>

      <div class="achievement-timeline">
        <article v-for="achievement in roboconAchievements" :key="achievement.year" class="achievement-card">
          <div class="achievement-year">{{ achievement.year }}</div>
          <ul>
            <li v-for="item in achievement.items" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>
    </section>
  </main>
</template>
