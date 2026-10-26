import type { Correction, CorrectionType } from "@proofmarks/core";
import type {
  CorrectionGeometry,
  CorrectionScale,
  WritingMode,
} from "./geometry";
import type { ProofmarkScene } from "./scene";

export type RenderContext = {
  debug: boolean;
  locale?: string;
  referencedCorrection?: ResolvedCorrectionContext;
};

export type ResolvedCorrectionContext = {
  correction: Correction;
  targetGeometry: CorrectionGeometry;
  scene: ProofmarkScene;
};

export type NotationSupport = {
  operation: CorrectionType;
  scales: readonly CorrectionScale[];
  writingModes: readonly WritingMode[];
};

export interface NotationPack {
  readonly id: string;
  readonly displayName: string;
  readonly locale: string;
  /** ISO 15924 script metadata; independent from the locale used by a proof. */
  readonly script?: string;
  /** ISO 3166-1 alpha-2 jurisdiction for a jurisdiction-specific standard. */
  readonly jurisdiction?: string;
  readonly writingModes: readonly WritingMode[];
  readonly supportedCorrections: readonly CorrectionType[];
  readonly support: readonly NotationSupport[];

  supports(correction: Correction, context: RenderContext): boolean;

  buildScene(
    correction: Correction,
    geometry: CorrectionGeometry,
    context: RenderContext,
  ): ProofmarkScene;
}
