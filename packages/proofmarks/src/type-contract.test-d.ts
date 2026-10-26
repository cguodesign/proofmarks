import type { Correction, ProofmarksRoomCollision } from "./schema";
import type { ProofmarksProps } from "./react";
import { correctionsFromDiff } from "./helpers";

const deletion = {
  id: "delete-word",
  type: "delete",
  target: { kind: "text-range", start: 4, end: 10 },
} as const satisfies Correction;

const insertion = {
  id: "insert-word",
  type: "insert",
  target: { kind: "text-point", offset: 11 },
  content: "carefully ",
} as const satisfies Correction;

const replacement = {
  id: "replace-word",
  type: "replace",
  target: { kind: "text-range", start: 11, end: 15 },
  replacement: "reviewed",
} as const satisfies Correction;

const transpose = {
  id: "transpose-words",
  type: "transpose",
  targets: [
    { kind: "text-range", start: 4, end: 10 },
    { kind: "text-range", start: 11, end: 19 },
  ],
} as const satisfies Correction;

const cancellation = {
  id: "cancel-delete-word",
  type: "cancel-correction",
  target: { kind: "correction", correctionId: deletion.id },
} as const satisfies Correction;

const movement = {
  id: "move-word",
  type: "move",
  source: { kind: "text-range", start: 4, end: 10 },
  destination: { kind: "text-point", offset: 20 },
} as const satisfies Correction;

const increaseSpacing = {
  id: "space-words",
  type: "increase-spacing",
  target: { kind: "text-point", offset: 10 },
} as const satisfies Correction;

const decreaseSpacing = {
  id: "close-words",
  type: "decrease-spacing",
  target: { kind: "text-range", start: 10, end: 12 },
} as const satisfies Correction;

JSON.stringify([
  deletion,
  insertion,
  replacement,
  transpose,
  movement,
  increaseSpacing,
  decreaseSpacing,
  cancellation,
]);

const invalidMove: Correction = {
  id: "invalid-move",
  type: "move",
  // @ts-expect-error Move source must be an existing range.
  source: { kind: "text-point", offset: 4 },
  destination: { kind: "text-point", offset: 10 },
};

const invalidDelete: Correction = {
  id: "invalid-delete",
  type: "delete",
  // @ts-expect-error Deletions target an existing range.
  target: { kind: "text-point", offset: 4 },
};

const invalidTranspose: Correction = {
  id: "invalid-transpose",
  type: "transpose",
  // @ts-expect-error Transposition requires exactly two ordered range operands.
  targets: [{ kind: "text-range", start: 0, end: 1 }],
};

const invalidIncreaseSpacing: Correction = {
  id: "invalid-open",
  type: "increase-spacing",
  // @ts-expect-error Increasing spacing targets a boundary point.
  target: { kind: "text-range", start: 3, end: 4 },
};

const invalidDecreaseSpacing: Correction = {
  id: "invalid-close",
  type: "decrease-spacing",
  // @ts-expect-error Decreasing spacing targets existing whitespace.
  target: { kind: "text-point", offset: 4 },
};

const invalidCancellation: Correction = {
  id: "invalid-cancel",
  type: "cancel-correction",
  // @ts-expect-error A cancellation must reference another correction.
  target: { kind: "text-range", start: 0, end: 1 },
};

const invalidInsertion: Correction = {
  id: "invalid-insert",
  type: "insert",
  // @ts-expect-error Insertions target a point rather than a collapsed range.
  target: { kind: "text-range", start: 1, end: 2 },
  content: "x",
};

const invalidReplacement: Correction = {
  id: "invalid-replace",
  type: "replace",
  target: { kind: "text-range", start: 1, end: 2 },
  // @ts-expect-error Replace uses the self-describing replacement property.
  content: "x",
};

// @ts-expect-error Void elements cannot contain source content or an overlay.
const invalidRoot: ProofmarksProps["as"] = "img";

const editorialAppearance: ProofmarksProps["appearance"] = "editorial";
JSON.stringify(editorialAppearance);

const proofmarksVisibility: ProofmarksProps["showProofmarks"] = false;
JSON.stringify(proofmarksVisibility);

const proofmarksMarkStyle: ProofmarksProps["markStyle"] = {
  ink: "#173b63",
  strokeScale: 1.15,
  opacity: 0.9,
  labelInk: "rgb(15 42 67)",
};
JSON.stringify(proofmarksMarkStyle);

const invalidMarkStyle: ProofmarksProps["markStyle"] = {
  // @ts-expect-error Stroke scale is a numeric multiplier.
  strokeScale: "heavy",
};
JSON.stringify(invalidMarkStyle);

// @ts-expect-error Visibility is a boolean presentation control.
const invalidProofmarksVisibility: ProofmarksProps["showProofmarks"] = "hidden";
JSON.stringify(invalidProofmarksVisibility);

// @ts-expect-error Appearance is intentionally limited to the two renderer treatments.
const invalidAppearance: ProofmarksProps["appearance"] = "hand-drawn";
JSON.stringify(invalidAppearance);

const issueCallback: ProofmarksProps["onIssue"] = (issue) => {
  if (issue.code === "insufficient-room") JSON.stringify(issue.collisions satisfies readonly ProofmarksRoomCollision[]);
  if (issue.code === "unverified-direction") JSON.stringify(issue.direction satisfies "rtl");
};
JSON.stringify(issueCallback);

// @ts-expect-error Diff granularity is limited to word, character and code.
correctionsFromDiff("a", "b", { granularity: "sentence" });
JSON.stringify(correctionsFromDiff("a.b", "a.c", { granularity: "code", idPrefix: "line-1-" }));
