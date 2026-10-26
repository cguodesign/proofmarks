import {
  getCorrectionTargets,
  isTextPointTarget,
  orderCorrectionsByReference,
  resolveCorrectionReference,
  validateCorrections,
  type Correction,
} from "@proofmarks/core";
import {
  classifyCorrectionScale,
  measureRangeGeometry,
  type CorrectionGeometry,
  type WritingMode,
} from "./geometry";
import {
  createProofSheetBounds,
  layoutProofmarkScenes,
  type AnnotationPlacement,
} from "./layout";
import type { NotationPack } from "./notation";
import {
  createTextPointRange,
  createTextRange,
  getSourceText,
  getSourceTextNodes,
} from "./range";
import {
  createEmptyScene,
  createGenericScene,
  technicalNotationPack,
} from "./scene";
import { animateOverlay, createOverlay, renderScene } from "./svg";
import { getRenderScheduler } from "./scheduler";
import type { ProofmarkScene } from "./scene";
import type { RenderContext } from "./notation";

export type ProofmarksOptions = {
  corrections: readonly Correction[];
  notation: NotationPack;
  appearance?: ProofmarksAppearance;
  animate?: boolean;
  showProofmarks?: boolean;
  markStyle?: ProofmarksMarkStyle;
  debug?: boolean;
  onIssue?: (issue: ProofmarksIssue) => void;
  onRender?: (info: ProofmarksRenderInfo) => void;
};

export type ProofmarksAppearance = "technical" | "editorial";

export type ProofmarksMarkStyle = {
  ink?: string;
  strokeScale?: number;
  opacity?: number;
  labelInk?: string;
};

export type ProofmarksIssue =
  | {
      code: "invalid-corrections";
      correctionId?: string;
      message: string;
    }
  | {
      code: "insufficient-room";
      correctionId: string;
      /** What the best available label position still overlaps. */
      collisions: readonly ProofmarksRoomCollision[];
      message: string;
    }
  | {
      code: "unsupported-writing-mode";
      correctionId: string;
      message: string;
    }
  | {
      /** Marks render, but no notation pack has been verified for this direction. */
      code: "unverified-direction";
      direction: "rtl";
      message: string;
    }
  | {
      code:
        | "invalid-mark-style-color"
        | "invalid-mark-style-value"
        | "mark-style-value-clamped";
      property: "markStyle" | keyof ProofmarksMarkStyle;
      appliedValue?: string | number;
      message: string;
    };

export type ProofmarksRoomCollision = "source-text" | "exits-paper" | "annotation";
const ROOM_COLLISIONS: readonly ProofmarksRoomCollision[] = ["source-text", "exits-paper", "annotation"];

export type ProofmarksInstance = {
  render(): void;
  replay(): void;
  update(options: ProofmarksOptions): void;
  destroy(): void;
};

export { createTextPointRange, createTextRange, getSourceText, getSourceTextLength, offsetsFromSelection } from "./range";
export {
  classifyCorrectionScale,
  combineLogicalRects,
  logicalPointToPhysical,
  logicalRectToPhysical,
  normalizeWritingMode,
  physicalRectToLogical,
  physicalRectsToLogical,
  type CorrectionGeometry,
  type CorrectionScale,
  type LogicalPoint,
  type LogicalRect,
  type LogicalViewport,
  type PhysicalRect,
  type SourceTypography,
  type WritingMode,
} from "./geometry";
export {
  createProofSheetBounds,
  generatePlacementCandidates,
  layoutDebugLanes,
  layoutProofmarkScenes,
  rectsOverlap,
  segmentIntersectsRect,
  type AnnotationLane,
  type AnnotationPlacement,
  type LayoutDebugLane,
  type LayoutOptions,
  type LeaderRoute,
  type PlacementCandidate,
  type ProofmarkLayoutResult,
  type ProofSheetBounds,
  type RepresentationLevel,
} from "./layout";
export type {
  NotationPack,
  NotationSupport,
  RenderContext,
  ResolvedCorrectionContext,
} from "./notation";
export {
  canonicalLabelSize,
  canonicalPayloadSize,
  canonicalPresentation,
  canonicalStrokeWidth,
  createEmptyScene,
  createGenericScene,
  createRelationSceneDebug,
  createSceneDebug,
  getSceneBounds,
  sourceEm,
  sourceLineHeight,
  sourceTextFamily,
  technicalNotationPack,
  type ProofmarkScene,
  type SceneFidelity,
  type SceneLine,
  type SceneNode,
  type ScenePath,
  type ScenePathCommand,
  type ScenePresentation,
  type SceneRole,
  type SceneDebugPoint,
  type SceneDebugRect,
  type SceneText,
} from "./scene";

export function buildNotationScene(
  notationPack: NotationPack,
  correction: Correction,
  geometry: CorrectionGeometry,
  context: RenderContext,
): ProofmarkScene {
  if (!notationPack.writingModes.includes(geometry.writingMode)) {
    return createEmptyScene(
      correction,
      geometry,
      notationPack.id,
      "unsupported",
    );
  }
  context = { ...context, locale: notationPack.locale };
  return notationPack.supports(correction, context)
    ? notationPack.buildScene(correction, geometry, context)
    : createGenericScene(
        correction,
        geometry,
        context,
        notationPack.id,
        "generic-fallback",
      );
}

function resolveGeometry(
  container: HTMLElement,
  correction: Exclude<Correction, { type: "cancel-correction" }>,
): CorrectionGeometry {
  const measured = getCorrectionTargets(correction).map((target) => {
    const range = isTextPointTarget(target)
      ? createTextPointRange(container, target)
      : createTextRange(container, target);
    return measureRangeGeometry(range, container);
  });
  const first = measured[0];
  if (!first) throw new Error(`Correction ${correction.id} has no target geometry.`);
  const targets = measured.map((geometry) => geometry.rects);
  return {
    writingMode: first.writingMode,
    viewportWidth: first.viewportWidth,
    viewportHeight: first.viewportHeight,
    viewport: first.viewport,
    typography: first.typography,
    targets,
    scale: classifyCorrectionScale(targets, first.viewport),
  };
}

export class InvalidCorrectionsError extends Error {
  readonly issue: Extract<ProofmarksIssue, { code: "invalid-corrections" }>;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "InvalidCorrectionsError";
    const correctionId = cause && typeof cause === "object" && "correctionId" in cause &&
      typeof cause.correctionId === "string" ? cause.correctionId : undefined;
    this.issue = { code: "invalid-corrections", message: this.message, ...(correctionId ? { correctionId } : {}) };
  }
}

function validateSourceCorrections(container: HTMLElement, corrections: readonly Correction[]): void {
  try {
    validateSourceCorrectionsUnsafe(container, corrections);
  } catch (error) {
    throw new InvalidCorrectionsError(error);
  }
}

function validateSourceCorrectionsUnsafe(
  container: HTMLElement,
  corrections: readonly Correction[],
): void {
  const sourceText = getSourceText(container);
  validateCorrections(corrections, sourceText.length);
  for (const correction of corrections) {
    if (
      correction.type === "decrease-spacing" &&
      !/^\s+$/u.test(sourceText.slice(correction.target.start, correction.target.end))
    ) {
      throw Object.assign(new RangeError(
        `Decrease-spacing correction ${correction.id} must target existing whitespace only.`,
      ), { correctionId: correction.id });
    }
  }
}

const MIN_STROKE_SCALE = 0.75;
const MAX_STROKE_SCALE = 1.5;

function isValidCssColor(document: Document, value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const css = document.defaultView?.CSS;
  if (css?.supports) return css.supports("color", value);
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = value;
  return probe.style.color.length > 0;
}

function normalizeMarkStyle(
  document: Document,
  value: ProofmarksMarkStyle | undefined,
  onIssue?: (issue: ProofmarksIssue) => void,
): ProofmarksMarkStyle | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    onIssue?.({
      code: "invalid-mark-style-value",
      property: "markStyle",
      message: "markStyle must be an object. The default presentation was used.",
    });
    return undefined;
  }

  const normalized: ProofmarksMarkStyle = {};
  for (const property of ["ink", "labelInk"] as const) {
    const color = value[property];
    if (color === undefined) continue;
    if (!isValidCssColor(document, color)) {
      onIssue?.({
        code: "invalid-mark-style-color",
        property,
        message: `markStyle.${property} must be a valid CSS color. The default ink was used.`,
      });
      continue;
    }
    normalized[property] = color.trim();
  }

  if (value.strokeScale !== undefined) {
    if (typeof value.strokeScale !== "number" || !Number.isFinite(value.strokeScale)) {
      onIssue?.({
        code: "invalid-mark-style-value",
        property: "strokeScale",
        appliedValue: 1,
        message: "markStyle.strokeScale must be a finite number. The default value 1 was used.",
      });
    } else {
      const strokeScale = Math.min(
        MAX_STROKE_SCALE,
        Math.max(MIN_STROKE_SCALE, value.strokeScale),
      );
      normalized.strokeScale = strokeScale;
      if (strokeScale !== value.strokeScale) {
        onIssue?.({
          code: "mark-style-value-clamped",
          property: "strokeScale",
          appliedValue: strokeScale,
          message: `markStyle.strokeScale was clamped to ${strokeScale}; the supported range is ${MIN_STROKE_SCALE}–${MAX_STROKE_SCALE}.`,
        });
      }
    }
  }

  if (value.opacity !== undefined) {
    if (typeof value.opacity !== "number" || !Number.isFinite(value.opacity)) {
      onIssue?.({
        code: "invalid-mark-style-value",
        property: "opacity",
        appliedValue: 1,
        message: "markStyle.opacity must be a finite number. The default value 1 was used.",
      });
    } else {
      const opacity = Math.min(1, Math.max(0, value.opacity));
      normalized.opacity = opacity;
      if (opacity !== value.opacity) {
        onIssue?.({
          code: "mark-style-value-clamped",
          property: "opacity",
          appliedValue: opacity,
          message: `markStyle.opacity was clamped to ${opacity}; the supported range is 0–1.`,
        });
      }
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function markStylesEqual(
  left: ProofmarksMarkStyle | undefined,
  right: ProofmarksMarkStyle | undefined,
): boolean {
  return left?.ink === right?.ink &&
    left?.strokeScale === right?.strokeScale &&
    left?.opacity === right?.opacity &&
    left?.labelInk === right?.labelInk;
}

function correctionValuesKey(corrections: readonly Correction[]): string {
  return JSON.stringify(corrections.map((correction) => [
    correction.id,
    correction.type,
    correction.type === "cancel-correction"
      ? correction.target.correctionId
      : getCorrectionTargets(correction).map((target) =>
          isTextPointTarget(target) ? [target.kind, target.offset] : [target.kind, target.start, target.end]),
    correction.type === "insert" ? correction.content
      : correction.type === "replace" ? correction.replacement : null,
  ]));
}

export function createProofmarks(
  container: HTMLElement,
  options: ProofmarksOptions,
): ProofmarksInstance {
  const view = container.ownerDocument.defaultView;
  if (!view) throw new Error("Proofmarks requires a browser document.");
  validateSourceCorrections(container, options.corrections);
  const initialMarkStyle = normalizeMarkStyle(
    container.ownerDocument,
    options.markStyle,
    options.onIssue,
  );

  const originalInlinePosition = container.style.position;
  const originalRootAttribute = container.getAttribute("data-proofmarks-root");
  const changedPosition = view.getComputedStyle(container).position === "static";
  if (changedPosition) container.style.position = "relative";
  container.dataset.proofmarksRoot = "";

  const overlay = createOverlay(container.ownerDocument);
  container.append(overlay);

  let destroyed = false;
  let renderVersion = 0;
  const scheduler = getRenderScheduler(container.ownerDocument);
  let measuredSize = { width: 0, height: 0, vertical: false };
  let measuredText = "";
  let renderedSource: string | null = "";
  let correctionsKey = correctionValuesKey(options.corrections);
  let hasAnimated = false;
  let motionVersion = 0;
  let stopMotion = (): void => {};
  let invalidMessage: string | undefined;
  let currentOptions = { ...options, markStyle: initialMarkStyle };
  let reportedIssues = new Set<string>();
  let reportedDirection = false;
  let previousPlacements = new Map<string, AnnotationPlacement>();

  const applyOverlayVisibility = (): void => {
    const visible = currentOptions.showProofmarks ?? true;
    overlay.style.visibility = visible ? "visible" : "hidden";
    overlay.dataset.proofmarksVisible = String(visible);
  };

  const ensureOverlay = (): void => {
    if (overlay.parentNode !== container) container.append(overlay);
  };

  const reportInvalid = (error: InvalidCorrectionsError): void => {
    if (invalidMessage !== error.message) currentOptions.onIssue?.(error.issue);
    invalidMessage = error.message;
  };

  // Marks drawn for different text would point at the wrong words.
  const clearStaleOverlay = (): void => {
    if (renderedSource === null || renderedSource === getSourceText(container)) return;
    renderedSource = null;
    ++motionVersion;
    stopMotion();
    overlay.replaceChildren();
    overlay.dataset.fidelity = "";
    reportedIssues = new Set();
    previousPlacements = new Map();
  };

  const replay = (): void => {
    if (destroyed) return;
    const version = ++motionVersion;
    stopMotion();
    if (currentOptions.animate === false || currentOptions.appearance !== "editorial") return;
    scheduler.effect(() => {
      if (!destroyed && version === motionVersion) stopMotion = animateOverlay(overlay);
    });
  };

  const prepare = (): (() => void) | undefined => {
    if (destroyed) return;
    const version = ++renderVersion;
    try {
      validateSourceCorrections(container, currentOptions.corrections);
    } catch (error) {
      if (!(error instanceof InvalidCorrectionsError)) throw error;
      return () => {
        if (destroyed || version !== renderVersion) return;
        ensureOverlay();
        clearStaleOverlay();
        reportInvalid(error);
      };
    }
    invalidMessage = undefined;
    const source = getSourceText(container);
    const textLength = source.length;
    const rect = container.getBoundingClientRect();
    let writingMode: WritingMode = "horizontal-tb";
    let viewportWidth = rect.width;
    let viewportHeight = rect.height;
    const notationPack = currentOptions.notation;
    const debug = currentOptions.debug ?? false;
    const ordered = orderCorrectionsByReference(currentOptions.corrections);
    let measurementMs = 0;
    let sceneBuildMs = 0;
    const resolved = new Map<
      string,
      { correction: Correction; geometry: CorrectionGeometry; scene: ProofmarkScene }
    >();
    const geometries = new Map<string, CorrectionGeometry>();

    const scenes = ordered.map((correction) => {
      const referenced = correction.type === "cancel-correction"
        ? resolved.get(
            resolveCorrectionReference(correction, currentOptions.corrections).id,
          )
        : undefined;
      if (correction.type === "cancel-correction" && !referenced) {
        throw new Error(
          `Referenced correction ${correction.target.correctionId} was not resolved before ${correction.id}.`,
        );
      }
      let geometry: CorrectionGeometry;
      if (correction.type === "cancel-correction") {
        geometry = referenced!.geometry;
      } else {
        const measurementStartedAt = view.performance.now();
        geometry = resolveGeometry(container, correction);
        measurementMs += view.performance.now() - measurementStartedAt;
      }
      writingMode = geometry.writingMode;
      viewportWidth = geometry.viewportWidth;
      viewportHeight = geometry.viewportHeight;
      const context: RenderContext = {
        debug,
        ...(referenced
          ? {
              referencedCorrection: {
                correction: referenced.correction,
                targetGeometry: referenced.geometry,
                scene: referenced.scene,
              },
            }
          : {}),
      };
      const sceneStartedAt = view.performance.now();
      const scene = buildNotationScene(notationPack, correction, geometry, context);
      sceneBuildMs += view.performance.now() - sceneStartedAt;
      resolved.set(correction.id, { correction, geometry, scene });
      geometries.set(correction.id, geometry);
      return scene;
    });

    const sourceMeasurementStartedAt = view.performance.now();
    const sourceGeometry = textLength > 0
      ? measureRangeGeometry(
          createTextRange(container, {
            kind: "text-range",
            start: 0,
            end: textLength,
          }),
          container,
        )
      : null;
    measurementMs += view.performance.now() - sourceMeasurementStartedAt;
    if (sourceGeometry) {
      writingMode = sourceGeometry.writingMode;
      viewportWidth = sourceGeometry.viewportWidth;
      viewportHeight = sourceGeometry.viewportHeight;
    }
    const viewport = sourceGeometry?.viewport ??
      (writingMode === "vertical-rl"
        ? { inlineSize: viewportHeight, blockSize: viewportWidth }
        : { inlineSize: viewportWidth, blockSize: viewportHeight });
    const bounds = createProofSheetBounds(
      viewport,
      sourceGeometry?.rects ?? geometries.values().next().value?.targets.flat() ?? [],
    );
    const layoutStartedAt = view.performance.now();
    const layout = layoutProofmarkScenes(scenes, geometries, bounds, {
      previousPlacements,
      notationLocale: notationPack.locale,
    });
    const layoutMs = view.performance.now() - layoutStartedAt;
    measuredSize = { width: viewportWidth, height: viewportHeight, vertical: writingMode === "vertical-rl" };
    measuredText = textLayoutKey();
    const rtl = scenes.length > 0 && view.getComputedStyle(container).direction === "rtl";
    return () => {
      if (destroyed || version !== renderVersion) return;
      ensureOverlay();
      applyOverlayVisibility();
      renderedSource = source;
      previousPlacements = new Map(layout.placements);
      ++motionVersion;
      stopMotion();
      const sceneRenderStartedAt = view.performance.now();
      renderScene(
        overlay,
        layout.scenes,
        writingMode,
        viewportWidth,
        viewportHeight,
        layout,
        currentOptions.appearance ?? "technical",
        currentOptions.markStyle,
      );
      const sceneRenderMs = view.performance.now() - sceneRenderStartedAt;
      overlay.dataset.proofmarksMeasurementMs = measurementMs.toFixed(3);
      overlay.dataset.proofmarksSceneBuildMs = sceneBuildMs.toFixed(3);
      overlay.dataset.proofmarksLayoutMs = layoutMs.toFixed(3);
      overlay.dataset.proofmarksSceneRenderMs = sceneRenderMs.toFixed(3);
      overlay.dataset.proofmarksCandidateCount = String(
        [...layout.placements.values()].reduce(
          (total, placement) => total + placement.candidates.length,
          0,
        ),
      );
      if (!hasAnimated && scenes.length > 0 && currentOptions.appearance === "editorial") {
        hasAnimated = true;
        replay();
      }
      currentOptions.onRender?.({
        fidelity: scenes.map((scene) => scene.fidelity),
        fallbackCount: scenes.filter((scene) => scene.fidelity === "generic-fallback").length,
        layoutMs,
      });
      const nextIssues = new Set<string>();
      for (const placement of layout.placements.values()) {
        const candidateCollisions = placement.candidates.find((candidate) => candidate.key === placement.candidateKey)?.collisions ?? [];
        const collisions = ROOM_COLLISIONS.filter((kind) => candidateCollisions.some((collision) =>
          kind === "annotation" ? collision.startsWith("annotation:") : collision === kind));
        if (!collisions.length) continue;
        const key = `${placement.correctionId}:insufficient-room`;
        nextIssues.add(key);
        if (!reportedIssues.has(key)) currentOptions.onIssue?.({
          code: "insufficient-room",
          correctionId: placement.correctionId,
          collisions,
          message: `Annotation ${placement.correctionId} has insufficient room (${collisions.join(", ")}). Add block padding (start with 44px), increase line-height, or show fewer corrections.`,
        });
      }
      for (const scene of scenes) {
        if (scene.fidelity !== "unsupported") continue;
        const key = `${scene.correctionId}:unsupported-writing-mode`;
        nextIssues.add(key);
        if (!reportedIssues.has(key)) {
          currentOptions.onIssue?.({
            code: "unsupported-writing-mode",
            correctionId: scene.correctionId,
            message: `${notationPack.displayName} does not support ${writingMode}. No proofmark was rendered for correction ${scene.correctionId}.`,
          });
        }
      }
      reportedIssues = nextIssues;
      if (rtl && !reportedDirection) {
        reportedDirection = true;
        currentOptions.onIssue?.({
          code: "unverified-direction",
          direction: "rtl",
          message: `${notationPack.displayName} has not been verified for right-to-left text. Marks follow the measured glyphs, but stroke direction and label placement are not mirrored.`,
        });
      }
    };
  };

  // Responsive type can move glyphs inside an unchanged box, so compare every text fragment
  // (not just their union): an inline size swap can keep the overall extent identical.
  const textLayoutKey = (): string => {
    const nodes = getSourceTextNodes(container);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return "";
    const range = container.ownerDocument.createRange();
    range.setStart(first, 0);
    range.setEnd(last, last.data.length);
    const box = container.getBoundingClientRect();
    const round = (value: number): number => Math.round(value * 2) / 2;
    return Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 || rect.height > 0)
      .map((rect) => [rect.left - box.left, rect.top - box.top, rect.width, rect.height].map(round).join(","))
      .join(";");
  };
  const layoutChanged = (): boolean => {
    const rect = container.getBoundingClientRect();
    return Math.abs(rect.width - measuredSize.width) > 0.5 ||
      Math.abs(rect.height - measuredSize.height) > 0.5 ||
      textLayoutKey() !== measuredText;
  };
  const job = { element: container, prepare, size: () => measuredSize, layoutChanged };
  const render = (): void => {
    scheduler.cancel(job);
    prepare()?.();
  };
  const scheduleRender = (): void => {
    if (!destroyed) scheduler.schedule(job);
  };
  const isSourceMutation = (record: MutationRecord): boolean =>
    !overlay.contains(record.target) && !(record.type === "childList" &&
      [...record.addedNodes, ...record.removedNodes].every((node) => node === overlay));

  const mutationObserver = new view.MutationObserver((records) => {
    if (!records.some(isSourceMutation)) return;
    scheduleRender();
  });
  mutationObserver.observe(container, {
    attributes: true,
    attributeFilter: ["class", "style"],
    characterData: true,
    childList: true,
    subtree: true,
  });

  render();
  const unregister = scheduler.register(job);

  return {
    render,
    replay,
    update(nextOptions): void {
      if (destroyed) return;
      ensureOverlay();
      try {
        validateSourceCorrections(container, nextOptions.corrections);
      } catch (error) {
        clearStaleOverlay();
        throw error;
      }
      const nextMarkStyle = normalizeMarkStyle(
        container.ownerDocument,
        nextOptions.markStyle,
        nextOptions.onIssue,
      );
      const nextCorrectionsKey = correctionValuesKey(nextOptions.corrections);
      const sourceMutated = mutationObserver.takeRecords().some(isSourceMutation);
      const sourceChanged = renderedSource !== getSourceText(container) || sourceMutated;
      const sameRendering = !sourceChanged &&
        currentOptions.notation === nextOptions.notation &&
        correctionsKey === nextCorrectionsKey &&
        (currentOptions.appearance ?? "technical") ===
          (nextOptions.appearance ?? "technical") &&
        (currentOptions.debug ?? false) === (nextOptions.debug ?? false) &&
        markStylesEqual(currentOptions.markStyle, nextMarkStyle);
      currentOptions = { ...nextOptions, markStyle: nextMarkStyle };
      correctionsKey = nextCorrectionsKey;
      if (currentOptions.animate === false) {
        ++motionVersion;
        stopMotion();
      }
      if ((overlay.dataset.proofmarksVisible === "true") !== (currentOptions.showProofmarks ?? true)) applyOverlayVisibility();
      if (sameRendering) return;
      reportedIssues = new Set();
      render();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      ++motionVersion;
      stopMotion();
      unregister();
      mutationObserver.disconnect();
      overlay.remove();
      if (changedPosition) container.style.position = originalInlinePosition;
      if (originalRootAttribute === null) delete container.dataset.proofmarksRoot;
      else container.setAttribute("data-proofmarks-root", originalRootAttribute);
    },
  };
}

/** Measurements and representation choices for a completed render. */
export type ProofmarksRenderInfo = {
  fidelity: readonly ("reference-based" | "generic-fallback" | "unsupported" | "technical")[];
  fallbackCount: number;
  layoutMs: number;
};
