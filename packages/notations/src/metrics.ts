import {
  sourceEm,
  sourceLineHeight,
  type CorrectionGeometry,
} from "@proofmarks/dom";

export type CanonicalUnits = {
  em: number;
  line: number;
  hair: number;
  mark: number;
  gap: number;
  lane: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/** Named, source-relative units shared as measurement vocabulary, not as geometry. */
export function canonicalUnits(geometry: CorrectionGeometry): CanonicalUnits {
  const em = sourceEm(geometry);
  const line = sourceLineHeight(geometry);
  return {
    em,
    line,
    hair: clamp(em * 0.22, 2.8, 7),
    mark: clamp(em * 0.42, 5, 13.5),
    gap: clamp(em * 0.34, 4, 11),
    lane: clamp(Math.max(line * 0.72, em * 0.9), 12, 34),
  };
}

export function payloadInlineExtent(
  geometry: CorrectionGeometry,
  text: string,
  widthRatio = 0.9,
): number {
  const { em } = canonicalUnits(geometry);
  return Math.max(em, Array.from(text).length * em * widthRatio);
}
