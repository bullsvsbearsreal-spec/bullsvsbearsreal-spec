// Footer — fixed status pill
function Footer() {
  return (
    <footer style={{
      height: 36, flexShrink: 0, background: 'var(--hub-dark)',
      borderTop: '1px solid var(--hub-border-subtle)',
      display: 'flex', alignItems: 'center', padding: '0 18px', gap: 16,
      fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--pump-mild)', fontWeight: 600 }}>
        <StreamBars height={11} bars={4} color="var(--pump-mild)"/>
        Streaming
      </span>
      <span style={{ color: 'var(--fg-muted)' }}>|</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--fg-subtle)' }}>33/33 venues</span>
        <ExchangeStrip compact/>
      </span>
      <span style={{ color: 'var(--fg-muted)' }}>|</span>
      <LatencyGauge label="api" base={142} spread={18}/>
      <LatencyGauge label="ws" base={38} spread={10}/>
      <div style={{ flex: 1 }}/>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, opacity: 0.75 }}>
        <SatPing size={11} color="var(--hub-accent)"/>
        InfoHub v2.0
      </span>
      <span style={{ opacity: 0.55 }}>Not financial advice · Third-party data · DYOR</span>
    </footer>
  );
}

window.Footer = Footer;
