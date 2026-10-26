import type { Correction, ProofmarksMarkStyle } from "proofmarks";

export const highContrastMarkStyle = {
  ink: "#173b63",
  labelInk: "#102a43",
  strokeScale: 1.15,
  opacity: 0.9,
} as const satisfies ProofmarksMarkStyle;

export const insertion = {
  id: "insert-particle",
  type: "insert",
  target: {
    kind: "text-point",
    offset: 4,
  },
  content: "の",
} as const satisfies Correction;

export const deletion = {
  id: "delete-word",
  type: "delete",
  target: { kind: "text-range", start: 4, end: 10 },
} as const satisfies Correction;

export const replacement = {
  id: "replace-word",
  type: "replace",
  target: { kind: "text-range", start: 4, end: 10 },
  replacement: "writer",
} as const satisfies Correction;

export const transposition = {
  id: "transpose-words",
  type: "transpose",
  targets: [
    { kind: "text-range", start: 4, end: 10 },
    { kind: "text-range", start: 11, end: 19 },
  ],
} as const satisfies Correction;

export const movement = {
  id: "move-word",
  type: "move",
  source: { kind: "text-range", start: 4, end: 10 },
  destination: { kind: "text-point", offset: 20 },
} as const satisfies Correction;

export const increaseSpacing = {
  id: "increase-spacing",
  type: "increase-spacing",
  target: { kind: "text-point", offset: 10 },
} as const satisfies Correction;

export const decreaseSpacing = {
  id: "decrease-spacing",
  type: "decrease-spacing",
  target: { kind: "text-range", start: 10, end: 12 },
} as const satisfies Correction;

export const cancellation = {
  id: "cancel-delete-word",
  type: "cancel-correction",
  target: { kind: "correction", correctionId: deletion.id },
} as const satisfies Correction;


// Verify the optional helpers resolve from the packed package, including their declarations.
import { applyCorrections, correctionsFromDiff, findRange, getSourceText, offsetsFromSelection } from "proofmarks/helpers";
import type { ProofmarksProps } from "proofmarks/react";
export const helperRoundTrip: string = applyCorrections("cat", correctionsFromDiff("cat", "dog"));
export const helperRange = findRange("cat cat", "cat", 1);
export const sourceReader: (root: HTMLElement) => string = getSourceText;
export const selectionReader = offsetsFromSelection;
export const headingRoot: ProofmarksProps["as"] = "h1";
export const staticProof: ProofmarksProps["animate"] = false;
export const renderCallback: ProofmarksProps["onRender"] = (info) => {
  const fallbackCount: number = info.fallbackCount;
  void fallbackCount;
};
export const codeDiff = correctionsFromDiff("a.lenght", "a.length", { granularity: "code", idPrefix: "line-1-" });
export const issueCallback: ProofmarksProps["onIssue"] = (issue) => {
  if (issue.code === "insufficient-room") {
    const collisions: readonly ("source-text" | "exits-paper" | "annotation")[] = issue.collisions;
    void collisions;
  }
  if (issue.code === "unverified-direction") {
    const direction: "rtl" = issue.direction;
    void direction;
  }
};
