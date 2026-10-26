export type WritingMode = "horizontal-tb" | "vertical-rl";

export type PhysicalRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LogicalPoint = {
  inline: number;
  block: number;
};

export type LogicalRect = {
  inlineStart: number;
  inlineEnd: number;
  blockStart: number;
  blockEnd: number;
};

export type LogicalViewport = {
  inlineSize: number;
  blockSize: number;
};

export type MeasuredGeometry = {
  writingMode: WritingMode;
  viewportWidth: number;
  viewportHeight: number;
  viewport: LogicalViewport;
  rects: LogicalRect[];
  /** Browser-resolved source typography used for proportional mark geometry. */
  typography: SourceTypography;
};

export type SourceTypography = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
};

export type CorrectionScale = "inline" | "phrase" | "block";

export type CorrectionGeometry = Omit<MeasuredGeometry, "rects" | "typography"> & {
  /** One resolved rect collection per semantic target. */
  targets: LogicalRect[][];
  scale: CorrectionScale;
  /** Optional only so existing notation-pack test fixtures remain lightweight. */
  typography?: SourceTypography;
};

function finiteCssLength(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeWritingMode(value: string): WritingMode {
  return value === "vertical-rl" ? "vertical-rl" : "horizontal-tb";
}

export function physicalRectToLogical(
  rect: PhysicalRect,
  writingMode: WritingMode,
  viewportWidth: number,
): LogicalRect {
  if (writingMode === "vertical-rl") {
    return {
      inlineStart: rect.y,
      inlineEnd: rect.y + rect.height,
      blockStart: viewportWidth - (rect.x + rect.width),
      blockEnd: viewportWidth - rect.x,
    };
  }

  return {
    inlineStart: rect.x,
    inlineEnd: rect.x + rect.width,
    blockStart: rect.y,
    blockEnd: rect.y + rect.height,
  };
}

export function physicalRectsToLogical(
  rects: readonly PhysicalRect[],
  writingMode: WritingMode,
  viewportWidth: number,
): LogicalRect[] {
  return rects.map((rect) =>
    physicalRectToLogical(rect, writingMode, viewportWidth),
  );
}

export function combineLogicalRects(
  rects: readonly LogicalRect[],
): LogicalRect | null {
  if (rects.length === 0) return null;

  return rects.reduce<LogicalRect>(
    (bounds, rect) => ({
      inlineStart: Math.min(bounds.inlineStart, rect.inlineStart),
      inlineEnd: Math.max(bounds.inlineEnd, rect.inlineEnd),
      blockStart: Math.min(bounds.blockStart, rect.blockStart),
      blockEnd: Math.max(bounds.blockEnd, rect.blockEnd),
    }),
    { ...rects[0]! },
  );
}

export function logicalRectToPhysical(
  rect: LogicalRect,
  writingMode: WritingMode,
  viewportWidth: number,
): PhysicalRect {
  if (writingMode === "vertical-rl") {
    return {
      x: viewportWidth - rect.blockEnd,
      y: rect.inlineStart,
      width: rect.blockEnd - rect.blockStart,
      height: rect.inlineEnd - rect.inlineStart,
    };
  }

  return {
    x: rect.inlineStart,
    y: rect.blockStart,
    width: rect.inlineEnd - rect.inlineStart,
    height: rect.blockEnd - rect.blockStart,
  };
}

export function logicalPointToPhysical(
  point: LogicalPoint,
  writingMode: WritingMode,
  viewportWidth: number,
): { x: number; y: number } {
  return writingMode === "vertical-rl"
    ? { x: viewportWidth - point.block, y: point.inline }
    : { x: point.inline, y: point.block };
}

export function measureRangeGeometry(
  range: Range,
  container: HTMLElement,
): MeasuredGeometry {
  const containerRect = container.getBoundingClientRect();
  const writingMode = normalizeWritingMode(
    container.ownerDocument.defaultView?.getComputedStyle(container).writingMode ??
      "horizontal-tb",
  );
  const computedStyle = container.ownerDocument.defaultView?.getComputedStyle(container);
  const fontSize = finiteCssLength(computedStyle?.fontSize ?? "") ?? 16;
  const lineHeight = finiteCssLength(computedStyle?.lineHeight ?? "") ?? fontSize * 1.2;
  const viewportWidth = containerRect.width;
  const viewportHeight = containerRect.height;
  let sourceRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );
  if (range.collapsed && sourceRects.length === 0) {
    const caretRect = measureCollapsedRange(range, writingMode);
    if (caretRect) sourceRects = [caretRect];
  }

  const physicalRects = sourceRects
    .filter((rect) => rect.width > 0 || rect.height > 0)
    .map((rect) => ({
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
    }));
  const rects = physicalRectsToLogical(
    physicalRects,
    writingMode,
    viewportWidth,
  );

  return {
    writingMode,
    viewportWidth,
    viewportHeight,
    viewport:
      writingMode === "vertical-rl"
        ? { inlineSize: viewportHeight, blockSize: viewportWidth }
        : { inlineSize: viewportWidth, blockSize: viewportHeight },
    rects,
    typography: {
      fontSize,
      lineHeight,
      fontFamily: computedStyle?.fontFamily ?? "serif",
    },
  };
}

function measureCollapsedRange(
  range: Range,
  writingMode: WritingMode,
): DOMRect | null {
  const node = range.startContainer;
  if (!(node instanceof Text) || node.data.length === 0) return null;

  const probe = range.cloneRange();
  const offset = range.startOffset;
  const useNext = offset < node.data.length;
  if (useNext) {
    probe.setEnd(node, offset + 1);
  } else {
    probe.setStart(node, offset - 1);
  }

  const reference = Array.from(probe.getClientRects()).find(
    (rect) => rect.width > 0 || rect.height > 0,
  );
  if (!reference) return null;

  if (writingMode === "vertical-rl") {
    const y = useNext ? reference.top : reference.bottom;
    return new DOMRect(reference.left, y, reference.width, 0);
  }

  const x = useNext ? reference.left : reference.right;
  return new DOMRect(x, reference.top, 0, reference.height);
}

export function classifyCorrectionScale(
  targets: readonly (readonly LogicalRect[])[],
  viewport: LogicalViewport,
): CorrectionScale {
  const rects = targets.flat();
  if (rects.length <= targets.length && rects.length > 0) return "inline";

  const bounds = combineLogicalRects(rects);
  if (!bounds) return "phrase";
  const blockExtent = bounds.blockEnd - bounds.blockStart;
  return rects.length >= 4 || blockExtent > viewport.blockSize * 0.55
    ? "block"
    : "phrase";
}
