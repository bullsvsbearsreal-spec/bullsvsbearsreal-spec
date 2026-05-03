// ExchangeStrip — horizontal row of exchange logos with live heartbeat
// Each logo "pings" at a random cadence; occasional ones flare to represent a message burst.
const EXCHANGES = [
  'binance', 'bybit', 'okx', 'bitget', 'coinbase', 'kraken', 'mexc', 'htx', 'kucoin',
  'bitmex', 'deribit', 'hyperliquid', 'dydx', 'gmx', 'drift', 'aevo', 'lighter',
];

function ExchangeStrip({ compact = false }) {
  const [flashIdx, setFlashIdx] = React.useState(-1);
  React.useEffect(() => {
    const id = setInterval(() => {
      setFlashIdx(Math.floor(Math.random() * EXCHANGES.length));
    }, 380);
    return () => clearInterval(id);
  }, []);

  const sz = compact ? 16 : 20;
  const gap = compact ? 5 : 7;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap,
      padding: compact ? '3px 8px' : '5px 10px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: compact ? 5 : 7,
    }}>
      {EXCHANGES.map((name, i) => {
        const flash = i === flashIdx;
        return (
          <span key={name} title={name} style={{
            position: 'relative',
            width: sz, height: sz, borderRadius: 999,
            background: '#fff', overflow: 'hidden',
            flexShrink: 0,
            animation: flash ? 'exch-pop 420ms ease-out' : undefined,
            boxShadow: flash ? '0 0 8px rgba(74,222,128,0.7)' : '0 0 0 1px rgba(255,255,255,0.05)',
            transition: 'box-shadow 220ms',
          }}>
            <img src={`../../assets/exchanges/${name}.png`} alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            {flash && (
              <span style={{
                position: 'absolute', inset: -2,
                border: '1.5px solid var(--pump-mild)',
                borderRadius: 999, pointerEvents: 'none',
                animation: 'radar-ring 600ms cubic-bezier(0,0,0.2,1) forwards',
              }}/>
            )}
          </span>
        );
      })}
    </div>
  );
}

window.ExchangeStrip = ExchangeStrip;
