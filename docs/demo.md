# Live ChatGPT demo

Recorded September 22, 2026 in signed-in Chrome with the unpacked extension and a local TypeSafe bridge.

Google Drive was already connected to the recording account and explicitly configured in the tool catalog. New installations start with an empty catalog; this demo does not imply access to Google Drive or to the author's files. [Configure tools available in your account](tool-catalog.md).

Prompt:

> Find "jev2mcp demo notes" in my Google Drive and list its three checklist items.

Jev returned a 0.97 probability that tools were needed and 0.98 for Google Drive. The TypeSafe request took 615 ms. The extension selected the native Google Drive picker entry and resumed Send once. ChatGPT searched Drive and returned the actual document's three items: write a prompt, select tools, send.

The document was created for this demo in an earlier successful run. No existing personal document content is shown. The configured tool catalog is not automatic account discovery.

## Editing

The video uses continuous screen-capture footage of the actual interaction. Browser chrome and the account sidebar are cropped out. Typing and routing are slowed for readability, idle waits are cut, and a duplicate stationary cursor overlay is removed. The moving pointer is the recorded browser pointer. Titles and a gentle zoom are added in editing. The prompt, selection, native mention, tool call, and answer are real.

The published extension positions its status panel above the bottom composer controls; the recording predates that placement adjustment. ChatGPT Work and native desktop interception are not demonstrated.

[Video and extension download](https://github.com/n8mirai/jev2mcp/releases/tag/v0.2.1)
