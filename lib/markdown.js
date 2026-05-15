// Safe markdown → DOM renderer. Uses only createElement/textContent — never innerHTML.
// Supports: headings, bold, italic, inline code, code blocks, ul, ol, hr, paragraphs.

export function renderMarkdown(text, container) {
  if (!text) return;
  const lines = text.split('\n');
  let i = 0;
  let list = null;
  let listType = null;

  function flushList() {
    if (list) { container.appendChild(list); list = null; listType = null; }
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // blank line
    if (!line) { flushList(); i++; continue; }

    // fenced code block
    if (line.startsWith('```')) {
      flushList();
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const pre = document.createElement('pre');
      pre.className = 'md-code-block';
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.appendChild(code);
      container.appendChild(pre);
      continue;
    }

    // heading
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      flushList();
      const level = Math.min(hMatch[1].length + 2, 5); // map # → h3, ## → h4, etc.
      const h = document.createElement(`h${level}`);
      h.className = `md-heading md-h${level}`;
      parseInline(hMatch[2], h);
      container.appendChild(h);
      i++; continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushList();
      const hr = document.createElement('hr');
      hr.className = 'md-hr';
      container.appendChild(hr);
      i++; continue;
    }

    // unordered list
    const ulMatch = line.match(/^[-*+]\s+(.+)/);
    if (ulMatch) {
      if (listType !== 'ul') { flushList(); list = document.createElement('ul'); list.className = 'md-ul'; listType = 'ul'; }
      const li = document.createElement('li');
      parseInline(ulMatch[1], li);
      list.appendChild(li);
      i++; continue;
    }

    // ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (listType !== 'ol') { flushList(); list = document.createElement('ol'); list.className = 'md-ol'; listType = 'ol'; }
      const li = document.createElement('li');
      parseInline(olMatch[1], li);
      list.appendChild(li);
      i++; continue;
    }

    // paragraph
    flushList();
    const p = document.createElement('p');
    p.className = 'md-p';
    parseInline(line, p);
    container.appendChild(p);
    i++;
  }

  flushList();
}

// Splits text on **bold**, *italic*, `code` and builds safe DOM nodes.
function parseInline(text, parent) {
  // Order matters: bold (**) must be checked before italic (*)
  const RE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match;

  while ((match = RE.exec(text)) !== null) {
    // plain text before this match
    if (match.index > last) {
      parent.appendChild(document.createTextNode(text.slice(last, match.index)));
    }

    const token = match[0];
    if (token.startsWith('**')) {
      const el = document.createElement('strong');
      el.textContent = token.slice(2, -2);
      parent.appendChild(el);
    } else if (token.startsWith('`')) {
      const el = document.createElement('code');
      el.className = 'md-inline-code';
      el.textContent = token.slice(1, -1);
      parent.appendChild(el);
    } else if (token.startsWith('*')) {
      const el = document.createElement('em');
      el.textContent = token.slice(1, -1);
      parent.appendChild(el);
    }

    last = match.index + token.length;
  }

  // remaining plain text
  if (last < text.length) {
    parent.appendChild(document.createTextNode(text.slice(last)));
  }
}
