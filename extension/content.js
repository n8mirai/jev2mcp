(() => {
  if (document.getElementById('jev-router-host')) return;
  const fixture = location.origin === 'http://127.0.0.1:4328' && location.pathname === '/fixture';
  const host = document.createElement('div');
  host.id = 'jev-router-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
:host{position:fixed;right:20px;bottom:104px;z-index:2147483646;font:13px Arial,Helvetica,sans-serif;color:#202020;color-scheme:light}
section{width:284px;padding:14px 16px;border:1px solid #e3e3e3;border-radius:14px;background:#fff;box-shadow:0 4px 20px #0000000d;animation:in .18s ease}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:11px}b{font-size:13px;font-weight:500}p{margin:7px 0;line-height:1.5;font-size:13px}small{font-size:11px;color:#888}button{border:0;border-radius:7px;padding:7px 10px;margin:8px 6px 0 0;background:#222;color:white;cursor:pointer;font-size:12px}.secondary{background:#f3f3f3;color:#555}details{margin-top:12px;border-top:1px solid #eee;padding-top:10px;color:#888;font-size:11px}summary{cursor:pointer}pre{white-space:pre-wrap;font-size:10px;max-height:150px;overflow:auto;color:#666}#badge{color:#888}#detail:empty{display:none}@keyframes in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@media(prefers-color-scheme:dark){:host{color:#eee;color-scheme:dark}section{background:#303030;border-color:#484848;box-shadow:0 4px 20px #0003}button{background:#eee;color:#222}.secondary{background:#444;color:#eee}details{border-color:#484848}pre{color:#bbb}}@media(prefers-reduced-motion:reduce){section{animation:none}}
</style><section><header><b>jev2mcp</b><small id="badge">Ready</small></header><p id="status">Tools checked before sending.</p><small id="detail"></small><div id="actions"></div><details><summary>Details</summary><pre id="raw">No prompt checked yet.</pre></details></section>`;
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
    if (!e.isConnected || e !== editor()) {
      status('Draft changed. Nothing sent.', '', 'Held');
      return;
    }
    permit = { element: e, signature: signature(e), url: location.href };
    if (!button?.isConnected || button.disabled) button = sendButton();
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
      throw new Error('This composer has no native tool picker. Select the tool manually.');
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
    const nativeChip = () =>
      [...e.querySelectorAll('[contenteditable="false"]')].find(
        (el) =>
          el.getAttribute('data-keyword') === plugin.name ||
          (el.textContent || '').trim() === plugin.name,
      );
    const option = await waitFor(
      () =>
        nativeChip() ||
        [
          ...document.querySelectorAll(
            '[role="option"],[role="menuitem"],[cmdk-item],button,div.__menu-item[tabindex="0"]',
          ),
        ].find((el) => {
          if (!visible(el) || el.closest('#jev-router-host')) return false;
          // Current ChatGPT renders plugin rows without an ARIA menu role.
          // A file result may also contain the provider name; never select it.
          if (el.matches('div.__menu-item')) {
            return (
              !!el.querySelector('[data-testid="plugin-icon-wrapper"]') &&
              [...el.querySelectorAll('span')].some((s) => s.textContent.trim() === plugin.name)
            );
          }
          const label = (el.getAttribute('aria-label') || el.innerText || '').trim();
          return label === plugin.name || label.split('\n')[0] === plugin.name;
        }),
    );
    if (!valid()) throw new Error('Draft changed during attachment. Nothing sent.');
    if (!option)
      throw new Error(`Choose @${plugin.mention} in ChatGPT’s picker, then press Send again.`);
    applying = true;
    try {
      if (!nativeChip()) option.click();
    } finally {
      applying = false;
    }
    const chip = await waitFor(nativeChip);
    if (!valid()) throw new Error('Draft changed during attachment. Nothing sent.');
    if (!chip)
      throw new Error(
        'Native tool attachment could not be verified. Check the composer before sending.',
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
    status('Checking tools…', '', 'Jev');
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
        status('Review needed.', 'Jev is unsure. No tools added.', 'Not sent');
        action('Send original', () => send(e, button));
        return;
      }
      if (result.status === 'unchanged') {
        status('No tools needed.', `${result.elapsedMs} ms · Prompt unchanged`, 'Unchanged');
        send(e, button);
        return;
      }
      status(
        'Attaching ' + result.selected.map((p) => '@' + p.mention).join(' '),
        `${result.elapsedMs} ms · Jev`,
        'Routing',
      );
      const valid = () => e.isConnected && location.href === url && userEdits === editVersion;
      for (const p of [...result.selected].reverse()) await attach(e, p, valid);
      if (!valid()) throw new Error('Draft changed. Nothing sent.');
      status(
        'Tools selected.',
        result.selected
          .map((p) => '@' + p.mention + ' · ' + Math.round(p.probability * 100) + '%')
          .join(' · '),
        'Routed',
      );
      send(e, button);
    } catch (error) {
      status('Not sent.', error.message, 'Review');
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
