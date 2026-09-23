import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import * as catalog from '../extension/catalog.js';
import * as library from '../public/library.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
// JSDOM does not execute ES modules. Bind the real imported helpers, then execute
// the unchanged application body, including its top-level asynchronous startup.
const body = source.replace(/^import\s[\s\S]*?\sfrom\s['"][^'"]+['"];?\s*/gm, '');
const tool = {
  id: 'my-tracker',
  name: 'My tracker',
  mention: 'Projects / Tasks',
  description: 'Read my actual project tasks and deadlines.',
  kind: 'mcp',
  enabled: true,
};
const response = (data) => ({ ok: true, json: async () => data });

async function setup({ saved = {}, serverCatalog = [], route } = {}) {
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:4328',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  for (const [key, value] of Object.entries(saved)) w.localStorage.setItem(key, value);
  const requests = [],
    clipboard = [],
    downloads = [];
  w.__catalog = catalog;
  w.__library = library;
  w.fetch = async (url, options) => {
    if (url === '/api/session') return response({ token: 'a'.repeat(48), catalog: serverCatalog });
    if (url === '/api/health') return response({ keyAvailable: true });
    if (url === '/api/route') {
      requests.push(JSON.parse(options.body));
      if (!route) throw new Error('Unexpected route request');
      return route(requests.at(-1));
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  Object.defineProperty(w.navigator, 'clipboard', {
    value: { writeText: async (value) => clipboard.push(value) },
  });
  w.Blob = Blob;
  w.URL.createObjectURL = (blob) => {
    downloads.push(blob);
    return 'blob:catalog-download';
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  try {
    await w.eval(`(async () => {
      const { validateCatalog, catalogIdentity } = window.__catalog;
      const { loadLibrary, saveLibrary, serializeCatalog, importCatalog, enabledTools, STORAGE_KEY } = window.__library;
      ${body}
    })()`);
  } catch (error) {
    w.close();
    throw error;
  }
  const el = (id) => w.document.getElementById(id);
  return {
    w,
    el,
    requests,
    clipboard,
    downloads,
    current: () => JSON.parse(w.localStorage.getItem(library.STORAGE_KEY)),
    submit: (id) => el(id).onsubmit(new w.Event('submit', { cancelable: true })),
    import: async (data) => {
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      Object.defineProperty(el('catalog-file'), 'files', {
        configurable: true,
        value: [{ size: text.length, text: async () => text }],
      });
      await el('catalog-file').onchange({ target: el('catalog-file') });
    },
    close: () => w.close(),
  };
}

test('fresh companion ignores the bridge sample catalog and makes no routing call without enabled tools', async () => {
  const app = await setup({ serverCatalog: [tool] });
  try {
    assert.equal(app.el('enabled-count').textContent, '0 tools');
    assert.equal(app.el('plugins').querySelectorAll('.tool-row').length, 0);
    assert.equal(app.el('onboarding').hidden, false);
    assert.equal(app.el('pair').disabled, false);
    assert.deepEqual(app.clipboard, []);
    app.el('prompt').value = 'Find my overdue tasks';
    await app.submit('prompt-form');
    assert.equal(app.requests.length, 0);
    assert.equal(app.el('library').hidden, false);
    assert.equal(app.w.localStorage.getItem(library.STORAGE_KEY), null);
  } finally {
    app.close();
  }
});

test('corrupt local data keeps its recovery path without presenting a healthy bridge as offline', async () => {
  const raw = '{ broken';
  const app = await setup({ saved: { [library.STORAGE_KEY]: raw } });
  try {
    assert.equal(app.el('connection').textContent, 'Connected');
    assert.match(app.el('library-notice').textContent, /original data is kept/i);
    assert.equal(app.w.localStorage.getItem(library.STORAGE_KEY), raw);
    app.el('plugin-name').value = 'My notes';
    app.el('plugin-mention').value = 'Notes (personal)';
    app.el('plugin-description').value = 'Read my private notes.';
    app.el('plugin-kind').value = 'mcp';
    app.el('plugin-enabled').checked = false;
    await app.submit('add-plugin');
    assert.equal(app.w.localStorage.getItem('jev2mcp-catalog-recovery'), raw);
    assert.equal(app.current().tools.length, 1);
    assert.equal(app.current().tools[0].enabled, false);
  } finally {
    app.close();
  }
});

test('edit preserves identity, updates exact picker metadata, and removal survives a reload', async () => {
  const app = await setup({
    saved: { [library.STORAGE_KEY]: library.serializeCatalog([{ ...tool, enabled: false }]) },
  });
  let persisted;
  try {
    app.el('plugins').querySelector('[data-edit]').click();
    app.el('plugin-name').value = 'Renamed tracker';
    app.el('plugin-mention').value = 'R&D / Tasks (personal)';
    app.el('plugin-description').value = 'Find and update my active development tasks.';
    app.el('plugin-enabled').checked = true;
    await app.submit('add-plugin');
    const updated = app.current().tools[0];
    assert.equal(updated.id, tool.id);
    assert.equal(updated.name, 'Renamed tracker');
    assert.equal(updated.mention, 'R&D / Tasks (personal)');
    assert.equal(updated.enabled, true);
    assert.equal(app.el('plugins').querySelectorAll('.tool-row').length, 1);
    await app.el('pair').onclick();
    const packageData = JSON.parse(app.clipboard[0]);
    const { enabled, ...metadata } = updated;
    assert.deepEqual(packageData.plugins, [metadata]);
    app.el('plugins').querySelector('[data-remove]').click();
    assert.deepEqual(app.current().tools, []);
    persisted = app.w.localStorage.getItem(library.STORAGE_KEY);
    assert.equal(app.el('pair').disabled, false);
    await app.el('pair').onclick();
    assert.deepEqual(JSON.parse(app.clipboard.at(-1)).plugins, []);
  } finally {
    app.close();
  }
  const reloaded = await setup({
    saved: { [library.STORAGE_KEY]: persisted },
    serverCatalog: [tool],
  });
  try {
    assert.equal(reloaded.el('plugins').querySelectorAll('.tool-row').length, 0);
  } finally {
    reloaded.close();
  }
});

test('import replaces the existing library disabled, rejects invalid replacement, and exports metadata only', async () => {
  const app = await setup({ saved: { [library.STORAGE_KEY]: library.serializeCatalog([tool]) } });
  try {
    const imported = {
      ...tool,
      id: 'new-mcp',
      mention: 'Different MCP',
      apiKey: 'private-key',
      enabled: true,
    };
    await app.import({ version: 1, token: 'private-pairing-token', tools: [imported] });
    assert.equal(app.current().tools.length, 1);
    assert.equal(app.current().tools[0].id, 'new-mcp');
    assert.equal(app.current().tools[0].enabled, false);
    assert.equal(app.el('pair').disabled, false);
    app.el('prompt').value = 'Find my overdue tasks';
    await app.submit('prompt-form');
    assert.equal(app.requests.length, 0);
    const before = app.w.localStorage.getItem(library.STORAGE_KEY);
    await app.import({ version: 1, tools: [imported, imported] });
    assert.equal(app.w.localStorage.getItem(library.STORAGE_KEY), before);
    assert.match(app.el('library-notice').textContent, /already in this list/i);
    app.el('export-catalog').click();
    const exported = JSON.parse(await app.downloads[0].text());
    assert.deepEqual(exported, app.current());
    assert.equal(JSON.stringify(exported).includes('private-'), false);
    assert.deepEqual(Object.keys(exported).sort(), ['tools', 'version']);
  } finally {
    app.close();
  }
});

test('a catalog change discards the pending result and prevents copying stale tool selections', async () => {
  let resolveRoute;
  const app = await setup({
    saved: { [library.STORAGE_KEY]: library.serializeCatalog([tool]) },
    route: () =>
      new Promise((resolve) => {
        resolveRoute = resolve;
      }),
  });
  try {
    app.el('prompt').value = 'Find my overdue tasks';
    const pending = app.submit('prompt-form');
    assert.equal(app.requests.length, 1);
    assert.equal(app.requests[0].plugins[0].mention, tool.mention);
    app.el('plugins').querySelector('input').click();
    resolveRoute(
      response({
        status: 'routed',
        live: true,
        elapsedMs: 1,
        selected: [{ ...tool, probability: 0.99 }],
        scores: [{ ...tool, probability: 0.99 }],
        output: '@Projects / Tasks\n\nFind my overdue tasks',
      }),
    );
    await pending;
    assert.equal(app.current().tools[0].enabled, false);
    assert.equal(app.el('decision').hidden, true);
    assert.equal(app.el('output-card').hidden, true);
    await app.el('copy').onclick();
    assert.deepEqual(app.clipboard, []);
    assert.equal(app.el('route').disabled, false);
  } finally {
    app.close();
  }
});
