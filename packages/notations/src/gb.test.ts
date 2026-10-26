import type { Correction } from "@proofmarks/core";
import type {
  CorrectionGeometry,
  LogicalRect,
  WritingMode,
} from "@proofmarks/dom";
import { describe, expect, it } from "vitest";
import { chineseGbNotationPack, getGbCapability } from "./gb";
import { japaneseJisNotationPack } from "./jis";

const rect: LogicalRect = {
  inlineStart: 40,
  inlineEnd: 66,
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
    viewportWidth: 320,
    viewportHeight: 180,
    viewport:
      writingMode === "vertical-rl"
        ? { inlineSize: 180, blockSize: 320 }
        : { inlineSize: 320, blockSize: 180 },
    targets,
    scale,
  };
}

function build(
  correction: Correction,
  resolved = geometry(),
  debug = false,
  referencedCorrection?: Parameters<
    typeof chineseGbNotationPack.buildScene
  >[2]["referencedCorrection"],
) {
  return chineseGbNotationPack.buildScene(correction, resolved, {
    debug,
    ...(referencedCorrection ? { referencedCorrection } : {}),
  });
}

describe("Chinese GB/T 14706 notation pack", () => {
  it("publishes Chinese identity and audited capability metadata", () => {
    expect(chineseGbNotationPack).toMatchObject({
      id: "zh-gb-t14706-reference",
      displayName: "Chinese · GB",
      locale: "zh-CN",
    });
    expect(chineseGbNotationPack.support.map((item) => item.operation)).toEqual([
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

  it("builds deletion as a target boundary plus the GB deletion tail", () => {
    const result = build({
      id: "delete",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 1 },
    });
    expect(result.nodes.map((node) => node.role)).toEqual([
      "target-boundary",
      "deletion-tail",
    ]);
    expect(result.fidelity).toBe("reference-based");
  });

  it("builds insertion as a hooked point connected to circled content", () => {
    const result = build({
      id: "insert",
      type: "insert",
      target: { kind: "text-point", offset: 1 },
      content: "的",
    });
    expect(result.nodes.map((node) => node.role)).toEqual([
      "insertion-anchor",
      "leader",
      "content-boundary",
      "inserted-text",
    ]);
  });

  it("builds replacement as two circles joined by a leader", () => {
    const result = build({
      id: "replace",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 1 },
      replacement: "章",
    });
    expect(result.nodes.map((node) => node.role)).toEqual([
      "target-boundary",
      "leader",
      "content-boundary",
      "replacement-text",
    ]);
  });

  it("uses two exchange hooks for adjacent GB transposition", () => {
    const first = { ...rect, inlineStart: 40, inlineEnd: 62 };
    const second = { ...rect, inlineStart: 62, inlineEnd: 84 };
    const result = build(
      {
        id: "transpose",
        type: "transpose",
        targets: [
          { kind: "text-range", start: 0, end: 1 },
          { kind: "text-range", start: 1, end: 2 },
        ],
      },
      geometry([[first], [second]]),
      true,
    );
    expect(result.nodes.filter((node) => node.role === "exchange-path")).toHaveLength(2);
    expect(result.debugPoints.map((point) => point.role)).toEqual(
      expect.arrayContaining(["operand-a", "operand-b"]),
    );
  });

  it("keeps identical semantic data while JIS and GB produce different scenes", () => {
    const correction: Correction = {
      id: "same-delete",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 1 },
    };
    const before = structuredClone(correction);
    const resolved = geometry();
    const jis = japaneseJisNotationPack.buildScene(correction, resolved, { debug: false });
    const gb = chineseGbNotationPack.buildScene(correction, resolved, { debug: false });

    expect(correction).toEqual(before);
    expect(jis.notationId).not.toBe(gb.notationId);
    expect(jis.nodes).not.toEqual(gb.nodes);
    expect(jis.rectCount).toBe(gb.rectCount);
  });

  it("uses explicit fallback for vertical and large-scale scenes", () => {
    expect(getGbCapability("delete", "inline", "horizontal-tb")).toBe(
      "reference-based",
    );
    expect(getGbCapability("delete", "inline", "vertical-rl")).toBe(
      "generic-fallback",
    );
    expect(getGbCapability("replace", "phrase", "horizontal-tb")).toBe(
      "generic-fallback",
    );
    expect(getGbCapability("cancel-correction", "inline", "horizontal-tb")).toBe(
      "reference-based",
    );

    const vertical = build(
      {
        id: "delete",
        type: "delete",
        target: { kind: "text-range", start: 0, end: 1 },
      },
      geometry([[rect]], "vertical-rl"),
    );
    expect(vertical.fidelity).toBe("generic-fallback");
  });

  it("builds GB 保留 from the prior deletion scene", () => {
    const deletion: Correction = {
      id: "delete",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 1 },
    };
    const resolved = geometry();
    const deletionScene = build(deletion, resolved);
    const cancellation: Correction = {
      id: "cancel",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "delete" },
    };
    const before = structuredClone(cancellation);
    const result = build(cancellation, resolved, true, {
      correction: deletion,
      targetGeometry: resolved,
      scene: deletionScene,
    });
    expect(result.fidelity).toBe("reference-based");
    expect(result.nodes.filter((node) => node.role === "retention-mark")).toHaveLength(1);
    expect(result.nodes.filter((node) => node.role === "cancel-stroke")).toHaveLength(2);
    expect(result.debugRects.map(({ role }) => role)).toEqual(
      expect.arrayContaining(["referenced-target-rect", "referenced-scene-bounds"]),
    );
    expect(result.debugPoints.map(({ role }) => role)).toEqual(
      expect.arrayContaining(["referenced-mark-anchor", "cancel-anchor"]),
    );
    expect(cancellation).toEqual(before);
  });

  it("constructs deterministic output", () => {
    const correction: Correction = {
      id: "replace",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 2 },
      replacement: "文章",
    };
    expect(build(correction)).toEqual(build(correction));
  });
});
