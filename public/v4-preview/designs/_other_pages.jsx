// Marketing, account, content, mobile pages

function MarketingHero() {
  return (
    <Chrome active="">
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {/* Hero */}
        <div style={{ padding: '60px 40px 40px', position: 'relative', overflow: 'hidden' }}>
          {/* faint grid */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,149,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,149,0,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px', maskImage: 'radial-gradient(ellipse at 30% 30%, #000 30%, transparent 70%)',
          }}/>
          <div style={{ position: 'relative', maxWidth: 920 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)',
              fontSize: 10, color: '#FF9500', padding: '4px 10px', border: '1px solid rgba(255,149,0,0.3)',
              borderRadius: 999, background: 'rgba(255,149,0,0.05)', marginBottom: 18,
            }}>
              <RadarPulse size={8} color="#FF9500"/>
              33 EXCHANGES · STREAMING NOW
            </span>
            <h1 style={{
              fontSize: 56, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.04em',
              color: '#fff', margin: '0 0 16px',
            }}>
              The market,<br/>
              <span style={{ color: '#FF9500' }}>without the noise.</span>
            </h1>
            <p style={{ fontSize: 16, color: '#a5a8b2', maxWidth: 560, lineHeight: 1.55, marginBottom: 24 }}>
              Real-time funding, OI, liquidations, and order flow across every venue that matters. One terminal, zero lag, sub-second updates.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ background: '#FF9500', color: '#0a0a0a', fontWeight: 700, padding: '11px 22px', borderRadius: 6, fontSize: 14 }}>Start free →</span>
              <span style={{ background: 'rgba(255,255,255,0.04)', color: '#e6e6ea', padding: '11px 22px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 14 }}>See live demo</span>
            </div>
          </div>
          {/* live data peek */}
          <div style={{
            position: 'absolute', right: 40, top: 60, width: 360,
            background: '#10131a', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: 14, transform: 'rotate(2deg)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,149,0,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#777b87' }}>
              <RadarPulse size={7}/>LIVE FUNDING · 8H
            </div>
            {DATA_ROWS.slice(0, 5).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, background: r.ic, fontSize: 7, fontWeight: 800, color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.sym[0]}</span>
                <span style={{ color: '#e6e6ea', fontWeight: 600, width: 50 }}>{r.sym}</span>
                <span style={{ flex: 1 }}><Spark data={genWalk(20, 50, 4)} color={r.fund >= 0 ? '#4ade80' : '#f87171'} height={14} fill={false}/></span>
                <span style={{ color: r.fund >= 0 ? '#4ade80' : '#f87171', fontWeight: 700, width: 60, textAlign: 'right' }}>
                  {r.fund >= 0 ? '+' : ''}{r.fund.toFixed(4)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Feature strip */}
        <div style={{ padding: '40px 40px 60px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { t: 'Funding', d: 'Aggregate, average, peak. By venue, by minute.', c: '#FF9500' },
            { t: 'Liquidations', d: 'Live cascades, heatmaps, dollar value.', c: '#f87171' },
            { t: 'Open Interest', d: 'Cross-exchange OI deltas in real time.', c: '#4ade80' },
          ].map((f, i) => (
            <div key={i} style={{ padding: 18, background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: f.c, marginBottom: 10 }}/>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{f.t}</div>
              <div style={{ fontSize: 12, color: '#a5a8b2', lineHeight: 1.5 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

function PricingPage() {
  const tiers = [
    { name: 'Free', price: '$0', desc: 'For curious traders', features: ['Live funding', 'Basic OI', '5 alerts', '10min delay'], cta: 'Start free' },
    { name: 'Pro', price: '$29', desc: 'For serious traders', features: ['Everything live', 'Unlimited alerts', 'Custom screeners', 'API access', 'Priority support'], cta: 'Get Pro', highlight: true },
    { name: 'Desk', price: '$249', desc: 'For trading teams', features: ['Everything Pro', '10 seats', 'White-label', 'Webhook firehose', 'Dedicated support'], cta: 'Talk to sales' },
  ];
  return (
    <Chrome active="">
      <div style={{ flex: 1, overflow: 'auto', padding: '50px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36 }}>
        <div style={{ textAlign: 'center', maxWidth: 600 }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>Pricing that scales with you</h1>
          <p style={{ fontSize: 14, color: '#a5a8b2' }}>No seats fees. No surprise upgrades. Cancel anytime.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 280px)', gap: 14 }}>
          {tiers.map((t, i) => (
            <div key={i} style={{
              background: t.highlight ? 'linear-gradient(180deg, rgba(255,149,0,0.08), #10131a)' : '#10131a',
              border: '1px solid ' + (t.highlight ? 'rgba(255,149,0,0.4)' : 'rgba(255,255,255,0.07)'),
              borderRadius: 12, padding: 22, position: 'relative',
            }}>
              {t.highlight && (
                <span style={{
                  position: 'absolute', top: -10, left: 22,
                  background: '#FF9500', color: '#0a0a0a', fontSize: 9, fontWeight: 800,
                  padding: '3px 8px', borderRadius: 4, letterSpacing: '0.1em',
                }}>MOST POPULAR</span>
              )}
              <div style={{ fontSize: 12, color: '#777b87', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{t.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em' }}>{t.price}</span>
                <span style={{ fontSize: 12, color: '#777b87' }}>/mo</span>
              </div>
              <div style={{ fontSize: 12, color: '#a5a8b2', marginBottom: 18 }}>{t.desc}</div>
              <div style={{
                display: 'block', textAlign: 'center', padding: '9px 0', borderRadius: 6,
                background: t.highlight ? '#FF9500' : 'rgba(255,255,255,0.06)',
                color: t.highlight ? '#0a0a0a' : '#e6e6ea',
                fontWeight: 700, fontSize: 13, marginBottom: 18,
              }}>{t.cta}</div>
              {t.features.map((f, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12, color: '#a5a8b2' }}>
                  <span style={{ color: '#4ade80' }}>✓</span> {f}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

function LoginPage() {
  return (
    <Chrome active="" tape={false}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        {/* Left — live ticker preview */}
        <div style={{ background: '#0a0c12', borderRight: '1px solid rgba(255,255,255,0.04)', padding: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
            <span style={{ fontWeight: 900, fontSize: 16, color: '#e6e6ea', letterSpacing: '-0.035em' }}>Info</span>
            <span style={{ fontWeight: 900, fontSize: 16, color: '#0a0a0a', background: '#FF9500', padding: '2px 5px', borderRadius: 4 }}>Hub</span>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#777b87', fontFamily: 'var(--font-mono)', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RadarPulse size={9}/>WHAT YOU MISSED · 24H
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 14 }}>
              {DATA_ROWS.slice(0, 6).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: r.ic, fontSize: 7, fontWeight: 800, color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.sym[0]}</span>
                  <span style={{ color: '#e6e6ea', fontWeight: 600, width: 60 }}>{r.sym}</span>
                  <span style={{ flex: 1 }}><Spark data={genWalk(30, 50, 5)} color={r.chg >= 0 ? '#4ade80' : '#f87171'} height={16} fill={false}/></span>
                  <span style={{ color: r.chg >= 0 ? '#4ade80' : '#f87171', fontWeight: 700, width: 60, textAlign: 'right' }}>
                    {r.chg >= 0 ? '+' : ''}{r.chg.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#555965', marginTop: 10 }}>Sign in to see live and personalize.</div>
          </div>
          <div/>
        </div>
        {/* Right — form */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 60px' }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 6 }}>Welcome back.</h1>
          <p style={{ fontSize: 13, color: '#a5a8b2', marginBottom: 28 }}>The market never sleeps. Neither do we.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Continue with Google','Continue with X','Continue with Apple'].map(t => (
              <span key={t} style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>{t}</span>
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }}/>
            <span style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, fontSize: 13, color: '#777b87', fontFamily: 'var(--font-mono)' }}>email@example.com</span>
            <span style={{ background: '#FF9500', color: '#0a0a0a', textAlign: 'center', padding: '11px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>Continue with email</span>
          </div>
          <div style={{ marginTop: 20, fontSize: 11, color: '#555965' }}>By signing in you agree to our Terms and Privacy Policy.</div>
        </div>
      </div>
    </Chrome>
  );
}

function NewsPage() {
  const stories = [
    { t: 'Bitcoin reclaims $112K as funding flips positive across all major venues', src: 'Coindesk', t2: '4m ago', img: 'linear-gradient(135deg,#f7931a,#ffb547)' },
    { t: 'Hyperliquid breaks $1B daily volume for first time', src: 'The Block', t2: '12m ago', img: 'linear-gradient(135deg,#97fce4,#10b981)' },
    { t: 'Ethereum spot ETF inflows hit weekly record', src: 'Bloomberg', t2: '38m ago', img: 'linear-gradient(135deg,#627eea,#4a5bd0)' },
    { t: 'SEC drops appeal in landmark Ripple case', src: 'Reuters', t2: '1h ago', img: 'linear-gradient(135deg,#23292f,#555)' },
  ];
  return (
    <Chrome active="">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>News</h1>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4ade80' }}>● live · 142 sources</span>
          </div>
          {stories.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 12, background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
              <div style={{ width: 100, height: 70, background: s.img, borderRadius: 6, flexShrink: 0 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{s.t}</div>
                <div style={{ fontSize: 10, color: '#777b87', fontFamily: 'var(--font-mono)' }}>{s.src} · {s.t2}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#777b87', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Trending</div>
            {['Bitcoin ETF','Hyperliquid','Solana','Memecoins','MicroStrategy'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                <span style={{ color: '#777b87', fontFamily: 'var(--font-mono)', fontSize: 10, width: 12 }}>{i+1}</span>
                <span style={{ color: '#e6e6ea' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Chrome>
  );
}

function CoinDetailPage() {
  return (
    <Chrome active="">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 48, height: 48, borderRadius: 999, background: 'linear-gradient(135deg,#f7931a,#ffb547)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#0a0a0a' }}>B</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Bitcoin <span style={{ color: '#777b87', fontWeight: 500 }}>BTC</span></div>
            <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#777b87' }}>
              <span>Rank #1</span><span>·</span>
              <span style={{ color: '#a5a8b2' }}>MCap $2.21T</span><span>·</span>
              <span>Vol 24h $42.1B</span>
            </div>
          </div>
          <div style={{ flex: 1 }}/>
          <Animated value={112842} prefix="$" decimals={2} size={28}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4ade80', fontWeight: 700, padding: '3px 8px', background: 'rgba(74,222,128,0.1)', borderRadius: 4 }}>+2.41%</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          <StatCard label="24h Range" value={108420} delta={0} spark={genWalk(20, 50, 2)}/>
          <StatCard label="Funding" value={0.0375} delta={0.012} color="#FF9500" spark={genWalk(20, 50, 1.5)}/>
          <StatCard label="OI" value={12.47} delta={1.82} color="#4ade80" spark={genWalk(20, 50, 2)}/>
          <StatCard label="L/S Ratio" value={0.84} delta={-2.10} color="#f87171" spark={genWalk(20, 50, 2)}/>
          <StatCard label="Liq 24h" value={142} delta={42.4} color="#f87171" spark={genWalk(20, 50, 4)}/>
        </div>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, height: 220 }}>
          <Spark data={genWalk(160, 100, 2)} color="#FF9500" height={186}/>
        </div>
        <FundingTableLite title="Per-venue breakdown" period="14 venues"/>
      </div>
    </Chrome>
  );
}

function SettingsPage() {
  return (
    <Chrome active="dashboard">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', gap: 14 }}>
        <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {['Account','Profile','Billing','API keys','Webhooks','Notifications','Sessions','Danger zone'].map((t, i) => (
            <span key={t} style={{
              padding: '7px 10px', borderRadius: 5, fontSize: 12,
              background: i === 2 ? 'rgba(255,149,0,0.1)' : 'transparent',
              color: i === 2 ? '#FF9500' : '#a5a8b2',
              fontWeight: i === 2 ? 600 : 500,
            }}>{t}</span>
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Billing</h1>
          <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.1em' }}>PRO</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>$29/mo · renews May 18, 2026</div>
              <div style={{ fontSize: 11, color: '#777b87' }}>Visa ending in 4242</div>
            </div>
            <span style={{ fontSize: 12, color: '#FF9500', fontWeight: 600 }}>Manage →</span>
          </div>
          <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Usage this period</div>
            {[
              { k: 'API calls', v: 142000, max: 500000 },
              { k: 'Webhook fires', v: 1247, max: 10000 },
              { k: 'Active alerts', v: 47, max: 'unlimited' },
            ].map((u, i) => {
              const pct = typeof u.max === 'number' ? Math.min(100, u.v/u.max*100) : 12;
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: '#a5a8b2' }}>{u.k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#777b87' }}>{u.v.toLocaleString()} / {typeof u.max === 'number' ? u.max.toLocaleString() : u.max}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: pct + '%', height: '100%', background: pct > 80 ? '#f87171' : '#FF9500' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Chrome>
  );
}

// ─── Mobile mockups ────────────────────────────────────────────
function MobileFunding() {
  return (
    <div style={{
      width: 360, height: 700, background: '#07090d', color: '#e6e6ea',
      borderRadius: 28, border: '6px solid #1b1f2b', overflow: 'hidden',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column',
      boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
    }}>
      <div style={{ height: 32, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11 }}>9:41</div>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 900, fontSize: 14, color: '#e6e6ea' }}>Info</span>
        <span style={{ fontWeight: 900, fontSize: 14, color: '#0a0a0a', background: '#FF9500', padding: '2px 4px', borderRadius: 3 }}>Hub</span>
        <RadarPulse size={8}/>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4ade80', fontWeight: 600 }}>LIVE</span>
        <div style={{ flex: 1 }}/>
        <span style={{ width: 28, height: 28, borderRadius: 999, background: 'linear-gradient(135deg,#FF9500,#ff5757)' }}/>
      </div>
      <div style={{ padding: '0 14px', marginBottom: 10 }}>
        <Tape items={TAPE.slice(0, 6)}/>
      </div>
      <div style={{ padding: '0 14px 10px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Funding</h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>33 venues · 8h period</div>
      </div>
      <div style={{ padding: '0 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#777b87', letterSpacing: '0.12em' }}>VOL 24H</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, marginTop: 2 }}>$142.8B</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4ade80' }}>+4.21%</div>
        </div>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#777b87', letterSpacing: '0.12em' }}>OI</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, marginTop: 2 }}>$84.2B</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4ade80' }}>+1.82%</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px' }}>
        {DATA_ROWS.slice(0, 7).map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: r.ic, fontSize: 9, fontWeight: 800, color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.sym[0]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.sym}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#777b87' }}>${r.price < 1 ? r.price.toFixed(4) : r.price.toLocaleString()}</div>
            </div>
            <Spark data={genWalk(15, 50, 4)} color={r.fund >= 0 ? '#4ade80' : '#f87171'} height={20} fill={false}/>
            <div style={{ textAlign: 'right', minWidth: 60 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: r.fund >= 0 ? '#4ade80' : '#f87171' }}>
                {r.fund >= 0 ? '+' : ''}{r.fund.toFixed(3)}%
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: r.chg >= 0 ? '#4ade80' : '#f87171' }}>
                {r.chg >= 0 ? '+' : ''}{r.chg.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Bottom tab bar */}
      <div style={{ height: 56, borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,9,13,0.95)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 6 }}>
        {[
          { k: 'Markets', on: true },
          { k: 'Charts' }, { k: 'Alerts' }, { k: 'You' },
        ].map((t, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: t.on ? '#FF9500' : '#777b87', fontWeight: 600 }}>{t.k}</span>
        ))}
      </div>
    </div>
  );
}

function MobileChart() {
  return (
    <div style={{
      width: 360, height: 700, background: '#07090d', color: '#e6e6ea',
      borderRadius: 28, border: '6px solid #1b1f2b', overflow: 'hidden',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column',
      boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
    }}>
      <div style={{ height: 32, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11 }}>9:41</div>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18, color: '#a5a8b2' }}>‹</span>
        <span style={{ width: 26, height: 26, borderRadius: 999, background: 'linear-gradient(135deg,#f7931a,#ffb547)', fontSize: 12, fontWeight: 800, color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>B</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>BTC/USDT</span>
        <RadarPulse size={7}/>
      </div>
      <div style={{ padding: '0 14px 10px' }}>
        <Animated value={112842} prefix="$" decimals={2} size={32}/>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4ade80', fontWeight: 700 }}>+$2,712 (+2.41%) · 24h</div>
      </div>
      <div style={{ padding: 14, background: '#0a0c12', flex: 1, position: 'relative' }}>
        <Spark data={genWalk(120, 100, 2.5)} color="#FF9500" height={280} fill={true}/>
      </div>
      <div style={{ padding: '8px 14px', display: 'flex', gap: 6, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {['1H','4H','1D','1W','1M','ALL'].map((t, i) => (
          <span key={t} style={{
            flex: 1, textAlign: 'center', padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 10,
            background: i === 2 ? '#363c51' : 'transparent', color: i === 2 ? '#fff' : '#a5a8b2', borderRadius: 4,
          }}>{t}</span>
        ))}
      </div>
      <div style={{ padding: '0 14px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ padding: 10, background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#777b87' }}>FUNDING</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#4ade80' }}>+0.0375%</div>
        </div>
        <div style={{ padding: 10, background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#777b87' }}>OI</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>$12.47B</div>
        </div>
      </div>
      <div style={{ height: 56, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 6 }}>
        {[{k:'Markets'},{k:'Charts',on:true},{k:'Alerts'},{k:'You'}].map((t, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: t.on ? '#FF9500' : '#777b87', fontWeight: 600 }}>{t.k}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Admin ────────────────────────────────────────────────────
function AdminChrome({ active = 'overview', children }) {
  const items = [
    { k: 'overview', l: 'Overview' },
    { k: 'users', l: 'Users' },
    { k: 'plans', l: 'Plans & billing' },
    { k: 'venues', l: 'Venues / feeds' },
    { k: 'symbols', l: 'Symbols' },
    { k: 'content', l: 'News & airdrops' },
    { k: 'logs', l: 'System logs' },
    { k: 'flags', l: 'Feature flags' },
    { k: 'settings', l: 'Settings' },
  ];
  return (
    <div style={{ display: 'flex', height: '100%', background: '#07090d', color: '#e6e6ea', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>
      <aside style={{ width: 200, background: '#0a0c12', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 900, fontSize: 13 }}>Info</span>
          <span style={{ fontWeight: 900, fontSize: 13, color: '#0a0a0a', background: '#FF9500', padding: '2px 4px', borderRadius: 3 }}>Hub</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#f87171', padding: '2px 5px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 3, marginLeft: 4, fontWeight: 700, letterSpacing: '0.1em' }}>ADMIN</span>
        </div>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map(it => (
            <span key={it.k} style={{
              padding: '6px 10px', fontSize: 12, borderRadius: 4,
              background: active === it.k ? 'rgba(255,149,0,0.1)' : 'transparent',
              color: active === it.k ? '#FF9500' : '#a5a8b2',
              fontWeight: active === it.k ? 600 : 500,
            }}>{it.l}</span>
          ))}
        </div>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 40, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>admin / {active}</span>
          <div style={{ flex: 1 }}/>
          <RadarPulse size={8}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4ade80' }}>SYSTEMS NOMINAL</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>{children}</div>
      </main>
    </div>
  );
}

function AdminOverview() {
  return (
    <AdminChrome active="overview">
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        <StatCard label="MAU" value={142847} delta={4.21} color="#4ade80" spark={genWalk(20, 100, 3)}/>
        <StatCard label="MRR" value={184200} delta={8.12} color="#FF9500" spark={genWalk(20, 100, 4)}/>
        <StatCard label="API qps" value={4218} delta={2.10} color="#b388ff" spark={genWalk(20, 80, 6)}/>
        <StatCard label="Errors 1h" value={12} delta={-42.1} color="#f87171" spark={genWalk(20, 30, 8)}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Venue health · 33 feeds</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4 }}>
            {Array.from({length: 33}).map((_, i) => {
              const s = i === 7 ? '#f87171' : i === 14 ? '#FF9500' : '#4ade80';
              return <span key={i} style={{ aspectRatio: '1', background: s, opacity: 0.6, borderRadius: 3 }}/>;
            })}
          </div>
          <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>1 down (KuCoin) · 1 degraded (BitMEX) · 31 nominal</div>
        </div>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Recent events</div>
          {[
            { c: '#f87171', t: 'KuCoin WS reconnect failed', s: '2m ago' },
            { c: '#FF9500', t: 'Funding feed lag > 2s', s: '14m ago' },
            { c: '#4ade80', t: 'Auto-scaled +2 workers', s: '1h ago' },
            { c: '#a5a8b2', t: 'Daily backup completed', s: '4h ago' },
          ].map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 11, borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: e.c, marginTop: 4 }}/>
              <span style={{ flex: 1, color: '#a5a8b2' }}>{e.t}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#555965' }}>{e.s}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminChrome>
  );
}

function AdminUsers() {
  const users = [
    { e: 'alex@trading.co', p: 'Pro', s: 'active', joined: 'Mar 12', ltv: '$348' },
    { e: 'maria@desk.io', p: 'Desk', s: 'active', joined: 'Jan 04', ltv: '$2,490' },
    { e: 'jay@hotmail.com', p: 'Free', s: 'active', joined: 'Apr 22', ltv: '$0' },
    { e: 'priya@fund.xyz', p: 'Pro', s: 'past_due', joined: 'Feb 18', ltv: '$87' },
    { e: 'tom@sol.com', p: 'Pro', s: 'active', joined: 'Mar 30', ltv: '$58' },
    { e: 'aki@bytes.jp', p: 'Free', s: 'banned', joined: 'Apr 02', ltv: '$0' },
    { e: 'ren@trader.cn', p: 'Desk', s: 'active', joined: 'Dec 14', ltv: '$3,720' },
  ];
  return (
    <AdminChrome active="users">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Users</h1>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>142,847 total · 8,124 paying</span>
        <div style={{ flex: 1 }}/>
        <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#777b87' }}>Search…</span>
        <span style={{ background: '#FF9500', color: '#0a0a0a', padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 700 }}>Export CSV</span>
      </div>
      <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '24px 2fr 80px 80px 80px 80px 60px', padding: '8px 14px', background: 'rgba(0,0,0,0.25)', fontFamily: 'var(--font-mono)', fontSize: 8, color: '#555965', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, gap: 10 }}>
          <span></span><span>EMAIL</span><span>PLAN</span><span>STATUS</span><span>JOINED</span><span style={{textAlign:'right'}}>LTV</span><span></span>
        </div>
        {users.map((u, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 2fr 80px 80px 80px 80px 60px', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ width: 16, height: 16, borderRadius: 999, background: `linear-gradient(135deg, hsl(${i*47},60%,55%), hsl(${i*47+30},70%,45%))`, fontSize: 8, fontWeight: 800, color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u.e[0].toUpperCase()}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e6e6ea' }}>{u.e}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, alignSelf: 'center', justifySelf: 'start',
              background: u.p === 'Desk' ? 'rgba(179,136,255,0.15)' : u.p === 'Pro' ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.04)',
              color: u.p === 'Desk' ? '#b388ff' : u.p === 'Pro' ? '#FF9500' : '#777b87',
              letterSpacing: '0.08em',
            }}>{u.p.toUpperCase()}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: u.s === 'active' ? '#4ade80' : u.s === 'past_due' ? '#FF9500' : '#f87171', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{u.s}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>{u.joined}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right', color: '#e6e6ea' }}>{u.ltv}</span>
            <span style={{ fontSize: 12, color: '#777b87', textAlign: 'right' }}>⋯</span>
          </div>
        ))}
      </div>
    </AdminChrome>
  );
}

function AdminVenues() {
  const venues = [
    { n: 'Binance',     k: 'binance',     s: 'nominal', lat: 28, msg: '4.2k/s' },
    { n: 'Bybit',       k: 'bybit',       s: 'nominal', lat: 32, msg: '2.8k/s' },
    { n: 'OKX',         k: 'okx',         s: 'nominal', lat: 41, msg: '1.4k/s' },
    { n: 'Coinbase',    k: 'coinbase',    s: 'nominal', lat: 88, msg: '820/s' },
    { n: 'Hyperliquid', k: 'hyperliquid', s: 'nominal', lat: 22, msg: '1.1k/s' },
    { n: 'BitMEX',      k: 'bitmex',      s: 'degraded', lat: 1820, msg: '120/s' },
    { n: 'KuCoin',      k: 'kucoin',      s: 'down', lat: 0, msg: '0/s' },
    { n: 'Kraken',      k: 'kraken',      s: 'nominal', lat: 64, msg: '480/s' },
    { n: 'Bitget',      k: 'bitget',      s: 'nominal', lat: 35, msg: '910/s' },
    { n: 'MEXC',        k: 'mexc',        s: 'nominal', lat: 47, msg: '720/s' },
    { n: 'HTX',         k: 'htx',         s: 'nominal', lat: 62, msg: '380/s' },
    { n: 'Deribit',     k: 'deribit',     s: 'nominal', lat: 40, msg: '210/s' },
  ];
  return (
    <AdminChrome active="venues">
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>Venues / Feeds</h1>
      <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        {venues.map((v, i) => {
          const c = v.s === 'nominal' ? '#4ade80' : v.s === 'degraded' ? '#FF9500' : '#f87171';
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 2fr 80px 80px 80px 1fr', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
              {v.s === 'down'
                ? <span style={{ width: 8, height: 8, borderRadius: 999, background: c }}/>
                : <RadarPulse size={9} color={c}/>}
              <span style={{ fontWeight: 600 }}>{v.n}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{v.s}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: v.lat > 500 ? '#FF9500' : '#a5a8b2' }}>{v.lat}ms</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#a5a8b2' }}>{v.msg}</span>
              <span style={{ display: 'flex', gap: 1 }}>
                {Array.from({length: 40}).map((_, j) => {
                  const ok = !(v.s !== 'nominal' && j > 30);
                  return <span key={j} style={{ flex: 1, height: 16, background: ok ? 'rgba(74,222,128,0.4)' : (v.s === 'down' ? '#f87171' : '#FF9500'), borderRadius: 1, opacity: 0.5 + Math.random() * 0.5 }}/>;
                })}
              </span>
            </div>
          );
        })}
      </div>
    </AdminChrome>
  );
}

function AdminContent() {
  const items = [
    { t: 'Bitcoin reclaims $112K as funding flips positive', a: 'CMS', s: 'published', when: '4m ago' },
    { t: 'Hyperliquid breaks $1B daily volume', a: 'Auto', s: 'published', when: '12m ago' },
    { t: 'New airdrop: Lighter rewards Q2', a: 'CMS', s: 'draft', when: '1h ago' },
    { t: 'SEC drops appeal in Ripple case', a: 'Auto', s: 'review', when: '2h ago' },
    { t: 'Weekly market wrap', a: 'CMS', s: 'scheduled', when: 'tomorrow' },
  ];
  return (
    <AdminChrome active="content">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>News &amp; Airdrops</h1>
        <div style={{ flex: 1 }}/>
        <span style={{ background: '#FF9500', color: '#0a0a0a', padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 700 }}>+ New article</span>
      </div>
      <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        {items.map((x, i) => {
          const c = x.s === 'published' ? '#4ade80' : x.s === 'draft' ? '#777b87' : x.s === 'review' ? '#FF9500' : '#b388ff';
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '8px 2fr 80px 80px 80px', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: c }}/>
              <span style={{ color: '#e6e6ea' }}>{x.t}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#777b87', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{x.a}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: c, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{x.s}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555965' }}>{x.when}</span>
            </div>
          );
        })}
      </div>
    </AdminChrome>
  );
}

Object.assign(window, {
  MarketingHero, PricingPage, LoginPage, NewsPage, CoinDetailPage, SettingsPage,
  MobileFunding, MobileChart,
  AdminOverview, AdminUsers, AdminVenues, AdminContent,
});
