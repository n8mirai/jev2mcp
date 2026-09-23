# Indirect Pantry + Instacart demo

The original [demo post](https://x.com/n8mirai/status/2102479357189214645) shows Jev deciding which tools to inject before a ChatGPT prompt is sent. This follow-up shows the same live ChatGPT flow with a request that does not name either tool or ask for a cart.

[Watch the 23-second live recording](../artifacts/pantry-instacart-live-demo.mp4).

## Prompt

> ugh 6am shifts all week. egg sandwiches would save me but do we even have eggs? bread? i swear i saw coffee somewhere and last time i came home with rice we already had. can you sort the morning situation out and tee up whatever is actually missing so i can check it before paying? pls do not place an order.

## Pass criteria

1. Record the actual ChatGPT composer as this prompt is typed and sent.
2. Show the extension's Jev overlay deciding whether tools are needed and selecting Pantry and Instacart.
3. Show both native `@` picker entries attached to the prompt before it is sent.
4. Show ChatGPT checking the recorded food inventory, then using Instacart to queue only missing breakfast items for review. Stop before checkout.
5. Keep the video to the browser interaction and its overlay, with clean cuts and no presentation slides.

## Live routing result

On September 22, 2026, Jev returned 0.97 for needing tools, 0.95 for Pantry, and 0.94 for Instacart in 209 ms. It selected both for this indirect prompt. All ten cases in the [live smoke evaluation](../artifacts/live-evaluation.json) passed.

## Recorded ChatGPT run

In the signed-in ChatGPT Chat run, the extension checked the prompt with Jev in 266 ms and attached native Pantry and Instacart mentions (95% each). ChatGPT made four Pantry inventory lookups. It found coffee and rice in tracked inventory and no eggs or bread, then added one package of Publix Large Eggs and one Publix Bakery Sourdough Round to the Publix cart for review. The cart subtotal was $8.18. No order was placed. The pantry snapshot was stale, so ChatGPT identified these as missing from the recorded inventory rather than guaranteed absent from the kitchen.

The video uses frames captured directly from that ChatGPT tab. Typing is sped up, routing frames are held so the decision and native picker are legible, and idle waits are cut. The precise delivery address is hidden. There are no simulated tool calls or added presentation slides.
