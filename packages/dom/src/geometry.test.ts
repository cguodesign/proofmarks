import { describe, expect, it } from "vitest";
import {
  classifyCorrectionScale,
  combineLogicalRects,
  logicalRectToPhysical,
  physicalRectToLogical,
  physicalRectsToLogical,
  type PhysicalRect,
} from "./geometry";

const physical: PhysicalRect = { x: 120, y: 32, width: 48, height: 24 };

describe("logical geometry", () => {
  it("maps horizontal geometry onto inline and block axes", () => {
    expect(physicalRectToLogical(physical, "horizontal-tb", 400)).toEqual({
      inlineStart: 120,
      inlineEnd: 168,
      blockStart: 32,
      blockEnd: 56,
    });
  });

  it("maps vertical-rl block progression from right to left", () => {
    const logical = physicalRectToLogical(physical, "vertical-rl", 400);

    expect(logical).toEqual({
      inlineStart: 32,
      inlineEnd: 56,
      blockStart: 232,
      blockEnd: 280,
    });
    expect(logicalRectToPhysical(logical, "vertical-rl", 400)).toEqual(
      physical,
    );
  });

  it("converts and combines every rectangle in a wrapped horizontal range", () => {
    const rects: PhysicalRect[] = [
      { x: 40, y: 24, width: 120, height: 28 },
      { x: 40, y: 64, width: 84, height: 28 },
      { x: 40, y: 104, width: 48, height: 28 },
    ];
    const logical = physicalRectsToLogical(rects, "horizontal-tb", 320);

    expect(logical).toHaveLength(3);
    expect(combineLogicalRects(logical)).toEqual({
      inlineStart: 40,
      inlineEnd: 160,
      blockStart: 24,
      blockEnd: 132,
    });
  });

  it("converts every rectangle in a wrapped vertical-rl range", () => {
    const rects: PhysicalRect[] = [
      { x: 244, y: 40, width: 28, height: 120 },
      { x: 204, y: 40, width: 28, height: 84 },
    ];

    expect(physicalRectsToLogical(rects, "vertical-rl", 320)).toEqual([
      {
        inlineStart: 40,
        inlineEnd: 160,
        blockStart: 48,
        blockEnd: 76,
      },
      {
        inlineStart: 40,
        inlineEnd: 124,
        blockStart: 88,
        blockEnd: 116,
      },
    ]);
  });

  it("derives representation scale from resolved rect geometry", () => {
    const viewport = { inlineSize: 320, blockSize: 200 };
    const inline = [{ inlineStart: 20, inlineEnd: 40, blockStart: 20, blockEnd: 44 }];
    const wrapped = [
      inline[0]!,
      { inlineStart: 20, inlineEnd: 80, blockStart: 52, blockEnd: 76 },
    ];

    expect(classifyCorrectionScale([inline], viewport)).toBe("inline");
    expect(classifyCorrectionScale([wrapped], viewport)).toBe("phrase");
  });
});
