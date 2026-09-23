// Shared by the packaged extension, the companion, and the routing module.
// Catalogs describe capabilities; they never contain connection credentials.
export const MAX_TOOLS = 24;
export const catalogIdentity = (name) =>
  name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();

export function validateCatalog(value) {
  if (!Array.isArray(value) || value.length > MAX_TOOLS)
    throw new Error(`Use a tool list with at most ${MAX_TOOLS} entries.`);
  const ids = new Set(),
    mentions = new Set();
  return value.map((entry, index) => {
    const fail = (message) => {
      throw new Error(`Tool ${index + 1}: ${message}`);
    };
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      fail('expected a tool object.');
    if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,49}$/.test(entry.id))
      fail('id must contain 1–50 lowercase letters, numbers, or hyphens.');
    if (ids.has(entry.id)) fail('id is already in this list.');
    const label = (field) => {
      if (typeof entry[field] !== 'string') fail(`${field} must be text.`);
      const text = entry[field].trim();
      if (!text || text.length > 80 || /[\p{Cc}\p{Zl}\p{Zp}@]/u.test(text))
        fail(`${field} must be 1–80 printable characters, without @ or line breaks.`);
      return text;
    };
    const name = label('name'),
      mention = label('mention');
    if (mentions.has(catalogIdentity(mention))) fail('picker name is already in this list.');
    if (
      typeof entry.description !== 'string' ||
      !entry.description.trim() ||
      entry.description.trim().length > 1200
    )
      fail('description must contain 1–1,200 characters.');
    const kind = entry.kind ?? 'tool';
    if (!['mcp', 'plugin', 'tool'].includes(kind)) fail('type must be mcp, plugin, or tool.');
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean')
      fail('enabled must be true or false.');
    ids.add(entry.id);
    mentions.add(catalogIdentity(mention));
    return {
      id: entry.id,
      name,
      mention,
      description: entry.description.trim(),
      kind,
      ...(entry.enabled === undefined ? {} : { enabled: entry.enabled }),
    };
  });
}
