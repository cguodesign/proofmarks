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
  type SceneNode,
  type ScenePath,
  type SceneRole,
  type SceneText,
  type WritingMode,
} from "@proofmarks/dom";
import { buildExpandedScene } from "./expanded";
import { canonicalUnits, payloadInlineExtent } from "./metrics";

const GB_ID = "zh-gb-t14706-reference";
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
const KNOWN_OPERATIONS = new Set<CorrectionType>(REFERENCE_OPERATIONS);
const KAPPA = 0.5522847498;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function firstRect(geometry: CorrectionGeometry): LogicalRect | null {
  return geometry.targets[0]?.[0] ?? null;
}

function ellipse(
  role: SceneRole,
  center: LogicalPoint,
  inlineRadius: number,
  blockRadius: number,
): ScenePath {
  const inlineControl = inlineRadius * KAPPA;
  const blockControl = blockRadius * KAPPA;
  return {
    type: "path",
    role,
    commands: [
      {
        type: "move",
        to: { inline: center.inline + inlineRadius, block: center.block },
      },
      {
        type: "cubic",
        control1: {
          inline: center.inline + inlineRadius,
          block: center.block + blockControl,
        },
        control2: {
          inline: center.inline + inlineControl,
          block: center.block + blockRadius,
        },
        to: { inline: center.inline, block: center.block + blockRadius },
      },
      {
        type: "cubic",
        control1: {
          inline: center.inline - inlineControl,
          block: center.block + blockRadius,
        },
        control2: {
          inline: center.inline - inlineRadius,
          block: center.block + blockControl,
        },
        to: { inline: center.inline - inlineRadius, block: center.block },
      },
      {
        type: "cubic",
        control1: {
          inline: center.inline - inlineRadius,
          block: center.block - blockControl,
        },
        control2: {
          inline: center.inline - inlineControl,
          block: center.block - blockRadius,
        },
        to: { inline: center.inline, block: center.block - blockRadius },
      },
      {
        type: "cubic",
        control1: {
          inline: center.inline + inlineControl,
          block: center.block - blockRadius,
        },
        control2: {
          inline: center.inline + inlineRadius,
          block: center.block - blockControl,
        },
        to: { inline: center.inline + inlineRadius, block: center.block },
      },
    ],
  };
}

type Boundary = {
  center: LogicalPoint;
  inlineRadius: number;
  blockRadius: number;
};

function targetBoundary(rect: LogicalRect, geometry: CorrectionGeometry): Boundary {
  const units = canonicalUnits(geometry);
  return {
    center: {
      inline: (rect.inlineStart + rect.inlineEnd) / 2,
      block: (rect.blockStart + rect.blockEnd) / 2,
    },
    inlineRadius: Math.max(units.mark, (rect.inlineEnd - rect.inlineStart) / 2 + units.hair),
    blockRadius: Math.max(units.mark, (rect.blockEnd - rect.blockStart) / 2 + units.hair * 0.7),
  };
}

function contentBoundary(
  text: string,
  rect: LogicalRect,
  geometry: CorrectionGeometry,
): Boundary {
  const units = canonicalUnits(geometry);
  const inlineRadius = payloadInlineExtent(geometry, text, 0.9) / 2 + units.hair;
  const blockRadius = units.em * 0.72;
  const preferredInline = rect.inlineEnd + inlineRadius + units.lane * 1.35;
  const inline = clamp(
    preferredInline,
    inlineRadius + units.gap,
    geometry.viewport.inlineSize - inlineRadius - units.gap,
  );
  const canUseForwardLane = rect.blockEnd + blockRadius + units.line < geometry.viewport.blockSize;
  const block = clamp(
    canUseForwardLane
      ? rect.blockEnd + blockRadius + units.gap
      : rect.blockStart - blockRadius - units.gap,
    blockRadius + units.gap,
    geometry.viewport.blockSize - blockRadius - units.gap,
  );
  return { center: { inline, block }, inlineRadius, blockRadius };
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
    notationId: GB_ID,
    fidelity: "reference-based",
    scale: geometry.scale,
    rectCount: geometry.targets.flat().length,
    nodes,
    presentation: canonicalPresentation(geometry),
    ...debug,
  };
}

function contentText(
  role: "inserted-text" | "replacement-text",
  text: string,
  at: LogicalPoint,
): SceneText {
  return { type: "text", role, at, text, orientation: "horizontal" };
}

function buildDelete(
  correction: Extract<Correction, { type: "delete" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, GB_ID, "reference-based");
  const units = canonicalUnits(geometry);
  const target = targetBoundary(rect, geometry);
  const tailStart = {
    inline: target.center.inline + target.inlineRadius,
    block: target.center.block,
  };
  const tail: ScenePath = {
    type: "path",
    role: "deletion-tail",
    commands: [
      { type: "move", to: tailStart },
      {
        type: "cubic",
        control1: { inline: tailStart.inline + units.em * 1.1, block: tailStart.block - units.em * 1.15 },
        control2: { inline: tailStart.inline + units.em * 2.1, block: tailStart.block - units.em * 0.62 },
        to: { inline: tailStart.inline + units.em * 1.7, block: tailStart.block + units.hair * 0.2 },
      },
      {
        type: "cubic",
        control1: { inline: tailStart.inline + units.em * 1.3, block: tailStart.block + units.em * 0.62 },
        control2: { inline: tailStart.inline + units.em * 0.75, block: tailStart.block + units.hair },
        to: { inline: tailStart.inline + units.em * 1.25, block: tailStart.block - units.hair * 0.5 },
      },
      {
        type: "cubic",
        control1: { inline: tailStart.inline + units.em * 1.7, block: tailStart.block - units.mark * 0.7 },
        control2: { inline: tailStart.inline + units.em * 2.45, block: tailStart.block + units.hair * 0.5 },
        to: { inline: tailStart.inline + units.em * 2.15, block: tailStart.block + units.mark * 0.8 },
      },
    ],
  };
  return scene(
    correction,
    geometry,
    context,
    [
      ellipse("target-boundary", target.center, target.inlineRadius, target.blockRadius),
      tail,
    ],
    target.center,
    [
      { role: "range-start", at: { inline: rect.inlineStart, block: target.center.block } },
      { role: "range-end", at: { inline: rect.inlineEnd, block: target.center.block } },
    ],
  );
}

function leaderBetween(target: Boundary, content: Boundary): ScenePath {
  const from = {
    inline: target.center.inline + target.inlineRadius,
    block: target.center.block,
  };
  const to = {
    inline: content.center.inline - content.inlineRadius,
    block: content.center.block,
  };
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

function buildReplace(
  correction: Extract<Correction, { type: "replace" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, GB_ID, "reference-based");
  const target = targetBoundary(rect, geometry);
  const content = contentBoundary(correction.replacement, rect, geometry);
  return scene(
    correction,
    geometry,
    context,
    [
      ellipse("target-boundary", target.center, target.inlineRadius, target.blockRadius),
      leaderBetween(target, content),
      ellipse("content-boundary", content.center, content.inlineRadius, content.blockRadius),
      contentText("replacement-text", correction.replacement, content.center),
    ],
    target.center,
    [{ role: "label-anchor", at: content.center }],
  );
}

function buildInsert(
  correction: Extract<Correction, { type: "insert" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, GB_ID, "reference-based");
  const units = canonicalUnits(geometry);
  const content = contentBoundary(correction.content, rect, geometry);
  const insertion = {
    inline: rect.inlineStart,
    block: (rect.blockStart + rect.blockEnd) / 2,
  };
  const anchor: ScenePath = {
    type: "path",
    role: "insertion-anchor",
    commands: [
      {
        type: "move",
        to: { inline: insertion.inline - units.mark * 0.55, block: insertion.block - units.mark * 0.85 },
      },
      {
        type: "cubic",
        control1: { inline: insertion.inline + units.hair, block: insertion.block - units.mark * 0.75 },
        control2: { inline: insertion.inline + units.hair, block: insertion.block + units.mark * 0.75 },
        to: { inline: insertion.inline - units.mark * 0.55, block: insertion.block + units.mark * 0.85 },
      },
    ],
  };
  const target: Boundary = {
    center: insertion,
    inlineRadius: units.mark * 0.55,
    blockRadius: units.mark * 0.85,
  };
  return scene(
    correction,
    geometry,
    context,
    [
      anchor,
      leaderBetween(target, content),
      ellipse("content-boundary", content.center, content.inlineRadius, content.blockRadius),
      contentText("inserted-text", correction.content, content.center),
    ],
    insertion,
    [
      { role: "insertion-anchor", at: insertion },
      { role: "label-anchor", at: content.center },
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
    return createGenericScene(correction, geometry, context, GB_ID, "generic-fallback");
  }
  const [first, second] = targets;
  const blockStart = Math.min(first.blockStart, second.blockStart) - 5;
  const blockEnd = Math.max(first.blockEnd, second.blockEnd) + 5;
  const firstCenter = {
    inline: (first.inlineStart + first.inlineEnd) / 2,
    block: (first.blockStart + first.blockEnd) / 2,
  };
  const secondCenter = {
    inline: (second.inlineStart + second.inlineEnd) / 2,
    block: (second.blockStart + second.blockEnd) / 2,
  };
  const upper: ScenePath = {
    type: "path",
    role: "exchange-path",
    commands: [
      { type: "move", to: { inline: first.inlineStart - 2, block: firstCenter.block } },
      {
        type: "cubic",
        control1: { inline: firstCenter.inline, block: blockStart },
        control2: { inline: second.inlineStart, block: blockStart },
        to: { inline: second.inlineStart, block: secondCenter.block },
      },
    ],
  };
  const lower: ScenePath = {
    type: "path",
    role: "exchange-path",
    commands: [
      { type: "move", to: { inline: second.inlineEnd + 2, block: secondCenter.block } },
      {
        type: "cubic",
        control1: { inline: secondCenter.inline, block: blockEnd },
        control2: { inline: first.inlineEnd, block: blockEnd },
        to: { inline: first.inlineEnd, block: firstCenter.block },
      },
    ],
  };
  const anchor = {
    inline: (first.inlineEnd + second.inlineStart) / 2,
    block: (blockStart + blockEnd) / 2,
  };
  return scene(correction, geometry, context, [upper, lower], anchor, [
    { role: "operand-a", at: firstCenter },
    { role: "operand-b", at: secondCenter },
  ]);
}

function deletionTailFocus(scene: ProofmarkScene): LogicalPoint | null {
  const tail = scene.nodes.find(
    (node): node is ScenePath => node.type === "path" && node.role === "deletion-tail",
  );
  return tail?.commands.at(-1)?.to ?? null;
}

function buildCancelCorrection(
  correction: Extract<Correction, { type: "cancel-correction" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const referenced = context.referencedCorrection;
  const rect = firstRect(geometry);
  const tailFocus = referenced ? deletionTailFocus(referenced.scene) : null;
  if (
    !referenced ||
    referenced.correction.type !== "delete" ||
    referenced.scene.notationId !== GB_ID ||
    referenced.scene.fidelity !== "reference-based" ||
    !rect ||
    !tailFocus
  ) {
    return createGenericScene(
      correction,
      geometry,
      context,
      GB_ID,
      "generic-fallback",
    );
  }

  const centerInline = (rect.inlineStart + rect.inlineEnd) / 2;
  const triangleTop = Math.min(
    rect.blockEnd + 5,
    geometry.viewport.blockSize - 15,
  );
  const triangle: ScenePath = {
    type: "path",
    role: "retention-mark",
    commands: [
      { type: "move", to: { inline: centerInline - 7, block: triangleTop + 10 } },
      { type: "line", to: { inline: centerInline, block: triangleTop } },
      { type: "line", to: { inline: centerInline + 7, block: triangleTop + 10 } },
      { type: "line", to: { inline: centerInline - 7, block: triangleTop + 10 } },
    ],
  };
  const strokes = [-4, 4].map<SceneNode>((offset) => ({
    type: "line",
    role: "cancel-stroke",
    from: {
      inline: tailFocus.inline + offset,
      block: tailFocus.block - 7,
    },
    to: {
      inline: tailFocus.inline + offset,
      block: tailFocus.block + 7,
    },
  }));
  const result = scene(
    correction,
    geometry,
    context,
    [triangle, ...strokes],
    { inline: centerInline, block: triangleTop + 5 },
    [{ role: "referenced-mark-anchor", at: tailFocus }],
  );
  return result;
}

export function getGbCapability(
  operation: CorrectionType,
  scale: CorrectionScale,
  writingMode: WritingMode,
): "reference-based" | "generic-fallback" | "unsupported" {
  if (!KNOWN_OPERATIONS.has(operation)) return "unsupported";
  if (!REFERENCE_OPERATIONS.has(operation)) return "generic-fallback";
  return scale === "inline" && writingMode === "horizontal-tb"
    ? "reference-based"
    : "generic-fallback";
}

export const chineseGbNotationPack: NotationPack = {
  id: GB_ID,
  displayName: "Chinese · GB",
  locale: "zh-CN",
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
    { operation: "cancel-correction", scales: ["inline"], writingModes: ["horizontal-tb"] },
  ],
  supports(correction) {
    return KNOWN_OPERATIONS.has(correction.type);
  },
  buildScene(correction, geometry, context) {
    if (
      getGbCapability(correction.type, geometry.scale, geometry.writingMode) !==
      "reference-based"
    ) {
      return createGenericScene(
        correction,
        geometry,
        context,
        GB_ID,
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
        return buildExpandedScene(correction, geometry, context, GB_ID, "gb");
      case "cancel-correction":
        return buildCancelCorrection(correction, geometry, context);
    }
  },
};
