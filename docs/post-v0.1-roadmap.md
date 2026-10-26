# Post-V0.1 roadmap

## Agreed next additions

These are planned additions, not implemented features or V0.1 release blockers.

### Live theme editor

Let users adjust a theme against a live proof and copy working configuration
directly into their application.

- Start with the existing public `markStyle` controls: ink, label ink, stroke
  scale, and opacity, plus the `technical` / `editorial` appearance selector.
- Preview the result with supported notation packs and representative corrections.
- Copy React or vanilla integration code using the existing public API. Include
  any required public CSS tokens or host typography styles in the copied output.
- Keep proof typography and paper styles distinguishable from mark styling.
  Theme controls must preserve notation geometry and cultural meaning.
- Keep source text selectable and respect reduced motion in the live preview.

### Original and revised text to proof

Accept an original and a revised text, derive notation-neutral `Correction[]`,
and render the resulting proof using the selected notation pack.

- Begin with delete, insert, and replace. Automatic move and transpose inference
  require a separate editorial-intent decision.
- Respect text boundaries, including CJK text and emoji, while producing the
  UTF-16 offsets required by the current public contract.
- Keep correction generation separate from rendering so it can serve both the
  interactive site and library consumers.

## Export under consideration

Proof export means producing a deliverable: for example, a standalone HTML proof,
a printable proof, or a correction-data file that another tool can consume.
Saving a session for later editing is persistence and is a separate feature.
The initial export format and scope remain undecided; PDF output would require
verification of pagination, fonts, selectable text, and mark placement.

## Other deferred topics

These topics remain deferred and are not release blockers:

- additional proofreading operations and structural paragraph/line semantics;
- additional notation systems;
- verified vertical constructions beyond the V0.1 matrix;
- a stable third-party notation authoring SDK;
- richer editor integrations beyond the internal plain-text Suggesting adapter;
- comments, collaboration, and session persistence;
- AI-assisted correction generation;
- exact typographic spacing quantities and advanced type-style instructions;
- broader real-device, real-IME, Safari, screen-reader, and performance coverage;
- optional spatial indexing if real documents demonstrate a 100-correction need.

New notation ideas require sources and must not be added by symmetry with an existing pack.
