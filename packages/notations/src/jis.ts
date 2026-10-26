import type { Correction, CorrectionType, TextRangeTarget } from "@proofmarks/core";
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
  type SceneLine,
  type SceneNode,
  type ScenePath,
  type SceneText,
} from "@proofmarks/dom";
import { buildExpandedScene } from "./expanded";
import { canonicalUnits, payloadInlineExtent } from "./metrics";

const JIS_ID = "ja-jis-z8208-reference";
const IMPLEMENTED = new Set<CorrectionType>([
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
  return geometry.targets[0]?.[0] ?? null;
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
    notationId: JIS_ID,
    fidelity: "reference-based",
    scale: geometry.scale,
    rectCount: geometry.targets.flat().length,
    nodes,
    presentation: canonicalPresentation(geometry),
    ...debug,
  };
}

function orientation(
  geometry: CorrectionGeometry,
): "horizontal" | "vertical-upright" {
  return geometry.writingMode === "vertical-rl"
    ? "vertical-upright"
    : "horizontal";
}

type AnnotationLane = {
  anchor: LogicalPoint;
  label: LogicalPoint;
};

function annotationLane(
  rect: LogicalRect,
  geometry: CorrectionGeometry,
  anchor: LogicalPoint,
): AnnotationLane {
  const units = canonicalUnits(geometry);
  const forward = rect.blockEnd + units.lane + units.gap <= geometry.viewport.blockSize - units.gap;
  const block = forward
    ? rect.blockEnd + units.lane
    : Math.max(units.em, rect.blockStart - units.lane);
  const inline = clamp(
    rect.inlineEnd + units.em,
    units.em,
    geometry.viewport.inlineSize - units.em,
  );
  return { anchor, label: { inline, block } };
}

function leaderAndText(
  lane: AnnotationLane,
  text: string,
  role: "notation-label" | "replacement-text",
  geometry: CorrectionGeometry,
): SceneNode[] {
  const units = canonicalUnits(geometry);
  const leader: ScenePath = {
    type: "path",
    role: "leader",
    commands: [
      { type: "move", to: lane.anchor },
      {
        type: "cubic",
        control1: {
          inline: lane.anchor.inline + units.mark * 0.65,
          block: lane.anchor.block,
        },
        control2: {
          inline: lane.label.inline,
          block: lane.anchor.block,
        },
        to: lane.label,
      },
    ],
  };
  const label: SceneText = {
    type: "text",
    role,
    at: lane.label,
    text,
    orientation: orientation(geometry),
  };
  return [leader, label];
}

type RangeConstruction = {
  nodes: SceneLine[];
  anchor: LogicalPoint;
  debugPoints: SceneDebugPoint[];
};

function buildTargetRemoval(
  rect: LogicalRect,
  target: TextRangeTarget,
): RangeConstruction {
  const length = target.end - target.start;
  const inlineExtent = rect.inlineEnd - rect.inlineStart;
  const blockCenter = (rect.blockStart + rect.blockEnd) / 2;
  const anchor = {
    inline: (rect.inlineStart + rect.inlineEnd) / 2,
    block: blockCenter,
  };

  if (length === 1) {
    return {
      nodes: [
        {
          type: "line",
          role: "target-stroke",
          from: { inline: rect.inlineStart, block: rect.blockStart },
          to: { inline: rect.inlineEnd, block: rect.blockEnd },
        },
      ],
      anchor,
      debugPoints: [
        { role: "range-start", at: anchor },
        { role: "range-end", at: anchor },
      ],
    };
  }

  const characterExtent = inlineExtent / length;
  const startCenter = {
    inline: rect.inlineStart + characterExtent / 2,
    block: blockCenter,
  };
  const endCenter = {
    inline: rect.inlineEnd - characterExtent / 2,
    block: blockCenter,
  };
  return {
    nodes: [
      {
        type: "line",
        role: "range-start-boundary",
        from: { inline: rect.inlineStart, block: rect.blockStart },
        to: {
          inline: rect.inlineStart + characterExtent,
          block: rect.blockEnd,
        },
      },
      {
        type: "line",
        role: "range-connector",
        from: { inline: rect.inlineStart, block: blockCenter },
        to: { inline: rect.inlineEnd, block: blockCenter },
      },
      {
        type: "line",
        role: "range-end-boundary",
        from: {
          inline: rect.inlineEnd - characterExtent,
          block: rect.blockStart,
        },
        to: { inline: rect.inlineEnd, block: rect.blockEnd },
      },
    ],
    anchor,
    debugPoints: [
      { role: "range-start", at: startCenter },
      { role: "range-end", at: endCenter },
    ],
  };
}

function buildDeleteOrReplace(
  correction: Extract<Correction, { type: "delete" | "replace" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) {
    return createEmptyScene(correction, geometry, JIS_ID, "reference-based");
  }
  const target = buildTargetRemoval(rect, correction.target);
  const lane = annotationLane(rect, geometry, target.anchor);
  const label = correction.type === "delete" ? "トル" : correction.replacement;
  const role = correction.type === "delete"
    ? "notation-label"
    : "replacement-text";
  return scene(
    correction,
    geometry,
    context,
    [...target.nodes, ...leaderAndText(lane, label, role, geometry)],
    target.anchor,
    [
      ...target.debugPoints,
      { role: "label-anchor", at: lane.label },
    ],
  );
}

function buildInsert(
  correction: Extract<Correction, { type: "insert" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  const rect = firstRect(geometry);
  if (!rect) {
    return createEmptyScene(correction, geometry, JIS_ID, "reference-based");
  }

  const units = canonicalUnits(geometry);
  const insertion = rect.inlineStart;
  const useBeforeSide = rect.blockStart >= units.line * 2;
  const direction: -1 | 1 = useBeforeSide ? -1 : 1;
  const sourceBlock = useBeforeSide ? rect.blockStart : rect.blockEnd;
  const tip = {
    inline: insertion,
    block: sourceBlock + direction * Math.max(1, units.hair * 0.25),
  };
  const shoulderBlock = tip.block + direction * units.mark * 0.72;
  const contentExtent = payloadInlineExtent(geometry, correction.content, 1);
  const contentInline = clamp(
    insertion + Math.max(units.line * 1.35, contentExtent / 2 + units.gap),
    contentExtent / 2 + units.gap,
    geometry.viewport.inlineSize - contentExtent / 2 - units.gap,
  );
  const contentBlock = clamp(
    sourceBlock + direction * (units.lane + units.gap * 0.4),
    units.em,
    geometry.viewport.blockSize - units.em,
  );
  const contentStart = contentInline - contentExtent / 2;
  const contentEnd = contentInline + contentExtent / 2;
  const boundaryOffset = units.em * 0.56;
  const leaderEnd = {
    inline: contentStart - units.hair,
    block: contentBlock,
  };

  const nodes: SceneNode[] = [
    {
      type: "line",
      role: "insertion-anchor",
      from: { inline: insertion - units.mark * 0.62, block: shoulderBlock },
      to: tip,
    },
    {
      type: "line",
      role: "insertion-anchor",
      from: tip,
      to: { inline: insertion + units.mark * 0.62, block: shoulderBlock },
    },
    {
      type: "path",
      role: "leader",
      commands: [
        { type: "move", to: tip },
        {
          type: "cubic",
          control1: {
            inline: insertion + units.mark * 0.7,
            block: tip.block + direction * units.hair * 0.6,
          },
          control2: {
            inline: contentStart - units.gap,
            block: contentBlock,
          },
          to: leaderEnd,
        },
      ],
    },
    {
      type: "line",
      role: "insertion-content-boundary",
      from: {
        inline: contentStart,
        block: contentBlock - boundaryOffset,
      },
      to: {
        inline: contentEnd,
        block: contentBlock - boundaryOffset,
      },
    },
    {
      type: "line",
      role: "insertion-content-boundary",
      from: {
        inline: contentStart,
        block: contentBlock + boundaryOffset,
      },
      to: {
        inline: contentEnd,
        block: contentBlock + boundaryOffset,
      },
    },
    {
      type: "text",
      role: "inserted-text",
      at: { inline: contentInline, block: contentBlock },
      text: correction.content,
      orientation: orientation(geometry),
    },
  ];
  return scene(correction, geometry, context, nodes, tip, [
    { role: "insertion-anchor", at: tip },
    {
      role: "label-anchor",
      at: { inline: contentInline, block: contentBlock },
    },
  ]);
}

function adjacentTargets(
  geometry: CorrectionGeometry,
): [LogicalRect, LogicalRect] | null {
  const first = geometry.targets[0]?.[0];
  const second = geometry.targets[1]?.[0];
  if (!first || !second) return null;
  const firstCenter = (first.blockStart + first.blockEnd) / 2;
  const secondCenter = (second.blockStart + second.blockEnd) / 2;
  const blockTolerance = Math.max(
    first.blockEnd - first.blockStart,
    second.blockEnd - second.blockStart,
  ) * 0.35;
  const inlineGap = second.inlineStart - first.inlineEnd;
  if (
    Math.abs(firstCenter - secondCenter) > blockTolerance ||
    inlineGap < -1 ||
    inlineGap > 8
  ) {
    return null;
  }
  return [first, second];
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
      JIS_ID,
      "generic-fallback",
    );
  }
  const [first, second] = targets;
  const units = canonicalUnits(geometry);
  const blockStart = Math.min(first.blockStart, second.blockStart) - units.hair;
  const blockEnd = Math.max(first.blockEnd, second.blockEnd) + units.hair;
  const blockCenter = (blockStart + blockEnd) / 2;
  const junction = (first.inlineEnd + second.inlineStart) / 2;
  const path: ScenePath = {
    type: "path",
    role: "exchange-path",
    commands: [
      {
        type: "move",
        to: { inline: first.inlineStart - units.hair * 0.5, block: blockStart },
      },
      {
        type: "cubic",
        control1: { inline: first.inlineEnd, block: blockStart },
        control2: { inline: junction, block: blockStart },
        to: { inline: junction, block: blockCenter },
      },
      {
        type: "cubic",
        control1: { inline: junction, block: blockEnd },
        control2: { inline: second.inlineStart, block: blockEnd },
        to: { inline: second.inlineEnd + units.hair * 0.5, block: blockEnd },
      },
    ],
  };
  const firstCenter = {
    inline: (first.inlineStart + first.inlineEnd) / 2,
    block: (first.blockStart + first.blockEnd) / 2,
  };
  const secondCenter = {
    inline: (second.inlineStart + second.inlineEnd) / 2,
    block: (second.blockStart + second.blockEnd) / 2,
  };
  const anchor = { inline: junction, block: blockCenter };
  return scene(correction, geometry, context, [path], anchor, [
    { role: "operand-a", at: firstCenter },
    { role: "operand-b", at: secondCenter },
  ]);
}

function buildCancelCorrection(
  correction: Extract<Correction, { type: "cancel-correction" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  if (!context.referencedCorrection) {
    return createGenericScene(
      correction,
      geometry,
      context,
      JIS_ID,
      "generic-fallback",
    );
  }
  const rect = firstRect(geometry);
  if (!rect) {
    return createEmptyScene(correction, geometry, JIS_ID, "reference-based");
  }
  const units = canonicalUnits(geometry);
  const forward = rect.blockEnd + units.line <= geometry.viewport.blockSize - units.gap;
  const labelAt = {
    inline: (rect.inlineStart + rect.inlineEnd) / 2,
    block: forward ? rect.blockEnd + units.em * 1.05 : Math.max(units.em, rect.blockStart - units.em * 1.05),
  };
  const text: SceneText = {
    type: "text",
    role: "notation-label",
    at: labelAt,
    text: "イキ",
    orientation: orientation(geometry),
  };
  return scene(correction, geometry, context, [text], labelAt, [
    { role: "label-anchor", at: labelAt },
  ]);
}

export function getJisCapability(
  operation: CorrectionType,
  scale: CorrectionScale,
  writingMode: "horizontal-tb" | "vertical-rl" = "horizontal-tb",
): "reference-based" | "generic-fallback" | "unsupported" {
  if (!IMPLEMENTED.has(operation)) return "unsupported";
  if (
    (operation === "move" ||
      operation === "increase-spacing" ||
      operation === "decrease-spacing") &&
    writingMode !== "horizontal-tb"
  ) return "generic-fallback";
  return scale === "inline" ? "reference-based" : "generic-fallback";
}

export const japaneseJisNotationPack: NotationPack = {
  id: JIS_ID,
  displayName: "Japanese · JIS",
  locale: "ja-JP",
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
    { operation: "delete", scales: ["inline"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "insert", scales: ["inline"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "replace", scales: ["inline"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "transpose", scales: ["inline"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "move", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "increase-spacing", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "decrease-spacing", scales: ["inline"], writingModes: ["horizontal-tb"] },
    { operation: "cancel-correction", scales: ["inline"], writingModes: ["horizontal-tb", "vertical-rl"] },
  ],
  supports(correction) {
    return IMPLEMENTED.has(correction.type);
  },
  buildScene(correction, geometry, context) {
    if (getJisCapability(correction.type, geometry.scale, geometry.writingMode) !== "reference-based") {
      return createGenericScene(
        correction,
        geometry,
        context,
        JIS_ID,
        "generic-fallback",
      );
    }
    switch (correction.type) {
      case "delete":
      case "replace":
        return buildDeleteOrReplace(correction, geometry, context);
      case "insert":
        return buildInsert(correction, geometry, context);
      case "transpose":
        return buildTranspose(correction, geometry, context);
      case "move":
      case "increase-spacing":
      case "decrease-spacing":
        return buildExpandedScene(correction, geometry, context, JIS_ID, "jis");
      case "cancel-correction":
        return buildCancelCorrection(correction, geometry, context);
    }
  },
};
