# Data and security

- The Node bridge binds only to `127.0.0.1:4328`. Do not expose it publicly.
- The TypeSafe API credential is read from `TYPESAFE_API_KEY` in the server process environment. It is not included in catalog exports or extension pairing packages. The optional macOS launcher can use an existing Keychain helper or prompt for a key for the current process.
- The extension is restricted to `https://chatgpt.com/*`; it has storage and loopback bridge permissions, not general browsing or cookie access.
- Each bridge startup rotates a random pairing token, written under ignored `.local/`. The file is created with mode 0600 where supported; Windows access follows the directory's permissions. Re-pair after restarting. Treat the pairing package as a local session secret.
- The HTTP bridge checks Host, Origin, JSON content type, request size, authentication, concurrency and timeout. Cross-site origins cannot call it; extension origins still require pairing. Local processes are in the trust boundary.
- Only submitted prompt text, enabled tool descriptions, and optional context are sent to TypeSafe. Chat history inclusion is off by default and bounded to four visible messages / 6,000 characters. Attached files are not read.
- Prompts are not logged or stored by the bridge. The UI holds the active prompt in memory. Tool configuration is saved in browser localStorage; the extension stores its paired configuration. Catalog exports contain the descriptions you entered, so inspect them before sharing. Do not put secrets in tool descriptions.
- A new catalog is empty. Importing a catalog replaces the saved list and disables imported tools. Availability is a user choice, then checked against ChatGPT's native picker during attachment; a catalog entry is not proof of installed access. Only enabled entries go into the pairing package. Re-pair after catalog changes.
- Model results cannot grant permissions or execute tools. ChatGPT handles the actual invocation and any tool-specific permissions. jev2mcp does not connect to MCP servers or modify browser policies.
- Example catalogs and historical synthetic evaluation artifacts are intentionally public. Pantry in the demo is the author's custom MCP; its server and inventory are not bundled with this repository.

Please report vulnerabilities privately using the repository owner's GitHub contact options. Do not include credentials or private prompts in public issues.
