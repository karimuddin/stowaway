// Stowaway Service Worker — v1
// Strategy: cache-first for app shell, network-only for AI API calls

const CACHE_NAME = 'stowaway-v1';

const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon.svg',
  '/lib/storage.js',
  '/lib/stream.js',
  '/lib/systemPrompt.js',
  '/lib/renderUI.js',
  '/lib/markdown.js',
  '/adapters/providers.js',
  '/components/shared.js',
  '/components/KanbanBoard.js',
  '/components/BlockerList.js',
  '/components/ProgressRing.js',
  '/components/StandupSummary.js',
  '/components/TicketList.js',
  '/components/ChatBubble.js',
  '/components/VelocityChart.js',
  '/components/BurndownChart.js',
  '/components/EodSummary.js',
];

// External domains that must never be intercepted (AI API calls)
const PASSTHROUGH = [
  'openrouter.ai',
  'api.openai.com',
  'api.anthropic.com',
  'api.groq.com',
  'localhost:11434',
  'openai.azure.com',
  'aiplatform.googleapis.com',
];

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for shell, network-only for APIs ───────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Let AI API calls go straight to network — never cache or intercept
  if (PASSTHROUGH.some(domain => url.host.includes(domain))) return;

  // Only handle GET requests for our own origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses for our origin
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
