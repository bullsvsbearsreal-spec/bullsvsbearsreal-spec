'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import Logo from '@/components/Logo';

export default function TrailerPage() {
  const router = useRouter();
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const scenes = [
    { id: 'intro', duration: 3000 },
    { id: 'problem', duration: 4000 },
    { id: 'solution', duration: 3000 },
    { id: 'features', duration: 6000 },
    { id: 'stats', duration: 4000 },
    { id: 'cta', duration: 5000 },
  ];

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      if (currentScene < scenes.length - 1) {
        setCurrentScene(currentScene + 1);
      }
    }, scenes[currentScene].duration);

    return () => clearTimeout(timer);
  }, [currentScene, isPlaying, scenes]);

  const handleReplay = () => {
    setCurrentScene(0);
    setIsPlaying(true);
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-black overflow-hidden relative">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/[0.06] z-50">
        <div
          className="h-full bg-hub-yellow transition-all duration-300"
          style={{ width: `${((currentScene + 1) / scenes.length) * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-3 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors text-sm font-medium"
        >
          Skip
        </button>
      </div>

      {/* Scene: Intro */}
      <Scene isActive={currentScene === 0}>
        <div className="flex flex-col items-center justify-center animate-fadeIn">
          <div className="relative">
            <div className="absolute inset-0 bg-hub-yellow/20 blur-[100px] rounded-full animate-pulse" />
            <Logo variant="icon" size="xl" animated />
          </div>
          <h1 className="mt-8 text-6xl md:text-8xl font-black tracking-tight">
            <span className="text-white">Info</span>
            <span className="text-gradient">Hub</span>
          </h1>
          <p className="mt-4 text-xl md:text-2xl text-neutral-500 animate-slideUp" style={{ animationDelay: '0.5s' }}>
            Where Data Meets Decision
          </p>
        </div>
      </Scene>

      {/* Scene: Problem */}
      <Scene isActive={currentScene === 1}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-3xl md:text-5xl font-bold leading-tight animate-fadeIn">
            In a market that{' '}
            <span className="text-error animate-pulse">never sleeps</span>...
          </p>
          <p className="mt-6 text-3xl md:text-5xl font-bold leading-tight animate-fadeIn" style={{ animationDelay: '1s' }}>
            where fortunes rise and fall in{' '}
            <span className="text-error animate-pulse">seconds</span>...
          </p>
          <p className="mt-6 text-3xl md:text-5xl font-bold leading-tight animate-fadeIn" style={{ animationDelay: '2s' }}>
            one platform brings{' '}
            <span className="text-hub-yellow">clarity</span> to chaos.
          </p>
        </div>
        <GlitchOverlay />
      </Scene>

      {/* Scene: Solution */}
      <Scene isActive={currentScene === 2}>
        <div className="flex flex-col items-center animate-scaleIn">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-hub-yellow/30 blur-[150px] rounded-full" />
            <div className="w-32 h-32 md:w-48 md:h-48 bg-gradient-to-br from-hub-yellow to-hub-orange rounded-3xl flex items-center justify-center shadow-2xl shadow-hub-yellow/30">
              <span className="text-5xl md:text-7xl font-black text-black">iH</span>
            </div>
          </div>
          <h2 className="text-5xl md:text-7xl font-black">
            <span className="text-white">INFO</span>
            <span className="text-gradient">HUB</span>
          </h2>
          <p className="mt-4 text-xl text-neutral-500">Your One-Stop Destination for Real-Time Trading Data</p>
        </div>
      </Scene>

      {/* Scene: Features */}
      <Scene isActive={currentScene === 3}>
        <div className="w-full max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 animate-fadeIn">
            Everything You Need
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { icon: '📊', title: 'Real-Time Data', desc: '6 Exchanges' },
              { icon: '🔍', title: 'Coin Search', desc: '10,000+ Coins' },
              { icon: '💰', title: 'Funding Rates', desc: 'Live Updates' },
              { icon: '⚡', title: 'Liquidations', desc: 'Instant Alerts' },
              { icon: '📈', title: 'Open Interest', desc: 'Market Depth' },
              { icon: '📰', title: 'Live News', desc: 'Real-Time Feed' },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 md:p-6 animate-slideUp hover:border-hub-yellow/30 transition-all"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="text-3xl md:text-4xl">{feature.icon}</span>
                <h3 className="mt-3 text-lg md:text-xl font-bold text-white">{feature.title}</h3>
                <p className="text-sm text-neutral-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Scene>

      {/* Scene: Stats */}
      <Scene isActive={currentScene === 4}>
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          {[
            { value: '6', label: 'Exchanges' },
            { value: '10K+', label: 'Coins' },
            { value: '24/7', label: 'Real-Time' },
            { value: '∞', label: 'Possibilities' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="text-center animate-scaleIn"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              <div className="text-5xl md:text-7xl font-black text-gradient">{stat.value}</div>
              <div className="mt-2 text-lg md:text-xl text-neutral-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </Scene>

      {/* Scene: CTA */}
      <Scene isActive={currentScene === 5}>
        <div className="text-center animate-fadeIn">
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Ready to <span className="text-gradient">Trade Smarter</span>?
          </h2>
          <p className="text-xl text-neutral-500 mb-8">
            Join thousands of traders using InfoHub
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="group flex items-center gap-3 px-8 py-4 bg-hub-yellow text-black font-bold text-lg rounded-xl hover:bg-hub-yellow/90 transition-all"
            >
              Launch InfoHub
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={handleReplay}
              className="px-8 py-4 bg-white/[0.06] hover:bg-white/[0.1] text-white font-medium rounded-xl transition-colors"
            >
              Watch Again
            </button>
          </div>
        </div>
      </Scene>

      {/* Scene Indicators */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
        {scenes.map((scene, i) => (
          <button
            key={scene.id}
            onClick={() => setCurrentScene(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentScene
                ? 'w-8 bg-hub-yellow'
                : i < currentScene
                ? 'bg-hub-yellow/50'
                : 'bg-white/[0.1]'
            }`}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 1s ease-out forwards; }
        .animate-slideUp { animation: slideUp 1s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.8s ease-out forwards; }
      `}</style>
    </div>
  );
}

function Scene({ isActive, children }: { isActive: boolean; children: React.ReactNode }) {
  if (!isActive) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-8">
      {children}
    </div>
  );
}

function ParticleBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-hub-yellow/50 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${5 + Math.random() * 5}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-100px) translateX(50px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

function GlitchOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none opacity-10"
      style={{
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(255, 68, 68, 0.1) 2px,
          rgba(255, 68, 68, 0.1) 4px
        )`,
      }}
    />
  );
}
