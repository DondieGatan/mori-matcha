import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 15000

export function useAvailability() {
  const [statuses, setStatuses] = useState({})

  useEffect(() => {
    let cancelled = false

    function load() {
      fetch('/api/availability')
        .then((res) => (res.ok ? res.json() : { statuses: {} }))
        .then((data) => {
          if (!cancelled) setStatuses(data.statuses || {})
        })
        .catch(() => {})
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const unavailableKeys = Object.keys(statuses).filter((k) => statuses[k] === 'unavailable')
  const comingSoonKeys = Object.keys(statuses).filter((k) => statuses[k] === 'coming_soon')

  return { statuses, unavailableKeys, comingSoonKeys }
}
