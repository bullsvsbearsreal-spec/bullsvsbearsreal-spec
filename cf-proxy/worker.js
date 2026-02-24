// Durable Object proxy in Western Europe with 60s SQLite response cache.
// All Vercel instances share this single cache — keeps requests within free tier.
const CACHE_TTL_MS = 60_000; // 60 seconds

export class ProxyDO {
  constructor(state, env) {
    this.state = state;
    this.db = state.storage.sql;
    // Create cache table on first use
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        url TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        status INTEGER NOT NULL,
        ts INTEGER NOT NULL
      )
    `);
  }

  async fetch(request) {
    const targetUrl = new URL(request.url).searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url param' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();

    // Check cache
    const cached = this.db.exec(
      'SELECT body, status, ts FROM cache WHERE url = ?',
      targetUrl
    ).toArray();

    if (cached.length > 0 && (now - cached[0].ts) < CACHE_TTL_MS) {
      return new Response(cached[0].body, {
        status: cached[0].status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT',
          'X-Cache-Age': String(Math.round((now - cached[0].ts) / 1000)),
        },
      });
    }

    // Cache miss — fetch upstream
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      const body = await res.text();

      // Only cache successful responses
      if (res.status >= 200 && res.status < 300) {
        this.db.exec(
          'INSERT OR REPLACE INTO cache (url, body, status, ts) VALUES (?, ?, ?, ?)',
          targetUrl, body, res.status, now
        );
      }

      return new Response(body, {
        status: res.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'MISS',
        },
      });
    } catch (err) {
      // On error, serve stale cache if available
      if (cached.length > 0) {
        return new Response(cached[0].body, {
          status: cached[0].status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'STALE',
          },
        });
      }
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const id = env.PROXY.idFromName('proxy-weur-v1');
    const stub = env.PROXY.get(id, { locationHint: 'weur' });
    return stub.fetch(request);
  },
};
