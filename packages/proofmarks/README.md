# proofmarks

Render notation-aware proofreading marks over normal browser content from plain correction data.

```bash
npm install proofmarks
```

```tsx
import type { Correction } from "proofmarks";
import { jis } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";
import "proofmarks/styles.css";

const corrections = [
  {
    id: "delete-name",
    type: "delete",
    target: { kind: "text-range", start: 8, end: 10 },
  },
] as const satisfies readonly Correction[];

export function Example() {
  return (
    <Proofmarks
      as="p"
      style={{ padding: "44px 20px", lineHeight: 1.8 }}
      notation={jis}
      corrections={corrections}
      appearance="editorial"
      markStyle={{ ink: "#173b63", strokeScale: 1.15 }}
      lang="ja"
    >
      吾輩は猫である。名前はまだ無い。
    </Proofmarks>
  );
}
```

Swap `jis` for `gb`, `cns3927`, `ks`, or `enUS` without changing supported correction data.
The V0.1 correction union includes `delete`, `insert`, `replace`, `transpose`,
`move`, `increase-spacing`, `decrease-spacing`, and `cancel-correction`.
Each notation publishes direct support per operation, scale, and writing mode in
its `support` metadata.
Use `appearance="technical"` (the default) for canonical inspection and
`appearance="editorial"` for deterministic red-pencil stroke treatment. Appearance
does not change correction semantics, annotation placement, or source layout.

For a non-React consumer:

```ts
import { createProofmarks } from "proofmarks";
import { enUS } from "proofmarks/notations/en-us";
import "proofmarks/styles.css";

const proof = createProofmarks(element, {
  notation: enUS,
  corrections,
  appearance: "editorial",
  markStyle: { ink: "#173b63", strokeScale: 1.15 },
});
proof.update({
  notation: enUS,
  corrections: nextCorrections,
  appearance: "technical",
});
proof.destroy();
```

Offsets are UTF-16 code-unit positions over `getSourceText(root)`; before mounting this equals the root's `textContent`, afterwards raw `textContent` also includes annotation labels. Browser CSS controls typography and writing mode. Unsupported notation/writing-mode combinations call `onIssue` and do not fabricate a proofmark.

`markStyle` is the stable, layout-preserving JavaScript styling API. It accepts
`ink`, `labelInk`, `strokeScale` (clamped to `0.75–1.5`), and `opacity` (clamped
to `0–1`). Invalid values report through `onIssue` and fall back safely. It does
not expose geometry or raw SVG hooks.

Stable host stylesheet tokens are `--proofmarks-color`,
`--proofmarks-stroke-width`, `--proofmarks-label-font`, and
`--proofmarks-halo`, plus `--proofmarks-editorial-color`,
`--proofmarks-editorial-second-stroke`, and `--proofmarks-editorial-font` for
`appearance="editorial"`. `markStyle` takes precedence. On dark backgrounds,
raise the ink lightness and set `--proofmarks-halo` to the page background.
Application variables such as `--proof-red` and `--ink` are not package API.


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

## Coding agents

The package includes an offline [`AGENT_GUIDE.md`](AGENT_GUIDE.md) (at
`node_modules/proofmarks/AGENT_GUIDE.md` once installed) with the offset,
notation, room, lifecycle, and non-goal rules an agent needs before changing a
consumer integration. The public site serves `/llms.txt` and `/llms-full.txt`.
The repository also publishes a
[complete agent guide](https://github.com/cguodesign/proofmarks/blob/main/docs/agent-guide.md)
and copyable `AGENTS.md` and `CLAUDE.md` snippets.

## License

Proofmarks is available under the [MIT License](LICENSE).
