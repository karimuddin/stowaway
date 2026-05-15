import { KanbanBoard }    from '../components/KanbanBoard.js';
import { BlockerList }    from '../components/BlockerList.js';
import { ProgressRing }   from '../components/ProgressRing.js';
import { StandupSummary } from '../components/StandupSummary.js';
import { TicketList }     from '../components/TicketList.js';
import { ChatBubble }     from '../components/ChatBubble.js';
import { VelocityChart }  from '../components/VelocityChart.js';
import { BurndownChart }  from '../components/BurndownChart.js';
import { EodSummary }     from '../components/EodSummary.js';

const UI_MAP = {
  kanban:   KanbanBoard,
  blockers: BlockerList,
  progress: ProgressRing,
  standup:  StandupSummary,
  tickets:  TicketList,
  chat:     ChatBubble,
  velocity: VelocityChart,
  burndown: BurndownChart,
  eod:      EodSummary,
};
const VALID_UI = new Set(Object.keys(UI_MAP));

export function safeParseAIResponse(raw) {
  try {
    // Strip markdown code fences if present
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    // Extract first JSON object
    const match = stripped.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : stripped);
    return {
      ui:      VALID_UI.has(parsed.ui) ? parsed.ui : 'chat',
      data:    (parsed.data && typeof parsed.data === 'object') ? parsed.data : {},
      message: typeof parsed.message === 'string' ? parsed.message.slice(0, 400) : 'Here\'s what I found.',
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4) : []
    };
  } catch {
    // If the raw text is readable, show it in chat
    const text = typeof raw === 'string' ? raw.replace(/```[\s\S]*?```/g, '').trim() : '';
    return { ui: 'chat', data: {}, message: text || 'Something went wrong. Try again.', actions: [] };
  }
}

export function renderResponse(raw, container) {
  const parsed = safeParseAIResponse(raw);
  const Component = UI_MAP[parsed.ui];
  container.replaceChildren();
  container.appendChild(Component(parsed.data, parsed.message, parsed.actions));
  return parsed;
}
