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

## 2. What's Built (MVP — Shipped 2026-05-15)

| Feature | Status |
|---|---|
| 4-step onboarding (project info → provider → model → API key → scaffold) | ✅ |
| AI scaffold generation on first run | ✅ |
| Generative UI routing (6 components) | ✅ |
| KanbanBoard — tickets grouped by status | ✅ |
| BlockerList — blocked tickets with dep display | ✅ |
| ProgressRing — SVG ring + milestone breakdown | ✅ |
| StandupSummary — daily priorities view | ✅ |
| TicketList — create/view/update tickets | ✅ |
| ChatBubble — general AI response | ✅ |
| Provider adapters: OpenRouter, OpenAI, Anthropic, Groq, Ollama | ✅ |
| OpenRouter model picker in onboarding (10 models) | ✅ |
| Token-by-token streaming engine | ✅ |
| Session-memory API key (never persisted) | ✅ |
| Action buttons (direct mutations + nav) | ✅ |
| Direct ticket mutations (mark done / start work / block) without AI call | ✅ |
| localStorage storage + JSON export/import | ✅ |
| Settings modal (provider, model, key, export, import, reset) | ✅ |
| Prompt injection sanitization (`<project_data>` delimiter) | ✅ |
| XSS prevention (textContent only, no innerHTML with user data) | ✅ |
| Request limit (30/session) with visible counter | ✅ |
| Real API error messages surfaced (not generic 429 text) | ✅ |
| Retry + back buttons on scaffold failure | ✅ |
| Send button visual state during streaming (↑ → …) | ✅ |
| Import schema validation + field normalisation | ✅ |

### Bugs Fixed Post-MVP
| Bug | Fix |
|---|---|
| Duplicate `display:none` on scaffold error actions | Removed |
| `innerHTML` in `appendThinking` | Replaced with DOM methods |
| Real OpenRouter error body hidden behind generic 429 message | `parseApiError` now surfaces body first |
| Mistral/Llama free models unavailable (404/provider error) | Replaced with verified working free models |
| Send button stuck disabled on error | `finishStreaming` restores text + state |
| Import accepted malformed tickets silently | Schema normalisation on import |
| Standup "Up Next" showed unlimited backlog items | Capped at 5 most relevant |

---

## 3. V1 Scope — Full Product

### 3.1 Core Functionality Gaps (make it feel complete)

#### A. Chat History Persistence
**Problem:** Conversation resets on every page refresh. Users lose all context.
**Fix:** Persist `chatHistory` to localStorage (separate key from `projectData`). Cap at last 50 messages.
**Effort:** 1 hour.

#### B. Inline Ticket Editing
**Problem:** Users must type in chat to update a ticket. Clicking a ticket does nothing.
**Fix:** Click any ticket card → slide-in edit panel (title, status, priority, notes, blockedBy). Save updates directly to `projectData` without an AI call.
**Effort:** 1 day.

#### C. Kanban Drag & Drop
**Problem:** Moving a ticket between columns requires typing "move T004 to done".
**Fix:** Native HTML5 drag and drop. Dragging a card to a column updates `ticket.status` and saves.
**Effort:** Half day.

#### D. Markdown Rendering in Chat
**Problem:** AI responses display as raw text. Bold, lists, code blocks don't render.
**Fix:** Lightweight markdown parser (no external dep — ~80 lines of regex). Applied only to assistant message bubbles (user input stays `textContent`).
**Effort:** 2 hours.

#### E. Due Date Awareness
**Problem:** Milestones have `dueDate` but nothing in the UI shows urgency.
**Fix:** Milestone badge in header turns amber (< 7 days) or red (overdue). StandupSummary shows days remaining.
**Effort:** 2 hours.

#### F. Multi-Project Support
**Problem:** Only one project per browser. Solo devs run 2–5 projects.
**Fix:** Project switcher in header. localStorage stores array of project keys. New project goes through onboarding flow.
**Effort:** 1 day.

#### G. Keyboard Shortcuts
**Problem:** No keyboard navigation — entirely mouse-driven.
**Fix:**
- `Cmd/Ctrl + K` → focus chat input
- `Cmd/Ctrl + B` → show board (kanban)
- `Cmd/Ctrl + S` → standup
- `Cmd/Ctrl + P` → progress
- `Esc` → close modal
**Effort:** 2 hours.

#### H. Search / Filter Tickets
**Problem:** As project grows (30+ tickets), finding anything requires asking AI.
**Fix:** `Cmd + F` opens a ticket search bar above the kanban. Filters by title/tag/status in real time.
**Effort:** Half day.

---

### 3.2 Developer Power Features

#### I. Git-Aware Task Auto-Pause
**What:** Detect git branch switches and auto-pause the active ticket.
**How:** A lightweight polling mechanism (1s interval via `setInterval`) checks the current branch by pinging a tiny local endpoint (or a git hook that writes to a file Stowaway watches).
**Why:** Solo devs context-switch constantly. Stowaway should stay synced with the codebase.
**Effort:** 1 day.
**Schema change:** `git_branch` field already exists on tickets — no migration needed.

#### J. MCP Server for IDE Integration
**What:** Expose active task context to Cursor / Claude Code / Windsurf via Model Context Protocol.
**How:** Stowaway exposes `GET /mcp/context` → returns active ticket + acceptance criteria. IDE reads it automatically.
**Why:** AI in your editor knows exactly what you're building without copy-pasting.
**Effort:** 1 day (MCP is a simple JSON protocol).

#### K. Background Time Tracking (Heartbeat Daemon)
**What:** Track actual coding time using git diffs as proof-of-work (not idle time).
**How:** `chokidar` watches project files. On change: `git diff HEAD -- <file>` must be non-empty (3-min debounce). Increments `time_spent_ms` on active ticket.
**Why:** Honest time tracking — measures output not presence.
**Effort:** 1 day.

#### L. CLI Distribution
**What:** `npx stowaway` launches the app with zero setup.
**How:** `bin/stowaway.js` that starts `npx serve .` and opens browser. Published to npm.
**Effort:** Half day.

#### M. PWA / Installable
**What:** Add `manifest.json` + service worker so it installs as a desktop app.
**How:** Standard PWA setup — offline cache for shell, network-only for AI calls.
**Effort:** 2 hours.

---

### 3.3 Integrations

#### N. GitHub Integration
**What:** Auto-close tickets when a commit referencing the ticket ID is pushed.
**How:** GitHub webhook → Stowaway endpoint (or GitHub Action) that updates `ticket.status = 'done'`.
**Effort:** 1 day.

#### O. Export to Linear / Notion / GitHub Issues
**What:** One-click export of ticket list to external PM tools.
**How:** JSON schema maps cleanly to Linear's API, Notion's database API, and GitHub Issues API.
**Effort:** 1–2 days per integration.

#### P. Import from GitHub Issues / Linear
**What:** Seed Stowaway from an existing project.
**How:** Read GitHub Issues/Linear tickets via API, normalise to Stowaway schema.
**Effort:** 1 day.

---

### 3.4 Analytics & Insights

#### Q. Velocity Tracking
**What:** Tickets completed this week vs last week.
**How:** `completedAt` timestamp on `status → done` transitions. Chart in ProgressRing view.
**Effort:** Half day.

#### R. Burndown Chart
**What:** Visual timeline of remaining tickets vs time.
**How:** SVG chart rendered in ProgressRing. Data derived from `dueDate` and current done count.
**Effort:** 1 day.

#### S. Daily EOD Summary
**What:** At end of session, auto-generate a "what I did today" summary.
**How:** Triggered when user closes or after 4 hours of use. AI generates 3-bullet summary from mutations made this session.
**Effort:** Half day.

---

### 3.5 Infrastructure (for deployed/hosted version)

#### T. Filesystem DB (~/.stowaway/)
**What:** Replace localStorage with individual `.json` files per ticket.
**Why:** localStorage is ~5MB cap and browser-specific. Filesystem DB is portable, inspectable, git-trackable, and MCP-friendly.
**How:** Atomic writes via temp file + rename (prevents corruption). Same schema, different storage backend.
**Effort:** 1 day.

#### U. Cloudflare CORS Proxy
**What:** 15-line Worker that proxies AI API calls for the deployed version.
**Why:** CORS blocks browser → AI provider calls in some environments.
**Effort:** 1 hour.

#### V. Optional Sync
**What:** Encrypted sync via user-supplied Supabase URL.
**Why:** Work across devices without giving us your data.
**Effort:** 2 days.

---

## 4. Architecture Decisions

### 4.1 Tech Stack: Vanilla HTML + CSS + JS
**Decision:** No framework. Zero npm dependencies at runtime.
**Rationale:** Ships as a directory of files; no build step. Every line readable and forkable. Maximum ownership.
**Trade-off:** More verbose DOM code. Acceptable for this scope.

### 4.2 ES Modules
**Decision:** `import`/`export` with `<script type="module">`.
**Implication:** Requires serving via HTTP (not `file://`). Users run `npx serve .` or `python -m http.server`.

### 4.3 Storage: localStorage + JSON
**Decision:** Single JSON blob under key `stowaway_project`.
**Migration path:** `meta.version` field exists for future schema migrations. V1 moves to `~/.stowaway/` filesystem DB.

### 4.4 API Key: Session Memory Only
**Decision:** Key lives in `SESSION` object in JS memory. Never written to localStorage, cookies, or disk.
**Trade-off:** Re-enter each session. This is the correct trade-off for security.

### 4.5 Provider Adapter Pattern
**Decision:** All AI providers normalised into `PROVIDERS` map with `url`, `headers`, `body`, `parse`.
**Anthropic special case:** Anthropic requires `system` as top-level param. `stream.js` extracts it before calling the adapter.

### 4.6 Generative UI Pattern
**Decision:** AI always returns `{ ui, data, message, actions }`. The `ui` key routes to one of 6 components.
**Fallback:** `safeParseAIResponse` falls back to `{ ui: 'chat' }` on parse failure.

### 4.7 DOM Safety: textContent Only
**Decision:** All user/AI data written via `textContent`, never `innerHTML`.
**Exception:** `appendThinking()` uses DOM methods for the static dots indicator (no user data).

### 4.8 Prompt Injection Defence
**Decision:** Project data wrapped in `<project_data>` delimiters + `sanitizeForPrompt()`.

### 4.9 OpenRouter as Primary Provider
**Decision:** OpenRouter is the recommended/default provider for new users.
**Rationale:** 200+ models, single key, free tier. Best way to stay provider-agnostic for end users.
**Caveat:** Users must enable "Free endpoints that may train on request data" in OpenRouter privacy settings to use free models.

---

## 5. Design Decisions

### 5.1 Layout: Split Pane (Chat left, UI right)
### 5.2 Dark Theme as Default (zinc/indigo palette)
### 5.3 Onboarding: AI-Generated Scaffold
### 5.4 Request Limit: 30/session with counter
### 5.5 Action Buttons: Direct mutations don't consume requests
### 5.6 OpenRouter Model Picker in Onboarding (step 2)

---

## 6. File Structure

```
stowaway/
├── index.html              ← Entry point, onboarding, app shell
├── style.css               ← All styles, dark theme
├── app.js                  ← State, event handlers, orchestration
├── adapters/
│   └── providers.js        ← OpenRouter, OpenAI, Anthropic, Groq, Ollama
├── lib/
│   ├── storage.js          ← localStorage + export/import + schema validation
│   ├── stream.js           ← Streaming engine + error parsing
│   ├── systemPrompt.js     ← System prompt builder + sanitizer
│   └── renderUI.js         ← Generative UI router + safe JSON parser
├── components/
│   ├── shared.js           ← el(), createHeader(), createActionButtons()
│   ├── KanbanBoard.js
│   ├── BlockerList.js
│   ├── ProgressRing.js
│   ├── StandupSummary.js
│   ├── TicketList.js
│   └── ChatBubble.js
├── BOW.md                  ← This file
└── README.md
```

---

## 7. Data Schema (v1.0)

```json
{
  "meta": { "version": "1.0", "created": "", "lastModified": "" },
  "project": { "id": "", "name": "", "description": "", "goal": "", "currentMilestone": "" },
  "milestones": [
    { "id": "", "title": "", "status": "in-progress|backlog|done", "dueDate": "", "ticketIds": [] }
  ],
  "tickets": [
    {
      "id": "", "title": "", "description": "", "status": "backlog|in-progress|done|blocked|suspended",
      "priority": "low|medium|high|critical", "milestoneId": "",
      "createdAt": "", "updatedAt": "", "completedAt": null,
      "tags": [], "blockedBy": [], "notes": "", "git_branch": null,
      "time_spent_ms": 0
    }
  ]
}
```

**Fields added for V1 (not yet populated by MVP):**
- `completedAt` — set when `status → done`, used for velocity tracking
- `time_spent_ms` — populated by heartbeat daemon

---

## 8. Build Log

| Date | What shipped |
|---|---|
| 2026-05-15 | MVP complete — all 6 UI components, 5 providers, onboarding, generative UI, BYOAK security |
| 2026-05-15 | OpenRouter added as primary provider with model picker in onboarding |
| 2026-05-15 | Bug fixes: error body surfacing, retry UI, send button state, import validation, innerHTML removal |
| 2026-05-15 | Working free models updated (nvidia/nemotron, deepseek/deepseek-v4-flash, inclusionai/ring) |

---

## 9. V1 Priority Order

Based on user impact vs. effort:

| Priority | Feature | Effort | Impact |
|---|---|---|---|
| 1 | Chat history persistence (A) | 1h | High — losing context on refresh is a dealbreaker |
| 2 | Markdown rendering in chat (D) | 2h | High — AI responses look broken without it |
| 3 | Due date awareness (E) | 2h | High — makes milestones actionable |
| 4 | Keyboard shortcuts (G) | 2h | Medium — power user feel |
| 5 | Inline ticket editing (B) | 1d | High — chat-only editing is slow |
| 6 | Kanban drag & drop (C) | 0.5d | Medium — expected by every PM tool user |
| 7 | Multi-project support (F) | 1d | High — most solo devs have multiple projects |
| 8 | Search / filter tickets (H) | 0.5d | Medium — needed once project has 20+ tickets |
| 9 | MCP server (J) | 1d | High for dev users — IDE integration |
| 10 | PWA / installable (M) | 2h | Medium — removes the "run a server" friction |
| 11 | Git-aware auto-pause (I) | 1d | Medium — unique differentiator |
| 12 | CLI distribution (L) | 0.5d | High — makes distribution frictionless |
| 13 | Velocity tracking (Q) | 0.5d | Medium — gives sense of progress over time |
| 14 | Burndown chart (R) | 1d | Medium — visual milestone tracking |
| 15 | GitHub integration (N) | 1d | High for OSS devs |
| 16 | Export to Linear/Notion (O) | 2d | Medium — bridge to existing workflows |
| 17 | Background time tracking (K) | 1d | Low for MVP users, high for power users |
| 18 | Filesystem DB (T) | 1d | Required before CLI distribution |
| 19 | EOD summary (S) | 0.5d | Nice to have |
| 20 | Optional sync (V) | 2d | Required for multi-device |
