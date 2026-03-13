'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface ApiKeyInfo {
  id: string;
  prefix: string;
  name: string;
  tier: string;
  lastUsedAt: string | null;
  requestsToday: number;
  createdAt: string;
}

export default function DevelopersPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/keys');
      const json = await res.json();
      if (json.success) setKeys(json.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (session?.user) fetchKeys();
  }, [session, fetchKeys]);

  const createKey = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName || 'Default' }),
      });
      const json = await res.json();
      if (json.success) {
        setNewKey(json.data.key);
        setKeyName('');
        fetchKeys();
      } else {
        setError(json.error || 'Failed to create key');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await fetch(`/api/v1/keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch {}
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">
          <span className="text-white">Developer</span>{' '}
          <span className="text-amber-400">API</span>
        </h1>
        <p className="text-gray-400 mb-8">
          Access real-time funding rates, arbitrage opportunities, and open interest data across 30 exchanges.
        </p>

        {/* Not signed in */}
        {!session?.user && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-300 mb-4">Sign in to generate your API key</p>
            <Link
              href="/auth/signin"
              className="inline-block bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Signed in */}
        {session?.user && (
          <>
            {/* New key banner */}
            {newKey && (
              <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-6">
                <p className="text-green-400 font-semibold mb-2">API Key Created — Save it now!</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black/50 text-green-300 px-3 py-2 rounded font-mono text-sm break-all">
                    {newKey}
                  </code>
                  <button
                    onClick={copyKey}
                    className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-green-500/70 text-xs mt-2">This key will not be shown again.</p>
                <button onClick={() => setNewKey(null)} className="text-green-500/50 text-xs mt-1 hover:text-green-400">
                  Dismiss
                </button>
              </div>
            )}

            {/* Create key */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Create API Key</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Key name (optional)"
                  value={keyName}
                  onChange={e => setKeyName(e.target.value)}
                  className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm"
                  maxLength={50}
                />
                <button
                  onClick={createKey}
                  disabled={loading}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
                >
                  {loading ? 'Creating...' : 'Generate Key'}
                </button>
              </div>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            {/* Existing keys */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Your API Keys</h2>
              {keys.length === 0 ? (
                <p className="text-gray-500 text-sm">No API keys yet. Create one above.</p>
              ) : (
                <div className="space-y-3">
                  {keys.map(k => (
                    <div key={k.id} className="flex items-center justify-between bg-black/50 rounded-lg px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-amber-400 font-mono text-sm">{k.prefix}...</code>
                          <span className="text-gray-400 text-sm">{k.name}</span>
                          <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded">
                            {k.tier}
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          {k.lastUsedAt ? `Last used: ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'Never used'}
                          {' · '}{k.requestsToday} requests today
                          {' · '}Created {new Date(k.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="text-red-400 hover:text-red-300 text-sm font-medium"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick start */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">curl</h3>
                  <pre className="bg-black/50 rounded-lg p-3 text-sm text-green-400 font-mono overflow-x-auto">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://infohub.trade/api/v1/arbitrage?minSpread=0.05&grade=A,B"`}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Python</h3>
                  <pre className="bg-black/50 rounded-lg p-3 text-sm text-green-400 font-mono overflow-x-auto">
{`import requests

headers = {"Authorization": "Bearer YOUR_API_KEY"}
r = requests.get("https://infohub.trade/api/v1/arbitrage", headers=headers)
arbs = r.json()["data"]

for a in arbs:
    print(f"{a['symbol']}: {a['grade']} | "
          f"short {a['shortExchange']} long {a['longExchange']} | "
          f"net {a['netSpread8h']}%")`}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">JavaScript</h3>
                  <pre className="bg-black/50 rounded-lg p-3 text-sm text-green-400 font-mono overflow-x-auto">
{`const res = await fetch("https://infohub.trade/api/v1/funding?symbols=BTC,ETH", {
  headers: { Authorization: "Bearer YOUR_API_KEY" }
});
const { data } = await res.json();
console.log(data);`}
                  </pre>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Endpoints reference */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Endpoints</h2>
            <Link href="/developers/docs" className="text-amber-400 hover:text-amber-300 text-sm">
              Full Documentation →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Method</th>
                  <th className="text-left py-2 pr-4">Endpoint</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {[
                  ['GET', '/api/v1/funding', 'Real-time funding rates (30 exchanges)'],
                  ['GET', '/api/v1/funding/history', 'Historical funding snapshots (7d)'],
                  ['GET', '/api/v1/arbitrage', 'Arb opportunities with grades'],
                  ['GET', '/api/v1/openinterest', 'Open interest across exchanges'],
                  ['GET', '/api/v1/exchanges', 'Exchange metadata + fees'],
                  ['GET', '/api/v1/status', 'API health (no auth)'],
                ].map(([method, path, desc]) => (
                  <tr key={path} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4">
                      <span className="text-green-400 font-mono text-xs">{method}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <code className="text-amber-400 font-mono text-xs">{path}</code>
                    </td>
                    <td className="py-2 text-gray-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rate limits */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Rate Limits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-black/50 rounded-lg p-4">
              <div className="text-amber-400 font-semibold mb-1">Free Tier</div>
              <div className="text-gray-400 text-sm space-y-1">
                <p>100 requests / minute</p>
                <p>5,000 requests / day</p>
                <p>All endpoints included</p>
              </div>
            </div>
            <div className="bg-black/50 rounded-lg p-4 border border-amber-500/20">
              <div className="text-amber-400 font-semibold mb-1">Pro Tier <span className="text-xs text-gray-500">(coming soon)</span></div>
              <div className="text-gray-400 text-sm space-y-1">
                <p>500 requests / minute</p>
                <p>Unlimited daily</p>
                <p>Priority support</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
