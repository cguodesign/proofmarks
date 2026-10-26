import type { Correction } from "@proofmarks/core";
import type {
  CorrectionGeometry,
  LogicalRect,
  WritingMode,
} from "@proofmarks/dom";
import { describe, expect, it } from "vitest";
import {
  getCns3927Capability,
  taiwanCns3927NotationPack,
} from "./cns3927";

const rect: LogicalRect = {
  inlineStart: 40,
  inlineEnd: 64,
  blockStart: 48,
  blockEnd: 76,
};

function geometry(writingMode: WritingMode = "horizontal-tb"): CorrectionGeometry {
  return {
    writingMode,
    viewportWidth: 360,
    viewportHeight: 200,
    viewport: writingMode === "vertical-rl"
      ? { inlineSize: 200, blockSize: 360 }
      : { inlineSize: 360, blockSize: 200 },
    targets: [[rect]],
    scale: "inline",
    typography: {
      fontSize: 24,
      lineHeight: 36,
      fontFamily: '"Noto Serif TC", "Songti TC", serif',
    },
  };
}

function build(
  correction: Correction,
  resolved = geometry(),
  referencedCorrection?: Parameters<
    typeof taiwanCns3927NotationPack.buildScene
  >[2]["referencedCorrection"],
) {
  return taiwanCns3927NotationPack.buildScene(correction, resolved, {
    debug: true,
    ...(referencedCorrection ? { referencedCorrection } : {}),
  });
}

describe("Taiwan CNS 3927 notation pack", () => {
  it("publishes a jurisdiction-specific identity rather than a GB alias", () => {
    expect(taiwanCns3927NotationPack).toMatchObject({
      id: "cns3927",
      displayName: "臺灣 · CNS 3927",
      locale: "zh-Hant-TW",
      script: "Hant",
      jurisdiction: "TW",
    });
    expect(taiwanCns3927NotationPack.supportedCorrections).toEqual([
      "delete",
      "insert",
      "replace",
      "cancel-correction",
    ]);
  });

  it("builds independent interline and page-margin geometry", () => {
    const result = build({
      id: "replace",
      type: "replace",
      target: { kind: "text-range", start: 7, end: 8 },
      replacement: "份",
    });
    expect(result.notationId).toBe("cns3927");
    expect(result.fidelity).toBe("reference-based");
    expect(result.nodes.map(({ role }) => role)).toEqual([
      "target-boundary",
      "leader",
      "content-boundary",
      "replacement-text",
    ]);
  });

  it("uses Y for horizontal insertion and a left arrow for vertical insertion", () => {
    const correction: Correction = {
      id: "insert",
      type: "insert",
      target: { kind: "text-point", offset: 6 },
      content: "已",
    };
    const horizontal = build(correction);
    const vertical = build(correction, geometry("vertical-rl"));
    const horizontalAnchor = horizontal.nodes.find((node) => node.role === "insertion-anchor");
    const verticalAnchor = vertical.nodes.find((node) => node.role === "insertion-anchor");

    expect(horizontal.fidelity).toBe("reference-based");
    expect(vertical.fidelity).toBe("reference-based");
    expect(horizontalAnchor).not.toEqual(verticalAnchor);
  });

  it("models 保留 only as cancellation of a prior CNS deletion", () => {
    const deletion: Correction = {
      id: "delete-1",
      type: "delete",
      target: { kind: "text-range", start: 7, end: 8 },
    };
    const deletionScene = build(deletion);
    const retain: Correction = {
      id: "retain-1",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "delete-1" },
    };
    const result = build(retain, geometry(), {
      correction: deletion,
      targetGeometry: geometry(),
      scene: deletionScene,
    });

    expect(result.fidelity).toBe("reference-based");
    expect(result.nodes.filter(({ role }) => role === "retention-mark")).toHaveLength(1);
    expect(result.nodes.filter(({ role }) => role === "cancel-stroke")).toHaveLength(2);
  });

  it("does not inherit unverified GB operations or vertical geometry", () => {
    expect(getCns3927Capability("insert", "inline", "horizontal-tb")).toBe("reference-based");
    expect(getCns3927Capability("insert", "inline", "vertical-rl")).toBe("reference-based");
    expect(getCns3927Capability("delete", "inline", "vertical-rl")).toBe("unverified");
    expect(getCns3927Capability("transpose", "inline", "horizontal-tb")).toBe("unverified");
    expect(getCns3927Capability("increase-spacing", "inline", "horizontal-tb")).toBe("unverified");

    const result = build(
      {
        id: "move",
        type: "move",
        source: { kind: "text-range", start: 0, end: 1 },
        destination: { kind: "text-point", offset: 2 },
      },
      geometry(),
    );
    expect(result.fidelity).toBe("generic-fallback");
  });

  it("keeps Hant-TW UTF-16 fixtures exact across supported font stacks", () => {
    const text = "編輯仔細校對這分文稿。";
    const target = { kind: "text-range" as const, start: 7, end: 8 };
    const fontStacks = [
      '"Noto Serif TC", "Songti TC", "PMingLiU", serif',
      '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
    ];

    expect(text.slice(target.start, target.end)).toBe("分");
    expect(Array.from(text)).toHaveLength(text.length);
    for (const fontFamily of fontStacks) {
      const resolved = geometry();
      resolved.typography = { ...resolved.typography!, fontFamily };
      expect(build({ id: fontFamily, type: "replace", target, replacement: "份" }, resolved).nodes)
        .toEqual(expect.arrayContaining([expect.objectContaining({ role: "replacement-text", text: "份" })]));
    }
  });

  it("constructs deterministic output", () => {
    const correction: Correction = {
      id: "delete",
      type: "delete",
      target: { kind: "text-range", start: 7, end: 8 },
    };
    expect(build(correction)).toEqual(build(correction));
  });
});
