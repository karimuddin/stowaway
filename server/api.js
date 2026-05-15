// Local API server — provides git awareness and MCP context to the browser and IDEs
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os   = require('os');

const STOWAWAY_DIR = path.join(os.homedir(), '.stowaway');

function ensureDir() {
  fs.mkdirSync(STOWAWAY_DIR, { recursive: true });
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: process.cwd(), timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim();
  } catch { return null; }
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJSON(file, data) {
  ensureDir();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file); // atomic write
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) reject(new Error('Body too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function cors(res, appPort) {
  res.setHeader('Access-Control-Allow-Origin', `http://localhost:${appPort}`);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function startApiServer(port, appPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      cors(res, appPort);
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      const url = new URL(req.url, `http://localhost:${port}`);
      const route = `${req.method} ${url.pathname}`;

      try {
        // ── Git ────────────────────────────────────────────────────────────────
        if (route === 'GET /api/git/branch') {
          json(res, { branch: getCurrentBranch(), cwd: process.cwd() });
          return;
        }

        // ── MCP context (browser → file) ───────────────────────────────────────
        if (route === 'POST /api/mcp/context') {
          const data = await parseBody(req);
          writeJSON(path.join(STOWAWAY_DIR, 'active-context.json'), data);
          json(res, { ok: true });
          return;
        }

        // ── MCP context (IDE → read) ───────────────────────────────────────────
        if (route === 'GET /api/mcp/context') {
          const ctx = readJSON(path.join(STOWAWAY_DIR, 'active-context.json'));
          json(res, ctx || { error: 'No active context', hint: 'Open Stowaway and start a ticket.' });
          return;
        }

        // ── MCP tool list (Model Context Protocol) ─────────────────────────────
        if (route === 'POST /api/mcp') {
          const body = await parseBody(req);
          const result = handleMCP(body);
          json(res, result);
          return;
        }

        // ── Health ─────────────────────────────────────────────────────────────
        if (route === 'GET /api/health') {
          json(res, { ok: true, version: '1.0.0' });
          return;
        }

        json(res, { error: 'Not found' }, 404);
      } catch (e) {
        json(res, { error: e.message }, 500);
      }
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => server.close()));
  });
}

// ── MCP JSON-RPC handler ───────────────────────────────────────────────────────
function handleMCP(body) {
  const { method, params, id } = body;
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const err = (code, msg) => ({ jsonrpc: '2.0', id, error: { code, message: msg } });

  if (method === 'tools/list') {
    return ok({ tools: [
      { name: 'get_active_task',      description: 'Get the currently in-progress task from Stowaway', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_project_context',  description: 'Get project name, goal, and current milestone',   inputSchema: { type: 'object', properties: {} } },
      { name: 'list_tickets',         description: 'List all tickets with status and priority',        inputSchema: { type: 'object', properties: { status: { type: 'string' } } } },
      { name: 'update_ticket_status', description: 'Update a ticket status',                           inputSchema: { type: 'object', required: ['id','status'], properties: { id: { type: 'string' }, status: { type: 'string', enum: ['backlog','in-progress','done','blocked'] } } } },
    ]});
  }

  if (method === 'tools/call') {
    const ctx = readJSON(path.join(STOWAWAY_DIR, 'active-context.json'));
    const { name, arguments: args } = params;

    if (name === 'get_active_task') {
      return ok({ content: [{ type: 'text', text: ctx ? JSON.stringify(ctx.activeTicket, null, 2) : 'No active task. Open Stowaway and start a ticket.' }] });
    }
    if (name === 'get_project_context') {
      return ok({ content: [{ type: 'text', text: ctx ? JSON.stringify(ctx.project, null, 2) : 'No project loaded.' }] });
    }
    if (name === 'list_tickets') {
      const tickets = ctx?.allTickets || [];
      const filtered = args?.status ? tickets.filter(t => t.status === args.status) : tickets;
      return ok({ content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] });
    }
    if (name === 'update_ticket_status') {
      if (!ctx) return err(-32001, 'No active context. Open Stowaway first.');
      const ticket = (ctx.allTickets || []).find(t => t.id === args.id);
      if (!ticket) return err(-32002, `Ticket ${args.id} not found.`);
      ticket.status = args.status;
      ticket.updatedAt = new Date().toISOString();
      writeJSON(path.join(STOWAWAY_DIR, 'active-context.json'), ctx);
      return ok({ content: [{ type: 'text', text: `${args.id} updated to ${args.status}.` }] });
    }

    return err(-32601, `Unknown tool: ${name}`);
  }

  return err(-32601, `Unknown method: ${method}`);
}

module.exports = { startApiServer };
