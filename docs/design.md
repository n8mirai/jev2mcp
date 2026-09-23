# jev2mcp routing contract

The application asks one Noul for whether the latest request needs any available tool, plus one independent Noul per candidate. All questions run in the same TypeSafe request. A Noul is a probability of yes, not an intensity score or a separate confidence value. Jev does not generate prompt text, tool names or explanations here. JavaScript composes the original text with exact catalog entries. The routing module accepts candidates in `route({ prompt, plugins, context, surface })`; `plugins` is the existing API field name, not a fixed list of services.

An overall probability <= 0.20 passes the prompt unchanged. An overall probability >= 0.80, at least one plugin >= 0.80, and no plugin in the uncertainty interval selects the matching plugins. Other outcomes hold for review. These are conservative demo thresholds, not validated universal operating points.

Requests can select several independent matches. With no candidates, the router returns the original prompt without a TypeSafe request. No candidate means no invented mention. The catalog is explicit configuration, not an undocumented account API. Existing native mention nodes pass through, preserving manual choices.

## Catalog and availability

A fresh companion starts with an empty catalog. Users add, edit, remove, enable, import, and export their own entries. Valid saved settings retain their entries and enabled choices on upgrade; defaults are never appended. Optional example files are separate from runtime configuration. Pantry in the recorded demo is the author's custom MCP, not a built-in integration.

Catalog imports use `{ "version": 1, "tools": [...] }`. The whole import is validated before replacing the current list, and all imported entries start disabled. Each entry supplies an ID, display name, exact picker name, capability description, type label, and enabled choice. See the [catalog guide](tool-catalog.md).

Enabled entries represent the user's stated availability. The browser adapter verifies a matching native picker entry at attachment time. The companion cannot verify installed tools, and neither component discovers or connects to MCP servers. Pairing copies only enabled entries to the extension; catalog changes require pairing again. Pairing an empty list clears its previous snapshot and lets prompts pass through unchanged. The companion itself opens tool setup when asked to check a prompt without enabled tools.

## Attachment

The browser adapter intercepts Send, form submission and Enter. Shift+Enter, IME composition and an open listbox are left alone. It snapshots the draft and location before inference; edits or navigation cancel the pending result. Repeat sends during inference are swallowed. It uses the normal contenteditable input path and clicks the matching native picker entry; it does not fabricate a plugin DOM node on ChatGPT.

If attachment fails, the adapter holds the draft and restores the original text when its own changes can be safely undone. If the user edited the draft or restoration cannot be verified, a partial attachment may remain for review. Retry cannot treat those leftover chips as a successful manual selection and bypass the hold. The user can inspect the draft and explicitly choose **Send as shown**.

The companion returns literal @ suggestions for copying. A literal `@Google Drive` in pasted text is not proof of native plugin activation: select the matching result in ChatGPT's picker. ChatGPT still controls tool access, authentication, availability and action approvals.

## Current verification boundary

- Live TypeSafe HTTP integration: verified with synthetic prompts.
- Companion in a real browser: verified.
- Production content script, interception and native-node verification in a local test composer: verified.
- Unit DOM tests cover races, navigation, duplicate clicks, manual mentions, IME and Shift+Enter.
- Signed-in ChatGPT Chat: verified on September 22, 2026. Jev selected Google Drive, the adapter attached a native mention, and ChatGPT created and then retrieved a synthetic demo document. The adapter recognizes roleless plugin rows and native automatic mention resolution; same-provider file results are excluded. Selectors may require updates as ChatGPT changes.
- ChatGPT Work: not yet verified.
- Native ChatGPT desktop: copy/paste companion only. No global keyboard hook or native pre-send interception is installed.

## Sources read

- [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt)
- [HTTP API](https://docs.typesafe.ai/api)
- [Noul](https://docs.typesafe.ai/primitives/noul)
- [Skill suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion)
- [Function calling cookbook](https://docs.typesafe.ai/cookbooks/function_calling)
- [Official ChatGPT plugin documentation](https://learn.chatgpt.com/docs/plugins)

The skill-suggestion cookbook informed the explicit candidate catalog and no-match behavior. The current router evaluates up to 24 supplied candidates in one request. It does not implement a preliminary retrieval stage for larger catalogs.

## Interface

jev2mcp is a companion for AI power users. The main view has one prompt, optional context, and one action. Tool configuration and routing details are separate. The neutral palette and restrained typography follow the visual simplicity of ChatGPT; the project uses its own name and icon.

Catalog entries may be labeled as MCP servers, plugins, or tools. These labels organize the configuration; they do not add an MCP transport. The current adapter attaches entries exposed in ChatGPT’s native picker.
