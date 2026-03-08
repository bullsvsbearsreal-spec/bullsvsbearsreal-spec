'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApi } from '@/hooks/useSWRApi';
import {
  Search, Filter, ChevronDown, ChevronLeft, ChevronRight,
  ExternalLink, Star, Clock, CheckCircle2, AlertCircle,
  Sparkles, Shield, Zap, Globe2, Users, Gamepad2, Wrench,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────── */

interface Airdrop {
  id: string;
  name: string;
  ticker: string | null;
  network: string;
  status: 'upcoming' | 'active' | 'ended';
  estimatedDate: string | null;
  snapshotDate: string | null;
  totalAllocation: string | null;
  estimatedValue: string | null;
  requirements: string[];
  eligibilityCriteria: string;
  website: string | null;
  category: 'defi' | 'l2' | 'gaming' | 'infrastructure' | 'social';
  difficulty: 'easy' | 'medium' | 'hard';
  riskLevel: 'low' | 'medium' | 'high';
  guide: string | null;
}

type TabId = 'tracker' | 'calendar' | 'guides';
type StatusFilter = 'all' | 'upcoming' | 'active' | 'ended';
type CategoryFilter = 'all' | 'defi' | 'l2' | 'gaming' | 'infrastructure' | 'social';

/* ─── Constants ──────────────────────────────────────────────────── */

const TABS: { id: TabId; label: string }[] = [
  { id: 'tracker', label: 'Tracker' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'guides', label: 'Guides' },
];

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'ended', label: 'Ended' },
];

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Globe2 className="w-3 h-3" /> },
  { id: 'l2', label: 'L2', icon: <Zap className="w-3 h-3" /> },
  { id: 'defi', label: 'DeFi', icon: <Sparkles className="w-3 h-3" /> },
  { id: 'infrastructure', label: 'Infra', icon: <Wrench className="w-3 h-3" /> },
  { id: 'gaming', label: 'Gaming', icon: <Gamepad2 className="w-3 h-3" /> },
  { id: 'social', label: 'Social', icon: <Users className="w-3 h-3" /> },
];

const STATUS_COLORS: Record<Airdrop['status'], { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Active' },
  upcoming: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Upcoming' },
  ended: { bg: 'bg-neutral-500/15', text: 'text-neutral-400', label: 'Ended' },
};

const DIFFICULTY_STARS: Record<Airdrop['difficulty'], number> = { easy: 1, medium: 2, hard: 3 };

const CATEGORY_COLORS: Record<Airdrop['category'], string> = {
  defi: 'bg-blue-500/15 text-blue-400',
  l2: 'bg-purple-500/15 text-purple-400',
  gaming: 'bg-pink-500/15 text-pink-400',
  infrastructure: 'bg-emerald-500/15 text-emerald-400',
  social: 'bg-orange-500/15 text-orange-400',
};

const RISK_COLORS: Record<Airdrop['riskLevel'], string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

/* ─── Tracker Tab ────────────────────────────────────────────────── */

function TrackerTab({ airdrops }: { airdrops: Airdrop[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = airdrops;
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter(a => a.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.network.toLowerCase().includes(q) ||
        (a.ticker && a.ticker.toLowerCase().includes(q))
      );
    }
    // Sort: active first, then upcoming, then ended
    const statusOrder: Record<string, number> = { active: 0, upcoming: 1, ended: 2 };
    return result.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  }, [airdrops, statusFilter, categoryFilter, search]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            placeholder="Search airdrops..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/[0.12]"
          />
        </div>

        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s.id
                  ? 'bg-hub-yellow/15 text-hub-yellow'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {CATEGORY_OPTIONS.map(c => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                categoryFilter === c.id
                  ? 'bg-hub-yellow/15 text-hub-yellow'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              {c.icon}
              <span className="hidden sm:inline">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-neutral-500">{filtered.length} airdrop{filtered.length !== 1 ? 's' : ''}</p>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(airdrop => {
          const statusStyle = STATUS_COLORS[airdrop.status];
          const expanded = expandedId === airdrop.id;
          return (
            <div
              key={airdrop.id}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-colors"
            >
              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{airdrop.name}</h3>
                      {airdrop.ticker && (
                        <span className="text-xs text-neutral-500 font-mono">${airdrop.ticker}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[airdrop.category]}`}>
                        {airdrop.category}
                      </span>
                      <span className="text-[10px] text-neutral-600">{airdrop.network}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-neutral-600 uppercase">Est. Value</p>
                    <p className="text-xs font-bold text-white">{airdrop.estimatedValue || 'TBA'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-600 uppercase">Difficulty</p>
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: 3 }, (_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < DIFFICULTY_STARS[airdrop.difficulty] ? 'text-hub-yellow fill-hub-yellow' : 'text-neutral-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-600 uppercase">Risk</p>
                    <p className={`text-xs font-medium capitalize ${RISK_COLORS[airdrop.riskLevel]}`}>
                      {airdrop.riskLevel}
                    </p>
                  </div>
                </div>

                {/* Date & requirements count */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-neutral-500">
                    <Clock className="w-3 h-3" />
                    <span>{airdrop.estimatedDate || 'TBA'}</span>
                  </div>
                  <span className="text-neutral-600">{airdrop.requirements.length} steps</span>
                </div>

                {/* Expand/collapse */}
                <button
                  onClick={() => setExpandedId(expanded ? null : airdrop.id)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
                >
                  {expanded ? 'Less' : 'Details'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Expanded details */}
              {expanded && (
                <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/[0.04]">
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase mb-1">Eligibility</p>
                    <p className="text-xs text-neutral-300 leading-relaxed">{airdrop.eligibilityCriteria}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase mb-1">Requirements</p>
                    <ul className="space-y-1">
                      {airdrop.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-neutral-400">
                          <CheckCircle2 className="w-3 h-3 text-neutral-600 mt-0.5 flex-shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {airdrop.totalAllocation && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500">Total Allocation</span>
                      <span className="text-white font-medium">{airdrop.totalAllocation}</span>
                    </div>
                  )}
                  {airdrop.website && (
                    <a
                      href={airdrop.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-hub-yellow hover:underline"
                    >
                      Visit website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">No airdrops match your filters</p>
        </div>
      )}
    </div>
  );
}

/* ─── Calendar Tab ───────────────────────────────────────────────── */

function CalendarTab({ airdrops }: { airdrops: Airdrop[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleString('en', { month: 'long', year: 'numeric' });

  const airdropsByDate = useMemo(() => {
    const map: Record<string, Airdrop[]> = {};
    for (const a of airdrops) {
      const dateStr = a.estimatedDate || a.snapshotDate;
      if (!dateStr) continue;
      // Handle full dates (2026-04-15) and quarters (2026-Q2)
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, y, m, d] = match;
        const key = `${y}-${m}-${d}`;
        if (!map[key]) map[key] = [];
        map[key].push(a);
      }
    }
    return map;
  }, [airdrops]);

  const prevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };
  const nextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const weeks = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/[0.04] text-neutral-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold text-white">{monthLabel}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/[0.04] text-neutral-400 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.map(d => (
          <div key={d} className="text-center text-[10px] text-neutral-600 font-medium py-1">{d}</div>
        ))}

        {/* Empty cells for first week offset */}
        {Array.from({ length: firstDayOfWeek }, (_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px]" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateKey = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayAirdrops = airdropsByDate[dateKey] || [];
          const isToday = (() => {
            const now = new Date();
            return now.getFullYear() === currentMonth.year && now.getMonth() === currentMonth.month && now.getDate() === day;
          })();

          return (
            <div
              key={day}
              className={`min-h-[80px] rounded-lg border p-1.5 ${
                isToday ? 'border-hub-yellow/30 bg-hub-yellow/5' : 'border-white/[0.04] bg-white/[0.02]'
              }`}
            >
              <span className={`text-[10px] font-medium ${isToday ? 'text-hub-yellow' : 'text-neutral-500'}`}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayAirdrops.map(a => (
                  <div
                    key={a.id}
                    className={`text-[9px] px-1 py-0.5 rounded truncate ${CATEGORY_COLORS[a.category]}`}
                    title={`${a.name} — ${a.status}`}
                  >
                    {a.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {CATEGORY_OPTIONS.filter(c => c.id !== 'all').map(c => (
          <div key={c.id} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_COLORS[c.id as Airdrop['category']]?.split(' ')[0] || ''}`} />
            <span className="text-[10px] text-neutral-500">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Guides Tab ─────────────────────────────────────────────────── */

function GuidesTab({ airdrops }: { airdrops: Airdrop[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const guidedAirdrops = airdrops.filter(a => a.guide && a.status !== 'ended');

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">{guidedAirdrops.length} guides available</p>

      {guidedAirdrops.map(a => {
        const expanded = expandedId === a.id;
        const statusStyle = STATUS_COLORS[a.status];
        return (
          <div key={a.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => setExpandedId(expanded ? null : a.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{a.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[a.category]}`}>
                    {a.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-neutral-600">Est. Value</p>
                  <p className="text-xs font-medium text-white">{a.estimatedValue || 'TBA'}</p>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        i < DIFFICULTY_STARS[a.difficulty] ? 'text-hub-yellow fill-hub-yellow' : 'text-neutral-700'
                      }`}
                    />
                  ))}
                </div>
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Guide content */}
            {expanded && a.guide && (
              <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 space-y-3">
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase mb-2">Step-by-Step Guide</p>
                  <div className="space-y-2">
                    {a.guide.split('\n').filter(Boolean).map((line, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-hub-yellow/10 text-hub-yellow text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          {line.replace(/^\d+\.\s*/, '')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-600">Network</p>
                    <p className="text-xs font-medium text-white">{a.network}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-600">Allocation</p>
                    <p className="text-xs font-medium text-white">{a.totalAllocation || 'TBA'}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-600">Risk Level</p>
                    <p className={`text-xs font-medium capitalize ${RISK_COLORS[a.riskLevel]}`}>{a.riskLevel}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-600">Target Date</p>
                    <p className="text-xs font-medium text-white">{a.estimatedDate || 'TBA'}</p>
                  </div>
                </div>

                {a.website && (
                  <a
                    href={a.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-hub-yellow hover:underline"
                  >
                    Visit {a.name} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}

      {guidedAirdrops.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">No guides available yet</p>
        </div>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function AirdropsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('tracker');

  const { data, isLoading } = useApi<{ data: Airdrop[]; dataAsOf: string }>({
    key: 'airdrops',
    fetcher: async () => {
      const res = await fetch('/api/airdrops');
      if (!res.ok) throw new Error('Failed to fetch airdrops');
      return res.json();
    },
    refreshInterval: 300_000,
  });

  const airdrops = data?.data ?? [];

  const counts = useMemo(() => ({
    active: airdrops.filter(a => a.status === 'active').length,
    upcoming: airdrops.filter(a => a.status === 'upcoming').length,
    total: airdrops.length,
  }), [airdrops]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Airdrops</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Track upcoming and active crypto airdrops with eligibility guides
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-neutral-400">{counts.active} Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-neutral-400">{counts.upcoming} Upcoming</span>
            </div>
            <span className="text-neutral-600">{counts.total} Total</span>
            {data?.dataAsOf && (
              <span className="text-neutral-700">Updated {data.dataAsOf}</span>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-white/[0.06]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-hub-yellow text-hub-yellow'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-48 bg-white/[0.02] rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Tab content */}
        {!isLoading && activeTab === 'tracker' && <TrackerTab airdrops={airdrops} />}
        {!isLoading && activeTab === 'calendar' && <CalendarTab airdrops={airdrops} />}
        {!isLoading && activeTab === 'guides' && <GuidesTab airdrops={airdrops} />}
      </main>

      <Footer />
    </div>
  );
}
