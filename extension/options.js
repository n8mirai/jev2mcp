const el = (id) => document.getElementById(id);
chrome.storage.local.get(['enabled', 'contextEnabled', 'plugins']).then((s) => {
  el('enabled').checked = !!s.enabled;
  el('context').checked = !!s.contextEnabled;
  el('status').textContent = `${s.plugins?.length || 0} configured plugins`;
});
el('save').onclick = async () => {
  try {
    const p = JSON.parse(el('pair').value);
    if (!/^[a-f0-9]{48}$/.test(p.token) || !Array.isArray(p.plugins)) throw Error();
    await chrome.storage.local.set({ token: p.token, plugins: p.plugins, enabled: true });
    el('pair').value = '';
    el('enabled').checked = true;
    el('status').textContent = `Paired · ${p.plugins.length} enabled plugins`;
  } catch {
    el('status').textContent = 'Copy a fresh pairing package from the companion.';
  }
};
el('enabled').onchange = () => chrome.storage.local.set({ enabled: el('enabled').checked });
el('context').onchange = () => chrome.storage.local.set({ contextEnabled: el('context').checked });
