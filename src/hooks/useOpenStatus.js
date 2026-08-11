import { useEffect, useState } from 'react'
import { OPEN_HOURS } from '../data/menu'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function phNowParts() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const map = {}
  fmt.formatToParts(new Date()).forEach((p) => {
    map[p.type] = p.value
  })
  const weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[map.weekday]
  const hour = parseInt(map.hour, 10) % 24
  const minute = parseInt(map.minute, 10)
  return { day: weekdayIndex, minutes: hour * 60 + minute }
}

function formatMinutes(total) {
  const h = Math.floor(total / 60)
  const m = total % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return h12 + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ' ' + period
}

function findNextOpening(day, minutes) {
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7
    const ranges = OPEN_HOURS[d] || []
    for (let i = 0; i < ranges.length; i++) {
      const opensAt = ranges[i][0]
      if (offset > 0 || opensAt > minutes) {
        return { day: d, sameDay: offset === 0, opensAt }
      }
    }
  }
  return null
}

function computeStatus() {
  const now = phNowParts()
  const ranges = OPEN_HOURS[now.day] || []

  for (let i = 0; i < ranges.length; i++) {
    if (now.minutes >= ranges[i][0] && now.minutes < ranges[i][1]) {
      return { isOpen: true, text: 'Open now — closes ' + formatMinutes(ranges[i][1]) }
    }
  }

  const next = findNextOpening(now.day, now.minutes)
  if (next) {
    const when = next.sameDay ? 'today' : DAY_NAMES[next.day]
    return { isOpen: false, text: 'Closed — opens ' + when + ' at ' + formatMinutes(next.opensAt) }
  }
  return { isOpen: false, text: 'Closed' }
}

export function useOpenStatus() {
  const [status, setStatus] = useState(computeStatus)

  useEffect(() => {
    const id = setInterval(() => setStatus(computeStatus()), 60000)
    return () => clearInterval(id)
  }, [])

  return status
}
