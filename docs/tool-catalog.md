# Configure a tool catalog

The catalog tells Jev which capabilities it may select. Start with tools already available to you. For the ChatGPT extension, each enabled entry must match a tool in your account's native `@` picker. Adding a catalog entry does not install, authenticate, or connect a service.

## Add and maintain entries

In the companion's **Tools** view, add a display name, picker name, type, and description. Use the picker name exactly as ChatGPT shows it, without the leading `@`. The display name can be friendlier; the picker name is what the extension uses to attach the tool.

Describe the capability and when it is useful. For a custom notes tool, “Search and read my project notes, meeting decisions, and launch briefs” is more useful than “My MCP.” Mention limits that distinguish overlapping tools. Do not include API keys, server credentials, or instructions to override the user's request.

The `mcp`, `plugin`, and `tool` types are descriptive labels. They all use the same routing logic and native picker attachment. A custom MCP must first be connected through ChatGPT and exposed in its picker before this adapter can use it.

You can edit or remove entries and enable only those available in your account. A fresh install has no entries. Existing valid saved entries and enabled choices are retained when upgrading; no example services are added automatically.

After every catalog change, copy a new pairing package from **Settings** and pair the extension again. The extension uses the enabled catalog snapshot from that package. To clear its current tools, disable or remove every entry, then copy and pair the empty package. The extension will pass prompts through unchanged. Changing the companion's list alone does not update the extension.

## Import and export

Export saves a JSON catalog that you can back up or share. Import validates a JSON file before replacing the current list. Imported entries are always disabled, even if the file says `enabled: true`; review and enable your installed tools afterward. Export your current catalog first if you want to keep it.

A catalog can contain up to 24 entries. Display names and picker names must contain 1–80 printable characters and omit `@` and line breaks. Picker names must be unique and are checked for duplicates without case or spacing differences. Descriptions must contain 1–1,200 characters. Import files can be at most 100 KB.

```json
{
  "version": 1,
  "tools": [
    {
      "id": "project-notes",
      "name": "Project Notes",
      "mention": "Project Notes",
      "description": "Search and read my project notes, meeting decisions, and launch briefs.",
      "kind": "mcp",
      "enabled": false
    }
  ]
}
```

This is an example description for a hypothetical custom tool. Replace it with the name and capabilities of yours.

| Field         | Meaning                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| `version`     | Catalog format version; currently `1`.                                                                        |
| `tools`       | List of catalog entries. An empty list is valid.                                                              |
| `id`          | Unique 1–50 character identifier using lowercase letters, digits, and hyphens; starts with a letter or digit. |
| `name`        | Display name in the companion.                                                                                |
| `mention`     | Exact ChatGPT picker name, without `@`.                                                                       |
| `description` | Capability description sent to Jev when enabled.                                                              |
| `kind`        | `mcp`, `plugin`, or `tool`.                                                                                   |
| `enabled`     | Saved availability choice; reset to `false` on import.                                                        |

Optional starting points are in [`examples/common-tools.json`](../examples/common-tools.json) and [`examples/pantry-demo.json`](../examples/pantry-demo.json). Neither installs anything. The Pantry example documents the author's private demo setup; the Pantry MCP implementation is not included. Keep any examples you cannot access disabled, or remove them.

## Use the routing module directly

Other applications can provide their own candidates to `route`. The input field is named `plugins` for compatibility; it accepts your tool definitions rather than a fixed set of services.

```js
import { route } from './src/router.mjs';

const result = await route({
  prompt: 'What did we settle on for the launch last week?',
  plugins: [
    {
      id: 'project-notes',
      name: 'Project Notes',
      mention: 'Project Notes',
      description: 'Search and read my project notes, meeting decisions, and launch briefs.',
    },
  ],
});

console.log(result.status, result.selected);
```

Set `TYPESAFE_API_KEY` before running this example. Pass only candidates the calling application can actually use. `route` returns the routing decision; the caller implements tool invocation. With no candidates it returns the original prompt without a TypeSafe request.
