import type {
  CorrectionGeometry,
  LogicalPoint,
  LogicalRect,
  LogicalViewport,
} from "./geometry";
import { combineLogicalRects } from "./geometry";
import type {
  ProofmarkScene,
  SceneLine,
  SceneNode,
  ScenePath,
  ScenePathCommand,
  SceneRole,
  SceneText,
} from "./scene";

export type AnnotationLane =
  | "canonical-local"
  | "block-start-0"
  | "block-start-1"
  | "block-end-0"
  | "block-end-1"
  | "inline-start-margin"
  | "inline-end-margin";

export type RepresentationLevel = 0 | 1 | 2 | 3;
export type LeaderRoute = "none" | "direct" | "elbow";

export type ProofSheetBounds = {
  paper: LogicalRect;
  text: LogicalRect;
  sourceRects: readonly LogicalRect[];
};

export type PlacementCandidate = {
  key: string;
  lane: AnnotationLane;
  level: RepresentationLevel;
  rank: number;
  payloadBounds: LogicalRect;
  payloadCenter: LogicalPoint;
  leader: readonly LogicalPoint[];
  leaderRoute: LeaderRoute;
  score: number;
  collisions: readonly string[];
};

export type AnnotationPlacement = {
  correctionId: string;
  lane: AnnotationLane;
  level: RepresentationLevel;
  candidateKey: string;
  payloadBounds: LogicalRect;
  leader: readonly LogicalPoint[];
  leaderRoute: LeaderRoute;
  score: number;
  candidates: readonly PlacementCandidate[];
};

export type LayoutDebugLane = {
  lane: Exclude<AnnotationLane, "canonical-local">;
  rect: LogicalRect;
};

export type ProofmarkLayoutResult = {
  scenes: ProofmarkScene[];
  placements: ReadonlyMap<string, AnnotationPlacement>;
  debug: {
    bounds: ProofSheetBounds;
    lanes: readonly LayoutDebugLane[];
  };
};

export type LayoutOptions = {
  previousPlacements?: ReadonlyMap<string, AnnotationPlacement>;
  notationLocale?: string;
};

const MOVABLE_ROLES = new Set<SceneRole>([
  "content-boundary",
  "insertion-content-boundary",
  "notation-label",
  "replacement-text",
  "inserted-text",
  "label",
]);

type PlacementPreference = {
  lanes: readonly Exclude<AnnotationLane, "canonical-local">[];
};

const DEFAULT_LANES: PlacementPreference = {
  lanes: [
    "block-start-0",
    "block-end-0",
    "block-start-1",
    "block-end-1",
    "inline-end-margin",
    "inline-start-margin",
  ],
};

/**
 * These ranks preserve the direction already used by each audited notation
 * construction. They are layout defaults, not claims that a standard mandates
 * one exclusive placement direction.
 */
const OUTER_MARGIN_FIRST: PlacementPreference = {
  lanes: [
    "inline-end-margin",
    "block-end-0",
    "block-start-0",
    "block-end-1",
    "block-start-1",
    "inline-start-margin",
  ],
};

function preferenceForLocale(locale?: string): PlacementPreference {
  const language = locale?.toLowerCase().split("-")[0];
  return language === "zh" || language === "ko"
    ? OUTER_MARGIN_FIRST
    : DEFAULT_LANES;
}

function width(rect: LogicalRect): number {
  return rect.inlineEnd - rect.inlineStart;
}

function height(rect: LogicalRect): number {
  return rect.blockEnd - rect.blockStart;
}

function center(rect: LogicalRect): LogicalPoint {
  return {
    inline: (rect.inlineStart + rect.inlineEnd) / 2,
    block: (rect.blockStart + rect.blockEnd) / 2,
  };
}

function rectAt(point: LogicalPoint, inlineSize: number, blockSize: number): LogicalRect {
  return {
    inlineStart: point.inline - inlineSize / 2,
    inlineEnd: point.inline + inlineSize / 2,
    blockStart: point.block - blockSize / 2,
    blockEnd: point.block + blockSize / 2,
  };
}

function inflate(rect: LogicalRect, amount: number): LogicalRect {
  return {
    inlineStart: rect.inlineStart - amount,
    inlineEnd: rect.inlineEnd + amount,
    blockStart: rect.blockStart - amount,
    blockEnd: rect.blockEnd + amount,
  };
}

export function rectsOverlap(
  first: LogicalRect,
  second: LogicalRect,
  gap = 0,
): boolean {
  return !(
    first.inlineEnd + gap <= second.inlineStart ||
    second.inlineEnd + gap <= first.inlineStart ||
    first.blockEnd + gap <= second.blockStart ||
    second.blockEnd + gap <= first.blockStart
  );
}

function overlapArea(first: LogicalRect, second: LogicalRect): number {
  const inline = Math.max(
    0,
    Math.min(first.inlineEnd, second.inlineEnd) -
      Math.max(first.inlineStart, second.inlineStart),
  );
  const block = Math.max(
    0,
    Math.min(first.blockEnd, second.blockEnd) -
      Math.max(first.blockStart, second.blockStart),
  );
  return inline * block;
}

function pointInRect(point: LogicalPoint, rect: LogicalRect): boolean {
  return (
    point.inline >= rect.inlineStart &&
    point.inline <= rect.inlineEnd &&
    point.block >= rect.blockStart &&
    point.block <= rect.blockEnd
  );
}

function orientation(a: LogicalPoint, b: LogicalPoint, c: LogicalPoint): number {
  return (
    (b.block - a.block) * (c.inline - b.inline) -
    (b.inline - a.inline) * (c.block - b.block)
  );
}

function segmentsIntersect(
  a: LogicalPoint,
  b: LogicalPoint,
  c: LogicalPoint,
  d: LogicalPoint,
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function segmentIntersectsRect(
  from: LogicalPoint,
  to: LogicalPoint,
  rect: LogicalRect,
): boolean {
  if (pointInRect(from, rect) || pointInRect(to, rect)) return true;
  const topLeft = { inline: rect.inlineStart, block: rect.blockStart };
  const topRight = { inline: rect.inlineEnd, block: rect.blockStart };
  const bottomRight = { inline: rect.inlineEnd, block: rect.blockEnd };
  const bottomLeft = { inline: rect.inlineStart, block: rect.blockEnd };
  return (
    segmentsIntersect(from, to, topLeft, topRight) ||
    segmentsIntersect(from, to, topRight, bottomRight) ||
    segmentsIntersect(from, to, bottomRight, bottomLeft) ||
    segmentsIntersect(from, to, bottomLeft, topLeft)
  );
}

function pathSegments(path: readonly LogicalPoint[]): Array<[LogicalPoint, LogicalPoint]> {
  const result: Array<[LogicalPoint, LogicalPoint]> = [];
  for (let index = 1; index < path.length; index += 1) {
    result.push([path[index - 1]!, path[index]!]);
  }
  return result;
}

function pathsCross(
  first: readonly LogicalPoint[],
  second: readonly LogicalPoint[],
): boolean {
  return pathSegments(first).some(([a, b]) =>
    pathSegments(second).some(([c, d]) => segmentsIntersect(a, b, c, d)),
  );
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

function textBounds(node: SceneText): LogicalRect {
  const fontSize =
    node.role === "inserted-text" || node.role === "replacement-text" ? 15 : 13;
  const glyphs = Math.max(1, Array.from(node.text).length);
  const inlineSize = Math.max(12, glyphs * fontSize * 0.62 + 8);
  const blockSize = fontSize + 8;
  return node.orientation === "vertical-upright"
    ? rectAt(node.at, blockSize, inlineSize)
    : rectAt(node.at, inlineSize, blockSize);
}

function nodeBounds(node: SceneNode): LogicalRect | null {
  if (node.type === "text") return textBounds(node);
  const points = pointsForNode(node);
  if (points.length === 0) return null;
  return {
    inlineStart: Math.min(...points.map((point) => point.inline)),
    inlineEnd: Math.max(...points.map((point) => point.inline)),
    blockStart: Math.min(...points.map((point) => point.block)),
    blockEnd: Math.max(...points.map((point) => point.block)),
  };
}

function boundsForNodes(nodes: readonly SceneNode[]): LogicalRect | null {
  return combineLogicalRects(
    nodes.flatMap((node) => {
      const bounds = nodeBounds(node);
      return bounds ? [bounds] : [];
    }),
  );
}

function isMovable(node: SceneNode): boolean {
  return MOVABLE_ROLES.has(node.role);
}

function leaderAnchor(scene: ProofmarkScene, sourceBounds: LogicalRect): LogicalPoint {
  const leader = scene.nodes.find((node) => node.role === "leader");
  if (leader?.type === "line") return leader.from;
  if (leader?.type === "path") {
    const first = leader.commands[0];
    if (first) return first.to;
  }
  return center(sourceBounds);
}

function shiftPoint(point: LogicalPoint, delta: LogicalPoint): LogicalPoint {
  return { inline: point.inline + delta.inline, block: point.block + delta.block };
}

function shiftCommand(
  command: ScenePathCommand,
  delta: LogicalPoint,
): ScenePathCommand {
  if (command.type === "cubic") {
    return {
      type: "cubic",
      control1: shiftPoint(command.control1, delta),
      control2: shiftPoint(command.control2, delta),
      to: shiftPoint(command.to, delta),
    };
  }
  return { ...command, to: shiftPoint(command.to, delta) };
}

function shiftNode(node: SceneNode, delta: LogicalPoint): SceneNode {
  if (node.type === "text") return { ...node, at: shiftPoint(node.at, delta) };
  if (node.type === "line") {
    return {
      ...node,
      from: shiftPoint(node.from, delta),
      to: shiftPoint(node.to, delta),
    };
  }
  return { ...node, commands: node.commands.map((command) => shiftCommand(command, delta)) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (minimum > maximum) return (minimum + maximum) / 2;
  return Math.min(Math.max(value, minimum), maximum);
}

function clampCenterToPaper(
  desired: LogicalPoint,
  payload: LogicalRect,
  paper: LogicalRect,
): LogicalPoint {
  const halfInline = width(payload) / 2;
  const halfBlock = height(payload) / 2;
  return {
    inline: clamp(
      desired.inline,
      paper.inlineStart + halfInline + 5,
      paper.inlineEnd - halfInline - 5,
    ),
    block: clamp(
      desired.block,
      paper.blockStart + halfBlock + 5,
      paper.blockEnd - halfBlock - 5,
    ),
  };
}

function laneLevel(lane: AnnotationLane): RepresentationLevel {
  if (lane === "canonical-local") return 0;
  if (lane.endsWith("-0")) return 1;
  if (lane.endsWith("-1")) return 2;
  return 3;
}

function laneCenter(
  lane: Exclude<AnnotationLane, "canonical-local">,
  source: LogicalRect,
  text: LogicalRect,
  payload: LogicalRect,
  inlineOffset: number,
): LogicalPoint {
  const payloadInline = width(payload);
  const payloadBlock = height(payload);
  const anchor = center(source);
  switch (lane) {
    case "block-start-0":
      return {
        inline: anchor.inline + inlineOffset,
        block: source.blockStart - 10 - payloadBlock / 2,
      };
    case "block-end-0":
      return {
        inline: anchor.inline + inlineOffset,
        block: source.blockEnd + 10 + payloadBlock / 2,
      };
    case "block-start-1":
      return {
        inline: anchor.inline + inlineOffset,
        block: text.blockStart - 14 - payloadBlock / 2,
      };
    case "block-end-1":
      return {
        inline: anchor.inline + inlineOffset,
        block: text.blockEnd + 14 + payloadBlock / 2,
      };
    case "inline-start-margin":
      return {
        inline: text.inlineStart - 14 - payloadInline / 2,
        block: anchor.block + inlineOffset,
      };
    case "inline-end-margin":
      return {
        inline: text.inlineEnd + 14 + payloadInline / 2,
        block: anchor.block + inlineOffset,
      };
  }
}

function nearestPayloadEdge(
  anchor: LogicalPoint,
  payload: LogicalRect,
  lane: AnnotationLane,
): LogicalPoint {
  if (lane.startsWith("block-start")) {
    return {
      inline: clamp(anchor.inline, payload.inlineStart, payload.inlineEnd),
      block: payload.blockEnd,
    };
  }
  if (lane.startsWith("block-end")) {
    return {
      inline: clamp(anchor.inline, payload.inlineStart, payload.inlineEnd),
      block: payload.blockStart,
    };
  }
  if (lane === "inline-start-margin") {
    return {
      inline: payload.inlineEnd,
      block: clamp(anchor.block, payload.blockStart, payload.blockEnd),
    };
  }
  return {
    inline: payload.inlineStart,
    block: clamp(anchor.block, payload.blockStart, payload.blockEnd),
  };
}

function routeCandidates(
  anchor: LogicalPoint,
  payload: LogicalRect,
  lane: AnnotationLane,
  hasLeader: boolean,
): Array<{ route: LeaderRoute; points: readonly LogicalPoint[] }> {
  if (!hasLeader) return [{ route: "none", points: [] }];
  const endpoint = nearestPayloadEdge(anchor, payload, lane);
  const direct = { route: "direct" as const, points: [anchor, endpoint] };
  if (lane.startsWith("block")) {
    const midway = (anchor.block + endpoint.block) / 2;
    return [
      direct,
      {
        route: "elbow",
        points: [
          anchor,
          { inline: anchor.inline, block: midway },
          { inline: endpoint.inline, block: midway },
          endpoint,
        ],
      },
    ];
  }
  const midway = (anchor.inline + endpoint.inline) / 2;
  return [
    direct,
    {
      route: "elbow",
      points: [
        anchor,
        { inline: midway, block: anchor.block },
        { inline: midway, block: endpoint.block },
        endpoint,
      ],
    },
  ];
}

function routeLength(points: readonly LogicalPoint[]): number {
  let length = 0;
  for (const [from, to] of pathSegments(points)) {
    length += Math.hypot(to.inline - from.inline, to.block - from.block);
  }
  return length;
}

type ScoreContext = {
  bounds: ProofSheetBounds;
  anchor: LogicalPoint;
  canonicalBounds: readonly LogicalRect[];
  placed: readonly AnnotationPlacement[];
  preferredRank: number;
  previous?: AnnotationPlacement;
};

function scoreCandidate(
  candidate: Omit<PlacementCandidate, "score" | "collisions">,
  context: ScoreContext,
): PlacementCandidate {
  let score = context.preferredRank * 14 + candidate.level * 8;
  const collisions: string[] = [];
  const payload = candidate.payloadBounds;
  const paper = context.bounds.paper;

  const outsideArea =
    Math.max(0, paper.inlineStart - payload.inlineStart) * height(payload) +
    Math.max(0, payload.inlineEnd - paper.inlineEnd) * height(payload) +
    Math.max(0, paper.blockStart - payload.blockStart) * width(payload) +
    Math.max(0, payload.blockEnd - paper.blockEnd) * width(payload);
  if (outsideArea > 0) {
    score += 1200 + outsideArea;
    collisions.push("exits-paper");
  }

  for (const source of context.bounds.sourceRects) {
    if (!rectsOverlap(payload, source, 3)) continue;
    score += 1000 + overlapArea(inflate(payload, 3), source) * 2;
    collisions.push("source-text");
  }
  for (const canonical of context.canonicalBounds) {
    if (!rectsOverlap(payload, canonical, 3)) continue;
    score += 850 + overlapArea(inflate(payload, 3), canonical) * 2;
    collisions.push("canonical-mark");
  }
  for (const placement of context.placed) {
    if (!rectsOverlap(payload, placement.payloadBounds, 6)) continue;
    score += 720 + overlapArea(inflate(payload, 6), placement.payloadBounds) * 3;
    collisions.push(`annotation:${placement.correctionId}`);
  }

  for (const segment of pathSegments(candidate.leader)) {
    for (const source of context.bounds.sourceRects) {
      if (pointInRect(context.anchor, source)) continue;
      if (segmentIntersectsRect(segment[0], segment[1], inflate(source, 1))) {
        score += 90;
        collisions.push("leader-source");
      }
    }
    for (const placement of context.placed) {
      if (segmentIntersectsRect(segment[0], segment[1], inflate(placement.payloadBounds, 2))) {
        score += 420;
        collisions.push(`leader-annotation:${placement.correctionId}`);
      }
    }
  }

  for (const placement of context.placed) {
    if (pathsCross(candidate.leader, placement.leader)) {
      score += 900;
      collisions.push(`leader-crossing:${placement.correctionId}`);
    }
  }
  score += routeLength(candidate.leader) * 0.25;
  if (candidate.leaderRoute === "elbow") score += 3;
  if (context.previous?.candidateKey === candidate.key) score -= 24;

  return {
    ...candidate,
    score: Math.round(score * 100) / 100,
    collisions: [...new Set(collisions)],
  };
}

function candidateOffsets(payload: LogicalRect, lane: AnnotationLane): readonly number[] {
  const extent = lane.startsWith("inline-") ? height(payload) : width(payload);
  const step = Math.max(28, extent + 10);
  return [0, step, -step, step * 2, step * -2];
}

export function generatePlacementCandidates(
  scene: ProofmarkScene,
  geometry: CorrectionGeometry,
  bounds: ProofSheetBounds,
  canonicalBounds: readonly LogicalRect[],
  placed: readonly AnnotationPlacement[],
  previous?: AnnotationPlacement,
  notationLocale?: string,
): PlacementCandidate[] {
  const movable = scene.nodes.filter(isMovable);
  const payload = boundsForNodes(movable);
  const source = combineLogicalRects(geometry.targets.flat());
  if (!payload || !source) return [];
  const anchor = leaderAnchor(scene, source);
  const hasLeader = scene.nodes.some((node) => node.role === "leader");
  const preference = preferenceForLocale(notationLocale);
  const candidates: PlacementCandidate[] = [];

  preference.lanes.forEach((lane, rank) => {
    for (const [slot, inlineOffset] of candidateOffsets(payload, lane).entries()) {
      const desired = laneCenter(lane, source, bounds.text, payload, inlineOffset);
      const payloadCenter = clampCenterToPaper(desired, payload, bounds.paper);
      const payloadBounds = rectAt(payloadCenter, width(payload), height(payload));
      for (const route of routeCandidates(anchor, payloadBounds, lane, hasLeader)) {
        const key = `${lane}:${slot}:${route.route}`;
        candidates.push(
          scoreCandidate(
            {
              key,
              lane,
              level: laneLevel(lane),
              rank,
              payloadBounds,
              payloadCenter,
              leader: route.points,
              leaderRoute: route.route,
            },
            {
              bounds,
              anchor,
              canonicalBounds,
              placed,
              preferredRank: rank,
              ...(previous ? { previous } : {}),
            },
          ),
        );
      }
    }
  });

  return candidates.sort(
    (first, second) =>
      first.score - second.score ||
      first.rank - second.rank ||
      first.key.localeCompare(second.key),
  );
}

function leaderNode(points: readonly LogicalPoint[]): ScenePath | SceneLine | null {
  if (points.length < 2) return null;
  if (points.length === 2) {
    return { type: "line", role: "leader", from: points[0]!, to: points[1]! };
  }
  return {
    type: "path",
    role: "leader",
    commands: points.map((point, index) =>
      index === 0
        ? { type: "move", to: point }
        : { type: "line", to: point },
    ),
  };
}

function applyPlacement(
  scene: ProofmarkScene,
  placement: AnnotationPlacement,
): ProofmarkScene {
  const movable = scene.nodes.filter(isMovable);
  const originalBounds = boundsForNodes(movable);
  if (!originalBounds) return scene;
  const originalCenter = center(originalBounds);
  const nextCenter = center(placement.payloadBounds);
  const delta = {
    inline: nextCenter.inline - originalCenter.inline,
    block: nextCenter.block - originalCenter.block,
  };
  const routedLeader = leaderNode(placement.leader);
  const nodes: SceneNode[] = [];
  let insertedLeader = false;
  for (const node of scene.nodes) {
    if (node.role === "leader") {
      if (!insertedLeader && routedLeader) nodes.push(routedLeader);
      insertedLeader = true;
    } else if (isMovable(node)) {
      nodes.push(shiftNode(node, delta));
    } else {
      nodes.push(node);
    }
  }
  return { ...scene, nodes };
}

function canonicalBoundsForScenes(scenes: readonly ProofmarkScene[]): LogicalRect[] {
  return scenes.flatMap((scene) =>
    scene.nodes.flatMap((node) => {
      if (isMovable(node) || node.role === "leader") return [];
      const bounds = nodeBounds(node);
      return bounds ? [inflate(bounds, 1.5)] : [];
    }),
  );
}

export function createProofSheetBounds(
  viewport: LogicalViewport,
  sourceRects: readonly LogicalRect[],
): ProofSheetBounds {
  const paper: LogicalRect = {
    inlineStart: 0,
    inlineEnd: viewport.inlineSize,
    blockStart: 0,
    blockEnd: viewport.blockSize,
  };
  const text = combineLogicalRects(sourceRects) ?? {
    inlineStart: viewport.inlineSize * 0.2,
    inlineEnd: viewport.inlineSize * 0.8,
    blockStart: viewport.blockSize * 0.35,
    blockEnd: viewport.blockSize * 0.65,
  };
  return { paper, text, sourceRects };
}

export function layoutDebugLanes(bounds: ProofSheetBounds): LayoutDebugLane[] {
  const text = bounds.text;
  const paper = bounds.paper;
  const gap = 6;
  const startSpace = Math.max(0, text.blockStart - paper.blockStart);
  const endSpace = Math.max(0, paper.blockEnd - text.blockEnd);
  const inlineStartSpace = Math.max(0, text.inlineStart - paper.inlineStart);
  const inlineEndSpace = Math.max(0, paper.inlineEnd - text.inlineEnd);
  return [
    {
      lane: "block-start-0",
      rect: {
        inlineStart: text.inlineStart,
        inlineEnd: text.inlineEnd,
        blockStart: Math.max(paper.blockStart, text.blockStart - startSpace / 2),
        blockEnd: Math.max(paper.blockStart, text.blockStart - gap),
      },
    },
    {
      lane: "block-start-1",
      rect: {
        inlineStart: text.inlineStart,
        inlineEnd: text.inlineEnd,
        blockStart: paper.blockStart,
        blockEnd: Math.max(paper.blockStart, text.blockStart - startSpace / 2 - gap),
      },
    },
    {
      lane: "block-end-0",
      rect: {
        inlineStart: text.inlineStart,
        inlineEnd: text.inlineEnd,
        blockStart: Math.min(paper.blockEnd, text.blockEnd + gap),
        blockEnd: Math.min(paper.blockEnd, text.blockEnd + endSpace / 2),
      },
    },
    {
      lane: "block-end-1",
      rect: {
        inlineStart: text.inlineStart,
        inlineEnd: text.inlineEnd,
        blockStart: Math.min(paper.blockEnd, text.blockEnd + endSpace / 2 + gap),
        blockEnd: paper.blockEnd,
      },
    },
    {
      lane: "inline-start-margin",
      rect: {
        inlineStart: paper.inlineStart,
        inlineEnd: Math.max(paper.inlineStart, text.inlineStart - Math.min(gap, inlineStartSpace)),
        blockStart: text.blockStart,
        blockEnd: text.blockEnd,
      },
    },
    {
      lane: "inline-end-margin",
      rect: {
        inlineStart: Math.min(paper.inlineEnd, text.inlineEnd + Math.min(gap, inlineEndSpace)),
        inlineEnd: paper.inlineEnd,
        blockStart: text.blockStart,
        blockEnd: text.blockEnd,
      },
    },
  ];
}

export function layoutProofmarkScenes(
  scenes: readonly ProofmarkScene[],
  geometries: ReadonlyMap<string, CorrectionGeometry>,
  bounds: ProofSheetBounds,
  options: LayoutOptions = {},
): ProofmarkLayoutResult {
  const canonicalBounds = canonicalBoundsForScenes(scenes);
  const placements = new Map<string, AnnotationPlacement>();
  const laidOutScenes: ProofmarkScene[] = [];

  for (const scene of scenes) {
    const geometry = geometries.get(scene.correctionId);
    if (!geometry) {
      laidOutScenes.push(scene);
      continue;
    }
    const candidates = generatePlacementCandidates(
      scene,
      geometry,
      bounds,
      canonicalBounds,
      [...placements.values()],
      options.previousPlacements?.get(scene.correctionId),
      options.notationLocale,
    );
    const chosen = candidates[0];
    if (!chosen) {
      laidOutScenes.push(scene);
      continue;
    }
    const placement: AnnotationPlacement = {
      correctionId: scene.correctionId,
      lane: chosen.lane,
      level: chosen.level,
      candidateKey: chosen.key,
      payloadBounds: chosen.payloadBounds,
      leader: chosen.leader,
      leaderRoute: chosen.leaderRoute,
      score: chosen.score,
      candidates,
    };
    placements.set(scene.correctionId, placement);
    laidOutScenes.push(applyPlacement(scene, placement));
  }

  return {
    scenes: laidOutScenes,
    placements,
    debug: { bounds, lanes: layoutDebugLanes(bounds) },
  };
}
