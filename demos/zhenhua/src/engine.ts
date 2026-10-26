import type { Correction } from "proofmarks";
import type { Rule } from "./dict";

type Span = { start: number; end: number };

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/**
 * Scan `text` for rule matches (longest phrase wins, no overlaps) and emit
 * proofmarks corrections. JS string indices are already UTF-16 code units,
 * which is exactly what proofmarks expects.
 */
export function buildCorrections(text: string, rules: Rule[], limit = Infinity): Correction[] {
  const taken: Span[] = [];
  const out: { at: number; c: Correction }[] = [];
  let n = 0;

  const replaceRules = rules
    .filter((r): r is { from: string; to: string } => "from" in r)
    .sort((a, b) => b.from.length - a.from.length);

  for (const rule of replaceRules) {
    let from = 0;
    for (;;) {
      const start = text.indexOf(rule.from, from);
      if (start < 0) break;
      const span = { start, end: start + rule.from.length };
      from = span.end;
      if (taken.some((t) => overlaps(t, span))) continue;
      taken.push(span);
      const id = `auto-${n++}`;
      const target = { kind: "text-range" as const, ...span };
      out.push({
        at: start,
        c: rule.to === ""
          ? { id, type: "delete", target }
          : { id, type: "replace", target, replacement: rule.to },
      });
    }
  }

  for (const rule of rules) {
    let offset: number | undefined;
    let content: string;
    if ("insertAfter" in rule) {
      const i = text.indexOf(rule.insertAfter);
      if (i < 0) continue;
      offset = i + rule.insertAfter.length;
      content = rule.content;
    } else if ("insertAtStart" in rule) {
      offset = 0;
      content = rule.insertAtStart;
    } else if ("insertAtEnd" in rule) {
      offset = text.length;
      content = rule.insertAtEnd;
    } else continue;
    out.push({
      at: offset,
      c: { id: `auto-${n++}`, type: "insert", target: { kind: "text-point", offset }, content },
    });
  }

  // `out` is in priority order (longest phrase first, asides last).
  return out.slice(0, limit).sort((a, b) => a.at - b.at).map((x) => x.c);
}

export function rangeOf(c: Correction): Span | null {
  if (c.type === "delete" || c.type === "replace") return c.target;
  if (c.type === "insert") return { start: c.target.offset, end: c.target.offset };
  return null;
}

export function conflicts(span: Span, existing: readonly Correction[]): boolean {
  return existing.some((c) => {
    const r = rangeOf(c);
    if (!r) return false;
    if (span.start === span.end || r.start === r.end) {
      // A point conflicts only when it falls strictly inside a range.
      const p = span.start === span.end ? span : r;
      const q = span.start === span.end ? r : span;
      return p.start > q.start && p.start < q.end;
    }
    return overlaps(span, r);
  });
}
