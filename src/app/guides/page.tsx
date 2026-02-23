'use client';

import { useState } from 'react';
import {
  HardHat, Construction, BookOpen, TrendingUp, BarChart3,
  Zap, ArrowLeftRight, Shield, PieChart, Bell,
  ChevronRight, Lock,
} from 'lucide-react';

/* ─── Upcoming guide topics ─────────────────────────────────────── */

const upcomingGuides = [
  {
    title: 'Funding Rate Arbitrage',
    desc: 'How to exploit funding rate differentials across exchanges for market-neutral profits.',
    icon: ArrowLeftRight,
    tag: 'Strategy',
    difficulty: 'Intermediate',
  },
  {
    title: 'Reading Open Interest',
    desc: 'Understanding what OI changes tell you about market positioning and potential squeezes.',
    icon: BarChart3,
    tag: 'Analysis',
    difficulty: 'Beginner',
  },
  {
    title: 'Liquidation Cascades',
    desc: 'How leveraged liquidations create cascading price movements and how to trade them.',
    icon: Zap,
    tag: 'Trading',
    difficulty: 'Advanced',
  },
  {
    title: 'Order Flow Basics',
    desc: 'Reading the tape, understanding bid/ask imbalances, and spotting large players.',
    icon: TrendingUp,
    tag: 'Analysis',
    difficulty: 'Intermediate',
  },
  {
    title: 'Options Max Pain Theory',
    desc: 'How options expiry and max pain levels influence spot and futures prices.',
    icon: Shield,
    tag: 'Options',
    difficulty: 'Advanced',
  },
  {
    title: 'Portfolio Risk Management',
    desc: 'Position sizing, correlation-aware hedging, and managing drawdowns in crypto.',
    icon: PieChart,
    tag: 'Risk',
    difficulty: 'Beginner',
  },
];

const difficultyColor: Record<string, string> = {
  Beginner: 'text-green-400 bg-green-400/10 border-green-400/20',
  Intermediate: 'text-hub-yellow bg-hub-yellow/10 border-hub-yellow/20',
  Advanced: 'text-red-400 bg-red-400/10 border-red-400/20',
};

/* ─── Page ──────────────────────────────────────────────────────── */

export default function GuidesPage() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-hub-dark relative overflow-hidden">
      {/* ─── Construction tape borders ─── */}
      <div className="absolute top-0 left-0 right-0 h-2 construction-tape z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-2 construction-tape z-10" />

      {/* ─── Subtle grid background ─── */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(234,179,8,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(234,179,8,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ─── Floating construction particles ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-hub-yellow/20 rounded-full construction-particle"
            style={{
              left: `${15 + i * 15}%`,
              animationDelay: `${i * 1.2}s`,
              animationDuration: `${6 + i * 0.8}s`,
            }}
          />
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 relative z-10">
        {/* ─── Hero section ─── */}
        <div className="text-center mb-16">
          {/* Warning beacon */}
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center construction-beacon">
                <Construction className="w-10 h-10 text-hub-yellow" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-hub-yellow rounded-full construction-pulse" />
            </div>
          </div>

          {/* Stencil headline */}
          <div className="relative inline-block mb-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase">
              Trading <span className="text-hub-yellow">Guides</span>
            </h1>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32 h-0.5 bg-hub-yellow/40" />
          </div>

          <div className="flex items-center justify-center gap-3 mt-6 mb-4">
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-hub-yellow/30" />
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 text-hub-yellow text-xs font-bold tracking-widest uppercase">
              <HardHat className="w-3.5 h-3.5" />
              Under Construction
            </span>
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-hub-yellow/30" />
          </div>

          <p className="text-neutral-500 text-sm sm:text-base max-w-lg mx-auto leading-relaxed mt-4">
            We&apos;re building in-depth guides on derivatives trading, market analysis, and strategy.
            The first guides will be published soon.
          </p>
        </div>

        {/* ─── Upcoming guides grid ─── */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-4 h-4 text-hub-yellow" />
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Coming Soon</h2>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingGuides.map((guide, i) => (
              <div
                key={guide.title}
                className="group relative bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 transition-all duration-300 hover:border-hub-yellow/20 hover:bg-white/[0.04] cursor-default guide-card-enter"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Lock overlay */}
                <div className="absolute top-3 right-3 opacity-30 group-hover:opacity-50 transition-opacity">
                  <Lock className="w-3.5 h-3.5 text-neutral-600" />
                </div>

                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-hub-yellow/[0.07] border border-hub-yellow/10 flex items-center justify-center mb-3 group-hover:border-hub-yellow/25 transition-colors">
                  <guide.icon className="w-4 h-4 text-hub-yellow/70 group-hover:text-hub-yellow transition-colors" />
                </div>

                {/* Content */}
                <h3 className="text-sm font-bold text-neutral-200 mb-1.5 group-hover:text-white transition-colors">
                  {guide.title}
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-3 line-clamp-2">
                  {guide.desc}
                </p>

                {/* Tags */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.04] text-neutral-500 border border-white/[0.06]">
                    {guide.tag}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${difficultyColor[guide.difficulty]}`}>
                    {guide.difficulty}
                  </span>
                </div>

                {/* Bottom accent on hover */}
                <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-hub-yellow/0 to-transparent group-hover:via-hub-yellow/30 transition-all duration-500" />
              </div>
            ))}
          </div>
        </div>

        {/* ─── Notify section ─── */}
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6 sm:p-8 relative overflow-hidden">
            {/* Corner tape decoration */}
            <div className="absolute -top-1 -left-1 w-12 h-12 overflow-hidden">
              <div className="absolute top-2 -left-4 w-20 h-3 bg-hub-yellow/20 rotate-[-45deg] construction-tape-mini" />
            </div>
            <div className="absolute -top-1 -right-1 w-12 h-12 overflow-hidden">
              <div className="absolute top-2 -right-4 w-20 h-3 bg-hub-yellow/20 rotate-[45deg] construction-tape-mini" />
            </div>

            <Bell className="w-5 h-5 text-hub-yellow mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Get Notified</h3>
            <p className="text-xs text-neutral-600 mb-5">
              Be the first to know when new guides drop.
            </p>

            {subscribed ? (
              <div className="flex items-center justify-center gap-2 py-2.5 text-green-400 text-sm font-medium">
                <span className="w-5 h-5 rounded-full bg-green-400/10 flex items-center justify-center text-xs">&#10003;</span>
                You&apos;ll be notified!
              </div>
            ) : (
              <form onSubmit={handleNotify} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-hub-yellow/30 transition-colors"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-hub-yellow text-black text-sm font-bold rounded-lg hover:bg-hub-yellow/90 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  Notify Me
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ─── Bottom progress indicator ─── */}
        <div className="mt-16 flex items-center justify-center gap-4 text-neutral-700 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-hub-yellow/40 construction-pulse" />
            <span className="font-mono">Building guides...</span>
          </div>
        </div>
      </div>

      {/* ─── Inline styles for animations ─── */}
      <style jsx>{`
        .construction-tape {
          background: repeating-linear-gradient(
            -45deg,
            #eab308,
            #eab308 10px,
            #1a1a1a 10px,
            #1a1a1a 20px
          );
          opacity: 0.6;
        }
        .construction-tape-mini {
          background: repeating-linear-gradient(
            -45deg,
            rgba(234,179,8,0.4),
            rgba(234,179,8,0.4) 3px,
            transparent 3px,
            transparent 6px
          );
        }
        .construction-beacon {
          animation: beacon-glow 3s ease-in-out infinite;
        }
        @keyframes beacon-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234,179,8,0); }
          50% { box-shadow: 0 0 30px 4px rgba(234,179,8,0.12); }
        }
        .construction-pulse {
          animation: c-pulse 2s ease-in-out infinite;
        }
        @keyframes c-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        .construction-particle {
          animation: particle-float linear infinite;
        }
        @keyframes particle-float {
          0% { top: 110%; opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          100% { top: -5%; opacity: 0; }
        }
        .guide-card-enter {
          animation: card-enter 0.5s ease-out both;
        }
        @keyframes card-enter {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
