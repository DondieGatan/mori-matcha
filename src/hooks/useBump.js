import { useEffect, useRef } from 'react'

// Retriggers the CSS "bump" pop animation on a button every time bumpKey
// changes, by forcing a reflow between removing and re-adding the class —
// simply re-adding the same class name wouldn't restart a CSS animation.
export function useBump(bumpKey) {
  const ref = useRef(null)
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    const el = ref.current
    if (!el) return
    el.classList.remove('bump')
    void el.offsetWidth
    el.classList.add('bump')
  }, [bumpKey])

  return ref
}
