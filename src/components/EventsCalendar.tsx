'use client';

import { useState, useEffect } from 'react';
import { Newspaper, TrendingUp, Flame, ExternalLink, ChevronRight, Clock } from 'lucide-react';
import { fetchUpcomingEvents, CryptoEvent, getCategoryIcon, formatEventDate } from '@/lib/api/coinmarketcal';

interface EventsCalendarProps {
  symbol?: string;
  limit?: number;
  showFilters?: boolean;
}

export default function EventsCalendar({ symbol, limit = 10, showFilters = true }: EventsCalendarProps) {
  const [events, setEvents] = useState<CryptoEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      const data = await fetchUpcomingEvents(20);
      setEvents(data);
      setLoading(false);
    }
    loadEvents();
  }, [symbol]);

  const displayEvents = events.slice(0, limit);

  if (loading) {
    return (
      <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Latest News</h3>
            <p className="text-hub-gray-text text-sm">Loading real-time news...</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-hub-gray/30 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Latest News</h3>
            <p className="text-hub-gray-text text-sm">Real-time market updates</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-success">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          Live
        </span>
      </div>

      {/* Events/News List */}
      <div className="space-y-3">
        {displayEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* View All */}
      {events.length > limit && (
        <a
          href="https://www.cryptocompare.com/news/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mt-4 py-3 text-center text-hub-yellow text-sm font-medium hover:bg-hub-yellow/10 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          View All News
          <ChevronRight className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function EventCard({ event }: { event: CryptoEvent }) {
  const categoryIcon = getCategoryIcon(event.categories[0]?.name || 'News');
  const dateLabel = formatEventDate(event.date_event);
  const isHot = event.is_hot || event.vote_count > 100;

  return (
    <a
      href={event.proof}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-hub-gray/30 hover:bg-hub-gray/50 border border-hub-gray/30 hover:border-hub-yellow/30 rounded-xl p-4 transition-all"
    >
      <div className="flex items-start gap-4">
        {/* Icon Badge */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-hub-yellow/10 flex flex-col items-center justify-center">
          <span className="text-xl">{categoryIcon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {event.coins[0] && event.coins[0].symbol !== 'CRYPTO' && (
                  <span className="px-2 py-0.5 rounded-md bg-hub-yellow/20 text-hub-yellow text-xs font-semibold">
                    {event.coins[0].symbol}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-hub-gray/50 text-hub-gray-text text-xs">
                  {event.categories[0]?.name || 'News'}
                </span>
                {isHot && (
                  <span className="flex items-center gap-1 text-orange-400 text-xs">
                    <Flame className="w-3 h-3" />
                    Hot
                  </span>
                )}
              </div>
              <h4 className="text-white font-medium line-clamp-2 group-hover:text-hub-yellow transition-colors">
                {event.title}
              </h4>
            </div>

            {/* Time */}
            <div className="flex-shrink-0 text-right">
              <span className="flex items-center gap-1 text-xs text-hub-gray-text">
                <Clock className="w-3 h-3" />
                {dateLabel}
              </span>
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-hub-gray-text">
              {event.source}
            </span>
            <ExternalLink className="w-3 h-3 text-hub-gray-text group-hover:text-hub-yellow transition-colors" />
          </div>
        </div>
      </div>
    </a>
  );
}
