# Indirect Pantry + Instacart demo

This is a recording of the author's configured account. **Pantry is the author's private custom MCP**, backed by their food inventory. Its server, account connection, and inventory are not included with jev2mcp. Instacart was also connected in that account. Neither is enabled by default for new users.

For your own setup, [configure the tools you have](tool-catalog.md). The optional [`examples/pantry-demo.json`](../examples/pantry-demo.json) describes this recording's two capabilities; importing it does not install or grant access to either tool. Any similarly described tools can be routing candidates, with the names and capabilities you supply.

The original [demo post](https://x.com/n8mirai/status/2102479357189214645) shows Jev deciding which tools to inject before a ChatGPT prompt is sent. This follow-up shows the same live ChatGPT flow with a request that does not name either tool or ask for a cart.

[Watch the 28-second motion edit of the real ChatGPT run](../artifacts/pantry-instacart-live-demo.mp4).

## Prompt

> ugh 6am shifts all week. egg sandwiches would save me but do we even have eggs? bread? i swear i saw coffee somewhere and last time i came home with rice we already had. can you sort the morning situation out and tee up whatever is actually missing so i can check it before paying? pls do not place an order.

## Pass criteria

1. Record the actual ChatGPT composer as this prompt is typed and sent.
2. Show the extension's Jev overlay deciding whether tools are needed and selecting Pantry and Instacart.
3. Show native picker selection and both attached mentions in the sent prompt.
4. Show ChatGPT checking the recorded food inventory, then using Instacart to queue only missing breakfast items for review. Stop before checkout.
5. Use focused motion and concise annotations to make the request, routing decision, and cart outcome readable.

## Live routing result

On September 22, 2026, Jev returned 0.97 for needing tools, 0.95 for Pantry, and 0.94 for Instacart in 209 ms. It selected both for this indirect prompt. The [historical smoke evaluation](../artifacts/live-evaluation.json) records the synthetic cases used with that catalog. These results do not measure routing accuracy for other users' tools.

## Recorded ChatGPT run

In the signed-in ChatGPT Chat run, the extension checked the prompt with Jev in 266 ms and attached native Pantry and Instacart mentions (95% each). ChatGPT made four Pantry inventory lookups. It found coffee and rice in tracked inventory and no eggs or bread, then added one package of Publix Large Eggs and one Publix Bakery Sourdough Round to the Publix cart for review. The cart subtotal was $8.18. No order was placed. The pantry snapshot was stale, so ChatGPT identified these as missing from the recorded inventory rather than guaranteed absent from the kitchen.

The 1920 × 1080, 60 fps video is a motion edit of frames captured directly from that ChatGPT tab. It speeds up typing, removes idle waits, magnifies the real Jev overlay, and follows native picker selection into the sent message. The route diagram, inventory labels, moving ingredient markers, and final review status are authored annotations of the observed result; they are not native product UI. The inventory annotation preserves the stale-snapshot caveat. The precise delivery address is hidden. Sound cues are original synthesis. No tool calls or cart results are simulated.
