'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Flame, ExternalLink, ChevronRight, Filter } from 'lucide-react';
import { fetchUpcomingEvents, CryptoEvent, getCategoryIcon, formatEventDate, EVENT_CATEGORIES } from '@/lib/api/coinmarketcal';

interface EventsCalendarProps {
  symbol?: string;
  limit?: number;
  showFilters?: boolean;
}

export default function EventsCalendar({ symbol, limit = 10, showFilters = true }: EventsCalendarProps) {
  const [events, setEvents] = useState<CryptoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      const data = await fetchUpcomingEvents(20);
      setEvents(data);
      setLoading(false);
    }
    loadEvents();
  }, [symbol]);

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.categories.some(c => c.name.toLowerCase() === filter.toLowerCase()));

  const displayEvents = filteredEvents.slice(0, limit);

  if (loading) {
    return (
      <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Upcoming Events</h3>
            <p className="text-hub-gray-text text-sm">Loading...</p>
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
            <Calendar className="w-5 h-5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Upcoming Events</h3>
            <p className="text-hub-gray-text text-sm">{events.length} events this week</p>
          </div>
        </div>
        {showFilters && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-hub-gray-text" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-hub-gray/50 border border-hub-gray/30 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-hub-yellow/50"
            >
              <option value="all">All Events</option>
              <option value="token unlock">Token Unlocks</option>
              <option value="exchange">Exchange</option>
              <option value="release">Releases</option>
              <option value="partnership">Partnerships</option>
              <option value="airdrop">Airdrops</option>
            </select>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {displayEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* View All */}
      {events.length > limit && (
        <button className="w-full mt-4 py-3 text-center text-hub-yellow text-sm font-medium hover:bg-hub-yellow/10 rounded-xl transition-colors flex items-center justify-center gap-2">
          View All Events
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function EventCard({ event }: { event: CryptoEvent }) {
  const categoryIcon = getCategoryIcon(event.categories[0]?.name || 'Event');
  const dateLabel = formatEventDate(event.date_event);
  const isHot = event.is_hot || event.vote_count > 100;

  return (
    <div className="group bg-hub-gray/30 hover:bg-hub-gray/50 border border-hub-gray/30 hover:border-hub-yellow/30 rounded-xl p-4 transition-all cursor-pointer">
      <div className="flex items-start gap-4">
        {/* Date Badge */}
        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-hub-yellow/10 flex flex-col items-center justify-center">
          <span className="text-2xl">{categoryIcon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {event.coins[0] && (
                  <span className="px-2 py-0.5 rounded-md bg-hub-yellow/20 text-hub-yellow text-xs font-semibold">
                    {event.coins[0].symbol}
                  </span>
                )}
                {isHot && (
                  <span className="flex items-center gap-1 text-orange-400 text-xs">
                    <Flame className="w-3 h-3" />
                    Hot
                  </span>
                )}
              </div>
              <h4 className="text-white font-medium line-clamp-1 group-hover:text-hub-yellow transition-colors">
                {event.title}
              </h4>
              <p className="text-hub-gray-text text-sm line-clamp-1 mt-1">
                {event.description}
              </p>
            </div>

            {/* Date */}
            <div className="flex-shrink-0 text-right">
              <span className={`text-sm font-medium ${
                dateLabel === 'Today' || dateLabel === 'Tomorrow'
                  ? 'text-hub-yellow'
                  : 'text-hub-gray-text'
              }`}>
                {dateLabel}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-hub-gray/30">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-xs text-hub-gray-text">
                <TrendingUp className="w-3 h-3" />
                {event.percentage}% confidence
              </span>
              <span className="text-xs text-hub-gray-text">
                {event.vote_count} votes
              </span>
            </div>
            <span className="text-xs text-hub-gray-text bg-hub-gray/50 px-2 py-1 rounded">
              {event.categories[0]?.name || 'Event'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
