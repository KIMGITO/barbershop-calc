import { useEffect, useState } from 'react'

// Hides on scroll-down, shows on scroll-up. Always visible near the very
// top and very bottom of the page, and re-shown when `resetKey` changes
// (e.g. on navigation).
export function useHideOnScroll(resetKey, { threshold = 8, topOffset = 40 } = {}) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => { setHidden(false) }, [resetKey])

  useEffect(() => {
    let last = window.scrollY
    let ticking = false

    const update = () => {
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      const delta = y - last
      if (y <= topOffset || y >= max - 4) setHidden(false)
      else if (delta > threshold) setHidden(true)
      else if (delta < -threshold) setHidden(false)
      if (Math.abs(delta) > threshold) last = y
      ticking = false
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold, topOffset])

  return hidden
}
