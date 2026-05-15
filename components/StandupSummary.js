import { createActionButtons, createHeader, el, daysUntil, dueLabel, dueBadgeClass } from './shared.js';

export function StandupSummary(data, message, actions) {
  const tickets = data.tickets || [];
  const goal = data.project?.goal || '';

  const active = tickets.filter(t => t.status === 'in-progress');
  const high = tickets.filter(t =>
    t.status === 'backlog' && (t.priority === 'high' || t.priority === 'critical')
  ).slice(0, 5);
  const blocked = tickets.filter(t => t.status === 'blocked');

  const now = new Date();
  const timeStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const wrapper = el('div', 'ui-standup');

  const headerEl = createHeader('Daily Standup', message);
  const dateTag = el('span', 'standup-date');
  dateTag.textContent = timeStr;
  headerEl.appendChild(dateTag);
  wrapper.appendChild(headerEl);

  if (goal) {
    const goalBanner = el('div', 'standup-goal');
    const goalLabel = el('span', 'standup-goal-label');
    goalLabel.textContent = 'Goal: ';
    const goalText = el('span', '');
    goalText.textContent = goal;
    goalBanner.append(goalLabel, goalText);
    wrapper.appendChild(goalBanner);
  }

  // Due date banner for current milestone
  const currentMs = (data.milestones || []).find(m => m.id === data.project?.currentMilestone)
    || (data.milestones || [])[0];
  if (currentMs?.dueDate && currentMs.status !== 'done') {
    const days = daysUntil(currentMs.dueDate);
    if (days !== null && days <= 14) {
      const dueBanner = el('div', `standup-due-banner ${dueBadgeClass(days)}`);
      const msName = el('span', 'standup-due-ms');
      msName.textContent = currentMs.title + ':';
      const dueText = el('span', '');
      dueText.textContent = ' ' + dueLabel(days);
      dueBanner.append(msName, dueText);
      wrapper.appendChild(dueBanner);
    }
  }

  wrapper.appendChild(buildSection('In Progress', active, 'in-progress', 'in-progress'));
  wrapper.appendChild(buildSection('Up Next', high, 'high', 'backlog'));

  if (blocked.length > 0) {
    wrapper.appendChild(buildSection('Blocked', blocked, 'blocked', 'blocked'));
  }

  if (active.length === 0 && high.length === 0) {
    const empty = el('div', 'empty-state');
    const msg = el('p', 'empty-msg');
    msg.textContent = 'No active tasks. Pick something from your backlog!';
    empty.appendChild(msg);
    wrapper.appendChild(empty);
  }

  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}

function buildSection(title, tickets, colorClass, statusClass) {
  const section = el('div', 'standup-section');

  const header = el('div', 'standup-section-header');
  const dot = el('span', `standup-dot status-dot-${colorClass}`);
  const heading = el('h3', 'standup-section-title');
  heading.textContent = title;
  const count = el('span', 'standup-count');
  count.textContent = tickets.length;
  header.append(dot, heading, count);
  section.appendChild(header);

  if (tickets.length === 0) {
    const empty = el('p', 'standup-empty');
    empty.textContent = 'Nothing here';
    section.appendChild(empty);
    return section;
  }

  const list = el('div', 'standup-list');
  tickets.forEach(t => list.appendChild(buildStandupRow(t, statusClass)));
  section.appendChild(list);

  return section;
}

function buildStandupRow(ticket, statusClass) {
  const row = el('div', 'standup-row');
  row.dataset.ticketId = ticket.id;

  const left = el('div', 'standup-row-left');
  const id = el('span', 'ticket-id');
  id.textContent = ticket.id;
  const title = el('span', 'standup-row-title');
  title.textContent = ticket.title;
  left.append(id, title);

  const badge = el('span', `priority-badge priority-${ticket.priority || 'medium'}`);
  badge.textContent = ticket.priority || 'medium';

  const btn = el('button', 'action-btn action-btn-sm');
  if (statusClass === 'in-progress') {
    btn.textContent = 'Done';
    btn.dataset.action = `mark_done_${ticket.id}`;
  } else if (statusClass === 'backlog') {
    btn.textContent = 'Start';
    btn.dataset.action = `start_work_${ticket.id}`;
  } else {
    btn.textContent = 'Unblock';
    btn.dataset.action = `start_work_${ticket.id}`;
  }

  row.append(left, badge, btn);
  return row;
}
