import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
async function setup(reply) {
  const dom = new JSDOM(
    '<form><div id="prompt-textarea" role="textbox" contenteditable="true">Original prompt</div><button aria-label="Send prompt" type="submit">Send</button></form>',
    { url: 'https://chatgpt.com/c/test', runScripts: 'outside-only', pretendToBeVisual: true },
  );
  const w = dom.window;
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
    submits = 0;
  w.chrome = {
    storage: { local: { get: async () => ({ enabled: true }) }, onChanged: { addListener() {} } },
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
