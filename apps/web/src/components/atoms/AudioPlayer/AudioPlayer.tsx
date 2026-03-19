import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'
import { t } from '../../../locales/en'

export interface AudioPlayerProps {
  url: string
  duration: string
  waveform?: number[]
  onPlayStateChange?: (playing: boolean) => void
}

export function AudioPlayer({ url, duration, waveform, onPlayStateChange }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  useEffect(() => {
    const audio = new Audio(url)
    audioRef.current = audio

    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration)
      }
    }
    const onEnded = () => {
      setPlaying(false)
      setProgress(0)
      onPlayStateChange?.(false)
    }
    const onLoaded = () => {
      setAudioDuration(audio.duration)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('loadedmetadata', onLoaded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.pause()
    }
  }, [url, onPlayStateChange])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      onPlayStateChange?.(false)
    } else {
      audio.play().catch(() => {})
      setPlaying(true)
      onPlayStateChange?.(true)
    }
  }, [playing, onPlayStateChange])

  const handleSeek = useCallback((e: React.MouseEvent<SVGSVGElement | HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const audio = audioRef.current
    if (audio && audio.duration) {
      audio.currentTime = ratio * audio.duration
      setProgress(ratio)
    }
  }, [])

  const formatRemaining = () => {
    if (!playing || !audioDuration) return duration
    const remaining = audioDuration - (progress * audioDuration)
    const mins = Math.floor(remaining / 60)
    const secs = Math.floor(remaining % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const BARS = waveform ?? []
  const BAR_COUNT = BARS.length
  const BAR_WIDTH = 3
  const BAR_GAP = 2
  const SVG_HEIGHT = 28

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        aria-label={playing ? t.audio.pause : t.audio.play}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
      </button>

      {/* Waveform or progress bar */}
      {BAR_COUNT > 0 ? (
        <svg
          width={BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP}
          height={SVG_HEIGHT}
          style={{ flex: 1, cursor: 'pointer', display: 'block' }}
          onClick={handleSeek}
          aria-hidden="true"
        >
          {BARS.map((val, i) => {
            const barHeight = Math.max(4, val * SVG_HEIGHT)
            const barProgress = (i + 0.5) / BAR_COUNT
            const filled = barProgress <= progress
            return (
              <rect
                key={i}
                x={i * (BAR_WIDTH + BAR_GAP)}
                y={(SVG_HEIGHT - barHeight) / 2}
                width={BAR_WIDTH}
                height={barHeight}
                rx={1.5}
                fill={filled ? 'var(--accent)' : 'var(--border)'}
              />
            )
          })}
        </svg>
      ) : (
        <div
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: 'var(--border)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={handleSeek}
          aria-hidden="true"
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${progress * 100}%`,
              background: 'var(--accent)',
              borderRadius: 2,
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      )}

      {/* Duration */}
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          minWidth: 32,
          textAlign: 'right',
        }}
      >
        {formatRemaining()}
      </span>
    </div>
  )
}

export default AudioPlayer
