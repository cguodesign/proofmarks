import type { Correction } from "@proofmarks/core";
import type { CorrectionGeometry, LogicalRect, NotationPack } from "@proofmarks/dom";
import { describe, expect, it } from "vitest";
import { englishUsNotationPack } from "./en-us";
import { chineseGbNotationPack } from "./gb";
import { japaneseJisNotationPack } from "./jis";
import { koreanKsNotationPack } from "./ks";

const source: LogicalRect = {
  inlineStart: 90,
  inlineEnd: 125,
  blockStart: 50,
  blockEnd: 70,
};
const destination: LogicalRect = {
  inlineStart: 30,
  inlineEnd: 30,
  blockStart: 50,
  blockEnd: 70,
};

function geometry(targets: LogicalRect[][], fontSize?: number): CorrectionGeometry {
  return {
    writingMode: "horizontal-tb",
    viewportWidth: 320,
    viewportHeight: 180,
    viewport: { inlineSize: 320, blockSize: 180 },
    targets,
    scale: "inline",
    ...(fontSize
      ? {
          typography: {
            fontSize,
            lineHeight: fontSize * 1.5,
            fontFamily: "Test Serif",
          },
        }
      : {}),
  };
}

const packs: NotationPack[] = [
  japaneseJisNotationPack,
  chineseGbNotationPack,
  koreanKsNotationPack,
  englishUsNotationPack,
];

describe("Task 009B expanded operations", () => {
  it.each(packs)("$displayName renders move from source to destination", (pack) => {
    const correction: Correction = {
      id: "move",
      type: "move",
      source: { kind: "text-range", start: 4, end: 10 },
      destination: { kind: "text-point", offset: 0 },
    };
    const result = pack.buildScene(correction, geometry([[source], [destination]]), {
      debug: false,
    });
    expect(result.fidelity).toBe("reference-based");
    expect(result.nodes.map(({ role }) => role)).toEqual(
      expect.arrayContaining([
        pack.id.startsWith("ja-") ? "target-stroke" : "target-boundary",
        "leader",
        "notation-mark",
      ]),
    );
  });

  it.each(packs)("$displayName distinguishes spacing increase from decrease", (pack) => {
    const increase: Correction = {
      id: "increase",
      type: "increase-spacing",
      target: { kind: "text-point", offset: 4 },
    };
    const decrease: Correction = {
      id: "decrease",
      type: "decrease-spacing",
      target: { kind: "text-range", start: 4, end: 5 },
    };
    const increaseScene = pack.buildScene(increase, geometry([[destination]]), {
      debug: false,
    });
    const decreaseScene = pack.buildScene(decrease, geometry([[source]]), {
      debug: false,
    });
    expect(increaseScene.nodes).not.toEqual(decreaseScene.nodes);
    expect(increaseScene.nodes.some(({ role }) => role === "notation-mark")).toBe(true);
    expect(decreaseScene.nodes.some(({ role }) => role === "notation-mark")).toBe(true);
  });

  it("scales restrained presentation metrics from measured source typography", () => {
    const correction: Correction = {
      id: "increase",
      type: "increase-spacing",
      target: { kind: "text-point", offset: 4 },
    };
    const small = japaneseJisNotationPack.buildScene(
      correction,
      geometry([[destination]], 12),
      { debug: false },
    );
    const large = japaneseJisNotationPack.buildScene(
      correction,
      geometry([[destination]], 32),
      { debug: false },
    );
    expect(small.presentation?.strokeWidth).toBeCloseTo(1.15);
    expect(large.presentation?.strokeWidth).toBeCloseTo(2.35);
    expect(large.presentation!.labelFontSize).toBeGreaterThan(
      small.presentation!.labelFontSize,
    );
    expect(large.presentation!.sourceFontFamily).toBe("Test Serif");
  });

  it("keeps notation-specific movement topology instead of swapping labels", () => {
    const correction: Correction = {
      id: "move",
      type: "move",
      source: { kind: "text-range", start: 4, end: 10 },
      destination: { kind: "text-point", offset: 0 },
    };
    const resolved = geometry([[source], [destination]], 16);
    const jis = japaneseJisNotationPack.buildScene(correction, resolved, { debug: false });
    const gb = chineseGbNotationPack.buildScene(correction, resolved, { debug: false });
    expect(jis.nodes.some(({ role }) => role === "target-stroke")).toBe(true);
    expect(gb.nodes.some(({ role }) => role === "target-boundary")).toBe(true);
    const jisLeader = jis.nodes.find(({ role }) => role === "leader");
    const gbLeader = gb.nodes.find(({ role }) => role === "leader");
    expect(jisLeader).not.toEqual(gbLeader);
  });
});
