const $ = (id) => document.getElementById(id);
let session,
  tools = [],
  result,
  revision = 0;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
try {
  session = await fetch('/api/session').then((r) => r.json());
  const savedTools = JSON.parse(
    localStorage.getItem('jev2mcp-tools') || localStorage.getItem('jev-plugins') || 'null',
  );
  tools = Array.isArray(savedTools)
    ? [
        ...savedTools,
        ...session.catalog
          .filter(
            (p) =>
              !savedTools.some(
                (saved) =>
                  saved.id === p.id || saved.mention?.toLowerCase() === p.mention.toLowerCase(),
              ),
          )
          .map((p) => ({ ...p, enabled: true })),
      ]
    : session.catalog.map((p) => ({ ...p, enabled: true }));
  const health = await fetch('/api/health').then((r) => r.json());
  $('connection').textContent = health.keyAvailable ? 'Connected' : 'API key missing';
} catch {
  $('connection').textContent = 'Server offline';
}
function navigate(id) {
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== id));
  document
    .querySelectorAll('[data-tab]')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
}
document.querySelectorAll('[data-tab]').forEach(
  (b) =>
    (b.onclick = () => {
      navigate(b.dataset.tab);
      if (b.dataset.tab === 'compose') {
        $('prompt').value = '';
        $('context').value = '';
        revision++;
        invalidate();
        $('prompt').focus();
      }
    }),
);
$('tool-shortcut').onclick = () => navigate('library');
function invalidate() {
  result = null;
  $('decision').hidden = true;
}
function renderTools() {
  $('plugins').innerHTML = tools
    .map(
      (p) =>
        `<article class="tool-row"><div><label for="tool-${escape(p.id)}">${escape(p.name)}<span class="kind">${escape(p.kind || 'plugin')}</span></label><p>${escape(p.description)}</p></div><input type="checkbox" id="tool-${escape(p.id)}" aria-label="Enable ${escape(p.name)}" data-id="${escape(p.id)}" ${p.enabled ? 'checked' : ''}></article>`,
    )
    .join('');
  $('enabled-count').textContent = `${tools.filter((p) => p.enabled).length} tools`;
  $('plugins')
    .querySelectorAll('input')
    .forEach(
      (c) =>
        (c.onchange = () => {
          tools.find((p) => p.id === c.dataset.id).enabled = c.checked;
          saveTools();
        }),
    );
}
function saveTools() {
  localStorage.setItem('jev2mcp-tools', JSON.stringify(tools));
  revision++;
  invalidate();
  renderTools();
}
renderTools();
document.querySelectorAll('[data-example]').forEach(
  (b) =>
    (b.onclick = () => {
      $('prompt').value = b.dataset.example;
      revision++;
      invalidate();
      $('prompt').focus();
    }),
);
for (const id of ['prompt', 'context'])
  $(id).oninput = () => {
    revision++;
    invalidate();
  };
$('prompt-form').onsubmit = async (event) => {
  event.preventDefault();
  if (!$('prompt').value.trim()) {
    $('prompt').focus();
    return;
  }
  const requestRevision = revision;
  result = null;
  $('decision').hidden = false;
  $('decision').classList.add('loading');
  $('output-card').hidden = true;
  $('matches').replaceChildren();
  $('decision-note').textContent = '';
  $('decision-title').textContent = 'Checking tools…';
  $('timing').textContent = '';
  $('route').disabled = true;
  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jev-Token': session.token },
      body: JSON.stringify({
        prompt: $('prompt').value,
        context: $('context').value,
        plugins: tools.filter((p) => p.enabled).map(({ enabled, ...p }) => p),
        surface: 'companion',
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (revision !== requestRevision) throw new Error('Prompt changed. Check it again.');
    result = data;
    $('decision-title').textContent =
      data.status === 'routed'
        ? 'Tools selected'
        : data.status === 'unchanged'
          ? 'No tools needed'
          : 'Review needed';
    $('decision-note').textContent =
      data.status === 'routed'
        ? 'Choose these tools in ChatGPT’s @ picker.'
        : data.status === 'unchanged'
          ? 'The prompt is unchanged.'
          : 'Jev is unsure. The prompt is unchanged.';
    $('timing').textContent = data.live ? `${data.elapsedMs} ms` : '';
    $('matches').innerHTML = data.selected
      .map(
        (p) =>
          `<div class="match">@${escape(p.mention)}<span>${Math.round(p.probability * 100)}%</span></div>`,
      )
      .join('');
    $('output-card').hidden = false;
    $('output').textContent = data.output;
    $('raw').textContent = JSON.stringify(
      { model: data.model, needsTools: data.needsTools, usage: data.usage, policy: data.policy },
      null,
      2,
    );
    $('scores').innerHTML = data.scores
      .map(
        (p) =>
          `<div class="score"><span>${escape(p.name)}</span><span>${Math.round(p.probability * 100)}%</span></div>`,
      )
      .join('');
  } catch (error) {
    $('decision').hidden = false;
    $('decision-title').textContent = 'Not sent';
    $('decision-note').textContent = error.message;
  } finally {
    $('route').disabled = false;
    $('decision').classList.remove('loading');
  }
};
$('copy').onclick = async () => {
  if (!result) return;
  await navigator.clipboard.writeText(result.output);
  $('copy').textContent = 'Copied';
  setTimeout(() => ($('copy').textContent = 'Copy prompt'), 1500);
};
$('pair').onclick = async () => {
  await navigator.clipboard.writeText(
    JSON.stringify({
      token: session.token,
      plugins: tools.filter((p) => p.enabled).map(({ enabled, ...p }) => p),
    }),
  );
  $('pair-status').textContent = 'Copied. Paste it into the extension settings.';
};
$('add-plugin').onsubmit = (e) => {
  e.preventDefault();
  const name = $('plugin-name').value.trim();
  if (!/^[\p{L}\p{N} ._+-]{1,60}$/u.test(name)) return;
  tools.push({
    id: 'custom-' + crypto.randomUUID().slice(0, 8),
    name,
    mention: name,
    description: $('plugin-description').value.trim(),
    kind: $('plugin-kind').value,
    enabled: true,
  });
  saveTools();
  e.target.reset();
};
