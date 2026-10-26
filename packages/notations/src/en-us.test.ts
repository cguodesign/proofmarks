import type { Correction } from "@proofmarks/core";
import {
  buildNotationScene,
  type CorrectionGeometry,
  type LogicalRect,
  type WritingMode,
} from "@proofmarks/dom";
import { describe, expect, it } from "vitest";
import { chineseGbNotationPack } from "./gb";
import { englishUsNotationPack, getEnUsCapability } from "./en-us";
import { japaneseJisNotationPack } from "./jis";
import { koreanKsNotationPack } from "./ks";

const rect: LogicalRect = {
  inlineStart: 40,
  inlineEnd: 116,
  blockStart: 52,
  blockEnd: 78,
};

function geometry(
  targets: LogicalRect[][] = [[rect]],
  writingMode: WritingMode = "horizontal-tb",
  scale: CorrectionGeometry["scale"] = "inline",
): CorrectionGeometry {
  return {
    writingMode,
    viewportWidth: 420,
    viewportHeight: 190,
    viewport:
      writingMode === "vertical-rl"
        ? { inlineSize: 190, blockSize: 420 }
        : { inlineSize: 420, blockSize: 190 },
    targets,
    scale,
  };
}

function build(
  correction: Correction,
  resolved = geometry(),
  debug = false,
  referencedCorrection?: Parameters<
    typeof englishUsNotationPack.buildScene
  >[2]["referencedCorrection"],
) {
  return englishUsNotationPack.buildScene(correction, resolved, {
    debug,
    ...(referencedCorrection ? { referencedCorrection } : {}),
  });
}

describe("traditional US proofreading notation pack", () => {
  it("publishes non-normative English identity and horizontal-only capability", () => {
    expect(englishUsNotationPack).toMatchObject({
      id: "en-us-traditional-reference",
      displayName: "English · US",
      locale: "en-US",
      writingModes: ["horizontal-tb"],
    });
    expect(englishUsNotationPack.support.map(({ operation }) => operation)).toEqual([
      "delete",
      "insert",
      "replace",
      "transpose",
      "move",
      "increase-spacing",
      "decrease-spacing",
      "cancel-correction",
    ]);
  });

  it("builds a word-level dele construction rather than generic strikethrough", () => {
    const result = build({
      id: "delete-word",
      type: "delete",
      target: { kind: "text-range", start: 11, end: 16 },
    });
    expect(result.fidelity).toBe("reference-based");
    expect(result.nodes.map(({ role }) => role)).toEqual([
      "target-stroke",
      "deletion-tail",
    ]);
  });

  it("builds a caret, leader, and real inserted word or punctuation", () => {
    const word = build({
      id: "insert-word",
      type: "insert",
      target: { kind: "text-point", offset: 24 },
      content: "final ",
    });
    const punctuation = build({
      id: "insert-comma",
      type: "insert",
      target: { kind: "text-point", offset: 12 },
      content: ",",
    });
    expect(word.nodes.map(({ role }) => role)).toEqual([
      "insertion-anchor",
      "insertion-anchor",
      "leader",
      "inserted-text",
    ]);
    expect(
      punctuation.nodes.find(
        (node) => node.type === "text" && node.role === "inserted-text",
      ),
    ).toMatchObject({ text: "," });
  });

  it("composes replacement from dele and insertion primitives without changing semantics", () => {
    const correction: Correction = {
      id: "replace-word",
      type: "replace",
      target: { kind: "text-range", start: 11, end: 15 },
      replacement: "reviewed",
    };
    const before = structuredClone(correction);
    const result = build(correction);
    expect(result.nodes.map(({ role }) => role)).toEqual([
      "target-stroke",
      "deletion-tail",
      "insertion-anchor",
      "insertion-anchor",
      "leader",
      "replacement-text",
    ]);
    expect(correction).toEqual(before);
  });

  it("uses operand brackets plus tr for adjacent word transposition", () => {
    const first = { ...rect, inlineStart: 40, inlineEnd: 112 };
    const second = { ...rect, inlineStart: 120, inlineEnd: 158 };
    const result = build(
      {
        id: "transpose-words",
        type: "transpose",
        targets: [
          { kind: "text-range", start: 4, end: 14 },
          { kind: "text-range", start: 15, end: 21 },
        ],
      },
      geometry([[first], [second]]),
      true,
    );
    expect(result.nodes.filter(({ role }) => role === "exchange-path")).toHaveLength(2);
    expect(result.nodes.find(({ role }) => role === "notation-label")).toMatchObject({
      type: "text",
      text: "tr",
    });
    expect(result.debugPoints.map(({ role }) => role)).toEqual(
      expect.arrayContaining(["operand-a", "operand-b"]),
    );
  });

  it("renders STET from an actual prior correction reference", () => {
    const deletion: Correction = {
      id: "delete-word",
      type: "delete",
      target: { kind: "text-range", start: 4, end: 10 },
    };
    const resolved = geometry();
    const deletionScene = build(deletion, resolved);
    const cancellation: Correction = {
      id: "cancel-delete-word",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "delete-word" },
    };
    const before = structuredClone(cancellation);
    const result = build(cancellation, resolved, true, {
      correction: deletion,
      targetGeometry: resolved,
      scene: deletionScene,
    });
    expect(result.fidelity).toBe("reference-based");
    expect(result.nodes.filter(({ role }) => role === "retention-mark").length).toBeGreaterThan(2);
    expect(result.nodes.find(({ role }) => role === "notation-label")).toMatchObject({
      type: "text",
      text: "stet",
    });
    expect(result.debugRects.map(({ role }) => role)).toEqual(
      expect.arrayContaining(["referenced-target-rect", "referenced-scene-bounds"]),
    );
    expect(cancellation).toEqual(before);
  });

  it("reports vertical composition as unsupported through pack capability", () => {
    expect(getEnUsCapability("delete", "inline", "horizontal-tb")).toBe(
      "reference-based",
    );
    expect(getEnUsCapability("delete", "inline", "vertical-rl")).toBe(
      "unsupported",
    );
    expect(getEnUsCapability("replace", "phrase", "horizontal-tb")).toBe(
      "generic-fallback",
    );
    const vertical = buildNotationScene(
      englishUsNotationPack,
      {
        id: "vertical-delete",
        type: "delete",
        target: { kind: "text-range", start: 0, end: 1 },
      },
      geometry([[rect]], "vertical-rl"),
      { debug: false },
    );
    expect(vertical.fidelity).toBe("unsupported");
    expect(vertical.nodes).toEqual([]);
  });

  it("preserves one correction across all four independent scenes", () => {
    const correction: Correction = {
      id: "same-delete",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 1 },
    };
    const before = structuredClone(correction);
    const resolved = geometry();
    const scenes = [
      japaneseJisNotationPack,
      chineseGbNotationPack,
      koreanKsNotationPack,
      englishUsNotationPack,
    ].map((pack) => pack.buildScene(correction, resolved, { debug: false }));
    expect(new Set(scenes.map(({ notationId }) => notationId))).toHaveProperty("size", 4);
    expect(correction).toEqual(before);
  });

  it("constructs deterministic scenes", () => {
    const correction: Correction = {
      id: "replace-word",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 6 },
      replacement: "editor",
    };
    expect(build(correction)).toEqual(build(correction));
  });
});
