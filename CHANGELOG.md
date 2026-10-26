# Changelog

## 0.1.0 — unreleased

Release candidate frozen on 2026-10-25; npm publication and the release tag are
pending. This will be the first public release. Internal task milestones were
not public releases.

### Rendering

- Eight notation-neutral correction operations: `delete`, `insert`, `replace`,
  `transpose`, `move`, `increase-spacing`, `decrease-spacing`, and
  `cancel-correction`.
- Five notation packs with explicit writing-mode and fidelity states: `jis`,
  `gb`, `cns3927` (Taiwan CNS 3927, independent from GB), `ks`, and `enUS`.
  Each is available from `proofmarks/notations` or its own subpath.
- Vanilla (`createProofmarks`) and React (`Proofmarks`) APIs over selectable DOM
  text, SSR-safe rendering, collision-aware layout, `technical` and `editorial`
  appearances, `showProofmarks`, and the constrained `markStyle` theme.
- React `as` accepts headings `h1`–`h6`, `pre`, `code`, `td`, `th`, and `label`
  in addition to the container elements.
- `animate` turns editorial write-on motion off; vanilla `replay()` plays it
  again. Motion uses Web Animations, so cloned SVG keeps the final ink, and it
  respects reduced motion.
- `onRender({ fidelity, fallbackCount, layoutMs })` reports each completed
  render.
- `onIssue` reports `invalid-corrections`, `insufficient-room`,
  `unsupported-writing-mode`, `unverified-direction`, and `markStyle`
  diagnostics. React reports invalid data instead of throwing; vanilla
  create/update throw.
- `getSourceText` reads source text without overlay labels. The overlay is
  `aria-hidden` and non-selectable, so copy returns source text only.
- Public CSS variables: `--proofmarks-color`, `--proofmarks-stroke-width`,
  `--proofmarks-label-font`, `--proofmarks-halo`, and the editorial
  `--proofmarks-editorial-color`, `--proofmarks-editorial-second-stroke`, and
  `--proofmarks-editorial-font`. `proofmarks/styles.css` is optional.

### Authoring helpers

- `proofmarks/helpers`: `getSourceText`, `offsetsFromSelection`, `findRange`,
  `applyCorrections`, and `correctionsFromDiff`.
- `correctionsFromDiff` accepts `granularity: "word" | "character" | "code"`
  and `idPrefix`. Whitespace-only changes become `decrease-spacing` or
  `increase-spacing`, and exact swaps become `transpose`, whenever
  `applyCorrections` reproduces the result exactly.

### Consumer robustness fixes

- When the source text changed and the corrections no longer fit, stale marks
  are cleared instead of pointing at the wrong words. Unchanged text with
  invalid data keeps the last valid frame.
- `insufficient-room` issues carry `collisions`: `source-text`, `exits-paper`,
  or `annotation`.
- Right-to-left roots report `unverified-direction` once per instance; RTL is
  unverified for every pack.
- A window resize redraws only instances whose measured size changed.
- Instances share one ResizeObserver, font listener, and animation frame per
  document, measure before drawing, and skip repaints for equal option values.
- Leader crossings are penalized more strongly, and fallback labels are
  localized for Japanese, Chinese, Korean, and English.

### Documentation and site

- Reviewed the five locales for proofreading terminology and API accuracy,
  including Korean transpose naming and explicit notation fidelity limits.
- Prepared GitHub Pages builds with deployment-base-aware links, physical route
  entries for direct loads and refreshes, and manual deployment gated by release
  verification.
- Agent guidance (`AGENT_GUIDE.md` in the package, `/llms.txt`,
  `/llms-full.txt`, and the repository snippets) shares one contract covering
  offsets, room and density, helpers, errors, export, and all five packs.
- Get started lives at `/get-started` (`/playground` remains an alias). Docs
  cover helpers, layout room and density, errors and lifecycle, export and
  motion, CSS variables, dark backgrounds, and compatibility.
- Every copyable example reserves `padding: 44px 20px` and `line-height: 1.8`.
- Every Get started and Docs code sample highlights the lines the surrounding
  text explains; the rest recede. Copy still returns the complete, clean source.
- The public site (`/`, `/get-started`, `/docs`, `/marks`) is available in
  English, Japanese, Simplified Chinese, Traditional Chinese, and Korean. A
  header switcher, `?lang=`, a remembered choice, or the browser languages pick
  the language; `/demo` keeps its own captions.
