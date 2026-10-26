import type { CorrectionType, NotationSupport, WritingMode } from "./schema";

declare const notationPackBrand: unique symbol;

/** An immutable, renderer-backed notation object supplied by Proofmarks. */
export type NotationPack = {
  readonly id: string;
  readonly displayName: string;
  readonly locale: string;
  readonly script?: string;
  readonly jurisdiction?: string;
  readonly writingModes: readonly WritingMode[];
  readonly supportedCorrections: readonly CorrectionType[];
  readonly support: readonly NotationSupport[];
  readonly [notationPackBrand]: true;
};
