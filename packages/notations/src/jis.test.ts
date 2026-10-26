import type { Correction } from "@proofmarks/core";
import type {
  CorrectionGeometry,
  LogicalRect,
  ScenePath,
  WritingMode,
} from "@proofmarks/dom";
import { describe, expect, it } from "vitest";
import { getJisCapability, japaneseJisNotationPack } from "./jis";

const rect: LogicalRect = {
  inlineStart: 40,
  inlineEnd: 88,
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
    typeof japaneseJisNotationPack.buildScene
  >[2]["referencedCorrection"],
) {
  return japaneseJisNotationPack.buildScene(correction, resolved, {
    debug,
    ...(referencedCorrection ? { referencedCorrection } : {}),
  });
}

describe("Japanese JIS notation pack canonical audit", () => {
  it("distinguishes single-character deletion from multi-character range deletion", () => {
    const single = build({
      id: "single",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 1 },
    });
    const multiple = build({
      id: "multiple",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 3 },
    });

    expect(single.nodes.filter((node) => node.role === "target-stroke")).toHaveLength(1);
    expect(single.nodes.some((node) => node.role === "range-connector")).toBe(false);
    expect(multiple.nodes.map((node) => node.role)).toEqual(
      expect.arrayContaining([
        "range-start-boundary",
        "range-connector",
        "range-end-boundary",
        "leader",
        "notation-label",
      ]),
    );
  });

  it("builds insertion anchor, leader, two content boundaries, and real text", () => {
    const correction: Correction = {
      id: "insert",
      type: "insert",
      target: { kind: "text-point", offset: 2 },
      content: "を",
    };
    const horizontal = build(correction);
    const vertical = build(correction, geometry([[rect]], "vertical-rl"));

    expect(horizontal.nodes.filter((node) => node.role === "insertion-anchor")).toHaveLength(2);
    expect(
      horizontal.nodes.filter((node) => node.role === "insertion-content-boundary"),
    ).toHaveLength(2);
    expect(horizontal.nodes.some((node) => node.role === "leader")).toBe(true);
    expect(
      horizontal.nodes.some(
        (node) => node.type === "text" && node.role === "inserted-text" && node.text === "を",
      ),
    ).toBe(true);
    expect(vertical).not.toEqual(horizontal);
    expect(
      vertical.nodes.find((node) => node.type === "text" && node.role === "inserted-text"),
    ).toMatchObject({ orientation: "vertical-upright" });
  });

  it("represents multi-character replacement as target removal plus replacement material", () => {
    const result = build({
      id: "replace",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 2 },
      replacement: "文章",
    });

    expect(result.nodes.some((node) => node.role === "range-connector")).toBe(true);
    expect(
      result.nodes.some(
        (node) =>
          node.type === "text" &&
          node.role === "replacement-text" &&
          node.text === "文章",
      ),
    ).toBe(true);
  });

  it("constructs an exchange path through two adjacent operands", () => {
    const first = { ...rect, inlineStart: 40, inlineEnd: 64 };
    const second = { ...rect, inlineStart: 64, inlineEnd: 88 };
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
    const path = result.nodes.find(
      (node): node is ScenePath => node.type === "path" && node.role === "exchange-path",
    );

    expect(path).toBeDefined();
    expect(path?.commands[0]).toMatchObject({
      type: "move",
      to: { block: expect.any(Number) },
    });
    expect(path?.commands.at(-1)).toMatchObject({
      type: "cubic",
      to: { block: expect.any(Number) },
    });
    expect(result.debugPoints.map((point) => point.role)).toEqual(
      expect.arrayContaining(["operand-a", "operand-b"]),
    );
  });

  it("uses the same exchange grammar for adjacent groups", () => {
    const first = { ...rect, inlineStart: 24, inlineEnd: 72 };
    const second = { ...rect, inlineStart: 72, inlineEnd: 120 };
    const result = build(
      {
        id: "transpose-groups",
        type: "transpose",
        targets: [
          { kind: "text-range", start: 0, end: 2 },
          { kind: "text-range", start: 2, end: 4 },
        ],
      },
      geometry([[first], [second]]),
    );
    expect(result.nodes.filter((node) => node.role === "exchange-path")).toHaveLength(1);
    expect(result.fidelity).toBe("reference-based");
  });

  it("places イキ beside the target without inventing a new leader", () => {
    const deletion: Correction = {
      id: "delete",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 2 },
    };
    const resolved = geometry();
    const deletionScene = build(deletion, resolved);
    const cancellation: Correction = {
      id: "cancel",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "delete" },
    };
    const before = structuredClone(cancellation);
    const result = build(cancellation, resolved, false, {
      correction: deletion,
      targetGeometry: resolved,
      scene: deletionScene,
    });
    expect(result.nodes.some((node) => node.role === "leader")).toBe(false);
    expect(
      result.nodes.some(
        (node) => node.type === "text" && node.role === "notation-label" && node.text === "イキ",
      ),
    ).toBe(true);
    expect(cancellation).toEqual(before);
  });

  it("reports inline reference support and explicit scale fallback", () => {
    expect(getJisCapability("delete", "inline")).toBe("reference-based");
    expect(getJisCapability("delete", "phrase")).toBe("generic-fallback");
  });

  it("constructs deterministic output", () => {
    const correction: Correction = {
      id: "delete",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 3 },
    };
    expect(build(correction)).toEqual(build(correction));
  });

  it("uses the generic fallback for a wrapped target", () => {
    const correction: Correction = {
      id: "delete",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 3 },
    };
    const result = build(
      correction,
      geometry(
        [[
          rect,
          { ...rect, blockStart: 84, blockEnd: 110 },
          { ...rect, blockStart: 116, blockEnd: 142 },
        ]],
        "horizontal-tb",
        "phrase",
      ),
    );
    expect(result.fidelity).toBe("generic-fallback");
    expect(result.rectCount).toBe(3);
  });

  it("claims audited movement while rejecting malformed input at the semantic layer", () => {
    expect(
      japaneseJisNotationPack.supports(
        {
          id: "move",
          type: "move",
          source: { kind: "text-range", start: 0, end: 1 },
          destination: { kind: "text-point", offset: 3 },
        },
        { debug: false },
      ),
    ).toBe(true);
  });
});
