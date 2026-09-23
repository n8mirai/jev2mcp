import { request } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridge } from '../src/server.mjs';

// Own an ephemeral bridge. Never reuse the user's running bridge or pairing-token file.
// Empty candidate requests exercise routing without a paid service request.
test('isolated loopback bridge exposes an empty library and enforces access gates', async (t) => {
  const { server, token } = createBridge({ port: 0 });
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/api/route`;
  const body = JSON.stringify({ prompt: 'hello', plugins: [] });
  const headers = { 'Content-Type': 'application/json', 'X-Jev-Token': token };
  const extensionOrigin = 'chrome-extension://' + 'a'.repeat(32);

  await t.test(
    'production session starts empty while fixture is explicitly synthetic',
    async () => {
      const sessionResponse = await fetch(`${origin}/api/session`, { headers: { Origin: origin } });
      assert.equal(sessionResponse.status, 200);
      const session = await sessionResponse.json();
      assert.equal(session.token, token);
      assert.deepEqual(session.catalog, []);
      const fixtureResponse = await fetch(`${origin}/api/fixture-session`);
      assert.equal(fixtureResponse.status, 200);
      const fixture = await fixtureResponse.json();
      assert.equal(fixture.token, token);
      assert.equal(fixture.fixture, true);
      assert.deepEqual(
        fixture.catalog.map((tool) => tool.id),
        ['gmail', 'google-drive', 'google-calendar'],
      );
      assert.ok(fixture.catalog.every((tool) => !Object.hasOwn(tool, 'enabled')));
    },
  );

  await t.test('library modules and disabled example catalogs are reachable', async () => {
    const library = await fetch(`${origin}/library.js`);
    assert.equal(library.status, 200);
    assert.match(library.headers.get('content-type'), /javascript/);
    for (const pathname of ['/catalog.js', '/extension/catalog.js']) {
      const module = await fetch(origin + pathname);
      assert.equal(module.status, 200);
      assert.match(await module.text(), /export function validateCatalog/);
    }
    for (const name of ['common-tools', 'pantry-demo']) {
      const example = await fetch(`${origin}/examples/${name}.json`);
      assert.equal(example.status, 200);
      const catalog = await example.json();
      assert.equal(catalog.version, 1);
      assert.ok(catalog.tools.length > 0);
      assert.ok(catalog.tools.every((tool) => tool.enabled === false));
      if (name === 'pantry-demo') assert.match(catalog.description, /custom MCP, not included/);
    }
  });

  await t.test('routing requires the correct pairing token and JSON content', async () => {
    assert.equal(
      (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))
        .status,
      401,
    );
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...headers, 'X-Jev-Token': 'wrong-token' },
          body,
        })
      ).status,
      401,
    );
    assert.equal(
      (await fetch(url, { method: 'POST', headers: { 'X-Jev-Token': token }, body })).status,
      415,
    );
    const response = await fetch(url, { method: 'POST', headers, body });
    assert.equal(response.status, 200);
    const routed = await response.json();
    assert.equal(routed.output, 'hello');
    assert.equal(routed.live, false);
  });

  await t.test('foreign origins and forged hosts are rejected', async () => {
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://evil.example' },
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
          headers: { ...headers, Host: 'evil.example' },
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
    const allowed = await fetch(url, {
      method: 'POST',
      headers: { ...headers, Origin: origin },
      body,
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
  });

  await t.test('extensions can route after pairing but cannot read either session', async () => {
    for (const pathname of ['/api/session', '/api/fixture-session']) {
      assert.equal(
        (await fetch(origin + pathname, { headers: { Origin: extensionOrigin } })).status,
        403,
      );
      assert.equal(
        (await fetch(origin + pathname, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status,
        403,
      );
    }
    const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: extensionOrigin } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), extensionOrigin);
    const routed = await fetch(url, {
      method: 'POST',
      headers: { ...headers, Origin: extensionOrigin },
      body,
    });
    assert.equal(routed.status, 200);
  });

  await t.test('malformed input and oversized requests are held', async () => {
    assert.equal((await fetch(url, { method: 'POST', headers, body: '{invalid' })).status, 400);
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: 'a'.repeat(12001), plugins: [] }),
        })
      ).status,
      400,
    );
    assert.equal(
      (await fetch(url, { method: 'POST', headers, body: 'a'.repeat(50001) })).status,
      413,
    );
  });
});
