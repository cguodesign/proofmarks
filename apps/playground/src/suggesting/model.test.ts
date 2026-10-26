import { describe, expect, it } from "vitest";
import {
  acceptSuggestion,
  activeCorrections,
  applyDraftEdit,
  applyDraftDocument,
  beginComposition,
  commitComposition,
  createSuggestingState,
  draftText,
  rejectSuggestion,
  suggestionOwnership,
  transposeSelection,
  updateComposition,
  type SuggestingState,
} from "./model";

function apply(state: SuggestingState, draft: string): SuggestingState {
  const result = applyDraftDocument(state, draft);
  expect(result.ok).toBe(true);
  return result.state;
}

function edit(state: SuggestingState, from: number, to: number, inserted: string): SuggestingState {
  const result = applyDraftEdit(state, { from, to, inserted });
  expect(result.ok).toBe(true);
  return result.state;
}

describe("suggesting adapter", () => {
  it("coalesces consecutive typing into one stable insertion", () => {
    let state = createSuggestingState("The editor reviewed the manuscript.");
    let result = applyDraftEdit(state, { from: 4, to: 4, inserted: "s" });
    expect(result.ok).toBe(true);
    state = result.state;
    const id = state.corrections[0]!.id;
    result = applyDraftEdit(state, { from: 5, to: 5, inserted: "e" });
    state = result.state;
    result = applyDraftEdit(state, { from: 6, to: 6, inserted: "n" });
    state = result.state;

    expect(state.corrections).toEqual([
      {
        id,
        type: "insert",
        target: { kind: "text-point", offset: 4 },
        content: "sen",
      },
    ]);
  });

  it("coalesces consecutive backspace into one stable deletion", () => {
    let state = createSuggestingState("The very editor.");
    state = apply(state, "The very edito.");
    const id = state.corrections[0]!.id;
    state = apply(state, "The very edit.");
    state = apply(state, "The very edi.");

    expect(state.corrections).toEqual([
      { id, type: "delete", target: { kind: "text-range", start: 12, end: 15 } },
    ]);
  });

  it("creates first-class replace and paste corrections", () => {
    let state = createSuggestingState("The draft is ready.");
    state = apply(state, "The proof is ready.");
    expect(state.corrections[0]).toMatchObject({
      type: "replace",
      target: { start: 4, end: 9 },
      replacement: "proof",
    });

    state = createSuggestingState("Paste here.");
    state = apply(state, "Paste useful text here.");
    expect(state.corrections[0]).toMatchObject({
      type: "insert",
      content: "useful text ",
    });

    state = createSuggestingState("Replace draft.");
    state = apply(state, "Replace final copy.");
    expect(state.corrections[0]).toMatchObject({
      type: "replace",
      replacement: "final copy",
    });
  });

  it("authors a transpose from two selected adjacent operands", () => {
    const state = createSuggestingState("The first second pass.");
    const result = transposeSelection(state, 4, 16);
    expect(result.ok).toBe(true);
    expect(result.state.corrections[0]).toMatchObject({
      type: "transpose",
      targets: [
        { start: 4, end: 9 },
        { start: 10, end: 16 },
      ],
    });
    expect(draftText(result.state)).toBe("The second first pass.");
  });

  it("rejects with a cancel-correction and restores the effective draft", () => {
    let state = createSuggestingState("Delete very carefully.");
    state = apply(state, "Delete carefully.");
    const originalId = state.corrections[0]!.id;
    const result = rejectSuggestion(state, originalId);
    expect(result.ok).toBe(true);
    expect(result.state.corrections[1]).toEqual({
      id: "suggestion-2",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: originalId },
    });
    expect(activeCorrections(result.state)).toHaveLength(0);
    expect(draftText(result.state)).toBe("Delete very carefully.");
  });

  it("accepts one suggestion and rebases a later target without clearing it", () => {
    let state = createSuggestingState("The editor reviewed the draft.");
    state = apply(state, "The senior editor reviewed the draft.");
    state = apply(state, "The senior editor reviewed the copy.");
    const [insert, replace] = activeCorrections(state);
    expect(insert?.type).toBe("insert");
    expect(replace?.type).toBe("replace");
    expect(replace && replace.type === "replace" ? replace.target.start : -1).toBe(24);

    const result = acceptSuggestion(state, insert!.id);
    expect(result.ok).toBe(true);
    expect(result.state.acceptedText).toBe("The senior editor reviewed the draft.");
    expect(activeCorrections(result.state)).toHaveLength(1);
    expect(activeCorrections(result.state)[0]).toMatchObject({
      id: replace!.id,
      target: { start: 31, end: 36 },
    });
    expect(draftText(result.state)).toBe("The senior editor reviewed the copy.");
  });

  it("does not expand an adjacent earlier range when accepting an insertion", () => {
    const state: SuggestingState = {
      acceptedText: "abcd",
      nextId: 3,
      corrections: [
        { id: "suggestion-1", type: "insert", target: { kind: "text-point", offset: 2 }, content: "XY" },
        { id: "suggestion-2", type: "delete", target: { kind: "text-range", start: 0, end: 2 } },
      ],
    };
    const result = acceptSuggestion(state, "suggestion-1");
    expect(result.ok).toBe(true);
    expect(result.state.corrections[0]).toMatchObject({
      type: "delete",
      target: { start: 0, end: 2 },
    });
  });

  it("keeps three simultaneous suggestions anchored", () => {
    let state = createSuggestingState("Alpha beta gamma delta.");
    state = apply(state, "New Alpha beta gamma delta.");
    state = apply(state, "New Alpha beta delta.");
    state = apply(state, "New Alpha BETA delta.");
    expect(activeCorrections(state).map((correction) => correction.type).sort()).toEqual([
      "delete",
      "insert",
      "replace",
    ]);
    expect(draftText(state)).toBe("New Alpha BETA delta.");
  });

  it("groups Japanese, Chinese, and Korean composition previews into one commit", () => {
    const cases = [
      ["文章を校正する。", ["k", "ka", "か", "漢", "漢字"]],
      ["这是一份文稿。", ["w", "wen", "文", "文字"]],
      ["문장을 교정한다.", ["ㅎ", "하", "한", "한글"]],
    ] as const;

    for (const [base, previews] of cases) {
      const state = createSuggestingState(base);
      let session = beginComposition(state);
      for (const preview of previews) {
        session = updateComposition(session, preview + base);
        expect(state.corrections).toHaveLength(0);
      }
      const result = commitComposition(state, session);
      expect(result.ok).toBe(true);
      expect(result.state.corrections).toHaveLength(1);
      expect(result.state.corrections[0]).toMatchObject({
        id: "suggestion-1",
        type: "insert",
        target: { offset: 0 },
        content: previews.at(-1),
      });
    }
  });

  it("blocks an edit that crosses an unresolved proposal", () => {
    let state = createSuggestingState("The editor.");
    state = apply(state, "The senior editor.");
    const result = applyDraftEdit(state, { from: 6, to: 12, inserted: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/unresolved suggestion/i);
    expect(result.state).toBe(state);
  });

  it("rejects overlapping and containing edits without partially mutating state", () => {
    let state = createSuggestingState("The editor reviewed the manuscript.");
    state = edit(state, 4, 10, "writer");
    const snapshot = JSON.stringify({
      acceptedText: state.acceptedText,
      draftText: draftText(state),
      corrections: state.corrections,
      active: activeCorrections(state),
      history: state.corrections.filter(({ type }) => type === "cancel-correction"),
    });

    for (const attempted of [
      { from: 2, to: 12, inserted: "" },
      { from: 8, to: 14, inserted: "revised" },
    ]) {
      const result = applyDraftEdit(state, attempted);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
      expect(JSON.stringify({
        acceptedText: result.state.acceptedText,
        draftText: draftText(result.state),
        corrections: result.state.corrections,
        active: activeCorrections(result.state),
        history: result.state.corrections.filter(({ type }) => type === "cancel-correction"),
      })).toBe(snapshot);
    }
  });
});

describe("suggestion identity and ownership", () => {
  it("keeps one replacement ID across separate transaction groups and a logical pause", () => {
    let state = createSuggestingState("The editor carefully reviewed the manuscript.");
    state = edit(state, 4, 10, "wri");
    const id = state.corrections[0]!.id;

    // A separate call represents another editor transaction/history group. No
    // clock or timeout participates in ownership.
    state = edit(state, 7, 7, "ter");

    expect(state.corrections).toEqual([
      {
        id,
        type: "replace",
        target: { kind: "text-range", start: 4, end: 10 },
        replacement: "writer",
      },
    ]);
  });

  it("splits whitespace plus a new token after a replacement into an independent insertion", () => {
    let state = createSuggestingState("The editor carefully reviewed the manuscript.");
    state = edit(state, 4, 10, "wri");
    const replaceId = state.corrections[0]!.id;
    state = edit(state, 7, 7, "ter");
    state = edit(state, 10, 10, " new");

    expect(state.corrections).toEqual([
      {
        id: replaceId,
        type: "replace",
        target: { kind: "text-range", start: 4, end: 10 },
        replacement: "writer",
      },
      {
        id: "suggestion-2",
        type: "insert",
        target: { kind: "text-point", offset: 10 },
        content: " new",
      },
    ]);
    expect(draftText(state)).toBe("The writer new carefully reviewed the manuscript.");
  });

  it("splits a mixed lexical continuation at its first whitespace boundary", () => {
    let state = createSuggestingState("The editor carefully.");
    state = edit(state, 4, 10, "wri");
    const id = state.corrections[0]!.id;
    state = edit(state, 7, 7, "ter new");

    expect(state.corrections).toHaveLength(2);
    expect(state.corrections[0]).toMatchObject({ id, replacement: "writer" });
    expect(state.corrections[1]).toMatchObject({ type: "insert", content: " new" });
  });

  it("edits inside inserted material without creating a nested correction", () => {
    let state = createSuggestingState("The editor reviewed it.");
    state = edit(state, 4, 4, "senor ");
    const id = state.corrections[0]!.id;
    state = edit(state, 7, 7, "i");

    expect(state.corrections).toEqual([
      {
        id,
        type: "insert",
        target: { kind: "text-point", offset: 4 },
        content: "senior ",
      },
    ]);
  });

  it("edits inside replacement material without creating corrections against draft text", () => {
    let state = createSuggestingState("The editor reviewed it.");
    state = edit(state, 4, 10, "writre");
    const id = state.corrections[0]!.id;
    state = edit(state, 8, 10, "er");

    expect(state.corrections).toEqual([
      {
        id,
        type: "replace",
        target: { kind: "text-range", start: 4, end: 10 },
        replacement: "writer",
      },
    ]);
  });

  it("backspaces inside insertion and replacement ownership with stable IDs", () => {
    let insertion = createSuggestingState("The editor.");
    insertion = edit(insertion, 4, 4, "writerx");
    const insertionId = insertion.corrections[0]!.id;
    insertion = edit(insertion, 10, 11, "");
    expect(insertion.corrections).toEqual([
      {
        id: insertionId,
        type: "insert",
        target: { kind: "text-point", offset: 4 },
        content: "writer",
      },
    ]);

    let replacement = createSuggestingState("The editor.");
    replacement = edit(replacement, 4, 10, "writerx");
    const replacementId = replacement.corrections[0]!.id;
    replacement = edit(replacement, 10, 11, "");
    expect(replacement.corrections).toEqual([
      {
        id: replacementId,
        type: "replace",
        target: { kind: "text-range", start: 4, end: 10 },
        replacement: "writer",
      },
    ]);
  });

  it("normalizes an emptied insertion and a restored replacement to no-ops", () => {
    let insertion = createSuggestingState("The editor.");
    insertion = edit(insertion, 4, 4, "new");
    insertion = edit(insertion, 4, 7, "");
    expect(insertion.corrections).toEqual([]);
    expect(draftText(insertion)).toBe("The editor.");

    let replacement = createSuggestingState("The editor.");
    replacement = edit(replacement, 4, 10, "writer");
    replacement = edit(replacement, 4, 10, "editor");
    expect(replacement.corrections).toEqual([]);
    expect(draftText(replacement)).toBe("The editor.");
  });

  it("uses the right-hand owner at a shared suggestion boundary", () => {
    let state = createSuggestingState("The editor carefully.");
    state = edit(state, 4, 10, "writer");
    const replaceId = state.corrections[0]!.id;
    state = edit(state, 10, 10, " new");
    const insertId = state.corrections[1]!.id;
    state = edit(state, 10, 10, "X");

    expect(state.corrections[0]).toMatchObject({ id: replaceId, replacement: "writer" });
    expect(state.corrections[1]).toMatchObject({ id: insertId, content: "X new" });
  });

  it("preserves nearby IDs and targets when accepting the lexical insertion", () => {
    let state = createSuggestingState("The editor carefully reviewed the manuscript.");
    state = edit(state, 4, 10, "writer");
    state = edit(state, 10, 10, " new");
    const manuscript = draftText(state).indexOf("manuscript");
    state = edit(state, manuscript, manuscript + "manuscript".length, "");
    const [replacement, insertion, deletion] = activeCorrections(state);

    const accepted = acceptSuggestion(state, insertion!.id);
    expect(accepted.ok).toBe(true);
    expect(accepted.state.acceptedText).toBe(
      "The editor new carefully reviewed the manuscript.",
    );
    expect(activeCorrections(accepted.state)).toEqual([
      {
        ...replacement,
        target: { kind: "text-range", start: 4, end: 10 },
      },
      {
        ...deletion,
        target: { kind: "text-range", start: 38, end: 48 },
      },
    ]);
    expect(draftText(accepted.state)).toBe("The writer new carefully reviewed the .");
  });

  it("rejects an edited replacement by referencing its original stable ID", () => {
    let state = createSuggestingState("The editor reviewed it.");
    state = edit(state, 4, 10, "wri");
    const id = state.corrections[0]!.id;
    state = edit(state, 7, 7, "ter");
    const rejected = rejectSuggestion(state, id);
    expect(rejected.ok).toBe(true);
    expect(rejected.state.corrections.at(-1)).toEqual({
      id: "suggestion-2",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: id },
    });
  });

  it("commits composition inside existing ownership without changing identity", () => {
    let state = createSuggestingState("校正する。");
    state = edit(state, 0, 0, "漢");
    const id = state.corrections[0]!.id;
    let composition = beginComposition(state);
    composition = updateComposition(composition, "漢字校正する。");
    const committed = commitComposition(state, composition);
    expect(committed.ok).toBe(true);
    expect(committed.state.corrections).toEqual([
      {
        id,
        type: "insert",
        target: { kind: "text-point", offset: 0 },
        content: "漢字",
      },
    ]);
  });

  it("reports base targets and draft-owned spans in semantic debug state", () => {
    let state = createSuggestingState("The editor carefully.");
    state = edit(state, 4, 10, "writer");
    state = edit(state, 10, 10, " new");

    expect(suggestionOwnership(state)).toEqual([
      {
        id: "suggestion-1",
        operation: "replace",
        baseTarget: { kind: "text-range", start: 4, end: 10 },
        draftOwnedSpan: { from: 4, to: 10 },
        value: "writer",
        status: "active",
      },
      {
        id: "suggestion-2",
        operation: "insert",
        baseTarget: { kind: "text-point", offset: 10 },
        draftOwnedSpan: { from: 10, to: 14 },
        value: " new",
        status: "active",
      },
    ]);
  });

  it("materializes boundary-open and whitespace-close presets without changing accepted text", () => {
    const state = createSuggestingState("Set thisphrase    with uneven spacing.", [
      {
        id: "open-boundary",
        type: "increase-spacing",
        target: { kind: "text-point", offset: 8 },
      },
      {
        id: "close-existing-whitespace",
        type: "decrease-spacing",
        target: { kind: "text-range", start: 14, end: 17 },
      },
    ]);

    expect(state.acceptedText).toBe("Set thisphrase    with uneven spacing.");
    expect(draftText(state)).toBe("Set this phrase with uneven spacing.");
    expect(suggestionOwnership(state)).toEqual([
      expect.objectContaining({ operation: "increase-spacing", value: " " }),
      expect.objectContaining({ operation: "decrease-spacing", value: null }),
    ]);

    const acceptedOpen = acceptSuggestion(state, "open-boundary");
    expect(acceptedOpen.ok).toBe(true);
    expect(acceptedOpen.state.acceptedText).toBe(
      "Set this phrase    with uneven spacing.",
    );
    expect(activeCorrections(acceptedOpen.state)).toEqual([
      {
        id: "close-existing-whitespace",
        type: "decrease-spacing",
        target: { kind: "text-range", start: 15, end: 18 },
      },
    ]);
  });
});
