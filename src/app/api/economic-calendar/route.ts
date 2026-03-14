import { NextRequest, NextResponse } from 'next/server';
import { ECONOMIC_EVENTS, type EconomicEvent } from '@/lib/data/economic-events';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/* ─── ForexFactory live feed types ──────────────────────────── */

interface FFEvent {
  title: string;
  country: string; // "USD", "EUR", "GBP", etc.
  date: string;    // ISO timestamp "2026-02-14T08:30:00-05:00"
  impact: string;  // "High", "Medium", "Low", "Holiday"
  forecast: string;
  previous: string;
  actual?: string;
}

/* ─── Enhanced event type ────────────────────────────────────── */

interface EnhancedEvent extends EconomicEvent {
  source: 'live' | 'scheduled';
  actual?: string;
}

/* ─── Helpers ───────────────────────────────────────────────── */

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', AUD: 'AU',
  CAD: 'CA', CHF: 'CH', NZD: 'NZ', CNY: 'CN', All: 'Global',
};

function categorizeEvent(title: string): EconomicEvent['category'] {
  const t = title.toLowerCase();
  if (t.includes('rate') || t.includes('fomc') || t.includes('boe') || t.includes('ecb') || t.includes('boj') || t.includes('rba') || t.includes('monetary') || t.includes('central bank')) return 'monetary';
  if (t.includes('nonfarm') || t.includes('employment') || t.includes('unemployment') || t.includes('jobs') || t.includes('payroll') || t.includes('labor') || t.includes('wages') || t.includes('earnings')) return 'employment';
  if (t.includes('cpi') || t.includes('ppi') || t.includes('inflation') || t.includes('price index') || t.includes('pce')) return 'inflation';
  if (t.includes('gdp') || t.includes('retail sales') || t.includes('manufacturing') || t.includes('pmi') || t.includes('trade balance') || t.includes('industrial')) return 'growth';
  return 'other';
}

function mapImpact(ff: string): EconomicEvent['impact'] {
  switch (ff) {
    case 'High': return 'high';
    case 'Medium': return 'medium';
    default: return 'low';
  }
}

/** Get the ISO week range (Mon-Sun) for a given date */
function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

/** Check if an event date falls within the current week */
function isCurrentWeek(eventDate: string): boolean {
  const { start, end } = getWeekRange(new Date());
  return eventDate >= start && eventDate <= end;
}

/** Try to match a ForexFactory event to a static event by name + date */
function findStaticMatch(ffTitle: string, ffDate: string, staticEvents: EconomicEvent[]): EconomicEvent | null {
  const ffLower = ffTitle.toLowerCase();
  return staticEvents.find(se => {
    if (se.date !== ffDate) return false;
    const seLower = se.name.toLowerCase();
    // Check for significant overlap in name
    return seLower.includes(ffLower.slice(0, 15)) || ffLower.includes(seLower.slice(0, 15));
  }) || null;
}

/* ─── Handler ───────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // "2026-02"
  const impact = searchParams.get('impact') as EconomicEvent['impact'] | null;
  const category = searchParams.get('category') as EconomicEvent['category'] | null;
  const searchQuery = searchParams.get('search');
  const country = searchParams.get('country'); // "US", "EU", "All"

  try {
    // 1. Fetch live ForexFactory data (this week only)
    let ffEvents: FFEvent[] = [];
    let liveSource = false;

    try {
      const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
        next: { revalidate: 3600 }, // 1-hour cache
      });
      if (res.ok) {
        ffEvents = await res.json();
        liveSource = true;
      }
    } catch {
      // ForexFactory unavailable — continue with static only
    }

    // 2. Convert FF events to our enhanced format
    const liveEvents: EnhancedEvent[] = ffEvents
      .filter((e) => e.impact !== 'Holiday' && e.title)
      .map((e, i) => {
        const isoDate = e.date ? e.date.slice(0, 10) : '';
        const isoTime = e.date ? e.date.slice(11, 16) : '';
        const currency = e.country || 'USD';

        // Check if this FF event matches a static event
        const staticMatch = findStaticMatch(e.title, isoDate, ECONOMIC_EVENTS);

        return {
          id: staticMatch?.id || `ff-${isoDate}-${i}`,
          name: staticMatch?.name || e.title,
          description: staticMatch?.description || e.title,
          date: isoDate,
          time: isoTime ? `${isoTime} ET` : staticMatch?.time,
          impact: mapImpact(e.impact),
          category: staticMatch?.category || categorizeEvent(e.title),
          country: CURRENCY_TO_COUNTRY[currency] || currency,
          previous: e.previous || staticMatch?.previous || undefined,
          forecast: e.forecast || staticMatch?.forecast || undefined,
          actual: e.actual || undefined,
          source: 'live' as const,
        };
      })
      .filter((e) => e.date.length === 10);

    // 3. Get IDs of live events to avoid duplicates
    const liveIds = new Set(liveEvents.map(e => e.id));
    const liveDates = new Set(liveEvents.map(e => `${e.name.toLowerCase().slice(0, 20)}|${e.date}`));

    // 4. Convert static events, marking current-week ones that overlap with FF
    const staticEnhanced: EnhancedEvent[] = ECONOMIC_EVENTS
      .filter(se => {
        // Skip if already covered by a live FF event
        if (liveIds.has(se.id)) return false;
        // Also skip if the name+date combo matches a live event
        const key = `${se.name.toLowerCase().slice(0, 20)}|${se.date}`;
        if (liveDates.has(key)) return false;
        return true;
      })
      .map(se => ({
        ...se,
        source: isCurrentWeek(se.date) && liveSource ? 'live' as const : 'scheduled' as const,
      }));

    // 5. Merge all events
    let events: EnhancedEvent[] = [...liveEvents, ...staticEnhanced];

    // 6. Apply filters
    if (month) {
      events = events.filter((e) => e.date.startsWith(month));
    }
    if (impact) {
      events = events.filter((e) => e.impact === impact);
    }
    if (category) {
      events = events.filter((e) => e.category === category);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      events = events.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    }
    if (country && country !== 'All') {
      events = events.filter((e) => e.country === country);
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      events,
      meta: {
        total: events.length,
        month: month || 'all',
        filters: { impact, category, search: searchQuery, country },
        source: liveSource ? 'forexfactory+static' : 'static',
        live: liveSource,
        liveCount: liveEvents.length,
        scheduledCount: staticEnhanced.length,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Economic calendar error:', err);
    return NextResponse.json(
      { events: [], meta: { total: 0, error: err instanceof Error ? err.message : 'Failed to fetch' } },
      { status: 502 },
    );
  }
}
