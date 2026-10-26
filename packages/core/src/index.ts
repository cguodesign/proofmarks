export type TextRangeTarget = {
  kind: "text-range";
  start: number;
  end: number;
};

export type TextPointTarget = {
  kind: "text-point";
  offset: number;
};

export type CorrectionReferenceTarget = {
  kind: "correction";
  correctionId: string;
};

export type CorrectionTarget =
  | TextRangeTarget
  | TextPointTarget
  | CorrectionReferenceTarget;

export type DeleteCorrection = {
  id: string;
  type: "delete";
  target: TextRangeTarget;
};

export type InsertCorrection = {
  id: string;
  type: "insert";
  target: TextPointTarget;
  content: string;
};

export type ReplaceCorrection = {
  id: string;
  type: "replace";
  target: TextRangeTarget;
  replacement: string;
};

export type TransposeCorrection = {
  id: string;
  type: "transpose";
  targets: readonly [TextRangeTarget, TextRangeTarget];
};

/** Relocate existing material without encoding a physical route or direction. */
export type MoveCorrection = {
  id: string;
  type: "move";
  source: TextRangeTarget;
  destination: TextPointTarget;
};

/** Increase spacing at a text boundary. The notation owns the visible amount. */
export type IncreaseSpacingCorrection = {
  id: string;
  type: "increase-spacing";
  target: TextPointTarget;
};

/** Decrease or close existing spacing selected by a non-empty text range. */
export type DecreaseSpacingCorrection = {
  id: string;
  type: "decrease-spacing";
  target: TextRangeTarget;
};

/** Cancel a prior editorial instruction, restoring the proof as originally set. */
export type CancelCorrection = {
  id: string;
  type: "cancel-correction";
  target: CorrectionReferenceTarget;
};

export type Correction =
  | DeleteCorrection
  | InsertCorrection
  | ReplaceCorrection
  | TransposeCorrection
  | MoveCorrection
  | IncreaseSpacingCorrection
  | DecreaseSpacingCorrection
  | CancelCorrection;

export type CorrectionType = Correction["type"];

function validateId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("A correction must have a non-empty id.");
  }
}

function validateTextRangeTarget(
  value: unknown,
  textLength?: number,
): asserts value is TextRangeTarget {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("A range correction must have a text target.");
  }

  const { kind, start, end } = value as Partial<TextRangeTarget>;
  if (kind !== "text-range") {
    throw new TypeError('A range correction target must have kind "text-range".');
  }
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new RangeError("Text target offsets must be integers.");
  }
  if (start! < 0 || end! <= start!) {
    throw new RangeError("A text target must satisfy 0 <= start < end.");
  }
  if (textLength !== undefined && end! > textLength) {
    throw new RangeError(
      `Text target end ${end} exceeds the container text length ${textLength}.`,
    );
  }
}

function validateTextPointTarget(
  value: unknown,
  textLength?: number,
): asserts value is TextPointTarget {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("An insertion must have a text position.");
  }

  const { kind, offset } = value as Partial<TextPointTarget>;
  if (kind !== "text-point") {
    throw new TypeError(
      'An insertion target must have kind "text-point".',
    );
  }
  if (!Number.isInteger(offset) || offset! < 0) {
    throw new RangeError("A text position offset must be a non-negative integer.");
  }
  if (textLength !== undefined && offset! > textLength) {
    throw new RangeError(
      `Text position ${offset} exceeds the container text length ${textLength}.`,
    );
  }
}

function validateCorrectionReference(
  value: unknown,
): asserts value is CorrectionReferenceTarget {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("A cancellation must have a correction reference target.");
  }
  const { kind, correctionId } = value as Partial<CorrectionReferenceTarget>;
  if (kind !== "correction") {
    throw new TypeError(
      'A cancellation target must have kind "correction".',
    );
  }
  validateId(correctionId);
}

function validateContent(value: unknown, operation: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${operation} content must be a non-empty string.`);
  }
}

export function validateCorrection(
  value: unknown,
  textLength?: number,
): asserts value is Correction {
  try {
    validateCorrectionShape(value, textLength);
  } catch (error) {
    if (error instanceof Error && value && typeof value === "object" &&
        "id" in value && typeof value.id === "string") {
      error.message = `Correction ${value.id}: ${error.message}`;
      Object.assign(error, { correctionId: value.id });
    }
    throw error;
  }
}

function validateCorrectionShape(
  value: unknown,
  textLength?: number,
): asserts value is Correction {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("A correction must be an object.");
  }

  const correction = value as Record<string, unknown>;
  validateId(correction.id);

  switch (correction.type) {
    case "delete":
      validateTextRangeTarget(correction.target, textLength);
      return;
    case "insert":
      validateTextPointTarget(correction.target, textLength);
      validateContent(correction.content, "Insertion");
      return;
    case "replace":
      validateTextRangeTarget(correction.target, textLength);
      validateContent(correction.replacement, "Replacement");
      return;
    case "transpose": {
      if (!Array.isArray(correction.targets) || correction.targets.length !== 2) {
        throw new TypeError("A transposition must have exactly two text targets.");
      }
      const first: unknown = correction.targets[0];
      const second: unknown = correction.targets[1];
      validateTextRangeTarget(first, textLength);
      validateTextRangeTarget(second, textLength);
      if (first.end > second.start) {
        throw new RangeError(
          "Transposition targets must be ordered and must not overlap.",
        );
      }
      return;
    }
    case "move":
      validateTextRangeTarget(correction.source, textLength);
      validateTextPointTarget(correction.destination, textLength);
      if (
        correction.destination.offset >= correction.source.start &&
        correction.destination.offset <= correction.source.end
      ) {
        throw new RangeError(
          "A move destination must be outside its source range.",
        );
      }
      return;
    case "increase-spacing":
      validateTextPointTarget(correction.target, textLength);
      return;
    case "decrease-spacing":
      validateTextRangeTarget(correction.target, textLength);
      return;
    case "cancel-correction":
      validateCorrectionReference(correction.target);
      return;
    default:
      throw new TypeError(
        `Unsupported correction type: ${String(correction.type)}.`,
      );
  }
}

export function isCorrectionReferenceTarget(
  target: CorrectionTarget,
): target is CorrectionReferenceTarget {
  return target.kind === "correction";
}

export function isTextPointTarget(
  target: TextRangeTarget | TextPointTarget,
): target is TextPointTarget {
  return target.kind === "text-point";
}

export function getCorrectionTargets(
  correction: Exclude<Correction, CancelCorrection>,
): readonly (TextRangeTarget | TextPointTarget)[] {
  switch (correction.type) {
    case "transpose":
      return correction.targets;
    case "move":
      return [correction.source, correction.destination];
    default:
      return [correction.target];
  }
}

export function resolveCorrectionReference(
  correction: CancelCorrection,
  corrections: readonly Correction[],
): Correction {
  const referenced = corrections.find(
    (candidate) => candidate.id === correction.target.correctionId,
  );
  if (!referenced) {
    throw new ReferenceError(
      `Correction ${correction.id} references missing correction ${correction.target.correctionId}.`,
    );
  }
  if (referenced.id === correction.id) {
    throw new ReferenceError(`Correction ${correction.id} cannot reference itself.`);
  }
  return referenced;
}

export function validateCorrections(
  corrections: readonly Correction[],
  textLength?: number,
): void {
  const byId = new Map<string, Correction>();
  for (const correction of corrections) {
    validateCorrection(correction, textLength);
    if (byId.has(correction.id)) {
      throw new TypeError(`Duplicate correction id: ${correction.id}.`);
    }
    byId.set(correction.id, correction);
  }

  for (const correction of corrections) {
    if (correction.type === "cancel-correction") {
      resolveCorrectionReference(correction, corrections);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (correction: Correction): void => {
    if (visited.has(correction.id)) return;
    if (visiting.has(correction.id)) {
      throw new ReferenceError(
        `Cyclic correction reference detected at ${correction.id}.`,
      );
    }
    visiting.add(correction.id);
    if (correction.type === "cancel-correction") {
      visit(resolveCorrectionReference(correction, corrections));
    }
    visiting.delete(correction.id);
    visited.add(correction.id);
  };
  for (const correction of corrections) visit(correction);
}

/** Stable dependency order: referenced corrections always precede their cancelers. */
export function orderCorrectionsByReference(
  corrections: readonly Correction[],
): Correction[] {
  validateCorrections(corrections);
  const ordered: Correction[] = [];
  const visited = new Set<string>();
  const visit = (correction: Correction): void => {
    if (visited.has(correction.id)) return;
    if (correction.type === "cancel-correction") {
      visit(resolveCorrectionReference(correction, corrections));
    }
    visited.add(correction.id);
    ordered.push(correction);
  };
  for (const correction of corrections) visit(correction);
  return ordered;
}
