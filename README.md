# ⚓ Stowaway

AI-powered project manager for solo developers. Bring your own key. Zero infrastructure.

## Run locally

```bash
cd stowaway

# Option A — Node
npx serve .

# Option B — Python
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

> ES modules require HTTP — opening `index.html` directly via `file://` won't work.

## First run

1. Enter your project name and goal
2. Pick an AI provider (OpenAI, Anthropic, Groq, or Ollama for local)
3. Paste your API key — it lives in session memory only, never saved to disk
4. Stowaway generates your task board automatically

## Prompts that work

| What you type | What renders |
|---|---|
| "Show my board" | Kanban board |
| "What's blocking me?" | Blocker list |
| "How close am I to launch?" | Progress ring |
| "What should I do today?" | Daily standup |
| "Create a ticket for X" | New ticket |
| Anything else | Chat response |

## Providers

| Provider | Key required | Notes |
|---|---|---|
| OpenAI | Yes | GPT-4o default |
| Anthropic | Yes | Claude Sonnet 4.6 default |
| Groq | Yes | Free tier available |
| Ollama | No | Run `ollama serve` locally first |

## License

MIT
