'use client';

// /home — fully terminal-styled landing dashboard.
// Built directly on design-system primitives — no legacy widgets.

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity, BarChart3, Zap, TrendingUp, Newspaper, Shield, Flame,
  ArrowUp, ArrowDown, ChevronRight, GitCompareArrows, Crosshair,
} from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ALL_EXCHANGES, isExchangeDex } from '@/lib/constants';
import { isValidNumber, formatPrice } from '@/lib/utils/format';
import { type ExchangeHealthInfo } from '@/lib/api/aggregator';
import { type FundingRateData } from '@/lib/api/types';
import { type NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';
import { SatPing, StreamBars, Sparkline } from '@/components/design-system';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
const fmtUSD = (n: number) => {
  if (!isValidNumber(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtPct = (n: number, dp = 2) => {
  if (!isValidNumber(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(dp)}%`;
};

// ────────────────────────────────────────────────────────────────────
// Layout primitives
// ────────────────────────────────────────────────────────────────────
function SectionHead({ title, accent = 'var(--hub-accent)', right }: { title: string; accent?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px' }}>
      <span aria-hidden style={{ width: 3, height: 13, background: accent, borderRadius: 2, boxShadow: `0 0 8px ${accent}66` }} />
      <h2 style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--fg-default)', margin: 0,
      }}>{title}</h2>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--hub-border-subtle) 0%, transparent 100%)' }} />
      {right}
    </div>
  );
}

function Card({ children, padding = 14, className }: { children: React.ReactNode; padding?: number; className?: string }) {
  return (
    <div className={className} style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 12,
      padding,
      position: 'relative',
      overflow: 'hidden',
    }}>{children}</div>
  );
}

function CardHeader({ icon, title, accent, link, linkLabel = 'View all' }: {
  icon: React.ReactNode; title: string; accent: string; link?: string; linkLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: `${accent}1a`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <h3 style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--fg-default)', margin: 0,
        }}>{title}</h3>
      </div>
      {link && (
        <Link href={link} style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          color: accent, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}>
          {linkLabel} <ChevronRight size={11} />
        </Link>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Stat tile
// ────────────────────────────────────────────────────────────────────
function StatTile({
  label, value, delta, deltaColor, icon, accent = 'var(--hub-accent)', spark,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;
  icon?: React.ReactNode;
  accent?: string;
  spark?: number[];
}) {
  // Treat the canonical empty values ('—', '$0', empty string) as loading
  // skeletons rather than rendering them literally. First-paint flash of
  // dashes + zeroes was making the homepage look broken before data arrived.
  const isLoading = !value || value === '—' || value === '$0' || value === '0';
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 12,
      padding: '11px 14px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 4,
      minHeight: 72,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${accent}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        {icon && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: `${accent}1a`, color: accent,
          }}>{icon}</span>
        )}
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--fg-muted)',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative' }}>
        {isLoading ? (
          <span style={{
            display: 'inline-block',
            width: 90, height: 18,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
            backgroundSize: '200% 100%',
            borderRadius: 4,
            animation: 'shimmer 1.4s ease-in-out infinite',
          }} aria-label={`${label} loading`} />
        ) : (
        <span style={{
          fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)',
          color: 'var(--fg-default)', letterSpacing: '-0.01em',
        }}>{value}</span>
        )}
        {delta && (
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: deltaColor || 'var(--fg-muted)',
          }}>{delta}</span>
        )}
        {spark && spark.length > 1 && (
          <span style={{ marginLeft: 'auto', width: 60, opacity: 0.85 }}>
            <Sparkline data={spark} color={accent} height={18} />
          </span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Quick actions row (compact, mobile-friendly)
// ────────────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { name: 'Funding',     href: '/funding',           icon: Activity,         color: 'var(--pump-mild)' },
  { name: 'Open Interest', href: '/open-interest',   icon: BarChart3,        color: '#a78bfa' },
  { name: 'Liquidations', href: '/liquidations',     icon: Zap,              color: 'var(--rekt-mild)' },
  { name: 'Screener',    href: '/screener',          icon: TrendingUp,       color: '#60a5fa' },
  { name: 'News',        href: '/news',              icon: Newspaper,        color: '#f59e0b' },
  { name: 'Compare',     href: '/compare',           icon: GitCompareArrows, color: 'var(--hub-accent)' },
  { name: 'Predictions', href: '/prediction-markets', icon: Crosshair,       color: '#e040fb' },
];

// ────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────
interface MarketsResp {
  // /api/global-stats actual shape
  total_market_cap?: { usd?: number };
  total_volume?: { usd?: number };
  active_cryptocurrencies?: number;
  market_cap_percentage?: { btc?: number; eth?: number };
}
interface MoverItem { symbol: string; change24h: number; price?: number; }
interface FearGreedResp { value?: number; classification?: string; lastUpdate?: string; data?: { value?: number; classification?: string }; }
interface ETFResp {
  // /api/etf?type=btc actual shape
  type?: string;
  asset?: string;
  summary?: {
    totalFunds?: number;
    dailyVolume?: number | null;
    totalAum?: number | null;
    liveQuotes?: number;
  };
  funds?: { ticker: string; change24h?: number | null; volume?: number | null }[];
}
interface TickerData { symbol: string; lastPrice?: number; price?: number; priceChangePercent24h?: number; change24h?: number; }
interface LiqAggResp {
  totals?: { totalValue: number; longValue: number; shortValue: number; count?: number };
  symbols?: { symbol: string; totalValue: number }[];
}
interface OICoin { symbol: string; oi?: number; currentOI?: number; oiChange24hPct?: number; pct24h?: number; change24h?: number; }
interface LSItem { symbol: string; longRatio?: number; shortRatio?: number; }

export default function HomePage() {
  // Live data
  const [topFunding, setTopFunding] = useState<FundingRateData[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [exchangeHealth, setExchangeHealth] = useState<ExchangeHealthInfo[]>([]);
  const [marketStats, setMarketStats] = useState<MarketsResp | null>(null);
  const [movers, setMovers] = useState<{ gainers: MoverItem[]; losers: MoverItem[] }>({ gainers: [], losers: [] });
  const [liqAgg, setLiqAgg] = useState<LiqAggResp | null>(null);
  const [topOI, setTopOI] = useState<OICoin[]>([]);
  const [lsRatios, setLsRatios] = useState<LSItem[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreedResp | null>(null);
  const [etf, setEtf] = useState<ETFResp | null>(null);
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [{ fetchAllFundingRates, fetchExchangeHealth }, { fetchCryptoNews }] = await Promise.all([
          import('@/lib/api/aggregator'),
          import('@/lib/api/coinmarketcal'),
        ]);
        const [fundingData, newsData, healthData, marketsRes, moversRes, liqRes, oiRes, fgRes, etfRes, tickersRes] = await Promise.all([
          fetchAllFundingRates().catch(() => []),
          fetchCryptoNews(5).catch(() => []),
          fetchExchangeHealth().catch(() => null),
          fetch('/api/global-stats').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/top-movers').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/liquidations/aggregate').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/oi-delta').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/fear-greed').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/etf?type=btc').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/tickers').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        // Long/Short — fetch top symbols in parallel since the endpoint is per-symbol.
        // Binance fapi requires BTCUSDT-style pairs, so suffix bare symbols.
        const lsSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
        const lsBatch: (LSItem | null)[] = await Promise.all(
          lsSymbols.map(async (s): Promise<LSItem | null> => {
            try {
              const r = await fetch(`/api/longshort?symbol=${s}USDT`);
              if (!r.ok) return null;
              const j = await r.json();
              if (!j || j.fallback) return null;
              return {
                symbol: s,
                longRatio:  (typeof j.longRatio  === 'number' ? j.longRatio  : 0) / 100,
                shortRatio: (typeof j.shortRatio === 'number' ? j.shortRatio : 0) / 100,
              };
            } catch {
              return null;
            }
          }),
        );
        const lsClean: LSItem[] = [];
        for (const item of lsBatch) if (item) lsClean.push(item);
        if (cancelled) return;

        const validFunding = (fundingData ?? [])
          .filter((fr: FundingRateData) => fr && isValidNumber(fr.fundingRate))
          .sort((a: FundingRateData, b: FundingRateData) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
          .slice(0, 5);
        setTopFunding(validFunding);
        setLatestNews((newsData ?? []).slice(0, 5));
        setExchangeHealth(healthData?.funding ?? []);
        setMarketStats(marketsRes);
        if (moversRes) {
          setMovers({
            gainers: (moversRes.gainers ?? []).slice(0, 5),
            losers:  (moversRes.losers  ?? []).slice(0, 5),
          });
        }
        setLiqAgg(liqRes);
        const oiList: OICoin[] = Array.isArray(oiRes?.data) ? oiRes.data : Array.isArray(oiRes?.coins) ? oiRes.coins : Array.isArray(oiRes) ? oiRes : [];
        // sort by absolute 24h change desc
        oiList.sort((a, b) => Math.abs((b.pct24h ?? b.oiChange24hPct ?? b.change24h ?? 0)) - Math.abs((a.pct24h ?? a.oiChange24hPct ?? a.change24h ?? 0)));
        setTopOI(oiList.slice(0, 5));
        setLsRatios(lsClean);
        setFearGreed(fgRes);
        setEtf(etfRes);
        // Tickers — major coins for the price tracker
        const tickerArr: TickerData[] = Array.isArray(tickersRes) ? tickersRes : Array.isArray(tickersRes?.data) ? tickersRes.data : [];
        setTickers(tickerArr);
      } catch (e) {
        console.error('Home data load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const cexExchanges = useMemo(() => ALL_EXCHANGES.filter(e => !isExchangeDex(e)), []);
  const dexExchanges = useMemo(() => ALL_EXCHANGES.filter(e =>  isExchangeDex(e)), []);
  const healthLoaded = exchangeHealth.length > 0;
  const isExchangeActive = (name: string) => exchangeHealth.find(x => x.name === name)?.status === 'ok';
  const activeCex = healthLoaded ? cexExchanges.filter(isExchangeActive).length : cexExchanges.length;
  const activeDex = healthLoaded ? dexExchanges.filter(isExchangeActive).length : dexExchanges.length;

  // Compute liquidation skew text
  const liqTotals = liqAgg?.totals;
  const liqSkew = useMemo(() => {
    if (!liqTotals) return null;
    const total = liqTotals.longValue + liqTotals.shortValue;
    if (!total) return null;
    const longPct = (liqTotals.longValue / total) * 100;
    if (longPct > 75) return { text: 'Longs nuked', color: 'var(--rekt-mild)' };
    if (longPct > 60) return { text: 'Long-heavy carnage', color: 'var(--rekt-mild)' };
    if (longPct < 25) return { text: 'Shorts wrecked', color: 'var(--pump-mild)' };
    if (longPct < 40) return { text: 'Short-heavy rinse', color: 'var(--pump-mild)' };
    return { text: 'Two-sided liquidation', color: 'var(--fg-muted)' };
  }, [liqTotals]);

  return (
    <div id="main-content" style={{ padding: '14px 18px 32px', width: '100%' }}>

      {/* Mobile quick-pill row */}
      <div className="lg:hidden" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {QUICK_LINKS.map(link => (
          <Link key={link.href} href={link.href} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 10px',
            borderRadius: 8,
            background: 'var(--hub-darker)',
            border: '1px solid var(--hub-border-subtle)',
            color: 'var(--fg-default)', fontSize: 11, fontWeight: 500,
            textDecoration: 'none',
          }}>
            <link.icon size={13} style={{ color: link.color }} />
            <span>{link.name}</span>
          </Link>
        ))}
      </div>

      {/* ── Stat row ── */}
      <section style={{ marginBottom: 14 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 8,
        }}>
          <StatTile
            label="24h Volume"
            value={marketStats?.total_volume?.usd ? fmtUSD(marketStats.total_volume.usd) : '—'}
            icon={<Activity size={11} />}
            accent="var(--hub-accent)"
          />
          <StatTile
            label="Market Cap"
            value={marketStats?.total_market_cap?.usd ? fmtUSD(marketStats.total_market_cap.usd) : '—'}
            icon={<BarChart3 size={11} />}
            accent="#a78bfa"
          />
          <StatTile
            label="Top Gainer"
            value={movers.gainers[0]?.symbol || '—'}
            delta={movers.gainers[0] ? fmtPct(movers.gainers[0].change24h) : undefined}
            deltaColor="var(--pump-mild)"
            icon={<ArrowUp size={11} />}
            accent="var(--pump-mild)"
          />
          <StatTile
            label="Top Loser"
            value={movers.losers[0]?.symbol || '—'}
            delta={movers.losers[0] ? fmtPct(movers.losers[0].change24h) : undefined}
            deltaColor="var(--rekt-mild)"
            icon={<ArrowDown size={11} />}
            accent="var(--rekt-mild)"
          />
        </div>
      </section>

      {/* ── Hero: Liquidations panel ── */}
      <section style={{ marginBottom: 14 }}>
        <Card padding={0}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, var(--rekt-mild), transparent)',
          }} />
          <div style={{ padding: '14px 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Flame size={15} style={{ color: 'var(--rekt-mild)' }} />
              </div>
              <h2 style={{
                fontSize: 14, fontWeight: 800, letterSpacing: '0.04em',
                color: 'var(--fg-default)', margin: 0,
              }}>Liquidation Heatmap</h2>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 8px', borderRadius: 999,
                background: 'rgba(34,197,94,0.10)',
                border: '1px solid rgba(34,197,94,0.25)',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pump-mild)',
                textTransform: 'uppercase',
              }}>
                <SatPing size={7} color="var(--pump-mild)" />
                Live · {ALL_EXCHANGES.length} venues
              </span>
              <div style={{ flex: 1 }} />
              <StreamBars height={12} bars={5} color="var(--rekt-mild)" />
              <Link href="/liquidations" style={{
                color: 'var(--rekt-mild)', fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                Full feed <ChevronRight size={11} />
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {/* `liqTotals` is null while the WS bootstrap is in flight; pass
                  null instead of pre-computing fmtUSD(0) so LiqStat renders a
                  shimmer skeleton rather than a confusing "$0" against the
                  "LIVE · 32 VENUES" pill above. */}
              <LiqStat label="Total Rekt"  value={liqTotals ? fmtUSD(liqTotals.totalValue) : null} accent="var(--rekt-mild)" big />
              <LiqStat label="Longs"       value={liqTotals ? fmtUSD(liqTotals.longValue)  : null} accent="var(--rekt-mild)" />
              <LiqStat label="Shorts"      value={liqTotals ? fmtUSD(liqTotals.shortValue) : null} accent="var(--pump-mild)" />
            </div>

            {liqSkew && (
              <div style={{
                marginTop: 12,
                fontSize: 11, fontStyle: 'italic',
                color: liqSkew.color, textAlign: 'center',
                fontFamily: 'var(--font-mono)',
              }}>
                {liqSkew.text}
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ── Sentiment / Macro row ── */}
      <section style={{ marginBottom: 14 }}>
        <SectionHead title="Market Sentiment" right={<SatPing size={9} color="var(--pump-mild)" />} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
          <FearGreedTile data={fearGreed} />
          <DominanceTile
            label="BTC Dominance"
            value={marketStats?.market_cap_percentage?.btc}
            color="#f7931a"
            symbol="BTC"
          />
          <DominanceTile
            label="ETH Dominance"
            value={marketStats?.market_cap_percentage?.eth}
            color="#627eea"
            symbol="ETH"
          />
          <ETFTile data={etf} />
        </div>
      </section>

      {/* ── Major Coins price tracker ── */}
      <MajorCoinsSection tickers={tickers} loading={loading} />

      {/* ── 4-column data feed: Sentiment · Funding · OI · News ── */}
      <section style={{ marginBottom: 14 }}>
        <SectionHead
          title="Sentiment · Funding · OI · News"
          right={<SatPing size={9} color="var(--hub-accent)" />}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 10,
        }}>
          {/* Top Funding */}
          <Card>
            <CardHeader
              icon={<Activity size={12} style={{ color: 'var(--hub-accent)' }} />}
              title="Top Funding"
              accent="var(--hub-accent)"
              link="/funding"
            />
            {loading ? <SkeletonRows count={5} /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {topFunding.length === 0 ? <Empty /> : topFunding.map((item, i) => {
                  const positive = item.fundingRate >= 0;
                  return (
                    <Link
                      key={`${item.symbol}-${item.exchange}-${i}`}
                      href={`/symbol/${encodeURIComponent(item.symbol)}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 8px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.02)',
                        textDecoration: 'none',
                      }}
                    >
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: i < 3 ? 'var(--hub-accent)' : 'var(--fg-faint)',
                        width: 12, textAlign: 'right',
                      }}>{i + 1}</span>
                      <TokenIconSimple symbol={item.symbol} size={18} />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--fg-default)', fontWeight: 600, fontSize: 12 }}>{item.symbol}</span>
                        <span style={{ color: 'var(--fg-faint)', fontSize: 10 }}>{item.exchange}</span>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                        padding: '2px 8px', borderRadius: 999,
                        color: positive ? 'var(--pump-mild)' : 'var(--rekt-mild)',
                        background: positive ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                        border: `1px solid ${positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      }}>
                        {positive ? '+' : ''}{item.fundingRate.toFixed(4)}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Top OI Movers */}
          <Card>
            <CardHeader
              icon={<BarChart3 size={12} style={{ color: '#a78bfa' }} />}
              title="OI Movers"
              accent="#a78bfa"
              link="/open-interest"
            />
            {loading ? <SkeletonRows count={5} /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {topOI.length === 0 ? <Empty /> : topOI.map((c, i) => {
                  const ch = c.pct24h ?? c.oiChange24hPct ?? c.change24h ?? 0;
                  const oiVal = c.oi ?? c.currentOI ?? 0;
                  const positive = ch >= 0;
                  return (
                    <Link key={`${c.symbol}-${i}`} href={`/symbol/${encodeURIComponent(c.symbol)}`} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.02)',
                      textDecoration: 'none',
                    }}>
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: i < 3 ? '#a78bfa' : 'var(--fg-faint)',
                        width: 12, textAlign: 'right',
                      }}>{i + 1}</span>
                      <TokenIconSimple symbol={c.symbol} size={18} />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--fg-default)', fontWeight: 600, fontSize: 12 }}>{c.symbol}</span>
                        <span style={{ color: 'var(--fg-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                          {fmtUSD(oiVal)}
                        </span>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                        padding: '2px 8px', borderRadius: 999,
                        color: positive ? 'var(--pump-mild)' : 'var(--rekt-mild)',
                        background: positive ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                        border: `1px solid ${positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      }}>
                        {fmtPct(ch)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* L/S ratios */}
          <Card>
            <CardHeader
              icon={<GitCompareArrows size={12} style={{ color: '#60a5fa' }} />}
              title="Long / Short"
              accent="#60a5fa"
              link="/longshort"
            />
            {loading ? <SkeletonRows count={5} /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lsRatios.length === 0 ? <Empty /> : lsRatios.map((r, i) => {
                  const longP = (r.longRatio ?? 0) * 100;
                  const shortP = (r.shortRatio ?? 0) * 100;
                  return (
                    <div key={`${r.symbol}-${i}`} style={{ padding: '4px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <TokenIconSimple symbol={r.symbol} size={14} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-default)' }}>{r.symbol}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pump-mild)' }}>
                          {longP.toFixed(0)}%
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--fg-faint)' }}>·</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rekt-mild)' }}>
                          {shortP.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', display: 'flex', background: 'rgba(239,68,68,0.18)' }}>
                        <div style={{ width: `${longP}%`, background: 'var(--pump-mild)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Latest News */}
          <Card>
            <CardHeader
              icon={<Newspaper size={12} style={{ color: '#f59e0b' }} />}
              title="Latest News"
              accent="#f59e0b"
              link="/news"
            />
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[1,2,3,4,5].map(i => <div key={i} style={{ height: 50, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {latestNews.length === 0 ? <Empty /> : latestNews.map((article, i) => (
                  <a
                    key={article.id || i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block', padding: '7px 8px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.02)', textDecoration: 'none',
                    }}
                  >
                    <div style={{
                      color: 'var(--fg-default)', fontSize: 12, fontWeight: 500, lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{article.title}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 600 }}>
                        {article.source_info?.name || article.source}
                      </span>
                      <span style={{ color: 'var(--fg-faint)', fontSize: 10 }}>·</span>
                      <span style={{ color: 'var(--fg-muted)', fontSize: 10 }}>{formatTimeAgo(article.published_on)}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* ── Movers ── */}
      <section style={{ marginBottom: 14 }}>
        <SectionHead
          title="Top Movers · 24h"
          right={<StreamBars height={9} bars={3} color="var(--hub-accent)" />}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          <MoversList title="Gainers" items={movers.gainers} accent="var(--pump-mild)" sign="+" />
          <MoversList title="Losers"  items={movers.losers}  accent="var(--rekt-mild)" sign=""  />
        </div>
      </section>

      {/* ── Exchange Status ── */}
      <section style={{ marginBottom: 14 }}>
        <SectionHead
          title={`Exchange Status · ${ALL_EXCHANGES.length} sources`}
          right={
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 10 }}>
              <Legend dot="var(--pump-mild)" label="Active" />
              <Legend dot="#fb923c" label="Recovering" />
              <Legend dot="rgba(239,68,68,0.7)" label="Down" />
            </div>
          }
        />
        <Card padding={0}>
          {/* Top summary strip */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--hub-border-subtle)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            background: 'linear-gradient(135deg, rgba(34,197,94,0.04) 0%, transparent 60%)',
          }}>
            <SummaryStat
              icon={<Shield size={11} />}
              label="Online"
              value={`${activeCex + activeDex}/${ALL_EXCHANGES.length}`}
              accent="var(--hub-accent)"
              dotPulse
            />
            <SummaryStat
              icon={<Activity size={11} />}
              label="CEX Active"
              value={`${activeCex}/${cexExchanges.length}`}
              accent="var(--pump-mild)"
            />
            <SummaryStat
              icon={<Activity size={11} />}
              label="DEX Active"
              value={`${activeDex}/${dexExchanges.length}`}
              accent="#a78bfa"
            />
            <SummaryStat
              icon={<Zap size={11} />}
              // "Venue WS Ping" — clearer than "Avg Latency" which read like
              // an InfoHub-side latency (our API is sub-200ms; the >1s number
              // is the cross-region WebSocket round-trip to slow upstream
              // venues like Bitget/HTX). Label was reading as a weakness.
              label="Venue WS Ping"
              value={(() => {
                const lats = exchangeHealth.filter(h => h.status === 'ok' && h.latencyMs).map(h => h.latencyMs);
                if (!lats.length) return '—';
                const avg = lats.reduce((s, n) => s + n, 0) / lats.length;
                // Show seconds when > 1s — "1.7s" is easier to read than "1743ms"
                return avg >= 1000 ? `${(avg / 1000).toFixed(1)}s` : `${avg.toFixed(0)}ms`;
              })()}
              accent="#60a5fa"
            />
            <SummaryStat
              icon={<TrendingUp size={11} />}
              label="Total Pairs"
              value={(() => {
                const total = exchangeHealth.reduce((s, h) => s + (h.count || 0), 0);
                return total > 0 ? total.toLocaleString() : '—';
              })()}
              accent="#f59e0b"
            />
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ExchangeBlock label="Centralized" tone="cex" exchanges={cexExchanges} health={exchangeHealth} healthLoaded={healthLoaded} active={activeCex} />
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--hub-border-subtle), transparent)' }} />
            <ExchangeBlock label="Decentralized" tone="dex" exchanges={dexExchanges} health={exchangeHealth} healthLoaded={healthLoaded} active={activeDex} />
          </div>
        </Card>
      </section>

    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────
function LiqStat({ label, value, accent, big }: { label: string; value: string | null; accent: string; big?: boolean }) {
  // null `value` = WS bootstrap still in flight. Render a shimmer
  // skeleton rather than a literal "$0" — the "LIVE · 32 VENUES" pill
  // next to these stats made the "$0" placeholder read as broken.
  const isLoading = value == null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 10,
      padding: '10px 12px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${accent}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--fg-muted)', marginBottom: 4, position: 'relative',
      }}>{label}</div>
      {isLoading ? (
        <div style={{
          height: big ? 24 : 20,
          width: big ? 110 : 80,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
          backgroundSize: '200% 100%',
          borderRadius: 4,
          animation: 'shimmer 1.4s ease-in-out infinite',
          position: 'relative',
        }} aria-label={`${label} loading`} />
      ) : (
        <div style={{
          fontSize: big ? 22 : 18, fontWeight: 800, fontFamily: 'var(--font-mono)',
          color: accent, letterSpacing: '-0.01em', position: 'relative',
        }}>{value}</div>
      )}
    </div>
  );
}

function MoversList({ title, items, accent, sign }: { title: string; items: MoverItem[]; accent: string; sign: string }) {
  return (
    <Card>
      <CardHeader
        icon={sign === '+'
          ? <ArrowUp size={12} style={{ color: accent }} />
          : <ArrowDown size={12} style={{ color: accent }} />}
        title={title}
        accent={accent}
        link="/screener"
      />
      {items.length === 0 ? <Empty /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((m, i) => (
            <Link key={`${m.symbol}-${i}`} href={`/symbol/${encodeURIComponent(m.symbol)}`} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 6,
              background: 'rgba(255,255,255,0.02)', textDecoration: 'none',
            }}>
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: i < 3 ? accent : 'var(--fg-faint)',
                width: 12, textAlign: 'right',
              }}>{i + 1}</span>
              <TokenIconSimple symbol={m.symbol} size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--fg-default)', fontWeight: 600, fontSize: 12 }}>{m.symbol}</span>
                {isValidNumber(m.price ?? NaN) && (
                  <span style={{ marginLeft: 6, color: 'var(--fg-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                    {fmtUSD(m.price!)}
                  </span>
                )}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                padding: '2px 8px', borderRadius: 999,
                color: accent,
                background: `${accent}1a`,
                border: `1px solid ${accent}40`,
              }}>
                {sign}{m.change24h.toFixed(2)}%
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function ExchangeBlock({ label, tone, exchanges, health, healthLoaded, active }: {
  label: string; tone: 'cex' | 'dex';
  exchanges: string[];
  health: ExchangeHealthInfo[];
  healthLoaded: boolean;
  active: number;
}) {
  const accent = tone === 'cex' ? 'var(--pump-mild)' : '#a78bfa';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, color: tone === 'cex' ? 'var(--fg-muted)' : '#a78bfa',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: accent }}>{active}</span>
          <span style={{ color: 'var(--fg-faint)' }}>/</span>
          <span style={{ color: 'var(--fg-muted)' }}>{exchanges.length}</span>
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 6,
      }}>
        {exchanges.map(name => {
          const h = health.find(x => x.name === name);
          const isActive = h?.status === 'ok' || !healthLoaded;
          const cb = healthLoaded && h?.status === 'circuit-open';
          const empty = healthLoaded && h?.status === 'empty';
          const dotColor = isActive ? accent : cb ? '#fb923c' : empty ? '#facc15' : h ? 'rgba(239,68,68,0.6)' : 'var(--fg-faint)';
          const bg = isActive
            ? `${tone === 'cex' ? 'rgba(34,197,94,0.05)' : 'rgba(167,139,250,0.05)'}`
            : cb ? 'rgba(251,146,60,0.05)' : empty ? 'rgba(250,204,21,0.05)' : h ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)';
          const border = isActive
            ? `${tone === 'cex' ? 'rgba(34,197,94,0.18)' : 'rgba(167,139,250,0.18)'}`
            : cb ? 'rgba(251,146,60,0.18)' : empty ? 'rgba(250,204,21,0.18)' : h ? 'rgba(239,68,68,0.18)' : 'var(--hub-border-subtle)';
          return (
            <div
              key={name}
              title={h ? `${name}: ${h.count} pairs · ${h.latencyMs}ms${cb ? ' · Circuit breaker open' : ''}${h.error ? ` · ${h.error}` : ''}` : name}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px',
                borderRadius: 8,
                background: bg, border: `1px solid ${border}`,
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: 999, background: dotColor,
                boxShadow: isActive ? `0 0 4px ${accent}66` : undefined, flexShrink: 0,
              }} />
              <ExchangeLogo exchange={name.toLowerCase()} size={14} />
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: isActive ? 'var(--fg-default)' : 'var(--fg-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>{name}</span>
              {isActive && h && (
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: accent, opacity: 0.6 }}>{h.count}</span>
              )}
              {cb && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#fb923c', opacity: 0.7 }}>CB</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fg-muted)' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />
      {label}
    </span>
  );
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }} />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div style={{
      padding: '20px 8px', textAlign: 'center',
      color: 'var(--fg-faint)', fontSize: 11,
    }}>
      No data yet
    </div>
  );
}

function SummaryStat({ icon, label, value, accent, dotPulse }: {
  icon: React.ReactNode; label: string; value: string; accent: string; dotPulse?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: `${accent}1a`,
        border: `1px solid ${accent}33`,
        color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: 'var(--fg-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {label}
          {dotPulse && <SatPing size={6} color={accent} />}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: 'var(--fg-default)', letterSpacing: '-0.01em',
        }}>{value}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Fear & Greed semicircle gauge tile
// ────────────────────────────────────────────────────────────────────
function FearGreedTile({ data }: { data: FearGreedResp | null }) {
  const value = data?.value ?? data?.data?.value ?? null;
  const cls = data?.classification ?? data?.data?.classification ?? null;
  // While loading, value is null. Previously fell through to `v = 50`
  // which rendered a half-empty arc + "—" number — looked broken.
  // Now render a static neutral track with no arc + a shimmer text
  // skeleton until real data arrives.
  const isLoading = value == null;
  const v = value ?? 50;

  // Color stop based on value
  const color = isLoading ? 'rgba(255,255,255,0.12)' : (
    v < 25 ? '#dc2626' :
    v < 45 ? '#f59e0b' :
    v < 55 ? '#facc15' :
    v < 75 ? '#84cc16' :
            '#22c55e'
  );

  // semicircle path: 180° arc from left to right, radius 60, center 75,72
  const r = 56;
  const cx = 80;
  const cy = 72;
  const angle = (v / 100) * Math.PI; // 0..π
  const endX = cx - Math.cos(angle) * r;
  const endY = cy - Math.sin(angle) * r;

  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 12,
      padding: 12,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 132,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span aria-hidden style={{ width: 3, height: 11, background: color, borderRadius: 2 }} />
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--fg-muted)',
        }}>Fear &amp; Greed</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <svg width="160" height="84" viewBox="0 0 160 84" style={{ flexShrink: 0 }}>
          {/* Track — always shown */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} strokeLinecap="round" />
          {/* Filled arc — only when we have a real value */}
          {!isLoading && (
            <>
              <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} />
              <circle cx={endX} cy={endY} r={5} fill={color} />
            </>
          )}
        </svg>
      </div>
      <div style={{
        position: 'absolute', bottom: 12, left: 12, right: 12,
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <div>
          {isLoading ? (
            <>
              <div style={{
                height: 22, width: 38,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
                backgroundSize: '200% 100%',
                borderRadius: 4,
                animation: 'shimmer 1.4s ease-in-out infinite',
              }} aria-label="Fear & Greed loading" />
              <div style={{
                height: 10, width: 64, marginTop: 3,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
                backgroundSize: '200% 100%',
                borderRadius: 3,
                animation: 'shimmer 1.4s ease-in-out infinite',
              }} />
            </>
          ) : (
            <>
              <div style={{
                fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)',
                color, letterSpacing: '-0.02em', lineHeight: 1,
              }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 3 }}>{cls ?? '—'}</div>
            </>
          )}
        </div>
        <Link href="/fear-greed" style={{
          color, fontSize: 10, fontWeight: 700, textDecoration: 'none',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          History <ChevronRight size={11} />
        </Link>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Dominance tile (BTC / ETH)
// ────────────────────────────────────────────────────────────────────
function DominanceTile({ label, value, color, symbol }: { label: string; value?: number | null; color: string; symbol: string }) {
  // Render skeleton instead of "—%" + a half-empty progress bar when
  // value is missing. The critic walkthrough flagged the loading state
  // as looking broken (faint progress line with "—%" badge).
  const isLoading = value == null;
  const v = value ?? 0;
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 12,
      padding: 12,
      position: 'relative', overflow: 'hidden',
      minHeight: 132,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${color}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative' }}>
        <TokenIconSimple symbol={symbol} size={22} />
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--fg-muted)',
        }}>{label}</span>
      </div>
      <div style={{ position: 'relative' }}>
        {isLoading ? (
          <>
            <div style={{
              height: 28, width: 100,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
              backgroundSize: '200% 100%',
              borderRadius: 4,
              animation: 'shimmer 1.4s ease-in-out infinite',
            }} aria-label={`${label} loading`} />
            <div style={{
              marginTop: 14, height: 6, borderRadius: 4,
              background: 'rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }} />
          </>
        ) : (
          <>
            <div style={{
              fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)',
              color: 'var(--fg-default)', letterSpacing: '-0.01em', lineHeight: 1,
            }}>
              {v.toFixed(2)}
              <span style={{ color, fontSize: 18, marginLeft: 2 }}>%</span>
            </div>
            {/* progress bar */}
            <div style={{ marginTop: 14, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, v))}%`,
                background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                boxShadow: `0 0 8px ${color}55`,
                transition: 'width 600ms ease-out',
              }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// ETF tile — AUM + 24h Volume + live fund count (BTC ETFs)
// ────────────────────────────────────────────────────────────────────
function ETFTile({ data }: { data: ETFResp | null }) {
  const summary = data?.summary;
  const aum    = summary?.totalAum    ?? null;
  const volume = summary?.dailyVolume ?? null;
  const liveN  = summary?.liveQuotes  ?? null;
  const totalN = summary?.totalFunds  ?? null;

  // Average 24h change across funds — directional sentiment proxy
  const funds = data?.funds ?? [];
  const validChanges = funds.map(f => f.change24h).filter((c): c is number => c != null);
  const avgChange = validChanges.length ? validChanges.reduce((s, n) => s + n, 0) / validChanges.length : null;
  const positive = avgChange == null ? null : avgChange >= 0;
  const color = positive === null ? 'var(--fg-muted)' : positive ? 'var(--pump-mild)' : 'var(--rekt-mild)';

  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 12,
      padding: 12,
      position: 'relative', overflow: 'hidden',
      minHeight: 132,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${color}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, position: 'relative' }}>
        <span aria-hidden style={{ width: 3, height: 11, background: color, borderRadius: 2 }} />
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--fg-muted)',
        }}>BTC Spot ETFs</span>
        {liveN != null && totalN != null && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)',
            padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)',
          }}>{liveN}/{totalN} live</span>
        )}
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total AUM</div>
          <div style={{
            fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)',
            color: 'var(--fg-default)', letterSpacing: '-0.01em', marginTop: 2,
          }}>
            {aum != null ? fmtUSD(aum) : '—'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>24h Vol</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-default)' }}>
              {volume != null ? fmtUSD(volume) : '—'}
            </div>
          </div>
          {avgChange != null && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
              padding: '2px 8px', borderRadius: 999,
              color, background: positive ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
              border: `1px solid ${positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
            </span>
          )}
          <Link href="/etf" style={{
            color: 'var(--hub-accent)', fontSize: 10, fontWeight: 700, textDecoration: 'none',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            ETFs <ChevronRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Major Coins price tracker (12 cards with sparkline + price + 24h%)
// ────────────────────────────────────────────────────────────────────
const MAJOR_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'TON', 'HYPE', 'PEPE'];

function MajorCoinsSection({ tickers, loading }: { tickers: TickerData[]; loading: boolean }) {
  const major = useMemo(() => {
    if (!tickers.length) return [];
    const bySym = new Map<string, TickerData>();
    for (const t of tickers) {
      if (!MAJOR_COINS.includes(t.symbol)) continue;
      const price = t.lastPrice ?? t.price ?? 0;
      if (price <= 0) continue;
      const cur = bySym.get(t.symbol);
      if (!cur || price > (cur.lastPrice ?? cur.price ?? 0)) bySym.set(t.symbol, t);
    }
    return MAJOR_COINS
      .map(s => bySym.get(s))
      .filter((x): x is TickerData => !!x);
  }, [tickers]);

  if (!loading && major.length === 0) return null;

  return (
    <section style={{ marginBottom: 14 }}>
      <SectionHead title="Major Coins · Live" right={<StreamBars height={9} bars={4} color="var(--hub-accent)" />} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 8,
      }}>
        {(loading && major.length === 0 ? new Array(8).fill(null) : major).map((t, i) => {
          if (!t) {
            return <div key={i} style={{ height: 84, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />;
          }
          const price = t.lastPrice ?? t.price ?? 0;
          const ch = t.priceChangePercent24h ?? t.change24h ?? 0;
          const positive = ch >= 0;
          const accent = positive ? 'var(--pump-mild)' : 'var(--rekt-mild)';
          return (
            <Link
              key={t.symbol}
              href={`/chart?s=${encodeURIComponent(t.symbol)}`}
              style={{
                position: 'relative', overflow: 'hidden',
                background: 'var(--hub-darker)',
                border: '1px solid var(--hub-border-subtle)',
                borderRadius: 12,
                padding: 12,
                textDecoration: 'none',
                display: 'flex', flexDirection: 'column', gap: 4,
                transition: 'border-color 150ms, transform 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${accent}`;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--hub-border-subtle)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(135deg, ${accent}10 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                <TokenIconSimple symbol={t.symbol} size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}>{t.symbol}</div>
                  <div style={{
                    fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: 'var(--fg-default)', lineHeight: 1.2,
                  }}>
                    {/* Canonical formatPrice — was inline-formatted with 3
                        decimals for $1-$100 prices ("$95.360" for SOL) which
                        didn't match the 2-decimal rule used elsewhere. */}
                    {formatPrice(price)}
                  </div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                  padding: '2px 7px', borderRadius: 999,
                  color: accent,
                  background: positive ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                  border: `1px solid ${positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                  {positive ? '+' : ''}{ch.toFixed(2)}%
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
