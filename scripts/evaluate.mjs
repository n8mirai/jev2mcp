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
    name: 'indirect breakfast restock',
    prompt:
      'ugh 6am shifts all week. egg sandwiches would save me but do we even have eggs? bread? i swear i saw coffee somewhere and last time i came home with rice we already had. can you sort the morning situation out and tee up whatever is actually missing so i can check it before paying? pls do not place an order.',
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
