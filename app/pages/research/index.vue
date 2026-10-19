<script setup lang="ts">
import { site } from '~/data/site'
import {
  robomasterAchievements,
  robomasterAwardEntryCount,
  robomasterRecordedYearCount,
  robomasterFirstSeason,
  robomasterFirstSeasonSource,
  robomasterOfficialIndex,
  robomasterCoverageNote,
  robomasterCheckedOn
} from '~/data/robomaster-achievements'

useHead({
  title: `成果 | ${site.fullName}`
})

const highlights = [
  { value: String(robomasterFirstSeason), label: '首次参加 RoboMaster' },
  { value: String(robomasterAwardEntryCount), label: `${robomasterRecordedYearCount} 个已核实赛季的获奖记录` },
  { value: site.primaryCompetition, label: '核心赛事方向' }
]
</script>

<template>
  <main>
    <section class="page-hero research-hero">
      <div>
        <p class="eyebrow">RoboMaster · 赛事成果</p>
        <h1>我们的成果</h1>
        <p>
          从机器人研发到赛场协作，记录燕山大学在 RoboMaster 机甲大师赛中的历年成果。
        </p>
        <a class="achievement-index-link" :href="robomasterOfficialIndex" target="_blank" rel="noopener noreferrer">查看 RoboMaster 官方公告</a>
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

      <p class="achievement-coverage">{{ robomasterCoverageNote }}</p>

      <div class="achievement-timeline">
        <article v-for="achievement in robomasterAchievements" :key="achievement.year" class="achievement-card">
          <div class="achievement-year">{{ achievement.year }}</div>
          <p v-if="achievement.note" class="achievement-note">{{ achievement.note }}</p>
          <ul>
            <li v-for="item in achievement.items" :key="item.title">
              <span>{{ item.title }}</span>
              <a class="achievement-source" :href="item.source.url" :title="item.source.title" :aria-label="`查看${achievement.year}年${item.title}的官方来源`" target="_blank" rel="noopener noreferrer">官方来源 ↗</a>
            </li>
          </ul>
        </article>
      </div>
      <p class="achievement-coverage achievement-footnote">
        首次参赛年份依据<a :href="robomasterFirstSeasonSource.url" target="_blank" rel="noopener noreferrer">燕山大学官方报道</a>。
        资料核实日期：{{ robomasterCheckedOn }}。
      </p>
    </section>
  </main>
</template>
