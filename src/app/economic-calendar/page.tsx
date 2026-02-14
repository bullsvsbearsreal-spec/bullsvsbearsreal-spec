'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import {
  EVENT_CATEGORIES,
  IMPACT_COLORS,
  type EconomicEvent,
} from '@/lib/data/economic-events';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  Clock,
  Filter,
  AlertTriangle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ViewMode = 'calendar' | 'list';
type QuickFilter = 'week' | 'month' | 'next';

interface ApiResponse {
  events: EconomicEvent[];
  meta: { total: number };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonthName(d: Date): string {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const COUNTRY_LABELS: Record<string, string> = {
  US: 'US',
  EU: 'EU',
  Global: 'Global',
};

const CATEGORY_OPTIONS = Object.entries(EVENT_CATEGORIES).map(
  ([key, val]) => ({
    value: key as EconomicEvent['category'],
    label: val.label,
  })
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EconomicCalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('month');
  const [impactFilters, setImpactFilters] = useState<
    Set<EconomicEvent['impact']>
  >(() => new Set<EconomicEvent['impact']>(['high', 'medium', 'low']));
  const [categoryFilter, setCategoryFilter] = useState<
    EconomicEvent['category'] | 'all'
  >('all');

  const monthKey = useMemo(() => formatMonthKey(viewMonth), [viewMonth]);

  /* ---------- Fetch events for current month ---------------------- */

  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/economic-calendar?month=${monthKey}`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json() as Promise<ApiResponse>;
  }, [monthKey]);

  const { data, error, isLoading, isRefreshing, refresh, lastUpdate } =
    useApiData<ApiResponse>({
      fetcher,
      refreshInterval: 5 * 60 * 1000,
    });

  const allEvents = data?.events ?? [];

  /* ---------- Filtered events ------------------------------------- */

  const filteredEvents = useMemo(() => {
    let events = allEvents.filter((e) => impactFilters.has(e.impact));
    if (categoryFilter !== 'all') {
      events = events.filter((e) => e.category === categoryFilter);
    }
    return events;
  }, [allEvents, impactFilters, categoryFilter]);

  /* ---------- Events for selected date / quick filter ------------- */

  const displayEvents = useMemo(() => {
    if (quickFilter === 'week') {
      const { start, end } = getWeekRange();
      return filteredEvents.filter((e) => {
        const d = new Date(e.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    }
    if (quickFilter === 'next') {
      const nextMonth = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth() + 1,
        1
      );
      const nextKey = formatMonthKey(nextMonth);
      return filteredEvents.filter((e) => e.date.startsWith(nextKey));
    }
    // "month" filter or default
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      return filteredEvents.filter((e) => e.date === dateStr);
    }
    return filteredEvents;
  }, [filteredEvents, quickFilter, selectedDate, viewMonth]);

  /* ---------- Events grouped by date on calendar ------------------ */

  const eventsByDate = useMemo(() => {
    const map: Record<string, EconomicEvent[]> = {};
    filteredEvents.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [filteredEvents]);

  /* ---------- Stats ---------------------------------------------- */

  const stats = useMemo(() => {
    const { start: weekStart, end: weekEnd } = getWeekRange();
    const weekEvents = allEvents.filter((e) => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= weekStart && d <= weekEnd;
    });
    const highImpactMonth = allEvents.filter(
      (e) => e.impact === 'high'
    ).length;

    // Find next major event from today
    const todayStr = today.toISOString().split('T')[0];
    const upcoming = allEvents
      .filter((e) => e.date >= todayStr && e.impact === 'high')
      .sort((a, b) => a.date.localeCompare(b.date));
    const nextMajor = upcoming[0] ?? null;
    const daysUntil = nextMajor
      ? daysBetween(today, new Date(nextMajor.date + 'T00:00:00'))
      : null;

    return { weekEvents: weekEvents.length, highImpactMonth, nextMajor, daysUntil };
  }, [allEvents, today]);

  /* ---------- Upcoming events (next 5) --------------------------- */

  const upcomingEvents = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    return allEvents
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [allEvents, today]);

  /* ---------- Navigation ----------------------------------------- */

  const goToPrevMonth = useCallback(() => {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
    setSelectedDate(null);
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
    setSelectedDate(null);
  }, []);

  const goToToday = useCallback(() => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }, [today]);

  /* ---------- Impact toggle -------------------------------------- */

  const toggleImpact = useCallback(
    (level: EconomicEvent['impact']) => {
      setImpactFilters((prev) => {
        const next = new Set(prev);
        if (next.has(level)) {
          if (next.size > 1) next.delete(level);
        } else {
          next.add(level);
        }
        return next;
      });
    },
    []
  );

  /* ---------- Calendar grid -------------------------------------- */

  const calendarGrid = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const totalDays = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const cells: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [viewMonth]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6 page-enter">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">
              Economic Calendar
            </h1>
            <p className="text-neutral-600 text-xs mt-0.5">
              Track major economic events that move crypto and traditional
              markets
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-neutral-700 text-xs">
                Updated{' '}
                {lastUpdate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
              aria-label="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
            <span className="text-neutral-600 text-sm">Events This Week</span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {stats.weekEvents}
            </div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
            <span className="text-red-400 text-sm">
              High Impact This Month
            </span>
            <div className="text-lg font-bold font-mono text-red-400 mt-1">
              {stats.highImpactMonth}
            </div>
          </div>
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
            <span className="text-neutral-600 text-sm">Total Events</span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {filteredEvents.length}
            </div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
            <span className="text-purple-400 text-sm">Next Major Event</span>
            {stats.nextMajor ? (
              <>
                <div className="text-sm font-bold text-purple-400 mt-1 truncate">
                  {stats.nextMajor.name}
                </div>
                <div className="text-xs text-purple-400/70">
                  {stats.daysUntil === 0
                    ? 'Today'
                    : stats.daysUntil === 1
                    ? 'Tomorrow'
                    : `in ${stats.daysUntil} days`}
                </div>
              </>
            ) : (
              <div className="text-sm font-bold font-mono text-neutral-600 mt-1">
                --
              </div>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06]">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'calendar'
                  ? 'bg-hub-yellow text-black'
                  : 'text-neutral-600 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" /> Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-hub-yellow text-black'
                  : 'text-neutral-600 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" /> List
            </button>
          </div>

          {/* Quick filters */}
          <div className="flex rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06]">
            {(
              [
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'next', label: 'Next Month' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setQuickFilter(key);
                  setSelectedDate(null);
                  if (key === 'week' || key === 'month') {
                    setViewMonth(
                      new Date(today.getFullYear(), today.getMonth(), 1)
                    );
                  } else {
                    setViewMonth(
                      new Date(today.getFullYear(), today.getMonth() + 1, 1)
                    );
                  }
                }}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  quickFilter === key
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-600 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Impact checkboxes */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <Filter className="w-3.5 h-3.5 text-neutral-600" />
            {(['high', 'medium', 'low'] as const).map((level) => (
              <button
                key={level}
                onClick={() => toggleImpact(level)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  impactFilters.has(level)
                    ? 'bg-white/[0.08] text-white'
                    : 'text-neutral-700 hover:text-neutral-400'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: IMPACT_COLORS[level] }}
                />
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value as EconomicEvent['category'] | 'all'
                )
              }
              className="appearance-none pl-3 pr-8 py-2 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-hub-yellow/50 cursor-pointer [&>option]:bg-[#141414] [&>option]:text-white"
            >
              <option value="all">All Categories</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 rotate-90" />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {/* Stats skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                  <div className="h-3 w-24 bg-white/[0.06] rounded mb-3" />
                  <div className="h-7 w-20 bg-white/[0.06] rounded" />
                </div>
              ))}
            </div>
            {/* Calendar grid skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                <div className="h-6 w-40 bg-white/[0.06] rounded mb-4" />
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-white/[0.04] rounded" />
                  ))}
                </div>
              </div>
              {/* Sidebar skeleton */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                <div className="h-4 w-32 bg-white/[0.06] rounded mb-4" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="mb-3">
                    <div className="h-3 w-full bg-white/[0.06] rounded mb-2" />
                    <div className="h-3 w-3/4 bg-white/[0.06] rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            {/* Main content area */}
            <div>
              {/* Calendar view */}
              {viewMode === 'calendar' && (
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden mb-6">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                    <button
                      onClick={goToPrevMonth}
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-neutral-400 hover:text-white transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                      <h2 className="text-white font-semibold text-lg">
                        {getMonthName(viewMonth)}
                      </h2>
                      <button
                        onClick={goToToday}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-hub-yellow/20 text-hub-yellow hover:bg-hub-yellow/30 transition-colors"
                      >
                        Today
                      </button>
                    </div>
                    <button
                      onClick={goToNextMonth}
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-neutral-400 hover:text-white transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b border-white/[0.06]">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(
                      (day, i) => (
                        <div
                          key={i}
                          className="py-2 text-center text-xs font-medium text-neutral-600"
                        >
                          <span className="sm:hidden">{day}</span>
                          <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                        </div>
                      )
                    )}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7">
                    {calendarGrid.map((day, idx) => {
                      if (day === null) {
                        return (
                          <div
                            key={`empty-${idx}`}
                            className="min-h-[52px] sm:min-h-[80px] border-b border-r border-white/[0.04] bg-black/20"
                          />
                        );
                      }

                      const cellDate = new Date(
                        viewMonth.getFullYear(),
                        viewMonth.getMonth(),
                        day
                      );
                      const dateStr = cellDate.toISOString().split('T')[0];
                      const dayEvents = eventsByDate[dateStr] ?? [];
                      const isToday = isSameDay(cellDate, today);
                      const isSelected =
                        selectedDate !== null &&
                        isSameDay(cellDate, selectedDate);
                      const hasHigh = dayEvents.some(
                        (e) => e.impact === 'high'
                      );

                      return (
                        <button
                          key={day}
                          onClick={() => {
                            setSelectedDate(cellDate);
                            setQuickFilter('month');
                          }}
                          className={`min-h-[52px] sm:min-h-[80px] p-1 sm:p-1.5 border-b border-r border-white/[0.04] text-left transition-colors hover:bg-white/[0.04] ${
                            isSelected
                              ? 'bg-hub-yellow/10 border-hub-yellow/30'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                                isToday
                                  ? 'bg-hub-yellow text-black'
                                  : 'text-neutral-400'
                              }`}
                            >
                              {day}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="text-[10px] text-neutral-600">
                                {dayEvents.length}
                              </span>
                            )}
                          </div>
                          {/* Event dots */}
                          <div className="flex flex-wrap gap-0.5">
                            {dayEvents.slice(0, 4).map((evt) => (
                              <div
                                key={evt.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  backgroundColor: IMPACT_COLORS[evt.impact],
                                }}
                                title={evt.name}
                              />
                            ))}
                            {dayEvents.length > 4 && (
                              <span className="text-[9px] text-neutral-600">
                                +{dayEvents.length - 4}
                              </span>
                            )}
                          </div>
                          {/* First event name preview */}
                          {dayEvents.length > 0 && (
                            <div
                              className={`text-[10px] mt-0.5 truncate ${
                                hasHigh
                                  ? 'text-red-400'
                                  : 'text-neutral-600'
                              }`}
                            >
                              {dayEvents[0].name.replace(
                                /^(US |EU )/,
                                ''
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Event list */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-white font-semibold">
                    {selectedDate
                      ? `Events on ${selectedDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}`
                      : quickFilter === 'week'
                      ? 'Events This Week'
                      : quickFilter === 'next'
                      ? 'Events Next Month'
                      : `Events in ${getMonthName(viewMonth)}`}
                  </h3>
                  <span className="text-neutral-600 text-sm">
                    {displayEvents.length} event
                    {displayEvents.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {displayEvents.length === 0 ? (
                  <div className="p-8 text-center text-neutral-600">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">
                      {selectedDate
                        ? 'No events on this date'
                        : 'No events match your filters'}
                    </p>
                    {selectedDate && (
                      <button
                        onClick={() => setSelectedDate(null)}
                        className="text-hub-yellow text-xs mt-2 hover:underline"
                      >
                        Show all events this month
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {displayEvents.map((event) => (
                      <EventCard key={event.id} event={event} today={today} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar: Upcoming events */}
            <div className="space-y-6">
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-hub-yellow" />
                    Upcoming Events
                  </h3>
                </div>
                {upcomingEvents.length === 0 && !data ? (
                  <div className="divide-y divide-white/[0.04]">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-3 animate-pulse">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full mt-1.5 bg-white/[0.06] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="h-3 w-3/4 bg-white/[0.06] rounded mb-2" />
                            <div className="h-2 w-1/2 bg-white/[0.06] rounded" />
                          </div>
                          <div className="h-3 w-8 bg-white/[0.06] rounded flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : upcomingEvents.length === 0 ? (
                  <div className="p-6 text-center text-neutral-600 text-sm">
                    No upcoming events this month
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {upcomingEvents.map((event) => {
                      const eventDate = new Date(event.date + 'T00:00:00');
                      const days = daysBetween(today, eventDate);
                      return (
                        <div key={event.id} className="p-3 hover:bg-white/[0.02]">
                          <div className="flex items-start gap-2">
                            <span
                              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                              style={{
                                backgroundColor: IMPACT_COLORS[event.impact],
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-white truncate">
                                {event.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-neutral-600">
                                  {eventDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                                {event.time && (
                                  <span className="text-[10px] text-neutral-700">
                                    {event.time}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`text-xs font-mono flex-shrink-0 ${
                                days === 0
                                  ? 'text-hub-yellow font-bold'
                                  : days <= 3
                                  ? 'text-orange-400'
                                  : 'text-neutral-600'
                              }`}
                            >
                              {days === 0
                                ? 'TODAY'
                                : days === 1
                                ? '1d'
                                : `${days}d`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                  Impact Levels
                </h4>
                <div className="space-y-2">
                  {(
                    [
                      ['high', 'High Impact', 'Market-moving event (FOMC, CPI, NFP)'],
                      ['medium', 'Medium Impact', 'Notable event with moderate effect'],
                      ['low', 'Low Impact', 'Minor report or data release'],
                    ] as const
                  ).map(([level, label, desc]) => (
                    <div key={level} className="flex items-start gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0"
                        style={{ backgroundColor: IMPACT_COLORS[level] }}
                      />
                      <div>
                        <span className="text-xs font-medium text-white">
                          {label}
                        </span>
                        <p className="text-[10px] text-neutral-600">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mt-4 mb-3">
                  Categories
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
                    <span
                      key={key}
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        backgroundColor: cat.color + '20',
                        color: cat.color,
                      }}
                    >
                      {cat.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            Economic events like FOMC rate decisions, CPI inflation data, and Non-Farm Payrolls significantly impact crypto markets. High-impact events (marked red) often cause 2-5% price swings in Bitcoin within hours. FOMC meetings are the most watched — hawkish surprises typically pressure crypto prices, while dovish signals drive rallies. Calendar data includes US, EU, and crypto-specific events. Dates are based on officially published schedules.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Event Card sub-component                                           */
/* ------------------------------------------------------------------ */

function EventCard({
  event,
  today,
}: {
  event: EconomicEvent;
  today: Date;
}) {
  const eventDate = new Date(event.date + 'T00:00:00');
  const isPast = eventDate < today && !isSameDay(eventDate, today);
  const isToday = isSameDay(eventDate, today);
  const cat = EVENT_CATEGORIES[event.category];

  return (
    <div
      className={`p-4 hover:bg-white/[0.02] transition-colors ${
        isPast ? 'opacity-50' : ''
      } ${isToday ? 'border-l-2 border-l-hub-yellow' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Impact indicator */}
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: IMPACT_COLORS[event.impact] }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">
              {event.name}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: cat.color + '20',
                color: cat.color,
              }}
            >
              {cat.label}
            </span>
            <span className="text-[10px] font-medium text-neutral-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {COUNTRY_LABELS[event.country] ?? event.country}
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-0.5">
            {event.description}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-neutral-500">
              {eventDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {event.time && (
              <span className="text-xs text-neutral-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {event.time}
              </span>
            )}
            {event.previous && (
              <span className="text-xs text-neutral-500">
                Prev: <span className="text-neutral-400">{event.previous}</span>
              </span>
            )}
            {event.forecast && (
              <span className="text-xs text-neutral-500">
                Forecast:{' '}
                <span className="text-neutral-400">{event.forecast}</span>
              </span>
            )}
          </div>
        </div>

        {/* Date badge */}
        <div className="text-right flex-shrink-0">
          <div
            className={`text-xs font-mono ${
              isToday ? 'text-hub-yellow font-bold' : 'text-neutral-600'
            }`}
          >
            {isToday
              ? 'TODAY'
              : eventDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
          </div>
        </div>
      </div>
    </div>
  );
}
