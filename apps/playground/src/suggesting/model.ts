import type {
  Correction,
  IncreaseSpacingCorrection,
  DeleteCorrection,
  InsertCorrection,
  ReplaceCorrection,
  TextPointTarget,
  TextRangeTarget,
  TransposeCorrection,
} from "proofmarks";

export type SuggestingState = {
  acceptedText: string;
  corrections: readonly SuggestingCorrection[];
  nextId: number;
};

export type DraftEdit = {
  from: number;
  to: number;
  inserted: string;
  inputType?: string;
};

export type AdapterResult =
  | { ok: true; state: SuggestingState }
  | { ok: false; state: SuggestingState; message: string };

export type CompositionSession = {
  baseDraft: string;
  previewDraft: string;
};

/** Task 007 authors this deliberately narrower subset of the renderer schema. */
type SuggestingCorrection = Extract<
  Correction,
  {
    type:
      | "delete"
      | "insert"
      | "replace"
      | "transpose"
      | "increase-spacing"
      | "decrease-spacing"
      | "cancel-correction";
  }
>;

type TextCorrection = Exclude<SuggestingCorrection, { type: "cancel-correction" }>;

type DraftSegment =
  | {
      kind: "base";
      draftStart: number;
      draftEnd: number;
      baseStart: number;
      baseEnd: number;
    }
  | {
      kind: "proposal";
      draftStart: number;
      draftEnd: number;
      baseStart: number;
      baseEnd: number;
      correction:
        | InsertCorrection
        | ReplaceCorrection
        | TransposeCorrection
        | IncreaseSpacingCorrection;
    };

export type DraftProjection = {
  text: string;
  segments: readonly DraftSegment[];
};

export type SuggestionOwnershipDebug = {
  id: string;
  operation: TextCorrection["type"];
  baseTarget:
    | TextPointTarget
    | TextRangeTarget
    | readonly [TextRangeTarget, TextRangeTarget];
  draftOwnedSpan: { from: number; to: number } | null;
  value: string | null;
  status: "active";
};

type LexicalSegment = {
  from: number;
  to: number;
  kind: "word" | "whitespace" | "punctuation" | "structural";
};

export function createSuggestingState(
  acceptedText: string,
  corrections: readonly SuggestingCorrection[] = [],
): SuggestingState {
  return { acceptedText, corrections, nextId: 1 };
}

export function activeCorrections(state: SuggestingState): readonly TextCorrection[] {
  const cancelled = new Set(
    state.corrections
      .filter((correction) => correction.type === "cancel-correction")
      .map((correction) => correction.target.correctionId),
  );
  return state.corrections.filter(
    (correction): correction is TextCorrection =>
      correction.type !== "cancel-correction" && !cancelled.has(correction.id),
  );
}

function correctionStart(correction: TextCorrection): number {
  return correction.type === "transpose"
    ? correction.targets[0].start
    : correction.target.kind === "text-point"
      ? correction.target.offset
      : correction.target.start;
}

function correctionEnd(correction: TextCorrection): number {
  return correction.type === "transpose"
    ? correction.targets[1].end
    : correction.target.kind === "text-point"
      ? correction.target.offset
      : correction.target.end;
}

function orderedActive(state: SuggestingState): readonly TextCorrection[] {
  return [...activeCorrections(state)].sort(
    (left, right) => correctionStart(left) - correctionStart(right),
  );
}

function appendBaseSegment(
  text: string,
  segments: DraftSegment[],
  output: string,
  baseStart: number,
  baseEnd: number,
): string {
  if (baseEnd <= baseStart) return output;
  const value = text.slice(baseStart, baseEnd);
  segments.push({
    kind: "base",
    draftStart: output.length,
    draftEnd: output.length + value.length,
    baseStart,
    baseEnd,
  });
  return output + value;
}

export function projectDraft(state: SuggestingState): DraftProjection {
  const segments: DraftSegment[] = [];
  let output = "";
  let cursor = 0;

  for (const correction of orderedActive(state)) {
    const start = correctionStart(correction);
    output = appendBaseSegment(
      state.acceptedText,
      segments,
      output,
      cursor,
      start,
    );

    if (correction.type === "insert") {
      segments.push({
        kind: "proposal",
        draftStart: output.length,
        draftEnd: output.length + correction.content.length,
        baseStart: correction.target.offset,
        baseEnd: correction.target.offset,
        correction,
      });
      output += correction.content;
      cursor = start;
    } else if (correction.type === "delete") {
      cursor = correction.target.end;
    } else if (correction.type === "replace") {
      segments.push({
        kind: "proposal",
        draftStart: output.length,
        draftEnd: output.length + correction.replacement.length,
        baseStart: correction.target.start,
        baseEnd: correction.target.end,
        correction,
      });
      output += correction.replacement;
      cursor = correction.target.end;
    } else if (correction.type === "increase-spacing") {
      segments.push({
        kind: "proposal",
        draftStart: output.length,
        draftEnd: output.length + 1,
        baseStart: correction.target.offset,
        baseEnd: correction.target.offset,
        correction,
      });
      output += " ";
      cursor = start;
    } else if (correction.type === "decrease-spacing") {
      cursor = correction.target.end;
    } else {
      const [first, second] = correction.targets;
      const transposed =
        state.acceptedText.slice(second.start, second.end) +
        state.acceptedText.slice(first.end, second.start) +
        state.acceptedText.slice(first.start, first.end);
      segments.push({
        kind: "proposal",
        draftStart: output.length,
        draftEnd: output.length + transposed.length,
        baseStart: first.start,
        baseEnd: second.end,
        correction,
      });
      output += transposed;
      cursor = second.end;
    }
  }

  output = appendBaseSegment(
    state.acceptedText,
    segments,
    output,
    cursor,
    state.acceptedText.length,
  );
  return { text: output, segments };
}

export function draftText(state: SuggestingState): string {
  return projectDraft(state).text;
}

export function suggestionOwnership(
  state: SuggestingState,
): readonly SuggestionOwnershipDebug[] {
  const projection = projectDraft(state);
  return activeCorrections(state).map((correction) => {
    const owner = projection.segments.find(
      (segment): segment is Extract<DraftSegment, { kind: "proposal" }> =>
        segment.kind === "proposal" && segment.correction.id === correction.id,
    );
    const baseTarget =
      correction.type === "transpose" ? correction.targets : correction.target;
    const value =
      correction.type === "insert"
        ? correction.content
        : correction.type === "replace"
          ? correction.replacement
          : correction.type === "increase-spacing"
            ? " "
          : null;
    return {
      id: correction.id,
      operation: correction.type,
      baseTarget,
      draftOwnedSpan: owner
        ? { from: owner.draftStart, to: owner.draftEnd }
        : null,
      value,
      status: "active" as const,
    };
  });
}

export function diffDrafts(before: string, after: string): DraftEdit | null {
  if (before === after) return null;
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) {
    from += 1;
  }
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (
    beforeEnd > from &&
    afterEnd > from &&
    before[beforeEnd - 1] === after[afterEnd - 1]
  ) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  return { from, to: beforeEnd, inserted: after.slice(from, afterEnd) };
}

function proposalAtPoint(
  projection: DraftProjection,
  point: number,
): Extract<DraftSegment, { kind: "proposal" }> | undefined {
  const owners = projection.segments.filter(
    (segment): segment is Extract<DraftSegment, { kind: "proposal" }> =>
      segment.kind === "proposal" &&
      point >= segment.draftStart &&
      point <= segment.draftEnd,
  );
  // At a shared boundary the right-hand suggestion owns the cursor. This is
  // stable across transaction groups and never merges the two owners.
  return owners.find((segment) => segment.draftStart === point) ?? owners[0];
}

function lexicalSegments(value: string): readonly LexicalSegment[] {
  if (value.length === 0) return [];
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    return Array.from(segmenter.segment(value), (part) => {
      const text = part.segment;
      const kind: LexicalSegment["kind"] = /[\r\n]/u.test(text)
        ? "structural"
        : /^\s+$/u.test(text)
          ? "whitespace"
          : part.isWordLike
            ? "word"
            : "punctuation";
      return { from: part.index, to: part.index + text.length, kind };
    });
  }

  const segments: LexicalSegment[] = [];
  const pattern = /[\r\n]+|[^\S\r\n]+|[\p{L}\p{N}\p{M}_]+|[^\s\p{L}\p{N}\p{M}_]+/gu;
  for (const match of value.matchAll(pattern)) {
    const text = match[0];
    const from = match.index;
    const kind: LexicalSegment["kind"] = /[\r\n]/u.test(text)
      ? "structural"
      : /^\s+$/u.test(text)
        ? "whitespace"
        : /^[\p{L}\p{N}\p{M}_]+$/u.test(text)
          ? "word"
          : "punctuation";
    segments.push({ from, to: from + text.length, kind });
  }
  return segments;
}

function firstStrongLexicalBoundary(value: string): number | null {
  const boundary = lexicalSegments(value).find(
    (segment) => segment.kind === "whitespace" || segment.kind === "structural",
  );
  return boundary?.from ?? null;
}

function baseRangeForDraftRange(
  projection: DraftProjection,
  from: number,
  to: number,
): TextRangeTarget | null {
  const touched = projection.segments.filter(
    (segment) => segment.draftEnd > from && segment.draftStart < to,
  );
  if (touched.length === 0 || touched.some((segment) => segment.kind !== "base")) {
    return null;
  }
  const first = touched[0]!;
  const last = touched[touched.length - 1]!;
  const start = first.baseStart + Math.max(0, from - first.draftStart);
  const end = last.baseEnd - Math.max(0, last.draftEnd - to);
  if (end <= start) return null;
  return { kind: "text-range", start, end };
}

function basePointForDraftPoint(
  projection: DraftProjection,
  point: number,
): number | null {
  for (const segment of projection.segments) {
    if (segment.kind === "base" && point >= segment.draftStart && point <= segment.draftEnd) {
      return segment.baseStart + (point - segment.draftStart);
    }
  }
  if (point === 0) return 0;
  const left = [...projection.segments]
    .reverse()
    .find((segment) => segment.kind === "base" && segment.draftEnd <= point);
  const right = projection.segments.find(
    (segment) => segment.kind === "base" && segment.draftStart >= point,
  );
  if (left?.kind === "base" && left.draftEnd === point) return left.baseEnd;
  if (right?.kind === "base" && right.draftStart === point) return right.baseStart;
  return null;
}

function nextId(state: SuggestingState): [string, number] {
  return [`suggestion-${state.nextId}`, state.nextId + 1];
}

function replaceCorrection(
  state: SuggestingState,
  id: string,
  replacement: SuggestingCorrection | null,
): SuggestingState {
  return {
    ...state,
    corrections: replacement
      ? state.corrections.map((correction) =>
          correction.id === id ? replacement : correction,
        )
      : state.corrections.filter((correction) => correction.id !== id),
  };
}

function editExistingProposal(
  state: SuggestingState,
  segment: Extract<DraftSegment, { kind: "proposal" }>,
  edit: DraftEdit,
): AdapterResult {
  const correction = segment.correction;
  if (correction.type === "transpose" || correction.type === "increase-spacing") {
    return {
      ok: false,
      state,
      message: correction.type === "transpose"
        ? "Accept or reject the transposition before editing inside it."
        : "Accept or reject the spacing suggestion before editing inside it.",
    };
  }
  if (edit.from < segment.draftStart || edit.to > segment.draftEnd) {
    return {
      ok: false,
      state,
      message: "This edit crosses an unresolved suggestion. Review it first.",
    };
  }
  const current = correction.type === "insert" ? correction.content : correction.replacement;
  const localFrom = edit.from - segment.draftStart;
  const localTo = edit.to - segment.draftStart;
  const value = current.slice(0, localFrom) + edit.inserted + current.slice(localTo);

  if (value.length === 0) {
    return { ok: true, state: replaceCorrection(state, correction.id, null) };
  }
  if (
    correction.type === "replace" &&
    value === state.acceptedText.slice(correction.target.start, correction.target.end)
  ) {
    return { ok: true, state: replaceCorrection(state, correction.id, null) };
  }
  const updated: InsertCorrection | ReplaceCorrection =
    correction.type === "insert"
      ? { ...correction, content: value }
      : { ...correction, replacement: value };
  return { ok: true, state: replaceCorrection(state, correction.id, updated) };
}

function editAtReplacementEnd(
  state: SuggestingState,
  segment: Extract<DraftSegment, { kind: "proposal" }>,
  edit: DraftEdit,
): AdapterResult | null {
  const correction = segment.correction;
  if (
    correction.type !== "replace" ||
    edit.from !== segment.draftEnd ||
    edit.to !== edit.from ||
    edit.inserted.length === 0
  ) {
    return null;
  }

  const boundary = firstStrongLexicalBoundary(edit.inserted);
  if (boundary === null) return null;

  let nextState = state;
  const ownedPrefix = edit.inserted.slice(0, boundary);
  if (ownedPrefix.length > 0) {
    const updated = editExistingProposal(nextState, segment, {
      ...edit,
      inserted: ownedPrefix,
    });
    if (!updated.ok) return updated;
    nextState = updated.state;
  }

  const [id, next] = nextId(nextState);
  const insertion: InsertCorrection = {
    id,
    type: "insert",
    target: { kind: "text-point", offset: correction.target.end },
    content: edit.inserted.slice(boundary),
  };
  return {
    ok: true,
    state: {
      ...nextState,
      nextId: next,
      corrections: [...nextState.corrections, insertion],
    },
  };
}

function overlapsExisting(state: SuggestingState, start: number, end: number): boolean {
  return activeCorrections(state).some((correction) => {
    const existingStart = correctionStart(correction);
    const existingEnd = correctionEnd(correction);
    if (start === end && existingStart === existingEnd) return start === existingStart;
    if (start === end) return start > existingStart && start < existingEnd;
    if (existingStart === existingEnd) return existingStart > start && existingStart < end;
    return start < existingEnd && end > existingStart;
  });
}

export function applyDraftEdit(state: SuggestingState, edit: DraftEdit): AdapterResult {
  const projection = projectDraft(state);
  if (
    edit.from < 0 ||
    edit.to < edit.from ||
    edit.to > projection.text.length ||
    (edit.from === edit.to && edit.inserted.length === 0)
  ) {
    return { ok: false, state, message: "The editor produced an invalid text change." };
  }

  if (edit.from === edit.to) {
    const proposal = proposalAtPoint(projection, edit.from);
    if (proposal) {
      return editAtReplacementEnd(state, proposal, edit) ?? editExistingProposal(state, proposal, edit);
    }
    const offset = basePointForDraftPoint(projection, edit.from);
    if (offset === null || overlapsExisting(state, offset, offset)) {
      return { ok: false, state, message: "This insertion overlaps an unresolved suggestion." };
    }
    const adjacent = activeCorrections(state).find(
      (correction): correction is InsertCorrection =>
        correction.type === "insert" && correction.target.offset === offset,
    );
    if (adjacent) {
      return {
        ok: true,
        state: replaceCorrection(state, adjacent.id, {
          ...adjacent,
          content: adjacent.content + edit.inserted,
        }),
      };
    }
    const [id, next] = nextId(state);
    return {
      ok: true,
      state: {
        ...state,
        nextId: next,
        corrections: [
          ...state.corrections,
          { id, type: "insert", target: { kind: "text-point", offset }, content: edit.inserted },
        ],
      },
    };
  }

  const touchedProposals = projection.segments.filter(
    (segment): segment is Extract<DraftSegment, { kind: "proposal" }> =>
      segment.kind === "proposal" &&
      segment.draftEnd > edit.from &&
      segment.draftStart < edit.to,
  );
  if (touchedProposals.length > 0) {
    if (
      touchedProposals.length === 1 &&
      edit.from >= touchedProposals[0]!.draftStart &&
      edit.to <= touchedProposals[0]!.draftEnd
    ) {
      return editExistingProposal(state, touchedProposals[0]!, edit);
    }
    return {
      ok: false,
      state,
      message: "This edit crosses an unresolved suggestion. Accept or reject it first.",
    };
  }

  const target = baseRangeForDraftRange(projection, edit.from, edit.to);
  if (!target || overlapsExisting(state, target.start, target.end)) {
    return {
      ok: false,
      state,
      message: "This edit overlaps an unresolved suggestion. Accept or reject it first.",
    };
  }

  if (edit.inserted.length > 0) {
    const [id, next] = nextId(state);
    const correction: ReplaceCorrection = {
      id,
      type: "replace",
      target,
      replacement: edit.inserted,
    };
    return {
      ok: true,
      state: { ...state, nextId: next, corrections: [...state.corrections, correction] },
    };
  }

  const adjacent = activeCorrections(state).find(
    (correction): correction is DeleteCorrection =>
      correction.type === "delete" &&
      (correction.target.start === target.end || correction.target.end === target.start),
  );
  if (adjacent) {
    const merged: DeleteCorrection = {
      ...adjacent,
      target: {
        kind: "text-range",
        start: Math.min(adjacent.target.start, target.start),
        end: Math.max(adjacent.target.end, target.end),
      },
    };
    return { ok: true, state: replaceCorrection(state, adjacent.id, merged) };
  }
  const [id, next] = nextId(state);
  return {
    ok: true,
    state: {
      ...state,
      nextId: next,
      corrections: [...state.corrections, { id, type: "delete", target }],
    },
  };
}

export function applyDraftDocument(
  state: SuggestingState,
  nextDraft: string,
  inputType?: string,
): AdapterResult {
  const edit = diffDrafts(draftText(state), nextDraft);
  return edit
    ? applyDraftEdit(state, { ...edit, ...(inputType ? { inputType } : {}) })
    : { ok: true, state };
}

export function beginComposition(state: SuggestingState): CompositionSession {
  const text = draftText(state);
  return { baseDraft: text, previewDraft: text };
}

export function updateComposition(
  session: CompositionSession,
  previewDraft: string,
): CompositionSession {
  return { ...session, previewDraft };
}

export function commitComposition(
  state: SuggestingState,
  session: CompositionSession,
): AdapterResult {
  const edit = diffDrafts(session.baseDraft, session.previewDraft);
  return edit
    ? applyDraftEdit(state, { ...edit, inputType: "insertCompositionText" })
    : { ok: true, state };
}

function applyTextCorrection(text: string, correction: TextCorrection): string {
  if (correction.type === "insert") {
    return text.slice(0, correction.target.offset) + correction.content + text.slice(correction.target.offset);
  }
  if (correction.type === "delete") {
    return text.slice(0, correction.target.start) + text.slice(correction.target.end);
  }
  if (correction.type === "replace") {
    return text.slice(0, correction.target.start) + correction.replacement + text.slice(correction.target.end);
  }
  if (correction.type === "increase-spacing") {
    return text.slice(0, correction.target.offset) + " " + text.slice(correction.target.offset);
  }
  if (correction.type === "decrease-spacing") {
    return text.slice(0, correction.target.start) + text.slice(correction.target.end);
  }
  const [first, second] = correction.targets;
  return (
    text.slice(0, first.start) +
    text.slice(second.start, second.end) +
    text.slice(first.end, second.start) +
    text.slice(first.start, first.end) +
    text.slice(second.end)
  );
}

function mapBoundary(
  position: number,
  correction: TextCorrection,
  association: "before" | "after",
): number {
  if (correction.type === "transpose") return position;
  const start = correctionStart(correction);
  const end = correctionEnd(correction);
  const insertedLength =
    correction.type === "insert"
      ? correction.content.length
      : correction.type === "replace"
        ? correction.replacement.length
        : correction.type === "increase-spacing"
          ? 1
        : 0;
  const delta = insertedLength - (end - start);
  if (start === end) {
    if (position < start || (position === start && association === "before")) return position;
    return position + delta;
  }
  if (position <= start) return position;
  if (position >= end) return position + delta;
  return start + insertedLength;
}

function rebaseCorrection(
  candidate: SuggestingCorrection,
  accepted: TextCorrection,
): SuggestingCorrection {
  if (candidate.type === "cancel-correction" || accepted.type === "transpose") return candidate;
  if (candidate.type === "insert") {
    return {
      ...candidate,
      target: {
        ...candidate.target,
        offset: mapBoundary(candidate.target.offset, accepted, "after"),
      },
    };
  }
  if (candidate.type === "increase-spacing") {
    return {
      ...candidate,
      target: {
        ...candidate.target,
        offset: mapBoundary(candidate.target.offset, accepted, "after"),
      },
    };
  }
  if (candidate.type === "transpose") {
    return {
      ...candidate,
      targets: candidate.targets.map((target) => ({
        ...target,
        start: mapBoundary(target.start, accepted, "after"),
        end: mapBoundary(target.end, accepted, "before"),
      })) as [TextRangeTarget, TextRangeTarget],
    };
  }
  return {
    ...candidate,
    target: {
      ...candidate.target,
      start: mapBoundary(candidate.target.start, accepted, "after"),
      end: mapBoundary(candidate.target.end, accepted, "before"),
    },
  };
}

export function acceptSuggestion(state: SuggestingState, id: string): AdapterResult {
  const correction = activeCorrections(state).find((candidate) => candidate.id === id);
  if (!correction) {
    return { ok: false, state, message: "That suggestion is no longer active." };
  }
  const acceptedText = applyTextCorrection(state.acceptedText, correction);
  const remaining = state.corrections
    .filter((candidate) => candidate.id !== id)
    .map((candidate) => rebaseCorrection(candidate, correction));
  return { ok: true, state: { ...state, acceptedText, corrections: remaining } };
}

export function rejectSuggestion(state: SuggestingState, id: string): AdapterResult {
  const correction = activeCorrections(state).find((candidate) => candidate.id === id);
  if (!correction) {
    return { ok: false, state, message: "That suggestion is no longer active." };
  }
  const [cancelId, next] = nextId(state);
  return {
    ok: true,
    state: {
      ...state,
      nextId: next,
      corrections: [
        ...state.corrections,
        {
          id: cancelId,
          type: "cancel-correction",
          target: { kind: "correction", correctionId: id },
        },
      ],
    },
  };
}

export function transposeSelection(
  state: SuggestingState,
  from: number,
  to: number,
): AdapterResult {
  const projection = projectDraft(state);
  const selected = projection.text.slice(from, to);
  const match = /^(\S+)(\s+)(\S+)$/.exec(selected);
  const target = baseRangeForDraftRange(projection, from, to);
  if (!match || !target || overlapsExisting(state, target.start, target.end)) {
    return {
      ok: false,
      state,
      message: "Select exactly two adjacent words with the space between them.",
    };
  }
  const firstLength = match[1]!.length;
  const gapLength = match[2]!.length;
  const [id, next] = nextId(state);
  const correction: TransposeCorrection = {
    id,
    type: "transpose",
    targets: [
      { kind: "text-range", start: target.start, end: target.start + firstLength },
      {
        kind: "text-range",
        start: target.start + firstLength + gapLength,
        end: target.end,
      },
    ],
  };
  return {
    ok: true,
    state: { ...state, nextId: next, corrections: [...state.corrections, correction] },
  };
}

export function setAcceptedText(state: SuggestingState, acceptedText: string): SuggestingState {
  return { acceptedText, corrections: [], nextId: state.nextId };
}

export function describeCorrection(
  correction: TextCorrection,
  acceptedText: string,
): string {
  if (correction.type === "insert") return `Insert “${correction.content}”`;
  if (correction.type === "delete") {
    return `Delete “${acceptedText.slice(correction.target.start, correction.target.end)}”`;
  }
  if (correction.type === "replace") {
    return `Replace “${acceptedText.slice(correction.target.start, correction.target.end)}” → “${correction.replacement}”`;
  }
  if (correction.type === "increase-spacing") {
    return `Open spacing at boundary ${correction.target.offset}`;
  }
  if (correction.type === "decrease-spacing") {
    const selected = acceptedText.slice(correction.target.start, correction.target.end);
    return `Close existing whitespace “${selected.replaceAll(" ", "␠").replaceAll("\t", "⇥").replaceAll("\n", "↵")}”`;
  }
  const [first, second] = correction.targets;
  return `Transpose “${acceptedText.slice(first.start, first.end)}” ↔ “${acceptedText.slice(second.start, second.end)}”`;
}
