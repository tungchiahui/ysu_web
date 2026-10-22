/**
 * 看板赛事配置：数组顺序即展示顺序，enabled=false 可隐藏。
 * 日期未定：startsAt=null、dateStatus='pending'。
 * 日期确定后：填写 YYYY-MM-DDTHH:mm:ss+08:00，并将状态改为
 * 'tentative'（暂定）或 'confirmed'（已确认）。统一使用北京时间。
 * 修改后提交、推送 main，由 EO 重新构建部署生效。
 */
export type CompetitionConfig = {
  name: string
  startsAt: string | null
  dateStatus: 'pending' | 'tentative' | 'confirmed'
  enabled: boolean
}

export const competitions: CompetitionConfig[] = [
  {
    name: '2027 RMUL 山东站',
    startsAt: null,
    dateStatus: 'pending',
    enabled: true
  },
  {
    name: '2027 RMUC',
    startsAt: null,
    dateStatus: 'pending',
    enabled: true
  }
]
