import { PROVIDERS } from '../adapters/providers.js';

export async function streamAI({ provider, apiKey, model, messages, onChunk, onDone, onError }) {
  const adapter = PROVIDERS[provider];
  if (!adapter) return onError(`Unknown provider: ${provider}`);

  // Anthropic requires system as a top-level param, not inside messages array
  let systemContent = null;
  let chatMessages = messages;
  if (provider === 'anthropic') {
    const sys = messages.find(m => m.role === 'system');
    systemContent = sys?.content || null;
    chatMessages = messages.filter(m => m.role !== 'system');
  }

  let response;
  try {
    response = await fetch(adapter.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adapter.headers(apiKey) },
      body: JSON.stringify(adapter.body(chatMessages, model, systemContent))
    });
  } catch (e) {
    return onError('Network error — check your connection and API key.');
  }

  if (!response.ok) {
    let errText = '';
    try { errText = await response.text(); } catch {}
    const msg = parseApiError(response.status, errText, provider);
    return onError(msg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // hold last incomplete line

      for (const line of lines) {
        const clean = line.replace(/^data:\s*/, '').trim();
        if (!clean) continue;
        try {
          const chunk = adapter.parse(clean);
          if (chunk === null) {
            onDone(fullText);
            return;
          }
          if (chunk) {
            fullText += chunk;
            onChunk(chunk);
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } catch (e) {
    return onError(`Stream interrupted: ${e.message}`);
  }

  onDone(fullText);
}

function parseApiError(status, body, provider) {
  // Always surface the actual API error message first — generic fallbacks hide real causes
  try {
    const json = JSON.parse(body);
    const msg = json.error?.message || json.error?.metadata?.raw || json.message;
    if (msg) return `${provider} (${status}): ${msg}`;
  } catch {}

  if (status === 401) return `Invalid API key for ${provider}. Check your key in Settings.`;
  if (status === 402) return `No credits on ${provider}. Add billing or switch to a free model.`;
  if (status === 429) return `Rate limited by ${provider}. Try a different model or wait 30s.`;
  if (status === 503) return `${provider} is overloaded. Try again in a moment.`;
  return `API error ${status} from ${provider}. Open DevTools → Network for the full response.`;
}
