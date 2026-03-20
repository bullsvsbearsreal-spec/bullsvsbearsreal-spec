'use client'

import { useCallback, useRef, useEffect, useState } from 'react'

const STORAGE_KEY = 'infohub:sound:enabled'

// Synthesize short UI sounds via Web Audio API — no audio files needed
function createContext(): AudioContext | null {
  try {
    return new AudioContext()
  } catch {
    return null
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.12,
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const [enabled, setEnabled] = useState(false)

  // Hydrate from localStorage
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {}
  }, [])

  // Lazy-init AudioContext on first use (requires user gesture)
  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = createContext()
    const ctx = ctxRef.current
    if (ctx?.state === 'suspended') ctx.resume()
    return ctx
  }, [])

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const canPlay = useCallback(() => {
    return enabled && !prefersReduced
  }, [enabled, prefersReduced])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      // Play a short blip when turning on so user gets confirmation
      if (next) {
        const ctx = getCtx()
        if (ctx) playTone(ctx, 880, 0.08, 'sine', 0.1)
      }
      return next
    })
  }, [getCtx])

  // Subtle click — short high-freq blip
  const playClick = useCallback(() => {
    if (!canPlay()) return
    const ctx = getCtx()
    if (ctx) playTone(ctx, 1200, 0.04, 'sine', 0.06)
  }, [canPlay, getCtx])

  // Success — ascending two-tone
  const playSuccess = useCallback(() => {
    if (!canPlay()) return
    const ctx = getCtx()
    if (!ctx) return
    playTone(ctx, 660, 0.1, 'sine', 0.1)
    setTimeout(() => playTone(ctx, 880, 0.12, 'sine', 0.1), 80)
  }, [canPlay, getCtx])

  // Alert — attention-grabbing mid-freq pulse
  const playAlert = useCallback(() => {
    if (!canPlay()) return
    const ctx = getCtx()
    if (!ctx) return
    playTone(ctx, 520, 0.15, 'triangle', 0.15)
    setTimeout(() => playTone(ctx, 520, 0.15, 'triangle', 0.15), 180)
  }, [canPlay, getCtx])

  // Liquidation — deep thud
  const playLiquidation = useCallback(() => {
    if (!canPlay()) return
    const ctx = getCtx()
    if (!ctx) return
    playTone(ctx, 180, 0.25, 'sine', 0.18)
    playTone(ctx, 90, 0.3, 'sine', 0.12)
  }, [canPlay, getCtx])

  return { enabled, toggle, playClick, playSuccess, playAlert, playLiquidation }
}
