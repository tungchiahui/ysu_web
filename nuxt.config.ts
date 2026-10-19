import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { getWikiContentMeta } from './utils/wiki-content-meta'
import site from './.content-data/site.json'
import remarkWikiLinks from './utils/remark-wiki-links'

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
    'content:file:afterParse'({ content }) {
      const wikiMeta = getWikiContentMeta(content.stem)

      if (wikiMeta) {
        Object.assign(content, wikiMeta)
      }
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
    '/news': { prerender: true },
    '/news/**': { prerender: true },
    '/wiki': { prerender: true },
    '/wiki/**': { prerender: true },
    '/docs': { redirect: '/wiki' },
    '/recruitment': { prerender: true },
    '/contact': { prerender: true }
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/research', '/team', '/news', '/wiki', '/recruitment', '/contact', ...memberRoutes]
    }
  }
})
