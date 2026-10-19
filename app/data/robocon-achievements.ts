import achievements from '../../.content-data/achievements.json'

export type RoboconAchievement = {
  year: number
  items: string[]
}

// 数据维护于独立内容仓库，保留原站成绩作为模板。
export const roboconAchievements: RoboconAchievement[] = achievements

const recordedYears = roboconAchievements.map(({ year }) => year)

export const roboconRecordedYearCount = new Set(recordedYears).size
export const roboconAwardEntryCount = roboconAchievements.reduce(
  (total, achievement) => total + achievement.items.length,
  0
)
export const roboconYearRange = recordedYears.length
  ? `${Math.min(...recordedYears)}-${Math.max(...recordedYears)}`
  : '持续更新'
