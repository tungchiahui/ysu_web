import achievements from '../../.content-data/achievements.json'

export type AchievementSource = { title: string; url: string }
export type RoboMasterAchievement = {
  year: number
  note?: string
  items: Array<{ title: string; source: AchievementSource }>
}

// 独立内容仓库维护已核实记录，每个奖项保留官方来源。
export const robomasterAchievements: RoboMasterAchievement[] = achievements.records
export const robomasterFirstSeason = achievements.firstSeason
export const robomasterFirstSeasonSource: AchievementSource = achievements.firstSeasonSource
export const robomasterOfficialIndex = achievements.officialIndex
export const robomasterCoverageNote = achievements.coverageNote
export const robomasterCheckedOn = achievements.checkedOn

const recordedYears = robomasterAchievements.map(({ year }) => year)

export const robomasterRecordedYearCount = new Set(recordedYears).size
export const robomasterAwardEntryCount = robomasterAchievements.reduce(
  (total, achievement) => total + achievement.items.length,
  0
)
