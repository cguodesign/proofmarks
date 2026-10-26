import {
  validateCorrection as validateInternalCorrection,
  validateCorrections as validateInternalCorrections,
} from "@proofmarks/core";
import {
  createProofmarks as createDomProofmarks,
  getSourceText as getDomSourceText,
  type NotationPack as InternalNotationPack,
} from "@proofmarks/dom";
import type {
  Correction,
  ProofmarksIssue,
  ProofmarksMarkStyle,
  ProofmarksRenderInfo,
} from "./schema";
import type { NotationPack } from "./types";

export type {
  CancelCorrection,
  Correction,
  CorrectionReferenceTarget,
  CorrectionTarget,
  CorrectionType,
  DeleteCorrection,
  DecreaseSpacingCorrection,
  IncreaseSpacingCorrection,
  InsertCorrection,
  MoveCorrection,
  NotationSupport,
  ReplaceCorrection,
  CorrectionScale,
  TextPointTarget,
  TextRangeTarget,
  TransposeCorrection,
  WritingMode,
  ProofmarksIssue,
  ProofmarksMarkStyle,
  ProofmarksRenderInfo,
  ProofmarksRoomCollision,
} from "./schema";
export type { NotationPack } from "./types";

export function getSourceText(element: HTMLElement): string {
  return getDomSourceText(element);
}

export type ProofmarksAppearance = "technical" | "editorial";

export function validateCorrection(
  value: unknown,
  textLength?: number,
): asserts value is Correction {
  validateInternalCorrection(value, textLength);
}

export function validateCorrections(
  corrections: readonly Correction[],
  textLength?: number,
): void {
  validateInternalCorrections(corrections, textLength);
}

export type ProofmarksOptions = {
  notation: NotationPack;
  corrections: readonly Correction[];
  appearance?: ProofmarksAppearance;
  animate?: boolean;
  showProofmarks?: boolean;
  markStyle?: ProofmarksMarkStyle;
  onIssue?: (issue: ProofmarksIssue) => void;
  onRender?: (info: ProofmarksRenderInfo) => void;
};

export type ProofmarksInstance = {
  update(options: ProofmarksOptions): void;
  replay(): void;
  destroy(): void;
};

function toInternalNotation(notation: NotationPack): InternalNotationPack {
  return notation as unknown as InternalNotationPack;
}

function toInternalOptions(options: ProofmarksOptions) {
  return {
    notation: toInternalNotation(options.notation),
    corrections: options.corrections,
    ...(options.animate !== undefined ? { animate: options.animate } : {}),
    ...(options.onRender ? { onRender: options.onRender } : {}),
    ...(options.appearance ? { appearance: options.appearance } : {}),
    ...(options.showProofmarks !== undefined
      ? { showProofmarks: options.showProofmarks }
      : {}),
    ...(options.markStyle ? { markStyle: options.markStyle } : {}),
    ...(options.onIssue ? { onIssue: options.onIssue } : {}),
  };
}

export function createProofmarks(
  element: HTMLElement,
  options: ProofmarksOptions,
): ProofmarksInstance {
  const instance = createDomProofmarks(element, toInternalOptions(options));
  return {
    update(nextOptions): void {
      instance.update(toInternalOptions(nextOptions));
    },
    replay(): void {
      instance.replay();
    },
    destroy(): void {
      instance.destroy();
    },
  };
}
