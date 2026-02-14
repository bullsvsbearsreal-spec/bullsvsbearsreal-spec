'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { TokenUnlock, UNLOCK_TYPES, formatUnlockAmount, formatUnlockValue, getDaysUntilUnlock, formatUnlockDate } from '@/lib/api/tokenunlocks';
import { RefreshCw, AlertTriangle, Calendar, List, Filter, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type ViewMode = 'list' | 'calendar';
type UnlockType = TokenUnlock['unlockType'];

interface ApiResponse {
  unlocks: TokenUnlock[];
  meta: { total: number; timestamp: number };
}

/* ------------------------------------------------------------------ */
/*  Colour helpers                                                     */
/* ------------------------------------------------------------------ */
const TYPE_COLORS: Record<UnlockType, { bg: string; text: string; dot: string }> = {
  cliff:     { bg: 'bg-red-500/10',    text: 'text-red-400',    dot: 'bg-red-400' },
  linear:    { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  team:      { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' },
  investor:  { bg: 'bg-blue-500/10',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  ecosystem: { bg: 'bg-emerald-500/10',text: 'text-emerald-400',dot: 'bg-emerald-400' },
  treasury:  { bg: 'bg-hub-yellow/10', text: 'text-hub-yellow', dot: 'bg-hub-yellow' },
};

/* ------------------------------------------------------------------ */
/*  Calendar helpers                                                   */
/* ------------------------------------------------------------------ */
function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ------------------------------------------------------------------ */
/*  Stats card component                                               */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums text-white">{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Type badge                                                         */
/* ------------------------------------------------------------------ */
function TypeBadge({ type }: { type: UnlockType }) {
  const c = TYPE_COLORS[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text}`}>
      {UNLOCK_TYPES[type].label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Unlock card (list view)                                            */
/* ------------------------------------------------------------------ */
function UnlockCard({ unlock }: { unlock: TokenUnlock }) {
  const days = getDaysUntilUnlock(unlock.unlockDate);
  const relDate = formatUnlockDate(unlock.unlockDate);
  const absDate = new Date(unlock.unlockDate).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const isPast = days < 0;

  return (
    <div className={`bg-[#0d0d0d] border rounded-xl p-4 transition-colors hover:border-white/[0.12] ${
      unlock.isLarge ? 'border-yellow-500/30' : 'border-white/[0.06]'
    } ${isPast ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: token info */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Symbol circle */}
          <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{unlock.coinSymbol}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">{unlock.coinName}</span>
              <TypeBadge type={unlock.unlockType} />
              {unlock.isLarge && (
                <span title="Large unlock (>1% supply)"><AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" /></span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 truncate">{unlock.description}</p>
          </div>
        </div>

        {/* Right: date */}
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-semibold ${days <= 3 && days >= 0 ? 'text-red-400' : days <= 7 && days >= 0 ? 'text-yellow-400' : 'text-white'}`}>
            {relDate}
          </p>
          <p className="text-[10px] text-neutral-600 mt-0.5">{absDate}</p>
        </div>
      </div>

      {/* Bottom row: metrics */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
        <div>
          <p className="text-[10px] text-neutral-600 uppercase tracking-wider">Amount</p>
          <p className="text-sm font-mono font-semibold text-white">{formatUnlockAmount(unlock.unlockAmount)} {unlock.coinSymbol}</p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-600 uppercase tracking-wider">Value</p>
          <p className="text-sm font-mono font-semibold text-white">{formatUnlockValue(unlock.unlockValue)}</p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-600 uppercase tracking-wider">% Supply</p>
          <p className={`text-sm font-mono font-semibold ${unlock.percentOfSupply >= 1 ? 'text-yellow-400' : 'text-white'}`}>
            {unlock.percentOfSupply.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar grid                                                      */
/* ------------------------------------------------------------------ */
function CalendarView({
  unlocks,
  selectedDate,
  onSelectDate,
}: {
  unlocks: TokenUnlock[];
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const { firstDay, daysInMonth } = getMonthDays(viewYear, viewMonth);

  // Build a map: day number -> unlocks
  const dayMap = useMemo(() => {
    const m = new Map<number, TokenUnlock[]>();
    for (const u of unlocks) {
      const d = new Date(u.unlockDate);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const day = d.getDate();
        if (!m.has(day)) m.set(day, []);
        m.get(day)!.push(u);
      }
    }
    return m;
  }, [unlocks, viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    onSelectDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    onSelectDate(null);
  };

  const selectedUnlocks = useMemo(() => {
    if (!selectedDate) return [];
    return unlocks.filter(u => isSameDay(new Date(u.unlockDate), selectedDate));
  }, [unlocks, selectedDate]);

  // Build cell array: null for padding, number for real day
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/[0.06] text-neutral-400 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-white font-semibold">{MONTH_NAMES[viewMonth]} {viewYear}</h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/[0.06] text-neutral-400 hover:text-white transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map(l => (
          <div key={l} className="text-center text-[10px] text-neutral-600 font-medium py-1">{l}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`pad-${idx}`} />;
          const cellDate = new Date(viewYear, viewMonth, day);
          const isToday = isSameDay(cellDate, today);
          const isSelected = selectedDate ? isSameDay(cellDate, selectedDate) : false;
          const dayUnlocks = dayMap.get(day);
          const hasUnlocks = !!dayUnlocks && dayUnlocks.length > 0;
          const hasLarge = dayUnlocks?.some(u => u.isLarge);

          return (
            <button
              key={day}
              onClick={() => onSelectDate(isSelected ? null : cellDate)}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                isSelected
                  ? 'bg-hub-yellow text-black font-bold'
                  : isToday
                    ? 'bg-white/[0.06] text-white font-semibold ring-1 ring-hub-yellow/50'
                    : hasUnlocks
                      ? 'bg-white/[0.04] text-white hover:bg-white/[0.08]'
                      : 'text-neutral-600 hover:bg-white/[0.04]'
              }`}
            >
              {day}
              {hasUnlocks && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {dayUnlocks!.slice(0, 3).map((u, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${TYPE_COLORS[u.unlockType].dot}`} />
                  ))}
                  {dayUnlocks!.length > 3 && (
                    <span className="text-[8px] text-neutral-500">+{dayUnlocks!.length - 3}</span>
                  )}
                </div>
              )}
              {hasLarge && !isSelected && (
                <div className="absolute top-0.5 right-0.5">
                  <AlertTriangle className="w-2.5 h-2.5 text-yellow-400" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h4>
            <button onClick={() => onSelectDate(null)} className="p-1 rounded hover:bg-white/[0.06] text-neutral-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedUnlocks.length === 0 ? (
            <p className="text-neutral-600 text-sm">No unlocks on this day</p>
          ) : (
            selectedUnlocks.map(u => <UnlockCard key={u.id} unlock={u} />)
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function TokenUnlocksPage() {
  const [view, setView] = useState<ViewMode>('list');
  const [selectedTypes, setSelectedTypes] = useState<Set<UnlockType>>(new Set<UnlockType>(['cliff', 'linear', 'team', 'investor', 'ecosystem', 'treasury']));
  const [minValue, setMinValue] = useState(0);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | null>(null);

  const fetcher = useCallback(async () => {
    const res = await fetch('/api/token-unlocks');
    if (!res.ok) throw new Error('Failed to fetch token unlocks');
    return res.json() as Promise<ApiResponse>;
  }, []);

  const { data, isLoading, isRefreshing, lastUpdate, refresh } = useApiData<ApiResponse>({
    fetcher,
    refreshInterval: 5 * 60 * 1000,
  });

  const allUnlocks = data?.unlocks ?? [];

  // Apply filters
  const filtered = useMemo(() => {
    return allUnlocks.filter(u => {
      if (!selectedTypes.has(u.unlockType)) return false;
      if (u.unlockValue < minValue) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.coinName.toLowerCase().includes(q) && !u.coinSymbol.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allUnlocks, selectedTypes, minValue, search]);

  // For list view: sort by date, upcoming first
  const listUnlocks = useMemo(() => {
    const now = new Date();
    const upcoming = filtered.filter(u => new Date(u.unlockDate) >= now).sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime());
    const past = filtered.filter(u => new Date(u.unlockDate) < now).sort((a, b) => new Date(b.unlockDate).getTime() - new Date(a.unlockDate).getTime());
    return [...upcoming, ...past];
  }, [filtered]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = allUnlocks.filter(u => new Date(u.unlockDate) > now);
    const totalValue = upcoming.reduce((s, u) => s + u.unlockValue, 0);
    const largest = upcoming.reduce((max, u) => (u.unlockValue > (max?.unlockValue ?? 0) ? u : max), upcoming[0] as TokenUnlock | undefined);
    const avgPct = upcoming.length > 0 ? upcoming.reduce((s, u) => s + u.percentOfSupply, 0) / upcoming.length : 0;
    return { count: upcoming.length, totalValue, largest, avgPct };
  }, [allUnlocks]);

  const toggleType = (t: UnlockType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
  };

  const MIN_VALUE_OPTIONS = [
    { label: 'All', value: 0 },
    { label: '$1M+', value: 1_000_000 },
    { label: '$10M+', value: 10_000_000 },
    { label: '$50M+', value: 50_000_000 },
    { label: '$100M+', value: 100_000_000 },
  ];

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-hub-yellow" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Token Unlocks Calendar</h1>
              <p className="text-neutral-600 text-xs mt-0.5">
                Upcoming token vesting schedules across {new Set(allUnlocks.map(u => u.coinSymbol)).size} tokens
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-neutral-600 text-xs">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white transition-colors text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-12">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <span className="text-white">Loading token unlocks...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard label="Upcoming Unlocks" value={String(stats.count)} sub={`across ${new Set(allUnlocks.map(u => u.coinSymbol)).size} tokens`} />
              <StatCard label="Total Value Locked" value={formatUnlockValue(stats.totalValue)} />
              <StatCard
                label="Largest Upcoming"
                value={stats.largest ? formatUnlockValue(stats.largest.unlockValue) : '--'}
                sub={stats.largest ? `${stats.largest.coinSymbol} - ${stats.largest.percentOfSupply.toFixed(2)}% of supply` : undefined}
              />
              <StatCard label="Avg % of Supply" value={`${stats.avgPct.toFixed(2)}%`} sub="per unlock event" />
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* View toggle */}
              <div className="flex rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.06]">
                <button
                  onClick={() => setView('list')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    view === 'list' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </button>
                <button
                  onClick={() => setView('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    view === 'calendar' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Calendar
                </button>
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                <input
                  type="text"
                  placeholder="Search token..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.08] text-neutral-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
                  showFilters ? 'bg-white/[0.08] border-white/[0.12] text-white' : 'bg-white/[0.04] border-white/[0.06] text-neutral-500 hover:text-white'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
              </button>

              {/* Min value pills */}
              <div className="flex items-center gap-1">
                {MIN_VALUE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMinValue(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      minValue === opt.value
                        ? 'bg-hub-yellow text-black'
                        : 'text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type filters (expandable) */}
            {showFilters && (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 mb-6">
                <p className="text-xs text-neutral-500 font-medium mb-3">Unlock Types</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(UNLOCK_TYPES) as UnlockType[]).map(type => {
                    const c = TYPE_COLORS[type];
                    const active = selectedTypes.has(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          active
                            ? `${c.bg} ${c.text} border-current`
                            : 'bg-white/[0.02] text-neutral-600 border-white/[0.04] hover:text-neutral-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${active ? c.dot : 'bg-neutral-700'}`} />
                        {UNLOCK_TYPES[type].label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-neutral-600 mt-3">
                  Showing {filtered.length} of {allUnlocks.length} unlock events
                </p>
              </div>
            )}

            {/* Content */}
            {view === 'list' ? (
              <div className="space-y-3">
                {listUnlocks.length === 0 ? (
                  <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-12 text-center">
                    <Calendar className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400 text-sm">No unlock events match your filters</p>
                    <p className="text-neutral-600 text-xs mt-1">Try adjusting the type or value filters</p>
                  </div>
                ) : (
                  listUnlocks.map(u => <UnlockCard key={u.id} unlock={u} />)
                )}
              </div>
            ) : (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 md:p-6">
                <CalendarView
                  unlocks={filtered}
                  selectedDate={calendarDate}
                  onSelectDate={setCalendarDate}
                />
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
              <p className="text-xs text-neutral-500 font-medium mb-3">Legend</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(Object.keys(UNLOCK_TYPES) as UnlockType[]).map(type => {
                  const c = TYPE_COLORS[type];
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      <span className="text-xs text-neutral-400">{UNLOCK_TYPES[type].label}</span>
                      <span className="text-[10px] text-neutral-600">- {UNLOCK_TYPES[type].description}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-neutral-400">Large unlock</span>
                  <span className="text-[10px] text-neutral-600">- More than 1% of total supply</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
