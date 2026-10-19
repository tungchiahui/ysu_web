import promos from '../../.content-data/home-promos.json'

export type HomePromoTone = 'victory' | 'recruitment' | 'team'

export type HomePromoSlide = {
  kicker: string
  title: string
  highlight?: string
  summary: string
  image: string
  imageAlt: string
  href: string
  cta: string
  tone: HomePromoTone
  position?: string
}

// 内容仓库维护轮播文案和图片；模板原文保留来源。
export const homePromoSlides = promos.slides as HomePromoSlide[]
export const homePromoAutoplayMs = promos.autoplayMs
