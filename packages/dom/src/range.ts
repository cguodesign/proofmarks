import type { TextPointTarget, TextRangeTarget } from "@proofmarks/core";

const OVERLAY_SELECTOR = "[data-proofmarks-overlay]";

function isSourceTextNode(node: Node): node is Text {
  return (
    node.nodeType === node.TEXT_NODE &&
    !(node.parentElement?.closest(OVERLAY_SELECTOR) ?? null)
  );
}

export function getSourceTextNodes(container: HTMLElement): Text[] {
  const view = container.ownerDocument.defaultView;
  const nodeFilter = view?.NodeFilter ?? NodeFilter;
  const walker = container.ownerDocument.createTreeWalker(
    container,
    nodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        isSourceTextNode(node)
          ? nodeFilter.FILTER_ACCEPT
          : nodeFilter.FILTER_REJECT,
    },
  );

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

export function getSourceTextLength(container: HTMLElement): number {
  return getSourceTextNodes(container).reduce(
    (length, node) => length + node.data.length,
    0,
  );
}

export function getSourceText(container: HTMLElement): string {
  return getSourceTextNodes(container).map((node) => node.data).join("");
}

function resolveOffset(nodes: Text[], offset: number): [Text, number] {
  let remaining = offset;
  for (const node of nodes) {
    if (remaining <= node.data.length) {
      return [node, remaining];
    }
    remaining -= node.data.length;
  }

  throw new RangeError(`Text offset ${offset} is outside the source text.`);
}

export function createTextRange(
  container: HTMLElement,
  target: TextRangeTarget,
): Range {
  validateOffsets(container, target.start, target.end, false);

  const nodes = getSourceTextNodes(container);
  const [startNode, startOffset] = resolveOffset(nodes, target.start);
  const [endNode, endOffset] = resolveOffset(nodes, target.end);
  const range = container.ownerDocument.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

export function createTextPointRange(
  container: HTMLElement,
  target: TextPointTarget,
): Range {
  validateOffsets(container, target.offset, target.offset, true);
  const nodes = getSourceTextNodes(container);
  if (nodes.length === 0) {
    const range = container.ownerDocument.createRange();
    range.setStart(container, 0);
    range.collapse(true);
    return range;
  }
  const [node, offset] = resolveOffset(nodes, target.offset);
  const range = container.ownerDocument.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  return range;
}

function validateOffsets(
  container: HTMLElement,
  start: number,
  end: number,
  allowCollapsed: boolean,
): void {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new RangeError("Text target offsets must be integers.");
  }
  if (start < 0 || end < start || (!allowCollapsed && end === start)) {
    throw new RangeError(
      allowCollapsed
        ? "A text position must be within the source text."
        : "A text target must satisfy 0 <= start < end.",
    );
  }
  const textLength = getSourceTextLength(container);
  if (end > textLength) {
    throw new RangeError(
      `Text target end ${end} exceeds the container text length ${textLength}.`,
    );
  }
}

/** Convert a source-contained DOM range to UTF-16 offsets, excluding marks. */
export function offsetsFromSelection(
  container: HTMLElement,
  range: Range,
): TextRangeTarget | TextPointTarget {
  for (const node of [range.startContainer, range.endContainer]) {
    if (!container.contains(node) || (node.nodeType === node.ELEMENT_NODE
      ? (node as Element).closest(OVERLAY_SELECTOR)
      : node.parentElement?.closest(OVERLAY_SELECTOR))) {
      throw new RangeError("Selection endpoints must be inside the source text.");
    }
  }
  const offsetAt = (node: Node, offset: number): number => {
    const prefix = container.ownerDocument.createRange();
    prefix.selectNodeContents(container);
    prefix.setEnd(node, offset);
    const fragment = prefix.cloneContents();
    fragment.querySelectorAll(OVERLAY_SELECTOR).forEach((overlay) => overlay.remove());
    return fragment.textContent?.length ?? 0;
  };
  const start = offsetAt(range.startContainer, range.startOffset);
  const end = offsetAt(range.endContainer, range.endOffset);
  return start === end ? { kind: "text-point", offset: start } : { kind: "text-range", start, end };
}
