'use client';

import { useState, useEffect, useRef } from 'react';
import { BarChart3, TrendingUp, Briefcase, ArrowRight, X, Repeat, Eye, Globe } from 'lucide-react';

interface PersonaSelectorProps {
  onSelect: (presetId: string | null) => void;
}

const PERSONAS = [
  {
    id: 'trader',
    presetId: 'trader',
    label: 'Funding & Arb Trader',
    description: 'Funding rates, spreads, arbitrage opportunities',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/30 hover:border-emerald-400/50',
    iconColor: 'text-emerald-400',
  },
  {
    id: 'analyst',
    presetId: 'defi',
    label: 'Derivatives Analyst',
    description: 'Open interest, liquidations, market structure',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-blue-500/20 to-blue-500/5',
    border: 'border-blue-500/30 hover:border-blue-400/50',
    iconColor: 'text-blue-400',
  },
  {
    id: 'investor',
    presetId: 'investor',
    label: 'Portfolio Tracker',
    description: 'Portfolio, watchlist, alerts, news & events',
    icon: <Briefcase className="w-5 h-5" />,
    color: 'from-purple-500/20 to-purple-500/5',
    border: 'border-purple-500/30 hover:border-purple-400/50',
    iconColor: 'text-purple-400',
  },
  {
    id: 'arb',
    presetId: 'funding-arb',
    label: 'Funding Arbitrageur',
    description: 'Cross-exchange funding arb, slippage, execution',
    icon: <Repeat className="w-5 h-5" />,
    color: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/30 hover:border-amber-400/50',
    iconColor: 'text-amber-400',
  },
  {
    id: 'whale',
    presetId: 'whale-watcher',
    label: 'Whale Watcher',
    description: 'Large positions, liquidations, CVD, flow analysis',
    icon: <Eye className="w-5 h-5" />,
    color: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/30 hover:border-cyan-400/50',
    iconColor: 'text-cyan-400',
  },
  {
    id: 'macro',
    presetId: 'macro-monitor',
    label: 'Macro Monitor',
    description: 'Economic events, sentiment, market structure',
    icon: <Globe className="w-5 h-5" />,
    color: 'from-rose-500/20 to-rose-500/5',
    border: 'border-rose-500/30 hover:border-rose-400/50',
    iconColor: 'text-rose-400',
  },
] as const;

export default function PersonaSelector({ onSelect }: PersonaSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelect(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSelect]);

  const handleConfirm = () => {
    const persona = PERSONAS.find((p) => p.id === selected);
    if (persona) {
      try { localStorage.setItem('infohub-persona', persona.id); } catch {}
    }
    onSelect(persona ? persona.presetId : null);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onSelect(null); }}
    >
      <div className="w-full max-w-md mx-4 bg-hub-darker border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Welcome to InfoHub</h2>
            <p className="text-sm text-neutral-500 mt-1">
              What best describes you? We&apos;ll customize your dashboard.
            </p>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="text-neutral-600 hover:text-white transition-colors p-1 -mr-1 -mt-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Persona cards */}
        <div className="px-6 space-y-2.5 overflow-y-auto max-h-[340px] scrollbar-accent">
          {PERSONAS.map((persona) => (
            <button
              key={persona.id}
              onClick={() => setSelected(persona.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all text-left bg-gradient-to-r ${persona.color} ${
                selected === persona.id
                  ? `${persona.border} ring-1 ring-white/10 scale-[1.01]`
                  : 'border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className={`flex-shrink-0 ${persona.iconColor}`}>
                {persona.icon}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${selected === persona.id ? 'text-white' : 'text-neutral-300'}`}>
                  {persona.label}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{persona.description}</p>
              </div>
              {selected === persona.id && (
                <div className="ml-auto flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-hub-yellow/20 border border-hub-yellow/40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-hub-yellow" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 mt-2 flex items-center justify-between">
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Just explore
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              selected
                ? 'bg-hub-yellow text-black hover:bg-hub-yellow/90'
                : 'bg-white/[0.04] text-neutral-600 cursor-not-allowed'
            }`}
          >
            Set up my dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
