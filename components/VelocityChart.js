import { createActionButtons, createHeader, el } from './shared.js';

export function VelocityChart(data, message, actions) {
  const tickets = data.tickets || [];
  const weeks   = buildWeeks(tickets);
  const avg     = Math.round(weeks.reduce((s, w) => s + w.completed, 0) / Math.max(weeks.length, 1));
  const trend   = trendLabel(weeks);

  const wrapper = el('div', 'ui-velocity');
  wrapper.appendChild(createHeader('Velocity', message || `${avg} tickets/week on average · ${trend}`));

  const summary = el('div', 'velocity-summary');
  summary.appendChild(statCard(avg, 'Avg / week'));
  summary.appendChild(statCard(weeks.at(-1)?.completed ?? 0, 'This week'));
  summary.appendChild(statCard(tickets.filter(t => t.status === 'done').length, 'Total done'));
  wrapper.appendChild(summary);

  wrapper.appendChild(buildBarChart(weeks));

  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}

// ── Data ─────────────────────────────────────────────────────────────────────

function buildWeeks(tickets) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const end   = new Date(now); end.setDate(now.getDate() - i * 7); end.setHours(23,59,59,999);
    const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0,0,0,0);

    const completed = tickets.filter(t => {
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d >= start && d <= end;
    }).length;

    const created = tickets.filter(t => {
      const d = new Date(t.createdAt || 0);
      return d >= start && d <= end;
    }).length;

    return {
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completed,
      created,
    };
  }).reverse();
}

function trendLabel(weeks) {
  if (weeks.length < 2) return '';
  const recent = weeks.at(-1).completed;
  const prev   = weeks.at(-2).completed;
  if (recent > prev) return '↑ trending up';
  if (recent < prev) return '↓ trending down';
  return '→ steady';
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────

function buildBarChart(weeks) {
  const W = 560, H = 180;
  const ML = 32, MR = 12, MT = 12, MB = 28;
  const chartW = W - ML - MR;
  const chartH = H - MT - MB;
  const maxVal = Math.max(...weeks.map(w => Math.max(w.completed, w.created)), 1);
  const barGroupW = chartW / weeks.length;
  const barW = Math.min(barGroupW * 0.32, 28);
  const gap  = Math.min(barGroupW * 0.06, 6);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', H);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Weekly velocity chart');
  svg.style.overflow = 'visible';

  const g = (tag, attrs = {}) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const txt = (content, attrs = {}) => { const t = g('text', attrs); t.textContent = content; return t; };

  // Grid lines
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const y = MT + chartH - frac * chartH;
    const line = g('line', { x1: ML, y1: y, x2: ML + chartW, y2: y, stroke: '#3f3f46', 'stroke-width': '1', 'stroke-dasharray': '3,3' });
    svg.appendChild(line);
    const val = Math.round(maxVal * frac);
    svg.appendChild(txt(val, { x: ML - 6, y: y + 4, 'text-anchor': 'end', fill: '#71717a', 'font-size': '10', 'font-family': 'system-ui' }));
  });

  // Bars per week
  weeks.forEach((week, i) => {
    const cx = ML + i * barGroupW + barGroupW / 2;
    const completedH = (week.completed / maxVal) * chartH;
    const createdH   = (week.created   / maxVal) * chartH;

    // Completed bar (green)
    svg.appendChild(g('rect', {
      x: cx - barW - gap / 2, y: MT + chartH - completedH,
      width: barW, height: Math.max(completedH, 2), rx: 3,
      fill: '#22c55e', opacity: '0.85',
    }));

    // Created bar (indigo)
    svg.appendChild(g('rect', {
      x: cx + gap / 2, y: MT + chartH - createdH,
      width: barW, height: Math.max(createdH, 2), rx: 3,
      fill: '#6366f1', opacity: '0.5',
    }));

    // X label
    svg.appendChild(txt(week.label, {
      x: cx, y: MT + chartH + 16,
      'text-anchor': 'middle', fill: '#71717a', 'font-size': '10', 'font-family': 'system-ui',
    }));

    // Value on top of completed bar
    if (week.completed > 0) {
      svg.appendChild(txt(week.completed, {
        x: cx - barW / 2 - gap / 2, y: MT + chartH - completedH - 4,
        'text-anchor': 'middle', fill: '#22c55e', 'font-size': '10', 'font-weight': '600', 'font-family': 'system-ui',
      }));
    }
  });

  const wrap = el('div', 'velocity-chart-wrap');
  wrap.appendChild(svg);

  // Legend
  const legend = el('div', 'velocity-legend');
  [['#22c55e', 'Completed'], ['#6366f1', 'Created']].forEach(([color, label]) => {
    const item = el('div', 'velocity-legend-item');
    const dot  = el('span', 'velocity-legend-dot'); dot.style.background = color;
    const lbl  = el('span', ''); lbl.textContent = label;
    item.append(dot, lbl); legend.appendChild(item);
  });
  wrap.appendChild(legend);
  return wrap;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function statCard(value, label) {
  const card = el('div', 'velocity-stat');
  const num  = el('span', 'velocity-stat-num'); num.textContent = value;
  const lbl  = el('span', 'velocity-stat-label'); lbl.textContent = label;
  card.append(num, lbl);
  return card;
}
