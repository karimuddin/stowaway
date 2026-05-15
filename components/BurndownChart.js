import { createActionButtons, createHeader, el } from './shared.js';

export function BurndownChart(data, message, actions) {
  const tickets    = data.tickets    || [];
  const milestones = data.milestones || [];

  const ms = milestones.find(m => m.status === 'in-progress') || milestones[0];
  if (!ms) {
    const wrapper = el('div', 'ui-burndown');
    wrapper.appendChild(createHeader('Burndown', 'No active milestone.'));
    return wrapper;
  }

  const msTickets  = tickets.filter(t => t.milestoneId === ms.id);
  const total      = msTickets.length;
  const doneNow    = msTickets.filter(t => t.status === 'done').length;
  const remaining  = total - doneNow;
  const points     = buildBurnPoints(msTickets, ms);
  const health     = burnHealth(points, ms);

  const wrapper = el('div', 'ui-burndown');
  const headerMsg = message || `${remaining} tickets left · ${health.label}`;
  wrapper.appendChild(createHeader(`Burndown — ${ms.title}`, headerMsg));

  // Stats row
  const stats = el('div', 'burndown-stats');
  [
    [total,     'Total'],
    [doneNow,   'Done'],
    [remaining, 'Remaining'],
    [health.daysLeft !== null ? health.daysLeft + 'd' : '—', 'Until due'],
  ].forEach(([v, l]) => {
    const s = el('div', 'burndown-stat');
    const n = el('span', 'burndown-stat-num'); n.textContent = v;
    const lb = el('span', 'burndown-stat-label'); lb.textContent = l;
    s.append(n, lb); stats.appendChild(s);
  });
  wrapper.appendChild(stats);

  if (total > 0) wrapper.appendChild(buildLineChart(points, total, ms));

  if (health.warning) {
    const warn = el('div', `burndown-warning ${health.critical ? 'burndown-critical' : ''}`);
    warn.textContent = health.warning;
    wrapper.appendChild(warn);
  }

  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function buildBurnPoints(msTickets, ms) {
  if (msTickets.length === 0) return [];
  const total = msTickets.length;

  // Group completions by day
  const completions = {};
  msTickets.forEach(t => {
    if (t.completedAt) {
      const day = t.completedAt.slice(0, 10);
      completions[day] = (completions[day] || 0) + 1;
    }
  });

  // Earliest date is the first ticket created
  const start = new Date(Math.min(...msTickets.map(t => new Date(t.createdAt || Date.now()))));
  const end   = ms.dueDate ? new Date(ms.dueDate) : new Date(Date.now() + 21 * 86400000);
  const today = new Date(); today.setHours(23,59,59,999);

  const points = [];
  let remaining = total;

  for (let d = new Date(start); d <= today && d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    remaining -= (completions[key] || 0);
    points.push({ date: key, remaining: Math.max(0, remaining), actual: true });
  }

  // Ideal line: linear from total on start day to 0 on due date
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  points.forEach((p, i) => {
    p.ideal = Math.max(0, Math.round(total * (1 - i / totalDays)));
  });

  return points;
}

function burnHealth(points, ms) {
  const daysLeft = ms.dueDate
    ? Math.round((new Date(ms.dueDate) - new Date()) / 86400000)
    : null;

  if (points.length < 2) return { label: 'Not enough data', daysLeft, warning: null, critical: false };

  const last = points.at(-1);
  const gap  = (last.remaining || 0) - (last.ideal || 0);

  if (gap <= 0) return { label: '✓ On track', daysLeft, warning: null, critical: false };
  if (gap <= 2)  return { label: '~ Slightly behind', daysLeft, warning: `${gap} ticket(s) behind the ideal pace.`, critical: false };
  return {
    label: '⚠ Behind schedule',
    daysLeft,
    warning: `${gap} tickets behind ideal pace${daysLeft !== null ? ` with ${daysLeft}d remaining` : ''}.`,
    critical: daysLeft !== null && daysLeft < 7,
  };
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function buildLineChart(points, total, ms) {
  if (points.length < 2) return el('div');
  const W = 560, H = 200;
  const ML = 36, MR = 12, MT = 12, MB = 28;
  const chartW = W - ML - MR;
  const chartH = H - MT - MB;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', H);

  const g  = (tag, attrs = {}) => { const el = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
  const tx = (content, attrs = {}) => { const t = g('text', attrs); t.textContent = content; return t; };

  const xScale = (i)  => ML + (i / Math.max(points.length - 1, 1)) * chartW;
  const yScale = (v)  => MT + (v / total) * chartH;

  // Grid lines + y labels
  [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
    const y = MT + frac * chartH;
    svg.appendChild(g('line', { x1: ML, y1: y, x2: ML + chartW, y2: y, stroke: '#3f3f46', 'stroke-width': '1', 'stroke-dasharray': '3,3' }));
    svg.appendChild(tx(Math.round(total * (1 - frac)), { x: ML - 6, y: y + 4, 'text-anchor': 'end', fill: '#71717a', 'font-size': '10', 'font-family': 'system-ui' }));
  });

  // Ideal line (dashed, muted)
  const idealPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.ideal).toFixed(1)}`).join(' ');
  svg.appendChild(g('path', { d: idealPath, fill: 'none', stroke: '#52525b', 'stroke-width': '1.5', 'stroke-dasharray': '6,3' }));

  // Shaded area under actual line
  const areaPath = [
    ...points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.remaining).toFixed(1)}`),
    `L${xScale(points.length - 1)},${MT + chartH}`,
    `L${xScale(0)},${MT + chartH}`,
    'Z',
  ].join(' ');
  svg.appendChild(g('path', { d: areaPath, fill: '#6366f1', opacity: '0.08' }));

  // Actual line (indigo)
  const actualPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.remaining).toFixed(1)}`).join(' ');
  svg.appendChild(g('path', { d: actualPath, fill: 'none', stroke: '#6366f1', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

  // X axis labels — show ~4 evenly spaced
  const labelIndices = [0, Math.floor(points.length / 3), Math.floor(2 * points.length / 3), points.length - 1];
  [...new Set(labelIndices)].forEach(i => {
    svg.appendChild(tx(points[i].date.slice(5), { x: xScale(i), y: MT + chartH + 16, 'text-anchor': 'middle', fill: '#71717a', 'font-size': '10', 'font-family': 'system-ui' }));
  });

  // Legend
  const legend = el('div', 'burndown-legend');
  [['#6366f1', 'Actual'], ['#52525b', 'Ideal']].forEach(([color, label]) => {
    const item = el('div', 'velocity-legend-item');
    const dot  = el('span', 'velocity-legend-dot'); dot.style.background = color;
    const lbl  = el('span', ''); lbl.textContent = label;
    item.append(dot, lbl); legend.appendChild(item);
  });

  const wrap = el('div', 'velocity-chart-wrap');
  wrap.appendChild(svg);
  wrap.appendChild(legend);
  return wrap;
}
