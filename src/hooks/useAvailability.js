import { useEffect, useState } from 'react'

export function useAvailability() {
  const [statuses, setStatuses] = useState({})

  useEffect(() => {
    let cancelled = false
    fetch('/api/availability')
      .then((res) => (res.ok ? res.json() : { statuses: {} }))
      .then((data) => {
        if (!cancelled) setStatuses(data.statuses || {})
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const unavailableKeys = Object.keys(statuses).filter((k) => statuses[k] === 'unavailable')
  const comingSoonKeys = Object.keys(statuses).filter((k) => statuses[k] === 'coming_soon')

  return { statuses, unavailableKeys, comingSoonKeys }
}
