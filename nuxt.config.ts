import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { getWikiContentMeta } from './utils/wiki-content-meta'
import site from './.content-data/site.json'
import remarkWikiLinks from './utils/remark-wiki-links'
import { parse } from 'yaml'
import { validateWikiOutput } from './scripts/wiki-output-check.mjs'
import { getNewsContentMeta } from './utils/news-content-meta.mjs'

const getMarkdownFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      return getMarkdownFiles(path)
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  })

const memberRoutes = existsSync('content/members')
  ? getMarkdownFiles('content/members')
    .map((file) => `/team/${basename(file, '.md')}`)
  : []

const authorRoutes = existsSync('content/wiki')
  ? [...new Set(getMarkdownFiles('content/wiki').flatMap((file) => {
    const frontmatter = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    const authors = frontmatter ? parse(frontmatter[1])?.authors : []
    return Array.isArray(authors) ? authors.map(name => String(name).trim()).filter(Boolean) : []
  }))].map(name => `/authors/${encodeURIComponent(name)}`)
  : []

export default defineNuxtConfig({
  modules: ['@nuxt/content'],
  compatibilityDate: '2026-05-12',
  css: ['~/assets/css/main.css'],
  content: {
    build: {
      transformers: ['./transformers/wiki-pinyin-path.ts'],
      markdown: {
        remarkPlugins: {
          'wiki-links': { instance: remarkWikiLinks }
        }
      }
    }
  },
  mdc: {
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark'
      },
      langs: [
        'ts',
        'js',
        'vue',
        'json',
        'bash',
        'md',
        'html',
        'css',
        'scss',
        'python',
        'py',
        'java',
        'cmake',
        'cpp',
        'c',
        'csharp',
        'go',
        'rust',
        'php',
        'sql',
        'yaml',
        'yml',
        'xml',
        'toml',
        'docker',
        'dockerfile',
        'kotlin',
        'swift',
        'ruby',
        'dart',
        'lua',
        'perl',
        'r',
        'zig'
      ]
    }
  },
  hooks: {
    'nitro:init'(nitro) {
      if (nitro.options.dev || !nitro.options.static) return
      // EO 的 Nuxt 适配器会重写 publicDir，必须检查本次构建真正的输出目录。
      nitro.hooks.hook('compiled', async () => {
        await validateWikiOutput(nitro.options.output.publicDir, nitro.options.rootDir)
      })
    },
    'content:file:afterParse'({ file, content }) {
      const wikiMeta = getWikiContentMeta(content.stem)

      if (wikiMeta) {
        Object.assign(content, wikiMeta)
      }
      const newsMeta = getNewsContentMeta(content.stem, file.body)
      if (newsMeta) Object.assign(content, newsMeta)
    }
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'zh-CN'
      },
      title: site.fullName,
      meta: [
        {
          name: 'description',
          content: site.description
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1'
        }
      ],
      link: [
        { rel: 'icon', type: 'image/jpeg', href: site.logo }
      ],
      script: [
        {
          key: 'theme-init',
          innerHTML: "(() => { try { const stored = localStorage.getItem('ysu-theme'); const theme = stored === 'light' || stored === 'dark' ? stored : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = theme; } catch (_) {} })()"
        },
        ...(site.analytics.enabled ? [{
          defer: true,
          src: site.analytics.script,
          'data-website-id': site.analytics.websiteId
        }] : [])
      ]
    }
  },
  routeRules: {
    '/': { prerender: true },
    '/research': { prerender: true },
    '/team': { prerender: true },
    '/team/**': { prerender: true },
    '/dashboard': { prerender: true },
    '/news': { prerender: true },
    '/news/**': { prerender: true },
    '/wiki': { prerender: true },
    '/wiki/**': { prerender: true },
    '/authors/**': { prerender: true },
    '/docs': { redirect: '/wiki' },
    '/recruitment': { prerender: true },
    '/contact': { prerender: true }
  },
  nitro: {
    prerender: {
      // 限制预渲染并发，避免大量内容查询同时进行时出现空白产物。
      concurrency: 4,
      crawlLinks: true,
      routes: ['/', '/research', '/team', '/dashboard', '/news', '/wiki', '/recruitment', '/contact', ...memberRoutes, ...authorRoutes]
    }
  }
})
