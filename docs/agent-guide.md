# Using Proofmarks with coding agents

This guide is the canonical context for an agent that adds Proofmarks to a
consumer application. Give the agent this file, or copy the shorter
[`AGENTS.md`](snippets/AGENTS.proofmarks.md) or
[`CLAUDE.md`](snippets/CLAUDE.proofmarks.md) snippet into the consumer repository.

Inside a consumer project, the installed package carries the offline contract at
`node_modules/proofmarks/AGENT_GUIDE.md`; read that first. The public site serves
`/llms.txt` and `/llms-full.txt`. Repository links are secondary references.

Proofmarks renders notation-aware proofreading marks over real, selectable
browser text. The renderer consumes corrections; it does not discover mistakes,
rewrite text, own editor state, or accept and reject changes. The optional
`proofmarks/helpers` entry provides small authoring utilities (offsets, a
plain-text diff, applying corrections) that run in your application, not in the
renderer.

## Install and import

```bash
npm install proofmarks
```

React applications use the React entry and one notation pack. Reserve room for
annotations on the root:

```tsx
import type { Correction } from "proofmarks";
import { jis } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";
import "proofmarks/styles.css"; // optional default tokens

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
      notation={jis}
      corrections={corrections}
      appearance="editorial"
      lang="ja"
      style={{ padding: "44px 20px", lineHeight: 1.8 }}
    >
      吾輩は猫である。名前はまだ無い。
    </Proofmarks>
  );
}
```

Vanilla applications use the root entry and must destroy the instance when its
source element leaves the page:

```ts
import { createProofmarks } from "proofmarks";
import { enUS } from "proofmarks/notations/en-us";

element.style.padding = "44px 20px";
element.style.lineHeight = "1.8";

const proof = createProofmarks(element, {
  notation: enUS,
  corrections,
  onIssue: (issue) => console.warn(issue.code, issue.message),
});

proof.update({ notation: enUS, corrections: nextCorrections });
proof.destroy();
```

Use `proofmarks/notations/jis`, `/gb`, `/cns3927`, `/ks`, or `/en-us` when only one pack is
needed. Use `proofmarks/notations` for the aggregate `jis`, `gb`, `cns3927`, `ks`, and
`enUS` exports. `proofmarks/styles.css` is optional: it only supplies default
values for the public CSS variables, and marks render without it.

## Build valid correction data

V0.1 has exactly eight semantic operations:

| Operation | Required data |
| --- | --- |
| `delete` | One non-empty `text-range` target. |
| `insert` | One `text-point` target and non-empty `content`. |
| `replace` | One non-empty `text-range` target and non-empty `replacement`. |
| `transpose` | Two ordered, non-overlapping `text-range` targets. |
| `move` | One source `text-range` and a destination `text-point` outside it. |
| `increase-spacing` | One boundary `text-point`. |
| `decrease-spacing` | One non-empty `text-range` containing existing source whitespace only. |
| `cancel-correction` | A stable `correction` reference to an earlier correction ID. |

Every correction needs a stable, unique string `id`. Offsets must be finite
integers inside the source bounds. Do not add proofreader symbols, drawing
coordinates, SVG, CSS values, notation IDs, or writing direction to correction
JSON. The selected notation pack owns visual grammar; browser CSS owns writing
mode.

## Compute offsets from the actual source text

Offsets count UTF-16 code units over the root's source text: its descendant text
nodes in document order, excluding the Proofmarks overlay. Read that string with
`getSourceText(root)` from `proofmarks` or `proofmarks/helpers`. Before the first
mount it equals the root's `textContent`; after mounting, raw `textContent` also
contains SVG annotation labels, so always use `getSourceText`. Offsets are not
grapheme, code point, word, or byte indices. Emoji and some composed characters
occupy more than one UTF-16 code unit.

Compute offsets programmatically, for example with `findRange(text, phrase, nth)`
or `offsetsFromSelection(root, range)`, and verify the selected substrings in a
test. Keep the source text stable while a correction is active. Generated CSS
content is not source text; hidden duplicate text and independently rewritten
DOM are poor offset anchors.

`validateCorrection(value, textLength)` checks one value (useful for a single
user-added correction) and `validateCorrections(corrections, textLength)` checks
a collection, including relations and optional bounds. The DOM renderer performs
the additional check that a `decrease-spacing` target contains whitespace only.

## Choose notation without guessing

Select a pack from explicit product or user context:

- `jis` for the Japanese JIS reference pack;
- `gb` for the Simplified Chinese GB reference pack;
- `cns3927` for the Taiwan CNS 3927 pack (Traditional Chinese, not a GB alias);
- `ks` for the Korean KS reference pack;
- `enUS` for traditional American publishing convention.

If the convention is not specified, ask, or expose a picker so end users choose
the notation themselves (each pack's `displayName` and `locale` can label it).
Do not infer it solely from UI locale or assume one tradition's mark by visual
symmetry. Before using an operation or vertical writing mode, inspect
`notation.support`, `notation.writingModes`, and the
[support matrix](support-matrix.md).

Set writing direction with CSS such as `writing-mode: vertical-rl`. There is no
`writingMode` prop. Unsupported combinations preserve the readable source, omit
the fabricated mark, and report `unsupported-writing-mode` through `onIssue`.
Right-to-left text is unverified for every pack: marks follow the measured
glyphs but are not mirrored, and `onIssue` reports `unverified-direction` once.

## Reserve room and keep edits small

Annotations are drawn inside the root's box. Start with `padding: 44px 20px`
and `line-height: 1.8` on the root, and keep ancestor overflow visible.
`overflow: visible` alone does not reserve space. Begin with 3–6 word-level
corrections across 2–4 lines; this is a readability guideline, not a hard cap.
Proofmarks suits a few word-level edits. Filter whole-paragraph rewrites in the
host before rendering.

`insufficient-room` reports a label that still collides; its `collisions` field
lists `source-text`, `exits-paper`, or `annotation`. Respond by adding padding or
line-height, or by showing fewer corrections.

## Respect lifecycle and rendering boundaries

- In React, change `notation`, `corrections`, `appearance`, `showProofmarks`,
  and `markStyle` declaratively. Do not also call `createProofmarks` for the
  same element. Inline option objects and callbacks do not cause repaints.
- In vanilla code, call `update` with the full options object when options
  change and `destroy` on teardown.
- Invalid data: React never throws for it; it reports `invalid-corrections`
  through `onIssue`. Vanilla `createProofmarks` and `update` throw; catch them.
  Observer-driven refreshes report through `onIssue`. On validation failure,
  changed source clears old marks; unchanged source keeps the last valid frame.
  Bounds-valid offsets may still target the wrong words; this is not detected.
  Rebase or regenerate corrections whenever text changes.
- Server rendering emits source content; the overlay attaches in the browser.
- `showProofmarks` changes only overlay visibility. It does not accept, reject,
  apply, or erase corrections.
- Keep native text selectable, copyable, and accessible. The overlay is
  `aria-hidden` and non-selectable, so copying returns only the source text. Do
  not replace the text with a canvas or duplicate typeset layer.
- Treat `appearance="editorial"` as presentation. It does not change semantics
  or notation support.
- Keep `markStyle` to `ink`, `labelInk`, `strokeScale`, and `opacity`. It is a
  presentation theme, not a notation grammar or geometry hook; handle its
  validation diagnostics through `onIssue`.

## Motion and export

Editorial motion plays once, on the first non-empty editorial render; later
redraws show final ink. `instance.replay()` plays it again and respects reduced
motion. Motion uses Web Animations, so a serialized or cloned SVG already holds
the final ink. Only exporters that copy computed styles from the live page need
`animate: false` (React: `animate={false}`) before capture. Use `animate: false`
for many static instances too.

## Optional authoring helpers

`proofmarks/helpers` exports `getSourceText`, `offsetsFromSelection`,
`findRange`, `correctionsFromDiff`, and `applyCorrections`. They help your
application create data; the renderer still only draws what it receives.

- `correctionsFromDiff(before, after, { granularity, locale, idPrefix })` is a
  small-text LCS diff. `granularity` is `word` (default), `character`, or `code`
  (identifiers, whitespace runs, and single punctuation). `idPrefix` keeps IDs
  unique across lines. It emits `decrease-spacing`, `increase-spacing`, and
  `transpose` only when `applyCorrections` reproduces the target text exactly.
  It does not decide editorial meaning.
- `applyCorrections(text, corrections)` applies corrections to plain text using
  original offsets. It throws when two corrections conflict (overlap or insert
  inside another's range). `increase-spacing` inserts one ordinary space.

## Recommended agent workflow

1. Read the accepted source with `getSourceText(root)` (or the exact string you
   will render).
2. Choose the notation from explicit context; otherwise ask, or expose a picker
   to end users. Consider all five packs: `jis`, `gb`, `cns3927`, `ks`, `enUS`.
3. Compute UTF-16 offsets with `findRange`, `offsetsFromSelection`, or
   `correctionsFromDiff`, and verify the selected substrings.
4. Create typed data with `satisfies readonly Correction[]` and stable IDs.
5. Reserve room (`padding: 44px 20px`, `line-height: 1.8`) and keep 3–6 small
   corrections across 2–4 lines.
6. Render with either the React or vanilla lifecycle, not both.
7. Handle `onIssue`: `invalid-corrections`, `insufficient-room`,
   `unsupported-writing-mode`, `unverified-direction`, and style diagnostics.
   Never invent an unsupported mark.
8. Run type checking and a browser test that preserves source text and selection.

For the full frozen surface, see the [public API](public-api-v1.md),
[V0.1 contract](v0.1-contract.md), [quickstart](quickstart.md), and
[known limitations](known-limitations-v0.1.md).
