import { validateCatalog } from '../extension/catalog.js';

export const STORAGE_KEY = 'jev2mcp-catalog-v1';
const withChoices = (tools) => tools.map((tool) => ({ ...tool, enabled: tool.enabled === true }));

export function parseCatalog(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The catalog is not valid JSON.');
  }
  if (!data || Array.isArray(data) || data.version !== 1 || !Array.isArray(data.tools))
    throw new Error('Use a jev2mcp catalog with version: 1 and a tools array.');
  return withChoices(validateCatalog(data.tools));
}

export function serializeCatalog(tools) {
  return JSON.stringify({ version: 1, tools: withChoices(validateCatalog(tools)) }, null, 2);
}

export function loadLibrary(storage) {
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current !== null) return { tools: parseCatalog(current), notice: '' };
    const legacy = storage.getItem('jev2mcp-tools') ?? storage.getItem('jev-plugins');
    if (legacy === null) return { tools: [], notice: '' };
    const tools = withChoices(validateCatalog(JSON.parse(legacy)));
    // Preserve the user's list exactly. Never append examples during an upgrade.
    storage.setItem(STORAGE_KEY, serializeCatalog(tools));
    return {
      tools,
      notice: 'Your existing tools were kept. Review the list and remove any you do not have.',
    };
  } catch {
    return {
      tools: [],
      notice:
        'Your saved tool list could not be read. The original data is kept. Import a valid catalog or add your tools again.',
    };
  }
}

export function saveLibrary(storage, tools) {
  const serialized = serializeCatalog(tools);
  const old = storage.getItem(STORAGE_KEY);
  if (old !== null) {
    try {
      parseCatalog(old);
    } catch {
      storage.setItem('jev2mcp-catalog-recovery', old);
    }
  }
  storage.setItem(STORAGE_KEY, serialized);
}

export const enabledTools = (tools) =>
  validateCatalog(tools)
    .filter((tool) => tool.enabled === true)
    .map(({ enabled, ...tool }) => tool);

export const importCatalog = (text) =>
  parseCatalog(text).map((tool) => ({ ...tool, enabled: false }));
