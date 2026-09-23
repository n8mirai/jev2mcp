import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
async function setup(reply, { fastTimers = false } = {}) {
  const dom = new JSDOM(
    '<form><div id="prompt-textarea" role="textbox" contenteditable="true">Original prompt</div><button aria-label="Send prompt" type="submit">Send</button></form>',
    { url: 'https://chatgpt.com/c/test', runScripts: 'outside-only', pretendToBeVisual: true },
  );
  const w = dom.window;
  if (fastTimers) {
    const nativeTimeout = w.setTimeout.bind(w);
    w.setTimeout = (fn, delay) => nativeTimeout(fn, Math.min(delay, 1));
  }
  w.HTMLElement.prototype.getClientRects = function () {
    return [{}];
  };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
    get() {
      return this.textContent;
    },
    set(v) {
      this.textContent = v;
    },
  });
  let calls = 0,
    submits = 0,
    settingsListener;
  const settings = { enabled: true };
  w.chrome = {
    storage: {
      local: { get: async () => ({ ...settings }) },
      onChanged: {
        addListener(listener) {
          settingsListener = listener;
        },
      },
    },
    runtime: {
      sendMessage: async () => {
        calls++;
        return typeof reply === 'function' ? reply() : reply;
      },
    },
  };
  w.document.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    submits++;
  });
  w.eval(script);
  await new Promise((r) => setTimeout(r, 0));
  return {
    w,
    editor: w.document.getElementById('prompt-textarea'),
    button: w.document.querySelector('button'),
    changeSettings(values) {
      const changes = Object.fromEntries(
        Object.entries(values).map(([key, newValue]) => [
          key,
          { oldValue: settings[key], newValue },
        ]),
      );
      Object.assign(settings, values);
      settingsListener(changes, 'local');
    },
    get calls() {
      return calls;
    },
    get submits() {
      return submits;
    },
    close: () => w.close(),
  };
}
const unchanged = { status: 'unchanged', scores: [], selected: [], elapsedMs: 1 };
const settle = () => new Promise((r) => setTimeout(r, 15));
test('Send is held pending judgment then submitted once', async () => {
  let resolve;
  const a = await setup(() => new Promise((r) => (resolve = r)));
  a.button.click();
  a.button.click();
  assert.equal(a.submits, 0);
  assert.equal(a.calls, 1);
  resolve(unchanged);
  await settle();
  assert.equal(a.submits, 1);
  a.close();
});
test('a changed draft invalidates an in-flight judgment', async () => {
  let resolve;
  const a = await setup(() => new Promise((r) => (resolve = r)));
  a.button.click();
  a.editor.textContent = 'Changed';
  a.editor.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  resolve(unchanged);
  await settle();
  assert.equal(a.submits, 0);
  assert.match(
    a.w.document.getElementById('jev-router-host').shadowRoot.textContent,
    /Draft changed/,
  );
  a.close();
});
test('uncertain and failed requests never send automatically', async () => {
  for (const reply of [{ status: 'review', scores: [] }, { error: 'Offline' }]) {
    const a = await setup(reply);
    a.button.click();
    await settle();
    assert.equal(a.submits, 0);
    assert.equal(a.editor.textContent, 'Original prompt');
    a.close();
  }
});
test('Enter routes; Shift+Enter and IME do not', async () => {
  const a = await setup(unchanged);
  a.editor.dispatchEvent(
    new a.w.KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  a.editor.dispatchEvent(
    new a.w.KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  await settle();
  assert.equal(a.calls, 0);
  a.editor.dispatchEvent(
    new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
  await settle();
  assert.equal(a.calls, 1);
  assert.equal(a.submits, 1);
  a.close();
});
test('native manual selection is preserved without rewriting', async () => {
  const a = await setup(unchanged);
  a.editor.innerHTML = '<span contenteditable="false">Gmail</span> Original prompt';
  a.button.click();
  await settle();
  assert.equal(a.calls, 0);
  assert.equal(a.submits, 1);
  assert.match(a.editor.innerHTML, /Gmail/);
  a.close();
});
test('a SPA navigation invalidates a pending result', async () => {
  let resolve;
  const a = await setup(() => new Promise((r) => (resolve = r)));
  a.button.click();
  a.w.history.pushState({}, '', '/c/different');
  resolve(unchanged);
  await settle();
  assert.equal(a.submits, 0);
  a.close();
});

const driveRoute = {
  status: 'routed',
  scores: [],
  elapsedMs: 1,
  selected: [{ id: 'drive', name: 'Google Drive', mention: 'Google Drive' }],
};
test('current ChatGPT picker selects the plugin, not a file from the same provider', async () => {
  const a = await setup(driveRoute);
  let fileClicked = false;
  a.w.document.execCommand = () => {
    a.editor.textContent = '@Google DriveOriginal prompt';
    const file = a.w.document.createElement('div');
    file.className = '__menu-item';
    file.tabIndex = 0;
    file.innerHTML = '<span>Private file</span><span>Google Drive</span>';
    file.onclick = () => {
      fileClicked = true;
    };
    const row = a.w.document.createElement('div');
    row.className = '__menu-item';
    row.tabIndex = 0;
    row.innerHTML =
      '<div data-testid="plugin-icon-wrapper"></div><span>Google Drive</span><span>Drive, Docs, Sheets or Slides</span>';
    row.onclick = () => {
      a.editor.innerHTML =
        '<span contenteditable="false" data-inline-selection-pill data-keyword="Google Drive">Google Drive</span> Original prompt';
      // React may replace the Send button while resolving the native mention.
      a.button.replaceWith(a.button.cloneNode(true));
      row.remove();
      file.remove();
    };
    a.w.document.body.append(file, row);
    return true;
  };
  a.button.click();
  await settle();
  assert.equal(fileClicked, false);
  assert.equal(a.submits, 1);
  assert.equal(a.editor.textContent, 'Google Drive Original prompt');
  a.close();
});
test('an automatically resolved native mention is verified without another picker click', async () => {
  const a = await setup(driveRoute);
  a.w.document.execCommand = () => {
    a.editor.innerHTML =
      '<span contenteditable="false" data-keyword="Google Drive">Google Drive</span> Original prompt';
    return true;
  };
  a.button.click();
  await settle();
  assert.equal(a.submits, 1);
  a.close();
});

test('settings and catalog changes invalidate a pending judgment', async () => {
  for (const changes of [
    { plugins: [] },
    { token: 'new-token' },
    { enabled: false },
    { contextEnabled: true },
  ]) {
    let resolve;
    const a = await setup(() => new Promise((r) => (resolve = r)));
    a.button.click();
    a.changeSettings(changes);
    resolve(driveRoute);
    await settle();
    assert.equal(a.submits, 0);
    assert.equal(a.editor.textContent, 'Original prompt');
    a.close();
  }
});

test('exact picker identity can contain punctuation and differ from the display label', async () => {
  const mention = 'R&D / Tasks (personal)';
  const a = await setup({
    ...driveRoute,
    selected: [{ id: 'tasks', name: 'My work tracker', mention }],
  });
  let wrongRowClicked = false;
  a.w.document.execCommand = (command, ui, value) => {
    assert.equal(value, '@' + mention);
    const wrong = a.w.document.createElement('button');
    wrong.type = 'button';
    wrong.setAttribute('role', 'option');
    wrong.textContent = 'My work tracker';
    wrong.onclick = () => {
      wrongRowClicked = true;
    };
    const row = a.w.document.createElement('button');
    row.type = 'button';
    row.setAttribute('role', 'option');
    row.textContent = mention;
    row.onclick = () => {
      const chip = a.w.document.createElement('span');
      chip.setAttribute('contenteditable', 'false');
      chip.dataset.keyword = mention;
      chip.textContent = mention;
      a.editor.replaceChildren(chip, a.w.document.createTextNode(' Original prompt'));
      row.remove();
      wrong.remove();
    };
    a.w.document.body.append(wrong, row);
    return true;
  };
  a.button.click();
  await settle();
  assert.equal(wrongRowClicked, false);
  assert.equal(a.submits, 1);
  assert.equal(a.editor.querySelector('[contenteditable="false"]').dataset.keyword, mention);
  a.close();
});

const twoToolRoute = {
  ...driveRoute,
  selected: [
    { id: 'missing', name: 'Missing tool', mention: 'Missing' },
    { id: 'installed', name: 'Installed tool', mention: 'Installed' },
  ],
};
const held = async (a) => {
  for (let i = 0; i < 100; i++) {
    if (
      a.w.document.getElementById('jev-router-host').shadowRoot.getElementById('status')
        .textContent === 'Not sent.'
    )
      return;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail('The attachment did not finish holding the draft.');
};
function simulatePartialAttachment(a, { userEdit = false, settingsChange = false } = {}) {
  a.w.document.execCommand = (command, ui, value) => {
    if (value === '@Installed') {
      a.editor.innerHTML =
        '<span contenteditable="false" data-keyword="Installed">Installed</span> Original prompt';
      if (settingsChange) a.changeSettings({ plugins: [] });
    } else if (value === '@Missing') {
      a.editor.prepend(a.w.document.createTextNode(value));
      if (userEdit) {
        // A genuine user edit arrives while the native picker is being resolved.
        a.w.setTimeout(() => {
          a.editor.dispatchEvent(
            new a.w.InputEvent('beforeinput', { bubbles: true, data: ' extra' }),
          );
          a.editor.append(a.w.document.createTextNode(' extra'));
          a.editor.dispatchEvent(new a.w.InputEvent('input', { bubbles: true, data: ' extra' }));
        }, 0);
      }
    } else {
      a.editor.textContent = value;
    }
    return true;
  };
}

test('missing second tool restores the owned draft and Retry never sends a partial attachment', async () => {
  const a = await setup(twoToolRoute, { fastTimers: true });
  simulatePartialAttachment(a);
  a.button.click();
  await held(a);
  assert.equal(a.submits, 0);
  assert.equal(a.editor.textContent, 'Original prompt');
  assert.equal(a.editor.querySelector('[contenteditable="false"]'), null);
  const shadow = a.w.document.getElementById('jev-router-host').shadowRoot;
  [...shadow.querySelectorAll('button')].find((b) => b.textContent === 'Retry').click();
  await held(a);
  assert.equal(a.calls, 2);
  assert.equal(a.submits, 0);
  assert.equal(a.editor.textContent, 'Original prompt');
  a.close();
});

test('partial attachment preserves user edits and cannot use the manual-chip bypass on Retry', async () => {
  const a = await setup(twoToolRoute, { fastTimers: true });
  simulatePartialAttachment(a, { userEdit: true });
  a.button.click();
  await held(a);
  assert.equal(a.submits, 0);
  assert.match(a.editor.textContent, / extra$/);
  assert.ok(a.editor.querySelector('[contenteditable="false"]'));
  const shadow = a.w.document.getElementById('jev-router-host').shadowRoot;
  [...shadow.querySelectorAll('button')].find((b) => b.textContent === 'Retry').click();
  await settle();
  assert.equal(a.calls, 1);
  assert.equal(a.submits, 0);
  assert.match(a.editor.textContent, / extra$/);
  assert.equal(shadow.getElementById('status').textContent, 'Review attached tools.');
  a.close();
});

test('catalog changes during attachment restore the original draft without sending', async () => {
  const a = await setup(twoToolRoute, { fastTimers: true });
  simulatePartialAttachment(a, { settingsChange: true });
  a.button.click();
  await held(a);
  assert.equal(a.submits, 0);
  assert.equal(a.editor.textContent, 'Original prompt');
  a.close();
});
