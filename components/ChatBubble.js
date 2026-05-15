import { createActionButtons, el } from './shared.js';

export function ChatBubble(data, message, actions) {
  const wrapper = el('div', 'ui-chat-bubble');

  const bubble = el('div', 'chat-bubble-card');

  const iconRow = el('div', 'chat-bubble-icon-row');
  const icon = el('span', 'chat-bubble-icon');
  icon.textContent = '⚓';
  const label = el('span', 'chat-bubble-label');
  label.textContent = 'Stowaway';
  iconRow.append(icon, label);

  const text = el('p', 'chat-bubble-text');
  text.textContent = message || 'How can I help?';

  bubble.append(iconRow, text);

  // Render any extra data fields as key-value pairs
  if (data && Object.keys(data).length > 0) {
    const extra = el('div', 'chat-bubble-extra');
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        const row = el('div', 'chat-bubble-kv');
        const k = el('span', 'chat-bubble-key');
        k.textContent = key;
        const v = el('span', 'chat-bubble-val');
        v.textContent = String(value);
        row.append(k, v);
        extra.appendChild(row);
      }
    });
    if (extra.children.length > 0) bubble.appendChild(extra);
  }

  wrapper.appendChild(bubble);
  if (actions?.length) wrapper.appendChild(createActionButtons(actions));
  return wrapper;
}
