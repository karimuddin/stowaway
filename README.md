# ⚓ Stowaway

**AI-powered project manager for solo developers.**  
Bring your own API key. No backend. No signup. Runs in your browser.

```bash
npx stowaway-pm
```

Opens at `http://localhost:3747` in your default browser.

---

## What it does

Stowaway lets you talk to your project board in plain English. It generates a kanban board, milestones, and tickets from a single sentence description — then keeps everything updated as you chat.

- **"What should I work on today?"** → Daily standup with priorities
- **"Mark T004 as done and create a ticket for login rate limiting"** → Board updates instantly
- **"Show the burndown chart"** → SVG chart, no chart library needed
- **"I'm blocked on auth, help me think through it"** → AI project manager mode

## Features

| Feature | Details |
|---|---|
| **Generative UI** | AI responses route to one of 9 components (Kanban, Standup, Progress Ring, Burndown, Velocity, Blockers, EOD Summary…) |
| **BYOAK** | API key lives in session memory only — never written to disk, localStorage, or cookies |
| **Multi-provider** | OpenRouter (200+ models), OpenAI, Anthropic, Groq, Ollama (local) |
| **Multi-project** | Switch between projects instantly; each has its own board and chat history |
| **Kanban drag & drop** | Drag cards across columns; status syncs automatically |
| **Ticket editor** | Click any card to edit title, status, priority, due date, notes, tags, and blockers |
| **Due date awareness** | Overdue / critical / soon badges on cards and milestone header |
| **Chat history** | Persisted per-project across sessions (localStorage) |
| **Search & filter** | `Cmd+F` to search by title, ID, tag, or filter by status/priority |
| **Keyboard shortcuts** | `B` board · `S` standup · `P` progress · `V` velocity · `D` burndown · `E` EOD · `/` chat |
| **Export** | JSON export/import · GitHub Issues · Linear · Notion |
| **PWA** | Installable as a desktop app; works offline (cache-first service worker) |
| **MCP integration** | Local API on port 3748 exposes your active ticket to Claude Code / Cursor via MCP |
| **Git branch polling** | Auto-suspends in-progress ticket when you switch branches |

## Setup

### Option A — npx (no install)
```bash
npx stowaway-pm
```

### Option B — global install
```bash
npm install -g stowaway-pm
stowaway
```

### Option C — local dev
```bash
git clone https://github.com/stowaway-pm/stowaway.git
cd stowaway
node bin/stowaway.js
```

No `npm install` needed — Stowaway has zero runtime dependencies.

## Providers

| Provider | Free tier | Notes |
|---|---|---|
| **OpenRouter** | Yes (many models) | Recommended. One key, 200+ models. |
| **OpenAI** | No | GPT-4o and GPT-4o-mini |
| **Anthropic** | No | Claude Sonnet / Opus / Haiku |
| **Groq** | Yes | Llama 3, very fast |
| **Ollama** | Yes | Fully local, no key needed |

Your API key is used only in that browser session and is never saved anywhere.

## MCP integration (for Claude Code / Cursor)

When running via `npx stowaway-pm`, a local API server starts on port 3748 with an MCP endpoint. Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stowaway": {
      "url": "http://localhost:3748/api/mcp"
    }
  }
}
```

Available tools: `get_active_task`, `get_project_context`, `list_tickets`, `update_ticket_status`.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` or `⌘K` | Focus chat |
| `B` | Board (kanban) |
| `S` | Daily standup |
| `P` | Progress view |
| `V` | Velocity chart |
| `D` | Burndown chart |
| `E` | End of day summary |
| `⌘F` | Search tickets |
| `Esc` | Close / dismiss |
| `?` | Show shortcuts |

## Deploy (hosted version)

To host Stowaway publicly, deploy the static files to any CDN and the `cloudflare-proxy.js` worker to handle CORS:

```bash
wrangler deploy cloudflare-proxy.js --name stowaway-proxy
```

Then add to your `index.html`:
```html
<meta name="proxy-url" content="https://stowaway-proxy.YOUR-SUBDOMAIN.workers.dev">
```

## License

MIT
