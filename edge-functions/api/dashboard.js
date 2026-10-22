import { createDashboardService } from '../../utils/dashboard-service.mjs'

const handleDashboard = createDashboardService()

// EO 会先扫描入口源码中的 onRequest，再打包其依赖。
export function onRequest(context) {
  return handleDashboard(context)
}
