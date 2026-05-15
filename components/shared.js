export function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function createHeader(title, message) {
  const header = el('div', 'ui-section-header');
  const h = el('h2', 'ui-section-title');
  h.textContent = title;
  header.appendChild(h);
  if (message) {
    const sub = el('p', 'ui-section-message');
    sub.textContent = message;
    header.appendChild(sub);
  }
  return header;
}

export function createActionButtons(actions) {
  const row = el('div', 'action-buttons');
  actions.forEach(({ label, action }) => {
    const btn = el('button', 'action-btn');
    btn.textContent = label;
    btn.dataset.action = action;
    row.appendChild(btn);
  });
  return row;
}

// ─── Date utilities ──────────────────────────────────────────────────────────

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  try {
    const due = new Date(dateStr); due.setHours(0,0,0,0);
    const now = new Date();       now.setHours(0,0,0,0);
    return Math.round((due - now) / 86400000);
  } catch { return null; }
}

export function dueBadgeClass(days) {
  if (days === null) return '';
  if (days < 0)  return 'due-overdue';
  if (days <= 3) return 'due-critical';
  if (days <= 7) return 'due-soon';
  return 'due-ok';
}

export function dueLabel(days) {
  if (days === null) return '';
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days}d left`;
}
