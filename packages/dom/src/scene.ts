import type { Correction } from "@proofmarks/core";
import type {
  CorrectionGeometry,
  CorrectionScale,
  LogicalPoint,
  LogicalRect,
} from "./geometry";
import { combineLogicalRects } from "./geometry";
import type { NotationPack, RenderContext } from "./notation";

export type SceneFidelity =
  | "technical"
  | "reference-based"
  | "generic-fallback"
  | "unsupported";

export type SceneRole =
  | "target-stroke"
  | "target-boundary"
  | "content-boundary"
  | "deletion-tail"
  | "retention-mark"
  | "cancel-stroke"
  | "leader"
  | "notation-mark"
  | "range-start-boundary"
  | "range-connector"
  | "range-end-boundary"
  | "insertion-anchor"
  | "insertion-content-boundary"
  | "exchange-path"
  | "notation-label"
  | "replacement-text"
  | "inserted-text"
  | "label";

export type SceneLine = {
  type: "line";
  role: SceneRole;
  from: LogicalPoint;
  to: LogicalPoint;
};

export type ScenePathCommand =
  | { type: "move"; to: LogicalPoint }
  | { type: "line"; to: LogicalPoint }
  | {
      type: "cubic";
      control1: LogicalPoint;
      control2: LogicalPoint;
      to: LogicalPoint;
    };

export type ScenePath = {
  type: "path";
  role: SceneRole;
  commands: readonly ScenePathCommand[];
};

export type SceneText = {
  type: "text";
  role:
    | "inserted-text"
    | "replacement-text"
    | "notation-label"
    | "label";
  at: LogicalPoint;
  text: string;
  orientation?: "horizontal" | "vertical-upright";
  /** Internal canonical typography derived from the measured source text. */
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
};

export type SceneNode = SceneLine | ScenePath | SceneText;

export type SceneDebugRect = {
  role:
    | "target-rect"
    | "target-bounds"
    | "referenced-target-rect"
    | "referenced-target-bounds"
    | "referenced-scene-bounds"
    | "overlay-bounds";
  rect: LogicalRect;
  index: number;
};

export type SceneDebugPoint = {
  role:
    | "anchor"
    | "origin"
    | "range-start"
    | "range-end"
    | "label-anchor"
    | "insertion-anchor"
    | "operand-a"
    | "operand-b"
    | "referenced-mark-anchor"
    | "cancel-anchor";
  at: LogicalPoint;
};

export type ProofmarkScene = {
  correctionId: string;
  operation: Correction["type"];
  notationId: string;
  fidelity: SceneFidelity;
  scale: CorrectionScale;
  rectCount: number;
  nodes: SceneNode[];
  /** Internal notation presentation metrics, not consumer customization knobs. */
  presentation?: ScenePresentation;
  debugRects: SceneDebugRect[];
  debugPoints: SceneDebugPoint[];
};

export type ScenePresentation = {
  strokeWidth: number;
  labelFontSize: number;
  payloadFontSize: number;
  sourceFontFamily: string;
  labelFontFamily: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function createEmptyScene(
  correction: Correction,
  geometry: CorrectionGeometry,
  notationId: string,
  fidelity: SceneFidelity,
): ProofmarkScene {
  return {
    correctionId: correction.id,
    operation: correction.type,
    notationId,
    fidelity,
    scale: geometry.scale,
    rectCount: 0,
    nodes: [],
    presentation: canonicalPresentation(geometry),
    debugRects: [],
    debugPoints: [],
  };
}

function labelFor(correction: Correction, locale?: string): string {
  const language = locale?.toLowerCase().split("-")[0];
  const labels: Record<string, readonly string[]> = {
    ja: ["削除", "入れ替え", "移動", "間隔を広げる", "間隔を詰める", "訂正取消"],
    zh: locale?.toLowerCase().includes("tw") || locale?.toLowerCase().includes("hant")
      ? ["刪除", "對調", "移動", "加寬間距", "縮小間距", "取消修改"]
      : ["删除", "对调", "移动", "加宽间距", "缩小间距", "取消修改"],
    ko: ["삭제", "바꾸기", "이동", "간격 넓히기", "간격 좁히기", "수정 취소"],
  };
  const localized = labels[language ?? ""];
  const operations = ["delete", "transpose", "move", "increase-spacing", "decrease-spacing", "cancel-correction"];
  const label = localized?.[operations.indexOf(correction.type)];
  if (label) return label;
  switch (correction.type) {
    case "delete":
      return "Delete";
    case "insert":
      return correction.content;
    case "replace":
      return correction.replacement;
    case "transpose":
      return "Swap";
    case "move":
      return "Move";
    case "increase-spacing":
      return "Space";
    case "decrease-spacing":
      return "Close";
    case "cancel-correction":
      return "Cancel";
  }
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

/** The measured source em, with a target-height fallback for isolated unit fixtures. */
export function sourceEm(geometry: CorrectionGeometry): number {
  const measured = median(
    geometry.targets
      .flat()
      .map((rect) => rect.blockEnd - rect.blockStart)
      .filter((value) => value > 0),
  );
  return geometry.typography?.fontSize ?? measured ?? 16;
}

export function sourceLineHeight(geometry: CorrectionGeometry): number {
  return geometry.typography?.lineHeight ?? sourceEm(geometry) * 1.2;
}

export function canonicalStrokeWidth(geometry: CorrectionGeometry): number {
  return clamp(sourceEm(geometry) * 0.092, 1.15, 2.35);
}

export function canonicalLabelSize(geometry: CorrectionGeometry): number {
  return clamp(sourceEm(geometry) * 0.72, 10.5, 18);
}

export function canonicalPayloadSize(geometry: CorrectionGeometry): number {
  return clamp(sourceEm(geometry) * 0.9, 11.5, 26);
}

export function sourceTextFamily(geometry: CorrectionGeometry): string {
  return geometry.typography?.fontFamily ?? "serif";
}

export function canonicalPresentation(
  geometry: CorrectionGeometry,
  labelFontFamily = '"Noto Sans", "Noto Sans CJK JP", "Yu Gothic", "Malgun Gothic", "Microsoft YaHei", sans-serif',
): ScenePresentation {
  return {
    strokeWidth: canonicalStrokeWidth(geometry),
    labelFontSize: canonicalLabelSize(geometry),
    payloadFontSize: canonicalPayloadSize(geometry),
    sourceFontFamily: sourceTextFamily(geometry),
    labelFontFamily,
  };
}

export function createSceneDebug(
  geometry: CorrectionGeometry,
  anchor: LogicalPoint,
  debug: boolean,
): Pick<ProofmarkScene, "debugRects" | "debugPoints"> {
  if (!debug) return { debugRects: [], debugPoints: [] };
  const rects = geometry.targets.flat();
  const bounds = combineLogicalRects(rects);
  return {
    debugRects: [
      ...rects.map((rect, index) => ({
        role: "target-rect" as const,
        rect,
        index,
      })),
      ...(bounds
        ? [{ role: "target-bounds" as const, rect: bounds, index: 0 }]
        : []),
      {
        role: "overlay-bounds",
        rect: {
          inlineStart: 0,
          inlineEnd: geometry.viewport.inlineSize,
          blockStart: 0,
          blockEnd: geometry.viewport.blockSize,
        },
        index: 0,
      },
    ],
    debugPoints: [
      { role: "anchor", at: anchor },
      { role: "origin", at: { inline: 0, block: 0 } },
    ],
  };
}

function pointsForNode(node: SceneNode): LogicalPoint[] {
  if (node.type === "line") return [node.from, node.to];
  if (node.type === "text") return [node.at];
  return node.commands.flatMap((command) =>
    command.type === "cubic"
      ? [command.control1, command.control2, command.to]
      : [command.to],
  );
}

export function getSceneBounds(scene: ProofmarkScene): LogicalRect | null {
  const points = scene.nodes.flatMap(pointsForNode);
  if (points.length === 0) return null;
  return {
    inlineStart: Math.min(...points.map(({ inline }) => inline)),
    inlineEnd: Math.max(...points.map(({ inline }) => inline)),
    blockStart: Math.min(...points.map(({ block }) => block)),
    blockEnd: Math.max(...points.map(({ block }) => block)),
  };
}

export function createRelationSceneDebug(
  geometry: CorrectionGeometry,
  referencedScene: ProofmarkScene,
  anchor: LogicalPoint,
  debug: boolean,
): Pick<ProofmarkScene, "debugRects" | "debugPoints"> {
  const base = createSceneDebug(geometry, anchor, debug);
  if (!debug) return base;
  for (const item of base.debugRects) {
    if (item.role === "target-rect") item.role = "referenced-target-rect";
    else if (item.role === "target-bounds") {
      item.role = "referenced-target-bounds";
    }
  }
  const sceneBounds = getSceneBounds(referencedScene);
  if (sceneBounds) {
    base.debugRects.push({
      role: "referenced-scene-bounds",
      rect: sceneBounds,
      index: 0,
    });
  }
  base.debugPoints.push({ role: "cancel-anchor", at: anchor });
  return base;
}

function createCaret(
  point: LogicalPoint,
  blockDirection: -1 | 1,
): SceneLine[] {
  const shoulder = point.block + blockDirection * 7;
  const tip = point.block + blockDirection * 1;
  return [
    {
      type: "line",
      role: "notation-mark",
      from: { inline: point.inline - 6, block: shoulder },
      to: { inline: point.inline, block: tip },
    },
    {
      type: "line",
      role: "notation-mark",
      from: { inline: point.inline, block: tip },
      to: { inline: point.inline + 6, block: shoulder },
    },
  ];
}

export function createGenericScene(
  correction: Correction,
  geometry: CorrectionGeometry,
  context: RenderContext,
  notationId: string,
  fidelity: SceneFidelity,
): ProofmarkScene {
  const rects = geometry.targets.flat();
  if (rects.length === 0) {
    return createEmptyScene(correction, geometry, notationId, fidelity);
  }

  const lastRect = rects.at(-1)!;
  const anchor: LogicalPoint = {
    inline: (lastRect.inlineStart + lastRect.inlineEnd) / 2,
    block: lastRect.blockEnd,
  };
  const hasForwardLane = lastRect.blockEnd + 34 <= geometry.viewport.blockSize - 8;
  const blockDirection: -1 | 1 = hasForwardLane ? 1 : -1;
  const laneBlock = hasForwardLane
    ? lastRect.blockEnd + 28
    : Math.max(12, lastRect.blockStart - 28);
  const labelInline = clamp(
    lastRect.inlineEnd + 12,
    20,
    geometry.viewport.inlineSize - 20,
  );
  const labelAt: LogicalPoint = { inline: labelInline, block: laneBlock };
  const nodes: SceneNode[] = [];

  if (correction.type === "insert") {
    const point: LogicalPoint = {
      inline: lastRect.inlineStart,
      block: blockDirection === 1 ? lastRect.blockEnd : lastRect.blockStart,
    };
    nodes.push(...createCaret(point, blockDirection));
  } else {
    nodes.push(
      ...rects.map<SceneLine>((rect) => ({
        type: "line",
        role: "target-stroke",
        from: { inline: rect.inlineStart, block: rect.blockStart },
        to: { inline: rect.inlineEnd, block: rect.blockEnd },
      })),
    );
  }

  nodes.push(
    {
      type: "line",
      role: "leader",
      from: anchor,
      to: { inline: labelInline, block: anchor.block },
    },
    {
      type: "line",
      role: "leader",
      from: { inline: labelInline, block: anchor.block },
      to: labelAt,
    },
    {
      type: "text",
      role: correction.type === "insert" || correction.type === "replace"
        ? "inserted-text"
        : "label",
      at: labelAt,
      text: labelFor(correction, context.locale),
      orientation:
        geometry.writingMode === "vertical-rl" ? "vertical-upright" : "horizontal",
    },
  );

  return {
    correctionId: correction.id,
    operation: correction.type,
    notationId,
    fidelity,
    scale: geometry.scale,
    rectCount: rects.length,
    nodes,
    presentation: canonicalPresentation(geometry),
    ...createSceneDebug(geometry, anchor, context.debug),
  };
}

export const technicalNotationPack: NotationPack = {
  id: "technical",
  displayName: "Technical",
  locale: "und",
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
    { operation: "delete", scales: ["inline", "phrase", "block"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "insert", scales: ["inline", "phrase", "block"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "replace", scales: ["inline", "phrase", "block"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "transpose", scales: ["inline", "phrase", "block"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "move", scales: ["inline", "phrase", "block"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "increase-spacing", scales: ["inline", "phrase", "block"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "decrease-spacing", scales: ["inline", "phrase", "block"], writingModes: ["horizontal-tb", "vertical-rl"] },
    { operation: "cancel-correction", scales: ["inline", "phrase", "block"], writingModes: ["horizontal-tb", "vertical-rl"] },
  ],
  supports: () => true,
  buildScene(correction, geometry, context) {
    return createGenericScene(
      correction,
      geometry,
      context,
      "technical",
      "technical",
    );
  },
};
