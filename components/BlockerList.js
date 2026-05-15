import { createActionButtons, createHeader, el } from './shared.js';

export function BlockerList(data, message, actions) {
  const tickets = (data.tickets || []).filter(t =>
    t.status === 'blocked' || (t.blockedBy && t.blockedBy.length > 0)
  );

  const wrapper = el('div', 'ui-blockers');
  wrapper.appendChild(createHeader('Blockers', message));

  if (tickets.length === 0) {
    const empty = el('div', 'empty-state');
    const icon = el('div', 'empty-icon');
    icon.textContent = '✓';
    const msg = el('p', 'empty-msg');
    msg.textContent = "No blockers. You're clear to ship.";
    empty.append(icon, msg);
    wrapper.appendChild(empty);
  } else {
    const list = el('div', 'blockers-list');
    tickets.forEach(t => list.appendChild(buildBlockerCard(t)));
    wrapper.appendChild(list);
  }

  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}

function buildBlockerCard(ticket) {
  const card = el('div', 'blocker-card');
  card.dataset.ticketId = ticket.id;

  const header = el('div', 'blocker-card-header');
  const id = el('span', 'ticket-id');
  id.textContent = ticket.id;
  const badge = el('span', `priority-badge priority-${ticket.priority || 'medium'}`);
  badge.textContent = ticket.priority || 'medium';
  header.append(id, badge);

  const title = el('p', 'blocker-title');
  title.textContent = ticket.title;

  card.append(header, title);

  if (ticket.blockedBy?.length) {
    const dep = el('div', 'blocker-dep');
    const depLabel = el('span', 'blocker-dep-label');
    depLabel.textContent = 'Waiting on: ';
    const depIds = el('span', 'blocker-dep-ids');
    depIds.textContent = ticket.blockedBy.join(', ');
    dep.append(depLabel, depIds);
    card.appendChild(dep);
  }

  if (ticket.notes) {
    const notes = el('p', 'blocker-notes');
    notes.textContent = ticket.notes;
    card.appendChild(notes);
  }

  const actions = el('div', 'blocker-actions');
  const unblockBtn = el('button', 'action-btn action-btn-sm');
  unblockBtn.textContent = 'Mark unblocked';
  unblockBtn.dataset.action = `start_work_${ticket.id}`;
  actions.appendChild(unblockBtn);
  card.appendChild(actions);

  return card;
}
