'use client';

import { useState } from 'react';
import {
  Construction, BookOpen, TrendingUp, BarChart3,
  Zap, ArrowLeftRight, Shield, PieChart, Bell,
  ChevronRight, Clock, Coffee, Pencil, Sparkles,
  MessageCircle,
} from 'lucide-react';

/* ─── Upcoming guide topics ─────────────────────────────────────── */

const upcomingGuides = [
  {
    title: 'Funding Rate Arbitrage',
    desc: 'The strategy that lets you profit no matter which way the market moves. We\'ll break down exactly how to spot and execute funding rate arb across exchanges.',
    icon: ArrowLeftRight,
    tag: 'Strategy',
    difficulty: 'Intermediate',
    eta: 'First up',
  },
  {
    title: 'Reading Open Interest Like a Pro',
    desc: 'OI is the one metric most traders ignore — and it\'s the one that tells you the most. Learn to spot squeezes before they happen.',
    icon: BarChart3,
    tag: 'Analysis',
    difficulty: 'Beginner',
    eta: 'Coming soon',
  },
  {
    title: 'Surviving Liquidation Cascades',
    desc: 'When leveraged positions unwind, prices move fast. Here\'s how to stay on the right side of the waterfall — or profit from it.',
    icon: Zap,
    tag: 'Trading',
    difficulty: 'Advanced',
    eta: 'Coming soon',
  },
  {
    title: 'Order Flow for Humans',
    desc: 'Forget complicated footprint charts. We\'ll teach you to read the tape in plain English — who\'s buying, who\'s selling, and what it means.',
    icon: TrendingUp,
    tag: 'Analysis',
    difficulty: 'Intermediate',
    eta: 'In the works',
  },
  {
    title: 'Options Max Pain, Explained',
    desc: 'Every options expiry, there\'s a price level where the most traders lose the most money. Understanding max pain gives you an edge.',
    icon: Shield,
    tag: 'Options',
    difficulty: 'Advanced',
    eta: 'In the works',
  },
  {
    title: 'Don\'t Blow Up: Risk Management',
    desc: 'The most important guide we\'ll write. Position sizing, hedging, and the mental frameworks that keep you in the game long-term.',
    icon: PieChart,
    tag: 'Risk',
    difficulty: 'Beginner',
    eta: 'In the works',
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
      {/* ─── Construction tape top ─── */}
      <div className="h-1.5 construction-tape" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 relative z-10">

        {/* ─── Hero section ─── */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center">
              <Construction className="w-5 h-5 text-hub-yellow" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-hub-yellow/[0.08] border border-hub-yellow/15">
              <span className="w-1.5 h-1.5 rounded-full bg-hub-yellow animate-pulse" />
              <span className="text-hub-yellow text-[11px] font-semibold">Work in progress</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            Trading guides,<br />
            <span className="text-hub-yellow">written by actual traders.</span>
          </h1>

          <p className="text-neutral-400 text-sm sm:text-base max-w-xl leading-relaxed mb-3">
            We&apos;re putting together a collection of no-BS guides on derivatives trading.
            Real strategies, real examples, using real data from InfoHub.
          </p>
          <p className="text-neutral-600 text-xs sm:text-sm max-w-xl leading-relaxed">
            No filler, no &quot;what is Bitcoin&quot; intros. Just the stuff you actually need to trade better.
          </p>
        </div>

        {/* ─── What to expect ─── */}
        <div className="grid sm:grid-cols-3 gap-3 mb-14">
          {[
            { icon: Coffee, label: 'Plain English', desc: 'No jargon walls. We explain things like we\'re talking to a friend.' },
            { icon: BarChart3, label: 'Live examples', desc: 'Every concept backed by real charts and data from InfoHub.' },
            { icon: Pencil, label: 'Actionable', desc: 'Step-by-step playbooks you can actually use tomorrow.' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 mt-0.5">
                <item.icon className="w-4 h-4 text-neutral-500" />
              </div>
              <div>
                <span className="text-white text-sm font-semibold block mb-0.5">{item.label}</span>
                <span className="text-neutral-600 text-xs leading-relaxed">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Upcoming guides ─── */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-4 h-4 text-hub-yellow" />
            <h2 className="text-sm font-bold text-neutral-300">What we&apos;re working on</h2>
            <div className="h-px flex-1 bg-white/[0.04]" />
          </div>

          <div className="space-y-3">
            {upcomingGuides.map((guide, i) => (
              <div
                key={guide.title}
                className="group relative bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.03] guide-card-enter"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-hub-yellow/[0.06] border border-hub-yellow/10 flex items-center justify-center flex-shrink-0 group-hover:border-hub-yellow/25 transition-colors">
                    <guide.icon className="w-5 h-5 text-hub-yellow/60 group-hover:text-hub-yellow transition-colors" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-neutral-200 group-hover:text-white transition-colors">
                        {guide.title}
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-2.5">
                      {guide.desc}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.04] text-neutral-500 border border-white/[0.06]">
                        {guide.tag}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${difficultyColor[guide.difficulty]}`}>
                        {guide.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* ETA badge */}
                  <div className="flex items-center gap-1.5 text-neutral-600 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-medium whitespace-nowrap">{guide.eta}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── CTA section ─── */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {/* Notify */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6 relative">
            <Bell className="w-5 h-5 text-hub-yellow mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Get notified when we publish</h3>
            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              Drop your email and we&apos;ll ping you when the first guide goes live. No spam, ever.
            </p>

            {subscribed ? (
              <div className="flex items-center gap-2 py-2 text-green-400 text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                Nice — you&apos;re on the list!
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
                  Notify me
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Suggest */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6">
            <MessageCircle className="w-5 h-5 text-neutral-500 mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Got a topic in mind?</h3>
            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              We want to write what you actually want to read. Tell us what you&apos;re struggling with.
            </p>
            <a
              href="https://t.me/+Z6SQGJ57SlwyY2Rk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm font-medium text-neutral-300 hover:text-white hover:border-white/[0.15] transition-all"
            >
              Suggest on Telegram
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ─── Bottom note ─── */}
        <div className="text-center pt-4 border-t border-white/[0.04]">
          <p className="text-neutral-700 text-xs">
            Built with care by the InfoHub team. First guides dropping soon.
          </p>
        </div>
      </div>

      {/* ─── Construction tape bottom ─── */}
      <div className="h-1.5 construction-tape" />

      {/* ─── Inline styles ─── */}
      <style jsx>{`
        .construction-tape {
          background: repeating-linear-gradient(
            -45deg,
            #eab308,
            #eab308 10px,
            #1a1a1a 10px,
            #1a1a1a 20px
          );
          opacity: 0.5;
        }
        .guide-card-enter {
          animation: card-enter 0.4s ease-out both;
        }
        @keyframes card-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
