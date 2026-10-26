/**
 * Inline highlight markers for public code samples.
 *
 * Wrap the part of a sample that the surrounding text explains in
 * `⟦` … `⟧`. Every line a marked span touches is highlighted. When a span
 * covers only part of a line's code, that part is also emphasized as a token.
 * The markers never reach the reader: copy, keyboard focus and assistive
 * technology all get the clean source.
 */
export const HIGHLIGHT_OPEN = "⟦";
export const HIGHLIGHT_CLOSE = "⟧";

export type CodeSegment = { text: string; token: boolean };
export type CodeLine = { text: string; highlighted: boolean; segments: CodeSegment[] };
export type HighlightedSource = {
  /** The source without markers: what Copy writes and what the reader sees. */
  source: string;
  lines: CodeLine[];
  /** One-based numbers of the highlighted lines. */
  highlightedLines: number[];
};

/** Marks a span of a sample as relevant to the surrounding text. */
export const hl = (text: string): string => `${HIGHLIGHT_OPEN}${text}${HIGHLIGHT_CLOSE}`;

/** Keeps user-provided text from being read as markers inside a JS string literal. */
export function escapeHighlightMarkers(literal: string): string {
  return literal.replace(/[⟦⟧]/gu, (marker) => `\\u${marker.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function parseHighlightedSource(marked: string): HighlightedSource {
  let source = "";
  let open = -1;
  const spans: Array<[number, number]> = [];
  for (const char of marked) {
    if (char === HIGHLIGHT_OPEN) {
      if (open >= 0) throw new Error("Nested code highlight marker.");
      open = source.length;
    } else if (char === HIGHLIGHT_CLOSE) {
      if (open < 0) throw new Error("Unmatched code highlight close marker.");
      if (source.length > open) spans.push([open, source.length]);
      open = -1;
    } else source += char;
  }
  if (open >= 0) throw new Error("Unclosed code highlight marker.");

  const lines: CodeLine[] = [];
  const highlightedLines: number[] = [];
  let lineStart = 0;
  for (const text of source.split("\n")) {
    const lineEnd = lineStart + text.length;
    const contentStart = lineStart + (text.length - text.trimStart().length);
    const contentEnd = lineEnd - (text.length - text.trimEnd().length);
    const touching = text.length === 0
      ? spans.filter(([start, end]) => start <= lineStart && end > lineStart)
      : spans.filter(([start, end]) => start < lineEnd && end > lineStart);
    const highlighted = touching.length > 0;
    // Token ranges are clipped to the line's code, ignoring indentation.
    const tokens = touching
      .map(([start, end]) => [Math.max(start, contentStart), Math.min(end, contentEnd)] as const)
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0]);
    let covered = contentStart;
    for (const [start, end] of tokens) if (start <= covered) covered = Math.max(covered, end);
    const wholeLine = covered >= contentEnd;
    const segments: CodeSegment[] = [];
    if (!highlighted || wholeLine) segments.push({ text, token: false });
    else {
      let cursor = lineStart;
      for (const [start, end] of tokens) {
        const from = Math.max(start, cursor);
        if (from >= end) continue;
        if (from > cursor) segments.push({ text: source.slice(cursor, from), token: false });
        segments.push({ text: source.slice(from, end), token: true });
        cursor = end;
      }
      if (cursor < lineEnd) segments.push({ text: source.slice(cursor, lineEnd), token: false });
    }
    lines.push({ text, highlighted, segments });
    if (highlighted) highlightedLines.push(lines.length);
    lineStart = lineEnd + 1;
  }
  return { source, lines, highlightedLines };
}

/** Formats one-based line numbers as compact ranges, e.g. [3, 4, 7] → "3–4, 7". */
export function formatLineRanges(lines: readonly number[]): string {
  const ranges: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const first = lines[index]!;
    let last = first;
    while (lines[index + 1] === last + 1) last = lines[++index]!;
    ranges.push(first === last ? `${first}` : `${first}–${last}`);
  }
  return ranges.join(", ");
}
