import { useCallback, useEffect, useRef, useState } from 'react'

// Speech-to-text through the browser's built-in recognition (Chrome, Edge, Safari). Chrome and Edge send the audio to
// their own speech service to transcribe it, so the chat panel says so. Not available in Firefox: the button hides.
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined
export const recognitionSupported = Boolean(Recognition)

const MESSAGES = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser settings, or type your question.',
  'service-not-allowed': 'Voice input is turned off in this browser. You can type your question instead.',
  'audio-capture': "I couldn't find a microphone. You can type your question instead.",
  'no-speech': "I didn't hear anything. Tap the microphone and try again.",
  network: 'Voice input needs an internet connection. You can type your question instead.',
}

// start({ onInterim, onFinal }) listens for one spoken question. onInterim gets the text as it is recognised,
// onFinal gets the finished sentence once the speaker stops.
export function useSpeechInput() {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recRef = useRef(null)

  const stop = useCallback(() => {
    const rec = recRef.current
    recRef.current = null
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = null
      try {
        rec.abort()
      } catch {
        // already stopped
      }
    }
    setListening(false)
  }, [])

  const start = useCallback(
    ({ onInterim, onFinal }) => {
      if (!Recognition) return
      stop()
      setError('')
      const rec = new Recognition()
      rec.lang = 'en-PH' // Philippine English; the user's own voice settings still apply for other accents
      rec.interimResults = true
      rec.continuous = false
      rec.maxAlternatives = 1
      let finished = false

      rec.onresult = (event) => {
        let text = ''
        let isFinal = false
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript
          if (event.results[i].isFinal) isFinal = true
        }
        text = text.trim()
        if (!text) return
        if (isFinal) {
          finished = true
          recRef.current = null
          setListening(false)
          onFinal(text)
        } else {
          onInterim(text)
        }
      }
      rec.onerror = (event) => {
        finished = true
        recRef.current = null
        setListening(false)
        if (event.error !== 'aborted') setError(MESSAGES[event.error] || "Voice input didn't work. You can type your question instead.")
      }
      rec.onend = () => {
        // Ended without a result (silence timeout): say so rather than leaving the button stuck on.
        if (recRef.current === rec) {
          recRef.current = null
          setListening(false)
          if (!finished) setError(MESSAGES['no-speech'])
        }
      }

      recRef.current = rec
      try {
        rec.start()
        setListening(true)
      } catch {
        recRef.current = null
        setError("Voice input didn't start. You can type your question instead.")
      }
    },
    [stop],
  )

  useEffect(() => stop, [stop])

  return { supported: recognitionSupported, listening, error, clearError: () => setError(''), start, stop }
}
