import { useState, useRef, useCallback, useEffect } from 'react'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (e: SpeechRecognitionEvent) => void
  onerror: (e: SpeechRecognitionErrorEvent) => void
  onend: () => void
  start: () => void
  stop: () => void
  abort: () => void
}

export interface UseSpeechToTextOptions {
  /** Auto-send after silence (ms). 0 = disabled. */
  autoSendDelay?: number
  /** BCP-47 language tag, e.g. 'pt-BR'. Defaults to navigator.language */
  lang?: string
  onTranscript?: (text: string) => void
  onAutoSend?: (text: string) => void
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
  const { autoSendDelay = 0, lang, onTranscript, onAutoSend } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [supported, setSupported] = useState(true)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptRef = useRef('')

  useEffect(() => {
    const SR =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability check
    if (!SR) setSupported(false)
  }, [])

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer()
    if (autoSendDelay > 0 && transcriptRef.current.trim()) {
      silenceTimerRef.current = setTimeout(() => {
        const text = transcriptRef.current.trim()
        if (text) {
          onAutoSend?.(text)
          setTranscript('')
          setInterimTranscript('')
          transcriptRef.current = ''
        }
      }, autoSendDelay)
    }
  }, [autoSendDelay, onAutoSend, clearSilenceTimer])

  const start = useCallback(() => {
    const SR =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SR) return

    const recognition = new (SR as new () => SpeechRecognitionInstance)()
    recognition.continuous = true
    recognition.interimResults = true
    // Resolve full BCP-47 tag: 'pt' → 'pt-BR', 'en' → 'en-US'
    const browserLang = lang || navigator.language || 'en-US'
    recognition.lang = browserLang.length === 2
      ? { pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }[browserLang] ?? browserLang
      : browserLang

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
        const updated = transcriptRef.current ? transcriptRef.current + ' ' + final : final
        transcriptRef.current = updated
        setTranscript(updated)
        setInterimTranscript('')
        onTranscript?.(updated)
        resetSilenceTimer()
      } else {
        setInterimTranscript(interim)
        clearSilenceTimer()
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') {
        console.error('Speech recognition error:', e.error)
      }
      setIsListening(false)
      clearSilenceTimer()
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setTranscript('')
    setInterimTranscript('')
    transcriptRef.current = ''
  }, [onTranscript, resetSilenceTimer, clearSilenceTimer, lang])

  const stop = useCallback(() => {
    clearSilenceTimer()
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [clearSilenceTimer])

  const toggle = useCallback(() => {
    if (isListening) {
      stop()
    } else {
      start()
    }
  }, [isListening, start, stop])

  const clear = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    transcriptRef.current = ''
    clearSilenceTimer()
  }, [clearSilenceTimer])

  useEffect(() => {
    return () => {
      clearSilenceTimer()
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [clearSilenceTimer])

  return {
    isListening,
    transcript,
    interimTranscript,
    supported,
    start,
    stop,
    toggle,
    clear,
    setTranscript,
  }
}
