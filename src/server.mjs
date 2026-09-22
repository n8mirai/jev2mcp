import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { route } from './router.mjs';
import { catalog } from './catalog.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = 4328,
  origin = `http://127.0.0.1:${port}`,
  token = randomBytes(24).toString('hex');
await mkdir(path.join(root, '.local'), { recursive: true, mode: 0o700 });
await writeFile(path.join(root, '.local/bridge-token'), token, { mode: 0o600 });
let active = 0;
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};
const server = http.createServer(async (req, res) => {
  const reply = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.headers.host !== `127.0.0.1:${port}`) return reply(403, { error: 'Invalid host' });
  const from = req.headers.origin;
  const extension = /^chrome-extension:\/\/[a-p]{32}$/.test(from || '');
  if (from && from !== origin && !extension) return reply(403, { error: 'Origin denied' });
  if (from) {
    res.setHeader('Access-Control-Allow-Origin', from);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Jev-Token');
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url, origin);
  if (url.pathname === '/api/health')
    return reply(200, {
      ok: true,
      name: 'jev-plugin-router',
      keyAvailable: !!process.env.TYPESAFE_API_KEY,
    });
  if (url.pathname === '/api/session' && req.method === 'GET') {
    if (
      extension ||
      (req.headers['sec-fetch-site'] &&
        !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))
    )
      return reply(403, { error: 'Pair from the local companion.' });
    return reply(200, { token, catalog });
  }
  if (url.pathname === '/api/route' && req.method === 'POST') {
    const supplied = Buffer.from(String(req.headers['x-jev-token'] || ''));
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return reply(401, { error: 'Pair the extension with the local companion.' });
    if (!req.headers['content-type']?.startsWith('application/json'))
      return reply(415, { error: 'JSON required' });
    if (active >= 3) return reply(429, { error: 'Router busy. Prompt held.' });
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 50000) return reply(413, { error: 'Request too large' });
      }
      active++;
      try {
        return reply(200, await route(JSON.parse(body)));
      } finally {
        active--;
      }
    } catch (error) {
      return reply(400, {
        error: error.name === 'TimeoutError' ? 'Jev timed out. Prompt held.' : error.message,
      });
    }
  }
  if (req.method !== 'GET') return reply(405, { error: 'Method not allowed' });
  const paths = {
    '/': 'public/index.html',
    '/app.js': 'public/app.js',
    '/style.css': 'public/style.css',
    '/fixture': 'public/fixture.html',
    '/fixture.js': 'public/fixture.js',
    '/adapter.js': 'extension/content.js',
    '/icon.svg': 'public/icon.svg',
  };
  const file = paths[url.pathname];
  if (!file) return reply(404, { error: 'Not found' });
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
  );
  try {
    const data = await readFile(path.join(root, file));
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain' });
    res.end(data);
  } catch {
    return reply(404, { error: 'Not found' });
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(
    `Jev Router ready at ${origin} — API credential ${process.env.TYPESAFE_API_KEY ? 'available' : 'missing'}. Prompts are not logged.`,
  );
  if (process.env.JEV_OPEN === '1' && process.platform === 'darwin')
    spawn('open', [origin], { stdio: 'ignore' });
});
