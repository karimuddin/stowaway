import { Storage }                              from './lib/storage.js';
import { streamAI }                             from './lib/stream.js';
import { buildSystemPrompt, buildOnboardingSystemPrompt } from './lib/systemPrompt.js';
import { renderResponse }                       from './lib/renderUI.js';
import { PROVIDERS }                            from './adapters/providers.js';
import { renderMarkdown }                       from './lib/markdown.js';
import { daysUntil, dueBadgeClass, dueLabel }  from './components/shared.js';

// ─── State ───────────────────────────────────────────────────────────────────
const SESSION = { apiKey: null, provider: null, model: null, requestCount: 0, requestLimit: 30 };
let projectData      = null;
let chatHistory      = [];
let displayMessages  = [];
let isStreaming       = false;
let editingTicketId  = null;
let isAddingProject  = false;
let searchQuery      = '';
let searchFilter     = '';
let installPrompt    = null;
let apiAvailable     = false;
let gitBranch        = null;
let sessionMutations = []; // tracks ticket changes this session for EOD

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  projectData = Storage.load();
  if (projectData) {
    showMainApp();
    handleFirstRender();
  } else {
    showOnboarding();
  }
  bindStaticListeners();
  initApiFeatures();
});

// ─── Onboarding ───────────────────────────────────────────────────────────────
let currentStep = 1;
let onboardingInfo = { name: '', goal: '', description: '', provider: 'openrouter' };

function showOnboarding() {
  get('onboarding').style.display = 'flex';
  get('main-app').style.display = 'none';
  goToStep(1);
}

function goToStep(step) {
  currentStep = step;
  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  const el = get(`step-${step}`);
  if (el) el.classList.add('active');
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    d.classList.toggle('active', i + 1 === step);
    d.classList.toggle('done', i + 1 < step);
  });
}

function bindStaticListeners() {
  // Step 1 — project info
  get('step1-next')?.addEventListener('click', () => {
    const name = val('project-name').trim();
    if (!name) { fieldError('project-name', 'Enter a project name'); return; }
    clearError('project-name');
    onboardingInfo.name = name;
    onboardingInfo.goal = val('project-goal').trim();
    onboardingInfo.description = val('project-desc').trim();
    goToStep(2);
  });

  // Step 2 — provider selection
  populateOnboardingModelPicker('openrouter'); // pre-populate for default selection
  document.querySelectorAll('.provider-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      onboardingInfo.provider = card.dataset.provider;
      clearError('provider-error');
      const btn = get('step2-next');
      if (btn) btn.textContent = card.dataset.provider === 'ollama' ? 'Generate my board →' : 'Next: API Key →';
      // Show model picker only for OpenRouter
      const picker = get('openrouter-model-picker');
      if (picker) picker.style.display = card.dataset.provider === 'openrouter' ? 'block' : 'none';
      populateOnboardingModelPicker(card.dataset.provider);
    });
  });
  get('step2-next')?.addEventListener('click', () => {
    if (!onboardingInfo.provider) { fieldError('provider-error', 'Select a provider'); return; }
    SESSION.provider = onboardingInfo.provider;
    // Use the model the user picked (OpenRouter) or the provider default
    const pickedModel = get('onboarding-model-select')?.value;
    SESSION.model = (onboardingInfo.provider === 'openrouter' && pickedModel)
      ? pickedModel
      : PROVIDERS[onboardingInfo.provider]?.defaultModel;
    if (onboardingInfo.provider === 'ollama') {
      SESSION.apiKey = null;
      generateScaffold();
    } else {
      goToStep(3);
    }
  });

  // Step 3 — API key
  get('step3-continue')?.addEventListener('click', () => {
    const key = val('api-key-input').trim();
    if (!key) { fieldError('api-key-input', 'Paste your API key'); return; }
    clearError('api-key-input');
    SESSION.apiKey = key;
    generateScaffold();
  });

  // Step 4 — retry / back
  get('scaffold-retry')?.addEventListener('click', () => {
    get('scaffold-error').textContent = '';
    get('scaffold-error').style.display = 'none';
    get('scaffold-error-actions').style.display = 'none';
    get('scaffold-spinner').style.display = 'block';
    // Re-read model picker in case user switched model before retrying
    const pickedModel = get('onboarding-model-select')?.value;
    if (SESSION.provider === 'openrouter' && pickedModel) SESSION.model = pickedModel;
    generateScaffold();
  });
  get('scaffold-back')?.addEventListener('click', () => {
    get('scaffold-error').textContent = '';
    get('scaffold-error').style.display = 'none';
    get('scaffold-error-actions').style.display = 'none';
    get('scaffold-spinner').style.display = 'block';
    goToStep(SESSION.provider === 'ollama' ? 2 : 3);
  });

  // Main chat submit
  const sendBtn  = get('send-btn');
  const chatInput = get('chat-input');
  sendBtn?.addEventListener('click', () => submitChat());
  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); }
  });
  chatInput?.addEventListener('input', () => autoResize(chatInput));

  // Project switcher
  get('project-switcher-btn')?.addEventListener('click', openProjectSwitcher);
  get('close-projects')?.addEventListener('click', closeProjectSwitcher);
  get('projects-overlay')?.addEventListener('click', e => { if (e.target === get('projects-overlay')) closeProjectSwitcher(); });
  get('new-project-btn')?.addEventListener('click', startNewProject);

  // Settings
  get('settings-btn')?.addEventListener('click', openSettings);
  get('close-settings')?.addEventListener('click', closeSettings);
  get('settings-overlay')?.addEventListener('click', e => { if (e.target === get('settings-overlay')) closeSettings(); });
  get('save-settings')?.addEventListener('click', saveSettings);
  get('export-btn')?.addEventListener('click', () => projectData && Storage.exportJSON(projectData));
  get('gh-export-btn')?.addEventListener('click', () => {
    exportToGitHub(get('gh-token')?.value.trim(), get('gh-repo')?.value.trim());
    closeSettings();
  });
  get('linear-export-btn')?.addEventListener('click', () => {
    exportToLinear(get('linear-token')?.value.trim(), get('linear-team-id')?.value.trim());
    closeSettings();
  });
  get('notion-export-btn')?.addEventListener('click', () => {
    exportToNotion(get('notion-token')?.value.trim(), get('notion-db')?.value.trim());
    closeSettings();
  });
  get('import-btn')?.addEventListener('click', () => get('import-file')?.click());
  get('import-file')?.addEventListener('change', handleImport);
  get('reset-btn')?.addEventListener('click', handleReset);

  // UI panel delegation — action buttons + ticket editor (action takes priority)
  get('ui-content')?.addEventListener('click', e => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) { handleAction(actionBtn.dataset.action); return; }
    const ticketEl = e.target.closest('[data-ticket-id]');
    if (ticketEl) openTicketEditor(ticketEl.dataset.ticketId);
  });

  // Kanban drag & drop — fired as a custom event bubbling up from KanbanBoard
  get('ui-content')?.addEventListener('ticket-moved', e => {
    const { id, status } = e.detail;
    const ticket = projectData?.tickets.find(t => t.id === id);
    if (!ticket || ticket.status === status) return;
    ticket.status    = status;
    ticket.updatedAt = new Date().toISOString();
    if (status === 'done') { if (!ticket.completedAt) ticket.completedAt = new Date().toISOString(); }
    else ticket.completedAt = null;
    Storage.save(projectData);
    updateHeader();
    appendSystemMessage(`${id} → ${status}`);
    renderDirect('kanban');
  });

  // Ticket editor
  get('editor-close')?.addEventListener('click', closeTicketEditor);
  get('editor-save')?.addEventListener('click', saveTicketEdit);
  get('editor-delete')?.addEventListener('click', () => deleteTicket(editingTicketId));
  get('ticket-editor-backdrop')?.addEventListener('click', closeTicketEditor);
  get('ticket-editor')?.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveTicketEdit(); }
  });

  // Search bar
  get('search-input')?.addEventListener('input', () => {
    searchQuery = get('search-input').value;
    applySearch();
  });
  get('search-close')?.addEventListener('click', closeSearch);
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      searchFilter = pill.dataset.filter;
      applySearch();
    });
  });

  // PWA install
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    const section = get('install-section');
    if (section) section.style.display = 'block';
  });
  get('install-app-btn')?.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      get('install-section').style.display = 'none';
      installPrompt = null;
    }
  });

  // Keyboard shortcuts
  get('shortcuts-toggle')?.addEventListener('click', toggleShortcutsHelp);
  get('close-shortcuts')?.addEventListener('click', () => get('shortcuts-help').style.display = 'none');
  bindKeyboardShortcuts();
}

// ─── Scaffold generation ──────────────────────────────────────────────────────
async function generateScaffold() {
  goToStep(4);

  const systemPrompt = buildOnboardingSystemPrompt();
  const userMsg = `Project name: ${onboardingInfo.name}\nGoal: ${onboardingInfo.goal || 'Ship MVP'}\nDescription: ${onboardingInfo.description || 'A new software project'}`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userMsg }
  ];

  await streamAI({
    provider: SESSION.provider,
    apiKey:   SESSION.apiKey,
    model:    SESSION.model,
    messages,
    onChunk: () => {},
    onDone:  text  => {
      const scaffold = tryParseScaffold(text) || buildDefaultProject(onboardingInfo);
      scaffold.project.id = `proj_${Date.now()}`; // guarantee unique ID
      chatHistory = []; displayMessages = [];
      get('chat-messages')?.replaceChildren();
      projectData = scaffold;
      Storage.save(projectData);
      isAddingProject = false;
      showMainApp();
      handleFirstRender();
    },
    onError: err => {
      const errEl = get('scaffold-error');
      const actionsEl = get('scaffold-error-actions');
      const spinnerEl = get('scaffold-spinner');
      if (spinnerEl) spinnerEl.style.display = 'none';
      if (errEl) { errEl.textContent = err; errEl.style.display = 'block'; }
      if (actionsEl) actionsEl.style.display = 'block';
    }
  });
}

function tryParseScaffold(text) {
  try {
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : stripped);
    if (parsed.project && Array.isArray(parsed.tickets) && Array.isArray(parsed.milestones)) return parsed;
  } catch {}
  return null;
}

function buildDefaultProject({ name, goal, description }) {
  const now = new Date().toISOString();
  return {
    meta: { version: '1.0', created: now, lastModified: now },
    project: { id: 'proj_001', name, description: description || '', goal: goal || 'Ship MVP', currentMilestone: 'ms_001' },
    milestones: [
      { id: 'ms_001', title: 'Foundation',  status: 'in-progress', dueDate: '', ticketIds: ['T001','T002','T003'] },
      { id: 'ms_002', title: 'MVP Launch',  status: 'backlog',     dueDate: '', ticketIds: ['T004','T005','T006'] }
    ],
    tickets: [
      makeTicket('T001', 'Project setup & scaffolding',   'in-progress', 'high',   'ms_001', now),
      makeTicket('T002', 'Core data model & storage',     'backlog',     'high',   'ms_001', now),
      makeTicket('T003', 'Authentication flow',            'backlog',     'high',   'ms_001', now),
      makeTicket('T004', 'Main feature — MVP slice',       'backlog',     'high',   'ms_002', now),
      makeTicket('T005', 'UI / frontend',                  'backlog',     'medium', 'ms_002', now),
      makeTicket('T006', 'Launch preparation & README',    'backlog',     'low',    'ms_002', now)
    ]
  };
}

function makeTicket(id, title, status, priority, milestoneId, now) {
  return { id, title, description: '', status, priority, milestoneId, dueDate: null, createdAt: now, updatedAt: now, tags: [], blockedBy: [], notes: '', git_branch: null };
}

// ─── Main app ─────────────────────────────────────────────────────────────────
function showMainApp() {
  get('onboarding').style.display = 'none';
  get('main-app').style.display = 'flex';
  updateHeader();
  populateSettings();
  scheduleEodCheck();
}

function handleFirstRender() {
  updateHeader();
  loadChatHistory();

  const kanban = JSON.stringify({
    ui: 'kanban',
    data: { tickets: projectData.tickets },
    message: `${projectData.tickets.length} tickets across ${projectData.milestones.length} milestones.`,
    actions: [{ label: "Today's standup", action: 'show_standup' }, { label: 'Check progress', action: 'show_progress' }]
  });

  if (displayMessages.length > 0) {
    restoreChatDOM();
    appendSystemMessage('── session restored ──');
  } else {
    const name = projectData?.project?.name || 'your project';
    appendAssistantMessage(`"${name}" is loaded. Here's your board — what would you like to work on?`);
  }
  renderResponse(kanban, get('ui-content'));
}

function updateHeader() {
  if (!projectData) return;
  const nameEl  = get('project-name-display');
  const badgeEl = get('milestone-badge');
  if (nameEl) nameEl.textContent = projectData.project.name;
  if (badgeEl) {
    const ms = projectData.milestones.find(m => m.id === projectData.project.currentMilestone);
    if (ms) {
      const days = daysUntil(ms.dueDate);
      let text = ms.title;
      let cls  = 'milestone-badge';
      if (days !== null && ms.status !== 'done') {
        if      (days < 0)  { text += ` · ${Math.abs(days)}d overdue`; cls += ' due-overdue'; }
        else if (days === 0){ text += ' · Due today';                   cls += ' due-critical'; }
        else if (days <= 3) { text += ` · ${days}d left`;              cls += ' due-critical'; }
        else if (days <= 7) { text += ` · ${days}d left`;              cls += ' due-soon'; }
      }
      badgeEl.textContent = text;
      badgeEl.className   = cls;
    } else {
      badgeEl.textContent = '';
      badgeEl.className   = 'milestone-badge';
    }
  }
  updateRequestDisplay();
}

function updateRequestDisplay() {
  const el = get('request-display');
  if (!el) return;
  el.textContent = `${SESSION.requestCount} / ${SESSION.requestLimit} requests`;
  el.className = SESSION.requestCount >= SESSION.requestLimit ? 'limit'
               : SESSION.requestCount >= SESSION.requestLimit * 0.8 ? 'warn' : '';
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
async function submitChat() {
  const input = get('chat-input');
  const text = input?.value.trim();
  if (!text || isStreaming) return;

  if (!SESSION.provider || (!SESSION.apiKey && SESSION.provider !== 'ollama')) {
    appendSystemMessage('Set your API key in ⚙ Settings to start chatting.');
    return;
  }

  if (SESSION.requestCount >= SESSION.requestLimit) {
    appendSystemMessage(`Session limit reached (${SESSION.requestLimit} requests). Refresh to start a new session.`);
    return;
  }

  input.value = '';
  autoResize(input);
  appendUserMessage(text);
  chatHistory.push({ role: 'user', content: text });

  isStreaming = true;
  const sendBtn = get('send-btn');
  sendBtn.disabled = true;
  sendBtn.textContent = '…';

  const thinking = appendThinking();
  SESSION.requestCount++;
  updateRequestDisplay();

  const messages = [
    { role: 'system', content: buildSystemPrompt(projectData) },
    ...chatHistory.slice(-20)
  ];

  let full = '';
  await streamAI({
    provider: SESSION.provider,
    apiKey:   SESSION.apiKey,
    model:    SESSION.model,
    messages,
    onChunk: chunk => { full += chunk; },
    onDone:  text  => {
      thinking.remove();
      chatHistory.push({ role: 'assistant', content: text });
      const parsed = renderResponse(text, get('ui-content'));
      appendAssistantMessage(parsed.message);
      applyDataMutations(parsed);
      if (parsed.ui === 'kanban') applySearch();
      finishStreaming();
    },
    onError: err => {
      thinking.remove();
      appendSystemMessage(`Error: ${err}`);
      SESSION.requestCount = Math.max(0, SESSION.requestCount - 1);
      updateRequestDisplay();
      finishStreaming();
    }
  });
}

function finishStreaming() {
  isStreaming = false;
  const sendBtn = get('send-btn');
  sendBtn.disabled = false;
  sendBtn.textContent = '↑';
}

// ─── Action buttons ───────────────────────────────────────────────────────────
const NAV_PROMPTS = {
  show_kanban:   'Show me the project board',
  show_standup:  "What should I work on today?",
  show_progress: 'How close am I to launch?',
  show_blockers: "What's blocking me right now?",
  show_velocity: 'Show my velocity chart',
  show_burndown: 'Show the burndown chart',
  show_eod:      "Show end of day summary"
};

async function handleAction(action) {
  if (action.startsWith('mark_done_'))   return mutateTicket(action.replace('mark_done_',''),   'done');
  if (action.startsWith('start_work_'))  return mutateTicket(action.replace('start_work_',''),  'in-progress');
  if (action.startsWith('block_ticket_'))return mutateTicket(action.replace('block_ticket_',''),'blocked');
  const prompt = NAV_PROMPTS[action] || action.replace(/_/g, ' ');
  get('chat-input').value = prompt;
  await submitChat();
}

function mutateTicket(id, newStatus) {
  const ticket = projectData.tickets.find(t => t.id === id);
  if (!ticket) return;
  ticket.status = newStatus;
  ticket.updatedAt = new Date().toISOString();
  if (newStatus === 'done') { if (!ticket.completedAt) ticket.completedAt = new Date().toISOString(); }
  else ticket.completedAt = null;
  Storage.save(projectData);
  updateHeader();
  recordMutation(id, newStatus);
  pushMcpContext();
  appendSystemMessage(`${id} → ${newStatus}`);
  const fakeResponse = JSON.stringify({
    ui: 'kanban',
    data: { tickets: projectData.tickets },
    message: `Updated. ${id} is now ${newStatus}.`,
    actions: [{ label: "Today's standup", action: 'show_standup' }]
  });
  renderResponse(fakeResponse, get('ui-content'));
}

// ─── Data mutations from AI response ─────────────────────────────────────────
function applyDataMutations(parsed) {
  if (!parsed.data?.tickets) return;
  let changed = false;

  parsed.data.tickets.forEach(incoming => {
    if (!incoming.id || !incoming.title) return;
    const existing = projectData.tickets.find(t => t.id === incoming.id);
    if (existing) {
      const clean = JSON.parse(JSON.stringify(incoming));
      Object.assign(existing, clean);
      existing.updatedAt = new Date().toISOString();
      changed = true;
    } else {
      const now = new Date().toISOString();
      projectData.tickets.push({
        id: incoming.id, title: incoming.title,
        description: incoming.description || '',
        status: incoming.status || 'backlog',
        priority: incoming.priority || 'medium',
        milestoneId: incoming.milestoneId || projectData.milestones[0]?.id || '',
        dueDate: incoming.dueDate || null,
        createdAt: now, updatedAt: now,
        tags: incoming.tags || [], blockedBy: incoming.blockedBy || [],
        notes: incoming.notes || '', git_branch: null
      });
      changed = true;
    }
  });

  if (changed) Storage.save(projectData);
}

// ─── Chat UI helpers ──────────────────────────────────────────────────────────

function _renderMessageDOM(role, text) {
  const msgs = get('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.className = role === 'system' ? 'chat-message system-msg' : `chat-message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  if (role === 'assistant') {
    renderMarkdown(text, bubble);
  } else {
    bubble.textContent = text;
  }
  wrapper.appendChild(bubble);
  msgs.appendChild(wrapper);
  scrollChat();
}

function appendUserMessage(text) {
  _renderMessageDOM('user', text);
  displayMessages.push({ role: 'user', text });
  saveChatHistory();
}

function appendAssistantMessage(text) {
  _renderMessageDOM('assistant', text);
  displayMessages.push({ role: 'assistant', text });
  saveChatHistory();
}

function appendSystemMessage(text) {
  // System messages are session-only (errors, status) — not persisted
  _renderMessageDOM('system', text);
}

// ─── Chat persistence ─────────────────────────────────────────────────────────

function saveChatHistory() {
  if (!projectData?.project?.id) return;
  Storage.saveChat(projectData.project.id, chatHistory, displayMessages);
}

function loadChatHistory() {
  if (!projectData?.project?.id) return;
  const saved = Storage.loadChat(projectData.project.id);
  if (!saved) return;
  chatHistory     = saved.history || [];
  displayMessages = saved.display || [];
}

function restoreChatDOM() {
  const msgs = get('chat-messages');
  msgs.replaceChildren();
  displayMessages.forEach(({ role, text }) => _renderMessageDOM(role, text));
}

function appendThinking() {
  const msgs = get('chat-messages');
  const el = document.createElement('div');
  el.className = 'thinking-indicator';
  const dots = document.createElement('div');
  dots.className = 'thinking-dots';
  for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));
  el.appendChild(dots);
  msgs.appendChild(el);
  scrollChat();
  return el;
}

function scrollChat() {
  const msgs = get('chat-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

// ─── Settings modal ───────────────────────────────────────────────────────────
function openSettings() {
  populateSettings();
  get('settings-overlay').style.display = 'flex';
}

function closeSettings() {
  get('settings-overlay').style.display = 'none';
}

function populateSettings() {
  const providerEl = get('settings-provider');
  const modelEl    = get('settings-model');
  if (!providerEl || !modelEl) return;

  providerEl.innerHTML = '';
  Object.entries(PROVIDERS).forEach(([key, p]) => {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = p.name;
    opt.selected = key === SESSION.provider;
    providerEl.appendChild(opt);
  });

  refreshModelOptions(SESSION.provider);

  providerEl.onchange = () => refreshModelOptions(providerEl.value);

  const keyInput = get('settings-key');
  if (keyInput) keyInput.value = '';
}

function refreshModelOptions(provider) {
  const modelEl = get('settings-model');
  if (!modelEl) return;
  const models = PROVIDERS[provider]?.models || [];
  modelEl.innerHTML = '';
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    opt.selected = m === SESSION.model;
    modelEl.appendChild(opt);
  });
}

function saveSettings() {
  const provider = get('settings-provider')?.value;
  const model    = get('settings-model')?.value;
  const key      = get('settings-key')?.value.trim();

  if (provider) SESSION.provider = provider;
  if (model)    SESSION.model    = model;
  if (key)      SESSION.apiKey   = key;

  closeSettings();
  appendSystemMessage(`Settings updated — provider: ${SESSION.provider}, model: ${SESSION.model}`);
}

async function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const oldId = projectData?.project?.id;
    projectData = await Storage.importJSON(file);
    if (oldId) Storage.clearChat(oldId);
    chatHistory = []; displayMessages = [];
    get('chat-messages').replaceChildren();
    showMainApp();
    handleFirstRender();
    closeSettings();
  } catch (err) {
    appendSystemMessage(`Import failed: ${err.message}`);
  }
  e.target.value = '';
}

function handleReset() {
  if (!confirm(`Delete "${projectData?.project?.name}"? This cannot be undone.`)) return;
  const id = projectData?.project?.id;
  if (id) Storage.deleteById(id);
  chatHistory = []; displayMessages = [];
  SESSION.requestCount = 0;
  get('chat-messages').replaceChildren();
  closeSettings();

  const remaining = Storage.getIndex();
  if (remaining.length > 0) {
    const sorted = [...remaining].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    const next = Storage.loadById(sorted[0].id);
    if (next) { projectData = next; showMainApp(); handleFirstRender(); return; }
  }
  projectData = null;
  showOnboarding();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function get(id)     { return document.getElementById(id); }
function val(id)     { return get(id)?.value || ''; }

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// ─── Local API (CLI mode) — git, MCP, EOD ────────────────────────────────────
const API_URL = 'http://localhost:3748';

async function initApiFeatures() {
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(600) });
    apiAvailable = res.ok;
  } catch { apiAvailable = false; }

  if (!apiAvailable) return;

  // Git branch polling — check every 8s
  await pollGitBranch();
  setInterval(pollGitBranch, 8000);

  // Re-poll immediately when the tab becomes visible again (background heartbeat)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && apiAvailable) {
      pollGitBranch();
      pushMcpContext();
    }
  });

  // Push MCP context whenever active ticket changes
  pushMcpContext();
}

async function pollGitBranch() {
  if (!apiAvailable || !projectData) return;
  try {
    const res  = await fetch(`${API_URL}/api/git/branch`, { signal: AbortSignal.timeout(600) });
    const data = await res.json();
    const newBranch = data.branch;
    if (!newBranch) return;

    if (gitBranch && gitBranch !== newBranch) {
      // Branch switched — auto-suspend active ticket
      const active = projectData.tickets.find(t => t.status === 'in-progress');
      if (active) {
        active.status     = 'suspended';
        active.updatedAt  = new Date().toISOString();
        Storage.save(projectData);
        appendSystemMessage(`⎇ Switched to ${newBranch} — ${active.id} paused`);
        renderDirect('kanban');
      } else {
        appendSystemMessage(`⎇ Switched to branch: ${newBranch}`);
      }
    }
    gitBranch = newBranch;
  } catch {}
}

async function pushMcpContext() {
  if (!apiAvailable || !projectData) return;
  try {
    const active = projectData.tickets.find(t => t.status === 'in-progress') || null;
    const ctx = {
      project:      { name: projectData.project.name, goal: projectData.project.goal },
      activeTicket: active,
      allTickets:   projectData.tickets.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
      gitBranch,
      updatedAt:    new Date().toISOString(),
    };
    await fetch(`${API_URL}/api/mcp/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx),
      signal: AbortSignal.timeout(1000),
    });
  } catch {}
}

// Track mutations for EOD summary
function recordMutation(ticketId, newStatus) {
  sessionMutations.push({ ticketId, newStatus, at: new Date().toISOString() });
}

// Auto-trigger EOD after 4 hours of session activity
let eodTriggered = false;
function scheduleEodCheck() {
  setTimeout(() => {
    if (eodTriggered || sessionMutations.length === 0 || !projectData) return;
    eodTriggered = true;
    appendSystemMessage('── 4 hours in — here\'s your end of day ──');
    renderDirect('eod');
  }, 4 * 60 * 60 * 1000);
}

// ─── Export integrations ───────────────────────────────────────────────────────

async function exportToGitHub(token, repo) {
  if (!token || !repo) return;
  const tickets = projectData.tickets.filter(t => t.status !== 'done');
  let created = 0, failed = 0;

  for (const ticket of tickets) {
    const body = [
      ticket.description,
      ticket.notes ? `\n**Notes:** ${ticket.notes}` : '',
      ticket.blockedBy?.length ? `\n**Blocked by:** ${ticket.blockedBy.join(', ')}` : '',
      `\n\n*Exported from Stowaway — ${ticket.id}*`,
    ].filter(Boolean).join('');

    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
        body: JSON.stringify({ title: `[${ticket.id}] ${ticket.title}`, body, labels: ticket.tags || [] }),
      });
      if (res.ok) created++; else failed++;
    } catch { failed++; }
  }
  appendSystemMessage(`GitHub: ${created} issues created${failed ? `, ${failed} failed` : ''}.`);
}

async function exportToLinear(token, teamId) {
  if (!token || !teamId) return;
  const tickets = projectData.tickets.filter(t => t.status !== 'done');
  let created = 0, failed = 0;

  const priorityMap = { critical: 1, high: 2, medium: 3, low: 4 };

  for (const ticket of tickets) {
    const mutation = `mutation { issueCreate(input: { title: ${JSON.stringify('[' + ticket.id + '] ' + ticket.title)}, description: ${JSON.stringify(ticket.description || '')}, teamId: ${JSON.stringify(teamId)}, priority: ${priorityMap[ticket.priority] || 3} }) { success } }`;
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation }),
      });
      const data = await res.json();
      if (data.data?.issueCreate?.success) created++; else failed++;
    } catch { failed++; }
  }
  appendSystemMessage(`Linear: ${created} issues created${failed ? `, ${failed} failed` : ''}.`);
}

async function exportToNotion(token, dbId) {
  if (!token || !dbId) return;
  const tickets = projectData.tickets.filter(t => t.status !== 'done');
  let created = 0, failed = 0;

  for (const ticket of tickets) {
    try {
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            Name:     { title: [{ text: { content: `[${ticket.id}] ${ticket.title}` } }] },
            Status:   { select: { name: ticket.status } },
            Priority: { select: { name: ticket.priority || 'medium' } },
          },
          children: ticket.description ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: ticket.description } }] } }] : [],
        }),
      });
      if (res.ok) created++; else failed++;
    } catch { failed++; }
  }
  appendSystemMessage(`Notion: ${created} pages created${failed ? `, ${failed} failed` : ''}.`);
}

// ─── Search & filter ──────────────────────────────────────────────────────────
function toggleSearch() {
  const bar = get('search-bar');
  if (bar.style.display === 'none') {
    bar.style.display = 'flex';
    get('search-input')?.focus();
  } else {
    closeSearch();
  }
}

function closeSearch() {
  searchQuery = ''; searchFilter = '';
  const input = get('search-input');
  if (input) input.value = '';
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.filter-pill[data-filter=""]')?.classList.add('active');
  get('search-bar').style.display = 'none';
  applySearch(); // clear filters
}

function applySearch() {
  const query  = searchQuery.toLowerCase().trim();
  const filter = searchFilter;
  const cards  = document.querySelectorAll('.ticket-card[data-ticket-id]');
  let visible = 0; let total = 0;

  cards.forEach(card => {
    const id = card.dataset.ticketId || '';
    const ticket = projectData?.tickets.find(t => t.id === id);
    if (!ticket) { card.style.display = ''; return; }
    total++;

    const matchesQuery = !query
      || ticket.id.toLowerCase().includes(query)
      || ticket.title.toLowerCase().includes(query)
      || (ticket.notes  || '').toLowerCase().includes(query)
      || (ticket.tags   || []).some(t => t.toLowerCase().includes(query))
      || (ticket.description || '').toLowerCase().includes(query);

    const matchesFilter = !filter
      || ticket.status === filter
      || (filter === 'high' && (ticket.priority === 'high' || ticket.priority === 'critical'));

    const show = matchesQuery && matchesFilter;
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  // Update count badge
  const countEl = get('search-count');
  if (countEl) {
    countEl.textContent = (query || filter) && total > 0
      ? `${visible} of ${total}`
      : '';
  }

  // Per-column "no results" placeholder
  document.querySelectorAll('.kanban-drop-zone').forEach(zone => {
    const hasVisible = [...zone.querySelectorAll('.ticket-card')].some(c => c.style.display !== 'none');
    let emptyEl = zone.querySelector('.search-empty');
    if (!hasVisible && (query || filter)) {
      if (!emptyEl) {
        emptyEl = document.createElement('p');
        emptyEl.className = 'kanban-empty search-empty';
        emptyEl.textContent = 'No results';
        zone.appendChild(emptyEl);
      }
    } else if (emptyEl) {
      emptyEl.remove();
    }
  });
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────────
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    const mod = e.metaKey || e.ctrlKey;

    if (e.key === 'Escape') {
      if (get('search-bar')?.style.display !== 'none') { closeSearch(); return; }
      if (inInput) { e.target.blur(); return; }
      if (get('ticket-editor').classList.contains('open')) { closeTicketEditor(); return; }
      if (get('settings-overlay').style.display !== 'none') { closeSettings(); return; }
      if (get('shortcuts-help').style.display !== 'none') { get('shortcuts-help').style.display = 'none'; }
      return;
    }

    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      get('chat-input')?.focus();
      return;
    }

    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (projectData) toggleSearch();
      return;
    }

    if (inInput) return; // all other shortcuts require not typing

    switch (e.key) {
      case '/': e.preventDefault(); get('chat-input')?.focus(); break;
      case 'b': if (projectData) renderDirect('kanban');   break;
      case 's': if (projectData) renderDirect('standup');  break;
      case 'p': if (projectData) renderDirect('progress'); break;
      case 'v': if (projectData) renderDirect('velocity'); break;
      case 'd': if (projectData) renderDirect('burndown'); break;
      case 'e': if (projectData) renderDirect('eod');      break;
      case '?': toggleShortcutsHelp(); break;
    }
  });
}

function toggleShortcutsHelp() {
  const el = get('shortcuts-help');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// Direct render — no AI call, no request consumed
function renderDirect(uiType) {
  if (!projectData) return;
  const done = projectData.tickets.filter(t => t.status === 'done').length;
  const total = projectData.tickets.length;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const todayDate = new Date().toISOString().slice(0, 10);
  const configs = {
    kanban: {
      data: { tickets: projectData.tickets },
      message: `${total} tickets across ${projectData.milestones.length} milestones.`,
      actions: [{ label: "Today's standup", action: 'show_standup' }, { label: 'Progress', action: 'show_progress' }]
    },
    standup: {
      data: { tickets: projectData.tickets, project: projectData.project, milestones: projectData.milestones },
      message: `Focus for ${today}.`,
      actions: [{ label: 'Board', action: 'show_kanban' }, { label: 'Progress', action: 'show_progress' }]
    },
    progress: {
      data: { tickets: projectData.tickets, milestones: projectData.milestones },
      message: `${done} of ${total} tickets done.`,
      actions: [{ label: 'Board', action: 'show_kanban' }, { label: 'Standup', action: 'show_standup' }]
    },
    velocity: {
      data: { tickets: projectData.tickets },
      message: 'Weekly ticket throughput for this project.',
      actions: [{ label: 'Burndown', action: 'show_burndown' }, { label: 'Board', action: 'show_kanban' }]
    },
    burndown: {
      data: { tickets: projectData.tickets, milestones: projectData.milestones },
      message: 'Remaining work vs time for the current milestone.',
      actions: [{ label: 'Velocity', action: 'show_velocity' }, { label: 'Progress', action: 'show_progress' }]
    },
    eod: {
      data: { tickets: projectData.tickets, date: todayDate },
      message: `End of day — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`,
      actions: [{ label: 'Board', action: 'show_kanban' }, { label: 'Velocity', action: 'show_velocity' }]
    }
  };

  const cfg = configs[uiType];
  if (!cfg) return;
  renderResponse(JSON.stringify({ ui: uiType, ...cfg }), get('ui-content'));
  if (uiType === 'kanban') applySearch();
}

// ─── Ticket editor ─────────────────────────────────────────────────────────────
function openTicketEditor(ticketId) {
  const ticket = projectData?.tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  editingTicketId = ticketId;

  get('editor-ticket-id').textContent = ticket.id;
  get('editor-title').value       = ticket.title       || '';
  get('editor-status').value      = ticket.status      || 'backlog';
  get('editor-priority').value    = ticket.priority    || 'medium';
  get('editor-due-date').value    = ticket.dueDate     || '';
  get('editor-desc').value        = ticket.description || '';
  get('editor-notes').value       = ticket.notes       || '';
  get('editor-blocked-by').value  = (ticket.blockedBy  || []).join(', ');
  get('editor-tags').value        = (ticket.tags       || []).join(', ');

  // Populate milestone dropdown
  const msEl = get('editor-milestone');
  msEl.innerHTML = '';
  projectData.milestones.forEach(ms => {
    const opt = document.createElement('option');
    opt.value = ms.id;
    opt.textContent = ms.title;
    opt.selected = ms.id === ticket.milestoneId;
    msEl.appendChild(opt);
  });

  get('ticket-editor').classList.add('open');
  get('ticket-editor-backdrop').classList.add('open');
  setTimeout(() => get('editor-title')?.focus(), 250); // wait for slide animation
}

function closeTicketEditor() {
  get('ticket-editor').classList.remove('open');
  get('ticket-editor-backdrop').classList.remove('open');
  editingTicketId = null;
}

function saveTicketEdit() {
  const ticket = projectData?.tickets.find(t => t.id === editingTicketId);
  if (!ticket) { closeTicketEditor(); return; }

  const newTitle = get('editor-title').value.trim();
  ticket.title       = newTitle || ticket.title;
  ticket.status      = get('editor-status').value;
  ticket.priority    = get('editor-priority').value;
  ticket.dueDate     = get('editor-due-date').value || null;
  ticket.description = get('editor-desc').value.trim();
  ticket.notes       = get('editor-notes').value.trim();
  ticket.milestoneId = get('editor-milestone').value;
  ticket.blockedBy   = get('editor-blocked-by').value.split(',').map(s => s.trim()).filter(Boolean);
  ticket.tags        = get('editor-tags').value.split(',').map(s => s.trim()).filter(Boolean);
  ticket.updatedAt   = new Date().toISOString();
  if (ticket.status === 'done') { if (!ticket.completedAt) ticket.completedAt = new Date().toISOString(); }
  else ticket.completedAt = null;

  Storage.save(projectData);
  updateHeader();
  recordMutation(ticket.id, ticket.status);
  pushMcpContext();
  closeTicketEditor();
  appendSystemMessage(`${ticket.id} saved.`);
  renderDirect('kanban');
}

function deleteTicket(ticketId) {
  if (!ticketId) return;
  if (!confirm(`Delete ${ticketId}? This cannot be undone.`)) return;
  projectData.tickets = projectData.tickets.filter(t => t.id !== ticketId);
  projectData.milestones.forEach(ms => {
    ms.ticketIds = (ms.ticketIds || []).filter(id => id !== ticketId);
  });
  Storage.save(projectData);
  closeTicketEditor();
  appendSystemMessage(`${ticketId} deleted.`);
  renderDirect('kanban');
}

// ─── Project switcher ─────────────────────────────────────────────────────────
function openProjectSwitcher() {
  const index = Storage.getIndex();
  const list  = get('projects-list');
  list.replaceChildren();

  if (index.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'padding:20px;color:var(--text-3);font-size:13px';
    empty.textContent = 'No projects yet.';
    list.appendChild(empty);
  } else {
    [...index]
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .forEach(entry => list.appendChild(buildProjectRow(entry)));
  }

  get('projects-overlay').style.display = 'flex';
}

function closeProjectSwitcher() {
  get('projects-overlay').style.display = 'none';
}

function buildProjectRow(entry) {
  const isCurrent = entry.id === projectData?.project?.id;
  const row = document.createElement('div');
  row.className = `project-row${isCurrent ? ' current' : ''}`;

  const info = document.createElement('div');
  info.className = 'project-row-info';
  const name = document.createElement('span');
  name.className = 'project-row-name';
  name.textContent = entry.name;

  const meta = document.createElement('span');
  meta.className = 'project-row-meta';
  const updated = new Date(entry.lastModified).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  meta.textContent = `${entry.milestoneTitle || '—'} · updated ${updated}`;

  info.append(name, meta);

  const actions = document.createElement('div');
  actions.className = 'project-row-actions';

  // Due date tag
  if (entry.dueDate && !isCurrent) {
    const days = daysUntil(entry.dueDate);
    if (days !== null && days <= 7) {
      const tag = document.createElement('span');
      tag.className = `project-due-tag ${dueBadgeClass(days)}`;
      tag.textContent = dueLabel(days);
      actions.appendChild(tag);
    }
  }

  if (isCurrent) {
    const tag = document.createElement('span');
    tag.className = 'project-current-tag';
    tag.textContent = 'Current';
    actions.appendChild(tag);
  } else {
    const switchBtn = document.createElement('button');
    switchBtn.className = 'btn-secondary';
    switchBtn.style.fontSize = '12px';
    switchBtn.style.padding = '5px 12px';
    switchBtn.textContent = 'Switch';
    switchBtn.addEventListener('click', () => switchToProject(entry.id));
    actions.appendChild(switchBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger-sm';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', e => { e.stopPropagation(); deleteProjectById(entry.id); });
  actions.appendChild(delBtn);

  row.append(info, actions);
  return row;
}

function switchToProject(id) {
  const next = Storage.loadById(id);
  if (!next) return;
  projectData = next;
  chatHistory = []; displayMessages = [];
  SESSION.requestCount = 0;
  get('chat-messages').replaceChildren();
  closeProjectSwitcher();
  showMainApp();
  handleFirstRender();
}

function startNewProject() {
  isAddingProject = true;
  closeProjectSwitcher();
  onboardingInfo = { name: '', goal: '', description: '', provider: SESSION.provider || 'openrouter' };
  // Reset step 1 fields
  const pn = get('project-name'); if (pn) pn.value = '';
  const pg = get('project-goal'); if (pg) pg.value = '';
  const pd = get('project-desc'); if (pd) pd.value = '';
  get('onboarding').style.display = 'flex';
  get('main-app').style.display = 'none';
  goToStep(1);
}

function deleteProjectById(id) {
  const entry = Storage.getIndex().find(p => p.id === id);
  if (!confirm(`Delete "${entry?.name || id}"? This cannot be undone.`)) return;
  Storage.deleteById(id);
  if (id === projectData?.project?.id) {
    // Deleted the current project — switch or go to onboarding
    const remaining = Storage.getIndex();
    closeProjectSwitcher();
    if (remaining.length > 0) {
      const sorted = [...remaining].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
      switchToProject(sorted[0].id);
    } else {
      projectData = null; chatHistory = []; displayMessages = [];
      get('chat-messages').replaceChildren();
      showOnboarding();
    }
  } else {
    openProjectSwitcher(); // refresh list
  }
}

// Also update renderDirect to include milestones for standup due dates
function populateOnboardingModelPicker(provider) {
  const select = get('onboarding-model-select');
  const picker = get('openrouter-model-picker');
  if (!select || !picker) return;
  if (provider !== 'openrouter') { picker.style.display = 'none'; return; }
  picker.style.display = 'block';
  const models = PROVIDERS.openrouter.models;
  select.innerHTML = '';
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    opt.selected = m === PROVIDERS.openrouter.defaultModel;
    select.appendChild(opt);
  });
}

function fieldError(id, msg) {
  const input = get(id);
  const group = input?.closest('.form-group') || get(id);
  if (group) group.classList.add('has-error');
  const errEl = input?.closest('.form-group')?.querySelector('.field-error');
  if (errEl) errEl.textContent = msg;
}

function clearError(id) {
  const input = get(id);
  const group = input?.closest('.form-group');
  if (group) group.classList.remove('has-error');
}
