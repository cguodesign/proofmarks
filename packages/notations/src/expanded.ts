import type { Correction } from "@proofmarks/core";
import {
  canonicalPresentation,
  combineLogicalRects,
  createEmptyScene,
  createSceneDebug,
  type CorrectionGeometry,
  type LogicalPoint,
  type LogicalRect,
  type ProofmarkScene,
  type RenderContext,
  type SceneLine,
  type SceneNode,
  type ScenePath,
} from "@proofmarks/dom";
import { canonicalUnits } from "./metrics";

export type ExpandedNotationStyle = "jis" | "gb" | "ks" | "en-us";

type ExpandedCorrection = Extract<
  Correction,
  { type: "move" | "increase-spacing" | "decrease-spacing" }
>;

function center(rect: LogicalRect): LogicalPoint {
  return {
    inline: (rect.inlineStart + rect.inlineEnd) / 2,
    block: (rect.blockStart + rect.blockEnd) / 2,
  };
}

function scene(
  correction: ExpandedCorrection,
  geometry: CorrectionGeometry,
  context: RenderContext,
  notationId: string,
  nodes: SceneNode[],
  anchor: LogicalPoint,
): ProofmarkScene {
  return {
    correctionId: correction.id,
    operation: correction.type,
    notationId,
    fidelity: "reference-based",
    scale: geometry.scale,
    rectCount: geometry.targets.flat().length,
    nodes,
    presentation: canonicalPresentation(geometry),
    ...createSceneDebug(geometry, anchor, context.debug),
  };
}

function roundedBoundary(rect: LogicalRect, pad: number, curl: number): ScenePath {
  const left = rect.inlineStart - pad;
  const right = rect.inlineEnd + pad;
  const top = rect.blockStart - pad * 0.7;
  const bottom = rect.blockEnd + pad * 0.7;
  return {
    type: "path",
    role: "target-boundary",
    commands: [
      { type: "move", to: { inline: left, block: top } },
      { type: "line", to: { inline: right, block: top } },
      {
        type: "cubic",
        control1: { inline: right + curl, block: top },
        control2: { inline: right + curl, block: bottom },
        to: { inline: right, block: bottom },
      },
      { type: "line", to: { inline: left, block: bottom } },
      {
        type: "cubic",
        control1: { inline: left - curl, block: bottom },
        control2: { inline: left - curl, block: top },
        to: { inline: left, block: top },
      },
    ],
  };
}

function moveLabel(style: ExpandedNotationStyle): string {
  if (style === "jis") return "移";
  if (style === "gb") return "转移";
  if (style === "ks") return "옮김";
  return "move";
}

function buildMove(
  correction: Extract<ExpandedCorrection, { type: "move" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
  notationId: string,
  style: ExpandedNotationStyle,
): ProofmarkScene {
  const source = combineLogicalRects(geometry.targets[0] ?? []);
  const destinationRect = geometry.targets[1]?.[0];
  if (!source || !destinationRect) {
    return createEmptyScene(correction, geometry, notationId, "reference-based");
  }
  const units = canonicalUnits(geometry);
  const from = center(source);
  const destination = {
    inline: destinationRect.inlineStart,
    block: (destinationRect.blockStart + destinationRect.blockEnd) / 2,
  };
  const outward = Math.min(source.blockStart, destination.block) - units.lane;
  const direction = destination.inline >= from.inline ? 1 : -1;
  const route: ScenePath = {
    type: "path",
    role: "leader",
    commands: [
      { type: "move", to: from },
      ...(style === "gb"
        ? [
            { type: "line" as const, to: { inline: from.inline, block: outward } },
            { type: "line" as const, to: { inline: destination.inline, block: outward } },
            { type: "line" as const, to: destination },
          ]
        : [
            {
              type: "cubic" as const,
              control1: { inline: from.inline, block: outward },
              control2: { inline: destination.inline, block: outward },
              to: destination,
            },
          ]),
    ],
  };
  const arrowSize = units.mark * (style === "ks" ? 0.62 : 0.72);
  const arrow: SceneLine[] = [
    {
      type: "line",
      role: "notation-mark",
      from: {
        inline: destination.inline - direction * arrowSize,
        block: destination.block - arrowSize * 0.62,
      },
      to: destination,
    },
    {
      type: "line",
      role: "notation-mark",
      from: {
        inline: destination.inline - direction * arrowSize,
        block: destination.block + arrowSize * 0.62,
      },
      to: destination,
    },
  ];
  const boundary = style === "jis"
    ? {
        type: "line" as const,
        role: "target-stroke" as const,
        from: { inline: source.inlineStart, block: source.blockStart - units.hair },
        to: { inline: source.inlineEnd, block: source.blockEnd + units.hair },
      }
    : roundedBoundary(source, units.hair, units.hair);
  return scene(
    correction,
    geometry,
    context,
    notationId,
    [
      boundary,
      route,
      ...arrow,
      {
        type: "text",
        role: "notation-label",
        at: {
          inline: (from.inline + destination.inline) / 2,
          block: outward - units.gap * 0.5,
        },
        text: moveLabel(style),
        orientation: "horizontal",
      },
    ],
    destination,
  );
}

function hashMark(at: LogicalPoint, size: number): SceneLine[] {
  return [
    ...[-0.28, 0.28].map<SceneLine>((offset) => ({
      type: "line",
      role: "notation-mark",
      from: { inline: at.inline + size * offset, block: at.block - size * 0.62 },
      to: { inline: at.inline + size * offset, block: at.block + size * 0.62 },
    })),
    ...[-0.22, 0.22].map<SceneLine>((offset) => ({
      type: "line",
      role: "notation-mark",
      from: { inline: at.inline - size * 0.72, block: at.block + size * offset },
      to: { inline: at.inline + size * 0.72, block: at.block + size * offset },
    })),
  ];
}

function buildIncreaseSpacing(
  correction: Extract<ExpandedCorrection, { type: "increase-spacing" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
  notationId: string,
  style: ExpandedNotationStyle,
): ProofmarkScene {
  const rect = geometry.targets[0]?.[0];
  if (!rect) return createEmptyScene(correction, geometry, notationId, "reference-based");
  const units = canonicalUnits(geometry);
  const anchor = {
    inline: rect.inlineStart,
    block: (rect.blockStart + rect.blockEnd) / 2,
  };
  const markAt = { inline: anchor.inline, block: rect.blockEnd + units.gap };
  const nodes: SceneNode[] = style === "jis"
    ? [
        {
          type: "path",
          role: "notation-mark",
          commands: [
            { type: "move", to: { inline: markAt.inline - units.mark * 0.55, block: markAt.block } },
            { type: "line", to: { inline: markAt.inline, block: markAt.block + units.mark * 0.72 } },
            { type: "line", to: { inline: markAt.inline + units.mark * 0.55, block: markAt.block } },
          ],
        },
        {
          type: "text",
          role: "notation-label",
          at: { inline: markAt.inline + units.em * 1.2, block: markAt.block + units.hair },
          text: "アキ",
          orientation: "horizontal",
        },
      ]
    : hashMark(markAt, units.mark * (style === "en-us" ? 0.9 : 0.82));
  return scene(correction, geometry, context, notationId, nodes, anchor);
}

function closeUpMark(rect: LogicalRect, geometry: CorrectionGeometry): ScenePath {
  const units = canonicalUnits(geometry);
  const block = rect.blockEnd + units.gap;
  const left = rect.inlineStart - units.hair;
  const right = rect.inlineEnd + units.hair;
  return {
    type: "path",
    role: "notation-mark",
    commands: [
      { type: "move", to: { inline: left - units.hair, block: block - units.mark * 0.62 } },
      {
        type: "cubic",
        control1: { inline: left + units.hair, block: block - units.mark * 0.5 },
        control2: { inline: left + units.hair, block: block + units.mark * 0.5 },
        to: { inline: left - units.hair, block: block + units.mark * 0.62 },
      },
      { type: "move", to: { inline: right + units.hair, block: block - units.mark * 0.62 } },
      {
        type: "cubic",
        control1: { inline: right - units.hair, block: block - units.mark * 0.5 },
        control2: { inline: right - units.hair, block: block + units.mark * 0.5 },
        to: { inline: right + units.hair, block: block + units.mark * 0.62 },
      },
    ],
  };
}

function buildDecreaseSpacing(
  correction: Extract<ExpandedCorrection, { type: "decrease-spacing" }>,
  geometry: CorrectionGeometry,
  context: RenderContext,
  notationId: string,
  style: ExpandedNotationStyle,
): ProofmarkScene {
  const rect = combineLogicalRects(geometry.targets[0] ?? []);
  if (!rect) return createEmptyScene(correction, geometry, notationId, "reference-based");
  const units = canonicalUnits(geometry);
  const midpoint = center(rect);
  const nodes: SceneNode[] = [closeUpMark(rect, geometry)];
  if (style === "jis") {
    nodes.push({
      type: "text",
      role: "notation-label",
      at: { inline: midpoint.inline, block: rect.blockEnd + units.gap + units.mark },
      text: "ベタ",
      orientation: "horizontal",
    });
  }
  return scene(correction, geometry, context, notationId, nodes, midpoint);
}

export function buildExpandedScene(
  correction: ExpandedCorrection,
  geometry: CorrectionGeometry,
  context: RenderContext,
  notationId: string,
  style: ExpandedNotationStyle,
): ProofmarkScene {
  switch (correction.type) {
    case "move":
      return buildMove(correction, geometry, context, notationId, style);
    case "increase-spacing":
      return buildIncreaseSpacing(correction, geometry, context, notationId, style);
    case "decrease-spacing":
      return buildDecreaseSpacing(correction, geometry, context, notationId, style);
  }
}
