/** The small subset of markdown that agents actually send.
 *
 * Agents mark emphasis with `**bold**` because the speak tool asks them to -
 * it drives vocal emphasis in the TTS. That markup then reached the
 * dashboard verbatim, so a bubble read "the **release** is ready", asterisks
 * and all. Lists arrived as literal `-` characters for the same reason.
 *
 * This parses that subset into TOKENS, never into HTML. Bubbles carry chat
 * messages from strangers, so a `v-html` path would hand every viewer an
 * injection point; Vue renders these tokens as ordinary text nodes instead.
 *
 * Deliberately NOT supported: headings, tables, links, images, blockquotes.
 * The conversation log is a transcript, not a document, and an agent that
 * needs a table should be sending the user somewhere else.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string };

export type Block =
  | { kind: "p"; spans: Inline[] }
  | { kind: "ul"; items: Inline[][] };

// Order matters: code first, so `**` inside backticks stays literal.
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest) {
    const m = INLINE.exec(rest);
    if (!m || m.index === undefined) break;
    if (m.index > 0) out.push({ kind: "text", text: rest.slice(0, m.index) });

    const token = m[0];
    if (token.startsWith("`")) out.push({ kind: "code", text: token.slice(1, -1) });
    else if (token.startsWith("**")) out.push({ kind: "bold", text: token.slice(2, -2) });
    else out.push({ kind: "italic", text: token.slice(1, -1) });

    rest = rest.slice(m.index + token.length);
  }

  if (rest) out.push({ kind: "text", text: rest });
  // A message with no markup at all is one plain span - the common case.
  return out.length ? out : [{ kind: "text", text }];
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: "p", spans: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({ kind: "ul", items: list });
    list = null;
  };

  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);

    if (bullet) {
      flushParagraph();
      (list ??= []).push(parseInline(bullet[1]));
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
