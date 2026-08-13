import { useEffect, useState } from 'react'

export function useAvailability() {
  const [soldOutKeys, setSoldOutKeys] = useState([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/availability')
      .then((res) => (res.ok ? res.json() : { soldOut: [] }))
      .then((data) => {
        if (!cancelled) setSoldOutKeys(data.soldOut || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return soldOutKeys
}
