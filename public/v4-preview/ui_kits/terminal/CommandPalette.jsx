// CommandPalette — ⌘K spotlight for nav + coins
const { useState: cpUseState, useEffect: cpUseEffect, useMemo: cpUseMemo } = React;

const CP_NAV = [
  { id: 'funding',   label: 'Funding Rates',  hint: 'Real-time funding across 33 venues' },
  { id: 'oi',        label: 'Open Interest',  hint: 'OI changes, dominance, leaderboard' },
  { id: 'liq',       label: 'Liquidations',   hint: 'Live rekt feed + heatmap' },
  { id: 'screener',  label: 'Screener',       hint: 'Filter & sort 2,800+ markets' },
  { id: 'chart',     label: 'Chart',          hint: 'Candles + book + tape' },
  { id: 'options',   label: 'Options Chain',  hint: 'Greeks, IV, OI by strike' },
  { id: 'dashboard', label: 'Dashboard',      hint: 'Portfolio, watchlist, activity' },
  { id: 'alerts',    label: 'Alerts',         hint: 'Price / funding / OI triggers' },
];

function CommandPalette({ open, onClose, onNav, onPickCoin }) {
  const [q, setQ] = cpUseState('');
  const [idx, setIdx] = cpUseState(0);
  const inputRef = React.useRef(null);
  const coins = window.IH.state.coins;

  cpUseEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const items = cpUseMemo(() => {
    const ql = q.trim().toLowerCase();
    const navHits = CP_NAV
      .filter(n => !ql || n.label.toLowerCase().includes(ql) || n.id.includes(ql))
      .map(n => ({ kind: 'nav', ...n }));
    const coinHits = coins
      .filter(c => !ql || c.sym.toLowerCase().includes(ql) || c.name.toLowerCase().includes(ql))
      .slice(0, 12)
      .map(c => ({ kind: 'coin', id: c.sym, label: c.sym, hint: c.name, coin: c }));
    return [...navHits, ...coinHits];
  }, [q, coins]);

  cpUseEffect(() => { if (idx >= items.length) setIdx(0); }, [items.length]);

  function commit(it) {
    if (!it) return;
    if (it.kind === 'nav') onNav?.(it.id);
    else onPickCoin?.(it.coin);
    onClose?.();
  }

  function keydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter')     { e.preventDefault(); commit(items[idx]); }
  }

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '12vh',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '92vw', background: 'rgba(15,18,24,0.98)',
        border: '1px solid var(--hub-border-hover)', borderRadius: 14,
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,165,0,0.06)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--hub-border-subtle)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-subtle)' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={keydown}
            placeholder="Jump to page or coin…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--fg-default)', fontFamily: 'var(--font-sans)', fontSize: 14 }}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
            background: 'var(--hub-secondary)', padding: '2px 6px', borderRadius: 4 }}>esc</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
          {items.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 12 }}>No results</div>
          )}
          {items.map((it, i) => (
            <div key={it.kind + ':' + it.id} onClick={() => commit(it)} onMouseEnter={() => setIdx(i)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
              background: i === idx ? 'var(--hub-secondary-medium)' : 'transparent', cursor: 'pointer',
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                color: it.kind === 'nav' ? 'var(--hub-accent-light)' : 'var(--pump-mild)',
                width: 38, textAlign: 'center', textTransform: 'uppercase',
              }}>{it.kind === 'nav' ? 'Page' : 'Coin'}</span>
              <span style={{ fontWeight: 600, color: 'var(--fg-default)', fontSize: 13 }}>{it.label}</span>
              <span style={{ flex: 1, color: 'var(--fg-subtle)', fontSize: 11, fontFamily: it.kind === 'coin' ? 'var(--font-sans)' : 'var(--font-sans)' }}>{it.hint}</span>
              {it.kind === 'coin' && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  color: it.coin.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>
                  {it.coin.chg >= 0 ? '+' : ''}{it.coin.chg.toFixed(2)}%
                </span>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--hub-border-subtle)',
          display: 'flex', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
          <span><kbd style={kbd}>↑↓</kbd> navigate</span>
          <span><kbd style={kbd}>↵</kbd> open</span>
          <span><kbd style={kbd}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

const kbd = { fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 5px',
  background: 'var(--hub-secondary)', borderRadius: 3, color: 'var(--fg-muted)', marginRight: 4 };

const cpKeyframes = `@keyframes cp-fade { from { opacity: 0; transform: translateY(-8px);} to { opacity: 1; transform: translateY(0);} }`;
if (!document.getElementById('cp-keyframes')) {
  const s = document.createElement('style'); s.id = 'cp-keyframes'; s.textContent = cpKeyframes; document.head.appendChild(s);
}

window.CommandPalette = CommandPalette;
