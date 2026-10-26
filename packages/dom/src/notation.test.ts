import type { Correction } from "@proofmarks/core";
import { describe, expect, it } from "vitest";
import { buildNotationScene, type CorrectionGeometry, type NotationPack } from "./index";

const correction: Correction = {
  id: "delete",
  type: "delete",
  target: { kind: "text-range", start: 0, end: 1 },
};

const geometry: CorrectionGeometry = {
  writingMode: "horizontal-tb",
  viewportWidth: 200,
  viewportHeight: 120,
  viewport: { inlineSize: 200, blockSize: 120 },
  targets: [
    [{ inlineStart: 20, inlineEnd: 40, blockStart: 24, blockEnd: 48 }],
  ],
  scale: "inline",
};

describe("notation dispatch", () => {
  it.each([["ja", "入れ替え"], ["zh-CN", "对调"], ["zh-TW", "對調"], ["ko", "바꾸기"], ["en-US", "Swap"]])("localizes generic transpose labels for %s", (locale, label) => {
    const pack: NotationPack = {
      id: "fallback-test", displayName: "Fallback", locale: locale!,
      writingModes: ["horizontal-tb"], supportedCorrections: [], support: [],
      supports: () => false, buildScene: () => { throw new Error("unused"); },
    };
    const result = buildNotationScene(pack, {
      id: "swap", type: "transpose",
      targets: [{ kind: "text-range", start: 0, end: 1 }, { kind: "text-range", start: 2, end: 3 }],
    }, geometry, { debug: false });
    expect(result.nodes.some((node) => node.type === "text" && node.text === label)).toBe(true);
  });

  it("falls back safely when a selected pack does not support an operation", () => {
    const unsupportedPack: NotationPack = {
      id: "empty-pack",
      displayName: "Empty",
      locale: "und",
      writingModes: ["horizontal-tb"],
      supportedCorrections: [],
      support: [],
      supports: () => false,
      buildScene: () => {
        throw new Error("Unsupported pack renderer must not be called.");
      },
    };

    const result = buildNotationScene(unsupportedPack, correction, geometry, {
      debug: false,
    });

    expect(result.notationId).toBe("empty-pack");
    expect(result.fidelity).toBe("generic-fallback");
    expect(result.nodes.length).toBeGreaterThan(0);
  });
});
