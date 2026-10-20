import { defineCollection, defineContentConfig, z } from '@nuxt/content'
import { memberFields } from './utils/member-schema.mjs'
import { wikiFrontmatterFields } from './utils/wiki-authors.mjs'
import { newsFrontmatterFields } from './utils/news-content-meta.mjs'

export default defineContentConfig({
  collections: {
    members: defineCollection({
      type: 'page',
      source: 'members/**/*.md',
      schema: z.object(memberFields(z)).passthrough()
    }),
    news: defineCollection({
      type: 'page',
      source: 'news/**/*.md',
      schema: z.object({
        ...newsFrontmatterFields(z),
        date: z.string().optional(),
        image: z.string().nullable().optional(),
        summary: z.string().nullable().optional()
      }).passthrough()
    }),
    wiki: defineCollection({
      type: 'page',
      source: 'wiki/**/*.md',
      schema: z.object({
        ...wikiFrontmatterFields(z),
        date: z.string().nullable().optional(),
        chapterOrder: z.string().nullable().optional(),
        chapterDepth: z.number().nullable().optional(),
        docKey: z.string().nullable().optional(),
        docRoot: z.string().nullable().optional(),
        docTitle: z.string().nullable().optional(),
        isWikiDoc: z.boolean().nullable().optional(),
        isWikiIndex: z.boolean().nullable().optional(),
        wikiDepth: z.number().nullable().optional()
      }).passthrough()
    })
  }
})
