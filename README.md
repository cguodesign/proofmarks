# proofmarks

Render traditional proofreading notation over normal browser content from plain, notation-neutral correction data.

Version 0.1.0 is a release candidate and is not yet available from npm. To
evaluate it now, clone this repository and run `pnpm install --frozen-lockfile`,
then `pnpm build` or `pnpm dev`.

`proofmarks` is the public wordmark, npm package name, and JavaScript import root.

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
    <Proofmarks as="p" notation={jis} corrections={corrections} lang="ja"
      style={{ padding: "44px 20px", lineHeight: 1.8 }}>
      吾輩は猫である。名前はまだ無い。
    </Proofmarks>
  );
}
```

Change only `jis` to `gb`, `cns3927`, `ks`, or `enUS` to render the same supported correction through a different visual grammar. The correction object never contains notation symbols or drawing coordinates.

## React and vanilla entry points

```ts
import { createProofmarks } from "proofmarks";
import { enUS } from "proofmarks/notations/en-us";
import "proofmarks/styles.css";

const instance = createProofmarks(element, {
  notation: enUS,
  corrections,
  showProofmarks: true,
  markStyle: { ink: "#173b63", strokeScale: 1.15 },
});
instance.update({ notation: enUS, corrections, showProofmarks: false });
instance.update({ notation: enUS, corrections: nextCorrections, showProofmarks: true });
instance.destroy();
```

Public imports:

```ts
import { createProofmarks } from "proofmarks";
import { Proofmarks } from "proofmarks/react";
import { jis, gb, cns3927, ks, enUS } from "proofmarks/notations";
import { jis } from "proofmarks/notations/jis"; // smallest pack-specific entry
```

Offsets use UTF-16 code units over the root's source text, read with `getSourceText(root)` (before mounting this equals the root's `textContent`; afterwards raw `textContent` also includes annotation labels). Nested native markup is supported when that text remains stable. Insertions use `text-point`; delete and replace use non-empty `text-range`; meta-corrections use a stable `correction` reference.

`showProofmarks` is a presentation control and defaults to `true`. Toggling it hides or reveals only the mounted SVG overlay; corrections, accepted DOM text, selection, and layout state stay intact.

`markStyle` is the constrained React and vanilla styling surface: `ink`, `labelInk`, `strokeScale`, and `opacity`. It preserves pack geometry and collision routing; invalid colors and values fall back safely and report through `onIssue`. Stroke scale is clamped to `0.75–1.5` and opacity to `0–1`.

See [the five-minute quickstart](docs/quickstart.md), [the exact V1 public contract](docs/public-api-v1.md), and the [support matrix](docs/support-matrix.md). Chromium, Firefox, and WebKit are tested through Playwright; real Safari, mobile hardware, and right-to-left text are unverified. React 18 and 19 are supported, and server rendering emits the source text. A consumer bundle is about 13 KB gzip for the renderer, 16 KB with one notation pack, and 20 KB with all five.

## Using Proofmarks with coding agents

Inside a consumer project, point the agent at
`node_modules/proofmarks/AGENT_GUIDE.md`, which ships with the package; the site
serves `/llms.txt` and `/llms-full.txt`. In this repository, start with the
[agent guide](docs/agent-guide.md). It gives an agent the exact
correction schema, UTF-16 offset rules, cultural-notation decision boundary,
lifecycle guidance, and tests expected for a consumer integration.

For repository-local instructions, copy and adapt either the
[`AGENTS.md` snippet](docs/snippets/AGENTS.proofmarks.md) or the
[`CLAUDE.md` snippet](docs/snippets/CLAUDE.proofmarks.md). The public site also
serves concise [`/llms.txt`](apps/playground/public/llms.txt) and expanded
[`/llms-full.txt`](apps/playground/public/llms-full.txt) discovery files. The
npm package includes the short guide as `AGENT_GUIDE.md` for offline consumers.

## Styling

For code-driven themes, use the layout-preserving API:

```tsx
<Proofmarks
  notation={jis}
  corrections={corrections}
  markStyle={{ ink: "#173b63", labelInk: "#102a43", strokeScale: 1.15 }}
>
  吾輩は猫である。名前はまだ無い。
</Proofmarks>
```

The optional stylesheet supplies these defaults for the public CSS variables:

```css
[data-proofmarks-root] {
  --proofmarks-color: oklch(52% 0.22 28);
  --proofmarks-stroke-width: 1.75px;
  --proofmarks-label-font: ui-sans-serif, sans-serif;
  --proofmarks-halo: transparent;
  --proofmarks-editorial-color: oklch(50% 0.19 31);
  --proofmarks-editorial-second-stroke: 1.05px;
  --proofmarks-editorial-font: "Bradley Hand", "Segoe Print", "Hiragino Maru Gothic ProN", cursive;
}
```

The first four tokens style the technical appearance; the `editorial` tokens
style `appearance="editorial"`. `markStyle` values take precedence over both.
On dark backgrounds, raise the ink lightness (for example
`oklch(72% 0.17 28)` for both color tokens) and set `--proofmarks-halo` to the
page background so labels stay separate from the text.

Application variables such as `--proof-red` and `--ink` are not package API. V0.1 does not expose raw paths, transforms, offsets, or per-mark SVG hooks.

Writing mode belongs to browser CSS. Proofmarks reads computed layout; it does not duplicate typography with a `writingMode` prop. Unsupported combinations remain readable, draw no fabricated notation, and report through `onIssue`.


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

## Repository development

Requires Node 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open the public site:

- `/` — paper-first overview and live notation switcher;
- `/demo` — “今天付印”, a five-chapter interactive proof with Japanese, Simplified and Traditional Chinese, Korean, and English manuscripts, plus copyable prompts and live example code;
- `/get-started` — install, choose a language, and try two complete examples (`/playground` still works as an alias);
- `/marks` — all eight operations, native-language samples, and shared presentation controls;
- `/docs` — correction data, helpers, layout room and density, errors and lifecycle, customization, export and motion, coverage, compatibility, and notation references.

The former `/references` URL redirects to `/docs#references`.

Standalone demo apps live in [`demos/`](demos) and use only the public package
entry points: `pnpm demo:zhenhua` (React, Chinese UI and samples) and
`pnpm demo:diff-ink` (vanilla, Chinese UI, English sample code).
These apps are included in the public repository as runnable examples. They are
private workspace packages and are excluded from the published npm package;
see the [release policy](docs/public-release-policy.md).

Engineering validation remains available without taking over the public story:

- `/workbench` — internal rendering controls;
- `/suggest` — editor integration and suggestion-review harness;
- `/fixtures/marks` — canonical renderer regression fixtures (development only);
- `/dx` — React/vanilla API workbench;
- `/compare` — same-document, same-correction notation comparison;
- `/layout` — collision routing and editorial appearance lab.

```bash
pnpm typecheck
pnpm test
pnpm test:consumer
pnpm test:browser
pnpm build
pnpm audit:bundle
pnpm verify:release
```

## Architecture

```text
plain Correction data
        ↓
DOM Range + live browser typography
        ↓
logical geometry and correction scale
        ↓
selected notation object
        ↓
SVG overlay
```

The public `proofmarks` package bundles the internal core, DOM engine, and selected notation implementation behind small subpath exports. React is an optional peer used only by `proofmarks/react`; the base package works without it.

The `/suggest` editor demo adds authoring without changing that package boundary:

```text
ProseMirror transaction
        ↓
internal suggesting adapter
        ↓
accepted text + public Correction[]
        ↓
<Proofmarks notation={notation} corrections={corrections}>
```

The accepted proof, not the mutated draft DOM, remains the rendering source.
Typing, deletion, replacement, paste, explicit transpose, Accept, and Reject are
normalized into the existing public correction model. Reject appends a real
`cancel-correction`, so JIS, GB, CNS 3927, KS, and en-US can express the same review
decision through their own visual grammar. The adapter is deliberately internal
to the playground; ProseMirror is not a dependency of the published library.

The audited reference packs are:

- `jis` — Japanese, reference-based JIS Z 8208 reconstruction;
- `gb` — Chinese, reference-based GB/T 14706 reconstruction;
- `ks` — Korean, reference-based KS A 0104 reconstruction;
- `enUS` — traditional American publishing convention, not a national-standard claim.
- `cns3927` — Taiwan CNS 3927, with conservative source-backed mappings and explicit unverified fallbacks; it is not a GB alias.

Capability evidence differs by pack. In particular, English vertical writing is explicitly unsupported, while undocumented GB/KS vertical forms fall back rather than rotating horizontal marks and presenting them as canonical.

## Current scope

Proofmarks V0.1 renders `delete`, `insert`, `replace`, `transpose`, `move`, `increase-spacing`, `decrease-spacing`, and `cancel-correction`. The repository playground validates an internal, plain-text Suggesting adapter with Accept/Reject, while the published renderer still does not own editor state or author corrections; optional `proofmarks/helpers` utilities help a host create them. The optional `appearance="editorial"` renderer adds restrained deterministic hand variation and a reduced-motion-safe write-on treatment; semantic data and notation geometry remain unchanged. Comments, collaboration, persistence, and AI proofreading remain out of scope.

Public integration guides, compatibility information, notation research, and canonical audits live under `docs/`.

## License

Proofmarks is available under the [MIT License](LICENSE).
