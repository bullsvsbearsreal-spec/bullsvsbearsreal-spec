// Sidebar — page-grouped with section icons
const sIcon = (path) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html: path}}/>;

// Lucide-ish icon paths
const I = {
  search:    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  fundRate:  '<path d="M3 3v18h18"/><polyline points="7 14 11 10 14 13 19 7"/>',
  fundHeat:  '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  fundArb:   '<path d="M21 7H3M16 3l5 4-5 4"/><path d="M3 17h18M8 13l-5 4 5 4"/>',
  oi:        '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  oiHeat:    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  liq:       '<path d="M12 2v8"/><path d="m6 6 6 6 6-6"/><path d="M5 22h14"/>',
  liqHeat:   '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  liqMap:    '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
  liqLevels: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><circle cx="6" cy="12" r="2" fill="currentColor"/>',
  ls:        '<path d="M3 12h4M17 12h4"/><path d="M7 7h10v10H7z"/><path d="M12 4v16"/>',
  etf:       '<path d="M3 3h18v18H3z"/><path d="M3 9h18M9 3v18"/>',
  spreads:   '<path d="m3 7 9 5 9-5"/><path d="M3 17l9-5 9 5"/>',
  screener:  '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  chart:     '<path d="M3 3v18h18"/><path d="M7 16V8m4 8V11m4 5V6m4 10v-3"/>',
  options:   '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
  alerts:    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  news:      '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zM4 22a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8M10 10h8"/>',
  reports:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  cal:       '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  dash:      '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  watch:     '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  pos:       '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

const SIDEBAR_SECTIONS = [
  {
    id: 'derivatives', label: 'Derivatives',
    items: [
      { id: 'funding',         label: 'Funding Rates',   color: 'var(--pump-mild)',   icon: I.fundRate },
      { id: 'funding-heatmap', label: 'Funding Heatmap', color: 'var(--pump-mild)',   icon: I.fundHeat },
      { id: 'funding-arb',     label: 'Funding Arb',     color: 'var(--pump-mild)',   icon: I.fundArb },
      { id: 'oi',              label: 'Open Interest',   color: 'var(--hub-accent-light)', icon: I.oi },
      { id: 'oi-heatmap',      label: 'OI Heatmap',      color: 'var(--hub-accent-light)', icon: I.oiHeat },
      { id: 'liq',             label: 'Liquidations',    color: 'var(--rekt-mild)',   icon: I.liq },
      { id: 'liq-heatmap',     label: 'Liq Heatmap',     color: 'var(--rekt-mild)',   icon: I.liqHeat },
      { id: 'liq-map',         label: 'Liq Map',         color: 'var(--rekt-mild)',   icon: I.liqMap },
      { id: 'liq-levels',      label: 'Liq Levels',      color: 'var(--rekt-mild)',   icon: I.liqLevels },
      { id: 'long-short',      label: 'Long / Short',    color: 'var(--hub-ai)',      icon: I.ls },
      { id: 'etf',             label: 'ETF Tracker',     color: 'var(--hub-accent)',  icon: I.etf },
    ],
  },
  {
    id: 'spot', label: 'Spot & Markets',
    items: [
      { id: 'screener',  label: 'Screener',  color: 'var(--fg-muted)', icon: I.screener },
      { id: 'chart',     label: 'Chart',     color: 'var(--fg-muted)', icon: I.chart },
      { id: 'options',   label: 'Options',   color: 'var(--fg-muted)', icon: I.options },
      { id: 'spreads',   label: 'Spreads',   color: 'var(--fg-muted)', icon: I.spreads },
    ],
  },
  {
    id: 'tools', label: 'Tools',
    items: [
      { id: 'dashboard', label: 'Dashboard', color: 'var(--hub-accent)', icon: I.dash },
      { id: 'watchlist', label: 'Watchlists', color: 'var(--hub-accent)', icon: I.watch },
      { id: 'alerts',    label: 'Alerts',    color: 'var(--hub-accent)', icon: I.alerts },
      { id: 'news',      label: 'News',      color: 'var(--fg-muted)',    icon: I.news },
    ],
  },
];

function Sidebar({ active, setActive }) {
  const [q, setQ] = React.useState('');
  const meta = window.IH?.useStreamMeta?.() || { msgPerSec: 0 };
  const filtered = React.useMemo(() => {
    if (!q.trim()) return SIDEBAR_SECTIONS;
    const ql = q.toLowerCase();
    return SIDEBAR_SECTIONS.map(s => ({
      ...s, items: s.items.filter(it => it.label.toLowerCase().includes(ql)),
    })).filter(s => s.items.length);
  }, [q]);

  return (
    <aside style={{
      width: 232, flexShrink: 0, background: 'var(--hub-black)',
      borderRight: '1px solid var(--hub-border-subtle)', padding: '12px 8px',
      display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto',
    }}>
      <div style={{ position: 'relative', padding: '0 4px' }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', display: 'inline-flex' }} dangerouslySetInnerHTML={{__html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`}}/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search coin…"
          style={{ width: '100%', background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
            borderRadius: 7, padding: '7px 10px 7px 30px', color: 'var(--fg-default)',
            fontFamily: 'var(--font-sans)', fontSize: 12, outline: 'none' }}/>
      </div>

      {filtered.map(sec => (
        <div key={sec.id}>
          <div style={{
            fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase',
            letterSpacing: '0.14em', fontWeight: 700, padding: '0 12px 6px',
          }}>{sec.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sec.items.map(it => {
              const on = active === it.id;
              return (
                <button key={it.id} onClick={() => setActive(it.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
                    border: 'none', background: on ? 'rgba(255,165,0,0.08)' : 'transparent',
                    borderLeft: on ? '2px solid var(--hub-accent)' : '2px solid transparent',
                    borderRadius: on ? '0 6px 6px 0' : 6,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12,
                    color: on ? 'var(--fg-default)' : 'var(--fg-muted)',
                    fontWeight: on ? 600 : 500, textAlign: 'left', width: '100%',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ color: on ? it.color : 'var(--fg-subtle)', flexShrink: 0, display: 'inline-flex' }}
                    dangerouslySetInnerHTML={{__html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${it.icon}</svg>`}}/>
                  <span style={{ flex: 1 }}>{it.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ flex: 1 }}/>
      <div style={{
        padding: 10, background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
        borderRadius: 9, display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 700, color: 'var(--pump-mild)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          <span style={{ width: 5, height: 5, background: 'var(--pump-mild)', borderRadius: 999, boxShadow: '0 0 6px var(--pump-mild)' }}/>
          Online · 33
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 700, color: 'var(--hub-accent-light)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          <span style={{ width: 5, height: 5, background: 'var(--hub-accent-light)', borderRadius: 999 }}/>
          DEX · 15
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{(meta.msgPerSec/1000).toFixed(1)}k msg/s</div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
window.SIDEBAR_SECTIONS = SIDEBAR_SECTIONS;
