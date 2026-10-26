// Turn an (old line, new line) pair into word-level proofmarks corrections,
// or decide the change is too big to "hand-correct".
import type { Correction } from "proofmarks";

// CJK characters are their own tokens so 信息→资料 is a two-character edit.
const TOKEN = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]|[\p{L}\p{N}_$]+|\s+|[\s\S]/gu;
const tokenize = (s: string) => s.match(TOKEN) ?? [];
const isSpace = (s: string) => /^\s+$/.test(s);

type Op = { kind: "eq" | "del" | "ins"; text: string };

function diffTokens(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  // Flat (n+1)×(m+1) LCS table; at(i, j) is the LCS length of a[i..] and b[j..].
  const w = m + 1;
  const lcs = new Uint16Array((n + 1) * w);
  const at = (i: number, j: number) => lcs[i * w + j]!;
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i * w + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) ops.push({ kind: "eq", text: a[i++]! }), j++;
    else if (at(i + 1, j) >= at(i, j + 1)) ops.push({ kind: "del", text: a[i++]! });
    else ops.push({ kind: "ins", text: b[j++]! });
  }
  while (i < n) ops.push({ kind: "del", text: a[i++]! });
  while (j < m) ops.push({ kind: "ins", text: b[j++]! });
  return ops;
}

type Run = { start: number; end: number; inserted: string };

export type InkResult =
  | { ok: true; corrections: Correction[] }
  | { ok: false; reason: string };

export type InkLimits = { maxEdits: number; maxChangedRatio: number };

export function inkLine(oldText: string, newText: string, limits: InkLimits, idPrefix: string): InkResult {
  if (oldText.trim() === "") return { ok: false, reason: "空行" };
  const ops = diffTokens(tokenize(oldText), tokenize(newText));

  // Collapse consecutive non-equal ops into runs positioned on the old line.
  const runs: Run[] = [];
  let pos = 0;
  let cur: Run | null = null;
  for (const op of ops) {
    if (op.kind === "eq") {
      if (cur) runs.push(cur), (cur = null);
      pos += op.text.length;
      continue;
    }
    cur ??= { start: pos, end: pos, inserted: "" };
    if (op.kind === "del") pos += op.text.length, (cur.end = pos);
    else cur.inserted += op.text;
  }
  if (cur) runs.push(cur);

  const changed = runs.reduce((s, r) => s + (r.end - r.start) + r.inserted.length, 0);
  const budget = Math.max(6, Math.round(oldText.trim().length * limits.maxChangedRatio));
  if (runs.length > limits.maxEdits) return { ok: false, reason: `${runs.length} 处改动，太多了` };
  if (changed > budget) return { ok: false, reason: `改了 ${changed} 个字符，不是小修` };

  const corrections: Correction[] = [];
  const used = new Set<number>();
  runs.forEach((r, i) => {
    if (used.has(i)) return;
    const id = `${idPrefix}-${i}`;
    const removed = oldText.slice(r.start, r.end);
    // Swapped arguments: a→b followed by b→a reads better as a transpose.
    const t = runs.findIndex(
      (o, k) => k > i && !used.has(k) && o.inserted === removed && oldText.slice(o.start, o.end) === r.inserted,
    );
    if (removed && r.inserted && t > 0) {
      used.add(t);
      const o = runs[t]!;
      corrections.push({
        id,
        type: "transpose",
        targets: [
          { kind: "text-range", start: r.start, end: r.end },
          { kind: "text-range", start: o.start, end: o.end },
        ],
      });
    } else if (isSpace(removed) && isSpace(r.inserted) && r.inserted.length < removed.length) {
      // "{  total" → "{ total": close up just the extra whitespace.
      const start = r.start + r.inserted.length;
      corrections.push({ id, type: "decrease-spacing", target: { kind: "text-range", start, end: r.end } });
    } else if (removed && !r.inserted) {
      corrections.push(
        isSpace(removed)
          ? { id, type: "decrease-spacing", target: { kind: "text-range", start: r.start, end: r.end } }
          : { id, type: "delete", target: { kind: "text-range", start: r.start, end: r.end } },
      );
    } else if (!removed && r.inserted) {
      corrections.push(
        isSpace(r.inserted)
          ? { id, type: "increase-spacing", target: { kind: "text-point", offset: r.start } }
          : { id, type: "insert", target: { kind: "text-point", offset: r.start }, content: r.inserted },
      );
    } else {
      corrections.push({
        id,
        type: "replace",
        target: { kind: "text-range", start: r.start, end: r.end },
        replacement: r.inserted,
      });
    }
  });
  return { ok: true, corrections };
}
