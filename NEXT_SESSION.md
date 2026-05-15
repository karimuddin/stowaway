# Next Session — Pickup Notes

> Last updated: 2026-05-15

---

## Where we left off

Everything is built and on GitHub. The only outstanding task is **npm publish** — it failed because `npm login` via browser did not save the auth token to `~/.npmrc`.

---

## #1 Priority: npm publish

### Option A — Login via terminal (recommended)
Run in your terminal:
```bash
npm login
```
It will prompt for username / password / email or open a browser OTP page.
When it says `Logged in as karimuddin`, run:
```bash
cd C:\Users\karim\Downloads\stowaway
npm publish --access public
```

### Option B — Use an access token
1. Go to https://www.npmjs.com/settings/tokens
2. Click **Generate New Token → Classic Token → Automation**
3. Copy the token, then run:
```bash
npm set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
cd C:\Users\karim\Downloads\stowaway
npm publish --access public
```

Once published, anyone can run:
```bash
npx stowaway-pm
```

---

## #2 Create GitHub Release

`gh` CLI is not installed. Create the release manually:

1. Go to https://github.com/karimuddin/stowaway/releases/new?tag=v1.1.0
2. Title: `Stowaway v1.1.0`
3. Paste these release notes:

```
First public release — AI project manager for solo developers.

## Install
npx github:karimuddin/stowaway        ← works right now
npx stowaway-pm                       ← works after npm publish

## What's in v1.1.0
- 9 generative UI components (Kanban, Standup, Burndown, Velocity, EOD…)
- 5 AI providers: OpenRouter, OpenAI, Anthropic, Groq, Ollama
- BYOAK — API key never stored to disk
- Multi-project, drag & drop kanban, inline ticket editor
- Individual ticket due dates with urgency badges
- Keyboard shortcuts, search/filter, PWA, offline support
- MCP integration for Claude Code / Cursor
- Git branch polling with auto-suspend
- Background heartbeat (Page Visibility API)
- GitHub Issues / Linear / Notion export
```

---

## #3 V1.2 — What's next (in priority order)

| # | Feature | Effort | Notes |
|---|---|---|---|
| 1 | **npm publish** | 5 min | See above — just auth issue |
| 2 | **GitHub Release** | 5 min | See above |
| 3 | Request counter reset in settings | 30 min | UX: currently requires page refresh |
| 4 | Mobile responsive layout | 1 day | Untested; needs touch drag & drop |
| 5 | AI milestone mutations applied | 2 hours | Currently only tickets update from AI response |
| 6 | Import from GitHub Issues / Linear | 1 day | Seed Stowaway from existing project |
| 7 | Background file-watcher time tracking | 1 day | `chokidar` + git diff as proof-of-work |
| 8 | Optional Supabase sync | 2 days | Multi-device without storing user data |

---

## Current repo state

```
GitHub:  https://github.com/karimuddin/stowaway
npm:     stowaway-pm@1.1.0 (NOT yet published)
tag:     v1.1.0 (pushed to GitHub)

git log:
c0f1092  docs: add GitHub install path
35c58d4  chore: correct repo URLs to karimuddin/stowaway
7904c2b  Fix completedAt reopen bug, system prompt gaps, BOW.md update
8795a61  v1.1 — bug fixes, due dates, V1 keyboard shortcuts, visibility heartbeat
feb6819  Initial commit — Stowaway v1.0 MVP + V1 features
```

## Run locally right now
```bash
cd C:\Users\karim\Downloads\stowaway
node bin/stowaway.js
```
Opens at http://localhost:3747
