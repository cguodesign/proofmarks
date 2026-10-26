import {
  logicalPointToPhysical,
  logicalRectToPhysical,
  type LogicalPoint,
  type WritingMode,
} from "./geometry";
import type {
  ProofmarkScene,
  SceneLine,
  ScenePath,
  ScenePathCommand,
  ScenePresentation,
  SceneText,
} from "./scene";
import type { AnnotationPlacement, ProofmarkLayoutResult } from "./layout";
import type { ProofmarksAppearance, ProofmarksMarkStyle } from "./index";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const INK_COLOR = "var(--proofmarks-color, var(--proofmarks-ink, oklch(52% 0.22 28)))";
const EDITORIAL_INK_COLOR =
  "var(--proofmarks-editorial-color, oklch(50% 0.19 31))";
const HALO_COLOR = "var(--proofmarks-halo, transparent)";
const SECOND_PASS_WIDTH = "var(--proofmarks-editorial-second-stroke, 1.05px)";

export function createOverlay(document: Document): SVGSVGElement {
  const overlay = document.createElementNS(SVG_NAMESPACE, "svg");
  overlay.dataset.proofmarksOverlay = "";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.overflow = "visible";
  overlay.style.pointerEvents = "none";
  overlay.style.userSelect = "none";
  overlay.style.setProperty("-webkit-user-select", "none");
  return overlay;
}

function toPhysical(
  point: LogicalPoint,
  writingMode: WritingMode,
  viewportWidth: number,
): { x: number; y: number } {
  return logicalPointToPhysical(point, writingMode, viewportWidth);
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function variation(seed: string, channel: number): number {
  let value = hash(`${seed}:${channel}`);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) / 4294967295) * 2 - 1;
}

function roleVariation(role: SceneLine["role"] | ScenePath["role"]): number {
  if (role === "leader") return 0.72;
  if (role === "notation-mark" || role === "insertion-anchor") return 0.28;
  return 0.38;
}

function editorialPoint(
  point: LogicalPoint,
  seed: string,
  channel: number,
  amplitude: number,
): LogicalPoint {
  return {
    inline: point.inline + variation(seed, channel) * amplitude,
    block: point.block + variation(seed, channel + 1) * amplitude,
  };
}

function pathData(
  commands: readonly ScenePathCommand[],
  writingMode: WritingMode,
  viewportWidth: number,
  appearance: ProofmarksAppearance,
  seed: string,
  amplitude: number,
): string {
  return commands
    .map((command, index) => {
      const channel = index * 8;
      const to = toPhysical(
        appearance === "editorial"
          ? editorialPoint(command.to, seed, channel, amplitude)
          : command.to,
        writingMode,
        viewportWidth,
      );
      if (command.type === "move") return `M ${to.x} ${to.y}`;
      if (command.type === "line") return `L ${to.x} ${to.y}`;
      const control1 = toPhysical(
        appearance === "editorial"
          ? editorialPoint(command.control1, seed, channel + 2, amplitude * 1.2)
          : command.control1,
        writingMode,
        viewportWidth,
      );
      const control2 = toPhysical(
        appearance === "editorial"
          ? editorialPoint(command.control2, seed, channel + 4, amplitude * 1.2)
          : command.control2,
        writingMode,
        viewportWidth,
      );
      return `C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${to.x} ${to.y}`;
    })
    .join(" ");
}

function inkColor(
  appearance: ProofmarksAppearance,
  markStyle?: ProofmarksMarkStyle,
): string {
  if (markStyle?.ink) return "var(--proofmarks-mark-ink)";
  return appearance === "editorial" ? EDITORIAL_INK_COLOR : INK_COLOR;
}

function labelInkColor(
  appearance: ProofmarksAppearance,
  markStyle?: ProofmarksMarkStyle,
): string {
  if (markStyle?.labelInk) return "var(--proofmarks-label-ink)";
  return inkColor(appearance, markStyle);
}

function scaledStrokeWidth(
  width: number,
  markStyle?: ProofmarksMarkStyle,
): string {
  return markStyle?.strokeScale === undefined
    ? `var(--proofmarks-stroke-width, ${width}px)`
    : `${width * markStyle.strokeScale}px`;
}

function scaledSecondPassWidth(markStyle?: ProofmarksMarkStyle): string {
  return markStyle?.strokeScale === undefined
    ? SECOND_PASS_WIDTH
    : `${1.05 * markStyle.strokeScale}px`;
}

function applyStroke(
  element: SVGElement,
  width: string,
  appearance: ProofmarksAppearance,
  markStyle?: ProofmarksMarkStyle,
): void {
  element.setAttribute("fill", "none");
  element.setAttribute("stroke", inkColor(appearance, markStyle));
  element.setAttribute("stroke-width", width);
  element.setAttribute("stroke-linecap", "round");
  element.setAttribute("stroke-linejoin", "round");
  element.setAttribute("vector-effect", "non-scaling-stroke");
}

function appendLine(
  group: SVGGElement,
  item: SceneLine,
  writingMode: WritingMode,
  viewportWidth: number,
  appearance: ProofmarksAppearance,
  seed: string,
  order: number,
  strokeWidth: number,
  markStyle?: ProofmarksMarkStyle,
): void {
  const amplitude = roleVariation(item.role);
  const from = toPhysical(
    appearance === "editorial"
      ? editorialPoint(item.from, seed, 0, amplitude)
      : item.from,
    writingMode,
    viewportWidth,
  );
  const to = toPhysical(
    appearance === "editorial"
      ? editorialPoint(item.to, seed, 2, amplitude)
      : item.to,
    writingMode,
    viewportWidth,
  );
  for (const halo of [true, false]) {
    const line = group.ownerDocument.createElementNS(SVG_NAMESPACE, "line");
    if (halo) line.dataset.proofmarksHaloFor = item.role;
    else line.dataset.proofmarksRole = item.role;
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    applyStroke(
      line,
      halo
        ? `calc(${scaledStrokeWidth(strokeWidth, markStyle)} + 3.5px)`
        : scaledStrokeWidth(strokeWidth, markStyle),
      appearance,
      markStyle,
    );
    if (halo) line.setAttribute("stroke", HALO_COLOR);
    else if (appearance === "editorial") {
      line.setAttribute("pathLength", "1");
      line.classList.add("proofmarks-write-on");
      line.style.setProperty("--proofmarks-draw-delay", `${order * 34}ms`);
    }
    group.append(line);
  }
  if (appearance === "editorial") {
    const second = group.ownerDocument.createElementNS(SVG_NAMESPACE, "line");
    second.dataset.proofmarksSecondPass = item.role;
    const secondFrom = toPhysical(
      editorialPoint(item.from, `${seed}:second`, 0, amplitude * 0.65),
      writingMode,
      viewportWidth,
    );
    const secondTo = toPhysical(
      editorialPoint(item.to, `${seed}:second`, 2, amplitude * 0.65),
      writingMode,
      viewportWidth,
    );
    second.setAttribute("x1", String(secondFrom.x));
    second.setAttribute("y1", String(secondFrom.y));
    second.setAttribute("x2", String(secondTo.x));
    second.setAttribute("y2", String(secondTo.y));
    applyStroke(second, scaledSecondPassWidth(markStyle), appearance, markStyle);
    second.setAttribute("opacity", "0.22");
    group.append(second);
  }
}

function appendPath(
  group: SVGGElement,
  item: ScenePath,
  writingMode: WritingMode,
  viewportWidth: number,
  appearance: ProofmarksAppearance,
  seed: string,
  order: number,
  strokeWidth: number,
  markStyle?: ProofmarksMarkStyle,
): void {
  const amplitude = roleVariation(item.role);
  const d = pathData(
    item.commands,
    writingMode,
    viewportWidth,
    appearance,
    seed,
    amplitude,
  );
  for (const halo of [true, false]) {
    const path = group.ownerDocument.createElementNS(SVG_NAMESPACE, "path");
    if (halo) path.dataset.proofmarksHaloFor = item.role;
    else path.dataset.proofmarksRole = item.role;
    path.setAttribute("d", d);
    applyStroke(
      path,
      halo
        ? `calc(${scaledStrokeWidth(strokeWidth, markStyle)} + 3.5px)`
        : scaledStrokeWidth(strokeWidth, markStyle),
      appearance,
      markStyle,
    );
    if (halo) path.setAttribute("stroke", HALO_COLOR);
    else if (appearance === "editorial") {
      path.setAttribute("pathLength", "1");
      path.classList.add("proofmarks-write-on");
      path.style.setProperty("--proofmarks-draw-delay", `${order * 34}ms`);
    }
    group.append(path);
  }
  if (appearance === "editorial") {
    const second = group.ownerDocument.createElementNS(SVG_NAMESPACE, "path");
    second.dataset.proofmarksSecondPass = item.role;
    second.setAttribute(
      "d",
      pathData(
        item.commands,
        writingMode,
        viewportWidth,
        appearance,
        `${seed}:second`,
        amplitude * 0.65,
      ),
    );
    applyStroke(second, scaledSecondPassWidth(markStyle), appearance, markStyle);
    second.setAttribute("opacity", "0.22");
    group.append(second);
  }
}

function appendText(
  group: SVGGElement,
  item: SceneText,
  writingMode: WritingMode,
  viewportWidth: number,
  appearance: ProofmarksAppearance,
  seed: string,
  order: number,
  presentation?: ScenePresentation,
  markStyle?: ProofmarksMarkStyle,
): void {
  const at = toPhysical(item.at, writingMode, viewportWidth);
  const label = group.ownerDocument.createElementNS(SVG_NAMESPACE, "text");
  label.dataset.proofmarksRole = item.role;
  label.setAttribute("x", String(at.x));
  label.setAttribute("y", String(at.y));
  label.setAttribute("fill", labelInkColor(appearance, markStyle));
  label.setAttribute("stroke", HALO_COLOR);
  label.setAttribute("stroke-width", "3.5");
  label.setAttribute("stroke-linejoin", "round");
  label.setAttribute("paint-order", "stroke fill");
  label.setAttribute("vector-effect", "non-scaling-stroke");
  label.setAttribute(
    "font-size",
    String(
      item.fontSize ??
        (item.role === "inserted-text" || item.role === "replacement-text"
          ? presentation?.payloadFontSize ?? 15
          : presentation?.labelFontSize ?? 13),
    ),
  );
  label.setAttribute(
    "font-weight",
    String(item.fontWeight ?? (appearance === "editorial" ? 600 : 550)),
  );
  label.setAttribute(
    "font-family",
    appearance === "editorial"
      ? 'var(--proofmarks-editorial-font, "Bradley Hand", "Segoe Print", "Hiragino Maru Gothic ProN", cursive)'
      : item.fontFamily ??
        (item.role === "inserted-text" || item.role === "replacement-text"
          ? presentation?.sourceFontFamily
          : presentation?.labelFontFamily) ??
        "var(--proofmarks-label-font, sans-serif)",
  );
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("dominant-baseline", "central");
  if (item.orientation === "vertical-upright") {
    label.setAttribute("writing-mode", "vertical-rl");
    label.setAttribute("text-orientation", "upright");
  }
  if (appearance === "editorial") {
    const angle = variation(seed, 0) * 0.7;
    const driftX = variation(seed, 1) * 0.45;
    const driftY = variation(seed, 2) * 0.55;
    label.setAttribute(
      "transform",
      `translate(${driftX} ${driftY}) rotate(${angle} ${at.x} ${at.y})`,
    );
    label.classList.add("proofmarks-payload-reveal");
    label.style.setProperty("--proofmarks-draw-delay", `${order * 34 + 120}ms`);
  }
  label.textContent = item.text;
  group.append(label);
}

/** Animation effects never become SVG markup, so clones always contain the final ink. */
export function animateOverlay(overlay: SVGSVGElement): () => void {
  const motion = overlay.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (motion?.matches) return () => {};
  const animations: Animation[] = [];
  for (const element of overlay.querySelectorAll<SVGElement>(".proofmarks-write-on, .proofmarks-payload-reveal")) {
    if (!element.animate) continue;
    const stroke = element.classList.contains("proofmarks-write-on");
    const animation = element.animate(
      stroke
        ? [{ strokeDasharray: "1", strokeDashoffset: "1" }, { strokeDasharray: "1", strokeDashoffset: "0" }]
        : [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: stroke ? 420 : 220,
        delay: Number.parseFloat(element.style.getPropertyValue("--proofmarks-draw-delay")) || 0,
        easing: stroke ? "cubic-bezier(.22,1,.36,1)" : "ease-out",
        fill: "backwards",
      },
    );
    animations.push(animation);
  }
  const stop = (): void => {
    animations.forEach((animation) => animation.cancel());
    motion?.removeEventListener("change", stop);
  };
  if (animations.length) {
    motion?.addEventListener("change", stop);
    void Promise.all(animations.map((animation) => animation.finished)).then(stop, stop);
  }
  return stop;
}

function renderDebug(
  overlay: SVGSVGElement,
  scene: ProofmarkScene,
  writingMode: WritingMode,
  viewportWidth: number,
): void {
  if (scene.debugRects.length === 0 && scene.debugPoints.length === 0) return;
  const document = overlay.ownerDocument;
  const group = document.createElementNS(SVG_NAMESPACE, "g");
  group.dataset.proofmarksDebug = "";
  group.setAttribute("fill", "none");
  group.setAttribute("pointer-events", "none");

  for (const item of scene.debugRects) {
    const rect = logicalRectToPhysical(item.rect, writingMode, viewportWidth);
    const element = document.createElementNS(SVG_NAMESPACE, "rect");
    element.dataset.debugRole = item.role;
    element.dataset.rectIndex = String(item.index);
    element.setAttribute("x", String(rect.x));
    element.setAttribute("y", String(rect.y));
    element.setAttribute("width", String(rect.width));
    element.setAttribute("height", String(rect.height));
    element.setAttribute(
      "stroke",
      item.role === "target-rect"
        ? "oklch(55% 0.13 232)"
        : item.role === "target-bounds"
          ? "oklch(61% 0.14 82)"
          : item.role === "referenced-target-rect"
            ? "oklch(58% 0.14 154)"
            : item.role === "referenced-target-bounds"
              ? "oklch(64% 0.15 145)"
              : item.role === "referenced-scene-bounds"
                ? "oklch(59% 0.17 305)"
          : "oklch(48% 0.03 72)",
    );
    element.setAttribute("stroke-width", item.role === "overlay-bounds" ? "1" : "1.25");
    element.setAttribute(
      "stroke-dasharray",
      item.role === "target-rect" || item.role === "referenced-target-rect"
        ? "4 3"
        : "2 4",
    );
    if (item.role === "target-rect" || item.role === "referenced-target-rect") {
      element.setAttribute("fill", "oklch(76% 0.08 232 / 0.1)");
    }
    group.append(element);
  }

  for (const item of scene.debugPoints) {
    const at = toPhysical(item.at, writingMode, viewportWidth);
    const point = document.createElementNS(SVG_NAMESPACE, "circle");
    point.dataset.debugRole = item.role;
    point.setAttribute("cx", String(at.x));
    point.setAttribute("cy", String(at.y));
    point.setAttribute("r", item.role === "anchor" ? "3.5" : "2.5");
    point.setAttribute(
      "fill",
      item.role === "anchor" ? "oklch(61% 0.14 82)" : "oklch(55% 0.13 232)",
    );
    group.append(point);
  }

  overlay.append(group);
}

function appendDebugRect(
  group: SVGGElement,
  rect: Parameters<typeof logicalRectToPhysical>[0],
  writingMode: WritingMode,
  viewportWidth: number,
  role: string,
  attributes: Record<string, string> = {},
): void {
  const physical = logicalRectToPhysical(rect, writingMode, viewportWidth);
  const element = group.ownerDocument.createElementNS(SVG_NAMESPACE, "rect");
  element.dataset.layoutRole = role;
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(`data-${name}`, value);
  }
  element.setAttribute("x", String(physical.x));
  element.setAttribute("y", String(physical.y));
  element.setAttribute("width", String(physical.width));
  element.setAttribute("height", String(physical.height));
  element.setAttribute("fill", "none");
  element.setAttribute(
    "stroke",
    role === "paper-bounds"
      ? "oklch(45% 0.03 75)"
      : role === "text-bounds"
        ? "oklch(58% 0.14 154)"
        : role === "chosen-candidate"
          ? "oklch(62% 0.18 28)"
          : role === "candidate"
            ? "oklch(60% 0.12 245 / 0.42)"
            : "oklch(64% 0.09 82 / 0.48)",
  );
  element.setAttribute("stroke-width", role === "chosen-candidate" ? "1.5" : "1");
  element.setAttribute("stroke-dasharray", role === "chosen-candidate" ? "none" : "3 4");
  group.append(element);
}

function renderLayoutDebug(
  overlay: SVGSVGElement,
  layout: Pick<ProofmarkLayoutResult, "placements" | "debug">,
  writingMode: WritingMode,
  viewportWidth: number,
): void {
  const group = overlay.ownerDocument.createElementNS(SVG_NAMESPACE, "g");
  group.dataset.proofmarksLayoutDebug = "";
  group.setAttribute("pointer-events", "none");
  appendDebugRect(
    group,
    layout.debug.bounds.paper,
    writingMode,
    viewportWidth,
    "paper-bounds",
  );
  appendDebugRect(
    group,
    layout.debug.bounds.text,
    writingMode,
    viewportWidth,
    "text-bounds",
  );
  for (const lane of layout.debug.lanes) {
    appendDebugRect(group, lane.rect, writingMode, viewportWidth, "lane", {
      lane: lane.lane,
    });
  }
  for (const placement of layout.placements.values()) {
    for (const candidate of placement.candidates) {
      appendDebugRect(
        group,
        candidate.payloadBounds,
        writingMode,
        viewportWidth,
        candidate.key === placement.candidateKey ? "chosen-candidate" : "candidate",
        {
          "correction-id": placement.correctionId,
          lane: candidate.lane,
          score: String(candidate.score),
          collisions: candidate.collisions.join(","),
        },
      );
    }
  }
  overlay.prepend(group);
}

export function renderScene(
  overlay: SVGSVGElement,
  scenes: readonly ProofmarkScene[],
  writingMode: WritingMode,
  viewportWidth: number,
  viewportHeight: number,
  layout?: Pick<ProofmarkLayoutResult, "placements" | "debug">,
  appearance: ProofmarksAppearance = "technical",
  markStyle?: ProofmarksMarkStyle,
): void {
  overlay.replaceChildren();
  overlay.dataset.writingMode = writingMode;
  overlay.dataset.proofmarksAppearance = appearance;
  overlay.dataset.clientRectCount = String(
    scenes.reduce((count, scene) => count + scene.rectCount, 0),
  );
  overlay.dataset.fidelity = scenes.map((scene) => scene.fidelity).join(",");
  overlay.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`);
  overlay.style.removeProperty("--proofmarks-mark-ink");
  overlay.style.removeProperty("--proofmarks-label-ink");
  overlay.style.removeProperty("--proofmarks-mark-stroke-scale");
  overlay.style.removeProperty("--proofmarks-mark-opacity");
  if (markStyle?.ink) overlay.style.setProperty("--proofmarks-mark-ink", markStyle.ink);
  if (markStyle?.labelInk) {
    overlay.style.setProperty("--proofmarks-label-ink", markStyle.labelInk);
  }
  if (markStyle?.strokeScale !== undefined) {
    overlay.style.setProperty(
      "--proofmarks-mark-stroke-scale",
      String(markStyle.strokeScale),
    );
  }
  if (markStyle?.opacity !== undefined) {
    overlay.style.setProperty("--proofmarks-mark-opacity", String(markStyle.opacity));
  }


  if (
    layout &&
    scenes.some(
      (scene) => scene.debugRects.length > 0 || scene.debugPoints.length > 0,
    )
  ) {
    renderLayoutDebug(overlay, layout, writingMode, viewportWidth);
  }

  for (const scene of scenes) {
    renderDebug(overlay, scene, writingMode, viewportWidth);
    const group = overlay.ownerDocument.createElementNS(SVG_NAMESPACE, "g");
    group.dataset.correctionId = scene.correctionId;
    group.dataset.operation = scene.operation;
    group.dataset.notationId = scene.notationId;
    group.dataset.fidelity = scene.fidelity;
    group.dataset.scale = scene.scale;
    group.dataset.appearance = appearance;
    if (markStyle?.opacity !== undefined) {
      group.setAttribute("opacity", "var(--proofmarks-mark-opacity)");
    }
    const placement: AnnotationPlacement | undefined = layout?.placements.get(
      scene.correctionId,
    );
    if (placement) {
      group.dataset.layoutLane = placement.lane;
      group.dataset.layoutLevel = String(placement.level);
      group.dataset.layoutCandidate = placement.candidateKey;
      group.dataset.layoutScore = String(placement.score);
      group.dataset.leaderRoute = placement.leaderRoute;
    }

    for (const [index, node] of scene.nodes.entries()) {
      const seed = `${scene.correctionId}:${node.role}:${scene.notationId}:${index}`;
      if (node.type === "line") {
        appendLine(
          group,
          node,
          writingMode,
          viewportWidth,
          appearance,
          seed,
          index,
          scene.presentation?.strokeWidth ?? 1.75,
          markStyle,
        );
      } else if (node.type === "path") {
        appendPath(
          group,
          node,
          writingMode,
          viewportWidth,
          appearance,
          seed,
          index,
          scene.presentation?.strokeWidth ?? 1.75,
          markStyle,
        );
      } else {
        appendText(
          group,
          node,
          writingMode,
          viewportWidth,
          appearance,
          seed,
          index,
          scene.presentation,
          markStyle,
        );
      }
    }
    overlay.append(group);
  }
}
