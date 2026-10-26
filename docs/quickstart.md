# Proofmarks five-minute quickstart

## 1. Install

```bash
npm install proofmarks
```

## 2. Render one correction in React

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
    <Proofmarks as="p" notation={jis} corrections={corrections} lang="ja">
      吾輩は猫である。名前はまだ無い。
    </Proofmarks>
  );
}
```

The range `8..10` selects `名前`. Proofmarks renders the children normally on the server and attaches geometry after the component mounts in a browser.

## 3. Change the notation, not the correction

```diff
- import { jis } from "proofmarks/notations";
+ import { gb } from "proofmarks/notations";

- <Proofmarks notation={jis} corrections={corrections}>
+ <Proofmarks notation={gb} corrections={corrections}>
```

The same semantic object can also be used with `cns3927`, `ks`, and `enUS` where the operation and writing mode are supported. `cns3927` is the Taiwan-specific pack and is not an alias of `gb`. Notation capability is reported by each notation object's `writingModes`, `supportedCorrections`, and operation-level `support` metadata.

## Offset rules

Offsets count UTF-16 code units in the root element's flattened source `textContent`, in descendant text-node order. The SVG overlay is excluded.

```tsx
<Proofmarks notation={enUS} corrections={corrections}>
  The <em>editor</em> reviewed the manuscript.
</Proofmarks>
```

For this tree, offset `4` is the `e` in `editor` and the range `4..10` selects the whole word. Native nested markup is safe when its flattened text remains stable. Portals, hidden duplicate text, generated CSS content, and components that independently rewrite their DOM are not stable offset anchors in V1.

Target forms:

```ts
{ kind: "text-range", start: 4, end: 10 } // non-empty range
{ kind: "text-point", offset: 24 }         // insertion point
{ kind: "correction", correctionId: "d1" } // prior correction
```

Offsets are not grapheme indices. Emoji and some composed characters can occupy more than one UTF-16 code unit.

`decrease-spacing` must select only whitespace that already exists in this flattened source. Standalone validators can check its target shape and numeric bounds; the DOM renderer performs the additional source-content check.

## Vanilla DOM

```ts
import type { Correction } from "proofmarks";
import { createProofmarks } from "proofmarks";
import { enUS } from "proofmarks/notations/en-us";
import "proofmarks/styles.css";

const corrections = [
  {
    id: "delete-editor",
    type: "delete",
    target: { kind: "text-range", start: 4, end: 10 },
  },
] as const satisfies readonly Correction[];

const proof = createProofmarks(element, { notation: enUS, corrections });
proof.update({ notation: enUS, corrections: nextCorrections });
proof.destroy();
```

The React component calls this same lifecycle engine automatically.

## Styling and issues

Prefer the layout-preserving `markStyle` API when styling from React or vanilla JavaScript:

```tsx
<Proofmarks
  notation={enUS}
  corrections={corrections}
  markStyle={{
    ink: "#173b63",
    labelInk: "#102a43",
    strokeScale: 1.15,
  }}
>
  The editor reviewed the manuscript.
</Proofmarks>
```

```ts
const proof = createProofmarks(element, {
  notation: enUS,
  corrections,
  markStyle: { ink: "#173b63", strokeScale: 1.15 },
  onIssue: (issue) => console.warn(issue.code, issue.message),
});
```

This changes presentation, not notation grammar or geometry. `strokeScale` is clamped to `0.75–1.5`; `opacity` is clamped to `0–1`; invalid CSS colors and invalid numeric values fall back safely and report an `onIssue` diagnostic. V0.1 does not expose paths, offsets, transforms, or raw SVG hooks.

The stylesheet also provides a small host-level token surface:

```css
.proof-document {
  --proofmarks-color: #c22;
  --proofmarks-stroke-width: 2px;
  --proofmarks-label-font: system-ui, sans-serif;
  --proofmarks-halo: white;
  /* appearance="editorial" */
  --proofmarks-editorial-color: #c22;
  --proofmarks-editorial-second-stroke: 1px;
  --proofmarks-editorial-font: "Segoe Print", cursive;
}
```

On dark backgrounds, raise the ink lightness (for example `oklch(72% 0.17 28)`)
and set `--proofmarks-halo` to the page background.

Writing mode comes from computed CSS such as `writing-mode: vertical-rl`. If a valid correction cannot be represented in that writing mode, the source content remains visible, no imitation is drawn, and the optional callback receives an issue:

```tsx
<Proofmarks
  notation={enUS}
  corrections={corrections}
  onIssue={(issue) => console.warn(issue.code, issue.message)}
>
  The editor reviewed the manuscript.
</Proofmarks>
```

See `docs/public-api-v1.md` for the frozen contract and capability behavior.


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

React catches invalid or stale correction data and reports `invalid-corrections`
through `onIssue` instead of throwing. If the source text changed since the last
render, the stale marks are cleared so none point at the wrong words; if the
text is unchanged, the previous valid overlay stays (an invalid first mount shows
an empty overlay). Corrected props recover automatically. Vanilla
`createProofmarks` and `update` still throw for invalid data, with the same
clearing rule; catch those calls. Observer-driven refreshes report through
`onIssue` without an uncaught error. Validation messages include the correction
ID when available. Proofmarks never repairs offsets: rebase or regenerate the
corrections when the text changes.

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
window resize redraws only instances whose measured size changed.

`onRender({ fidelity, fallbackCount, layoutMs })` reports each completed render.
`fidelity` contains one entry per correction in dependency order; `layoutMs`
measures placement only. No-op updates do not call `onRender`.
