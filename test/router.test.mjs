import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, buildQuestions, compose, route, fingerprint } from '../src/router.mjs';
// Synthetic test candidates. They make no claim about tools connected in a real account.
const catalog = [
  { id: 'gmail', name: 'Gmail', mention: 'Gmail', description: 'Read actual email threads.' },
  {
    id: 'google-drive',
    name: 'Google Drive',
    mention: 'Google Drive',
    description: 'Read and edit connected files.',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    mention: 'Google Calendar',
    description: 'Read actual calendar events.',
  },
];
const input = { prompt: 'Find the brief.', context: 'In Drive', plugins: catalog, surface: 'test' };
const response = (need, values = {}) => ({
  model: 'test',
  answers: {
    needs_tools: { type: 'noul', noul: need },
    ...Object.fromEntries(catalog.map((p) => [p.id, { type: 'noul', noul: values[p.id] ?? 0.01 }])),
  },
  usage: { input_tokens: 100, output_tokens: 20 },
});
test('no-tools keeps original byte-for-byte', () => {
  const r = compose(input, response(0.01), 1);
  assert.equal(r.output, input.prompt);
  assert.equal(r.status, 'unchanged');
});
test('several independent plugin matches are injected', () => {
  const r = compose(input, response(0.99, { gmail: 0.96, 'google-calendar': 0.94 }), 1);
  assert.equal(r.output, '@Gmail @Google Calendar\n\nFind the brief.');
});
test('uncertainty holds instead of guessing or silently sending', () => {
  assert.equal(compose(input, response(0.6, { gmail: 0.96 }), 1).status, 'review');
  assert.equal(
    compose(input, response(0.99, { gmail: 0.96, 'google-calendar': 0.5 }), 1).status,
    'review',
  );
});
test('positive overall judgment without a plugin holds', () =>
  assert.equal(compose(input, response(0.99), 1).status, 'review'));
test('does not duplicate existing mention', () => {
  const r = compose({ ...input, prompt: '@Gmail Find it.' }, response(0.99, { gmail: 0.99 }), 1);
  assert.equal(r.output, '@Gmail Find it.');
});
test('malformed or missing probability fails closed', () => {
  const r = response(0.99);
  r.answers.gmail.noul = NaN;
  assert.throws(() => compose(input, r, 1));
  delete r.answers.gmail;
  assert.throws(() => compose(input, r, 1));
});
test('only supplied candidates generate questions', () =>
  assert.deepEqual(Object.keys(buildQuestions([catalog[0]])), ['needs_tools', 'gmail']));
test('rejects duplicate catalog IDs and overlarge prompt', () => {
  assert.throws(() => validateInput({ ...input, plugins: [catalog[0], catalog[0]] }));
  assert.throws(() => validateInput({ ...input, prompt: 'a'.repeat(12001) }));
});
test('fingerprint includes context, catalog and surface', () => {
  assert.notEqual(fingerprint(input), fingerprint({ ...input, context: 'Other' }));
  assert.notEqual(fingerprint(input), fingerprint({ ...input, plugins: [] }));
});
test('no plugins needs no credential or network', async () => {
  const r = await route({ ...input, plugins: [] }, { key: null, fetcher: () => assert.fail() });
  assert.equal(r.status, 'unchanged');
  assert.equal(r.output, input.prompt);
  assert.deepEqual(r.selected, []);
  assert.equal(r.live, false);
});
test('custom tool names with punctuation and emoji are routed and not duplicated', () => {
  const tool = {
    id: 'custom-home',
    name: 'Garden / Home (🌱)',
    mention: 'Garden / Home (🌱)',
    description: 'Read sensor measurements from the user’s greenhouse.',
  };
  const customInput = validateInput({ ...input, plugins: [tool] });
  const judgment = {
    model: 'test',
    answers: {
      needs_tools: { type: 'noul', noul: 0.99 },
      'custom-home': { type: 'noul', noul: 0.99 },
    },
  };
  assert.deepEqual(Object.keys(buildQuestions(customInput.plugins)), [
    'needs_tools',
    'custom-home',
  ]);
  assert.equal(compose(customInput, judgment, 1).output, '@Garden / Home (🌱)\n\nFind the brief.');
  const mentionedInput = { ...customInput, prompt: '@Garden / Home (🌱) Check the humidity.' };
  assert.equal(compose(mentionedInput, judgment, 1).output, mentionedInput.prompt);
});
test('metadata must be present and text rather than string-coerced values', () => {
  for (const field of ['id', 'name', 'mention', 'description']) {
    for (const value of [undefined, null, 123, true, {}, ['text']]) {
      assert.throws(
        () => validateInput({ ...input, plugins: [{ ...catalog[0], [field]: value }] }),
        `${field} must reject ${JSON.stringify(value)}`,
      );
    }
  }
});
test('empty and whitespace-only tool descriptions are rejected', () => {
  for (const description of ['', '   ', '\n\t']) {
    assert.throws(() => validateInput({ ...input, plugins: [{ ...catalog[0], description }] }));
  }
});
test('duplicate mentions are rejected after normalization', () => {
  assert.throws(() =>
    validateInput({
      ...input,
      plugins: [catalog[1], { ...catalog[1], id: 'other-drive', mention: 'GOOGLE  DRIVE' }],
    }),
  );
});
test('disabled candidates are excluded from requests and cannot be selected', async () => {
  const plugins = [
    { ...catalog[0], enabled: false },
    { ...catalog[1], enabled: true },
  ];
  assert.deepEqual(
    validateInput({ ...input, plugins }).plugins.map((p) => p.id),
    ['google-drive'],
  );
  const result = await route(
    { ...input, plugins },
    {
      key: 'test-only',
      fetcher: async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.deepEqual(
          body.state.plugins.map((p) => p.id),
          ['google-drive'],
        );
        assert.deepEqual(Object.keys(body.questions), ['needs_tools', 'google-drive']);
        return {
          ok: true,
          json: async () => response(0.99, { gmail: 0.99, 'google-drive': 0.99 }),
        };
      },
    },
  );
  assert.deepEqual(
    result.selected.map((p) => p.id),
    ['google-drive'],
  );
});
test('all-disabled catalog needs no credential or network', async () => {
  const result = await route(
    { ...input, plugins: catalog.map((p) => ({ ...p, enabled: false })) },
    { key: null, fetcher: () => assert.fail('Disabled tools must not trigger a request.') },
  );
  assert.equal(result.status, 'unchanged');
  assert.equal(result.live, false);
  assert.deepEqual(result.selected, []);
});
test('missing API key explains portable configuration without a platform-specific launcher', async () => {
  await assert.rejects(
    route(input, { key: null, fetcher: () => assert.fail('No key must not trigger a request.') }),
    (error) =>
      /TYPESAFE_API_KEY/.test(error.message) && !/Keychain|macOS|Windows/.test(error.message),
  );
});
test('service error keeps error body and credentials out of response', async () => {
  await assert.rejects(
    route(input, { key: 'unit-test-secret', fetcher: async () => ({ ok: false, status: 503 }) }),
    /HTTP 503/,
  );
});
test('HTTP integration uses documented typed schema', async () => {
  const r = await route(input, {
    key: 'test-only',
    fetcher: async (url, options) => {
      assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'jev-latest');
      assert.equal(payload.questions.needs_tools.type, 'noul');
      return { ok: true, json: async () => response(0.99, { 'google-drive': 0.99 }) };
    },
  });
  assert.equal(r.selected[0].id, 'google-drive');
});
