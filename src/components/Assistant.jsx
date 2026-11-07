import { useEffect, useRef, useState } from 'react'
import { INSTAGRAM_DM_URL } from '../data/menu'
import { useSpeech } from '../hooks/useSpeech'
import { useSpeechInput } from '../hooks/useSpeechInput'

const GREETING = "Hi, I'm Mori! Ask me about our drinks, prices, opening hours, how to order, or our party carts."
const SUGGESTIONS = ['What drinks do you have?', 'Are you open now?', 'How do I order?', 'Tell me about party carts']
const STORAGE_KEY = 'mori-assistant-chat'
const MAX_CHARS = 500

function loadChat() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((m) => m && typeof m.text === 'string').slice(-30) : []
  } catch {
    return []
  }
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  )
}

function SpeakerIcon({ muted }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      {muted ? <path d="m16 9 5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  )
}

export default function Assistant({ cartCount = 0 }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(loadChat)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const speech = useSpeech()
  const voiceIn = useSpeechInput()
  const sendRef = useRef(null) // the recognition callbacks outlive a render, so they call the latest send()
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const launcherRef = useRef(null)
  const nextId = useRef(messages.reduce((max, m) => Math.max(max, Number.isInteger(m.id) ? m.id : -1), -1) + 1)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)))
    } catch {
      // private mode: the chat just will not survive a refresh
    }
  }, [messages])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy, open])

  // Open: focus the input. Close: hand focus back to the launcher (it is only shown again once `open` is false).
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) inputRef.current?.focus()
    else if (wasOpen.current) launcherRef.current?.focus()
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  function close() {
    setOpen(false)
    speech.stop()
    voiceIn.stop()
  }

  // byVoice: the question was spoken, so the answer is read back even when voice replies are switched off.
  async function send(raw, byVoice = false) {
    const text = raw.trim().slice(0, MAX_CHARS)
    if (!text || busy) return
    speech.stop()
    voiceIn.stop()
    const userMsg = { id: nextId.current++, role: 'user', text }
    const history = [...messages, userMsg]
    setMessages(history)
    setDraft('')
    setBusy(true)

    let reply
    let failed = false
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.filter((m) => !m.error).map(({ role, text: t }) => ({ role, text: t })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.reply) reply = data.reply
      else if (res.status === 429) {
        reply = data.error || 'Please wait a moment before sending another message.'
        failed = true
      } else {
        reply = "Sorry, I couldn't answer that just now. You can message us on Instagram and the team will help."
        failed = true
      }
    } catch {
      reply = "I can't reach the server right now. You can message us on Instagram and the team will help."
      failed = true
    }

    const botMsg = { id: nextId.current++, role: 'assistant', text: reply, error: failed }
    setMessages((m) => [...m, botMsg])
    setBusy(false)
    if ((speech.voiceOn || byVoice) && !failed) speech.speak(botMsg.id, reply)
  }
  sendRef.current = send

  function onSubmit(e) {
    e.preventDefault()
    send(draft)
  }

  function clearChat() {
    speech.stop()
    voiceIn.stop()
    setMessages([])
  }

  function toggleMic() {
    if (voiceIn.listening) {
      voiceIn.stop()
      setDraft('')
      return
    }
    speech.stop() // so the microphone does not pick up Mori's own voice
    setDraft('')
    voiceIn.start({
      onInterim: (t) => setDraft(t.slice(0, MAX_CHARS)),
      onFinal: (t) => {
        setDraft('')
        sendRef.current(t, true)
      },
    })
  }

  const showSuggestions = messages.length === 0 && !busy

  return (
    <>
      <button
        type="button"
        ref={launcherRef}
        className={'assistant-launcher' + (cartCount > 0 ? ' has-cart' : '') + (open ? ' is-hidden' : '')}
        aria-label="Chat with Mori, our assistant"
        aria-expanded={open}
        aria-controls="assistant-panel"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.4A8 8 0 1 1 21 12z" />
          <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.4" />
        </svg>
        <span>Ask Mori</span>
      </button>

      <section id="assistant-panel" className={'assistant-panel' + (open ? ' is-open' : '') + (cartCount > 0 ? ' has-cart' : '')} role="dialog" aria-label="Mori assistant" aria-hidden={!open} hidden={!open}>
        <header className="assistant-head">
          <div className="assistant-head-text">
            <strong>Mori Assistant</strong>
            <span>Menu, hours &amp; ordering help</span>
          </div>
          {speech.supported && (
            <button
              type="button"
              className={'assistant-icon-btn' + (speech.voiceOn ? ' is-on' : '')}
              aria-pressed={speech.voiceOn}
              aria-label={speech.voiceOn ? 'Turn voice replies off' : 'Turn voice replies on'}
              title={speech.voiceOn ? 'Voice replies on' : 'Voice replies off'}
              onClick={speech.toggleVoice}
            >
              <SpeakerIcon muted={!speech.voiceOn} />
            </button>
          )}
          <button type="button" className="assistant-icon-btn" aria-label="Close chat" onClick={close}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="assistant-messages" ref={listRef} aria-live="polite" aria-relevant="additions">
          <div className="assistant-msg is-bot">
            <p>{GREETING}</p>
          </div>
          {messages.map((m) => (
            <div key={m.id} className={'assistant-msg ' + (m.role === 'user' ? 'is-user' : 'is-bot') + (m.error ? ' is-error' : '')}>
              <p>{m.text}</p>
              {m.role === 'assistant' && speech.supported && !m.error && (
                <button
                  type="button"
                  className="assistant-listen"
                  onClick={() => (speech.speakingId === m.id ? speech.stop() : speech.speak(m.id, m.text))}
                  aria-label={speech.speakingId === m.id ? 'Stop reading this reply' : 'Read this reply aloud'}
                >
                  <SpeakerIcon muted={false} />
                  <span>{speech.speakingId === m.id ? 'Stop' : 'Listen'}</span>
                </button>
              )}
            </div>
          ))}
          {busy && (
            <div className="assistant-msg is-bot" role="status" aria-label="Mori is typing">
              <span className="assistant-typing" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
          {showSuggestions && (
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {(voiceIn.listening || voiceIn.error) && (
          <p className={'assistant-voice-note' + (voiceIn.error ? ' is-error' : '')} role={voiceIn.error ? 'alert' : 'status'}>
            {voiceIn.error || 'Listening… ask your question out loud.'}
          </p>
        )}
        <form className="assistant-form" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            maxLength={MAX_CHARS}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={voiceIn.listening ? 'Listening… speak now' : 'Type your question…'}
            aria-label="Your message"
            autoComplete="off"
            enterKeyHint="send"
          />
          {voiceIn.supported && (
            <button
              type="button"
              className={'assistant-mic' + (voiceIn.listening ? ' is-listening' : '')}
              aria-pressed={voiceIn.listening}
              aria-label={voiceIn.listening ? 'Stop listening' : 'Speak your question'}
              title={voiceIn.listening ? 'Stop listening' : 'Speak your question'}
              disabled={busy}
              onClick={toggleMic}
            >
              <MicIcon />
            </button>
          )}
          <button type="submit" className="assistant-send" disabled={busy || !draft.trim()} aria-label="Send message">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
        <p className="assistant-foot">
          AI assistant, so answers may not always be exact.{voiceIn.supported && " Voice input uses your browser's speech service."} To order, use the cart or{' '}
          <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener">
            message us on Instagram
          </a>
          .{messages.length > 0 && (
            <>
              {' '}
              <button type="button" className="assistant-clear" onClick={clearChat}>
                Clear chat
              </button>
            </>
          )}
        </p>
      </section>
    </>
  )
}
