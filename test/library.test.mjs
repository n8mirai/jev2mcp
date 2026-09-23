import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  loadLibrary,
  saveLibrary,
  importCatalog,
  serializeCatalog,
  enabledTools,
} from '../public/library.js';

const custom = {
  id: 'personal-tasks',
  name: 'My task tracker',
  mention: 'R&D / Tasks (personal)',
  description: 'Read my open tasks and update project deadlines.',
  kind: 'mcp',
  enabled: true,
};
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    snapshot: () => Object.fromEntries(data),
  };
}

test('a new library starts empty without writing or adopting sample tools', () => {
  const state = storage();
  assert.deepEqual(loadLibrary(state), { tools: [], notice: '' });
  assert.deepEqual(state.snapshot(), {});
});

test('both legacy storage formats preserve custom tools and explicit disabled choices', () => {
  for (const key of ['jev2mcp-tools', 'jev-plugins']) {
    const tools = [custom, { ...custom, id: 'other', mention: 'Other service', enabled: false }];
    const raw = JSON.stringify(tools);
    const state = storage({ [key]: raw });
    const migrated = loadLibrary(state);
    assert.deepEqual(migrated.tools, tools);
    assert.match(migrated.notice, /existing tools were kept/i);
    assert.equal(state.getItem(key), raw);
    assert.deepEqual(loadLibrary(state).tools, tools);
    assert.deepEqual(enabledTools(migrated.tools), [(({ enabled, ...tool }) => tool)(custom)]);
  }
});

test('an intentionally empty current library overrides legacy entries after removal', () => {
  const state = storage({
    'jev2mcp-tools': JSON.stringify([custom]),
    [STORAGE_KEY]: serializeCatalog([]),
  });
  assert.deepEqual(loadLibrary(state).tools, []);
  saveLibrary(state, [custom]);
  saveLibrary(state, []);
  assert.deepEqual(loadLibrary(state).tools, []);
  assert.equal(state.getItem('jev2mcp-tools'), JSON.stringify([custom]));
});

test('corrupt saved data is retained on read and backed up before a deliberate replacement', () => {
  const broken = '{ unfinished catalog';
  const state = storage({ [STORAGE_KEY]: broken });
  const loaded = loadLibrary(state);
  assert.deepEqual(loaded.tools, []);
  assert.match(loaded.notice, /original data is kept/i);
  assert.deepEqual(state.snapshot(), { [STORAGE_KEY]: broken });
  saveLibrary(state, [custom]);
  assert.equal(state.getItem('jev2mcp-catalog-recovery'), broken);
  assert.deepEqual(loadLibrary(state).tools, [custom]);
});

test('invalid legacy records are kept without creating a misleading new catalog', () => {
  const broken = JSON.stringify([{ description: 'Missing identity' }]);
  const state = storage({ 'jev2mcp-tools': broken });
  assert.deepEqual(loadLibrary(state).tools, []);
  assert.equal(state.getItem('jev2mcp-tools'), broken);
  assert.equal(state.getItem(STORAGE_KEY), null);
});

test('import disables every tool and export contains only versioned tool metadata', () => {
  const imported = importCatalog(
    JSON.stringify({
      version: 1,
      token: 'pairing-token',
      apiKey: 'api-key',
      tools: [{ ...custom, endpoint: 'https://private.example', credential: 'tool-secret' }],
    }),
  );
  assert.deepEqual(imported, [{ ...custom, enabled: false }]);
  const exported = JSON.parse(serializeCatalog(imported));
  assert.deepEqual(exported, { version: 1, tools: [{ ...custom, enabled: false }] });
  assert.equal(
    /pairing-token|api-key|tool-secret|private\.example/.test(JSON.stringify(exported)),
    false,
  );
});

test('unconfirmed availability is disabled and invalid imports fail atomically', () => {
  const { enabled, ...unconfirmed } = custom;
  assert.deepEqual(importCatalog(JSON.stringify({ version: 1, tools: [unconfirmed] })), [
    { ...custom, enabled: false },
  ]);
  const state = storage({ [STORAGE_KEY]: serializeCatalog([custom]) });
  const before = state.snapshot();
  assert.throws(() =>
    saveLibrary(state, importCatalog(JSON.stringify({ version: 1, tools: [custom, custom] }))),
  );
  assert.deepEqual(state.snapshot(), before);
});
