import type { Correction, CorrectionType } from "@proofmarks/core";
import {
  canonicalPresentation,
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
import { canonicalUnits, payloadInlineExtent } from "./metrics";

const CNS3927_ID = "cns3927";
const KAPPA = 0.5522847498;
const MAPPED_OPERATIONS = new Set<CorrectionType>([
  "delete",
  "insert",
  "replace",
  "cancel-correction",
]);

export type Cns3927Capability =
  | "reference-based"
  | "generic-fallback"
  | "unsupported"
  | "unverified";

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

/** A movable page-margin payload, deliberately separate from the fixed interline target. */
function pageMarginBoundary(
  text: string,
  rect: LogicalRect,
  geometry: CorrectionGeometry,
): Boundary {
  const units = canonicalUnits(geometry);
  const inlineRadius = payloadInlineExtent(geometry, text, 0.95) / 2 + units.hair;
  const blockRadius = units.em * 0.72;
  const inline = clamp(
    rect.inlineEnd + inlineRadius + units.lane * 1.4,
    inlineRadius + units.gap,
    geometry.viewport.inlineSize - inlineRadius - units.gap,
  );
  const forward = rect.blockEnd + blockRadius + units.line < geometry.viewport.blockSize;
  const block = clamp(
    forward
      ? rect.blockEnd + blockRadius + units.gap
      : rect.blockStart - blockRadius - units.gap,
    blockRadius + units.gap,
    geometry.viewport.blockSize - blockRadius - units.gap,
  );
  return { center: { inline, block }, inlineRadius, blockRadius };
}

function leaderBetween(target: Boundary, payload: Boundary): ScenePath {
  const from = {
    inline: target.center.inline + target.inlineRadius,
    block: target.center.block,
  };
  const to = {
    inline: payload.center.inline - payload.inlineRadius,
    block: payload.center.block,
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
    notationId: CNS3927_ID,
    fidelity: "reference-based",
    scale: geometry.scale,
    rectCount: geometry.targets.flat().length,
    nodes,
    presentation: canonicalPresentation(geometry),
    ...debug,
  };
}

function payloadText(
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
  if (!rect) return createEmptyScene(correction, geometry, CNS3927_ID, "reference-based");
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
        control1: { inline: tailStart.inline + units.em, block: tailStart.block - units.em },
        control2: { inline: tailStart.inline + units.em * 2, block: tailStart.block - units.em * 0.55 },
        to: { inline: tailStart.inline + units.em * 1.6, block: tailStart.block },
      },
      {
        type: "cubic",
        control1: { inline: tailStart.inline + units.em * 1.18, block: tailStart.block + units.em * 0.5 },
        control2: { inline: tailStart.inline + units.em * 0.76, block: tailStart.block + units.hair },
        to: { inline: tailStart.inline + units.em * 1.18, block: tailStart.block - units.hair * 0.4 },
      },
    ],
  };
  return scene(
    correction,
    geometry,
    context,
    [ellipse("target-boundary", target.center, target.inlineRadius, target.blockRadius), tail],
    target.center,
    [
      { role: "range-start", at: { inline: rect.inlineStart, block: target.center.block } },
      { role: "range-end", at: { inline: rect.inlineEnd, block: target.center.block } },
    ],
  );
}

function buildInsert(
  correction: Extract<Correction, { type: "insert" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, CNS3927_ID, "reference-based");
  const units = canonicalUnits(geometry);
  const insertion = {
    inline: rect.inlineStart,
    block: (rect.blockStart + rect.blockEnd) / 2,
  };
  const payload = pageMarginBoundary(correction.content, rect, geometry);
  const size = units.mark * 0.9;
  const anchor: ScenePath = geometry.writingMode === "vertical-rl"
    ? {
        type: "path",
        role: "insertion-anchor",
        commands: [
          { type: "move", to: { inline: insertion.inline, block: insertion.block - size } },
          { type: "line", to: { inline: insertion.inline, block: insertion.block + size } },
          { type: "move", to: { inline: insertion.inline - size * 0.55, block: insertion.block + size * 0.4 } },
          { type: "line", to: { inline: insertion.inline, block: insertion.block + size } },
          { type: "line", to: { inline: insertion.inline + size * 0.55, block: insertion.block + size * 0.4 } },
        ],
      }
    : {
        type: "path",
        role: "insertion-anchor",
        commands: [
          { type: "move", to: { inline: insertion.inline - size, block: insertion.block - size } },
          { type: "line", to: insertion },
          { type: "line", to: { inline: insertion.inline + size, block: insertion.block - size } },
          { type: "move", to: insertion },
          { type: "line", to: { inline: insertion.inline, block: insertion.block + size } },
        ],
      };
  const target: Boundary = {
    center: insertion,
    inlineRadius: size,
    blockRadius: size,
  };
  return scene(
    correction,
    geometry,
    context,
    [
      anchor,
      leaderBetween(target, payload),
      ellipse("content-boundary", payload.center, payload.inlineRadius, payload.blockRadius),
      payloadText("inserted-text", correction.content, payload.center),
    ],
    insertion,
    [
      { role: "insertion-anchor", at: insertion },
      { role: "label-anchor", at: payload.center },
    ],
  );
}

function buildReplace(
  correction: Extract<Correction, { type: "replace" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) return createEmptyScene(correction, geometry, CNS3927_ID, "reference-based");
  const target = targetBoundary(rect, geometry);
  const payload = pageMarginBoundary(correction.replacement, rect, geometry);
  return scene(
    correction,
    geometry,
    context,
    [
      ellipse("target-boundary", target.center, target.inlineRadius, target.blockRadius),
      leaderBetween(target, payload),
      ellipse("content-boundary", payload.center, payload.inlineRadius, payload.blockRadius),
      payloadText("replacement-text", correction.replacement, payload.center),
    ],
    target.center,
    [{ role: "label-anchor", at: payload.center }],
  );
}

function deletionTailFocus(value: ProofmarkScene): LogicalPoint | null {
  const tail = value.nodes.find(
    (node): node is ScenePath => node.type === "path" && node.role === "deletion-tail",
  );
  return tail?.commands.at(-1)?.to ?? null;
}

function buildRetain(
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
    referenced.scene.notationId !== CNS3927_ID ||
    referenced.scene.fidelity !== "reference-based" ||
    !rect ||
    !tailFocus
  ) {
    return createGenericScene(correction, geometry, context, CNS3927_ID, "generic-fallback");
  }
  const units = canonicalUnits(geometry);
  const centerInline = (rect.inlineStart + rect.inlineEnd) / 2;
  const triangleTop = Math.min(
    rect.blockEnd + units.gap,
    geometry.viewport.blockSize - units.mark * 1.8,
  );
  const half = units.mark * 0.75;
  const triangle: ScenePath = {
    type: "path",
    role: "retention-mark",
    commands: [
      { type: "move", to: { inline: centerInline - half, block: triangleTop + half } },
      { type: "line", to: { inline: centerInline, block: triangleTop } },
      { type: "line", to: { inline: centerInline + half, block: triangleTop + half } },
      { type: "line", to: { inline: centerInline - half, block: triangleTop + half } },
    ],
  };
  const strokes = [-units.hair, units.hair].map<SceneNode>((offset) => ({
    type: "line",
    role: "cancel-stroke",
    from: { inline: tailFocus.inline + offset, block: tailFocus.block - units.mark * 0.65 },
    to: { inline: tailFocus.inline + offset, block: tailFocus.block + units.mark * 0.65 },
  }));
  return scene(
    correction,
    geometry,
    context,
    [triangle, ...strokes],
    { inline: centerInline, block: triangleTop + half / 2 },
    [{ role: "referenced-mark-anchor", at: tailFocus }],
  );
}

export function getCns3927Capability(
  operation: CorrectionType,
  scale: CorrectionScale,
  writingMode: WritingMode,
): Cns3927Capability {
  if (scale !== "inline") return "generic-fallback";
  if (operation === "insert") return "reference-based";
  if (["delete", "replace", "cancel-correction"].includes(operation)) {
    return writingMode === "horizontal-tb" ? "reference-based" : "unverified";
  }
  return "unverified";
}

export const taiwanCns3927NotationPack: NotationPack = {
  id: CNS3927_ID,
  displayName: "臺灣 · CNS 3927",
  locale: "zh-Hant-TW",
  script: "Hant",
  jurisdiction: "TW",
  writingModes: ["horizontal-tb", "vertical-rl"],
  supportedCorrections: ["delete", "insert", "replace", "cancel-correction"],
  support: [
    { operation: "delete", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "insert", scales: ["inline"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "replace", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "cancel-correction", scales: ["inline"], writingModes: ["horizontal-tb"] },
  ],
  supports(correction) {
    return MAPPED_OPERATIONS.has(correction.type);
  },
  buildScene(correction, geometry, context) {
    if (
      getCns3927Capability(correction.type, geometry.scale, geometry.writingMode) !==
      "reference-based"
    ) {
      return createGenericScene(correction, geometry, context, CNS3927_ID, "generic-fallback");
    }
    switch (correction.type) {
      case "delete":
        return buildDelete(correction, geometry, context);
      case "insert":
        return buildInsert(correction, geometry, context);
      case "replace":
        return buildReplace(correction, geometry, context);
      case "cancel-correction":
        return buildRetain(correction, geometry, context);
      default:
        return createGenericScene(correction, geometry, context, CNS3927_ID, "generic-fallback");
    }
  },
};
