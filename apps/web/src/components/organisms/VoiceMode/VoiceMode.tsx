import React, { useEffect, useCallback, useRef, useState } from 'react'
import { Keyboard, GripHorizontal } from 'lucide-react'
import { Persona, type PersonaState } from '../../atoms/Persona/Persona'
import { apiUrl } from '../../../lib/api'

export interface VoiceModeProps {
  onSend: (message: string) => void
  onClose: () => void
  isTyping?: boolean
  agentName?: string
  lastAIMessage?: string
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  const res = await fetch(apiUrl('/api/voice/transcribe'), {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!res.ok) throw new Error('Transcription failed')
  const data = await res.json()
  return data.text || ''
}

async function playTTS(text: string, signal: AbortSignal): Promise<void> {
  const res = await fetch(apiUrl('/api/voice/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text, voice: 'echo' }),
    signal,
  })
  if (!res.ok) throw new Error('TTS failed')

  const audioCtx = new AudioContext()
  const arrayBuffer = await res.arrayBuffer()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

  return new Promise((resolve, reject) => {
    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioCtx.destination)
    source.onended = () => { audioCtx.close(); resolve() }
    signal.addEventListener('abort', () => {
      try { source.stop() } catch { /* ignore stop errors */ }
      audioCtx.close()
      reject(new DOMException('Aborted', 'AbortError'))
    })
    source.start()
  })
}

type Phase = 'idle' | 'recording' | 'transcribing' | 'waiting' | 'speaking'

export function VoiceMode({
  onSend,
  onClose,
  isTyping = false,
  agentName = 'Eric',
  lastAIMessage,
}: VoiceModeProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [transcript, setTranscript] = useState('')
  const prevAIMessageRef = useRef(lastAIMessage)
  const phaseRef = useRef<Phase>('idle')
  const ttsAbortRef = useRef<AbortController | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const silenceFramesRef = useRef(0)
  const monitorStreamRef = useRef<MediaStream | null>(null)
  const monitorCtxRef = useRef<AudioContext | null>(null)
  const monitorRafRef = useRef(0)

  const setPhaseSync = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const personaState: PersonaState =
    phase === 'speaking' ? 'speaking'
    : phase === 'waiting' || phase === 'transcribing' || isTyping ? 'thinking'
    : phase === 'recording' ? 'listening'
    : 'idle'

  // --- Barge-in: always monitor mic for voice activity during TTS ---
  const stopBargeInMonitor = useCallback(() => {
    cancelAnimationFrame(monitorRafRef.current)
    monitorCtxRef.current?.close().catch(() => {})
    monitorCtxRef.current = null
    monitorStreamRef.current?.getTracks().forEach((t) => t.stop())
    monitorStreamRef.current = null
  }, [])

  const startBargeInMonitor = useCallback(() => {
    stopBargeInMonitor()

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      monitorStreamRef.current = stream
      const ctx = new AudioContext()
      monitorCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      let voiceFrames = 0

      const check = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        if (avg > 25) {
          voiceFrames++
        } else {
          voiceFrames = 0
        }
        // 5 consecutive frames of voice (~170ms) = barge-in
        if (voiceFrames >= 5 && phaseRef.current === 'speaking') {
          // Interrupt TTS and start recording
          ttsAbortRef.current?.abort()
          stopBargeInMonitor()
          // Reuse this stream for recording
          startRecordingWithStream(stream)
          return
        }
        monitorRafRef.current = requestAnimationFrame(check)
      }
      monitorRafRef.current = requestAnimationFrame(check)
    }).catch(() => {})
  }, [stopBargeInMonitor])

  // --- Recording ---
  const startRecordingWithStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream
    chunksRef.current = []
    silenceFramesRef.current = 0

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm',
    })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      cancelAnimationFrame(rafRef.current)

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      if (blob.size < 1000) { setPhaseSync('idle'); return }

      setPhaseSync('transcribing')

      try {
        const text = await transcribeAudio(blob)
        if (!text.trim()) {
          setPhaseSync('idle')
          setTimeout(() => startRecording(), 200)
          return
        }
        setTranscript(text)
        // Send to chat immediately
        onSend(text)
        setPhaseSync('waiting')
      } catch (err) {
        console.error('Transcription error:', err)
        setPhaseSync('idle')
        setTimeout(() => startRecording(), 200)
      }
    }

    recorderRef.current = recorder
    recorder.start(250)
    setPhaseSync('recording')
    setTranscript('')

    // Silence detection
    const audioCtx = new AudioContext()
    const src = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    const freqData = new Uint8Array(analyser.frequencyBinCount)

    const checkSilence = () => {
      analyser.getByteFrequencyData(freqData)
      const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length
      if (avg < 15) {
        silenceFramesRef.current++
      } else {
        silenceFramesRef.current = 0
      }
      // ~1s of silence at 30fps
      if (silenceFramesRef.current >= 30 && recorderRef.current?.state === 'recording') {
        recorderRef.current.stop()
        audioCtx.close()
        return
      }
      rafRef.current = requestAnimationFrame(checkSilence)
    }
    rafRef.current = requestAnimationFrame(checkSilence)
  }, [onSend])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      startRecordingWithStream(stream)
    } catch (err) {
      console.error('Mic error:', err)
      setPhaseSync('idle')
    }
  }, [startRecordingWithStream])

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  // --- TTS when AI responds ---
  useEffect(() => {
    if (!lastAIMessage || lastAIMessage === prevAIMessageRef.current) return
    prevAIMessageRef.current = lastAIMessage

    ttsAbortRef.current?.abort()
    const controller = new AbortController()
    ttsAbortRef.current = controller

    setPhaseSync('speaking')

    // Start barge-in monitor so user can interrupt
    startBargeInMonitor()

    playTTS(lastAIMessage, controller.signal)
      .then(() => {
        stopBargeInMonitor()
        setPhaseSync('idle')
        setTimeout(() => startRecording(), 100)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('TTS error:', err)
        // If barge-in triggered, recording already started
        if (phaseRef.current !== 'recording') {
          stopBargeInMonitor()
          setPhaseSync('idle')
          setTimeout(() => startRecording(), 100)
        }
      })
  }, [lastAIMessage])

  useEffect(() => {
    if (isTyping && phase !== 'speaking' && phase !== 'recording') setPhaseSync('waiting')
  }, [isTyping])

  // Auto-start
  useEffect(() => {
    const t = setTimeout(() => startRecording(), 400)
    return () => clearTimeout(t)
  }, [])

  // Cleanup
  useEffect(() => () => {
    ttsAbortRef.current?.abort()
    cancelAnimationFrame(rafRef.current)
    stopBargeInMonitor()
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const handleOrbClick = () => {
    if (phase === 'speaking') {
      ttsAbortRef.current?.abort()
      stopBargeInMonitor()
      setPhaseSync('idle')
      setTimeout(() => startRecording(), 100)
    } else if (phase === 'recording') {
      stopRecording()
    } else if (phase === 'idle') {
      startRecording()
    }
  }

  // Drag
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.origX + ev.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 200, dragRef.current.origY + ev.clientY - dragRef.current.startY)),
      })
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  const _dragRefState = useRef<typeof dragRef.current>(null)
  // reuse pos from state

  const stateLabel =
    phase === 'recording' ? 'Listening...'
    : phase === 'transcribing' ? 'Transcribing...'
    : phase === 'waiting' ? `${agentName} is thinking...`
    : phase === 'speaking' ? `${agentName} is speaking... (talk to interrupt)`
    : 'Tap to start'

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 1000,
        width: 280,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <div
        onMouseDown={onDragStart}
        style={{
          width: '100%', padding: '8px 12px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          cursor: 'grab', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GripHorizontal size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{agentName}</span>
        </div>
        <button
          onClick={() => {
            ttsAbortRef.current?.abort()
            stopRecording()
            stopBargeInMonitor()
            streamRef.current?.getTracks().forEach((t) => t.stop())
            onClose()
          }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4,
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
          }}
        >
          <Keyboard size={12} /> Chat
        </button>
      </div>

      <div onClick={handleOrbClick} style={{ cursor: 'pointer', padding: '16px 0 8px' }}>
        <Persona state={personaState} variant="obsidian" style={{ width: 120, height: 120 }} />
      </div>

      <div style={{
        fontSize: 12,
        color: phase === 'recording' ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: 500, paddingBottom: 4, textAlign: 'center', padding: '0 12px 4px',
      }}>
        {stateLabel}
      </div>

      {transcript && (
        <div style={{
          width: '100%', padding: '6px 16px 12px', fontSize: 13,
          color: 'var(--text)', lineHeight: 1.4, textAlign: 'center',
          maxHeight: 60, overflow: 'hidden',
        }}>
          {transcript}
        </div>
      )}

      {!transcript && <div style={{ height: 12 }} />}
    </div>
  )
}

export default VoiceMode
