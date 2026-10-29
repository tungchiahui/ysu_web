// One animation owns scrolling, including layout changes from slow media/fonts.
// The caller keeps the anchor until user input, navigation or disposal.
export const createWikiAnchorScroller = (options: {
  target: () => number | null
  position: () => number
  write: (top: number) => void
  requestFrame: (callback: (time: number) => void) => number
  cancelFrame: (frame: number) => void
  reducedMotion: () => boolean
  onArrive: () => void
}) => {
  let frame: number | null = null
  let destination = 0
  let start = 0
  let startedAt: number | null = null
  let stopped = false
  let animate = true

  const tick = (time: number) => {
    frame = null
    if (stopped) return
    const target = options.target()
    if (target === null) return
    if (startedAt === null || Math.abs(target - destination) > 1) {
      start = options.position()
      destination = target
      startedAt = time
    }
    const duration = Math.min(680, Math.max(240, Math.abs(destination - start) * 0.18))
    const progress = !animate || options.reducedMotion() ? 1 : Math.min(1, (time - startedAt) / duration)
    // Quintic ease-out: a quick departure and a soft, precise landing.
    options.write(start + (destination - start) * (1 - (1 - progress) ** 5))
    if (progress < 1) frame = options.requestFrame(tick)
    else {
      startedAt = null
      options.onArrive()
    }
  }

  return {
    refresh(smooth = true) {
      if (stopped || frame !== null) return
      animate = smooth
      startedAt = null
      frame = options.requestFrame(tick)
    },
    cancel() {
      stopped = true
      if (frame !== null) options.cancelFrame(frame)
      frame = null
    }
  }
}
