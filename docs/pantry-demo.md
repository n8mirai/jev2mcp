# Pantry + Instacart routing demo

This follow-up to the [original demo post](https://x.com/n8mirai/status/2102479357189214645) tests whether Jev routes a less tidy request to two tools. The [29-second video](../artifacts/jev2mcp-pantry-instacart-demo.mp4) is an edited visualization of recorded API results, not a continuous ChatGPT screen capture.

## Prompt

> Okay, this is scattered: I need breakfasts for next week, probably egg sandwiches and coffee, but do not make me buy things already in the kitchen. I also thought we were out of rice and canned tomatoes, though I may be wrong. Check the recorded pantry first, then put only the missing breakfast basics plus any genuinely low staples in a grocery cart for me to review. Do not check out.

## Recorded outcome

On September 22, 2026, one live TypeSafe request returned **0.97** for needing tools, **0.98** for Pantry, and **0.96** for Instacart in **233 ms**. jev2mcp selected both. The full ten-case smoke run passed and is saved in [`artifacts/live-evaluation.json`](../artifacts/live-evaluation.json).

The Pantry connector found rice, canned tomatoes, and coffee in the recorded inventory. Eggs and bread were not recorded. The underlying complete snapshot was dated August 17, 2026, with later additions and consumption updates; absence from the record does not prove absence from the kitchen. The video frames that distinction as “not recorded.”

The Instacart cart was verified to contain one Publix Eggs, Large and one Publix Bakery Sourdough Round Bread. The initial cart action returned an error even though the items were added, so the cart was read again to confirm its state. No checkout occurred.

This run verifies Jev's two-tool selection and the downstream inventory/cart actions. It does not verify native ChatGPT `@` picker attachment for these two plugins; the [original live demo](demo.md) covers native attachment with Google Drive.
