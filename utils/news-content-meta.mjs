export function newsFrontmatterFields(z) {
  return {
    title: z.string().trim().min(1, '标题不能为空'),
    authors: z.array(z.string().trim().min(1, '作者姓名不能为空'))
      .refine(names => new Set(names).size === names.length, '作者姓名不能重复').optional()
  }
}

export function getNewsContentMeta(stem, source) {
  if (!String(stem || '').startsWith('news/')) return null

  const date = String(stem).match(/^news\/(\d{4}-\d{2}-\d{2})(?:-|$)/)?.[1] || ''
  const body = String(source || '').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
  const image = body.match(/!\[[^\]]*\]\((\/images\/[^\s)]+)(?:\s+"[^"]*")?\)/)?.[1] || null
  const paragraph = body.split(/\r?\n\s*\r?\n/).find(part => {
    const text = part.trim()
    return text && !/^(?:#|!\[|>|[-*+]\s|\d+\.\s|原文[：:])/.test(text)
  }) || ''
  const summary = paragraph
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ').trim()

  return { date, image, summary: summary.length > 140 ? `${summary.slice(0, 140)}…` : summary }
}
