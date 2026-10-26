import { describe, expect, it } from "vitest";
import {
  getCorrectionTargets,
  orderCorrectionsByReference,
  resolveCorrectionReference,
  validateCorrection,
  validateCorrections,
  type CancelCorrection,
  type Correction,
} from "./index";

const corrections: Array<Exclude<Correction, CancelCorrection>> = [
  {
    id: "delete-name",
    type: "delete",
    target: { kind: "text-range", start: 8, end: 10 },
  },
  {
    id: "insert-name",
    type: "insert",
    target: { kind: "text-point", offset: 8 },
    content: "猫",
  },
  {
    id: "replace-name",
    type: "replace",
    target: { kind: "text-range", start: 8, end: 10 },
    replacement: "名称",
  },
  {
    id: "transpose-name",
    type: "transpose",
    targets: [
      { kind: "text-range", start: 8, end: 9 },
      { kind: "text-range", start: 9, end: 10 },
    ],
  },
  {
    id: "move-name",
    type: "move",
    source: { kind: "text-range", start: 8, end: 10 },
    destination: { kind: "text-point", offset: 4 },
  },
  {
    id: "increase-spacing",
    type: "increase-spacing",
    target: { kind: "text-point", offset: 4 },
  },
  {
    id: "decrease-spacing",
    type: "decrease-spacing",
    target: { kind: "text-range", start: 4, end: 5 },
  },
];

const cancel: CancelCorrection = {
  id: "cancel-delete-name",
  type: "cancel-correction",
  target: { kind: "correction", correctionId: "delete-name" },
};

describe("validateCorrection", () => {
  it.each([...corrections, cancel])("accepts $type semantic data", (correction) => {
    expect(() => validateCorrection(correction, 16)).not.toThrow();
  });

  it("accepts insertion at either text boundary", () => {
    expect(() =>
      validateCorrection(
        {
          id: "at-start",
          type: "insert",
          target: { kind: "text-point", offset: 0 },
          content: "A",
        },
        4,
      ),
    ).not.toThrow();
    expect(() =>
      validateCorrection(
        {
          id: "at-end",
          type: "insert",
          target: { kind: "text-point", offset: 4 },
          content: "B",
        },
        4,
      ),
    ).not.toThrow();
  });

  it("rejects empty, reversed, and out-of-bounds ranges", () => {
    expect(() =>
      validateCorrection(
        {
          id: "empty",
          type: "delete",
          target: { kind: "text-range", start: 8, end: 8 },
        },
        16,
      ),
    ).toThrow(/start < end/);
    expect(() =>
      validateCorrection(
        {
          id: "reverse",
          type: "delete",
          target: { kind: "text-range", start: 10, end: 8 },
        },
        16,
      ),
    ).toThrow(/start < end/);
    expect(() => validateCorrection(corrections[0], 9)).toThrow(/text length/);
  });

  it("rejects missing insertion content and missing replacement text", () => {
    expect(() =>
      validateCorrection({
        id: "insert",
        type: "insert",
        target: { kind: "text-point", offset: 1 },
      }),
    ).toThrow(/content/);
    expect(() =>
      validateCorrection({
        id: "replace",
        type: "replace",
        target: { kind: "text-range", start: 0, end: 1 },
        replacement: "",
      }),
    ).toThrow(/content/);
  });

  it("rejects invalid transposition targets", () => {
    expect(() =>
      validateCorrection({
        id: "one",
        type: "transpose",
        targets: [{ kind: "text-range", start: 0, end: 1 }],
      }),
    ).toThrow(/exactly two/);
    expect(() =>
      validateCorrection({
        id: "overlap",
        type: "transpose",
        targets: [
          { kind: "text-range", start: 2, end: 4 },
          { kind: "text-range", start: 3, end: 5 },
        ],
      }),
    ).toThrow(/must not overlap/);
  });

  it("rejects a move destination inside its source", () => {
    expect(() =>
      validateCorrection({
        id: "move-nowhere",
        type: "move",
        source: { kind: "text-range", start: 2, end: 5 },
        destination: { kind: "text-point", offset: 4 },
      }),
    ).toThrow(/outside its source/);
  });

  it("distinguishes spacing boundaries from existing spacing", () => {
    expect(() =>
      validateCorrection({
        id: "bad-increase",
        type: "increase-spacing",
        target: { kind: "text-range", start: 2, end: 3 },
      }),
    ).toThrow(/kind "text-point"/);
    expect(() =>
      validateCorrection({
        id: "bad-decrease",
        type: "decrease-spacing",
        target: { kind: "text-point", offset: 2 },
      }),
    ).toThrow(/kind "text-range"/);
  });

  it("makes operation and target-kind compatibility explicit", () => {
    expect(() =>
      validateCorrection({
        id: "delete-ref",
        type: "delete",
        target: { kind: "correction", correctionId: "delete-name" },
      }),
    ).toThrow(/kind "text-range"/);
    expect(() =>
      validateCorrection({
        id: "cancel-text",
        type: "cancel-correction",
        target: { kind: "text-range", start: 0, end: 1 },
      }),
    ).toThrow(/kind "correction"/);
  });

  it("keeps every target notation- and layout-neutral", () => {
    for (const correction of [...corrections, cancel]) {
      expect(JSON.stringify(correction)).not.toMatch(
        /"(?:x|y|width|height|writingMode|scale|jis|stet|iki)"\s*:/i,
      );
    }
    for (const correction of corrections) {
      expect(getCorrectionTargets(correction)).not.toHaveLength(0);
    }
  });
});

describe("correction references", () => {
  it("resolves a cancellation by stable correction id without duplicating its range", () => {
    expect(resolveCorrectionReference(cancel, [...corrections, cancel])).toBe(
      corrections[0],
    );
    expect(cancel.target).toEqual({
      kind: "correction",
      correctionId: "delete-name",
    });
    expect(cancel.target).not.toHaveProperty("start");
  });

  it("rejects missing and self references", () => {
    expect(() => validateCorrections([cancel])).toThrow(/missing correction/);
    const self: CancelCorrection = {
      id: "self",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "self" },
    };
    expect(() => validateCorrections([self])).toThrow(/cannot reference itself/);
  });

  it("rejects a two-node cycle", () => {
    const first: CancelCorrection = {
      id: "first",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "second" },
    };
    const second: CancelCorrection = {
      id: "second",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "first" },
    };
    expect(() => validateCorrections([first, second])).toThrow(/Cyclic/);
  });

  it("orders a referenced correction before its canceler regardless of input order", () => {
    expect(orderCorrectionsByReference([cancel, corrections[0]!]).map(({ id }) => id))
      .toEqual(["delete-name", "cancel-delete-name"]);
  });
});
