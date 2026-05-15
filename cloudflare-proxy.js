// Stowaway Cloudflare Worker — CORS proxy for deployed (non-localhost) version
// Deploy: wrangler deploy cloudflare-proxy.js --name stowaway-proxy
//
// Set STOWAWAY_PROXY_URL in your app's meta tags when deploying:
//   <meta name="proxy-url" content="https://stowaway-proxy.YOUR-SUBDOMAIN.workers.dev">
//
// The browser uses this URL as a prefix for AI API calls.
// Local dev (localhost) does NOT use this proxy — CORS is unrestricted on localhost.

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    const url  = new URL(request.url);
    const dest = url.searchParams.get('target'); // ?target=https://api.openai.com/...

    if (!dest) return new Response('Missing ?target param', { status: 400 });

    // Whitelist — only proxy known AI providers
    const allowed = [
      'api.openai.com',
      'api.anthropic.com',
      'openrouter.ai',
      'api.groq.com',
    ];
    const destHost = new URL(dest).hostname;
    if (!allowed.some(h => destHost.endsWith(h))) {
      return new Response(`Target not allowed: ${destHost}`, { status: 403 });
    }

    // Forward the request
    const upstream = await fetch(dest, {
      method:  request.method,
      headers: forwardHeaders(request.headers),
      body:    request.method !== 'GET' ? request.body : undefined,
    });

    // Stream the response back with CORS headers
    return new Response(upstream.body, {
      status:  upstream.status,
      headers: { ...Object.fromEntries(upstream.headers), ...corsHeaders(request) },
    });
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, HTTP-Referer, X-Title',
    'Access-Control-Max-Age':       '86400',
  };
}

function forwardHeaders(headers) {
  const out = {};
  for (const [k, v] of headers.entries()) {
    // Skip hop-by-hop headers
    if (['host', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for'].includes(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}
