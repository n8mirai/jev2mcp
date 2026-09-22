import { request } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
// Exercise the actual server with no paid request: the no-candidate branch is deterministic.
// Use an existing bridge if present; otherwise own the process for this test.
test('loopback bridge enforces authentication, origin, host and input bounds', async () => {
  let child;
  try {
    let online = false;
    try {
      online = (await fetch('http://127.0.0.1:4328/api/health')).ok;
    } catch {}
    if (!online) {
      child = spawn(process.execPath, ['src/server.mjs'], {
        env: { ...process.env, TYPESAFE_API_KEY: '' },
        stdio: 'ignore',
      });
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 25));
        try {
          if ((await fetch('http://127.0.0.1:4328/api/health')).ok) break;
        } catch {}
      }
    }
    const url = 'http://127.0.0.1:4328/api/route';
    const body = JSON.stringify({ prompt: 'hello', plugins: [] });
    const token = await readFile('.local/bridge-token', 'utf8');
    assert.equal(
      (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))
        .status,
      401,
    );
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Jev-Token': token,
            Origin: 'https://evil.example',
          },
          body,
        })
      ).status,
      403,
    );
    const badHost = await new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'POST',
          headers: {
            Host: 'evil.example',
            'Content-Type': 'application/json',
            'X-Jev-Token': token,
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.end(body);
    });
    assert.equal(badHost, 403);
    assert.equal(
      (
        await fetch('http://127.0.0.1:4328/api/session', {
          headers: { Origin: 'chrome-extension://' + 'a'.repeat(32) },
        })
      ).status,
      403,
    );
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jev-Token': token },
      body,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).output, 'hello');
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Jev-Token': token },
          body: 'a'.repeat(50001),
        })
      ).status,
      413,
    );
  } finally {
    child?.kill();
  }
});
