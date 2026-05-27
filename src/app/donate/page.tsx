'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Copy, CheckCircle2, Info, Bitcoin, ExternalLink, Sparkles } from 'lucide-react';
import { TerminalPageTitle, SatPing } from '@/components/design-system';

interface DonationAsset {
  chain: string;
  label: string;
  symbol: string;
  address: string;
  color: string;
  uri?: (addr: string) => string;
  accepts: string;
}

const ADDRESSES: DonationAsset[] = [
  {
    chain: 'Bitcoin',
    label: 'BTC',
    symbol: 'BTC',
    address: 'bc1qda0lsde66wc8wnaqe2uj586swcc9gxchh2gy34',
    color: '#f7931a',
    uri: (addr) => `bitcoin:${addr}`,
    accepts: 'Native BTC · Bitcoin mainnet',
  },
  {
    chain: 'Ethereum + L2s',
    label: 'EVM',
    symbol: 'ETH',
    address: '0xc6e2729BBa563BBa3935e16421aF1fEcdcC5BF6d',
    color: '#627eea',
    uri: (addr) => `ethereum:${addr}`,
    accepts: 'ETH, USDC, USDT, any ERC-20 on Ethereum / Arbitrum / Optimism / Base / Polygon / BNB / Avalanche',
  },
  {
    chain: 'Solana',
    label: 'SOL',
    symbol: 'SOL',
    address: 'GeHtgruEheEcicReRGEFmZSQZKArn7Hpj5CdTEqSBAHE',
    color: '#9945ff',
    uri: (addr) => `solana:${addr}`,
    accepts: 'SOL, USDC, any SPL token',
  },
  {
    chain: 'Hyperliquid (HyperEVM)',
    label: 'HYPE',
    symbol: 'HYPE',
    address: '0xc6e2729BBa563BBa3935e16421aF1fEcdcC5BF6d',
    color: '#50d2c1',
    uri: (addr) => `ethereum:${addr}`,
    accepts: 'HYPE, USDC, any token on Hyperliquid L1',
  },
  {
    chain: 'Tron',
    label: 'TRX',
    symbol: 'USDT',
    address: 'TRekfdBko79SAk8dykkvrC6jyYJHhETydE',
    color: '#ff0013',
    accepts: 'USDT-TRC20, TRX',
  },
];

function qrUrl(value: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=0a0c10&color=ffffff&margin=10`;
}

function AddressCard({ asset }: { asset: DonationAsset }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const payload = asset.uri ? asset.uri(asset.address) : asset.address;

  // Esc dismisses the expanded QR modal. Was only dismissible by
  // clicking the backdrop or the close button — keyboard users
  // couldn't escape without reaching for the mouse.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(asset.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }, [asset.address]);

  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 14,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 200ms, transform 200ms',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = `${asset.color}66`;
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--hub-border-subtle)';
    }}
    >
      {/* Color glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        background: `radial-gradient(circle, ${asset.color}22 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12, position: 'relative' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: `${asset.color}1a`,
          border: `1px solid ${asset.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {asset.chain === 'Bitcoin' ? (
            <Bitcoin style={{ width: 20, height: 20, color: asset.color }} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 800, color: asset.color, letterSpacing: '0.02em' }}>
              {asset.label}
            </span>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--fg-default)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {asset.chain}
            <span style={{
              fontSize: 9, padding: '1px 6px',
              borderRadius: 999,
              background: `${asset.color}22`,
              color: asset.color,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>{asset.symbol}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.35, marginTop: 2 }}>
            {asset.accepts}
          </div>
        </div>
      </div>

      {/* QR + address */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Show ${asset.chain} QR code larger`}
          style={{
            flexShrink: 0,
            width: 100, height: 100,
            borderRadius: 8,
            background: '#0a0c10',
            border: `1px solid ${asset.color}40`,
            overflow: 'hidden',
            cursor: 'zoom-in',
            padding: 0,
            transition: 'border-color 150ms',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl(payload, 200)} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />
        </button>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontSize: 9, color: 'var(--fg-faint)',
              fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 4,
            }}>
              Address
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11, lineHeight: 1.4,
              color: 'var(--fg-default)',
              wordBreak: 'break-all',
            }}>
              {asset.address}
            </div>
          </div>
          <button
            type="button"
            onClick={copy}
            style={{
              marginTop: 10,
              display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              border: copied ? '1px solid rgba(34,197,94,0.4)' : `1px solid ${asset.color}40`,
              background: copied ? 'rgba(34,197,94,0.12)' : `${asset.color}15`,
              color: copied ? 'var(--pump-mild)' : asset.color,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'all 150ms',
            }}
          >
            {copied ? (<><CheckCircle2 style={{ width: 12, height: 12 }} /> Copied</>) : (<><Copy style={{ width: 12, height: 12 }} /> Copy</>)}
          </button>
        </div>
      </div>

      {/* Expanded modal */}
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--hub-card)',
              borderRadius: 14,
              padding: 20,
              maxWidth: 380,
              width: '100%',
              border: `1px solid ${asset.color}55`,
              boxShadow: `0 30px 60px ${asset.color}22, 0 0 0 1px rgba(255,255,255,0.04)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${asset.color}22`,
                border: `1px solid ${asset.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {asset.chain === 'Bitcoin' ? (
                  <Bitcoin style={{ width: 16, height: 16, color: asset.color }} />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: asset.color }}>{asset.label}</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-default)' }}>{asset.chain}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{asset.symbol}</div>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl(payload, 400)} alt="QR large" style={{ width: '100%', height: 'auto', borderRadius: 10, background: '#0a0c10' }} />
            <div style={{
              marginTop: 12, padding: 10,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--fg-default)',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              wordBreak: 'break-all',
            }}>
              {asset.address}
            </div>
            <button
              onClick={() => setExpanded(false)}
              style={{
                marginTop: 12, width: '100%',
                padding: '9px 0',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--hub-border-subtle)',
                borderRadius: 8,
                color: 'var(--fg-muted)',
                fontSize: 11, fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DonatePage() {
  return (
    <div id="main-content" style={{ padding: '20px 22px', maxWidth: 1100, margin: '0 auto' }}>
      <TerminalPageTitle
        title="SUPPORT INFOHUB"
        subtitle="Solo-built · keeps everything free · no signup required"
        accent="var(--hub-accent)"
        right={
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 10px',
            borderRadius: 999,
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.25)',
            color: '#f43f5e',
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            <Heart style={{ width: 11, height: 11, fill: '#f43f5e' }} />
            Donations open
          </div>
        }
      />

      {/* Hero pitch */}
      <div style={{
        marginTop: 14, marginBottom: 16,
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(244,63,94,0.06) 0%, rgba(251,146,60,0.04) 100%)',
        border: '1px solid rgba(244,63,94,0.15)',
        borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'rgba(244,63,94,0.15)',
          border: '1px solid rgba(244,63,94,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Heart style={{ width: 22, height: 22, color: '#f43f5e', fill: '#f43f5e' }} />
        </div>
        <p style={{ flex: 1, fontSize: 13, color: 'var(--fg-default)', lineHeight: 1.55, margin: 0 }}>
          Running InfoHub costs real money in API calls, RPC quotas, and DB storage. Pro + Whale tiers are live (free during launch — see <Link href="/pricing" style={{ color: 'var(--hub-accent)' }}>/pricing</Link>), but core tools stay free for most users. A tip now keeps me shipping
          full-time, and you get credited as a <strong style={{ color: 'var(--hub-accent)' }}>day-one supporter</strong> when paid billing turns on.
        </p>
      </div>

      {/* Address grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        {ADDRESSES.map(a => (
          <AddressCard key={a.chain} asset={a} />
        ))}
      </div>

      {/* What it funds */}
      <div style={{
        background: 'var(--hub-darker)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 12,
        padding: 16, marginBottom: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        }}>
          <SatPing size={11} color="var(--hub-accent)" />
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--fg-default)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>What your donation funds</div>
        </div>
        <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
          {[
            'Hosting, edge compute, and database to keep the site responsive at scale',
            'Premium API access where free tiers throttle or return stale data',
            'Shipping new features before they get rolled into paid tiers',
            'Time for me to build full-time instead of between other work',
          ].map((t) => (
            <li key={t} style={{
              fontSize: 12, color: 'var(--fg-muted)',
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--hub-border-subtle)',
              borderRadius: 8,
              lineHeight: 1.45,
            }}>
              <span style={{ color: 'var(--hub-accent)', marginRight: 6 }}>›</span>{t}
            </li>
          ))}
        </ul>
      </div>

      {/* Day-one perk */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(var(--hub-accent-rgb), 0.07) 0%, transparent 60%)',
        border: '1px solid rgba(var(--hub-accent-rgb), 0.25)',
        borderRadius: 12,
        padding: 16, marginBottom: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        }}>
          <Sparkles style={{ width: 14, height: 14, color: 'var(--hub-accent)' }} />
          <div style={{
            fontSize: 11, fontWeight: 800,
            color: 'var(--hub-accent)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Day-one supporter perk</div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-default)', lineHeight: 1.55, margin: 0 }}>
          When paid billing turns on (NowPayments crypto checkout), anyone who donated before launch will be recognized as a day-one supporter.
          Either a permanent free upgrade to one of the paid tiers (Trader, Pro, or Whale), a meaningful discount, or something bigger. Exact details will be locked in when ready, but no one who put in crypto early will get forgotten.
          <span style={{ display: 'block', marginTop: 6, color: 'var(--fg-muted)', fontSize: 11 }}>
            💡 Save your tx hash so I can verify and credit you.
          </span>
        </p>
      </div>

      {/* Other ways */}
      <div style={{
        background: 'var(--hub-darker)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 12,
        padding: 16, marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, marginBottom: 10,
          color: 'var(--fg-default)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>Other ways to help</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          <a
            href="https://x.com/info_hub69"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--hub-border-subtle)',
              borderRadius: 10,
              color: 'var(--fg-default)',
              textDecoration: 'none',
              transition: 'background 150ms, border-color 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--hub-border)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--hub-border-subtle)';
            }}
          >
            <ExternalLink style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, color: 'var(--hub-accent)' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Follow on X</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                Share useful tools and tag <span style={{ color: 'var(--hub-accent)' }}>@info_hub69</span>
              </div>
            </div>
          </a>
          <a
            href="https://t.me/+Z6SQGJ57SlwyY2Rk"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--hub-border-subtle)',
              borderRadius: 10,
              color: 'var(--fg-default)',
              textDecoration: 'none',
              transition: 'background 150ms, border-color 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--hub-border)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--hub-border-subtle)';
            }}
          >
            <ExternalLink style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, color: 'var(--hub-accent)' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Join Telegram</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                Roadmap updates and early access
              </div>
            </div>
          </a>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--hub-border-subtle)',
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: -2, color: 'var(--hub-accent)' }}>★</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, color: 'var(--fg-default)' }}>Use affiliate links</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                Sign up for exchanges via InfoHub — small cut at no cost to you
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 8,
        fontSize: 11, lineHeight: 1.5,
        color: 'var(--fg-muted)',
      }}>
        <Info style={{ width: 13, height: 13, flexShrink: 0, marginTop: 2, color: 'var(--fg-faint)' }} />
        <div>
          Donations are gifts, not subscriptions — features stay free for everyone. No minimum, no maximum, no expectation.
          <strong style={{ color: 'var(--rekt-mild)', marginLeft: 4 }}>Always double-check the address and network</strong> — funds sent to the wrong network can&apos;t be recovered.
        </div>
      </div>
    </div>
  );
}
