import { NextRequest, NextResponse } from 'next/server';
import { type EconomicEvent } from '@/lib/data/economic-events';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

/* ─── ForexFactory live feed types ──────────────────────────── */

interface FFEvent {
  title: string;
  country: string; // "USD", "EUR", "GBP", etc.
  date: string;    // ISO timestamp "2026-02-14T08:30:00-05:00"
  impact: string;  // "High", "Medium", "Low", "Holiday"
  forecast: string;
  previous: string;
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

/* ─── Handler ───────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // "2026-02"
  const impact = searchParams.get('impact') as EconomicEvent['impact'] | null;
  const category = searchParams.get('category') as EconomicEvent['category'] | null;

  try {
    // Fetch this week's live data from ForexFactory public feed
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      next: { revalidate: 3600 }, // 1-hour cache
    });

    if (!res.ok) throw new Error(`ForexFactory HTTP ${res.status}`);

    const ffEvents: FFEvent[] = await res.json();

    // Map ForexFactory events to our EconomicEvent format
    let events: EconomicEvent[] = ffEvents
      .filter((e) => e.impact !== 'Holiday' && e.title)
      .map((e, i) => {
        const isoDate = e.date ? e.date.slice(0, 10) : '';
        const isoTime = e.date ? e.date.slice(11, 16) : '';
        const currency = e.country || 'USD';
        return {
          id: `ff-${isoDate}-${i}`,
          name: e.title,
          description: e.title,
          date: isoDate,
          time: isoTime ? `${isoTime} ET` : undefined,
          impact: mapImpact(e.impact),
          category: categorizeEvent(e.title),
          country: CURRENCY_TO_COUNTRY[currency] || currency,
          previous: e.previous || undefined,
          forecast: e.forecast || undefined,
        };
      })
      .filter((e) => e.date.length === 10); // valid dates only

    // Apply filters
    if (month) {
      events = events.filter((e) => e.date.startsWith(month));
    }
    if (impact) {
      events = events.filter((e) => e.impact === impact);
    }
    if (category) {
      events = events.filter((e) => e.category === category);
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      events,
      meta: {
        total: events.length,
        month: month || 'all',
        filters: { impact, category },
        source: 'forexfactory',
        live: true,
      },
    });
  } catch (err) {
    console.error('Economic calendar error:', err);
    return NextResponse.json(
      { events: [], meta: { total: 0, error: err instanceof Error ? err.message : 'Failed to fetch' } },
      { status: 502 },
    );
  }
}
