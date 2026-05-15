import { createActionButtons, createHeader, el } from './shared.js';

export function EodSummary(data, message, actions) {
  const tickets    = data.tickets    || [];
  const today      = data.date       || new Date().toISOString().slice(0, 10);
  const todayFmt   = new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const completed  = tickets.filter(t => t.completedAt?.slice(0, 10) === today);
  const progressed = tickets.filter(t => t.status === 'in-progress' && t.updatedAt?.slice(0, 10) === today && !completed.includes(t));
  const created    = tickets.filter(t => t.createdAt?.slice(0, 10) === today && !completed.includes(t));

  const wrapper = el('div', 'ui-eod');
  wrapper.appendChild(createHeader('End of Day', message || `Here's what you accomplished on ${todayFmt}.`));

  // Summary pills
  const pills = el('div', 'eod-pills');
  [
    [completed.length,  '✓',  'Shipped',     'eod-pill-done'],
    [progressed.length, '⟳',  'In progress', 'eod-pill-progress'],
    [created.length,    '+',  'Created',     'eod-pill-new'],
  ].forEach(([count, icon, label, cls]) => {
    if (count === 0) return;
    const pill = el('div', `eod-pill ${cls}`);
    const ic = el('span', 'eod-pill-icon'); ic.textContent = icon;
    const num = el('span', 'eod-pill-count'); num.textContent = count;
    const lbl = el('span', 'eod-pill-label'); lbl.textContent = label;
    pill.append(ic, num, lbl);
    pills.appendChild(pill);
  });
  wrapper.appendChild(pills);

  if (completed.length === 0 && progressed.length === 0 && created.length === 0) {
    const empty = el('div', 'empty-state');
    const msg = el('p', 'empty-msg'); msg.textContent = 'Nothing recorded yet today. Start a ticket to track your work.';
    empty.appendChild(msg); wrapper.appendChild(empty);
  }

  if (completed.length > 0) wrapper.appendChild(buildSection('Shipped today', completed, 'eod-section-done'));
  if (progressed.length > 0) wrapper.appendChild(buildSection('Still in progress', progressed, ''));
  if (created.length > 0) wrapper.appendChild(buildSection('Created today', created, ''));

  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}

function buildSection(title, tickets, cls) {
  const section = el('div', `eod-section ${cls}`);
  const heading = el('h3', 'eod-section-title'); heading.textContent = title;
  section.appendChild(heading);

  tickets.forEach(ticket => {
    const row = el('div', 'eod-ticket-row');
    const id = el('span', 'ticket-id'); id.textContent = ticket.id;
    const ttl = el('span', 'eod-ticket-title'); ttl.textContent = ticket.title;
    const badge = el('span', `priority-badge priority-${ticket.priority || 'medium'}`); badge.textContent = ticket.priority || 'medium';
    row.append(id, ttl, badge);
    section.appendChild(row);
  });

  return section;
}
