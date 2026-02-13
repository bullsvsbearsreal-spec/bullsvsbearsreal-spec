'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import CoinCard from '@/components/CoinCard';
import EventsCalendar from '@/components/EventsCalendar';
import { getCoinData, CoinData, formatPrice, formatNumber, formatPercent } from '@/lib/api/coingecko';
import { fetchCoinEvents, CryptoEvent, formatEventDate, getCategoryIcon } from '@/lib/api/coinmarketcal';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Bell, Share2, ExternalLink, Flame, Lock, Unlock, AlertTriangle } from 'lucide-react';

export default function CoinPage() {
  const params = useParams();
  const router = useRouter();
  const coinId = params.id as string;

  const [coin, setCoin] = useState<CoinData | null>(null);
  const [events, setEvents] = useState<CryptoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'events' | 'unlocks' | 'news'>('events');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [coinData, eventsData] = await Promise.all([
        getCoinData(coinId),
        fetchCoinEvents(coinId),
      ]);
      setCoin(coinData);
      setEvents(eventsData);
      setLoading(false);
    }
    if (coinId) loadData();
  }, [coinId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-32 bg-white/[0.04] rounded-lg" />
            <div className="h-64 bg-white/[0.04] rounded-xl" />
            <div className="h-96 bg-white/[0.04] rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!coin) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-white mb-4">Coin not found</h1>
            <p className="text-neutral-600 mb-6">The coin "{coinId}" could not be found.</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-hub-yellow text-black font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Go Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  const priceChange = coin.price_change_percentage_24h || 0;
  const isPositive = priceChange >= 0;

  // Filter events by type
  const unlockEvents = events.filter(e => e.categories.some(c => c.name.toLowerCase().includes('unlock')));
  const otherEvents = events.filter(e => !e.categories.some(c => c.name.toLowerCase().includes('unlock')));

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-neutral-600 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Coin Header */}
        <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Coin Info */}
            <div className="flex items-center gap-4">
              <img src={coin.image} alt={coin.name} className="w-16 h-16 rounded-full" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">{coin.name}</h1>
                  <span className="text-xl text-neutral-600">{coin.symbol.toUpperCase()}</span>
                  <span className="px-2 py-1 bg-white/[0.06] rounded-lg text-xs text-neutral-600">
                    Rank #{coin.market_cap_rank}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-4xl font-bold text-white">{formatPrice(coin.current_price)}</span>
                  <span className={`flex items-center gap-1 text-xl font-semibold ${isPositive ? 'text-success' : 'text-error'}`}>
                    {isPositive ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                    {formatPercent(priceChange)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button className="p-3 bg-white/[0.04] hover:bg-white/[0.06] rounded-xl transition-colors">
                <Bell className="w-5 h-5 text-neutral-600" />
              </button>
              <button className="p-3 bg-white/[0.04] hover:bg-white/[0.06] rounded-xl transition-colors">
                <Share2 className="w-5 h-5 text-neutral-600" />
              </button>
              <a
                href={`https://coinmarketcap.com/currencies/${coinId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-hub-yellow/10 hover:bg-hub-yellow/20 text-hub-yellow rounded-xl transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                CoinMarketCap
              </a>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-[#111] rounded-lg p-4">
              <span className="text-xs text-neutral-600 block mb-1">Market Cap</span>
              <span className="text-white font-bold text-lg">{formatNumber(coin.market_cap)}</span>
            </div>
            <div className="bg-[#111] rounded-lg p-4">
              <span className="text-xs text-neutral-600 block mb-1">24h Volume</span>
              <span className="text-white font-bold text-lg">{formatNumber(coin.total_volume)}</span>
            </div>
            <div className="bg-[#111] rounded-lg p-4">
              <span className="text-xs text-neutral-600 block mb-1">All-Time High</span>
              {coin.ath > 0 ? (
                <>
                  <span className="text-success font-bold text-lg">{formatPrice(coin.ath)}</span>
                  <span className="text-xs text-neutral-600 ml-2">{formatPercent(coin.ath_change_percentage)}</span>
                </>
              ) : (
                <span className="text-neutral-600 font-bold text-lg">N/A</span>
              )}
            </div>
            <div className="bg-[#111] rounded-lg p-4">
              <span className="text-xs text-neutral-600 block mb-1">All-Time Low</span>
              {coin.atl > 0 ? (
                <>
                  <span className="text-error font-bold text-lg">{formatPrice(coin.atl)}</span>
                  <span className="text-xs text-success ml-2">{formatPercent(coin.atl_change_percentage)}</span>
                </>
              ) : (
                <span className="text-neutral-600 font-bold text-lg">N/A</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              activeTab === 'events'
                ? 'bg-hub-yellow text-black'
                : 'bg-white/[0.04] text-neutral-500 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Events ({otherEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('unlocks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              activeTab === 'unlocks'
                ? 'bg-hub-yellow text-black'
                : 'bg-white/[0.04] text-neutral-500 hover:text-white'
            }`}
          >
            <Unlock className="w-4 h-4" />
            Token Unlocks ({unlockEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              activeTab === 'news'
                ? 'bg-hub-yellow text-black'
                : 'bg-white/[0.04] text-neutral-500 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4" />
            Hot News
          </button>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'events' && (
              <div className="space-y-4">
                {otherEvents.length > 0 ? (
                  otherEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))
                ) : (
                  <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8 text-center">
                    <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <h3 className="text-white font-semibold mb-2">No upcoming events</h3>
                    <p className="text-neutral-600">There are no scheduled events for {coin.symbol.toUpperCase()} at this time.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'unlocks' && (
              <div className="space-y-4">
                {unlockEvents.length > 0 ? (
                  unlockEvents.map((event) => (
                    <UnlockCard key={event.id} event={event} />
                  ))
                ) : (
                  <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8 text-center">
                    <Lock className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <h3 className="text-white font-semibold mb-2">No upcoming unlocks</h3>
                    <p className="text-neutral-600">There are no scheduled token unlocks for {coin.symbol.toUpperCase()}.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'news' && (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8 text-center">
                <Flame className="w-12 h-12 text-hub-yellow mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">News Coming Soon</h3>
                <p className="text-neutral-600">Real-time news aggregation will be available in the next update.</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Supply Info */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Supply Info</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-600">Circulating</span>
                    <span className="text-white">{coin.circulating_supply?.toLocaleString()}</span>
                  </div>
                  {coin.max_supply && (
                    <>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-hub-yellow to-hub-orange rounded-full"
                          style={{ width: `${(coin.circulating_supply / coin.max_supply) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-2 text-neutral-600">
                        <span>{((coin.circulating_supply / coin.max_supply) * 100).toFixed(1)}%</span>
                        <span>Max: {coin.max_supply.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
                {coin.total_supply && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Total Supply</span>
                    <span className="text-white">{coin.total_supply.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Price Stats */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Price Stats</h3>
              <div className="space-y-3">
                {coin.high_24h > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 text-sm">24h High</span>
                    <span className="text-success font-medium">{formatPrice(coin.high_24h)}</span>
                  </div>
                )}
                {coin.low_24h > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 text-sm">24h Low</span>
                    <span className="text-error font-medium">{formatPrice(coin.low_24h)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-600 text-sm">7d Change</span>
                  <span className={coin.price_change_percentage_7d_in_currency && coin.price_change_percentage_7d_in_currency >= 0 ? 'text-success' : 'text-error'}>
                    {formatPercent(coin.price_change_percentage_7d_in_currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 text-sm">30d Change</span>
                  <span className={coin.price_change_percentage_30d_in_currency && coin.price_change_percentage_30d_in_currency >= 0 ? 'text-success' : 'text-error'}>
                    {formatPercent(coin.price_change_percentage_30d_in_currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-warning text-sm font-medium">Research Before Investing</p>
                  <p className="text-neutral-600 text-xs mt-1">Always do your own research. This is not financial advice.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function EventCard({ event }: { event: CryptoEvent }) {
  const dateLabel = formatEventDate(event.date_event);
  const isHot = event.is_hot || event.vote_count > 100;

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-6 hover:border-hub-yellow/30 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-hub-yellow/10 flex items-center justify-center text-2xl flex-shrink-0">
          {getCategoryIcon(event.categories[0]?.name || 'Event')}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-white/[0.06] rounded text-xs text-neutral-600">
                  {event.categories[0]?.name || 'Event'}
                </span>
                {isHot && (
                  <span className="flex items-center gap-1 text-orange-400 text-xs">
                    <Flame className="w-3 h-3" />
                    Hot
                  </span>
                )}
              </div>
              <h4 className="text-white font-semibold text-lg">{event.title}</h4>
              <p className="text-neutral-600 mt-2">{event.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`text-lg font-semibold ${
                dateLabel === 'Today' || dateLabel === 'Tomorrow' ? 'text-hub-yellow' : 'text-white'
              }`}>
                {dateLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.06]">
            {event.percentage > 0 && (
              <span className="flex items-center gap-1 text-sm text-neutral-600">
                <TrendingUp className="w-4 h-4" />
                {event.percentage}% confidence
              </span>
            )}
            {event.vote_count > 0 && (
              <span className="text-sm text-neutral-600">{event.vote_count} votes</span>
            )}
            {event.source && (
              <a href={event.proof} target="_blank" rel="noopener noreferrer" className="text-sm text-hub-yellow hover:underline ml-auto flex items-center gap-1">
                Source <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnlockCard({ event }: { event: CryptoEvent }) {
  const dateLabel = formatEventDate(event.date_event);

  return (
    <div className="bg-[#0d0d0d] border border-warning/30 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
          <Unlock className="w-7 h-7 text-warning" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="px-2 py-0.5 bg-warning/20 rounded text-xs text-warning mb-2 inline-block">
                Token Unlock
              </span>
              <h4 className="text-white font-semibold text-lg">{event.title}</h4>
              <p className="text-neutral-600 mt-2">{event.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`text-lg font-semibold ${
                dateLabel === 'Today' || dateLabel === 'Tomorrow' ? 'text-warning' : 'text-white'
              }`}>
                {dateLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
