import type { Correction } from "@proofmarks/core";
import type {
  CorrectionGeometry,
  LogicalRect,
  WritingMode,
} from "@proofmarks/dom";
import { describe, expect, it } from "vitest";
import { chineseGbNotationPack } from "./gb";
import { japaneseJisNotationPack } from "./jis";
import { getKsCapability, koreanKsNotationPack } from "./ks";

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

function build(correction: Correction, resolved = geometry(), debug = false) {
  return koreanKsNotationPack.buildScene(correction, resolved, { debug });
}

describe("Korean KS A 0104 reference pack", () => {
  it("publishes an independent Korean identity and audited support metadata", () => {
    expect(koreanKsNotationPack).toMatchObject({
      id: "ko-ks-a0104-reference",
      displayName: "Korean · KS",
      locale: "ko-KR",
    });
    expect(koreanKsNotationPack.support.map((item) => item.operation)).toEqual([
      "delete",
      "insert",
      "replace",
      "transpose",
      "move",
      "increase-spacing",
      "decrease-spacing",
      "cancel-correction",
    ]);
    expect(
      koreanKsNotationPack.support.find(
        ({ operation }) => operation === "cancel-correction",
      )?.scales,
    ).toEqual([]);
  });

  it("builds horizontal 뺌표 as a target-attached v construction", () => {
    const result = build({
      id: "delete",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 1 },
    });
    expect(result.fidelity).toBe("reference-based");
    expect(result.nodes.map(({ role }) => role)).toEqual(["target-stroke"]);
  });

  it("builds 넣음표 with a hooked insertion point and inserted material", () => {
    const result = build({
      id: "insert",
      type: "insert",
      target: { kind: "text-point", offset: 1 },
      content: "을",
    });
    expect(result.nodes.map(({ role }) => role)).toEqual([
      "insertion-anchor",
      "leader",
      "inserted-text",
    ]);
  });

  it("builds 고침표 from a loop, leader, and real replacement text", () => {
    const result = build({
      id: "replace",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 1 },
      replacement: "문",
    });
    expect(result.nodes.map(({ role }) => role)).toEqual([
      "target-boundary",
      "leader",
      "replacement-text",
    ]);
  });

  it("builds 자리 바꿈표 as one continuous interlocking exchange path", () => {
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
    expect(result.nodes.filter(({ role }) => role === "exchange-path")).toHaveLength(1);
    expect(result.debugPoints.map(({ role }) => role)).toEqual(
      expect.arrayContaining(["operand-a", "operand-b"]),
    );
  });

  it("keeps vertical and cancel-correction capability explicitly unverified", () => {
    expect(getKsCapability("delete", "inline", "horizontal-tb")).toBe(
      "reference-based",
    );
    expect(getKsCapability("delete", "inline", "vertical-rl")).toBe(
      "generic-fallback",
    );
    expect(getKsCapability("replace", "phrase", "horizontal-tb")).toBe(
      "generic-fallback",
    );
    expect(getKsCapability("cancel-correction", "inline", "horizontal-tb")).toBe(
      "generic-fallback",
    );

    const cancellation = build({
      id: "cancel",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "delete" },
    });
    expect(cancellation.fidelity).toBe("generic-fallback");
  });

  it("leaves shared semantics unchanged while all three packs build distinct scenes", () => {
    const correction: Correction = {
      id: "same-replace",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 1 },
      replacement: "문",
    };
    const before = structuredClone(correction);
    const resolved = geometry();
    const scenes = [
      japaneseJisNotationPack.buildScene(correction, resolved, { debug: false }),
      chineseGbNotationPack.buildScene(correction, resolved, { debug: false }),
      koreanKsNotationPack.buildScene(correction, resolved, { debug: false }),
    ];
    expect(new Set(scenes.map(({ notationId }) => notationId))).toHaveProperty("size", 3);
    expect(scenes[0]?.nodes).not.toEqual(scenes[1]?.nodes);
    expect(scenes[1]?.nodes).not.toEqual(scenes[2]?.nodes);
    expect(correction).toEqual(before);
  });
});
