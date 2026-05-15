import { createActionButtons, createHeader, el } from './shared.js';

const STATUS_LABELS = {
  'backlog': 'Backlog',
  'in-progress': 'In Progress',
  'done': 'Done',
  'blocked': 'Blocked',
  'suspended': 'Suspended'
};

export function TicketList(data, message, actions) {
  const tickets = data.tickets || [];
  const wrapper = el('div', 'ui-tickets');
  wrapper.appendChild(createHeader('Tickets', message));

  if (tickets.length === 0) {
    const empty = el('div', 'empty-state');
    const msg = el('p', 'empty-msg');
    msg.textContent = 'No tickets to show.';
    empty.appendChild(msg);
    wrapper.appendChild(empty);
  } else if (tickets.length === 1) {
    wrapper.appendChild(buildTicketDetail(tickets[0]));
  } else {
    const list = el('div', 'ticket-list');
    tickets.forEach(t => list.appendChild(buildTicketRow(t)));
    wrapper.appendChild(list);
  }

  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}

function buildTicketDetail(ticket) {
  const card = el('div', 'ticket-detail');
  card.dataset.ticketId = ticket.id;

  const headerRow = el('div', 'ticket-detail-header');
  const id = el('span', 'ticket-detail-id');
  id.textContent = ticket.id;
  const statusBadge = el('span', `status-badge status-${ticket.status}`);
  statusBadge.textContent = STATUS_LABELS[ticket.status] || ticket.status;
  const priorityBadge = el('span', `priority-badge priority-${ticket.priority || 'medium'}`);
  priorityBadge.textContent = ticket.priority || 'medium';
  headerRow.append(id, statusBadge, priorityBadge);

  const title = el('h2', 'ticket-detail-title');
  title.textContent = ticket.title;

  card.append(headerRow, title);

  if (ticket.description) {
    const desc = el('p', 'ticket-detail-desc');
    desc.textContent = ticket.description;
    card.appendChild(desc);
  }

  if (ticket.notes) {
    const notesSection = el('div', 'ticket-detail-section');
    const notesLabel = el('span', 'ticket-detail-label');
    notesLabel.textContent = 'Notes';
    const notesText = el('p', 'ticket-detail-notes');
    notesText.textContent = ticket.notes;
    notesSection.append(notesLabel, notesText);
    card.appendChild(notesSection);
  }

  if (ticket.blockedBy?.length) {
    const depSection = el('div', 'ticket-detail-section');
    const depLabel = el('span', 'ticket-detail-label');
    depLabel.textContent = 'Blocked by';
    const depText = el('p', 'ticket-detail-dep');
    depText.textContent = ticket.blockedBy.join(', ');
    depSection.append(depLabel, depText);
    card.appendChild(depSection);
  }

  if (ticket.tags?.length) {
    const tagsRow = el('div', 'ticket-tags');
    ticket.tags.forEach(tag => {
      const tagEl = el('span', 'ticket-tag');
      tagEl.textContent = tag;
      tagsRow.appendChild(tagEl);
    });
    card.appendChild(tagsRow);
  }

  const meta = el('div', 'ticket-detail-meta');
  if (ticket.createdAt) {
    const created = el('span', 'ticket-meta-item');
    created.textContent = `Created ${formatDate(ticket.createdAt)}`;
    meta.appendChild(created);
  }
  if (ticket.updatedAt) {
    const updated = el('span', 'ticket-meta-item');
    updated.textContent = `Updated ${formatDate(ticket.updatedAt)}`;
    meta.appendChild(updated);
  }
  card.appendChild(meta);

  // Quick actions for this ticket
  const quickActions = el('div', 'ticket-quick-actions');
  if (ticket.status !== 'done') {
    const doneBtn = el('button', 'action-btn');
    doneBtn.textContent = 'Mark Done';
    doneBtn.dataset.action = `mark_done_${ticket.id}`;
    quickActions.appendChild(doneBtn);
  }
  if (ticket.status === 'backlog') {
    const startBtn = el('button', 'action-btn');
    startBtn.textContent = 'Start Work';
    startBtn.dataset.action = `start_work_${ticket.id}`;
    quickActions.appendChild(startBtn);
  }
  card.appendChild(quickActions);

  return card;
}

function buildTicketRow(ticket) {
  const row = el('div', 'ticket-row');
  row.dataset.ticketId = ticket.id;

  const left = el('div', 'ticket-row-left');
  const id = el('span', 'ticket-id');
  id.textContent = ticket.id;
  const title = el('span', 'ticket-row-title');
  title.textContent = ticket.title;
  left.append(id, title);

  const right = el('div', 'ticket-row-right');
  const status = el('span', `status-badge status-${ticket.status}`);
  status.textContent = STATUS_LABELS[ticket.status] || ticket.status;
  const priority = el('span', `priority-badge priority-${ticket.priority || 'medium'}`);
  priority.textContent = ticket.priority || 'medium';
  right.append(status, priority);

  row.append(left, right);
  return row;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return iso; }
}
