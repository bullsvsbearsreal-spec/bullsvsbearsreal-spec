// Header — dropdown nav grouped by domain (Scan & Trade / Monitor / Risk / Research / My Tools)
const NAV_GROUPS = [
  {
    key: 'scan', label: 'Scan & Trade',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>,
    items: [
      { id: 'screener',     label: 'Screener',         hint: 'Filter & sort 2,800 markets' },
      { id: 'chart',        label: 'Chart',            hint: 'Candles + book + tape' },
      { id: 'options',      label: 'Options',          hint: 'Chain · Greeks · IV' },
      { id: 'spreads',      label: 'Spreads',          hint: 'Cross-venue arb' },
      { id: 'funding-arb',  label: 'Funding Arb',      hint: 'Long/short pairs' },
    ],
  },
  {
    key: 'monitor', label: 'Monitor',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/></svg>,
    items: [
      { id: 'funding',         label: 'Funding Rates',   hint: 'Live across 33 venues' },
      { id: 'funding-heatmap', label: 'Funding Heatmap', hint: 'Asset × venue grid' },
      { id: 'oi',              label: 'Open Interest',   hint: 'OI changes, dominance' },
      { id: 'oi-heatmap',      label: 'OI Heatmap',      hint: 'OI flux grid' },
      { id: 'long-short',      label: 'Long / Short',    hint: 'Crowd positioning' },
      { id: 'etf',             label: 'ETF Tracker',     hint: 'Spot ETF flows' },
    ],
  },
  {
    key: 'risk', label: 'Risk',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    items: [
      { id: 'liq',         label: 'Liquidations',    hint: 'Live rekt feed' },
      { id: 'liq-heatmap', label: 'Liq Heatmap',     hint: 'Heat tiles · whale tags' },
      { id: 'liq-map',     label: 'Liq Map',         hint: 'Price-level density' },
      { id: 'liq-levels',  label: 'Liq Levels',      hint: 'Imminent zones' },
      { id: 'alerts',      label: 'Alerts',          hint: 'Triggers + history' },
    ],
  },
  {
    key: 'research', label: 'Research',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
    items: [
      { id: 'news',     label: 'News Feed',     hint: 'Curated + signals' },
      { id: 'reports',  label: 'Reports',       hint: 'Weekly recaps' },
      { id: 'calendar', label: 'Event Calendar',hint: 'Macro + token events' },
    ],
  },
  {
    key: 'tools', label: 'My Tools',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    items: [
      { id: 'dashboard', label: 'Dashboard',     hint: 'Portfolio overview' },
      { id: 'watchlist', label: 'Watchlists',    hint: 'Pinned coins' },
      { id: 'positions', label: 'Positions',     hint: 'Open + history' },
      { id: 'settings',  label: 'Settings',      hint: 'Account + API' },
    ],
  },
];

// flat lookup so the router can find what group a page belongs to
const NAV_FLAT = NAV_GROUPS.flatMap(g => g.items.map(it => ({ ...it, groupKey: g.key, groupLabel: g.label })));

function IconChevron() {
  return <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function IconSearch() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}
function IconBell() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
}
function IconHeart() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
}
function IconMoon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}

function NavDropdown({ group, active, setActive, openKey, setOpenKey }) {
  const isOpen = openKey === group.key;
  // is any item in this group active?
  const groupActive = group.items.some(it => it.id === active);

  return (
    <div style={{ position: 'relative', height: '100%' }}
      onMouseEnter={() => setOpenKey(group.key)}
      onMouseLeave={() => setOpenKey(null)}>
      <button style={{
        height: '100%', padding: '0 10px', background: 'transparent', border: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
        color: groupActive || isOpen ? 'var(--fg-default)' : 'var(--fg-muted)',
        fontFamily: 'var(--font-sans)', fontSize: 13,
        fontWeight: groupActive ? 600 : 500, letterSpacing: '-0.005em', cursor: 'pointer',
        transition: 'color 120ms',
      }}>
        <span style={{ color: 'var(--hub-accent)', display: 'inline-flex' }}>{group.icon}</span>
        {group.label}
        <span style={{ color: 'var(--fg-subtle)', display: 'inline-flex', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}><IconChevron/></span>
        {groupActive && <span style={{
          position: 'absolute', left: 10, right: 10, bottom: 0, height: 2,
          background: 'var(--hub-accent)', boxShadow: '0 0 8px rgb(255 165 0 / 0.4)',
        }}/>}
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, minWidth: 240,
          background: 'rgba(15,18,24,0.98)', backdropFilter: 'blur(8px)',
          border: '1px solid var(--hub-border-hover)', borderRadius: 10,
          boxShadow: '0 18px 40px -12px rgba(0,0,0,0.7)',
          padding: 5, marginTop: 2, zIndex: 50,
        }}>
          {group.items.map(it => {
            const on = active === it.id;
            return (
              <button key={it.id} onClick={() => { setActive(it.id); setOpenKey(null); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'baseline', gap: 8,
                  padding: '8px 10px', borderRadius: 6, border: 'none',
                  background: on ? 'var(--hub-secondary-medium)' : 'transparent',
                  color: 'var(--fg-default)', fontFamily: 'var(--font-sans)', fontSize: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontWeight: on ? 600 : 500, color: on ? 'var(--hub-accent)' : 'var(--fg-default)' }}>{it.label}</span>
                <span style={{ flex: 1 }}/>
                <span style={{ fontSize: 10, color: 'var(--fg-subtle)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>{it.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header({ active, setActive, onSearch }) {
  const [openKey, setOpenKey] = React.useState(null);
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40, height: 48, flexShrink: 0,
      background: 'rgba(7,9,13,0.92)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--hub-border)',
      display: 'flex', alignItems: 'center', padding: '0 14px', gap: 4,
    }}>
      <Logo size="md"/>
      <div style={{ width: 1, height: 24, background: 'var(--hub-border-subtle)', margin: '0 8px' }}/>
      <nav style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {NAV_GROUPS.map(g => (
          <NavDropdown key={g.key} group={g} active={active} setActive={setActive} openKey={openKey} setOpenKey={setOpenKey}/>
        ))}
      </nav>
      <div style={{ flex: 1 }}/>
      <button onClick={onSearch} style={{
        background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
        borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8,
        color: 'var(--fg-subtle)', fontFamily: 'var(--font-sans)', fontSize: 12,
        cursor: 'pointer', minWidth: 220,
      }}>
        <IconSearch/>
        <span style={{ flex: 1, textAlign: 'left' }}>Search or jump to…</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)',
          background: 'var(--hub-secondary)', padding: '1px 5px', borderRadius: 3,
        }}>⌘K</span>
      </button>
      <button style={iconBtn}><IconHeart/></button>
      <button style={iconBtn}><IconMoon/></button>
      <button style={iconBtn}>
        <IconBell/>
        <span style={{
          position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 999,
          background: 'var(--hub-accent)', boxShadow: '0 0 6px var(--hub-accent)',
        }}/>
      </button>
      <button style={{
        width: 32, height: 32, borderRadius: 999, padding: 0, border: '1px solid var(--hub-border)',
        background: 'linear-gradient(135deg,#FFB800,#FF8C00)', color: '#07090d',
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 800,
        cursor: 'pointer', marginLeft: 4,
      }}>JD</button>
    </header>
  );
}

const iconBtn = {
  position: 'relative', width: 32, height: 32, border: '1px solid var(--hub-border)',
  borderRadius: 8, background: 'var(--hub-darker)', color: 'var(--fg-muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

window.Header = Header;
window.NAV_GROUPS = NAV_GROUPS;
window.NAV_FLAT = NAV_FLAT;
