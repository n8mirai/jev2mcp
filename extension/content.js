(() => {
  if (document.getElementById('jev-router-host')) return;
  const fixture = location.origin === 'http://127.0.0.1:4328' && location.pathname === '/fixture';
  const host = document.createElement('div');
  host.id = 'jev-router-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>:host{position:fixed;right:24px;bottom:24px;z-index:2147483646;font:13px system-ui;color:#f4f7ed}section{width:300px;padding:16px;border:1px solid #4b6255;border-radius:17px;background:#182a24;box-shadow:0 12px 40px #0005}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}b{color:#d7fa70;letter-spacing:.04em}p{margin:8px 0;line-height:1.4}small{color:#bdc9be}button{border:0;border-radius:8px;padding:7px 10px;margin:7px 6px 0 0;background:#d7fa70;color:#18241b;cursor:pointer;font-weight:650}.secondary{background:#344b40;color:white}progress{width:100%;accent-color:#d7fa70}details{margin-top:8px}pre{white-space:pre-wrap;font-size:11px;max-height:140px;overflow:auto}</style><section><header><b>JEV / ROUTER</b><small id="badge">Ready</small></header><p id="status">Plugin routing before Send.</p><small id="detail">Your prompt → Jev → ChatGPT</small><div id="actions"></div><details><summary>Decision details</summary><pre id="raw">Waiting for a prompt.</pre></details></section>`;
  document.documentElement.append(host);
  const $ = (id) => shadow.getElementById(id);
  let busy = false,
    permit = null,
    revision = 0,
    enabled = fixture,
    contextEnabled = false,
    userEdits = 0,
    applying = false;
  if (!fixture) {
    chrome.storage.local.get(['enabled', 'contextEnabled']).then((s) => {
      enabled = !!s.enabled;
      contextEnabled = !!s.contextEnabled;
      host.hidden = !enabled;
    });
    chrome.storage.onChanged.addListener(() =>
      chrome.storage.local.get(['enabled', 'contextEnabled']).then((s) => {
        enabled = !!s.enabled;
        contextEnabled = !!s.contextEnabled;
        host.hidden = !enabled;
      }),
    );
  }
  const visible = (el) => !!el?.getClientRects().length;
  const editor = () =>
    [
      ...document.querySelectorAll(
        '#prompt-textarea,[contenteditable="true"][role="textbox"],textarea[placeholder]',
      ),
    ].find(visible);
  const text = (e) => e.value ?? e.innerText;
  const signature = (e) => e.value ?? e.innerHTML;
  const sendButton = () =>
    [
      ...document.querySelectorAll(
        'button[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"],button[type="submit"]',
      ),
    ].find((b) => visible(b) && !b.disabled);
  const status = (message, detail = '', badge = 'Ready') => {
    $('status').textContent = message;
    $('detail').textContent = detail;
    $('badge').textContent = badge;
  };
  const action = (label, fn, secondary = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = secondary ? 'secondary' : '';
    b.onclick = fn;
    $('actions').append(b);
  };
  const hasChip = (e) => !!e.querySelector?.('[contenteditable="false"]');
  function send(e, button) {
    permit = { element: e, signature: signature(e), url: location.href };
    if (button?.isConnected && !button.disabled) button.click();
    else {
      permit = null;
      status('Ready. Press Send to continue.');
    }
  }
  async function evaluate(prompt, context) {
    if (!fixture) return chrome.runtime.sendMessage({ type: 'jev-route', prompt, context });
    const session = await fetch('/api/session').then((r) => r.json());
    const r = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jev-Token': session.token },
      body: JSON.stringify({
        prompt,
        context,
        plugins: session.catalog,
        surface: 'local-adapter-fixture',
      }),
    });
    return r.json();
  }
  const waitFor = async (fn) => {
    for (let i = 0; i < 30; i++) {
      const v = fn();
      if (v) return v;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  };
  function atStart(e) {
    e.focus();
    const s = getSelection(),
      range = document.createRange();
    range.selectNodeContents(e);
    range.collapse(true);
    s.removeAllRanges();
    s.addRange(range);
  }
  async function attach(e, plugin, valid) {
    if (!valid()) throw new Error('Draft changed during attachment. Nothing sent.');
    if (e.tagName === 'TEXTAREA')
      throw new Error('This composer has no native plugin picker. Select the plugin manually.');
    atStart(e);
    applying = true;
    try {
      document.execCommand('insertText', false, '@' + plugin.mention);
    } finally {
      applying = false;
    }
    e.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: '@' + plugin.mention,
      }),
    );
    const option = await waitFor(() =>
      [...document.querySelectorAll('[role="option"],[role="menuitem"],[cmdk-item],button')].find(
        (el) => {
          if (!visible(el) || el.closest('#jev-router-host')) return false;
          const label = (el.getAttribute('aria-label') || el.innerText || '').trim();
          return label === plugin.name || label.split('\n')[0] === plugin.name;
        },
      ),
    );
    if (!valid()) throw new Error('Draft changed during attachment. Nothing sent.');
    if (!option)
      throw new Error(`Choose @${plugin.mention} in ChatGPT’s picker, then press Send again.`);
    applying = true;
    try {
      option.click();
    } finally {
      applying = false;
    }
    const chip = await waitFor(() =>
      [...e.querySelectorAll('[contenteditable="false"]')].find((el) =>
        (el.textContent || '').includes(plugin.name),
      ),
    );
    if (!valid()) throw new Error('Draft changed during attachment. Nothing sent.');
    if (!chip)
      throw new Error(
        'Native plugin attachment could not be verified. Check the composer before sending.',
      );
    return chip;
  }
  async function intercept(event, button) {
    if (!enabled) return;
    const e = editor();
    if (!e || !text(e).trim()) return;
    if (
      permit &&
      permit.element === e &&
      permit.signature === signature(e) &&
      permit.url === location.href
    )
      return;
    if (hasChip(e) && !busy) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    const original = text(e),
      before = signature(e),
      url = location.href,
      version = ++revision,
      editVersion = userEdits;
    busy = true;
    $('actions').replaceChildren();
    status('Does this prompt need a plugin?', 'Jev is reading the prompt…', 'Thinking');
    try {
      const context = contextEnabled
        ? [...document.querySelectorAll('[data-message-author-role]')]
            .slice(-4)
            .map((n) => `${n.getAttribute('data-message-author-role')}: ${n.innerText}`)
            .join('\n')
            .slice(-6000)
        : '';
      const result = await evaluate(original, context);
      if (
        !e.isConnected ||
        location.href !== url ||
        signature(e) !== before ||
        version !== revision
      ) {
        status('Draft changed. Press Send to recheck.', 'Nothing was sent.', 'Held');
        return;
      }
      if (result.disabled) {
        send(e, button);
        return;
      }
      if (result.error) throw new Error(result.error);
      $('raw').textContent = JSON.stringify(
        {
          model: result.model,
          needsTools: result.needsTools,
          matches: result.scores?.map((p) => ({ name: p.name, p: p.probability })),
          elapsedMs: result.elapsedMs,
          usage: result.usage,
        },
        null,
        2,
      );
      if (result.status === 'review') {
        status('Jev is unsure. Review this prompt.', 'No plugins attached.', 'Held');
        action('Send original', () => send(e, button));
        return;
      }
      if (result.status === 'unchanged') {
        status('No plugin needed.', `${result.elapsedMs} ms · Prompt unchanged`, 'Pass through');
        send(e, button);
        return;
      }
      status(
        'Attaching ' + result.selected.map((p) => '@' + p.mention).join(' '),
        `${result.elapsedMs} ms · Live Jev judgment`,
        'Routing',
      );
      const valid = () => e.isConnected && location.href === url && userEdits === editVersion;
      for (const p of [...result.selected].reverse()) await attach(e, p, valid);
      if (!valid()) throw new Error('Draft changed. Nothing sent.');
      status(
        'Plugins attached. Sending…',
        result.selected.map((p) => '@' + p.mention).join(' '),
        'Routed',
      );
      send(e, button);
    } catch (error) {
      status('Prompt held.', error.message, 'Needs attention');
      action(
        'Retry',
        () => {
          permit = null;
          sendButton()?.click();
        },
        true,
      );
      action('Send as shown', () => send(e, button), true);
    } finally {
      busy = false;
    }
  }
  document.addEventListener(
    'beforeinput',
    (event) => {
      if (event.target === editor() && !applying) userEdits++;
    },
    true,
  );
  document.addEventListener(
    'input',
    (event) => {
      if (event.target === editor()) {
        permit = null;
        revision++;
      }
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key !== 'Enter' ||
        event.shiftKey ||
        event.isComposing ||
        event.defaultPrevented ||
        event.target !== editor()
      )
        return;
      // Enter should select an open @ picker option, not submit the prompt.
      if ([...document.querySelectorAll('[role="listbox"],[cmdk-list]')].some(visible)) return;
      intercept(event, sendButton());
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      const button = event.target.closest?.('button');
      if (button && button === sendButton()) intercept(event, button);
    },
    true,
  );
  document.addEventListener(
    'submit',
    (event) => {
      if (event.target.contains(editor())) intercept(event, sendButton());
    },
    true,
  );
})();
