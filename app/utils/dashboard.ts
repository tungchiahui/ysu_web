export { dashboardTaskState, dashboardTaskGroups, selectDashboardTasks, dashboardRanks } from '../../utils/dashboard-data.mjs'

export type DashboardPerson = { key: string; name: string; avatar: string }
export type DashboardTask = {
  id: string; title: string; group: string; groups?: string[]; assignees: DashboardPerson[]; publisher: string
  deadline: number | null; completedAt: number | null; priority: 'high' | 'medium' | 'low'
  status: 'todo' | 'done'; note: string
}
export type DashboardData = {
  tasks: DashboardTask[]; updatedAt: number; stale: boolean; refreshSeconds: number; demo?: boolean
  github: {
    enabled: boolean; unavailable: boolean; updatedAt?: number
    contributors: { name: string; count: number; avatar: string; href: string }[]
    events: { id: string; repo: string; actor: string; action: string; at: number; href: string }[]
  }
}
