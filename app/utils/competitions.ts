import type { CompetitionConfig } from '../data/competitions.ts'

// 在静态构建时检查配置，避免把错误日期或缺失时区当作真实赛程展示。
export function prepareCompetitions(events: CompetitionConfig[]) {
  const names = new Set<string>()
  return events.map(event => {
    const fail = (reason: string): never => { throw new Error(`app/data/competitions.ts：${event.name || '未命名赛事'}，${reason}`) }
    if (!event.name?.trim() || names.has(event.name.trim())) fail('赛事名称不能为空或重复')
    names.add(event.name.trim())
    if (typeof event.enabled !== 'boolean') fail('enabled 必须为 true 或 false')
    if (!['pending', 'tentative', 'confirmed'].includes(event.dateStatus)) fail('日期状态应为 pending、tentative 或 confirmed')
    if (event.dateStatus === 'pending') {
      if (event.startsAt !== null) fail('待定日期请设 startsAt=null；已有日期请同时更新 dateStatus')
      return { ...event, target: null }
    }
    if (typeof event.startsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(event.startsAt)) {
      fail('时间格式应为 YYYY-MM-DDTHH:mm:ss+08:00（北京时间）')
    }
    const target = Date.parse(event.startsAt!)
    if (!Number.isFinite(target) || new Date(target + 8 * 3600_000).toISOString().slice(0, 19) !== event.startsAt!.slice(0, 19)) {
      fail('日期或时间不存在，请检查年月日及小时、分钟、秒')
    }
    return { ...event, target }
  })
}

export function competitionTimeLeft(target: number | null, now: number) {
  if (target === null) return { state: 'pending', days: 0, clock: '' } as const
  if (now <= 0) return { state: 'waiting', days: 0, clock: '' } as const
  if (now >= target) return { state: 'reached', days: 0, clock: '00:00:00' } as const
  const seconds = Math.ceil((target - now) / 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    state: 'counting',
    days: Math.floor(seconds / 86400),
    clock: `${pad(Math.floor(seconds / 3600) % 24)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`
  } as const
}
