/**
 * 看板赛事配置：数组顺序即展示顺序，enabled=false 可隐藏。
 * 日期未定：startsAt=null、dateStatus='pending'。
 * 日期确定后：填写 YYYY-MM-DDTHH:mm:ss+08:00，并将状态改为
 * 'tentative'（暂定）或 'confirmed'（已确认）。统一使用北京时间。
 * 往届同期推算：dateStatus='historical'，referenceYear 填参考赛季年份。
 * 当前两项按2026手册比赛首场时间推算2027同月同日，不是2027官方赛程。
 * 修改后提交、推送 main，由 EO 重新构建部署生效。
 */
export type CompetitionConfig = {
  name: string
  startsAt: string | null
  dateStatus: 'pending' | 'historical' | 'tentative' | 'confirmed'
  referenceYear?: number
  enabled: boolean
}

export const competitions: CompetitionConfig[] = [
  {
    name: '2027 RMUL 山东站',
    // 2026山东站手册第19页，3V3小组赛3月20日15:00开始。
    // https://bbs.robomaster.com/wiki/20204847/809872
    startsAt: '2027-03-20T15:00:00+08:00',
    dateStatus: 'historical',
    referenceYear: 2026,
    enabled: true
  },
  {
    name: '2027 RMUC 东部赛区（济南）',
    // 2026东部赛区手册第18页，小组赛5月21日08:30开始。
    // https://bbs.robomaster.com/wiki/20204847/809871?source=7
    startsAt: '2027-05-21T08:30:00+08:00',
    dateStatus: 'historical',
    referenceYear: 2026,
    enabled: true
  }
]
