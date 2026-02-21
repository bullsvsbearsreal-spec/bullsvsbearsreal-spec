'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Play, Pause, RotateCcw } from 'lucide-react';
import { ALL_EXCHANGES } from '@/lib/constants';

/* ── scene config ─────────────────────────────────────────────── */
const SCENES = [
  { id: 'black',       ms: 1800 },
  { id: 'glitch-text', ms: 3200 },
  { id: 'chaos',       ms: 3600 },
  { id: 'logo-reveal', ms: 3000 },
  { id: 'tagline',     ms: 2800 },
  { id: 'montage-1',   ms: 2600 },
  { id: 'montage-2',   ms: 2600 },
  { id: 'montage-3',   ms: 2600 },
  { id: 'montage-4',   ms: 2600 },
  { id: 'stats',       ms: 4000 },
  { id: 'quote',       ms: 3400 },
  { id: 'cta',         ms: 6000 },
] as const;

const TOTAL_MS = SCENES.reduce((s, sc) => s + sc.ms, 0);

/* ── page ─────────────────────────────────────────────────────── */
export default function TrailerPage() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const frameRef = useRef<number>(0);

  // advance scenes + track elapsed
  const tick = useCallback(() => {
    const now = Date.now() - startRef.current;
    setElapsed(now);

    let acc = 0;
    for (let i = 0; i < SCENES.length; i++) {
      acc += SCENES[i].ms;
      if (now < acc) { setIdx(i); break; }
      if (i === SCENES.length - 1) setIdx(i);
    }

    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!playing) { cancelAnimationFrame(frameRef.current); return; }
    startRef.current = Date.now() - elapsed;
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, tick]);

  const replay = () => { setIdx(0); setElapsed(0); startRef.current = Date.now(); setPlaying(true); };
  const progress = Math.min(elapsed / TOTAL_MS, 1);

  const sceneId = SCENES[idx]?.id ?? 'cta';

  // time within current scene (0→1)
  let sceneStart = 0;
  for (let i = 0; i < idx; i++) sceneStart += SCENES[i].ms;
  const sceneT = Math.min((elapsed - sceneStart) / SCENES[idx].ms, 1);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* circuit bg */}
      <CircuitBG />

      {/* progress */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-white/[0.04]">
        <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* controls */}
      <div className="fixed top-4 right-4 flex gap-2 z-50">
        <Btn onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} /> : <Play size={16} />}</Btn>
        <Btn onClick={() => router.push('/')}>Skip</Btn>
      </div>

      {/* ─── SCENES ─── */}

      {sceneId === 'black' && (
        <Centered>
          <p className="text-neutral-600 text-sm tracking-[0.3em] uppercase animate-[fadeIn_1s_ease]">
            info-hub.io presents
          </p>
        </Centered>
      )}

      {sceneId === 'glitch-text' && (
        <Centered>
          <div className="space-y-4 text-center">
            <Line t={sceneT} delay={0}>The crypto market moves at light speed.</Line>
            <Line t={sceneT} delay={0.25}>Billions liquidated in minutes.</Line>
            <Line t={sceneT} delay={0.5}>Funding rates flip in seconds.</Line>
          </div>
          <ScanLines />
        </Centered>
      )}

      {sceneId === 'chaos' && (
        <Centered>
          <div className="text-center">
            <p className="text-4xl md:text-6xl lg:text-7xl font-black animate-[scaleIn_0.6s_ease]">
              <span className="text-red-500">Scattered data.</span>
            </p>
            <p className="text-4xl md:text-6xl lg:text-7xl font-black mt-3 animate-[scaleIn_0.6s_0.4s_ease_both]">
              <span className="text-red-400/80">Delayed signals.</span>
            </p>
            <p className="text-4xl md:text-6xl lg:text-7xl font-black mt-3 animate-[scaleIn_0.6s_0.8s_ease_both]">
              <span className="text-red-300/60">Missed trades.</span>
            </p>
            <p className="text-2xl md:text-3xl font-bold text-neutral-500 mt-8 animate-[fadeIn_1s_1.5s_ease_both]">
              Until now.
            </p>
          </div>
          <ScanLines />
        </Centered>
      )}

      {sceneId === 'logo-reveal' && (
        <Centered>
          <div className="flex flex-col items-center animate-[scaleIn_0.8s_ease]">
            <div className="relative">
              <div className="absolute -inset-16 bg-amber-500/20 blur-[100px] rounded-full animate-pulse" />
              <CircuitIcon size={120} />
            </div>
            <h1 className="mt-6 text-6xl md:text-8xl lg:text-9xl font-black tracking-tight">
              <span className="text-white">Info</span>
              <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">Hub</span>
            </h1>
          </div>
        </Centered>
      )}

      {sceneId === 'tagline' && (
        <Centered>
          <div className="text-center animate-[fadeIn_1s_ease]">
            <p className="text-3xl md:text-5xl font-bold text-white">
              Real-time data from <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">{ALL_EXCHANGES.length} exchanges</span>
            </p>
            <p className="text-xl md:text-2xl text-neutral-500 mt-4">
              Aggregated. Analyzed. Actionable.
            </p>
          </div>
        </Centered>
      )}

      {sceneId === 'montage-1' && (
        <MontageSlide
          title="Liquidation Heatmap"
          desc={`See every forced closure across ${ALL_EXCHANGES.length} exchanges in real-time`}
          color="#EF4444"
          icon="🔥"
          features={['CEX & DEX filtering', 'Timeline chart', 'Exchange heatmap', 'Sound alerts']}
        />
      )}

      {sceneId === 'montage-2' && (
        <MontageSlide
          title="Funding Rates"
          desc="Track funding across every perpetual market — spot arbitrage instantly"
          color="#FFA500"
          icon="💰"
          features={['Multi-exchange comparison', 'Funding heatmap', 'Arbitrage scanner', 'Historical charts']}
        />
      )}

      {sceneId === 'montage-3' && (
        <MontageSlide
          title="Open Interest"
          desc="$60B+ in open interest tracked — know where the money is"
          color="#3B82F6"
          icon="📊"
          features={['Total OI tracking', 'Per-exchange breakdown', 'OI change alerts', 'Historical data']}
        />
      )}

      {sceneId === 'montage-4' && (
        <MontageSlide
          title="And So Much More"
          desc="35+ tools for every dimension of the crypto market"
          color="#8B5CF6"
          icon="⚡"
          features={['Long/Short Ratios', 'Whale Alerts', 'Options Flow', 'News Feed', 'Fear & Greed', 'CVD Tracker', 'Market Heatmap', 'RSI Heatmap']}
        />
      )}

      {sceneId === 'stats' && (
        <Centered>
          <div className="flex flex-wrap justify-center gap-10 md:gap-20">
            <StatCounter value="27" label="Exchanges" t={sceneT} delay={0} />
            <StatCounter value="35+" label="Tools" t={sceneT} delay={0.15} />
            <StatCounter value="24/7" label="Real-Time" t={sceneT} delay={0.3} />
            <StatCounter value="$60B+" label="OI Tracked" t={sceneT} delay={0.45} />
          </div>
        </Centered>
      )}

      {sceneId === 'quote' && (
        <Centered>
          <div className="text-center max-w-3xl animate-[fadeIn_1s_ease]">
            <p className="text-3xl md:text-5xl font-black text-white leading-tight">
              Don&apos;t trade <span className="text-neutral-500">blind</span>.
            </p>
            <p className="text-3xl md:text-5xl font-black mt-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent leading-tight">
              Trade informed.
            </p>
          </div>
        </Centered>
      )}

      {sceneId === 'cta' && (
        <Centered>
          <div className="text-center animate-[scaleIn_0.8s_ease]">
            <div className="flex items-center justify-center gap-3 mb-6">
              <CircuitIcon size={48} />
              <h2 className="text-4xl md:text-5xl font-black">
                <span className="text-white">Info</span>
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Hub</span>
              </h2>
            </div>
            <p className="text-xl text-neutral-400 mb-10">
              Free. No signup. Open it and trade.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="group flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-lg rounded-xl hover:brightness-110 transition-all shadow-lg shadow-amber-500/25"
              >
                Launch InfoHub
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={replay}
                className="flex items-center gap-2 px-8 py-4 bg-white/[0.06] hover:bg-white/[0.1] text-white font-medium rounded-xl transition-colors"
              >
                <RotateCcw size={16} />
                Watch Again
              </button>
            </div>
            <p className="mt-8 text-sm text-neutral-600">info-hub.io</p>
          </div>
        </Centered>
      )}

      {/* dot nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-50">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => {
              let t = 0;
              for (let j = 0; j < i; j++) t += SCENES[j].ms;
              setElapsed(t); startRef.current = Date.now() - t; setIdx(i);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === idx ? 'w-6 bg-amber-500' : i < idx ? 'w-1.5 bg-amber-500/40' : 'w-1.5 bg-white/10'
            }`}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes lineGrow { from{width:0} to{width:100%} }
      `}</style>
    </div>
  );
}

/* ── sub-components ──────────────────────────────────────────── */

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 flex items-center justify-center p-8">{children}</div>;
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5 text-white/70">
      {children}
    </button>
  );
}

function Line({ t, delay, children }: { t: number; delay: number; children: string }) {
  const visible = t >= delay;
  if (!visible) return null;
  return (
    <p className="text-2xl md:text-4xl font-bold text-white/90 animate-[slideUp_0.8s_ease]">
      {children}
    </p>
  );
}

function ScanLines() {
  return (
    <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{
      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)',
    }} />
  );
}

function MontageSlide({ title, desc, color, icon, features }: {
  title: string; desc: string; color: string; icon: string; features: string[];
}) {
  return (
    <Centered>
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-4 animate-[slideUp_0.6s_ease]">
          <span className="text-4xl">{icon}</span>
          <h2 className="text-3xl md:text-5xl font-black text-white">{title}</h2>
        </div>
        <p className="text-lg md:text-xl text-neutral-400 mb-8 animate-[fadeIn_0.8s_0.2s_ease_both]">{desc}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {features.map((f, i) => (
            <div
              key={f}
              className="px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.03] animate-[slideUp_0.5s_ease_both]"
              style={{ animationDelay: `${0.1 + i * 0.08}s`, borderLeftColor: color, borderLeftWidth: 2 }}
            >
              <span className="text-sm font-medium text-white/80">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </Centered>
  );
}

function StatCounter({ value, label, t, delay }: { value: string; label: string; t: number; delay: number }) {
  const visible = t >= delay;
  if (!visible) return null;
  return (
    <div className="text-center animate-[scaleIn_0.6s_ease]">
      <div className="text-5xl md:text-7xl font-black bg-gradient-to-b from-amber-400 to-orange-500 bg-clip-text text-transparent">
        {value}
      </div>
      <div className="mt-2 text-base md:text-lg text-neutral-500 font-medium">{label}</div>
    </div>
  );
}

function CircuitIcon({ size }: { size: number }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill="none" className="flex-shrink-0">
      <defs>
        <linearGradient id="tr-g" x1="40" y1="80" x2="480" y2="440" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD700" />
          <stop offset="0.45" stopColor="#FFA500" />
          <stop offset="1" stopColor="#E67300" />
        </linearGradient>
        <linearGradient id="tr-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#101820" />
          <stop offset="0.6" stopColor="#0C1219" />
          <stop offset="1" stopColor="#080E14" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="92" fill="url(#tr-bg)" />
      <rect x="18" y="18" width="476" height="476" rx="90" fill="none" stroke="#D4922A" strokeWidth="1.2" strokeOpacity={0.1} />
      <line x1="106" y1="142" x2="206" y2="142" stroke="url(#tr-g)" strokeWidth="15" strokeLinecap="round" />
      <line x1="155" y1="142" x2="155" y2="382" stroke="url(#tr-g)" strokeWidth="15" strokeLinecap="round" />
      <line x1="106" y1="382" x2="206" y2="382" stroke="url(#tr-g)" strokeWidth="15" strokeLinecap="round" />
      <circle cx="106" cy="142" r="12" fill="url(#tr-g)" />
      <circle cx="206" cy="142" r="11" fill="url(#tr-g)" />
      <circle cx="106" cy="382" r="11" fill="url(#tr-g)" />
      <circle cx="206" cy="382" r="12" fill="url(#tr-g)" />
      <circle cx="155" cy="90" r="18" fill="url(#tr-g)" />
      <circle cx="155" cy="90" r="10" fill="url(#tr-bg)" />
      <line x1="282" y1="142" x2="282" y2="382" stroke="url(#tr-g)" strokeWidth="15" strokeLinecap="round" />
      <line x1="408" y1="142" x2="408" y2="382" stroke="url(#tr-g)" strokeWidth="15" strokeLinecap="round" />
      <line x1="282" y1="262" x2="408" y2="262" stroke="url(#tr-g)" strokeWidth="15" strokeLinecap="round" />
      <circle cx="282" cy="142" r="11" fill="url(#tr-g)" />
      <circle cx="282" cy="262" r="12" fill="url(#tr-g)" />
      <circle cx="282" cy="382" r="11" fill="url(#tr-g)" />
      <circle cx="408" cy="142" r="12" fill="url(#tr-g)" />
      <circle cx="408" cy="262" r="11" fill="url(#tr-g)" />
      <circle cx="408" cy="382" r="12" fill="url(#tr-g)" />
    </svg>
  );
}

function CircuitBG() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.025]">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="cbg-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#FFA500" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cbg-grid)" />
        {/* random circuit traces */}
        <line x1="160" y1="0" x2="160" y2="100%" stroke="#FFA500" strokeWidth="1" opacity="0.6" />
        <line x1="480" y1="0" x2="480" y2="100%" stroke="#FFA500" strokeWidth="1" opacity="0.4" />
        <line x1="0" y1="240" x2="100%" y2="240" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
        <line x1="0" y1="560" x2="100%" y2="560" stroke="#FFA500" strokeWidth="1" opacity="0.3" />
        <circle cx="160" cy="240" r="4" fill="#FFA500" opacity="0.8" />
        <circle cx="480" cy="240" r="3" fill="#FFA500" opacity="0.6" />
        <circle cx="160" cy="560" r="3.5" fill="#FFA500" opacity="0.5" />
        <circle cx="480" cy="560" r="4" fill="#FFA500" opacity="0.7" />
      </svg>
    </div>
  );
}
