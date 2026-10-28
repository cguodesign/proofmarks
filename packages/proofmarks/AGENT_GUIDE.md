# Proofmarks agent guide

This file ships with the package at `node_modules/proofmarks/AGENT_GUIDE.md` and
is the offline contract for coding agents. The public site also serves
`/llms.txt` and `/llms-full.txt`. The example-rich repository guide
(<https://github.com/cguodesign/proofmarks/blob/main/docs/agent-guide.md>) is a
secondary reference.

- React: import `Proofmarks` from `proofmarks/react`.
- Vanilla: import `createProofmarks` from `proofmarks`; call `update` with the
  full options object and `destroy` with the element lifecycle.
- Notation: import `jis`, `gb`, `cns3927`, `ks`, or `enUS` from
  `proofmarks/notations`, or use a pack-specific subpath (`/jis`, `/gb`,
  `/cns3927`, `/ks`, `/en-us`). `proofmarks/styles.css` is optional; it only
  supplies default CSS variable values.
- Corrections: use stable unique IDs and exactly `delete`, `insert`, `replace`,
  `transpose`, `move`, `increase-spacing`, `decrease-spacing`, or
  `cancel-correction`.
- Offsets: count UTF-16 code units over `getSourceText(root)` (from `proofmarks`
  or `proofmarks/helpers`). Before mounting it equals the root's `textContent`;
  after mounting, raw `textContent` also includes SVG labels. Verify ranges
  against that exact string.
- Spacing: `increase-spacing` targets a `text-point`; `decrease-spacing`
  targets existing whitespace only.
- Semantics: never put notation symbols, coordinates, SVG, CSS, or writing
  direction in correction JSON.
- Culture: do not guess the notation pack. Ask when it is unspecified, or expose
  a picker so end users choose. Check pack support and handle `onIssue`;
  never fabricate an unsupported mark. Right-to-left text is unverified and reports
  `unverified-direction`.
- Room: start with `padding: 44px 20px` and `line-height: 1.8` on the root, keep
  ancestor overflow visible, and begin with 3–6 word-level corrections across
  2–4 lines. `insufficient-room` lists `collisions` (`source-text`,
  `exits-paper`, `annotation`); add room or show fewer corrections.
- Errors: React reports invalid data as `invalid-corrections` through `onIssue`;
  vanilla create/update throw. On validation failure, changed source clears old
  marks; unchanged source keeps the last valid frame. Bounds-valid offsets can
  still target the wrong words; rebase or regenerate them whenever text changes.
- Boundaries: keep real text selectable and accessible; the overlay is
  `aria-hidden` and copy returns source text only. The renderer draws supplied
  data; it does not own editor state, accept/reject, collaboration,
  persistence, or AI proofreading.
- Helpers: optional `proofmarks/helpers` authoring utilities run in your app:
  `getSourceText`, `offsetsFromSelection`, `findRange`, `applyCorrections`, and
  `correctionsFromDiff` (`granularity: "word" | "character" | "code"`,
  `idPrefix`). `applyCorrections` throws when two corrections conflict.
- Motion and export: editorial motion plays once and uses Web Animations, so a
  cloned SVG holds final ink. Set `animate: false` before capture only for
  exporters that copy computed styles, or for many static instances.
- Presentation: `markStyle` may set `ink`, `labelInk`, `strokeScale`, and
  `opacity`. Do not use or request raw SVG geometry hooks; handle invalid style
  diagnostics through `onIssue`.

Workflow: read `getSourceText(root)`, choose the notation (ask or offer a
picker), compute offsets with `findRange` or `offsetsFromSelection`, type data
with `satisfies readonly Correction[]`, reserve room, render with one lifecycle,
handle `onIssue`, then run type checking and a browser integration test.
