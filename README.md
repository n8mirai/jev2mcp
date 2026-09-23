# jev2mcp

A small intelligence layer that helps LLMs choose tools from context.

Describe the tools available in your account. Jev reads a prompt, optional context, and those descriptions; the application uses its probabilities to select tools, leave the prompt alone, or hold it for review. You can use your own custom tools as well as services available to other users.

![jev2mcp companion](artifacts/preview.png)

## What it does

- **ChatGPT browser extension:** checks a prompt before Send, selects matching entries in the native `@` picker, then resumes sending.
- **Local companion:** manage your tool catalog, inspect routing decisions, and copy suggestions for ChatGPT desktop.
- **Routing module:** accepts an explicit list of available tools and returns a decision using one TypeSafe request. It does not generate tool names or rewrite the request.

The catalog starts empty. jev2mcp does not discover your account's tools, install integrations, or connect directly to MCP servers. For the browser extension, a tool must already be connected to your ChatGPT account and appear in its native `@` picker. Labeling an entry “MCP server” describes the entry; it does not establish that connection.

Experimental. Native mention attachment has been demonstrated in signed-in ChatGPT Chat. Picker changes may require adapter updates. ChatGPT Work is unverified; native desktop support is a manual handoff.

## Run

Requires Node.js 22.13+ and a [TypeSafe API key](https://console.typesafe.ai/keys). There are no production npm dependencies. TypeSafe usage is billed separately from ChatGPT.

```sh
git clone https://github.com/n8mirai/jev2mcp.git
cd jev2mcp
```

Set the key for the current terminal, then start the companion. Use your secret manager if available; keep the key out of repository files.

**macOS / Linux:**

```sh
export TYPESAFE_API_KEY='your-key'
npm start
```

**Windows PowerShell:**

```powershell
$env:TYPESAFE_API_KEY = 'your-key'
npm start
```

Open `http://127.0.0.1:4328`.

## Configure your tools

1. Open **Tools** and add a tool you already use in ChatGPT.
2. Give it a display name, the exact name from ChatGPT's `@` picker, and a description of what it can do. The picker name has no leading `@`.
3. Enable it only after confirming it is available in your account. Add other tools as needed.
4. Try a prompt that needs one of those capabilities and inspect the routing result.

For example, a custom **Project Notes** tool could be described as “Search and read my project notes, meeting decisions, and launch briefs.” A request such as “What did we settle on for the launch last week?” can then be evaluated against that capability. Use the actual name and capabilities of your tool.

You can edit, remove, import, and export entries in **Tools**. Imports replace the catalog and start with every imported tool disabled. Existing valid saved catalogs keep their choices; upgrades do not append services. See the [catalog guide](docs/tool-catalog.md) for the JSON format and optional examples.

## Connect ChatGPT

1. Start the local companion and configure your tools.
2. In Chrome's extension settings, load `extension/` as an unpacked extension. Your browser must allow developer extensions.
3. Choose **Settings → Copy pairing package** in the companion.
4. Paste it into the jev2mcp extension's **Connection → Pairing package** field and select **Pair & enable**.
5. Reload ChatGPT, type a prompt, and send it.

The package includes only enabled tools. Re-pair after restarting the bridge or changing your catalog. Pairing with no tools enabled clears the extension's previous tool list; prompts then pass through unchanged. Context from the last four visible messages is optional and off by default.

For desktop, copy the companion's output and select the suggested entries in ChatGPT's `@` picker. Pasted `@` text alone does not activate a tool.

## Behavior

| Jev decision                      | Result                                        |
| --------------------------------- | --------------------------------------------- |
| No tools needed                   | Send the original prompt                      |
| Clear tool matches                | Attach the matching picker entries, then send |
| Uncertain, unavailable, or failed | Keep the draft for review                     |
| Draft edited during the check     | Discard the result                            |

The companion asks you to configure at least one enabled tool before checking a prompt. With an empty paired list, the extension passes prompts through unchanged. The routing module also returns the original prompt for an empty candidate list without a TypeSafe request.

The thresholds are experimental: ≤0.20 for no and ≥0.80 for yes. See the [routing contract](docs/design.md) for details. ChatGPT performs the selected tool calls and controls authentication and action approvals.

Prompts, enabled tool descriptions, and optional context are sent to TypeSafe. The API key stays in the local bridge; prompts are not logged. [Data and security](SECURITY.md).

## Demos

[Watch the Pantry + Instacart demo](artifacts/pantry-instacart-live-demo.mp4). **Pantry is the author's private custom MCP**, connected to the author's ChatGPT account for that recording. It is not included with jev2mcp and is not a service other users are expected to have. The video demonstrates routing to two configured capabilities; your catalog can contain entirely different tools. [Recording details](docs/pantry-demo.md).

An earlier [Google Drive demo](https://github.com/n8mirai/jev2mcp/releases/download/v0.2.1/jev2mcp-live-demo.mp4) demonstrates a connected document search. [Recording details](docs/demo.md).

## Development

```sh
npm ci
npm test       # deterministic routing, catalog, composer, and bridge tests
npm run eval   # synthetic live cases; requires a running bridge and TypeSafe key
```

`http://127.0.0.1:4328/fixture` runs the production content script against an explicitly labeled local test composer. It is not ChatGPT.

The [recorded evaluation](artifacts/live-evaluation.json) is historical sample data from a small synthetic catalog, including the author's Pantry demo. Its passing cases are a smoke check, not a measure of accuracy for your tools. A [CI template](docs/ci-example.yml) is included; GitHub Actions is not enabled.

```text
src/         Routing module and loopback bridge
extension/   ChatGPT adapter, pairing settings, shared catalog validation
public/      Companion and test composer
examples/    Optional catalog files; no integrations are installed
test/        Deterministic tests
scripts/     Live evaluation
```

[TypeSafe System One](https://docs.typesafe.ai/) · [Noul primitive](https://docs.typesafe.ai/primitives/noul) · [MIT](LICENSE)

Independent project. Not affiliated with OpenAI or TypeSafe.
