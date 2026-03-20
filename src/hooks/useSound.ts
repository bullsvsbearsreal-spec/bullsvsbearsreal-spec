'use client'

import { useCallback, useRef, useEffect, useState } from 'react'

const STORAGE_KEY = 'infohub:sound:enabled'

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.25,
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

async function ensureCtx(ref: React.MutableRefObject<AudioContext | null>): Promise<AudioContext | null> {
  try {
    if (!ref.current) ref.current = new AudioContext()
    const ctx = ref.current
    if (ctx.state === 'suspended') await ctx.resume()
    return ctx
  } catch {
    return null
  }
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

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const toggle = useCallback(async () => {
    const next = !enabled
    setEnabled(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
    // Play a confirmation blip when turning on
    if (next) {
      const ctx = await ensureCtx(ctxRef)
      if (ctx) playTone(ctx, 880, 0.12, 'sine', 0.3)
    }
  }, [enabled])

  // Subtle click
  const playClick = useCallback(async () => {
    if (!enabled || prefersReduced) return
    const ctx = await ensureCtx(ctxRef)
    if (ctx) playTone(ctx, 1200, 0.06, 'sine', 0.15)
  }, [enabled, prefersReduced])

  // Success — ascending two-tone
  const playSuccess = useCallback(async () => {
    if (!enabled || prefersReduced) return
    const ctx = await ensureCtx(ctxRef)
    if (!ctx) return
    playTone(ctx, 660, 0.12, 'sine', 0.2)
    setTimeout(() => playTone(ctx, 880, 0.15, 'sine', 0.2), 80)
  }, [enabled, prefersReduced])

  // Alert — attention-grabbing mid-freq pulse
  const playAlert = useCallback(async () => {
    if (!enabled || prefersReduced) return
    const ctx = await ensureCtx(ctxRef)
    if (!ctx) return
    playTone(ctx, 520, 0.18, 'triangle', 0.3)
    setTimeout(() => playTone(ctx, 520, 0.18, 'triangle', 0.3), 180)
  }, [enabled, prefersReduced])

  // Liquidation — deep thud
  const playLiquidation = useCallback(async () => {
    if (!enabled || prefersReduced) return
    const ctx = await ensureCtx(ctxRef)
    if (!ctx) return
    playTone(ctx, 180, 0.3, 'sine', 0.35)
    playTone(ctx, 90, 0.35, 'sine', 0.25)
  }, [enabled, prefersReduced])

  return { enabled, toggle, playClick, playSuccess, playAlert, playLiquidation }
}
