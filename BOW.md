# Stowaway — Book of Work

> Living document. Updated as decisions are made and features ship.
> Last updated: 2026-05-15

---

## 1. Project Overview

**Stowaway** is a local-first, AI-powered project manager for solo developers and indie hackers.

The core innovation is **Generative UI**: the AI doesn't navigate you to a fixed page — it renders the right interface in response to every prompt. Ask "what's blocking me?" and a `BlockerList` appears. Ask "how close am I to launch?" and a `ProgressRing` renders. The interface *is* the answer.

**Design principles:**
- Free forever — no subscriptions, no paywalls
- Bring Your Own Key (BYOAK) — users supply their own AI API key
- Zero infrastructure — no database, no backend, no server to maintain
- Provider-agnostic — works with OpenRouter (200+ models), OpenAI, Anthropic, Groq, Ollama
- Local-first — runs on localhost; deploy to Vercel/Netlify as optional
- Open source — MIT licensed

---

## 2. What's Shipped

### MVP (2026-05-15)

| Feature | Status |
|---|---|
| 4-step onboarding (project info → provider → model → API key → scaffold) | ✅ |
| AI scaffold generation — 8–10 realistic tickets + 2 milestones | ✅ |
| Generative UI routing (9 components) | ✅ |
| KanbanBoard — tickets grouped by status, drag & drop | ✅ |
| BlockerList — blocked tickets with dependency display | ✅ |
| ProgressRing — SVG ring + milestone breakdown | ✅ |
| StandupSummary — daily priorities with milestone due date banner | ✅ |
| TicketList — create/view/update tickets | ✅ |
| ChatBubble — general AI response with markdown | ✅ |
| VelocityChart — 6-week SVG bar chart (completed vs created) | ✅ |
| BurndownChart — SVG line chart (actual vs ideal, health indicator) | ✅ |
| EodSummary — shipped / in-progress / created today | ✅ |
| Provider adapters: OpenRouter, OpenAI, Anthropic, Groq, Ollama | ✅ |
| OpenRouter model picker in onboarding (10 models, free tier highlighted) | ✅ |
| Token-by-token streaming engine | ✅ |
| Session-memory API key (never persisted) | ✅ |
| Action buttons (direct mutations + nav, no AI request consumed) | ✅ |
| localStorage multi-project storage (index + per-project + per-project chat) | ✅ |
| Auto-migration from legacy single-project format | ✅ |
| Project switcher modal with due date tags | ✅ |
| Settings modal (provider, model, key, export, import, reset) | ✅ |
| JSON export / import with schema validation | ✅ |
| GitHub Issues export | ✅ |
| Linear export (GraphQL) | ✅ |
| Notion export | ✅ |
| Chat history persistence (50 AI messages, 100 display messages per project) | ✅ |
| Markdown rendering in chat (safe DOM-based parser, zero innerHTML) | ✅ |
| Inline ticket editor (drawer, all fields, Cmd+Enter to save) | ✅ |
| Kanban drag & drop (HTML5, custom event bus, dragleave fix) | ✅ |
| Keyboard shortcuts (B, S, P, V, D, E, /, ?, Cmd+K, Cmd+F, Esc) | ✅ |
| Search + filter (Cmd+F, real-time, per-column empty state) | ✅ |
| Due date awareness — milestone badge, standup banner | ✅ |
| Individual ticket due dates — editor field, kanban card badges | ✅ |
| PWA — manifest, service worker (cache-first shell, network-only AI) | ✅ |
| Local API server (port 3748) — git branch, MCP context | ✅ |
| MCP JSON-RPC endpoint (get_active_task, list_tickets, update_ticket_status) | ✅ |
| Git branch polling — auto-suspend in-progress ticket on branch switch | ✅ |
| Background heartbeat — re-polls git + MCP on tab focus (Page Visibility API) | ✅ |
| CLI launcher (`npx stowaway-pm`) — starts servers, opens browser | ✅ |
| Cloudflare CORS proxy for hosted deployment | ✅ |
| EOD auto-trigger after 4 hours of session activity | ✅ |
| Request limit (30/session) with visible counter | ✅ |
| Prompt injection sanitization (`<project_data>` delimiter + regex strips) | ✅ |
| XSS prevention — textContent only, zero innerHTML with user data | ✅ |

### Bugs Fixed
| Bug | Fix |
|---|---|
| BurndownChart yScale inverted (chart rendered upside down) | Corrected to `MT + chartH - (v/total)*chartH` |
| `tryParseScaffold` failed on code-fence-wrapped AI responses | Strip ` ``` ` before JSON extraction |
| Suspended tickets invisible on kanban (no column) | Added conditional `Suspended` column |
| `daysUntil()` returned `NaN` for invalid date strings | `isNaN` guard before arithmetic |
| Dead `full` accumulator variable in `generateScaffold` | Removed |
| Fallback AI message not length-capped | Truncated to 400 chars |
| OpenRouter `body()` fallback model mismatched `defaultModel` | Aligned to `deepseek-v4-flash:free` |
| `completedAt` not cleared when reopening a done ticket | All three mutation paths now set `completedAt = null` on non-done status |
| AI unaware of `dueDate` field and `suspended` status | Both documented in system prompt |
| Duplicate `display:none` on scaffold error actions | Removed |
| `innerHTML` in `appendThinking` | Replaced with DOM methods |
| OpenRouter 429 body hidden behind generic message | `parseApiError` surfaces body first |
| Send button stuck disabled on error | `finishStreaming` restores text + enabled state |

---

## 3. Remaining / Future Work

### V1.2 Ideas
| Feature | Effort | Notes |
|---|---|---|
| Request counter reset button in settings | 30 min | UX: currently requires page refresh |
| Mobile responsive layout | 1 day | Untested on mobile; needs touch DnD |
| AI-returned milestone mutations applied to `projectData` | 2 hours | Currently only ticket mutations are applied |
| Import from GitHub Issues / Linear | 1 day | Seed Stowaway from existing project |
| Background file-watcher time tracking | 1 day | `chokidar` + git diff as proof-of-work |
| Optional Supabase sync | 2 days | Multi-device without giving us data |
| Filesystem DB (`~/.stowaway/`) | 1 day | localStorage has 5MB cap |

---

## 4. Architecture Decisions

### 4.1 Tech Stack: Vanilla HTML + CSS + JS
**Decision:** No framework. Zero npm dependencies at runtime.
**Rationale:** Ships as a directory of files; no build step. Every line readable and forkable.
**Trade-off:** More verbose DOM code. Acceptable for this scope.

### 4.2 ES Modules
**Decision:** `import`/`export` with `<script type="module">`.
**Implication:** Requires serving via HTTP (not `file://`). The CLI handles this automatically.

### 4.3 Multi-Project Storage
**Decision:** `stowaway_index` (lightweight list) + `stowaway_project_<id>` per project + `stowaway_chat_<id>` per project.
**Migration:** `migrate()` auto-migrates the legacy single-key format on first load.

### 4.4 API Key: Session Memory Only
**Decision:** Key lives in `SESSION` object in JS memory. Never written to localStorage, cookies, or disk.
**Trade-off:** Re-enter each session. This is the correct trade-off for security.

### 4.5 Provider Adapter Pattern
**Decision:** All AI providers normalised into `PROVIDERS` map with `url`, `headers`, `body`, `parse`.
**Anthropic special case:** Requires `system` as top-level param. `stream.js` extracts it before calling the adapter.

### 4.6 Generative UI Pattern
**Decision:** AI always returns `{ ui, data, message, actions }`. The `ui` key routes to one of 9 components.
**Fallback:** `safeParseAIResponse` falls back to `{ ui: 'chat' }` on parse failure.
**Direct render:** `renderDirect(uiType)` bypasses AI entirely for keyboard shortcuts + action buttons.

### 4.7 DOM Safety: textContent Only
**Decision:** All user/AI data written via `textContent`, never `innerHTML`.
**Exception:** `appendThinking()` uses DOM methods for the static dots indicator (no user data).
**Markdown:** Safe DOM-based parser — all nodes created via `createElement`/`createTextNode`.

### 4.8 Prompt Injection Defence
**Decision:** Project data wrapped in `<project_data>` delimiters + `sanitizeForPrompt()` strips known injection patterns. Explicit instruction in system prompt to treat delimiter content as data only.

### 4.9 Chat History: Two Arrays
**Decision:** `chatHistory[]` (raw AI messages, includes full JSON responses) separate from `displayMessages[]` (text-only, for DOM restore).
**Why:** AI responses are raw JSON blobs. Display shows only the `message` field. Restoring from one array would show JSON noise.

### 4.10 Custom Events for Kanban DnD
**Decision:** `KanbanBoard` fires `ticket-moved` CustomEvent bubbling to `app.js`. Component stays data-agnostic.
**Why:** Keeps components free of direct `projectData` references — they receive data, render UI, fire events.

### 4.11 Background Heartbeat
**Decision:** `visibilitychange` event re-polls git branch and pushes MCP context when tab comes back into focus.
**Why:** 8-second `setInterval` continues while tab is hidden; the visibility hook ensures immediate sync on return.

---

## 5. Design Decisions

### 5.1 Layout: Split Pane (Chat left, UI right)
### 5.2 Dark Theme as Default (zinc/slate base, indigo accent)
### 5.3 Onboarding: AI-Generated Scaffold (8–10 realistic tickets)
### 5.4 Request Limit: 30/session with counter (prevents runaway API spend)
### 5.5 Action Buttons: Direct mutations consume no requests
### 5.6 Suspended column: conditional — only rendered when suspended tickets exist
### 5.7 completedAt: set on done, cleared on any reopen (velocity accuracy)

---

## 6. File Structure

```
stowaway/
├── index.html              ← Entry point, onboarding, app shell, all modals
├── style.css               ← All styles (~815 lines), dark theme, responsive
├── app.js                  ← State, event handlers, orchestration (~1250 lines)
├── adapters/
│   └── providers.js        ← OpenRouter, OpenAI, Anthropic, Groq, Ollama adapters
├── lib/
│   ├── storage.js          ← Multi-project localStorage + export/import + migration
│   ├── stream.js           ← Streaming engine + error parsing
│   ├── systemPrompt.js     ← System prompt builder + sanitizer
│   ├── renderUI.js         ← Generative UI router + safe JSON parser
│   └── markdown.js         ← Safe DOM-based markdown parser (no innerHTML)
├── components/
│   ├── shared.js           ← el(), createHeader(), createActionButtons(), daysUntil()
│   ├── KanbanBoard.js      ← Kanban with drag & drop, due date badges, suspended column
│   ├── BlockerList.js      ← Blocked tickets with dependency display
│   ├── ProgressRing.js     ← SVG ring + milestone breakdown
│   ├── StandupSummary.js   ← Daily standup with milestone due date banner
│   ├── TicketList.js       ← Ticket create/view/update
│   ├── ChatBubble.js       ← General AI response
│   ├── VelocityChart.js    ← 6-week SVG bar chart
│   ├── BurndownChart.js    ← SVG burndown line chart with health indicator
│   └── EodSummary.js       ← End of day summary (shipped / in-progress / created)
├── server/
│   ├── api.js              ← Local API (port 3748): git branch, MCP context, MCP JSON-RPC
│   └── app.js              ← Static file server (port 3747) + SPA fallback
├── bin/
│   └── stowaway.js         ← CLI launcher: starts both servers, opens browser
├── sw.js                   ← Service worker: cache-first shell, network-only AI
├── manifest.json           ← PWA manifest
├── icon.svg                ← Anchor icon, indigo on dark
├── cloudflare-proxy.js     ← Cloudflare Worker CORS proxy for hosted deployment
├── package.json            ← npm package (stowaway-pm), v1.1.0
├── BOW.md                  ← This file
└── README.md               ← User-facing docs
```

---

## 7. Data Schema (v1.1)

```json
{
  "meta": { "version": "1.0", "created": "", "lastModified": "" },
  "project": { "id": "proj_<timestamp>", "name": "", "description": "", "goal": "", "currentMilestone": "" },
  "milestones": [
    { "id": "ms_001", "title": "", "status": "in-progress|backlog|done", "dueDate": "YYYY-MM-DD", "ticketIds": [] }
  ],
  "tickets": [
    {
      "id": "T001",
      "title": "",
      "description": "",
      "status": "backlog|in-progress|done|blocked|suspended",
      "priority": "low|medium|high|critical",
      "milestoneId": "ms_001",
      "dueDate": "YYYY-MM-DD | null",
      "createdAt": "",
      "updatedAt": "",
      "completedAt": "ISO string | null",
      "tags": [],
      "blockedBy": [],
      "notes": "",
      "git_branch": null
    }
  ]
}
```

**Field notes:**
- `completedAt` — set when `status → done`, cleared to `null` when reopened. Used by VelocityChart and EodSummary.
- `dueDate` — optional per-ticket deadline. Shown as badge on kanban cards when ≤14 days out.
- `suspended` — soft pause status, set automatically when git branch switches. Shown in conditional kanban column.
- `git_branch` — reserved for future git-aware auto-branch feature.

---

## 8. Build Log

| Date | Version | What shipped |
|---|---|---|
| 2026-05-15 | MVP | 9 UI components, 5 providers, onboarding, generative UI, BYOAK, streaming |
| 2026-05-15 | MVP | OpenRouter as primary with model picker; verified free models |
| 2026-05-15 | MVP | Bug fixes: error surfacing, retry UI, send button state, innerHTML removal |
| 2026-05-15 | V1 | Chat history persistence, markdown rendering |
| 2026-05-15 | V1 | Keyboard shortcuts, inline ticket editor, due date awareness |
| 2026-05-15 | V1 | Multi-project support with auto-migration |
| 2026-05-15 | V1 | Kanban drag & drop, search/filter, PWA |
| 2026-05-15 | V1 | Velocity chart, burndown chart, EOD summary (generative UI) |
| 2026-05-15 | V1 | Git branch polling, MCP server, CLI launcher, Cloudflare proxy |
| 2026-05-15 | V1.1 | Bug fixes: burndown yScale, code-fence parsing, suspended column, daysUntil NaN, completedAt reopen |
| 2026-05-15 | V1.1 | Individual ticket due dates (editor + kanban badge) |
| 2026-05-15 | V1.1 | Background heartbeat via Page Visibility API |
| 2026-05-15 | V1.1 | V/D/E keyboard shortcuts for velocity/burndown/EOD |
| 2026-05-15 | V1.1 | System prompt updated: dueDate field, suspended status documented |
| 2026-05-15 | V1.1 | README rewritten for npm/GitHub; package.json v1.1.0 with full metadata |
