const $ = (id) => document.getElementById(id);
let session,
  plugins,
  result,
  revision = 0;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
try {
  session = await fetch('/api/session').then((r) => r.json());
  plugins =
    JSON.parse(localStorage.getItem('jev-plugins') || 'null') ||
    session.catalog.map((p) => ({ ...p, enabled: true }));
  const health = await fetch('/api/health').then((r) => r.json());
  $('connection').textContent = health.keyAvailable ? 'Bridge online' : 'Keychain unavailable';
} catch {
  $('connection').textContent = 'Bridge offline';
}
function renderPlugins() {
  if (!plugins) return;
  $('plugins').innerHTML = plugins
    .map(
      (p) =>
        `<article class="plugin-card"><label>${escape(p.name)}<input type="checkbox" aria-label="Enable ${escape(p.name)}" data-id="${escape(p.id)}" ${p.enabled ? 'checked' : ''}></label><p>${escape(p.description)}</p></article>`,
    )
    .join('');
  $('enabled-count').textContent = `${plugins.filter((p) => p.enabled).length} plugins enabled`;
  $('plugins')
    .querySelectorAll('input')
    .forEach(
      (c) =>
        (c.onchange = () => {
          plugins.find((p) => p.id === c.dataset.id).enabled = c.checked;
          savePlugins();
        }),
    );
}
function savePlugins() {
  localStorage.setItem('jev-plugins', JSON.stringify(plugins));
  revision++;
  invalidate();
  renderPlugins();
}
function invalidate() {
  result = null;
  $('output-card').hidden = true;
}
renderPlugins();
document.querySelectorAll('[data-tab]').forEach(
  (b) =>
    (b.onclick = () => {
      document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== b.dataset.tab));
      document.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t === b));
    }),
);
document.querySelectorAll('[data-example]').forEach(
  (b) =>
    (b.onclick = () => {
      $('prompt').value = b.dataset.example;
      revision++;
      invalidate();
      $('prompt').focus();
    }),
);
for (const id of ['prompt', 'context', 'surface'])
  $(id).addEventListener('input', () => {
    revision++;
    invalidate();
  });
$('route').onclick = async () => {
  if (!$('prompt').value.trim()) {
    $('prompt').focus();
    return;
  }
  const requestRevision = revision;
  invalidate();
  $('route').disabled = true;
  $('route').textContent = 'Asking Jev…';
  $('metrics').hidden = true;
  $('decision-content').innerHTML =
    '<div class="orbit spinner"><span>j</span></div><h2>Reading the intent…</h2><p>One live request. Typed judgments.</p>';
  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jev-Token': session.token },
      body: JSON.stringify({
        prompt: $('prompt').value,
        context: $('context').value,
        plugins: plugins.filter((p) => p.enabled).map(({ enabled, ...p }) => p),
        surface: $('surface').value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (revision !== requestRevision)
      throw new Error('Draft changed. Route again to check the new prompt.');
    result = data;
    const title =
      data.status === 'routed'
        ? 'Yes. Bring the tools.'
        : data.status === 'unchanged'
          ? 'Just your words.'
          : 'Let’s check this.';
    $('decision-content').innerHTML =
      `<div class="answer">${data.needsTools == null ? '—' : Math.round(data.needsTools * 100) + '%'}</div><h2>${title}</h2><p>${data.needsTools == null ? 'No model call needed' : 'Probability this prompt needs an enabled plugin'}</p><div class="plugin-pills">${data.selected.length ? data.selected.map((p) => `<span class="plugin-pill">@${escape(p.mention)}</span>`).join('') : '<span class="plugin-pill">' + (data.status === 'review' ? 'Review suggested' : 'No injection') + '</span>'}</div>`;
    $('metrics').hidden = false;
    $('metrics').innerHTML =
      `<span>${escape(data.model || 'Deterministic')}</span><span>${data.elapsedMs} ms</span><span>${data.live ? 'LIVE API' : 'NO API CALL'}</span>`;
    $('output-card').hidden = false;
    $('output').textContent = data.output;
    $('output-status').textContent = data.reason;
    $('raw').textContent = JSON.stringify(data, null, 2);
    $('output-hint').textContent =
      data.status === 'routed'
        ? 'Desktop: choose these plugins in the native @ picker.'
        : 'Your original prompt, unchanged.';
  } catch (error) {
    $('decision-content').innerHTML =
      `<div class="answer">Hold.</div><h2>Nothing was sent.</h2><p>${escape(error.message)}</p>`;
  } finally {
    $('route').disabled = false;
    $('route').innerHTML = 'Route with Jev <span>↗</span>';
  }
};
$('copy').onclick = async () => {
  if (!result) return;
  await navigator.clipboard.writeText(result.output);
  $('copy').textContent = 'Copied ✓';
  setTimeout(() => ($('copy').textContent = 'Copy for desktop'), 1500);
};
$('pair').onclick = async () => {
  await navigator.clipboard.writeText(
    JSON.stringify({
      token: session.token,
      plugins: plugins.filter((p) => p.enabled).map(({ enabled, ...p }) => p),
    }),
  );
  $('pair-status').textContent =
    'Copied. Paste into the extension popup. Re-pair after restarting the bridge.';
};
$('add-plugin').onsubmit = (e) => {
  e.preventDefault();
  const name = $('plugin-name').value.trim(),
    description = $('plugin-description').value.trim();
  if (!/^[\p{L}\p{N} ._+-]{1,60}$/u.test(name)) return;
  const id = 'custom-' + crypto.randomUUID().slice(0, 8);
  plugins.push({ id, name, mention: name, description, enabled: true });
  savePlugins();
  e.target.reset();
};
