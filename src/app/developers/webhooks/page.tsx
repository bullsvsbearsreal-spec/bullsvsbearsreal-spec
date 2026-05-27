'use client';

/**
 * /developers/webhooks — setup + verification guide for the Whale-tier
 * custom HTTPS webhook channel shipped in commit b866d4a8 (Phase 5).
 *
 * Audience: developers integrating InfoHub alerts into their own
 * trading bot / Slack / internal dashboard. Without a UI for adding
 * webhook URLs, this guide is the primary onramp — every example is
 * copy-paste runnable.
 */

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Webhook, Copy, Check, AlertTriangle, Lock, Send, ArrowRight, Crown } from 'lucide-react';

export default function WebhooksGuidePage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[900px] mx-auto w-full px-4 sm:px-6 py-6">
        <PageHero
          icon={Webhook}
          eyebrow="Developers"
          title="Custom"
          accentNoun="webhooks"
          accent="emerald"
          description={
            <>
              Receive HMAC-signed alert payloads on your own HTTPS endpoint.
              Set up in three curl commands. Whale tier only —{' '}
              <Link href="/pricing" className="text-emerald-300 hover:underline">see /pricing</Link>{' '}
              (free during launch).
            </>
          }
        />

        {/* Whale-tier callout */}
        <section className="rounded-xl border border-amber-400/30 bg-amber-500/[0.04] px-4 py-3 mb-6 flex items-start gap-3">
          <Crown className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden />
          <div className="text-[12px] text-amber-200 leading-relaxed">
            <span className="font-semibold text-amber-300">Whale tier required.</span>{' '}
            Webhook endpoints return 403 for Free / Trader / Pro accounts.
            During launch, every paid-tier feature (Trader, Pro, Whale) is unlocked
            for every signed-in user — so you can test webhooks now. After launch,
            you&apos;ll need an active Whale subscription.
          </div>
        </section>

        {/* ─── Step 1 ──────────────────────────────────────────── */}
        <Section number={1} title="Register your webhook URL">
          <p className="text-[13px] text-neutral-300 leading-relaxed mb-3">
            Send a <Code>PUT /api/account/webhook</Code> with your HTTPS endpoint.
            You&apos;ll get back a secret used for signature verification — <strong className="text-amber-300">save it now, it won&apos;t be shown again.</strong>
          </p>
          <CodeBlock lang="bash">{`curl -X PUT https://info-hub.io/api/account/webhook \\
  -H "Cookie: $YOUR_SESSION_COOKIE" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://my-bot.example.com/infohub-webhook"}'`}</CodeBlock>
          <p className="text-[12px] text-neutral-500 mt-2">Response:</p>
          <CodeBlock lang="json">{`{
  "url": "https://my-bot.example.com/infohub-webhook",
  "secret": "8f3a9d2b...64-char-hex-string...e1c7",
  "createdAt": "2026-05-20T13:42:11.000Z",
  "warning": "Save this secret now — it will not be shown again."
}`}</CodeBlock>
          <Callout>
            <strong className="text-emerald-300">URL restrictions:</strong> must be HTTPS,
            cannot be localhost, private network ranges (10.x, 172.16-31.x, 192.168.x), or
            cloud metadata hosts (169.254.169.254). SSRF defense.
          </Callout>
        </Section>

        {/* ─── Step 2 ──────────────────────────────────────────── */}
        <Section number={2} title="Send a test ping">
          <p className="text-[13px] text-neutral-300 leading-relaxed mb-3">
            Fire a synthetic <Code>alert.test</Code> event to verify your receiver accepts the payload and signature:
          </p>
          <CodeBlock lang="bash">{`curl -X POST https://info-hub.io/api/account/webhook/test \\
  -H "Cookie: $YOUR_SESSION_COOKIE"`}</CodeBlock>
          <p className="text-[12px] text-neutral-500 mt-2">
            Returns <Code>{'{ ok: true, message: "Test webhook delivered." }'}</Code> if your endpoint replied 2xx.
            Otherwise check the message + your server logs.
          </p>
        </Section>

        {/* ─── Step 3 ──────────────────────────────────────────── */}
        <Section number={3} title='Enable "webhook" on your alerts'>
          <p className="text-[13px] text-neutral-300 leading-relaxed mb-3">
            Add <Code>&quot;webhook&quot;</Code> to the <Code>channels</Code> array when creating or updating an alert rule:
          </p>
          <CodeBlock lang="bash">{`curl -X POST https://info-hub.io/api/account/alerts \\
  -H "Cookie: $YOUR_SESSION_COOKIE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "kind": "funding_flip",
    "enabled": true,
    "channels": ["telegram", "webhook"],
    "cooldownMin": 60
  }'`}</CodeBlock>
          <Callout>
            You can combine <Code>webhook</Code> with other channels (telegram, email,
            browser_push). Each delivers independently with its own cooldown.
          </Callout>
        </Section>

        {/* ─── Payload format ──────────────────────────────────── */}
        <Section number={4} title="Payload format">
          <p className="text-[13px] text-neutral-300 leading-relaxed mb-3">
            Every webhook delivery is a <Code>POST</Code> with{' '}
            <Code>Content-Type: application/json</Code> and an HMAC signature header.
          </p>
          <CodeBlock lang="http">{`POST /infohub-webhook HTTP/1.1
Host: my-bot.example.com
Content-Type: application/json
X-InfoHub-Signature: 4a72f0b8c2d...hex-sha256...e1
X-InfoHub-Event: alert.triggered
User-Agent: InfoHub-Webhook/1.0 (+https://info-hub.io)

{
  "timestamp": "2026-05-20T13:45:00.000Z",
  "version": "v1",
  "event": "alert.triggered",
  "alerts": [
    {
      "alertId": "abc-123",
      "symbol": "BTC",
      "metric": "fundingRate",
      "operator": "gt",
      "threshold": 0.0001,
      "actualValue": 0.00018,
      "exchange": "Binance"
    }
  ]
}`}</CodeBlock>
        </Section>

        {/* ─── HMAC verification ───────────────────────────────── */}
        <Section number={5} title="Verify the signature">
          <p className="text-[13px] text-neutral-300 leading-relaxed mb-3">
            Compute <Code>HMAC-SHA256(secret, raw_body)</Code> and compare to{' '}
            <Code>X-InfoHub-Signature</Code>. Use a constant-time comparison to
            avoid timing attacks. Same scheme as Stripe / GitHub webhooks.
          </p>

          <h3 className="text-[12px] uppercase tracking-wider text-neutral-500 font-bold mt-4 mb-2">Node.js (Express)</h3>
          <CodeBlock lang="js">{`import { createHmac, timingSafeEqual } from 'crypto';
import express from 'express';

const app = express();
const SECRET = process.env.INFOHUB_WEBHOOK_SECRET;

// IMPORTANT: read raw body — JSON.parse before signature check changes the bytes
app.post('/infohub-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.header('X-InfoHub-Signature') || '';
  const expected = createHmac('sha256', SECRET).update(req.body).digest('hex');

  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  const payload = JSON.parse(req.body.toString('utf8'));
  console.log('verified webhook:', payload.event, payload.alerts.length, 'alerts');
  res.status(200).json({ ok: true });
});

app.listen(3000);`}</CodeBlock>

          <h3 className="text-[12px] uppercase tracking-wider text-neutral-500 font-bold mt-4 mb-2">Python (Flask)</h3>
          <CodeBlock lang="python">{`import hmac
import hashlib
import os
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ['INFOHUB_WEBHOOK_SECRET'].encode()

@app.route('/infohub-webhook', methods=['POST'])
def webhook():
    sig = request.headers.get('X-InfoHub-Signature', '')
    expected = hmac.new(SECRET, request.data, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        abort(401)

    payload = request.get_json()
    print(f"verified webhook: {payload['event']} {len(payload['alerts'])} alerts")
    return {'ok': True}, 200

if __name__ == '__main__':
    app.run(port=3000)`}</CodeBlock>
        </Section>

        {/* ─── Other endpoints ─────────────────────────────────── */}
        <Section number={6} title="Manage your webhook">
          <div className="space-y-3 text-[13px] text-neutral-300">
            <div>
              <Code>GET /api/account/webhook</Code> — read current URL.{' '}
              <span className="text-neutral-500">Secret is never re-exposed after creation.</span>
            </div>
            <div>
              <Code>PUT /api/account/webhook</Code> — change URL + rotate secret.{' '}
              <span className="text-neutral-500">Previous secret becomes invalid immediately.</span>
            </div>
            <div>
              <Code>DELETE /api/account/webhook</Code> — clear config.{' '}
              <span className="text-neutral-500">Not tier-gated — downgrade-friendly.</span>
            </div>
            <div>
              <Code>POST /api/account/webhook/test</Code> — fire a synthetic{' '}
              <Code>alert.test</Code> event to your registered URL.
            </div>
          </div>
        </Section>

        {/* ─── Behaviour + retries ─────────────────────────────── */}
        <Section number={7} title="Delivery behaviour">
          <ul className="text-[13px] text-neutral-300 space-y-2 list-disc list-inside marker:text-emerald-400/40">
            <li>10-second request timeout per delivery.</li>
            <li>Receiver must return <Code>2xx</Code> to be considered successful.</li>
            <li>
              No automatic retry today — if your endpoint is down, you miss that batch.
              Same per-channel cooldown as Discord/email (5-1440 min).
            </li>
            <li>
              Multiple alerts firing together arrive in a single POST as{' '}
              <Code>alerts[]</Code> — process them as a batch.
            </li>
            <li>
              <Code>X-InfoHub-Event</Code> header tells you the event kind without parsing
              the body — useful for routing <Code>alert.test</Code> vs{' '}
              <Code>alert.triggered</Code> differently.
            </li>
          </ul>
        </Section>

        {/* ─── Footer CTAs ─────────────────────────────────────── */}
        <section className="mt-10 pb-12 flex flex-wrap items-center gap-3 text-[12px]">
          <Link href="/developers/docs" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
            Full API reference <ArrowRight className="w-3 h-3" />
          </Link>
          <span className="text-neutral-700">·</span>
          <Link href="/pricing" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
            Pricing tiers <ArrowRight className="w-3 h-3" />
          </Link>
          <span className="text-neutral-700">·</span>
          <a
            href="https://t.me/info_hub69"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
          >
            Questions on Telegram <ArrowRight className="w-3 h-3" />
          </a>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-bold border border-emerald-400/30">
          {number}
        </span>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      <div className="pl-8">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-[12px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-emerald-300">
      {children}
    </code>
  );
}

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };
  return (
    <div className="relative rounded-lg border border-white/[0.08] bg-black/40 overflow-hidden mt-2">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{lang}</span>
        <button
          type="button"
          onClick={copy}
          className="text-[10px] text-neutral-500 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-[12px] text-neutral-200 px-4 py-3 overflow-x-auto leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-neutral-400 leading-relaxed">
      {children}
    </div>
  );
}
