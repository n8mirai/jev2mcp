import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { catalog } from '../src/catalog.mjs';
const token = await readFile(new URL('../.local/bridge-token', import.meta.url), 'utf8');
const cases = [
  {
    name: 'plain explanation',
    prompt: 'Explain why the sky is blue in one sentence.',
    expected: [],
  },
  {
    name: 'Drive lookup',
    prompt: 'Find the latest project brief in my Google Drive and summarize it.',
    expected: ['google-drive'],
  },
  {
    name: 'mail plus calendar',
    prompt: 'Find the meeting time in my latest email and check whether my calendar is free then.',
    expected: ['gmail', 'google-calendar'],
  },
  {
    name: 'product mention only',
    prompt: 'Explain what Gmail is. Do not access my account.',
    expected: [],
  },
  {
    name: 'text supplied',
    prompt: 'Summarize this email: The picnic is Saturday at noon. Bring sandwiches.',
    expected: [],
  },
  {
    name: 'uninstalled tool',
    allowReview: true,
    prompt: 'Summarize my Slack messages from today.',
    expected: [],
  },
  {
    name: 'context follow-up',
    prompt: 'Find that document for me.',
    context: 'User: I saved the launch brief in Google Drive.',
    expected: ['google-drive'],
  },
  {
    name: 'inventory lookup',
    prompt: 'What ingredients do I have in my pantry?',
    expected: ['pantry'],
  },
  {
    name: 'messy pantry restock and cart',
    prompt:
      'Okay, this is scattered: I need breakfasts for next week, probably egg sandwiches and coffee, but do not make me buy things already in the kitchen. I also thought we were out of rice and canned tomatoes, though I may be wrong. Check the recorded pantry first, then put only the missing breakfast basics plus any genuinely low staples in a grocery cart for me to review. Do not check out.',
    expected: ['pantry', 'instacart'],
  },
  {
    name: 'cart without inventory lookup',
    prompt: 'Put two cartons of oat milk in an Instacart cart for me to review.',
    expected: ['instacart'],
  },
];
const results = [];
for (const c of cases) {
  const response = await fetch('http://127.0.0.1:4328/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Jev-Token': token },
    body: JSON.stringify({
      prompt: c.prompt,
      context: c.context,
      plugins: catalog,
      surface: 'live-evaluation',
    }),
  });
  const result = await response.json();
  const actual = result.selected?.map((p) => p.id).sort();
  const passed =
    response.ok &&
    (result.status !== 'review' || c.allowReview) &&
    JSON.stringify(actual) === JSON.stringify([...c.expected].sort());
  results.push({ ...c, passed, result });
  console.log(
    `${passed ? 'PASS' : 'FAIL'} ${c.name}: ${result.status} ${JSON.stringify(actual)} (${result.elapsedMs} ms)`,
  );
}
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/live-evaluation.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      note: 'Synthetic prompts. Small smoke evaluation, not a general accuracy claim.',
      results,
    },
    null,
    2,
  ),
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
