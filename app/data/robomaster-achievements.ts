import achievements from '../../.content-data/achievements.json'

export type RoboMasterAchievement = {
  year: number
  items: string[]
}

// 来源及核实说明留在内容仓库，页面沿用年份与奖项的简洁展示。
export const robomasterAchievements: RoboMasterAchievement[] = achievements.records.map(({ year, items }) => ({
  year,
  items: items.map(({ title }) => title.replace('（机甲猎手）', ''))
}))

const recordedYears = robomasterAchievements.map(({ year }) => year)
export const robomasterAwardEntryCount = robomasterAchievements.reduce(
  (total, achievement) => total + achievement.items.length,
  0
)
export const robomasterYearRange = recordedYears.length
  ? `${Math.min(...recordedYears)}-${Math.max(...recordedYears)}`
  : '持续更新'
