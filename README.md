# Jev Relay

**A little intelligence, right before Send.**

A local-first prototype that asks TypeSafe's Jev: _does this prompt need one of my enabled ChatGPT plugins?_ If yes, it selects the relevant `@` mentions; ordinary questions stay unchanged.

![Live Jev routing email and calendar together](artifacts/preview.png)

[Watch the narrated demo](https://github.com/n8mirai/jev-relay/releases/latest) · [Design and sources](docs/design.md) · [Privacy](SECURITY.md)

## What works

- **Live Jev routing:** typed Noul judgments, multi-plugin selection, visible probabilities, measured request latency and token usage.
- **Chrome extension:** intercepts Enter / Send, waits for the decision, attaches through the native plugin picker, then resumes sending. Uncertainty, stale drafts and API failures hold the prompt.
- **Desktop companion:** route a prompt, copy the result, then select its plugins in the native ChatGPT `@` picker and send.
- **Local integration lab:** exercises the production extension content script with real Jev calls and a test composer. It does not simulate a ChatGPT response or read account data.

**Release status:** experimental. Live Jev, the companion and the local integration lab are verified. Signed-in ChatGPT Chat/Work injection has **not** been verified: the development browser's managed policy blocked unpacked installation. Native desktop support is an explicit copy/paste handoff, not automatic interception. Literal pasted `@` text alone does not guarantee plugin activation.

## Run

Requires Node.js 22.13+ and a [TypeSafe API key](https://console.typesafe.ai/keys). There are **no production npm dependencies**. TypeSafe calls use your TypeSafe balance, independently of ChatGPT usage.

```sh
git clone https://github.com/n8mirai/jev-relay.git
cd jev-relay
# Supply TYPESAFE_API_KEY through your environment / secret manager.
npm start
```

Open `http://127.0.0.1:4328`. On macOS, double-click **Run Jev Router.command** instead. It uses the existing TypeSafe skill Keychain helper when present, or asks for a key with hidden input for this process only.

The starter catalog is an example, not account discovery. Under **Your plugins**, disable anything you do not have and add custom plugins using their exact picker names.

## Use the extension

1. Start the bridge. In a browser that allows developer extensions, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked → extension/**.
2. In the companion, choose **Setup → Copy pairing package**.
3. Open the Jev extension popup, paste the package, and select **Pair & enable**.
4. Reload ChatGPT. Type a prompt and press Send. Jev holds the send while checking; the panel shows its decision.
5. Optional: enable the last four visible chat messages as context in the popup. It is off by default.

Re-pair after restarting the bridge or changing your enabled catalog. If a native picker entry cannot be verified, resolve the visible draft manually. Use the popup toggle to disable routing. Do not weaken a managed browser policy to install this demo.

## Try the end-to-end lab

Open `http://127.0.0.1:4328/fixture` and click **Document request → Send prompt**. The same extension adapter calls Jev, inserts a mention using the test picker's interaction, verifies its native node, and submits exactly once to the local transcript. Try **Plain question** and **Two plugins** as well. The page is clearly labeled as a fixture.

## Verification

19 deterministic tests cover routing, composer behavior and the loopback bridge. A [GitHub Actions template](docs/ci-example.yml) is included; copy it to `.github/workflows/test.yml` if desired. CI is not enabled in this release.

```sh
npm ci
npm test       # deterministic tests; no API key or paid calls
npm run eval   # eight synthetic live cases; running bridge required
```

The recorded evaluation used `jev-1.13.0`: seven cases resolved automatically as expected; one unavailable Slack request was conservatively held for review. All eight satisfied their expected behavior. This is a smoke evaluation, not a general accuracy estimate. See [actual probabilities, timing and usage](artifacts/live-evaluation.json).

The video is a narrated walkthrough assembled from actual live UI captures. It distinguishes the companion, local integration lab and native desktop handoff. No mock output is labeled as live ChatGPT execution.

## Structure

```text
src/router.mjs         Typed questions, validation and deterministic routing
src/server.mjs         Authenticated loopback bridge; no prompt logging
src/catalog.mjs        Editable starter catalog
extension/             Manifest V3 extension and native picker adapter
public/                Companion and explicitly labeled integration fixture
test/                  Routing contracts and composer race tests
scripts/evaluate.mjs   Live synthetic smoke evaluation
artifacts/             Evaluation evidence and demo media
```

Built with [TypeSafe System One](https://docs.typesafe.ai/) and the [Noul primitive](https://docs.typesafe.ai/primitives/noul). Independent experiment; not affiliated with OpenAI or TypeSafe. MIT licensed.
