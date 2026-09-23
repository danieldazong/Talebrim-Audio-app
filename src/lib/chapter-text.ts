// The reader's parser for `chapters.script_text`. No React, no hooks, no JSX
// (AGENTS.md § lib/).
//
// The admin editor stores exactly three marks: `**bold**`, `_italic_` and
// `## heading` (AGENTS.md Data Contract; the dashboard's
// `src/lib/script-markup.ts`). Everything else renders as the characters it
// is. Never drop text and never throw: an unknown mark is prose the author
// typed.
//
// Offsets are JavaScript string indices into `script_text`. For the prose the
// dashboard stores these are also Postgres character offsets. Only characters
// outside the Basic Multilingual Plane, such as emoji, would count twice.

export type ReaderSpan = {
  text: string;
  bold: boolean;
  italic: boolean;
};

export type ReaderBlock = {
  kind: "heading" | "paragraph";
  /** Character offset of the block's first visible character in the source. */
  start: number;
  spans: ReaderSpan[];
};

const HEADING_PREFIX = "## ";
const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

/** An italic `_` closes only at a word boundary, so `snake_case` stays literal. */
function findItalicClose(text: string, from: number): number {
  for (let index = from + 1; index < text.length; index += 1) {
    if (text[index] === "_" && !isWordChar(text[index + 1])) return index;
  }
  return -1;
}

function parseSpans(
  text: string,
  bold: boolean,
  italic: boolean,
  spans: ReaderSpan[],
): void {
  let plainFrom = 0;
  let index = 0;

  const flushPlain = (to: number) => {
    if (to > plainFrom) spans.push({ text: text.slice(plainFrom, to), bold, italic });
  };

  while (index < text.length) {
    if (text.startsWith("**", index)) {
      const close = text.indexOf("**", index + 2);
      // `****` or a lone `**` has nothing to wrap: it stays literal.
      if (close > index + 2) {
        flushPlain(index);
        parseSpans(text.slice(index + 2, close), true, italic, spans);
        index = close + 2;
        plainFrom = index;
        continue;
      }
      index += 2;
      continue;
    }

    if (text[index] === "_" && !isWordChar(text[index - 1])) {
      const close = findItalicClose(text, index + 1);
      if (close !== -1) {
        flushPlain(index);
        parseSpans(text.slice(index + 1, close), bold, true, spans);
        index = close + 1;
        plainFrom = index;
        continue;
      }
    }

    index += 1;
  }

  flushPlain(text.length);
}

type Line = { text: string; start: number };

function toBlock(kind: ReaderBlock["kind"], lines: Line[]): ReaderBlock {
  // A single line break inside a paragraph is a soft wrap, joined with a
  // space — as the dashboard's preview shows it to the operator.
  const text = lines.map((line) => line.text).join(" ");
  const spans: ReaderSpan[] = [];

  if (kind === "heading") {
    // Headings are Fraunces, one font, so their text is taken literally.
    spans.push({ text, bold: false, italic: false });
  } else {
    parseSpans(text, false, false, spans);
  }

  return { kind, start: lines[0].start, spans };
}

/**
 * Splits chapter text into paragraphs on blank lines, each with its starting
 * character offset. A line beginning with exactly `## ` is a heading block of
 * its own, even with no blank line after it, because the dashboard's heading
 * button prefixes one line.
 */
export function parseChapterText(source: string): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  let paragraph: Line[] = [];

  const flush = () => {
    if (paragraph.length > 0) blocks.push(toBlock("paragraph", paragraph));
    paragraph = [];
  };

  let lineStart = 0;
  while (lineStart <= source.length) {
    const newline = source.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? source.length : newline;
    const raw = source.slice(lineStart, lineEnd);
    const indent = raw.length - raw.trimStart().length;
    const text = raw.trim();
    const start = lineStart + indent;

    if (text === "") {
      flush();
    } else if (text.startsWith(HEADING_PREFIX)) {
      flush();
      blocks.push(
        toBlock("heading", [{ text: text.slice(HEADING_PREFIX.length).trim(), start }]),
      );
    } else {
      paragraph.push({ text, start });
    }

    if (newline === -1) break;
    lineStart = newline + 1;
  }

  flush();
  return blocks;
}

/** The block that contains a character offset: the last one starting at or before it. */
export function blockIndexAtOffset(blocks: readonly ReaderBlock[], offset: number): number {
  let found = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    if (blocks[index].start > offset) break;
    found = index;
  }
  return found;
}
