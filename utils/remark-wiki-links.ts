import { existsSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { getWikiContentMeta } from './wiki-content-meta'

interface MarkdownNode {
  type: string
  url?: string
  value?: string
  children?: MarkdownNode[]
}

// Resolve links before Nuxt Content's default slugger strips Chinese file names.
// Source Markdown stays unchanged in the independent content repository.
export default function remarkWikiLinks() {
  return (tree: MarkdownNode, file: { id?: string; path?: string }) => {
    const id = String(file.id || file.path || '').replace(/\\/g, '/')
    const stem = (id.includes(':') ? id.slice(id.indexOf(':') + 1) : id)
      .replace(/\.(md|mdc)$/i, '')
    if (!stem.startsWith('wiki/')) return

    const visit = (node: MarkdownNode) => {
      if (node.type === 'link' && node.url) {
        if (/^(?:file:|\/(?:home|Users|tmp|etc|usr|opt|var)\/|[A-Za-z]:[\\/])/.test(node.url)) {
          // A developer's source-file citation is a label, not a website route.
          node.type = 'inlineCode'
          node.value = label(node)
          delete node.children
          delete node.url
        } else if (node.url.startsWith('/zh-cn/wiki/')) {
          node.url = node.url.slice('/zh-cn'.length)
        } else if (!/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(node.url)) {
          const match = node.url.match(/^([^?#]+)(.*)$/)
          if (match && /\.mdc?$/i.test(match[1])) {
            let relativePath = match[1]
            try { relativePath = decodeURIComponent(relativePath) } catch {}
            const target = posix.normalize(posix.join(posix.dirname(stem), relativePath))
            const meta = getWikiContentMeta(target.replace(/\.mdc?$/i, ''))
            if (meta && existsSync(resolve('content', target))) {
              node.url = meta.path + match[2]
            } else {
              // Markdown tutorials also contain illustrative links to absent files.
              node.type = 'inlineCode'
              node.value = label(node)
              delete node.children
              delete node.url
            }
          }
        }
      }

      if (node.type === 'image' && node.url) {
        node.url = node.url.replace(/^(?:\.\.\/)+public\//, '/')
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

function label(node: MarkdownNode): string {
  return node.value || node.children?.map(label).join('') || ''
}
