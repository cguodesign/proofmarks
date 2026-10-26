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

export type MoveCorrection = {
  id: string;
  type: "move";
  source: TextRangeTarget;
  destination: TextPointTarget;
};

export type IncreaseSpacingCorrection = {
  id: string;
  type: "increase-spacing";
  target: TextPointTarget;
};

export type DecreaseSpacingCorrection = {
  id: string;
  type: "decrease-spacing";
  target: TextRangeTarget;
};

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

export type WritingMode = "horizontal-tb" | "vertical-rl";

export type CorrectionScale = "inline" | "phrase" | "block";

export type NotationSupport = {
  operation: CorrectionType;
  scales: readonly CorrectionScale[];
  writingModes: readonly WritingMode[];
};

/** Layout-preserving presentation controls for the rendered mark layer. */
export type ProofmarksMarkStyle = {
  /** Stroke and annotation ink. Must be a valid CSS color. */
  ink?: string;
  /** Multiplier over notation-pack calibrated strokes. Clamped to 0.75–1.5. */
  strokeScale?: number;
  /** Opacity of the mark layer. Clamped to 0–1. */
  opacity?: number;
  /** Optional label/payload ink. Must be a valid CSS color. */
  labelInk?: string;
};

/** Why an `insufficient-room` annotation could not be placed cleanly. */
export type ProofmarksRoomCollision = "source-text" | "exits-paper" | "annotation";

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

/** Measurements and representation choices for a completed render. */
export type ProofmarksRenderInfo = {
  fidelity: readonly ("reference-based" | "generic-fallback" | "unsupported" | "technical")[];
  fallbackCount: number;
  layoutMs: number;
};
