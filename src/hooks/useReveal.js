import { useEffect, useRef, useState } from 'react'

// Fade + rise an element into view once, staggered by index (matches the
// original site's scroll-reveal behavior for menu items).
export function useReveal(index = 0) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return {
    ref,
    className: 'reveal' + (isVisible ? ' is-visible' : ''),
    style: { transitionDelay: (index % 6) * 70 + 'ms' },
  }
}
