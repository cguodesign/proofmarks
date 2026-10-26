import { orderCorrectionsByReference, validateCorrections } from "@proofmarks/core";
import { offsetsFromSelection as getSelectionOffsets } from "@proofmarks/dom";
import type { Correction, TextPointTarget, TextRangeTarget } from "./schema";

export { getSourceText } from "./index";

export function offsetsFromSelection(element: HTMLElement, range: Range): TextRangeTarget | TextPointTarget {
  return getSelectionOffsets(element, range);
}

/** Find the zero-based, non-overlapping occurrence of a literal phrase. */
export function findRange(text: string, phrase: string, nth = 0): TextRangeTarget | null {
  if (!phrase || !Number.isInteger(nth) || nth < 0) throw new RangeError("Use a non-empty phrase and a non-negative integer occurrence.");
  let start = -phrase.length;
  for (let index = 0; index <= nth; index += 1) {
    start = text.indexOf(phrase, start + phrase.length);
    if (start < 0) return null;
  }
  return { kind: "text-range", start, end: start + phrase.length };
}

/** Apply independent corrections against the original source; conflicting edits throw. */
export function applyCorrections(text: string, corrections: readonly Correction[]): string {
  validateCorrections(corrections, text.length);
  const canceled = new Set<string>();
  for (const correction of orderCorrectionsByReference(corrections).reverse()) {
    if (!canceled.has(correction.id) && correction.type === "cancel-correction") canceled.add(correction.target.correctionId);
  }
  const edits: { start: number; end: number; value: string; id: string; order: number }[] = [];
  const add = (start: number, end: number, value: string, id: string): void => {
    edits.push({ start, end, value, id, order: edits.length });
  };
  for (const correction of corrections) {
    if (canceled.has(correction.id)) continue;
    switch (correction.type) {
      case "delete": add(correction.target.start, correction.target.end, "", correction.id); break;
      case "replace": add(correction.target.start, correction.target.end, correction.replacement, correction.id); break;
      case "insert": add(correction.target.offset, correction.target.offset, correction.content, correction.id); break;
      case "increase-spacing": add(correction.target.offset, correction.target.offset, " ", correction.id); break;
      case "decrease-spacing": {
        if (!/^\s+$/u.test(text.slice(correction.target.start, correction.target.end))) {
          throw new RangeError(`Correction ${correction.id} must target existing whitespace only.`);
        }
        add(correction.target.start, correction.target.end, "", correction.id);
        break;
      }
      case "transpose": {
        const [first, second] = correction.targets;
        add(first.start, first.end, text.slice(second.start, second.end), correction.id);
        add(second.start, second.end, text.slice(first.start, first.end), correction.id);
        break;
      }
      case "move":
        add(correction.source.start, correction.source.end, "", correction.id);
        add(correction.destination.offset, correction.destination.offset, text.slice(correction.source.start, correction.source.end), correction.id);
        break;
      case "cancel-correction": break;
    }
  }
  for (let index = 0; index < edits.length; index += 1) {
    const a = edits[index]!;
    for (const b of edits.slice(index + 1)) {
      if ((a.start < b.end && b.start < a.end) ||
          (a.start === a.end && b.start < a.start && a.start < b.end) ||
          (b.start === b.end && a.start < b.start && b.start < a.end)) {
        throw new RangeError(`Conflicting corrections ${a.id} and ${b.id}.`);
      }
    }
  }
  edits.sort((a, b) => b.start - a.start || b.end - a.end || b.order - a.order);
  return edits.reduce((result, edit) => result.slice(0, edit.start) + edit.value + result.slice(edit.end), text);
}

export type DiffOptions = {
  /** `code` splits identifiers, whitespace runs and single punctuation marks. */
  granularity?: "word" | "character" | "code";
  locale?: string;
  /** Correction ids are `${idPrefix}${n}`; defaults to `diff-`. */
  idPrefix?: string;
};

const CODE_TOKEN = /[\p{L}\p{M}\p{N}_$]+|\s+|[^]/gu;
const SEGMENTED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const WHITESPACE = /^\s*$/u;

type DiffEdit = { start: number; end: number; value: string };

/** Small-text LCS diff. Large unmatched regions become one replacement. */
export function correctionsFromDiff(before: string, after: string, options: DiffOptions = {}): Correction[] {
  const segmenter = new Intl.Segmenter(options.locale, { granularity: options.granularity === "character" ? "grapheme" : "word" });
  const segment = (text: string): string[] => [...segmenter.segment(text)].map((part) => part.segment);
  const tokenize = options.granularity === "code"
    ? (text: string): string[] => (text.match(CODE_TOKEN) ?? []).flatMap((token) => SEGMENTED_SCRIPT.test(token) ? segment(token) : [token])
    : segment;
  let left = tokenize(before);
  let right = tokenize(after);
  let prefix = 0;
  let offset = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) offset += left[prefix++]!.length;
  left = left.slice(prefix);
  right = right.slice(prefix);
  while (left.length && right.length && left.at(-1) === right.at(-1)) { left.pop(); right.pop(); }
  const edits: DiffEdit[] = [];
  const emit = (start: number, end: number, value: string): void => {
    if (start !== end || value) edits.push({ start, end, value });
  };
  const columns = right.length + 1;
  if ((left.length + 1) * columns > 1_000_000) {
    emit(offset, offset + left.join("").length, right.join(""));
    return toCorrections(before, edits, options.idPrefix ?? "diff-");
  }
  const table = new Uint32Array((left.length + 1) * columns);
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i * columns + j] = left[i] === right[j]
        ? table[(i + 1) * columns + j + 1]! + 1
        : Math.max(table[(i + 1) * columns + j]!, table[i * columns + j + 1]!);
    }
  }
  let i = 0, j = 0, start = offset, value = "";
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      emit(start, offset, value);
      offset += left[i++]!.length;
      j += 1; start = offset; value = "";
    } else if (j < right.length && (i === left.length || table[i * columns + j + 1]! > table[(i + 1) * columns + j]!)) {
      value += right[j++];
    } else offset += left[i++]!.length;
  }
  emit(start, offset, value);
  return toCorrections(before, edits, options.idPrefix ?? "diff-");
}

// Spacing and transposition are only emitted when applyCorrections reproduces `after` exactly.
function toCorrections(before: string, edits: readonly DiffEdit[], idPrefix: string): Correction[] {
  const result: Correction[] = [];
  const nextId = (): string => `${idPrefix}${result.length + 1}`;
  for (let index = 0; index < edits.length; index += 1) {
    const { start, end, value } = edits[index]!;
    const removed = before.slice(start, end);
    const next = edits[index + 1];
    if (next && removed && value && next.start < next.end && next.value &&
        before.slice(next.start, next.end) === value && next.value === removed) {
      result.push({ id: nextId(), type: "transpose", targets: [{ kind: "text-range", start, end }, { kind: "text-range", start: next.start, end: next.end }] });
      index += 1;
      continue;
    }
    if (WHITESPACE.test(removed) && WHITESPACE.test(value)) {
      if (removed.length > value.length && removed.startsWith(value)) {
        result.push({ id: nextId(), type: "decrease-spacing", target: { kind: "text-range", start: start + value.length, end } });
        continue;
      }
      if (removed.length > value.length && removed.endsWith(value)) {
        result.push({ id: nextId(), type: "decrease-spacing", target: { kind: "text-range", start, end: end - value.length } });
        continue;
      }
      if (value === `${removed} ` || value === ` ${removed}`) {
        result.push({ id: nextId(), type: "increase-spacing", target: { kind: "text-point", offset: value === `${removed} ` ? end : start } });
        continue;
      }
    }
    const id = nextId();
    if (start === end) result.push({ id, type: "insert", target: { kind: "text-point", offset: start }, content: value });
    else if (!value) result.push({ id, type: "delete", target: { kind: "text-range", start, end } });
    else result.push({ id, type: "replace", target: { kind: "text-range", start, end }, replacement: value });
  }
  return result;
}
