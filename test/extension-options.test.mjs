import test from 'node:test';
import assert from 'node:assert/strict';
import { pairExtension } from '../extension/options.js';

const tool = {
  id: 'my-tasks',
  name: 'My tasks',
  mention: 'R&D / Tasks (personal)',
  description: 'Read my actual tasks and project deadlines.',
  kind: 'mcp',
};
const token = 'a'.repeat(48);

test('pairing validates the complete catalog before writing extension settings', async () => {
  const invalid = [
    'not json',
    JSON.stringify({ token: 'invalid', plugins: [tool] }),
    JSON.stringify({ token, plugins: [{ description: 'Missing identity' }] }),
    JSON.stringify({ token, plugins: [tool, { ...tool, id: 'different-id' }] }),
    JSON.stringify({
      token,
      plugins: Array.from({ length: 25 }, (_, i) => ({
        ...tool,
        id: `tool-${i}`,
        mention: `Tool ${i}`,
      })),
    }),
  ];
  for (const raw of invalid) {
    let writes = 0;
    await assert.rejects(
      pairExtension(raw, {
        set: async () => {
          writes++;
        },
      }),
    );
    assert.equal(writes, 0);
  }
});

test('an empty or fully disabled pairing snapshot clears previously configured extension tools', async () => {
  for (const plugins of [[], [{ ...tool, enabled: false }]]) {
    const stored = { token: 'b'.repeat(48), enabled: true, plugins: [tool] };
    const count = await pairExtension(JSON.stringify({ token, plugins }), {
      set: async (value) => Object.assign(stored, value),
    });
    assert.equal(count, 0);
    assert.deepEqual(stored, { token, enabled: true, plugins: [] });
  }
});

test('pairing keeps only enabled normalized records and preserves the exact picker name', async () => {
  let stored;
  const count = await pairExtension(
    JSON.stringify({
      token,
      plugins: [
        { ...tool, enabled: true, unexpected: 'discard this field' },
        { ...tool, id: 'off', mention: 'Other task app', enabled: false },
      ],
    }),
    {
      set: async (value) => {
        stored = value;
      },
    },
  );
  assert.equal(count, 1);
  assert.deepEqual(stored, { token, enabled: true, plugins: [tool] });
});
