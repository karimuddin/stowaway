import { createActionButtons, createHeader, el, daysUntil, dueBadgeClass, dueLabel } from './shared.js';

const COLUMNS = [
  { status: 'in-progress', label: 'In Progress', color: '#6366f1' },
  { status: 'backlog',     label: 'Backlog',      color: '#71717a' },
  { status: 'blocked',     label: 'Blocked',      color: '#ef4444' },
  { status: 'suspended',   label: 'Suspended',    color: '#f59e0b' },
  { status: 'done',        label: 'Done',         color: '#22c55e' }
];

export function KanbanBoard(data, message, actions) {
  const tickets = data.tickets || [];
  const wrapper = el('div', 'ui-kanban');

  wrapper.appendChild(createHeader('Board', message));

  const hasSuspended = tickets.some(t => t.status === 'suspended');
  const board = el('div', 'kanban-board');
  COLUMNS
    .filter(col => col.status !== 'suspended' || hasSuspended)
    .forEach(col => {
      board.appendChild(buildColumn(col, tickets.filter(t => t.status === col.status)));
    });
  wrapper.appendChild(board);

  setupDragAndDrop(board);

  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}

function buildColumn({ status, label, color }, tickets) {
  const col = el('div', 'kanban-col');
  col.dataset.status = status; // used by drop handler

  const header = el('div', 'kanban-col-header');
  const dot = el('span', 'kanban-dot');
  dot.style.background = color;
  const labelEl = el('span', 'kanban-col-label');
  labelEl.textContent = label;
  const count = el('span', 'kanban-col-count');
  count.textContent = tickets.length;
  header.append(dot, labelEl, count);
  col.appendChild(header);

  const dropZone = el('div', 'kanban-drop-zone');
  if (tickets.length === 0) {
    const empty = el('p', 'kanban-empty');
    empty.textContent = 'Drop here';
    dropZone.appendChild(empty);
  } else {
    tickets.forEach(t => dropZone.appendChild(buildTicketCard(t)));
  }
  col.appendChild(dropZone);

  return col;
}

function buildTicketCard(ticket) {
  const card = el('div', `ticket-card priority-left-${ticket.priority || 'medium'}`);
  card.dataset.ticketId = ticket.id;
  card.draggable = true;
  card.title = 'Drag to move · Click to edit';

  // Drag grip indicator (visible on hover via CSS)
  const grip = el('span', 'drag-grip');
  grip.textContent = '⠿';
  grip.setAttribute('aria-hidden', 'true');

  const top = el('div', 'ticket-card-top');
  const id = el('span', 'ticket-id');
  id.textContent = ticket.id;
  const badge = buildPriorityBadge(ticket.priority);
  top.append(id, badge);

  const title = el('p', 'ticket-title');
  title.textContent = ticket.title;

  card.append(grip, top, title);

  if (ticket.dueDate) {
    const days = daysUntil(ticket.dueDate);
    if (days !== null && days <= 14) {
      const dueBadge = el('span', `ticket-due-badge ${dueBadgeClass(days)}`);
      dueBadge.textContent = dueLabel(days);
      card.appendChild(dueBadge);
    }
  }

  if (ticket.notes) {
    const notes = el('p', 'ticket-notes');
    notes.textContent = ticket.notes;
    card.appendChild(notes);
  }

  if (ticket.blockedBy?.length) {
    const blocked = el('p', 'ticket-blocked-by');
    blocked.textContent = `Blocked by: ${ticket.blockedBy.join(', ')}`;
    card.appendChild(blocked);
  }

  return card;
}

function buildPriorityBadge(priority) {
  const badge = el('span', `priority-badge priority-${priority || 'medium'}`);
  badge.textContent = priority || 'medium';
  return badge;
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

function setupDragAndDrop(board) {
  let draggedEl  = null;
  let sourceCol  = null;

  // ── Drag source (card events via delegation on board) ──
  board.addEventListener('dragstart', e => {
    const card = e.target.closest('.ticket-card[draggable]');
    if (!card) return;
    draggedEl = card;
    sourceCol = card.closest('.kanban-col');
    e.dataTransfer.setData('text/plain', card.dataset.ticketId);
    e.dataTransfer.effectAllowed = 'move';
    // Delay adding class so the drag ghost captures the normal card style
    requestAnimationFrame(() => card.classList.add('dragging'));
  });

  board.addEventListener('dragend', () => {
    if (draggedEl) draggedEl.classList.remove('dragging');
    board.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over', 'drag-over-reject'));
    draggedEl = null;
    sourceCol = null;
  });

  // ── Drop targets (each column) ──
  board.querySelectorAll('.kanban-col').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    col.addEventListener('dragenter', e => {
      e.preventDefault();
      if (!draggedEl) return;
      board.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
      // Highlight only if different column
      if (col !== sourceCol) col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', e => {
      // Only clear highlight when truly leaving the column (not entering a child)
      if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
    });

    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const ticketId = e.dataTransfer.getData('text/plain');
      const newStatus = col.dataset.status;
      if (!ticketId || !newStatus || col === sourceCol) return;

      // Bubble up to app.js via a custom event — keeps the component data-agnostic
      col.dispatchEvent(new CustomEvent('ticket-moved', {
        detail: { id: ticketId, status: newStatus },
        bubbles: true
      }));
    });
  });
}
