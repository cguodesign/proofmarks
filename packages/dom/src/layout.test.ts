import { describe, expect, it } from "vitest";
import type { CorrectionGeometry, LogicalRect } from "./geometry";
import {
  createProofSheetBounds,
  generatePlacementCandidates,
  layoutProofmarkScenes,
  rectsOverlap,
  segmentIntersectsRect,
  type AnnotationPlacement,
} from "./layout";
import type { ProofmarkScene } from "./scene";

const target: LogicalRect = {
  inlineStart: 116,
  inlineEnd: 156,
  blockStart: 82,
  blockEnd: 104,
};

const geometry: CorrectionGeometry = {
  writingMode: "horizontal-tb",
  viewportWidth: 400,
  viewportHeight: 220,
  viewport: { inlineSize: 400, blockSize: 220 },
  targets: [[target]],
  scale: "inline",
};

const sourceRects: LogicalRect[] = [
  { inlineStart: 56, inlineEnd: 344, blockStart: 78, blockEnd: 108 },
];

const bounds = createProofSheetBounds(geometry.viewport, sourceRects);

function replacementScene(
  id: string,
  notationId = "en-us-traditional-reference",
): ProofmarkScene {
  return {
    correctionId: id,
    operation: "replace",
    notationId,
    fidelity: "reference-based",
    scale: "inline",
    rectCount: 1,
    nodes: [
      {
        type: "line",
        role: "target-stroke",
        from: { inline: 116, block: 93 },
        to: { inline: 156, block: 93 },
      },
      {
        type: "line",
        role: "leader",
        from: { inline: 136, block: 82 },
        to: { inline: 136, block: 56 },
      },
      {
        type: "text",
        role: "replacement-text",
        at: { inline: 136, block: 48 },
        text: "writer",
        orientation: "horizontal",
      },
    ],
    debugRects: [],
    debugPoints: [],
  };
}

describe("editorial annotation layout", () => {
  it("detects AABB and simple segment collisions deterministically", () => {
    expect(
      rectsOverlap(
        { inlineStart: 0, inlineEnd: 20, blockStart: 0, blockEnd: 20 },
        { inlineStart: 18, inlineEnd: 30, blockStart: 10, blockEnd: 30 },
      ),
    ).toBe(true);
    expect(
      segmentIntersectsRect(
        { inline: 0, block: 10 },
        { inline: 40, block: 10 },
        { inlineStart: 15, inlineEnd: 25, blockStart: 5, blockEnd: 15 },
      ),
    ).toBe(true);
  });

  it("chooses a non-crossing leader when a nearby lane is available", () => {
    const obstacle: AnnotationPlacement = {
      correctionId: "neighbor",
      lane: "inline-end-margin", level: 3, candidateKey: "neighbor",
      payloadBounds: { inlineStart: 350, inlineEnd: 390, blockStart: 45, blockEnd: 65 },
      leader: [{ inline: 100, block: 65 }, { inline: 350, block: 65 }],
      leaderRoute: "direct", score: 0, candidates: [],
    };
    const candidates = generatePlacementCandidates(replacementScene("local"), geometry, bounds, [], [obstacle]);
    expect(candidates.some((candidate) => candidate.collisions.includes("leader-crossing:neighbor"))).toBe(true);
    expect(candidates[0]!.collisions).not.toContain("leader-crossing:neighbor");
    expect(candidates[0]!.collisions).not.toContain("source-text");
  });

  it("generates ranked logical lanes, route alternatives, and escalation levels", () => {
    const candidates = generatePlacementCandidates(
      replacementScene("replace-1"),
      geometry,
      bounds,
      [],
      [],
    );

    expect(candidates.length).toBeGreaterThan(20);
    expect(new Set(candidates.map(({ lane }) => lane))).toEqual(
      new Set([
        "block-start-0",
        "block-start-1",
        "block-end-0",
        "block-end-1",
        "inline-start-margin",
        "inline-end-margin",
      ]),
    );
    expect(new Set(candidates.map(({ leaderRoute }) => leaderRoute))).toEqual(
      new Set(["direct", "elbow"]),
    );
    expect(new Set(candidates.map(({ level }) => level))).toEqual(
      new Set([1, 2, 3]),
    );
    expect(candidates[0]?.lane).toBe("block-start-0");
    expect(candidates[0]?.collisions).not.toContain("source-text");
  });

  it("uses notation-owned lane preference without changing scene semantics", () => {
    const english = generatePlacementCandidates(
      replacementScene("en"),
      geometry,
      bounds,
      [],
      [],
    )[0];
    const chinese = generatePlacementCandidates(
      replacementScene("gb", "zh-gb-t14706-reference"),
      geometry,
      bounds,
      [],
      [],
      undefined,
      "zh-CN",
    )[0];

    expect(english?.lane).toBe("block-start-0");
    expect(
      chinese &&
        Math.min(
          ...generatePlacementCandidates(
            replacementScene("gb", "zh-gb-t14706-reference"),
            geometry,
            bounds,
            [],
            [],
            undefined,
            "zh-CN",
          )
            .filter(({ lane }) => lane === "inline-end-margin")
            .map(({ rank }) => rank),
        ),
    ).toBe(0);
    expect(replacementScene("en").operation).toBe("replace");
  });

  it("routes nearby payloads into separate deterministic placements", () => {
    const scenes = [replacementScene("replace-1"), replacementScene("replace-2")];
    const geometries = new Map([
      ["replace-1", geometry],
      ["replace-2", geometry],
    ]);
    const first = layoutProofmarkScenes(scenes, geometries, bounds);
    const second = layoutProofmarkScenes(scenes, geometries, bounds);
    const placements = [...first.placements.values()];

    expect(placements).toHaveLength(2);
    expect(
      rectsOverlap(placements[0]!.payloadBounds, placements[1]!.payloadBounds, 4),
    ).toBe(false);
    expect(
      [...first.placements.values()].map(({ candidateKey, payloadBounds, leader }) => ({
        candidateKey,
        payloadBounds,
        leader,
      })),
    ).toEqual(
      [...second.placements.values()].map(({ candidateKey, payloadBounds, leader }) => ({
        candidateKey,
        payloadBounds,
        leader,
      })),
    );
  });

  it("uses prior valid placement as deterministic visual hysteresis", () => {
    const scene = replacementScene("replace-1");
    const candidates = generatePlacementCandidates(scene, geometry, bounds, [], []);
    const alternate = candidates.find(
      ({ lane, key }) =>
        lane === "block-start-0" && key.endsWith(":1:direct"),
    );
    expect(alternate).toBeDefined();
    const previous: AnnotationPlacement = {
      correctionId: scene.correctionId,
      lane: alternate!.lane,
      level: alternate!.level,
      candidateKey: alternate!.key,
      payloadBounds: alternate!.payloadBounds,
      leader: alternate!.leader,
      leaderRoute: alternate!.leaderRoute,
      score: alternate!.score,
      candidates,
    };
    const next = generatePlacementCandidates(
      scene,
      geometry,
      bounds,
      [],
      [],
      previous,
    );

    expect(next[0]?.key).toBe(previous.candidateKey);
  });

  it("operates in logical axes for vertical-rl geometry", () => {
    const vertical: CorrectionGeometry = {
      ...geometry,
      writingMode: "vertical-rl",
      viewportWidth: 220,
      viewportHeight: 400,
      viewport: { inlineSize: 400, blockSize: 220 },
    };
    const result = layoutProofmarkScenes(
      [replacementScene("vertical")],
      new Map([["vertical", vertical]]),
      createProofSheetBounds(vertical.viewport, sourceRects),
    );
    const placement = result.placements.get("vertical");

    expect(placement?.lane).toBe("block-start-0");
    expect(placement?.payloadBounds.blockEnd).toBeLessThanOrEqual(target.blockStart);
  });
});
