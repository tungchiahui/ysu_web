import { MEMBER_GROUPS, MEMBER_ROLES } from '../../utils/member-schema.mjs'

export { MEMBER_GROUPS, MEMBER_ROLES }

export type MemberSeason = { year: number; group?: string; roles?: string[] }
export type Member = {
  kind: 'student' | 'teacher'
  name: string
  affiliation: string
  image?: string
  grade?: number
  department?: string
  titles?: string[]
  seasons: MemberSeason[]
  links?: Record<string, string>
  [key: string]: unknown
}

export function memberSeasons(member: Member, season = 'all') {
  return [...member.seasons].filter(item => season === 'all' || String(item.year) === season)
    .sort((a, b) => b.year - a.year)
}

export function hasMemberSeason(member: Member, season = 'all') {
  return season === 'all' || (member.kind === 'teacher' && !member.seasons.length) || memberSeasons(member, season).length > 0
}

export function memberGroups(member: Member, season = 'all') {
  return [...new Set(memberSeasons(member, season).flatMap(item => item.group ? [item.group] : []))]
}

export function memberSections(members: Member[], season = 'all', group = 'all', role = 'all') {
  // 全部赛季取最近一条符合筛选的任职，分区与排序使用同一赛季的职务。
  const entries = members.map(member => {
    const record = memberSeasons(member, season).find(item =>
      (group === 'all' || item.group === group) && (role === 'all' || item.roles?.includes(role)))
    const leader = record?.roles?.some(value => ['队长', '副队长', '项管'].includes(value))
    return { member, record, label: member.kind === 'teacher' ? '指导老师' : leader ? '团队负责人' : record?.group }
  })
  return ['指导老师', '团队负责人', ...MEMBER_GROUPS].map(label => ({
    label,
    members: entries.filter(entry => entry.label === label)
      .sort((a, b) => label === '指导老师' || label === '团队负责人' ? 0
        : Number(b.record?.roles?.includes('组长') || false) - Number(a.record?.roles?.includes('组长') || false))
      .map(entry => entry.member)
  })).filter(section => section.members.length)
}

export function seasonRoleText(season: MemberSeason) {
  return (season.roles || []).map(role => role === '组长' || role === '成员' ? `${season.group}${role}` : role).join('、')
}

export function seasonFilterLabel(year: number) {
  return `${String(year).slice(-2)}赛季`
}

export function memberRoleText(member: Member, season = 'all') {
  if (member.kind === 'teacher') return '指导老师'
  const records = memberSeasons(member, season)
  return records.map(item => `${records.length > 1 ? `${item.year}：` : ''}${seasonRoleText(item)}`).join('；')
}

export function memberSeasonText(member: Member, season = 'all') {
  const years = memberSeasons(member, season).map(item => item.year).sort((a, b) => a - b)
  if (!years.length) return member.kind === 'teacher' ? '不限' : ''
  const ranges: string[] = []
  let start = years[0]!, end = start
  for (const year of years.slice(1)) {
    if (year === end + 1) end = year
    else { ranges.push(start === end ? `${start}` : `${start}–${end}`); start = end = year }
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`)
  return ranges.join('、')
}

export function matchesMember(member: Member, filters: { season: string; kind: string; group: string; role: string; search: string }) {
  if (filters.kind !== 'all' && member.kind !== filters.kind) return false
  if (!hasMemberSeason(member, filters.season)) return false
  if (filters.group !== 'all' || filters.role !== 'all') {
    // 组别和职务必须在同一赛季记录中匹配，避免串用历年身份。
    if (!memberSeasons(member, filters.season).some(item =>
      (filters.group === 'all' || item.group === filters.group) &&
      (filters.role === 'all' || item.roles?.includes(filters.role)))) return false
  }
  const keyword = filters.search.trim().toLowerCase()
  const text = [member.name, member.affiliation, member.grade,
    member.department, ...(member.titles || []), memberRoleText(member, filters.season),
    ...memberGroups(member, filters.season), ...memberSeasons(member, filters.season).map(item => item.year)].join(' ').toLowerCase()
  return !keyword || text.includes(keyword)
}

const linkLabels: Record<string, string> = {
  github: 'GitHub', gitcode: 'GitCode', homepage: '主页', blog: '博客', bilibili: 'Bilibili', 'google-scholar': 'Google Scholar'
}
export function memberLinks(member: Member) {
  return Object.entries(member.links || {}).filter(([, href]) => /^https?:\/\//i.test(href))
    .map(([key, href]) => ({ label: linkLabels[key] || key, href }))
}
