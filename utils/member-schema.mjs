export const MEMBER_GROUPS = ['机械组', '电控组', '硬件组', '算法组', '运营组']
export const MEMBER_ROLES = ['队长', '副队长', '组长', '项管', '成员']

// Nuxt Content 的数据库字段与构建前校验共用同一份定义。
export function memberFields(z) {
  const year = z.number().int().min(2000).max(2099)
  const link = z.string().url().refine(value => /^https?:\/\//i.test(value), '链接必须使用 http 或 https')
  return {
    kind: z.enum(['student', 'teacher']),
    name: z.string().trim().min(1),
    image: z.string().regex(/^\/images\/.+\.(?:jpe?g|png|webp|gif|avif|svg)$/i).optional(),
    affiliation: z.string().trim().min(1),
    grade: year.optional(),
    department: z.string().trim().min(1).optional(),
    titles: z.array(z.string().trim().min(1)).optional(),
    seasons: z.array(z.object({
      year,
      group: z.enum(MEMBER_GROUPS).optional(),
      roles: z.array(z.enum(MEMBER_ROLES)).min(1).optional()
    }).strict()).default([]),
    links: z.record(z.string(), link).optional()
  }
}

export function createMemberSchema(z) {
  return z.object(memberFields(z)).strict().superRefine((person, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message })
    const years = new Set()
    for (const [index, season] of person.seasons.entries()) {
      if (years.has(season.year)) issue(['seasons', index, 'year'], '同一人每个赛季只能填写一条记录')
      years.add(season.year)
      if (person.kind === 'student') {
        if (!season.group) issue(['seasons', index, 'group'], '学生赛季记录必须填写组别')
        if (!season.roles?.length) issue(['seasons', index, 'roles'], '学生赛季记录必须填写职务')
        const roles = season.roles || []
        if (new Set(roles).size !== roles.length) issue(['seasons', index, 'roles'], '职务不能重复')
        if (roles.includes('成员') && roles.length > 1) issue(['seasons', index, 'roles'], '成员不与其他职务重复填写')
        if (roles.includes('队长') && roles.includes('副队长')) issue(['seasons', index, 'roles'], '队长和副队长不能同时填写')
      } else if (season.group !== undefined || season.roles !== undefined) {
        issue(['seasons', index], '指导老师不填写学生组别或职务')
      }
    }
    if (person.kind === 'student') {
      if (person.grade === undefined) issue(['grade'], '学生必须填写四位入学年份')
      if (!person.seasons.length) issue(['seasons'], '学生至少填写一个赛季')
      if (person.department !== undefined || person.titles !== undefined) issue(['kind'], '学生不填写教师专用的 department 或 titles')
    } else {
      if (person.grade !== undefined) issue(['grade'], '指导老师不填写入学年级')
      if (!person.seasons.length) issue(['seasons'], '指导老师至少填写一个赛季')
    }
  })
}
