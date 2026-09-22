# Data and security

- The Node bridge binds only to `127.0.0.1:4328`. Do not expose it publicly.
- The TypeSafe API credential is read from the server process environment. On the original Mac, the supplied launcher uses an existing Keychain helper. Elsewhere it can prompt for an ephemeral key; nothing is written into the extension or repository.
- The extension is restricted to `https://chatgpt.com/*`; it has storage and loopback bridge permissions, not general browsing or cookie access.
- Each bridge startup rotates a random pairing token, written only under ignored `.local/` with mode 0600. Re-pair after restarting. Treat the pairing package as a local session secret.
- The HTTP bridge checks Host, Origin, JSON content type, request size, authentication, concurrency and timeout. Cross-site origins cannot call it; extension origins still require pairing. Local processes are in the trust boundary.
- Only submitted prompt text, enabled plugin descriptions, and optional context are sent to TypeSafe. Chat history inclusion is off by default and bounded to four visible messages / 6,000 characters. Attached files are not read.
- Prompts are not logged or stored by the bridge. The UI holds the active prompt in memory. Enabled plugin configuration is saved in localStorage / extension storage. Synthetic evaluation artifacts are intentionally saved in the repository.
- Model results cannot grant permissions or execute tools. ChatGPT handles the actual plugin invocation and any tool-specific permissions. The extension does not modify browser policies.

Please report vulnerabilities privately using the repository owner's GitHub contact options. Do not include credentials or private prompts in public issues.
