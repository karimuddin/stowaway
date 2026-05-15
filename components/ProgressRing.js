import { createActionButtons, createHeader, el, daysUntil, dueBadgeClass, dueLabel } from './shared.js';

export function ProgressRing(data, message, actions) {
  const tickets = data.tickets || [];
  const milestones = data.milestones || [];

  const total = tickets.length;
  const done = tickets.filter(t => t.status === 'done').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const wrapper = el('div', 'ui-progress');
  wrapper.appendChild(createHeader('Progress', message));

  const body = el('div', 'progress-body');

  // SVG ring
  body.appendChild(buildRing(percent));

  // Stats row
  const stats = el('div', 'progress-stats');
  stats.appendChild(buildStat(done, 'Done'));
  stats.appendChild(buildStat(total - done, 'Remaining'));
  stats.appendChild(buildStat(tickets.filter(t => t.status === 'blocked').length, 'Blocked'));
  body.appendChild(stats);

  wrapper.appendChild(body);

  // Milestone breakdown
  if (milestones.length > 0) {
    const breakdown = el('div', 'milestone-breakdown');
    const heading = el('h3', 'breakdown-heading');
    heading.textContent = 'Milestones';
    breakdown.appendChild(heading);

    milestones.forEach(ms => {
      const msTickets = tickets.filter(t => t.milestoneId === ms.id);
      const msDone = msTickets.filter(t => t.status === 'done').length;
      const msTotal = msTickets.length;
      const msPct = msTotal > 0 ? Math.round((msDone / msTotal) * 100) : 0;
      breakdown.appendChild(buildMilestoneRow(ms, msDone, msTotal, msPct));
    });

    wrapper.appendChild(breakdown);
  }

  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}

function buildRing(percent) {
  const size = 180;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent === 100 ? '#22c55e' : '#6366f1';

  const container = el('div', 'ring-container');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', size / 2); bg.setAttribute('cy', size / 2);
  bg.setAttribute('r', radius); bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', '#27272a'); bg.setAttribute('stroke-width', '14');

  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  arc.setAttribute('cx', size / 2); arc.setAttribute('cy', size / 2);
  arc.setAttribute('r', radius); arc.setAttribute('fill', 'none');
  arc.setAttribute('stroke', color); arc.setAttribute('stroke-width', '14');
  arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('stroke-dasharray', circumference);
  arc.setAttribute('stroke-dashoffset', offset);
  arc.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  arc.style.transition = 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)';

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', size / 2); label.setAttribute('y', size / 2 - 8);
  label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle');
  label.setAttribute('fill', '#e4e4e7'); label.setAttribute('font-size', '32');
  label.setAttribute('font-weight', '700'); label.setAttribute('font-family', 'system-ui');
  label.textContent = `${percent}%`;

  const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  sub.setAttribute('x', size / 2); sub.setAttribute('y', size / 2 + 22);
  sub.setAttribute('text-anchor', 'middle'); sub.setAttribute('dominant-baseline', 'middle');
  sub.setAttribute('fill', '#71717a'); sub.setAttribute('font-size', '13');
  sub.setAttribute('font-family', 'system-ui');
  sub.textContent = 'complete';

  svg.append(bg, arc, label, sub);
  container.appendChild(svg);
  return container;
}

function buildStat(value, label) {
  const stat = el('div', 'progress-stat');
  const num = el('span', 'progress-stat-num');
  num.textContent = value;
  const lbl = el('span', 'progress-stat-label');
  lbl.textContent = label;
  stat.append(num, lbl);
  return stat;
}

function buildMilestoneRow(ms, done, total, pct) {
  const row = el('div', 'milestone-row');

  const top = el('div', 'milestone-row-top');
  const title = el('span', 'milestone-row-title');
  title.textContent = ms.title;
  const counts = el('span', 'milestone-row-counts');
  counts.textContent = `${done} / ${total}`;
  top.append(title, counts);

  const barOuter = el('div', 'milestone-bar-outer');
  const barInner = el('div', `milestone-bar-inner ${ms.status === 'done' || pct === 100 ? 'bar-done' : ''}`);
  barInner.style.width = `${pct}%`;
  barOuter.appendChild(barInner);

  const footer = el('div', 'milestone-row-footer');
  const statusBadge = el('span', `ms-status ms-status-${ms.status}`);
  statusBadge.textContent = ms.status;
  footer.appendChild(statusBadge);

  if (ms.dueDate && ms.status !== 'done') {
    const days = daysUntil(ms.dueDate);
    const dueBadge = el('span', `ms-due-badge ${dueBadgeClass(days)}`);
    dueBadge.textContent = dueLabel(days);
    footer.appendChild(dueBadge);
  }

  row.append(top, barOuter, footer);
  return row;
}
