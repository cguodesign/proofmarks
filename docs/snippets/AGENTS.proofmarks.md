# Proofmarks consumer guidance

Read `node_modules/proofmarks/AGENT_GUIDE.md` (shipped with the package) before
changing a Proofmarks integration. The site's `/llms-full.txt` has the same
contract in more detail.

When adding or changing Proofmarks integration:

- Install `proofmarks`. React uses `Proofmarks` from `proofmarks/react`; vanilla
  code uses `createProofmarks` from `proofmarks`. Import a pack from
  `proofmarks/notations` or a pack-specific subpath. `proofmarks/styles.css` is
  optional and only supplies default CSS variable values.
- Use typed, notation-neutral `Correction` data. V0.1 supports exactly
  `delete`, `insert`, `replace`, `transpose`, `move`, `increase-spacing`,
  `decrease-spacing`, and `cancel-correction`.
- Compute offsets as UTF-16 code units over `getSourceText(root)`. Before
  mounting it equals the root's `textContent`; after mounting, raw `textContent`
  also includes SVG labels. Verify ranges against that exact string; do not use
  grapheme, code point, word, or byte indices.
- Give corrections stable unique IDs. `insert` uses a `text-point` plus
  `content`; `replace` uses a non-empty `text-range` plus `replacement`;
  `decrease-spacing` must select existing whitespace only.
- Keep symbols, coordinates, SVG, CSS, notation IDs, and writing direction out
  of correction JSON. Browser CSS owns writing mode.
- Choose `jis`, `gb`, `cns3927`, `ks`, or `enUS` only from explicit user or
  product context. Ask when the convention is unspecified, or expose a picker so
  end users choose. Check notation support and handle `onIssue`; never fabricate
  an unsupported mark. Right-to-left text reports `unverified-direction`.
- Reserve room: `padding: 44px 20px` and `line-height: 1.8` on the root; start
  with 3–6 word-level corrections across 2–4 lines. Handle `insufficient-room`
  (its `collisions` field says what overlaps) by adding room or showing fewer.
- In React, update props declaratively; invalid data reports
  `invalid-corrections` through `onIssue`. In vanilla code, call `update` and
  `destroy`, and catch errors from create/update. On validation failure, old
  marks clear only if source text changed. Valid offsets can still target the
  wrong words; rebase or regenerate corrections whenever text changes.
  Do not use both lifecycles on one element.
- Preserve native selectable, copyable, accessible text. `showProofmarks` hides
  only the overlay; it does not apply or reject corrections.
- Use `markStyle` only for `ink`, `labelInk`, `strokeScale`, and `opacity`.
  It must not change notation geometry; handle its `onIssue` diagnostics.
- The renderer draws supplied corrections. Optional `proofmarks/helpers`
  (`findRange`, `offsetsFromSelection`, `correctionsFromDiff`,
  `applyCorrections`, `getSourceText`) help the app author them;
  `applyCorrections` throws on conflicting corrections. Do not make Proofmarks
  own editor state, proofreading inference, collaboration, persistence, or
  accept/reject logic.
- Editorial motion uses Web Animations, so cloned SVG holds final ink; set
  `animate: false` before capture only for exporters that copy computed styles.
- Before finishing, run type checking and a browser-level integration test.

Secondary reference: `docs/agent-guide.md` in the Proofmarks repository.
