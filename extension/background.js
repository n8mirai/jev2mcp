chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type !== 'jev-route') return;
  if (!sender.tab || new URL(sender.tab.url).origin !== 'https://chatgpt.com') {
    respond({ error: 'Unsupported tab' });
    return;
  }
  (async () => {
    const settings = await chrome.storage.local.get([
      'token',
      'plugins',
      'enabled',
      'contextEnabled',
    ]);
    if (!settings.enabled) return { disabled: true };
    if (!settings.token) throw new Error('Open Jev Router and pair with the local companion.');
    const response = await fetch('http://127.0.0.1:4328/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jev-Token': settings.token },
      body: JSON.stringify({
        prompt: msg.prompt,
        context: settings.contextEnabled ? msg.context : '',
        plugins: settings.plugins || [],
        surface: 'chatgpt-web',
      }),
      signal: AbortSignal.timeout(23000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Bridge unavailable');
    return result;
  })()
    .then(respond)
    .catch((error) => respond({ error: error.message }));
  return true;
});
