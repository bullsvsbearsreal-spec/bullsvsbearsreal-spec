'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

interface SpreadPrediction {
  symbol: string;
  high_exchange: string;
  low_exchange: string;
  current_spread: number;
  predicted_spread: number;
  spread_direction: 'widening' | 'narrowing' | 'stable';
  spread_change_pct: number;
  confidence: number;
  source: 'kronos' | 'heuristic' | 'heuristic-fallback';
  model: string;
}

interface PredictionBadgeProps {
  symbol: string;
  highExchange: string;
  lowExchange: string;
  /** Compact inline badge (table row) vs expanded card */
  variant?: 'badge' | 'card';
}

// Module-level cache to avoid re-fetching across component instances
const predictionCache = new Map<string, { data: SpreadPrediction | null; ts: number; loading: boolean }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min client cache

function getCacheKey(symbol: string, high: string, low: string) {
  return `${symbol}|${[high, low].sort().join(',')}`;
}

export function PredictionBadge({ symbol, highExchange, lowExchange, variant = 'badge' }: PredictionBadgeProps) {
  const [prediction, setPrediction] = useState<SpreadPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchPrediction = useCallback(async () => {
    const key = getCacheKey(symbol, highExchange, lowExchange);
    const cached = predictionCache.get(key);

    // Return cached data if fresh
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setPrediction(cached.data);
      return;
    }

    // Prevent duplicate fetches
    if (cached?.loading) return;
    predictionCache.set(key, { data: null, ts: Date.now(), loading: true });

    setLoading(true);
    setError(false);

    try {
      const params = new URLSearchParams({
        symbol,
        high: highExchange,
        low: lowExchange,
      });

      const res = await fetch(`/api/predictions/funding?${params}`, {
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) {
        throw new Error(`${res.status}`);
      }

      const data: SpreadPrediction = await res.json();
      predictionCache.set(key, { data, ts: Date.now(), loading: false });
      setPrediction(data);
    } catch {
      predictionCache.set(key, { data: null, ts: Date.now(), loading: false });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [symbol, highExchange, lowExchange]);

  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-0.5 text-neutral-600 text-[9px]">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      </span>
    );
  }

  if (error || !prediction) return null;

  const { spread_direction, spread_change_pct, confidence, source } = prediction;

  if (variant === 'card') {
    return <PredictionCard prediction={prediction} />;
  }

  // Badge variant
  const dirConfig = {
    widening: { icon: TrendingUp, color: 'text-green-400', bgColor: 'bg-green-500/10', label: 'Widening' },
    narrowing: { icon: TrendingDown, color: 'text-red-400', bgColor: 'bg-red-500/10', label: 'Narrowing' },
    stable: { icon: Minus, color: 'text-neutral-500', bgColor: 'bg-white/[0.04]', label: 'Stable' },
  }[spread_direction];

  const Icon = dirConfig.icon;
  const isKronos = source === 'kronos';

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${dirConfig.bgColor} ${dirConfig.color} cursor-help`}
      title={[
        `Spread prediction: ${dirConfig.label} (${spread_change_pct > 0 ? '+' : ''}${spread_change_pct.toFixed(1)}%)`,
        `Confidence: ${(confidence * 100).toFixed(0)}%`,
        `Source: ${isKronos ? 'Kronos AI' : 'Heuristic'}`,
        `Current: ${prediction.current_spread.toFixed(4)}%`,
        `Predicted: ${prediction.predicted_spread.toFixed(4)}%`,
      ].join('\n')}
    >
      {isKronos && <Brain className="w-2.5 h-2.5 opacity-60" />}
      <Icon className="w-2.5 h-2.5" />
      {Math.abs(spread_change_pct) >= 5 && (
        <span>{spread_change_pct > 0 ? '+' : ''}{spread_change_pct.toFixed(0)}%</span>
      )}
    </span>
  );
}


function PredictionCard({ prediction }: { prediction: SpreadPrediction }) {
  const { spread_direction, spread_change_pct, confidence, source, current_spread, predicted_spread } = prediction;
  const isKronos = source === 'kronos';

  const dirConfig = {
    widening: { color: 'text-green-400', borderColor: 'border-green-500/20', label: 'Spread Widening', desc: 'Rate divergence increasing' },
    narrowing: { color: 'text-red-400', borderColor: 'border-red-500/20', label: 'Spread Narrowing', desc: 'Rates converging — opportunity may shrink' },
    stable: { color: 'text-neutral-400', borderColor: 'border-white/[0.06]', label: 'Spread Stable', desc: 'No significant change expected' },
  }[spread_direction];

  return (
    <div className={`rounded-lg border ${dirConfig.borderColor} bg-white/[0.02] p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className={`w-3.5 h-3.5 ${isKronos ? 'text-purple-400' : 'text-neutral-500'}`} />
          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
            {isKronos ? 'Kronos AI Forecast' : 'Heuristic Forecast'}
          </span>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
          confidence >= 0.7 ? 'bg-green-500/15 text-green-400' :
          confidence >= 0.4 ? 'bg-amber-500/15 text-amber-400' :
          'bg-red-500/15 text-red-400'
        }`}>
          {(confidence * 100).toFixed(0)}% conf
        </span>
      </div>

      <div className="flex items-center gap-2">
        {spread_direction === 'widening' && <TrendingUp className={`w-4 h-4 ${dirConfig.color}`} />}
        {spread_direction === 'narrowing' && <TrendingDown className={`w-4 h-4 ${dirConfig.color}`} />}
        {spread_direction === 'stable' && <Minus className={`w-4 h-4 ${dirConfig.color}`} />}
        <div>
          <div className={`text-sm font-semibold ${dirConfig.color}`}>{dirConfig.label}</div>
          <div className="text-[10px] text-neutral-600">{dirConfig.desc}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px]">
        <div>
          <span className="text-neutral-600">Now: </span>
          <span className="text-neutral-300 font-mono">{current_spread.toFixed(4)}%</span>
        </div>
        <span className="text-neutral-700">→</span>
        <div>
          <span className="text-neutral-600">Predicted: </span>
          <span className={`font-mono ${dirConfig.color}`}>{predicted_spread.toFixed(4)}%</span>
        </div>
        <div className="text-neutral-600">
          ({spread_change_pct > 0 ? '+' : ''}{spread_change_pct.toFixed(1)}%)
        </div>
      </div>
    </div>
  );
}


/**
 * Hook for batch-loading predictions for multiple arbitrage pairs.
 * Used by the main arbitrage view to efficiently load predictions.
 */
export function usePredictions(pairs: { symbol: string; high: string; low: string }[]) {
  const [predictions, setPredictions] = useState<Map<string, SpreadPrediction>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pairs.length === 0) return;

    // Filter pairs that need fetching
    const toFetch = pairs.filter(p => {
      const key = getCacheKey(p.symbol, p.high, p.low);
      const cached = predictionCache.get(key);
      return !cached || Date.now() - cached.ts >= CACHE_TTL;
    });

    // Load from cache first
    const cached = new Map<string, SpreadPrediction>();
    for (const p of pairs) {
      const key = getCacheKey(p.symbol, p.high, p.low);
      const entry = predictionCache.get(key);
      if (entry?.data) cached.set(key, entry.data);
    }
    setPredictions(cached);

    if (toFetch.length === 0) return;

    // Fetch remaining from API (max 20 at a time)
    setLoading(true);
    const batch = toFetch.slice(0, 20);

    fetch('/api/predictions/funding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairs: batch }),
      signal: AbortSignal.timeout(40000),
    })
      .then(res => res.json())
      .then(data => {
        const next = new Map(cached);
        for (const item of data.predictions || []) {
          if (item.prediction) {
            const key = getCacheKey(item.symbol, item.high, item.low);
            predictionCache.set(key, { data: item.prediction, ts: Date.now(), loading: false });
            next.set(key, item.prediction);
          }
        }
        setPredictions(next);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.map(p => `${p.symbol}|${p.high}|${p.low}`).join(',')]);

  return { predictions, loading };
}
