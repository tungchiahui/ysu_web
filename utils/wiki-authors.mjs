// 手写 frontmatter 仅保留标题和作者；路径、日期和章节信息由现有目录规则生成。
export function wikiFrontmatterFields(z) {
  return {
    title: z.string().trim().min(1, '标题不能为空'),
    authors: z.array(z.string().trim().min(1, '作者姓名不能为空'))
      .refine(names => new Set(names).size === names.length, '作者姓名不能重复').optional()
  }
}

export function resolveWikiAuthors(page, index) {
  // Nuxt Content 会把缺省可选字段读成 null；显式 [] 则保留“不显示作者”的含义。
  if (Array.isArray(page?.authors)) return page.authors
  if (Array.isArray(index?.authors)) return index.authors
  return []
}

export function wikiAuthorProfiles(authors, members, defaultAvatar) {
  const byName = new Map((members || []).map(member => [member.name, member]))
  return authors.map(name => {
    const member = byName.get(name)
    return {
      name,
      image: member?.image || defaultAvatar,
      href: member ? `/team/${encodeURIComponent(member.name)}` : `/authors/${encodeURIComponent(name)}`
    }
  })
}

export function wikiPagesByAuthor(pages, name) {
  const normalizePath = value => (value || '').replace(/\/$/, '')
  const indexes = new Map(pages.filter(page => page.isWikiIndex)
    .map(page => [normalizePath(page.path), page]))
  return pages.filter(page => resolveWikiAuthors(page, indexes.get(normalizePath(page.docRoot))).includes(name))
    .sort((a, b) => a.path.localeCompare(b.path))
}
