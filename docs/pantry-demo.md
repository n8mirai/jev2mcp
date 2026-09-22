# Indirect Pantry + Instacart demo

The original [demo post](https://x.com/n8mirai/status/2102479357189214645) shows Jev deciding which tools to inject before a ChatGPT prompt is sent. This follow-up should show the same live ChatGPT flow with a request that does not name either tool or ask for a cart.

## Prompt

> ugh 6am shifts all week. egg sandwiches would save me but do we even have eggs? bread? i swear i saw coffee somewhere and last time i came home with rice we already had. can you sort the morning situation out and tee up whatever is actually missing so i can check it before paying? pls do not place an order.

## Pass criteria

1. Record the actual ChatGPT composer as this prompt is typed and sent.
2. Show the extension's Jev overlay deciding whether tools are needed and selecting Pantry and Instacart.
3. Show both native `@` picker entries attached to the prompt before it is sent.
4. Show ChatGPT checking the recorded food inventory, then using Instacart to queue only missing breakfast items for review. Stop before checkout.
5. Keep the video to the browser interaction and its overlay, with clean cuts and no presentation slides.

The previous [routing smoke test](../artifacts/live-evaluation.json) used an explicit instruction to check the recorded pantry and build a grocery cart. Its result cannot be used as proof that Jev understands this indirect prompt. The new case is in `scripts/evaluate.mjs` and needs a fresh live TypeSafe run.
