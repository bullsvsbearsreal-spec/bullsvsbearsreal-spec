import { createServer } from 'http';

const PORT = process.env.HEALTH_PORT || 3001;

let lastResult = null;
let lastRunAt = null;
let totalRuns = 0;

export function updateHealth(result) {
  lastResult = result;
  lastRunAt = new Date().toISOString();
  totalRuns++;
}

export function startHealthServer() {
  const server = createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const uptime = process.uptime();
      const body = JSON.stringify({
        ok: true,
        lastRunAt,
        totalRuns,
        lastResult,
        uptimeSeconds: Math.round(uptime),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[infohub-collector] Health server on 127.0.0.1:${PORT}`);
  });
}
