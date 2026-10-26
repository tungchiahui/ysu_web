/**
 * 看板赛事配置：数组顺序即展示顺序，enabled=false 可隐藏。
 * 日期未定：startsAt=null、dateStatus='pending'。
 * 日期确定后：填写 YYYY-MM-DDTHH:mm:ss+08:00，并将状态改为
 * 'tentative'（暂定）或 'confirmed'（已确认）。统一使用北京时间。
 * 队内最终形态目标：dateStatus='target'，采用用户指定的北京时间。
 * 往届同期推算：dateStatus='historical'，referenceYear 填参考赛季年份。
 * 修改后提交、推送 main，由 EO 重新构建部署生效。
 */
export type CompetitionConfig = {
  name: string
  startsAt: string | null
  dateStatus: 'pending' | 'historical' | 'tentative' | 'confirmed' | 'target'
  referenceYear?: number
  enabled: boolean
}

export const competitions: CompetitionConfig[] = [
  {
    name: '2027RMUL最终形态',
    startsAt: '2027-01-04T00:00:00+08:00',
    dateStatus: 'target',
    enabled: true
  },
  {
    name: '2027RMUC最终形态',
    startsAt: '2027-03-08T00:00:00+08:00',
    dateStatus: 'target',
    enabled: true
  }
]
