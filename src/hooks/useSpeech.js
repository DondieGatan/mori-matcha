import { useCallback, useEffect, useRef, useState } from 'react'

// Text-to-speech through the browser's built-in voices: no key, no cost, and nothing leaves the device.
const STORAGE_KEY = 'mori-assistant-voice'

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

// Friendlier-sounding voices first: the "natural" / online neural voices, then Google's, then any English voice.
function pickVoice(voices) {
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang))
  const score = (v) =>
    (/natural|neural|online/i.test(v.name) ? 40 : 0) +
    (/google/i.test(v.name) ? 20 : 0) +
    (/aria|jenny|samantha|zira|female|karen|serena|moira/i.test(v.name) ? 10 : 0) +
    (/^en[-_]PH/i.test(v.lang) ? 8 : 0) +
    (/^en[-_]US/i.test(v.lang) ? 4 : 0) +
    (v.default ? 1 : 0)
  return english.sort((a, b) => score(b) - score(a))[0] || null
}

// Long replies are spoken sentence by sentence; some browsers cut off a single long utterance after about 15 seconds.
function toChunks(text) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text]
  const chunks = []
  let current = ''
  for (const s of sentences) {
    if ((current + s).length > 160 && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current += s
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export function useSpeech() {
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [speakingId, setSpeakingId] = useState(null)
  const voiceRef = useRef(null)
  const runRef = useRef(0) // bumps on every speak/stop so a cancelled run cannot clear a newer one's state

  useEffect(() => {
    if (!speechSupported) return undefined
    const load = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices())
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const stop = useCallback(() => {
    if (!speechSupported) return
    runRef.current += 1
    window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [])

  const speak = useCallback((id, text) => {
    if (!speechSupported || !text) return
    window.speechSynthesis.cancel()
    const run = ++runRef.current
    const chunks = toChunks(text)
    setSpeakingId(id)
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk)
      if (voiceRef.current) {
        u.voice = voiceRef.current
        u.lang = voiceRef.current.lang
      } else {
        u.lang = 'en-US'
      }
      u.rate = 1
      u.pitch = 1
      const finish = () => {
        if (runRef.current === run && i === chunks.length - 1) setSpeakingId(null)
      }
      u.onend = finish
      u.onerror = finish
      window.speechSynthesis.speak(u)
    })
  }, [])

  const toggleVoice = useCallback(() => {
    setVoiceOn((on) => {
      const next = !on
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // storage unavailable: the choice just lasts for this visit
      }
      if (!next) {
        runRef.current += 1
        if (speechSupported) window.speechSynthesis.cancel()
        setSpeakingId(null)
      }
      return next
    })
  }, [])

  // Never keep talking after the page is left or the component goes away.
  useEffect(() => stop, [stop])

  return { supported: speechSupported, voiceOn, toggleVoice, speakingId, speak, stop }
}
