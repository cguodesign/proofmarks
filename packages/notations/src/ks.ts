import type { Correction, CorrectionType } from "@proofmarks/core";
import {
  canonicalPresentation,
  combineLogicalRects,
  createEmptyScene,
  createGenericScene,
  createSceneDebug,
  type CorrectionGeometry,
  type CorrectionScale,
  type LogicalPoint,
  type LogicalRect,
  type NotationPack,
  type ProofmarkScene,
  type RenderContext,
  type SceneDebugPoint,
  type SceneNode,
  type ScenePath,
  type SceneText,
  type WritingMode,
} from "@proofmarks/dom";
import { buildExpandedScene } from "./expanded";

const KS_ID = "ko-ks-a0104-reference";
const KNOWN_OPERATIONS = new Set<CorrectionType>([
  "delete",
  "insert",
  "replace",
  "transpose",
  "move",
  "increase-spacing",
  "decrease-spacing",
  "cancel-correction",
]);
const HORIZONTAL_REFERENCE_OPERATIONS = new Set<CorrectionType>([
  "delete",
  "insert",
  "replace",
  "transpose",
  "move",
  "increase-spacing",
  "decrease-spacing",
]);
const KAPPA = 0.5522847498;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function firstRect(geometry: CorrectionGeometry): LogicalRect | null {
  return geometry.targets[0]?.[0] ?? null;
}

function ellipse(
  center: LogicalPoint,
  inlineRadius: number,
  blockRadius: number,
): ScenePath {
  const inlineControl = inlineRadius * KAPPA;
  const blockControl = blockRadius * KAPPA;
  return {
    type: "path",
    role: "target-boundary",
    commands: [
      { type: "move", to: { inline: center.inline + inlineRadius, block: center.block } },
      {
        type: "cubic",
        control1: { inline: center.inline + inlineRadius, block: center.block + blockControl },
        control2: { inline: center.inline + inlineControl, block: center.block + blockRadius },
        to: { inline: center.inline, block: center.block + blockRadius },
      },
      {
        type: "cubic",
        control1: { inline: center.inline - inlineControl, block: center.block + blockRadius },
        control2: { inline: center.inline - inlineRadius, block: center.block + blockControl },
        to: { inline: center.inline - inlineRadius, block: center.block },
      },
      {
        type: "cubic",
        control1: { inline: center.inline - inlineRadius, block: center.block - blockControl },
        control2: { inline: center.inline - inlineControl, block: center.block - blockRadius },
        to: { inline: center.inline, block: center.block - blockRadius },
      },
      {
        type: "cubic",
        control1: { inline: center.inline + inlineControl, block: center.block - blockRadius },
        control2: { inline: center.inline + inlineRadius, block: center.block - blockControl },
        to: { inline: center.inline + inlineRadius, block: center.block },
      },
    ],
  };
}

function scene(
  correction: Correction,
  geometry: CorrectionGeometry,
  context: RenderContext,
  nodes: SceneNode[],
  anchor: LogicalPoint,
  componentPoints: readonly SceneDebugPoint[] = [],
): ProofmarkScene {
  const debug = createSceneDebug(geometry, anchor, context.debug);
  if (context.debug) debug.debugPoints.push(...componentPoints);
  return {
    correctionId: correction.id,
    operation: correction.type,
    notationId: KS_ID,
    fidelity: "reference-based",
    scale: geometry.scale,
    rectCount: geometry.targets.flat().length,
    nodes,
    presentation: canonicalPresentation(geometry),
    ...debug,
  };
}

function buildDelete(
  correction: Extract<Correction, { type: "delete" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = combineLogicalRects(geometry.targets[0] ?? []);
  if (!rect) return createEmptyScene(correction, geometry, KS_ID, "reference-based");
  const center = {
    inline: (rect.inlineStart + rect.inlineEnd) / 2,
    block: (rect.blockStart + rect.blockEnd) / 2,
  };
  const inset = Math.min(4, (rect.inlineEnd - rect.inlineStart) * 0.12);
  const mark: ScenePath = {
    type: "path",
    role: "target-stroke",
    commands: [
      {
        type: "move",
        to: { inline: rect.inlineStart + inset, block: rect.blockStart + 3 },
      },
      { type: "line", to: { inline: center.inline, block: rect.blockEnd - 2 } },
      {
        type: "line",
        to: { inline: rect.inlineEnd - inset, block: rect.blockStart + 3 },
      },
    ],
  };
  return scene(correction, geometry, context, [mark], center, [
    { role: "range-start", at: { inline: rect.inlineStart, block: center.block } },
    { role: "range-end", at: { inline: rect.inlineEnd, block: center.block } },
  ]);
}

function annotationPoint(
  rect: LogicalRect,
  content: string,
  geometry: CorrectionGeometry,
): LogicalPoint {
  const half = Math.max(10, Array.from(content).length * 7.5);
  return {
    inline: clamp(rect.inlineEnd + half + 38, half + 10, geometry.viewport.inlineSize - half - 10),
    block: clamp(rect.blockEnd + 25, 16, geometry.viewport.blockSize - 16),
  };
}

function leader(from: LogicalPoint, to: LogicalPoint): ScenePath {
  const middle = (from.inline + to.inline) / 2;
  return {
    type: "path",
    role: "leader",
    commands: [
      { type: "move", to: from },
      {
        type: "cubic",
        control1: { inline: middle, block: from.block },
        control2: { inline: middle, block: to.block },
        to,
      },
    ],
  };
}

function buildInsert(
  correction: Extract<Correction, { type: "insert" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, KS_ID, "reference-based");
  const point = {
    inline: rect.inlineStart,
    block: (rect.blockStart + rect.blockEnd) / 2,
  };
  const textAt = annotationPoint(rect, correction.content, geometry);
  const hookEnd = { inline: point.inline + 10, block: point.block + 12 };
  const hook: ScenePath = {
    type: "path",
    role: "insertion-anchor",
    commands: [
      { type: "move", to: { inline: point.inline - 5, block: point.block - 8 } },
      {
        type: "cubic",
        control1: { inline: point.inline + 5, block: point.block - 7 },
        control2: { inline: point.inline - 1, block: point.block + 7 },
        to: hookEnd,
      },
    ],
  };
  const text: SceneText = {
    type: "text",
    role: "inserted-text",
    at: textAt,
    text: correction.content,
    orientation: "horizontal",
  };
  return scene(
    correction,
    geometry,
    context,
    [hook, leader(hookEnd, textAt), text],
    point,
    [
      { role: "insertion-anchor", at: point },
      { role: "label-anchor", at: textAt },
    ],
  );
}

function buildReplace(
  correction: Extract<Correction, { type: "replace" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = combineLogicalRects(geometry.targets[0] ?? []);
  if (!rect) return createEmptyScene(correction, geometry, KS_ID, "reference-based");
  const center = {
    inline: (rect.inlineStart + rect.inlineEnd) / 2,
    block: (rect.blockStart + rect.blockEnd) / 2,
  };
  const textAt = annotationPoint(rect, correction.replacement, geometry);
  const radius = {
    inline: Math.max(9, (rect.inlineEnd - rect.inlineStart) / 2 + 3),
    block: Math.max(9, (rect.blockEnd - rect.blockStart) / 2 + 2),
  };
  const from = { inline: center.inline + radius.inline, block: center.block };
  const text: SceneText = {
    type: "text",
    role: "replacement-text",
    at: textAt,
    text: correction.replacement,
    orientation: "horizontal",
  };
  return scene(
    correction,
    geometry,
    context,
    [ellipse(center, radius.inline, radius.block), leader(from, textAt), text],
    center,
    [{ role: "label-anchor", at: textAt }],
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
  return Math.abs(firstCenter - secondCenter) <= tolerance && gap >= -1 && gap <= 8
    ? [first, second]
    : null;
}

function buildTranspose(
  correction: Extract<Correction, { type: "transpose" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const targets = adjacentTargets(geometry);
  if (!targets) {
    return createGenericScene(correction, geometry, context, KS_ID, "generic-fallback");
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
  const outerBlock = Math.max(first.blockEnd, second.blockEnd) + 6;
  const innerBlock = Math.min(first.blockStart, second.blockStart) - 6;
  const junction = (first.inlineEnd + second.inlineStart) / 2;
  const exchange: ScenePath = {
    type: "path",
    role: "exchange-path",
    commands: [
      {
        type: "move",
        to: { inline: first.inlineStart - 3, block: firstCenter.block },
      },
      {
        type: "line",
        to: { inline: first.inlineStart - 3, block: outerBlock - 4 },
      },
      {
        type: "cubic",
        control1: { inline: first.inlineStart - 3, block: outerBlock },
        control2: { inline: first.inlineStart + 1, block: outerBlock },
        to: { inline: first.inlineStart + 4, block: outerBlock },
      },
      { type: "line", to: { inline: junction - 4, block: outerBlock } },
      {
        type: "cubic",
        control1: { inline: junction, block: outerBlock },
        control2: { inline: junction, block: outerBlock - 4 },
        to: { inline: junction, block: outerBlock - 7 },
      },
      { type: "line", to: { inline: junction, block: innerBlock + 7 } },
      {
        type: "cubic",
        control1: { inline: junction, block: innerBlock + 3 },
        control2: { inline: junction + 3, block: innerBlock },
        to: { inline: junction + 7, block: innerBlock },
      },
      { type: "line", to: { inline: second.inlineEnd - 4, block: innerBlock } },
      {
        type: "cubic",
        control1: { inline: second.inlineEnd, block: innerBlock },
        control2: { inline: second.inlineEnd + 3, block: innerBlock + 3 },
        to: { inline: second.inlineEnd + 3, block: innerBlock + 7 },
      },
      {
        type: "line",
        to: { inline: second.inlineEnd + 3, block: secondCenter.block },
      },
    ],
  };
  const anchor = { inline: junction, block: (innerBlock + outerBlock) / 2 };
  return scene(correction, geometry, context, [exchange], anchor, [
    { role: "operand-a", at: firstCenter },
    { role: "operand-b", at: secondCenter },
  ]);
}

export function getKsCapability(
  operation: CorrectionType,
  scale: CorrectionScale,
  writingMode: WritingMode,
): "reference-based" | "generic-fallback" | "unsupported" {
  if (!KNOWN_OPERATIONS.has(operation)) return "unsupported";
  if (!HORIZONTAL_REFERENCE_OPERATIONS.has(operation)) return "generic-fallback";
  return scale === "inline" && writingMode === "horizontal-tb"
    ? "reference-based"
    : "generic-fallback";
}

export const koreanKsNotationPack: NotationPack = {
  id: KS_ID,
  displayName: "Korean · KS",
  locale: "ko-KR",
  writingModes: ["horizontal-tb", "vertical-rl"],
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
    { operation: "cancel-correction", scales: [], writingModes: [] },
  ],
  supports(correction) {
    return KNOWN_OPERATIONS.has(correction.type);
  },
  buildScene(correction, geometry, context) {
    if (
      getKsCapability(correction.type, geometry.scale, geometry.writingMode) !==
      "reference-based"
    ) {
      return createGenericScene(
        correction,
        geometry,
        context,
        KS_ID,
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
        return buildExpandedScene(correction, geometry, context, KS_ID, "ks");
      case "cancel-correction":
        return createGenericScene(
          correction,
          geometry,
          context,
          KS_ID,
          "generic-fallback",
        );
    }
  },
};
