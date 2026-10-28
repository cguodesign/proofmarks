# Known limitations for Proofmarks V0.1

- Offsets are UTF-16 code units over flattened source `textContent`, not grapheme clusters.
- Nested native text nodes are supported when flattened text remains stable. Portals, CSS generated content, hidden duplicate text, and independently rewritten DOM are not stable anchors.
- Single-rectangle targets are the canonical inline surface. Inline markup can produce multiple measured rectangles even on one visual line. Wrapped, multi-rect, phrase, and block cases may use generic fallback.
- `decrease-spacing` must select existing whitespace only. The DOM renderer enforces source content; standalone validators can enforce shape and bounds only when given a numeric text length.
- A malformed correction collection rejects the render/update as a whole. Vanilla create/update throw; React and observer refreshes report `invalid-corrections` through `onIssue`. If the source text is unchanged, a rejected update leaves the previous valid overlay intact. If validation fails after the source text changed, old marks are cleared. Bounds-valid offsets may still target the wrong words, which the engine cannot detect; the host must rebase or regenerate corrections whenever text changes. The engine does not silently repair or partially apply malformed data.
- Separate schema-valid corrections may overlap or contain one another. The rendering library preserves authored correction order and routes the resulting scenes deterministically; it does not infer editorial precedence. The repository Suggesting adapter uses the stricter authoring policy: an edit that overlaps or crosses an unresolved suggestion is rejected atomically with the accepted text, working text, correction list, history, and overlay unchanged.
- English · US vertical writing is unsupported. GB and KS vertical forms and JIS vertical movement/spacing use explicit generic fallbacks.
- The public package accepts only Proofmarks-supplied opaque notation objects. A third-party pack SDK is not frozen.
- Begin with 3–6 word-level corrections across 2–4 lines and root padding around 44px in the block direction. This is a readability guideline, not a hard limit. `insufficient-room` reports unresolved label collisions and lists them as `source-text`, `exits-paper`, or `annotation`. Dense proofs around 100 corrections are a crash/performance boundary, not a promise of editorial beauty. Layout uses deterministic greedy placement, not global optimization.
- Right-to-left text is unverified for every pack: marks follow the measured glyphs but strokes and labels are not mirrored. The renderer reports `unverified-direction`.
- Real Safari, real OS Japanese/Chinese/Korean IME sessions, real screen-reader sessions, and mobile hardware performance remain unverified in this local task.
- The Suggesting editor is a repository demo and internal adapter, not part of the published package API.

- The SVG remains inside the root: raw `textContent` includes annotation labels. Use `getSourceText(root)` for offsets. Normal selection/copy excludes the non-selectable overlay.
- Cloned or serialized SVG contains final ink. Exporters that copy computed styles from the live page can capture an in-progress animation; set `animate: false` before capturing with those.
