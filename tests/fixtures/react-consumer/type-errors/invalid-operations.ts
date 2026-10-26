import type { Correction } from "proofmarks";

const invalidDelete: Correction = {
  id: "invalid-delete",
  type: "delete",
  target: { kind: "text-point", offset: 4 },
};

const invalidInsert: Correction = {
  id: "invalid-insert",
  type: "insert",
  target: { kind: "text-point", offset: 4 },
  content: 42,
};

const invalidReplace: Correction = {
  id: "invalid-replace",
  type: "replace",
  target: { kind: "text-range", start: 4, end: 10 },
  replacement: 42,
};

const invalidTranspose: Correction = {
  id: "invalid-transpose",
  type: "transpose",
  targets: [{ kind: "text-range", start: 4, end: 10 }],
};

const invalidMove: Correction = {
  id: "invalid-move",
  type: "move",
  source: { kind: "text-range", start: 4, end: 10 },
  destination: { kind: "text-range", start: 11, end: 12 },
};

const invalidIncreaseSpacing: Correction = {
  id: "invalid-increase-spacing",
  type: "increase-spacing",
  target: { kind: "text-range", start: 10, end: 11 },
};

const invalidDecreaseSpacing: Correction = {
  id: "invalid-decrease-spacing",
  type: "decrease-spacing",
  target: { kind: "text-point", offset: 10 },
};

const invalidCancellation: Correction = {
  id: "invalid-cancel-correction",
  type: "cancel-correction",
  target: { kind: "text-range", start: 4, end: 10 },
};

void [
  invalidDelete,
  invalidInsert,
  invalidReplace,
  invalidTranspose,
  invalidMove,
  invalidIncreaseSpacing,
  invalidDecreaseSpacing,
  invalidCancellation,
];
