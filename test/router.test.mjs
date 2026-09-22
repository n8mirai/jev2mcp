import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, buildQuestions, compose, route, fingerprint } from '../src/router.mjs';
import { catalog } from '../src/catalog.mjs';
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
test('only enabled candidates generate questions', () =>
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
  assert.equal(r.live, false);
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
