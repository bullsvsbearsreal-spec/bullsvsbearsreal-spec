import { NextRequest, NextResponse } from 'next/server';
import { ECONOMIC_EVENTS, type EconomicEvent } from '@/lib/data/economic-events';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // "2026-03"
  const impact = searchParams.get('impact') as EconomicEvent['impact'] | null;
  const category = searchParams.get('category') as EconomicEvent['category'] | null;

  let events = [...ECONOMIC_EVENTS];

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
    },
  });
}
