import { validateCatalog } from './catalog.js';

export async function pairExtension(raw, storage) {
  const packageData = JSON.parse(raw);
  if (
    !packageData ||
    typeof packageData.token !== 'string' ||
    !/^[a-f0-9]{48}$/.test(packageData.token)
  )
    throw new Error('Copy a fresh pairing package from the companion.');
  const plugins = validateCatalog(packageData.plugins)
    .filter((plugin) => plugin.enabled !== false)
    .map(({ enabled, ...plugin }) => plugin);
  await storage.set({ token: packageData.token, plugins, enabled: true });
  return plugins.length;
}

if (typeof document !== 'undefined' && typeof chrome !== 'undefined') {
  const el = (id) => document.getElementById(id);
  chrome.storage.local.get(['enabled', 'contextEnabled', 'plugins']).then((s) => {
    el('enabled').checked = !!s.enabled;
    el('context').checked = !!s.contextEnabled;
    el('status').textContent = `${s.plugins?.length || 0} configured tools`;
  });
  el('save').onclick = async () => {
    try {
      const count = await pairExtension(el('pair').value, chrome.storage.local);
      el('pair').value = '';
      el('enabled').checked = true;
      el('status').textContent = `Paired · ${count} enabled tools`;
    } catch (error) {
      el('status').textContent =
        error instanceof SyntaxError
          ? 'Copy a fresh pairing package from the companion.'
          : error.message;
    }
  };
  el('enabled').onchange = () => chrome.storage.local.set({ enabled: el('enabled').checked });
  el('context').onchange = () =>
    chrome.storage.local.set({ contextEnabled: el('context').checked });
}
