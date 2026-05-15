const INDEX_KEY     = 'stowaway_index';
const PROJECT_PFX   = 'stowaway_project_';
const CHAT_PFX      = 'stowaway_chat_';
const LEGACY_KEY    = 'stowaway_project'; // pre-multi-project format

export const Storage = {

  // ─── Migration ──────────────────────────────────────────────────────────────
  migrate() {
    if (localStorage.getItem(INDEX_KEY)) return; // already on new format
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    try {
      const project = JSON.parse(legacy);
      const id = project.project?.id || 'proj_legacy';
      localStorage.setItem(PROJECT_PFX + id, legacy);
      const ms = project.milestones?.find(m => m.id === project.project?.currentMilestone);
      const index = [{
        id,
        name: project.project?.name || 'Project',
        goal: project.project?.goal || '',
        lastModified: project.meta?.lastModified || new Date().toISOString(),
        milestoneTitle: ms?.title || '',
        dueDate: ms?.dueDate || ''
      }];
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
      localStorage.removeItem(LEGACY_KEY);
    } catch {}
  },

  // ─── Project index ───────────────────────────────────────────────────────────
  getIndex() {
    try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); }
    catch { return []; }
  },

  _updateIndex(project) {
    const index = this.getIndex();
    const ms = project.milestones?.find(m => m.id === project.project?.currentMilestone);
    const entry = {
      id:             project.project.id,
      name:           project.project.name,
      goal:           project.project.goal || '',
      lastModified:   project.meta.lastModified,
      milestoneTitle: ms?.title || '',
      dueDate:        ms?.dueDate || ''
    };
    const i = index.findIndex(p => p.id === entry.id);
    if (i >= 0) index[i] = entry; else index.push(entry);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  },

  // ─── Load / save ─────────────────────────────────────────────────────────────
  load() {
    this.migrate();
    const index = this.getIndex();
    if (!index.length) return null;
    const sorted = [...index].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    return this.loadById(sorted[0].id);
  },

  loadById(id) {
    try { return JSON.parse(localStorage.getItem(PROJECT_PFX + id) || 'null'); }
    catch { return null; }
  },

  save(project) {
    try {
      project.meta.lastModified = new Date().toISOString();
      localStorage.setItem(PROJECT_PFX + project.project.id, JSON.stringify(project));
      this._updateIndex(project);
      return true;
    } catch { return false; }
  },

  deleteById(id) {
    localStorage.removeItem(PROJECT_PFX + id);
    this.clearChat(id);
    const index = this.getIndex().filter(p => p.id !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  },

  // kept for compat — clears legacy key only
  clear() { localStorage.removeItem(LEGACY_KEY); },

  // ─── Chat ────────────────────────────────────────────────────────────────────
  saveChat(projectId, history, display) {
    try {
      localStorage.setItem(CHAT_PFX + projectId, JSON.stringify({
        v: '1', history: history.slice(-50), display: display.slice(-100)
      }));
    } catch {}
  },

  loadChat(projectId) {
    try {
      const raw = localStorage.getItem(CHAT_PFX + projectId);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data.v === '1' ? data : null;
    } catch { return null; }
  },

  clearChat(projectId) {
    if (projectId) localStorage.removeItem(CHAT_PFX + projectId);
  },

  // ─── Export / import ─────────────────────────────────────────────────────────
  exportJSON(project) {
    const name = project?.project?.name?.replace(/\s+/g, '-').toLowerCase() || 'project';
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stowaway-${name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.project || !Array.isArray(data.tickets) || !Array.isArray(data.milestones)) {
            reject(new Error('Invalid Stowaway project file — missing required fields.')); return;
          }
          // Normalise tickets
          data.tickets = data.tickets.map(t => ({
            id: t.id || `T${Date.now()}`, title: t.title || 'Untitled',
            description: t.description || '',
            status: ['backlog','in-progress','done','blocked','suspended'].includes(t.status) ? t.status : 'backlog',
            priority: ['low','medium','high','critical'].includes(t.priority) ? t.priority : 'medium',
            milestoneId: t.milestoneId || '',
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
            dueDate: t.dueDate || null,
            tags: Array.isArray(t.tags) ? t.tags : [],
            blockedBy: Array.isArray(t.blockedBy) ? t.blockedBy : [],
            notes: t.notes || '', git_branch: t.git_branch || null
          }));
          this.save(data);
          resolve(data);
        } catch { reject(new Error('Could not parse JSON file.')); }
      };
      reader.onerror = () => reject(new Error('File read failed.'));
      reader.readAsText(file);
    });
  }
};
