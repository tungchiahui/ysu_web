export { dashboardGridLayout, dashboardMemberPath, dashboardTaskState, dashboardTaskGroups, selectDashboardTasks, dashboardRanks } from '../../utils/dashboard-data.mjs'

export type DashboardPerson = { key: string; name: string; avatar: string }
export type DashboardTask = {
  id: string; title: string; group: string; groups?: string[]; assignees: DashboardPerson[]; publisher: string; publishers?: DashboardPerson[]
  deadline: number | null; completedAt: number | null; priority: 'high' | 'medium' | 'low'
  status: 'todo' | 'done'; note: string
}
export type DashboardDevelopment = {
  enabled: boolean; unavailable: boolean; updatedAt?: number; configurationError?: boolean; syncing?: boolean
  organization?: { name: string; href: string; unavailable: boolean; updatedAt?: number; discoveredCount?: number; includedCount?: number; excludedCount?: number }
  contributors: { key?: string; name: string; memberName?: string; count: number; avatar: string; href: string }[]
  events: { id: string; repo: string; actor: string; action: string; at: number; href: string }[]
  sources?: { key: string; repo: string; href: string; fork?: boolean; pending?: boolean; unavailable: boolean; contributionsUnavailable: boolean; eventsUnavailable: boolean; updatedAt?: number }[]
}
export type DashboardData = {
  tasks: DashboardTask[]; updatedAt: number; stale: boolean; refreshSeconds: number; demo?: boolean
  development?: DashboardDevelopment
  /** 兼容旧部署响应，新增代码使用 development。 */
  github?: DashboardDevelopment
}
