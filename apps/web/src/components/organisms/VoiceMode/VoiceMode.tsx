import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Send, X, Keyboard } from 'lucide-react'

type VoiceModeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
}

export interface VoiceModeProps {
  onSend: (message: string) => void
  onClose: () => void
  isTyping?: boolean
  agentName?: string
  lastAIMessage?: string
}

export function VoiceMode({
  onSend,
  onClose,
  isTyping = false,
  agentName = 'Eric',
  lastAIMessage,
}: VoiceModeProps) {
  const [state, setState] = useState<VoiceModeState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef<unknown>(null)
  const [supported, setSupported] = useState(true)
  const [showTranscriptInput, setShowTranscriptInput] = useState(false)

  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
    }
  }, [])

  useEffect(() => {
    if (isTyping) {
      setState('thinking')
    } else if (state === 'thinking') {
      setState('idle')
    }
  }, [isTyping])

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new (SpeechRecognition as new () => {
      continuous: boolean
      interimResults: boolean
      lang: string
      onresult: (e: SpeechRecognitionEvent) => void
      onerror: (e: SpeechRecognitionErrorEvent) => void
      onend: () => void
      start: () => void
      stop: () => void
    })()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let final = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (final) {
        setTranscript((prev) => (prev ? prev + ' ' + final : final))
        setInterimTranscript('')
      } else {
        setInterimTranscript(interim)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', e.error)
      setState('idle')
    }

    recognition.onend = () => {
      if (state === 'listening') {
        setState('idle')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('listening')
    setTranscript('')
    setInterimTranscript('')
  }, [state])

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current as { stop: () => void } | null
    if (recognition) {
      recognition.stop()
      recognitionRef.current = null
    }
    setState('idle')
    setInterimTranscript('')
  }, [])

  const handleSend = useCallback(() => {
    const text = transcript.trim()
    if (!text) return
    onSend(text)
    setTranscript('')
    setInterimTranscript('')
    setState('idle')
  }, [transcript, onSend])

  const handleMicToggle = useCallback(() => {
    if (state === 'listening') {
      stopListening()
    } else {
      startListening()
    }
  }, [state, startListening, stopListening])

  const displayText = transcript + (interimTranscript ? ' ' + interimTranscript : '')

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #fff 0%, #fdf8f5 100%)',
        position: 'relative',
        gap: 32,
        padding: '40px 24px',
      }}
    >
      <style>{`
        @keyframes voice-pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes voice-ring {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes voice-dot-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes voice-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 8,
          borderRadius: 8,
          display: 'flex',
        }}
      >
        <X size={20} />
      </button>

      {/* Switch to keyboard */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 8,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
        }}
      >
        <Keyboard size={16} />
        Chat
      </button>

      {/* Agent name */}
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
        {agentName}
      </div>

      {/* Animated orb */}
      <div
        style={{
          position: 'relative',
          width: 160,
          height: 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Pulse rings */}
        {(state === 'listening' || state === 'speaking') && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: -20,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'voice-pulse 2s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: -10,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'voice-ring 2s ease-in-out infinite 0.3s',
              }}
            />
          </>
        )}

        {/* Thinking orbit */}
        {state === 'thinking' && (
          <div
            style={{
              position: 'absolute',
              inset: -16,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'var(--accent)',
              animation: 'voice-orbit 1.2s linear infinite',
            }}
          />
        )}

        {/* Main orb */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background:
              state === 'listening'
                ? 'linear-gradient(135deg, #EA580C, #f97316)'
                : state === 'thinking'
                  ? 'linear-gradient(135deg, #EA580C80, #f9731680)'
                  : state === 'speaking'
                    ? 'linear-gradient(135deg, #EA580C, #dc2626)'
                    : 'linear-gradient(135deg, #d4d4d4, #a3a3a3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.4s ease',
            boxShadow:
              state === 'listening'
                ? '0 0 40px rgba(234, 88, 12, 0.3)'
                : state === 'thinking'
                  ? '0 0 20px rgba(234, 88, 12, 0.15)'
                  : 'none',
          }}
        >
          {state === 'thinking' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#fff',
                    animation: `voice-dot-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                  }}
                />
              ))}
            </div>
          ) : (
            <Mic size={40} color="#fff" strokeWidth={1.5} />
          )}
        </div>
      </div>

      {/* State label */}
      <div
        style={{
          fontSize: 13,
          color: state === 'listening' ? 'var(--accent)' : 'var(--text-muted)',
          fontWeight: 500,
          minHeight: 20,
        }}
      >
        {state === 'idle' && 'Tap the mic to start'}
        {state === 'listening' && 'Listening...'}
        {state === 'thinking' && `${agentName} is thinking...`}
      </div>

      {/* Transcript area */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          minHeight: 60,
          padding: '12px 16px',
          background: displayText ? '#fff' : 'transparent',
          borderRadius: 12,
          border: displayText ? '1px solid var(--border)' : '1px solid transparent',
          fontSize: 15,
          color: 'var(--text)',
          lineHeight: 1.5,
          textAlign: 'center',
          transition: 'all 0.2s',
        }}
      >
        {displayText && (
          <>
            <span>{transcript}</span>
            {interimTranscript && (
              <span style={{ color: 'var(--text-muted)' }}> {interimTranscript}</span>
            )}
          </>
        )}

        {/* Last AI response */}
        {!displayText && lastAIMessage && state === 'idle' && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              maxHeight: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {lastAIMessage.length > 200 ? lastAIMessage.slice(0, 200) + '...' : lastAIMessage}
          </div>
        )}
      </div>

      {/* Transcript edit toggle */}
      {displayText && !showTranscriptInput && (
        <button
          onClick={() => setShowTranscriptInput(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--accent)',
            textDecoration: 'underline',
          }}
        >
          Edit transcript
        </button>
      )}

      {showTranscriptInput && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
                setShowTranscriptInput(false)
              }
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 14,
              fontFamily: 'inherit',
              color: 'var(--text)',
              background: '#fff',
              resize: 'none',
              outline: 'none',
              minHeight: 60,
            }}
          />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {!supported ? (
          <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center' }}>
            Speech recognition not supported in this browser.
            <br />
            Use Chrome or Edge for voice input.
          </div>
        ) : (
          <>
            {/* Mic button */}
            <button
              onClick={handleMicToggle}
              disabled={state === 'thinking'}
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: state === 'listening' ? 'var(--danger, #dc2626)' : 'var(--accent)',
                border: 'none',
                cursor: state === 'thinking' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: state === 'listening'
                  ? '0 0 0 4px rgba(220, 38, 38, 0.2)'
                  : '0 2px 8px rgba(234, 88, 12, 0.3)',
                transition: 'all 0.2s',
                opacity: state === 'thinking' ? 0.5 : 1,
              }}
            >
              {state === 'listening' ? <MicOff size={28} /> : <Mic size={28} />}
            </button>

            {/* Send button (visible when there's transcript) */}
            {transcript.trim() && state !== 'listening' && (
              <button
                onClick={() => {
                  handleSend()
                  setShowTranscriptInput(false)
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)',
                }}
              >
                <Send size={20} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default VoiceMode
