# Proofmarks integration

Read `node_modules/proofmarks/AGENT_GUIDE.md` (shipped with the package) first.
Follow these rules whenever you work with the `proofmarks` library:

1. Use `Proofmarks` from `proofmarks/react` for React, or `createProofmarks`
   from `proofmarks` for vanilla DOM code. Choose one notation pack from
   `proofmarks/notations` or its pack-specific subpath. `proofmarks/styles.css`
   is optional; it only supplies default CSS variable values.
2. Model only these eight operations: `delete`, `insert`, `replace`,
   `transpose`, `move`, `increase-spacing`, `decrease-spacing`, and
   `cancel-correction`. Keep correction IDs stable and unique.
3. Compute every target over `getSourceText(root)`. Before mounting it equals
   the root's `textContent`; after mounting, raw `textContent` also includes SVG
   labels. Offsets are UTF-16 code units, not grapheme, code point, word, or
   byte indices. Use `findRange` or `offsetsFromSelection` from
   `proofmarks/helpers` and verify the selected substring in tests.
4. `insert` needs a `text-point` and `content`; `replace` needs a non-empty
   `text-range` and `replacement`; `decrease-spacing` must select existing
   whitespace only.
5. Correction JSON is notation-neutral. Never put proof symbols, SVG paths,
   geometry, CSS, notation IDs, or writing direction in it.
6. Do not guess a cultural convention. Use `jis`, `gb`, `cns3927`, `ks`, or
   `enUS` only when the request or product context identifies it; otherwise
   ask, or expose a picker so end users choose. Inspect the pack's support
   metadata, report `onIssue`, and never invent an unsupported mark.
   Right-to-left text reports `unverified-direction`.
7. Reserve room with `padding: 44px 20px` and `line-height: 1.8` on the root,
   start with 3–6 word-level corrections across 2–4 lines, and handle
   `insufficient-room` (see its `collisions` field) by adding room or showing
   fewer corrections.
8. Keep React declarative; it reports invalid data as `invalid-corrections`
   through `onIssue`. In vanilla code, update the instance, catch errors from
   create/update, and destroy it on teardown. Stale marks are cleared when the
   text changed. Preserve real selectable and accessible browser text.
9. Treat `showProofmarks` and `appearance` as presentation only. The renderer
   draws supplied corrections; optional `proofmarks/helpers` utilities
   (`correctionsFromDiff`, `applyCorrections`) help the app author them, and
   `applyCorrections` throws on conflicting corrections. Proofmarks does not
   mutate accepted text or own accept/reject, editor state, collaboration,
   persistence, or AI proofreading.
10. Editorial motion uses Web Animations, so cloned SVG holds final ink; set
    `animate: false` before capture only for exporters that copy computed
    styles.
11. Run type checking and a browser integration test before completing changes.

Secondary references: `docs/agent-guide.md` and `docs/public-api-v1.md` in the
Proofmarks repository, or the site's `/llms-full.txt`.
