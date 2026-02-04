'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ExternalLink, Calendar, Bell, Star, ChevronRight } from 'lucide-react';
import { CoinData, formatPrice, formatNumber, formatPercent } from '@/lib/api/coingecko';
import { fetchCoinEvents, CryptoEvent, formatEventDate, getCategoryIcon } from '@/lib/api/coinmarketcal';

interface CoinCardProps {
  coin: CoinData;
  showEvents?: boolean;
}

export default function CoinCard({ coin, showEvents = true }: CoinCardProps) {
  const [events, setEvents] = useState<CryptoEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const priceChange = coin.price_change_percentage_24h || 0;
  const isPositive = priceChange >= 0;

  useEffect(() => {
    if (showEvents && expanded) {
      loadEvents();
    }
  }, [expanded, coin.symbol]);

  async function loadEvents() {
    setLoadingEvents(true);
    const data = await fetchCoinEvents(coin.symbol);
    setEvents(data);
    setLoadingEvents(false);
  }

  return (
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden hover:border-hub-yellow/30 transition-all">
      {/* Main Card */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src={coin.image} alt={coin.name} className="w-12 h-12 rounded-full" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{coin.name}</h3>
                <span className="text-hub-gray-text">{coin.symbol.toUpperCase()}</span>
              </div>
              <span className="text-xs text-hub-gray-text">Rank #{coin.market_cap_rank}</span>
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-hub-gray/50 transition-colors">
            <Star className="w-5 h-5 text-hub-gray-text hover:text-hub-yellow" />
          </button>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-white">{formatPrice(coin.current_price)}</span>
            <span className={`flex items-center gap-1 text-lg font-medium ${isPositive ? 'text-success' : 'text-error'}`}>
              {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {formatPercent(priceChange)}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-hub-gray/30 rounded-xl p-4">
            <span className="text-xs text-hub-gray-text block mb-1">Market Cap</span>
            <span className="text-white font-semibold">{formatNumber(coin.market_cap)}</span>
          </div>
          <div className="bg-hub-gray/30 rounded-xl p-4">
            <span className="text-xs text-hub-gray-text block mb-1">24h Volume</span>
            <span className="text-white font-semibold">{formatNumber(coin.total_volume)}</span>
          </div>
          <div className="bg-hub-gray/30 rounded-xl p-4">
            <span className="text-xs text-hub-gray-text block mb-1">24h High</span>
            <span className="text-success font-semibold">{formatPrice(coin.high_24h)}</span>
          </div>
          <div className="bg-hub-gray/30 rounded-xl p-4">
            <span className="text-xs text-hub-gray-text block mb-1">24h Low</span>
            <span className="text-error font-semibold">{formatPrice(coin.low_24h)}</span>
          </div>
        </div>

        {/* Sparkline */}
        {coin.sparkline_in_7d?.price && (
          <div className="mb-6">
            <span className="text-xs text-hub-gray-text mb-2 block">7 Day Chart</span>
            <MiniChart data={coin.sparkline_in_7d.price} isPositive={isPositive} />
          </div>
        )}

        {/* Supply Info */}
        <div className="bg-hub-gray/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-hub-gray-text">Circulating Supply</span>
            <span className="text-white text-sm">{coin.circulating_supply?.toLocaleString()}</span>
          </div>
          {coin.max_supply && (
            <>
              <div className="h-2 bg-hub-gray/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-hub-yellow to-hub-orange rounded-full"
                  style={{ width: `${(coin.circulating_supply / coin.max_supply) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-hub-gray-text">Max Supply</span>
                <span className="text-hub-gray-text text-sm">{coin.max_supply.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        {/* Events Toggle */}
        {showEvents && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between py-3 px-4 bg-hub-yellow/10 hover:bg-hub-yellow/20 rounded-xl text-hub-yellow font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              View Events & News
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>

      {/* Events Section */}
      {expanded && (
        <div className="border-t border-hub-gray/30 p-6 bg-hub-gray/10">
          <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-hub-yellow" />
            Upcoming Events
          </h4>
          {loadingEvents ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-hub-gray/30 rounded-xl" />
              ))}
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-3">
              {events.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-3 bg-hub-gray/30 rounded-xl hover:bg-hub-gray/50 transition-colors"
                >
                  <span className="text-2xl">{getCategoryIcon(event.categories[0]?.name || 'Event')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium line-clamp-1">{event.title}</p>
                    <p className="text-hub-gray-text text-xs">{event.categories[0]?.name}</p>
                  </div>
                  <span className={`text-sm font-medium ${
                    formatEventDate(event.date_event) === 'Today' || formatEventDate(event.date_event) === 'Tomorrow'
                      ? 'text-hub-yellow'
                      : 'text-hub-gray-text'
                  }`}>
                    {formatEventDate(event.date_event)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-hub-gray-text text-center py-4">No upcoming events found</p>
          )}
        </div>
      )}
    </div>
  );
}

function MiniChart({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  const points = data.map((price, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((price - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 40" className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${isPositive ? 'up' : 'down'}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={isPositive ? '#22C55E' : '#EF4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPositive ? '#22C55E' : '#EF4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,40 ${points} 100,40`}
        fill={`url(#gradient-${isPositive ? 'up' : 'down'})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? '#22C55E' : '#EF4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
