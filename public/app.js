import { validateCatalog, catalogIdentity } from '../extension/catalog.js';
import {
  loadLibrary,
  saveLibrary,
  serializeCatalog,
  importCatalog,
  enabledTools,
  STORAGE_KEY,
} from './library.js';

const $ = (id) => document.getElementById(id);
let session,
  result,
  revision = 0,
  editingId = null,
  checking = false;
const saved = loadLibrary(localStorage);
let tools = saved.tools;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const notice = (message) => {
  $('library-notice').textContent = message;
};
notice(saved.notice);

try {
  const [sessionResponse, healthResponse] = await Promise.all([
    fetch('/api/session'),
    fetch('/api/health'),
  ]);
  if (!sessionResponse.ok || !healthResponse.ok) throw new Error('Bridge unavailable');
  session = await sessionResponse.json();
  const health = await healthResponse.json();
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
function invalidate() {
  result = null;
  $('decision').hidden = true;
}
document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => navigate(b.dataset.tab)));
$('tool-shortcut').onclick = $('setup-tools').onclick = () => navigate('library');

function resetEditor() {
  editingId = null;
  $('add-plugin').reset();
  $('save-tool').textContent = 'Add tool';
  $('cancel-tool').hidden = true;
  $('tool-form-title').textContent = 'Add a tool';
}
function renderTools() {
  const count = enabledTools(tools).length;
  $('enabled-count').textContent = `${count} ${count === 1 ? 'tool' : 'tools'}`;
  $('onboarding').hidden = count > 0;
  $('examples').hidden = count === 0;
  $('pair').disabled = !session;
  $('pair-help').textContent = count
    ? `${count} enabled ${count === 1 ? 'tool will' : 'tools will'} be paired.`
    : 'No tools enabled. Pairing clears the extension’s current tool list.';
  $('export-catalog').disabled = tools.length === 0;
  $('plugins').innerHTML = tools.length
    ? tools
        .map(
          (p) => `
    <article class="tool-row">
      <div><label for="tool-${p.id}">${escape(p.name)}<span class="kind">${escape(p.kind)}</span></label>
      <p class="picker-name">@${escape(p.mention)}</p><p>${escape(p.description)}</p>
      <div class="tool-actions"><button type="button" class="quiet" data-edit="${p.id}">Edit</button><button type="button" class="quiet" data-remove="${p.id}">Remove</button></div></div>
      <input type="checkbox" id="tool-${p.id}" aria-label="Enable ${escape(p.name)}" data-id="${p.id}" ${p.enabled ? 'checked' : ''}>
    </article>`,
        )
        .join('')
    : '<div class="empty-library"><h2>Your tool list starts here</h2><p>Add a tool you already have connected, or import a catalog. Nothing is enabled by default.</p></div>';
  if (!tools.length) $('tool-editor').open = true;
  $('plugins')
    .querySelectorAll('input')
    .forEach(
      (c) =>
        (c.onchange = () => {
          updateTools(tools.map((p) => (p.id === c.dataset.id ? { ...p, enabled: c.checked } : p)));
        }),
    );
  $('plugins')
    .querySelectorAll('[data-edit]')
    .forEach(
      (b) =>
        (b.onclick = () => {
          const p = tools.find((p) => p.id === b.dataset.edit);
          editingId = p.id;
          $('plugin-name').value = p.name;
          $('plugin-mention').value = p.mention;
          $('plugin-kind').value = p.kind;
          $('plugin-description').value = p.description;
          $('plugin-enabled').checked = p.enabled;
          $('save-tool').textContent = 'Save changes';
          $('tool-form-title').textContent = 'Edit tool';
          $('cancel-tool').hidden = false;
          $('tool-editor').open = true;
          $('plugin-name').focus();
        }),
    );
  $('plugins')
    .querySelectorAll('[data-remove]')
    .forEach(
      (b) =>
        (b.onclick = () => {
          const p = tools.find((p) => p.id === b.dataset.remove);
          if (
            updateTools(
              tools.filter((tool) => tool.id !== p.id),
              `Removed ${p.name}.`,
            ) &&
            editingId === p.id
          )
            resetEditor();
        }),
    );
}
function updateTools(next, message = 'Tool list saved.') {
  try {
    const valid = validateCatalog(next);
    saveLibrary(localStorage, valid);
    tools = valid;
    revision++;
    invalidate();
    renderTools();
    notice(message);
    $('pair-status').textContent = 'Tool list changed. Pair again to update the extension.';
    return true;
  } catch (error) {
    renderTools();
    notice(error.message);
    return false;
  }
}
renderTools();
$('cancel-tool').onclick = resetEditor;
$('add-plugin').onsubmit = (event) => {
  event.preventDefault();
  const name = $('plugin-name').value.trim();
  const entry = {
    id: editingId ?? 'custom-' + crypto.randomUUID(),
    name,
    mention: $('plugin-mention').value.trim() || name,
    description: $('plugin-description').value.trim(),
    kind: $('plugin-kind').value,
    enabled: $('plugin-enabled').checked,
  };
  const next = editingId ? tools.map((p) => (p.id === editingId ? entry : p)) : [...tools, entry];
  if (
    updateTools(
      next,
      editingId
        ? 'Tool updated. Pair again to use the changes.'
        : entry.enabled
          ? 'Tool added and enabled.'
          : 'Tool added. Enable it when it is available in your picker.',
    )
  )
    resetEditor();
};
$('import-catalog').onclick = () => $('catalog-file').click();
$('catalog-file').onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const startRevision = revision;
  try {
    if (file.size > 100000) throw new Error('Use a catalog smaller than 100 KB.');
    const imported = importCatalog(await file.text());
    if (revision !== startRevision)
      throw new Error('The tool list changed while importing. Choose the file again.');
    if (
      updateTools(
        imported,
        `Imported ${imported.length} tools, all disabled. Enable only the ones available to you.`,
      )
    )
      resetEditor();
  } catch (error) {
    notice(error.message);
  }
  event.target.value = '';
};
$('export-catalog').onclick = () => {
  const url = URL.createObjectURL(
    new Blob([serializeCatalog(tools)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jev2mcp-tools.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('sample-catalog').onclick = async () => {
  try {
    const response = await fetch('/examples/common-tools.json');
    if (!response.ok) throw new Error('Example catalog unavailable.');
    const samples = importCatalog(await response.text());
    const additions = samples.filter(
      (sample) =>
        !tools.some(
          (tool) =>
            tool.id === sample.id ||
            catalogIdentity(tool.mention) === catalogIdentity(sample.mention),
        ),
    );
    updateTools(
      [...tools, ...additions],
      'Examples added, disabled. Edit the names and descriptions to match your own connected tools.',
    );
  } catch (error) {
    notice(error.message);
  }
};
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  const loaded = loadLibrary(localStorage);
  tools = loaded.tools;
  revision++;
  invalidate();
  resetEditor();
  renderTools();
  notice(loaded.notice || 'Tool list updated in another tab. Pair again to update the extension.');
});

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
  if (checking || !$('prompt').value.trim()) {
    $('prompt').focus();
    return;
  }
  const plugins = enabledTools(tools);
  if (!plugins.length) {
    navigate('library');
    notice('Add and enable a tool before checking a prompt.');
    return;
  }
  if (!session) {
    $('connection').textContent = 'Server offline';
    return;
  }
  const requestRevision = revision;
  result = null;
  checking = true;
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
        plugins,
        surface: 'companion',
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (revision !== requestRevision) return;
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
    if (revision === requestRevision) {
      $('decision').hidden = false;
      $('decision-title').textContent = 'Not sent';
      $('decision-note').textContent = error.message;
    }
  } finally {
    checking = false;
    $('route').disabled = false;
    $('decision').classList.remove('loading');
  }
};
$('copy').onclick = async () => {
  if (!result) return;
  try {
    await navigator.clipboard.writeText(result.output);
    $('copy').textContent = 'Copied';
    setTimeout(() => ($('copy').textContent = 'Copy prompt'), 1500);
  } catch {
    $('decision-note').textContent = 'Clipboard unavailable. Select and copy the output below.';
  }
};
$('pair').onclick = async () => {
  try {
    const plugins = enabledTools(tools);
    if (!session) return;
    await navigator.clipboard.writeText(JSON.stringify({ token: session.token, plugins }));
    $('pair-status').textContent =
      'Copied. Paste into Connection in the extension popup, then choose Pair & enable.';
  } catch {
    $('pair-status').textContent = 'Could not copy. Check clipboard access and try again.';
  }
};
