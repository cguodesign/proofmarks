import type { Correction, CorrectionType } from "@proofmarks/core";
import {
  canonicalPresentation,
  combineLogicalRects,
  createEmptyScene,
  createGenericScene,
  createRelationSceneDebug,
  createSceneDebug,
  type CorrectionGeometry,
  type CorrectionScale,
  type LogicalPoint,
  type LogicalRect,
  type NotationPack,
  type ProofmarkScene,
  type RenderContext,
  type SceneDebugPoint,
  type SceneLine,
  type SceneNode,
  type ScenePath,
  type SceneText,
  type WritingMode,
} from "@proofmarks/dom";
import { buildExpandedScene } from "./expanded";

const EN_US_ID = "en-us-traditional-reference";
const REFERENCE_OPERATIONS = new Set<CorrectionType>([
  "delete",
  "insert",
  "replace",
  "transpose",
  "move",
  "increase-spacing",
  "decrease-spacing",
  "cancel-correction",
]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function firstRect(geometry: CorrectionGeometry): LogicalRect | null {
  return combineLogicalRects(geometry.targets[0] ?? []);
}

function scene(
  correction: Correction,
  geometry: CorrectionGeometry,
  context: RenderContext,
  nodes: SceneNode[],
  anchor: LogicalPoint,
  componentPoints: readonly SceneDebugPoint[] = [],
): ProofmarkScene {
  const debug = correction.type === "cancel-correction" && context.referencedCorrection
    ? createRelationSceneDebug(
        geometry,
        context.referencedCorrection.scene,
        anchor,
        context.debug,
      )
    : createSceneDebug(geometry, anchor, context.debug);
  if (context.debug) debug.debugPoints.push(...componentPoints);
  return {
    correctionId: correction.id,
    operation: correction.type,
    notationId: EN_US_ID,
    fidelity: "reference-based",
    scale: geometry.scale,
    rectCount: geometry.targets.flat().length,
    nodes,
    presentation: canonicalPresentation(
      geometry,
      '"Noto Sans", "Avenir Next", "Segoe UI", sans-serif',
    ),
    ...debug,
  };
}

type DeleteConstruction = {
  nodes: SceneNode[];
  anchor: LogicalPoint;
};

function deleteConstruction(rect: LogicalRect): DeleteConstruction {
  const block = (rect.blockStart + rect.blockEnd) / 2;
  const anchor = { inline: rect.inlineEnd, block };
  const stroke: SceneLine = {
    type: "line",
    role: "target-stroke",
    from: { inline: rect.inlineStart - 1, block },
    to: { inline: rect.inlineEnd + 2, block },
  };
  const tail: ScenePath = {
    type: "path",
    role: "deletion-tail",
    commands: [
      { type: "move", to: anchor },
      {
        type: "cubic",
        control1: { inline: anchor.inline + 12, block: anchor.block - 11 },
        control2: { inline: anchor.inline + 18, block: anchor.block + 2 },
        to: { inline: anchor.inline + 9, block: anchor.block + 8 },
      },
      {
        type: "cubic",
        control1: { inline: anchor.inline + 2, block: anchor.block + 12 },
        control2: { inline: anchor.inline - 2, block: anchor.block + 4 },
        to: { inline: anchor.inline + 5, block: anchor.block + 2 },
      },
      {
        type: "cubic",
        control1: { inline: anchor.inline + 11, block: anchor.block },
        control2: { inline: anchor.inline + 14, block: anchor.block - 4 },
        to: { inline: anchor.inline + 18, block: anchor.block - 8 },
      },
    ],
  };
  return { nodes: [stroke, tail], anchor };
}

function buildDelete(
  correction: Extract<Correction, { type: "delete" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, EN_US_ID, "reference-based");
  const construction = deleteConstruction(rect);
  return scene(correction, geometry, context, construction.nodes, construction.anchor, [
    {
      role: "range-start",
      at: {
        inline: rect.inlineStart,
        block: (rect.blockStart + rect.blockEnd) / 2,
      },
    },
    {
      role: "range-end",
      at: {
        inline: rect.inlineEnd,
        block: (rect.blockStart + rect.blockEnd) / 2,
      },
    },
  ]);
}

type InsertConstruction = {
  nodes: SceneNode[];
  anchor: LogicalPoint;
  labelAt: LogicalPoint;
};

function insertConstruction(
  rect: LogicalRect,
  content: string,
  geometry: CorrectionGeometry,
  role: "inserted-text" | "replacement-text",
  inlineOverride?: number,
): InsertConstruction {
  const insertion = inlineOverride ?? rect.inlineStart;
  const baseBlock = rect.blockEnd;
  const tip = { inline: insertion, block: baseBlock + 1 };
  const shoulderBlock = baseBlock + 9;
  const contentExtent = Math.max(10, Array.from(content).length * 8);
  const labelAt = {
    inline: clamp(
      insertion + contentExtent / 2,
      contentExtent / 2 + 8,
      geometry.viewport.inlineSize - contentExtent / 2 - 8,
    ),
    block: clamp(rect.blockStart - 13, 12, geometry.viewport.blockSize - 12),
  };
  const labelStart = {
    inline: labelAt.inline - contentExtent / 2,
    block: labelAt.block + 3,
  };
  const nodes: SceneNode[] = [
    {
      type: "line",
      role: "insertion-anchor",
      from: { inline: insertion - 6, block: shoulderBlock },
      to: tip,
    },
    {
      type: "line",
      role: "insertion-anchor",
      from: tip,
      to: { inline: insertion + 6, block: shoulderBlock },
    },
    {
      type: "path",
      role: "leader",
      commands: [
        { type: "move", to: tip },
        {
          type: "cubic",
          control1: { inline: insertion + 2, block: tip.block - 5 },
          control2: { inline: labelStart.inline - 4, block: labelStart.block },
          to: labelStart,
        },
      ],
    },
    {
      type: "text",
      role,
      at: labelAt,
      text: content,
      orientation: "horizontal",
    },
  ];
  return { nodes, anchor: tip, labelAt };
}

function buildInsert(
  correction: Extract<Correction, { type: "insert" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, EN_US_ID, "reference-based");
  const construction = insertConstruction(
    rect,
    correction.content,
    geometry,
    "inserted-text",
  );
  return scene(
    correction,
    geometry,
    context,
    construction.nodes,
    construction.anchor,
    [
      { role: "insertion-anchor", at: construction.anchor },
      { role: "label-anchor", at: construction.labelAt },
    ],
  );
}

function buildReplace(
  correction: Extract<Correction, { type: "replace" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, EN_US_ID, "reference-based");
  const removal = deleteConstruction(rect);
  const insertion = insertConstruction(
    rect,
    correction.replacement,
    geometry,
    "replacement-text",
    (rect.inlineStart + rect.inlineEnd) / 2,
  );
  return scene(
    correction,
    geometry,
    context,
    [...removal.nodes, ...insertion.nodes],
    insertion.anchor,
    [
      { role: "insertion-anchor", at: insertion.anchor },
      { role: "label-anchor", at: insertion.labelAt },
    ],
  );
}

function adjacentTargets(
  geometry: CorrectionGeometry,
): [LogicalRect, LogicalRect] | null {
  const first = combineLogicalRects(geometry.targets[0] ?? []);
  const second = combineLogicalRects(geometry.targets[1] ?? []);
  if (!first || !second) return null;
  const firstCenter = (first.blockStart + first.blockEnd) / 2;
  const secondCenter = (second.blockStart + second.blockEnd) / 2;
  const tolerance = Math.max(
    first.blockEnd - first.blockStart,
    second.blockEnd - second.blockStart,
  ) * 0.35;
  const gap = second.inlineStart - first.inlineEnd;
  return Math.abs(firstCenter - secondCenter) <= tolerance && gap >= -1 && gap <= 16
    ? [first, second]
    : null;
}

function operandBracket(
  rect: LogicalRect,
  side: "before" | "after",
): ScenePath {
  const centerBlock = (rect.blockStart + rect.blockEnd) / 2;
  const lane = side === "after" ? rect.blockEnd + 6 : rect.blockStart - 6;
  return {
    type: "path",
    role: "exchange-path",
    commands: [
      { type: "move", to: { inline: rect.inlineStart - 2, block: centerBlock } },
      { type: "line", to: { inline: rect.inlineStart - 2, block: lane } },
      { type: "line", to: { inline: rect.inlineEnd + 2, block: lane } },
      { type: "line", to: { inline: rect.inlineEnd + 2, block: centerBlock } },
    ],
  };
}

function buildTranspose(
  correction: Extract<Correction, { type: "transpose" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const targets = adjacentTargets(geometry);
  if (!targets) {
    return createGenericScene(
      correction,
      geometry,
      context,
      EN_US_ID,
      "generic-fallback",
    );
  }
  const [first, second] = targets;
  const firstCenter = {
    inline: (first.inlineStart + first.inlineEnd) / 2,
    block: (first.blockStart + first.blockEnd) / 2,
  };
  const secondCenter = {
    inline: (second.inlineStart + second.inlineEnd) / 2,
    block: (second.blockStart + second.blockEnd) / 2,
  };
  const labelAt = {
    inline: clamp(second.inlineEnd + 15, 14, geometry.viewport.inlineSize - 14),
    block: secondCenter.block,
  };
  const label: SceneText = {
    type: "text",
    role: "notation-label",
    at: labelAt,
    text: "tr",
    orientation: "horizontal",
  };
  return scene(
    correction,
    geometry,
    context,
    [operandBracket(first, "after"), operandBracket(second, "before"), label],
    {
      inline: (first.inlineEnd + second.inlineStart) / 2,
      block: (firstCenter.block + secondCenter.block) / 2,
    },
    [
      { role: "operand-a", at: firstCenter },
      { role: "operand-b", at: secondCenter },
      { role: "label-anchor", at: labelAt },
    ],
  );
}

function stetDots(rect: LogicalRect): SceneLine[] {
  const width = Math.max(4, rect.inlineEnd - rect.inlineStart);
  const count = Math.max(3, Math.min(16, Math.round(width / 7)));
  const gap = width / count;
  const block = rect.blockEnd + 5;
  return Array.from({ length: count }, (_, index) => {
    const inline = rect.inlineStart + gap * (index + 0.5);
    return {
      type: "line",
      role: "retention-mark",
      from: { inline: inline - 0.8, block },
      to: { inline: inline + 0.8, block },
    };
  });
}

function buildCancelCorrection(
  correction: Extract<Correction, { type: "cancel-correction" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const referenced = context.referencedCorrection;
  const rect = firstRect(geometry);
  if (!referenced || !rect) {
    return createGenericScene(
      correction,
      geometry,
      context,
      EN_US_ID,
      "generic-fallback",
    );
  }
  const labelAt = {
    inline: clamp(rect.inlineEnd + 23, 18, geometry.viewport.inlineSize - 18),
    block: clamp(rect.blockEnd + 15, 12, geometry.viewport.blockSize - 12),
  };
  const label: SceneText = {
    type: "text",
    role: "notation-label",
    at: labelAt,
    text: "stet",
    orientation: "horizontal",
  };
  const anchor = {
    inline: (rect.inlineStart + rect.inlineEnd) / 2,
    block: rect.blockEnd + 5,
  };
  return scene(
    correction,
    geometry,
    context,
    [...stetDots(rect), label],
    anchor,
    [
      { role: "referenced-mark-anchor", at: anchor },
      { role: "label-anchor", at: labelAt },
    ],
  );
}

export function getEnUsCapability(
  operation: CorrectionType,
  scale: CorrectionScale,
  writingMode: WritingMode,
): "reference-based" | "generic-fallback" | "unsupported" {
  if (!REFERENCE_OPERATIONS.has(operation)) return "unsupported";
  if (writingMode !== "horizontal-tb") return "unsupported";
  return scale === "inline" ? "reference-based" : "generic-fallback";
}

export const englishUsNotationPack: NotationPack = {
  id: EN_US_ID,
  displayName: "English · US",
  locale: "en-US",
  writingModes: ["horizontal-tb"],
  supportedCorrections: [
    "delete",
    "insert",
    "replace",
    "transpose",
    "move",
    "increase-spacing",
    "decrease-spacing",
    "cancel-correction",
  ],
  support: [
    { operation: "delete", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "insert", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "replace", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "transpose", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "move", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "increase-spacing", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "decrease-spacing", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "cancel-correction", scales: ["inline"], writingModes: ["horizontal-tb"] },
  ],
  supports(correction) {
    return REFERENCE_OPERATIONS.has(correction.type);
  },
  buildScene(correction, geometry, context) {
    const capability = getEnUsCapability(
      correction.type,
      geometry.scale,
      geometry.writingMode,
    );
    if (capability !== "reference-based") {
      return capability === "unsupported"
        ? createEmptyScene(correction, geometry, EN_US_ID, "unsupported")
        : createGenericScene(
            correction,
            geometry,
            context,
            EN_US_ID,
            "generic-fallback",
          );
    }
    switch (correction.type) {
      case "delete":
        return buildDelete(correction, geometry, context);
      case "insert":
        return buildInsert(correction, geometry, context);
      case "replace":
        return buildReplace(correction, geometry, context);
      case "transpose":
        return buildTranspose(correction, geometry, context);
      case "move":
      case "increase-spacing":
      case "decrease-spacing":
        return buildExpandedScene(correction, geometry, context, EN_US_ID, "en-us");
      case "cancel-correction":
        return buildCancelCorrection(correction, geometry, context);
    }
  },
};
