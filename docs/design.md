# Routing contract

The application asks one Noul for whether the latest request needs any enabled plugin, plus one independent Noul per enabled plugin. All questions run in the same TypeSafe request. A Noul is a probability of yes, not an intensity score or a separate confidence value. Jev does not generate prompt text, tool names or explanations here. JavaScript composes the original text with exact catalog entries.

An overall probability <= 0.20 passes the prompt unchanged. An overall probability >= 0.80, at least one plugin >= 0.80, and no plugin in the uncertainty interval selects the matching plugins. Other outcomes hold for review. These are conservative demo thresholds, not validated universal operating points.

Multi-plugin requests can select several independent matches. No installed candidate means no invented mention. The catalog is explicit configuration, not an undocumented account API. Existing native mention nodes pass through, preserving manual choices.

The browser adapter intercepts Send, form submission and Enter. Shift+Enter, IME composition and an open listbox are left alone. It snapshots the draft and location before inference; edits or navigation cancel the pending result. Repeat sends during inference are swallowed. It uses the normal contenteditable input path and clicks the matching native picker entry; it does not fabricate a plugin DOM node on ChatGPT. If it cannot verify a chip, it holds. A partially inserted @ query can remain for the user to resolve; no automatic sending occurs in this state.

The companion returns literal @ suggestions for copying. A literal `@Google Drive` in pasted text is not proof of native plugin activation: select the matching result in ChatGPT's picker. ChatGPT still controls tool access, authentication, availability and action approvals.

## Current verification boundary

- Live TypeSafe HTTP integration: verified with synthetic prompts.
- Companion in a real browser: verified.
- Production content script, interception and native-node verification in a local test composer: verified.
- Unit DOM tests cover races, navigation, duplicate clicks, manual mentions, IME and Shift+Enter.
- Signed-in ChatGPT Chat/Work DOM compatibility: experimental and not verified in this release. The development browser's managed policy prevented unpacked-extension installation. Selectors and picker behavior may require updates.
- Native ChatGPT desktop: copy/paste companion only. No global keyboard hook or native pre-send interception is installed.

## Sources read

- [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt)
- [HTTP API](https://docs.typesafe.ai/api)
- [Noul](https://docs.typesafe.ai/primitives/noul)
- [Skill suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion)
- [Function calling cookbook](https://docs.typesafe.ai/cookbooks/function_calling)
- [Official ChatGPT plugin documentation](https://learn.chatgpt.com/docs/plugins)

The skill-suggestion cookbook informed the explicit candidate catalog and no-match behavior. This small six-plugin demo uses one request, rather than reproducing the cookbook's two-stage ranking for a large skill catalog.
