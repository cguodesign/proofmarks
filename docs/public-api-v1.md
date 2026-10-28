# Proofmarks V1 public API

Status: initial contract with consumer robustness additions, 2026-10-16; additive issue fields and helper options, 2026-10-18.

“Frozen” means intentional and versioned, not permanently unable to evolve. Only the surface documented here is public.

## Package entry points

```ts
import { createProofmarks } from "proofmarks";
import { Proofmarks } from "proofmarks/react";
import { jis, gb, cns3927, ks, enUS } from "proofmarks/notations";
import { jis } from "proofmarks/notations/jis";
import { gb } from "proofmarks/notations/gb";
import { cns3927 } from "proofmarks/notations/cns3927";
import { ks } from "proofmarks/notations/ks";
import { enUS } from "proofmarks/notations/en-us";
import "proofmarks/styles.css";
```

React is an optional peer dependency used only by `proofmarks/react`. The root and notation entries do not require React.

## Correction and target types

All corrections are plain JSON-serializable discriminated unions.

```ts
type TextRangeTarget = {
  kind: "text-range";
  start: number;
  end: number;
};

type TextPointTarget = {
  kind: "text-point";
  offset: number;
};

type CorrectionReferenceTarget = {
  kind: "correction";
  correctionId: string;
};

type DeleteCorrection = {
  id: string;
  type: "delete";
  target: TextRangeTarget;
};

type InsertCorrection = {
  id: string;
  type: "insert";
  target: TextPointTarget;
  content: string;
};

type ReplaceCorrection = {
  id: string;
  type: "replace";
  target: TextRangeTarget;
  replacement: string;
};

type TransposeCorrection = {
  id: string;
  type: "transpose";
  targets: readonly [TextRangeTarget, TextRangeTarget];
};

type MoveCorrection = {
  id: string;
  type: "move";
  source: TextRangeTarget;
  destination: TextPointTarget;
};

type IncreaseSpacingCorrection = {
  id: string;
  type: "increase-spacing";
  target: TextPointTarget;
};

type DecreaseSpacingCorrection = {
  id: string;
  type: "decrease-spacing";
  target: TextRangeTarget;
};

type CancelCorrection = {
  id: string;
  type: "cancel-correction";
  target: CorrectionReferenceTarget;
};

type Correction =
  | DeleteCorrection
  | InsertCorrection
  | ReplaceCorrection
  | TransposeCorrection
  | MoveCorrection
  | IncreaseSpacingCorrection
  | DecreaseSpacingCorrection
  | CancelCorrection;
```

IDs are non-empty and unique within a collection. Ranges satisfy `0 <= start < end`; points are non-negative. Transpose operands are ordered, non-overlapping ranges. A move destination must be outside its source range. Increasing spacing targets a boundary point; decreasing spacing targets existing whitespace as a non-empty range. A cancellation references an existing correction, cannot reference itself, and cannot form a cycle. Insert `content` and replace `replacement` are non-empty strings.

The eight-operation V0.1 contract does not model CSS tracking, kerning, or a purely visual spacing correction. `increase-spacing` identifies a text boundary with `text-point`; `decrease-spacing` identifies an existing whitespace-only `text-range` in the accepted source.

The public `validateCorrection` and `validateCorrections` functions validate correction shape, relations, and optional numeric text bounds. `createProofmarks` additionally has the real source text and rejects a `decrease-spacing` range unless it contains whitespace only. Vanilla creation and updates throw a wrapped validation error whose `cause` preserves the original exception; React reports `invalid-corrections` through `onIssue`. On validation failure, the previous valid overlay stays only when the source is unchanged; changed source clears the old marks. Valid offsets are not a guarantee that a correction still targets the intended words. See [Updates, motion, and export](#updates-motion-and-export). Unsupported visual capability is not a data error and uses the issue model below.

## NotationPack

Notation selection is object-based, not a closed string enum.

The public metadata view is:

```ts
type NotationPackMetadata = {
  readonly id: string;
  readonly displayName: string;
  readonly locale: string;
  readonly script?: string;
  readonly jurisdiction?: string;
  readonly writingModes: readonly ("horizontal-tb" | "vertical-rl")[];
  readonly supportedCorrections: readonly Correction["type"][];
  readonly support: readonly {
    operation: Correction["type"];
    scales: readonly ("inline" | "phrase" | "block")[];
    writingModes: readonly ("horizontal-tb" | "vertical-rl")[];
  }[];
};
```

`NotationPack` is an opaque renderer-backed object exposing that metadata. The built-ins are `jis`, `gb`, `cns3927`, `ks`, and `enUS`. Their metadata is public and immutable. `support` lists direct, source-backed mappings per operation, scale, and writing mode. An absent direct row does not silently imply support: the runtime reports its documented generic fallback or unsupported state. Renderer functions and geometry remain private.

`cns3927` is the jurisdiction-specific Taiwan pack (`zh-Hant-TW`, script `Hant`, jurisdiction `TW`). It is independent from `gb`; selecting a notation never translates source content or changes offset semantics. See the [CNS 3927 research and implementation note](taiwan-cns3927-research.md) for its conservative direct-support matrix and source-access status.

V1 accepts renderer-backed notation objects supplied by Proofmarks. The object boundary deliberately leaves room for third-party packs, but a public pack-authoring API is not frozen yet because it would otherwise expose unstable scene and geometry internals.

## React

```ts
type ProofmarksProps = {
  notation: NotationPack;
  corrections: readonly Correction[];
  appearance?: "technical" | "editorial";
  animate?: boolean;
  showProofmarks?: boolean;
  markStyle?: ProofmarksMarkStyle;
  children: React.ReactNode;
  as?: "div" | "p" | "span" | "article" | "section" | "aside" | "blockquote"
    | "figure" | "figcaption" | "header" | "footer" | "main" | "nav" | "li"
    | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    | "pre" | "code" | "td" | "th" | "label";
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  role?: string;
  title?: string;
  "aria-label"?: string;
  onIssue?: (issue: ProofmarksIssue) => void;
  onRender?: (info: ProofmarksRenderInfo) => void;
};
```

`Proofmarks` renders normal children into the selected intrinsic HTML container. Void elements such as `img` and `input` are deliberately excluded because they cannot own source content or an overlay. It is safe to import and server-render without DOM globals; geometry attaches after mounting. Prop changes update the single shared DOM engine declaratively. `showProofmarks` defaults to `true`; changing it hides or reveals only the existing SVG overlay. Strict Mode cleanup removes observers, listeners, and overlays.

`asChild`, arbitrary custom root components, correction JSX components, a required `text` prop, a `writingMode` prop, and a hook-first API are not part of V1.

Offsets use UTF-16 code units over flattened source `textContent`, excluding the renderer overlay. Browser CSS owns typography and writing mode.

## Vanilla lifecycle

```ts
type ProofmarksOptions = {
  notation: NotationPack;
  corrections: readonly Correction[];
  appearance?: "technical" | "editorial";
  animate?: boolean;
  showProofmarks?: boolean;
  markStyle?: ProofmarksMarkStyle;
  onIssue?: (issue: ProofmarksIssue) => void;
  onRender?: (info: ProofmarksRenderInfo) => void;
};

type ProofmarksInstance = {
  update(options: ProofmarksOptions): void;
  replay(): void;
  destroy(): void;
};

const instance = createProofmarks(element, options);
```

Creation performs the first render. `update` replaces options without mutating either the previous or next data. When only `showProofmarks` changes, the instance changes the existing overlay's visibility without remeasuring, rebuilding scenes, clearing corrections, replacing accepted text, or discarding placement state. `destroy` is idempotent and releases the overlay, observers, font and window listeners, animation-frame work, and temporary host styling.

`showProofmarks` is not an accept/reject command and does not materialize proposed content. While hidden, the overlay remains mounted and observers remain active; use `destroy` when the proof itself leaves the page.

There are no public imperative drawing, measuring, routing, or scene methods.

`onRender` receives the following data after each actual render:

```ts
type ProofmarksRenderInfo = {
  fidelity: readonly ("reference-based" | "generic-fallback" | "unsupported" | "technical")[];
  fallbackCount: number;
  layoutMs: number;
};
```

## Issues, errors, and capability

```ts
type ProofmarksIssue =
  | { code: "invalid-corrections"; correctionId?: string; message: string }
  | {
      code: "insufficient-room";
      correctionId: string;
      collisions: readonly ("source-text" | "exits-paper" | "annotation")[];
      message: string;
    }
  | {
      code: "unsupported-writing-mode";
      correctionId: string;
      message: string;
    }
  | { code: "unverified-direction"; direction: "rtl"; message: string }
  | {
      code:
        | "invalid-mark-style-color"
        | "invalid-mark-style-value"
        | "mark-style-value-clamped";
      property: "markStyle" | keyof ProofmarksMarkStyle;
      appliedValue?: string | number;
      message: string;
    };
```

`collisions` names what the best available label position still overlaps:
source text, the root's box (`exits-paper`), or another annotation.
`unverified-direction` is reported once per instance when the root's computed
`direction` is `rtl`; marks still render, but no pack has verified right-to-left
conventions. Both fields and the code are additive; handle unknown codes
gracefully.

For valid data in an unsupported notation/writing-mode combination:

- document content still renders;
- the affected correction emits no fabricated mark;
- its internal rendered scene is tagged `unsupported` for diagnostics;
- `onIssue` receives the issue.

Standalone validators throw `TypeError`, `RangeError`, or `ReferenceError`. Vanilla creation and updates reject invalid data with an error whose `cause` preserves the validation error. React catches validation failures and reports `invalid-corrections` through `onIssue`; observer-driven refreshes do the same. Missing browser APIs during SSR do not throw because the engine is not created during render.

## Styling contract

The stable JavaScript presentation surface is deliberately constrained:

```ts
type ProofmarksMarkStyle = {
  ink?: string;
  strokeScale?: number;
  opacity?: number;
  labelInk?: string;
};

<Proofmarks
  notation={jis}
  corrections={corrections}
  markStyle={{
    ink: "#173b63",
    labelInk: "#102a43",
    strokeScale: 1.15,
  }}
>
  吾輩は猫である。名前はまだ無い。
</Proofmarks>
```

`ink` and `labelInk` accept valid CSS colors. Invalid colors are ignored and emit `invalid-mark-style-color`; the pack/default ink remains in effect. `strokeScale` is a finite multiplier over each notation pack's calibrated stroke and is clamped to `0.75–1.5`. `opacity` is finite and clamped to `0–1`. Invalid numeric values use the default; clamping and invalid values emit `mark-style-value-clamped` or `invalid-mark-style-value` with the applied value where useful.

`markStyle` is presentation only. It does not alter path coordinates, annotation candidates, lanes, leader routing, correction semantics, accepted text, or writing-mode capability. Arbitrary paths, transforms, offsets, per-correction SVG overrides, and raw renderer hooks are deliberately not public in V0.1.

When `strokeScale` is present it takes precedence over the fixed `--proofmarks-stroke-width` host token so the multiplier remains relative to each pack's calibrated stroke. Omitting `markStyle` preserves the existing stylesheet behavior exactly.

Vanilla uses the same object:

```ts
const proof = createProofmarks(element, {
  notation: jis,
  corrections,
  markStyle: { ink: "#173b63", strokeScale: 1.15 },
  onIssue: (issue) => console.warn(issue.code, issue.message),
});

proof.update({ notation: gb, corrections, markStyle: { opacity: 0.82 } });
```

The values are validated when an instance is created and on every `update`. An update with an invalid styling field still renders safely using that field's default; it does not retain a broken SVG value.

For stylesheet integration, `proofmarks/styles.css` supplies defaults for these public tokens:

- `--proofmarks-color`;
- `--proofmarks-stroke-width`;
- `--proofmarks-label-font`;
- `--proofmarks-halo`;
- `--proofmarks-editorial-color`, `--proofmarks-editorial-second-stroke`, and
  `--proofmarks-editorial-font`, which apply to `appearance="editorial"`.

All SVG structure, scene roles, leader routing, halo expansion, individual node attributes, overlay DOM, and debug attributes remain implementation details.

Application variables such as `--proof-red` and `--ink`, and renderer-internal `--proofmarks-mark-*` variables, are not public API.

## Not public / subject to change

- internal `@proofmarks/core`, `@proofmarks/dom`, and `@proofmarks/notations` workspace packages;
- DOM range walkers and logical geometry;
- correction-scale derivation;
- scene graphs, SVG serializers, path constructors, and renderer callbacks;
- notation pack private builders and scene construction;
- fidelity/debug data attributes and test fixtures;
- gallery and compare application code;
- arbitrary notation-pack authoring until a stable renderer extension contract exists.

Editor authoring, accept/reject workflows, comments, collaboration, persistence, and AI correction generation remain host-product concerns. Optional helpers provide plain-text transformation and selection offsets; editorial appearance provides a one-time write-on animation.

## Room, source text, and small edits

Start with `padding-block: 44px`, `padding-inline: 20px`, and `line-height: 1.8`
on the proof root. Annotations use this root's box; `overflow: visible` alone
does not reserve annotation space. Keep overflow visible on ancestors too.
For code inside a scrolling viewport, reserve this padding inside the scrollable
content and prefer short lines. A useful starting density is **3–6 word-level
corrections across 2–4 lines**. This is a readability guideline, not a hard cap;
show fewer corrections or split the proof if labels collide. `onIssue` reports
`insufficient-room` with a correction ID and a `collisions` list (`source-text`,
`exits-paper`, `annotation`) when the chosen label still overlaps source text,
leaves the root's box, or overlaps another label. Placement is greedy, so leader
crossings can still occur in constrained proofs. Proofmarks suits a few
word-level edits; filter whole-paragraph rewrites in the host before rendering.

```css
.proof-document {
  padding: 44px 20px;
  line-height: 1.8;
  overflow: visible;
}
```

The SVG is non-selectable and excluded from normal copy operations. It still
lives inside the root, so raw `root.textContent` includes annotation labels.
Read the accepted source with `getSourceText(root)` from `proofmarks` or
`proofmarks/helpers`; all offsets refer to that string, in UTF-16 code units.
`proofmarks/styles.css` is optional: marks and CSS variable overrides work
without it; it only supplies default token values.

Right-to-left text is unverified for every notation pack. Marks follow the
measured glyphs, but strokes and labels are not mirrored. When the root's
computed direction is `rtl`, `onIssue` reports `unverified-direction` once per
instance.

## Updates, motion, and export

React catches correction validation failures and reports `invalid-corrections`
through `onIssue` instead of throwing. If validation fails and the source text
changed since the last render, old marks are cleared. If validation fails while
the source is unchanged, the previous valid overlay stays (an invalid first mount
shows an empty overlay). Corrected props recover automatically. Vanilla
`createProofmarks` and `update` throw wrapped validation errors with the original
error in `cause`, using the same clearing rule; catch those calls. Observer-driven
refreshes report through `onIssue`. Validation messages include the correction ID
when available. Bounds-valid offsets can still point at the wrong words;
Proofmarks cannot detect that semantic mismatch or repair offsets. Rebase or
regenerate corrections whenever the text changes.

Inline `markStyle`, correction arrays with identical values, and callback changes
do not repaint the overlay. `update` replaces the full options object; keep the
options you still want on subsequent calls. React also supports `as="h1"`
through `"h6"`, `"pre"`, `"code"`, `"td"`, `"th"`, and `"label"`.

Editorial motion plays on the first non-empty editorial render only. Subsequent
redraws show the final ink. Set `animate: false` (React: `animate={false}`) for
static proofs and pages with many instances; vanilla `instance.replay()`
explicitly replays motion when enabled. Reduced motion disables animation, including
replay. Animations use browser effects, so cloned SVG contains the final ink
without embedded animation styles. For screenshot libraries that copy computed
styles, disable animation **before** invoking the exporter and await the React
commit if changing a prop. You do not need to remove internal SVG nodes. A
window resize redraws only instances whose measured layout changed.

`onRender({ fidelity, fallbackCount, layoutMs })` reports each completed render.
`fidelity` contains one entry per correction in dependency order; `layoutMs`
measures placement only. No-op updates do not call `onRender`.

## Optional source helpers

```ts
import {
  getSourceText, offsetsFromSelection, findRange,
  applyCorrections, correctionsFromDiff,
} from "proofmarks/helpers";

const text = getSourceText(element);
const target = findRange(text, "editor"); // null if absent; nth is zero-based
const corrections = correctionsFromDiff(text, "The writer reviewed it.", {
  granularity: "word", // "character" (grapheme clusters) or "code"
  locale: "en",
  idPrefix: "line-3-", // ids become line-3-1, line-3-2, … (default "diff-")
});
const revised = applyCorrections(text, corrections);
const selectionTarget = offsetsFromSelection(element, selectedRange);
```

```ts
type DiffOptions = {
  granularity?: "word" | "character" | "code";
  locale?: string;
  idPrefix?: string; // default "diff-"
};
```

These helpers do not mutate the source. `offsetsFromSelection` returns a
`text-range` or a collapsed `text-point` and rejects endpoints outside the source.
`findRange` counts non-overlapping literal occurrences. Diff uses word, grapheme,
or code segmentation; `code` splits identifiers, whitespace runs, and single
punctuation, so `items.lenght` targets only `lenght`. It returns insert, delete,
and replace data, plus `decrease-spacing` for removed whitespace,
`increase-spacing` for one added space, and `transpose` for two swapped tokens,
each only when `applyCorrections` reproduces the target exactly. It is not
semantic editing advice; large unmatched regions fall back to one replacement to
bound memory. Filter
large changes before rendering. `applyCorrections` uses original-source offsets,
honors cancellation chains, and rejects conflicting edits instead of guessing
precedence. Same-point insertions retain input order. For plain text, increasing
spacing inserts one ordinary space; decreasing spacing removes the selected
whitespace. Helpers require `Intl.Segmenter` for diff generation.
