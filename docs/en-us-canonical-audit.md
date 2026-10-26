# English · US canonical audit

Status: Task 005 implementation audit, 2026-08-26.

## Positioning

Proofmarks identifies this pack as `English · US` and describes it as **Traditional US proofreading**. It does not claim a national American standard, GPO conformity, or universal publisher practice.

Unlike JIS Z 8208, GB/T 14706, or KS A 0104, the reviewed American material does not point to one national normative table. The pack therefore triangulates recurring constructions across multiple US institutional publishing and teaching sources. Differences among publishers and house styles remain expected.

## Sources reviewed

### 1. Oregon Judicial Department style manual

The [Oregon Appellate Courts Style Manual](https://www.courts.oregon.gov/publications/Documents/UpdatedStyleManual2002.pdf), printed page 117, includes a visual appendix titled “Standard Proofreader's Marks.” It shows:

- a caret for a correction indicated in the margin;
- dotted marks under original proof plus `Stet` in the margin;
- `tr` for transposing indicated letters or words;
- distinct delete and delete-and-close-up instructions;
- punctuation insertion examples.

This is the strongest reviewed source for the implemented STET construction and for keeping delete separate from whitespace close-up.

### 2. Caltech thesis guidelines

Appendix C of the [Caltech PhD Thesis Guidelines, revision 04-2024](https://gradoffice.caltech.edu/documents/28130/phd-thesis_guidelines_rev_04-2024.pdf) reproduces commonly used proofreader's marks, including delete, close up, delete-and-close-up, transpose, STET, and punctuation insertion. It corroborates the operation inventory and the fact that a deletion does not automatically own adjacent whitespace.

### 3. MIT OpenCourseWare

The [MIT OpenCourseWare Proofreader's Marks resource](https://ocw.mit.edu/courses/15-279-management-communication-for-undergraduates-fall-2012/resources/mit15_279f12_proofrdrmarks/) provides applied examples for word and letter deletion, caret insertion with actual material, letter replacement, transposed words with `TR`, and canceling a change with `STET` plus marks beneath the original proof.

It is especially useful for the Task 005 decision to render one semantic `replace` as a composition of deletion and insertion primitives.

### 4. U.S. Government Publishing Office

The [U.S. Government Publishing Office Style Manual, 2016](https://www.gpo.gov/fdsys/pkg/GPO-STYLEMANUAL-2016/pdf/GPO-STYLEMANUAL-2016.pdf) documents federal institutional proof-correction practice and cautions that transposition must remain readable. It establishes professional US publishing context, but its authority for GPO work does not create a national proofreading-mark standard.

## Implemented operation decisions

| Semantic operation | Implemented horizontal construction | Evidence boundary |
| --- | --- | --- |
| `delete` | target stroke plus curled dele tail | reference-based for one inline DOM rect; producer explicitly owns punctuation and whitespace in the target |
| `insert` | caret at the text position, leader, and actual inserted material | reference-based for a horizontal inline point; word and punctuation fixtures are separate |
| `replace` | deletion construction plus caret, leader, and replacement text | remains one semantic correction; visual composition does not change the API |
| `transpose` | separate operand brackets plus `tr` | reference-based for adjacent letters or words on one line; other layouts fall back |
| `cancel-correction` | short dotted retention marks beneath the referenced proof plus `stet` | requires a real `CorrectionReferenceTarget` and resolved prior correction |

The pack ID is `en-us-traditional-reference`. The name is deliberately non-normative.

## Writing-mode capability

The pack declares:

```ts
writingModes: ["horizontal-tb"]
```

No reviewed source established a traditional US vertical proofreading grammar. For `vertical-rl`, dispatch returns an empty scene with fidelity `unsupported`. It does not rotate the horizontal construction and does not imply that a neutral fallback is culturally meaningful.

This behavior is derived from `NotationPack.writingModes`; the UI does not special-case `en-US`.

## Latin and whitespace range audit

DOM ranges still use UTF-16 offsets. Task 005 adds explicit tests for:

- a complete English word;
- the difference between targeting `very` and `very `;
- punctuation insertion at an exact collapsed position;
- curly quotation marks;
- an em dash;
- a typographic apostrophe;
- accented Latin text such as `Café`.

The renderer does not infer close-up behavior from a deletion. If a correction producer wants the trailing space removed, that space must be part of the semantic text target.

## Product fixtures

The English gallery uses native English samples rather than displaying an American mark over Japanese body text. It covers:

- punctuation deletion;
- word plus trailing-space deletion;
- word and comma insertion;
- word and phrase replacement;
- adjacent-letter and adjacent-word transpose;
- STET canceling a prior word deletion.

The `/compare` route intentionally keeps one shared engineering document, target, and correction across JIS, GB, KS, and US packs. It proves notation independence; it is not the cultural showcase.

## Deferred

- English · UK or other regional traditions;
- exhaustive American mark inventory;
- individual publisher or house-style variants;
- separated or multi-line transposition forms;
- phrase/block-scale canonical scenes;
- vertical writing;
- handwritten variation and collision routing;
- Safari and Firefox verification.

## Task 009C final V0.1 audit

The pack remains **Traditional US proofreading**, triangulated across institutions rather than presented as a national standard.

| Operation | Traditional form | Current reconstruction | H | V | Remaining uncertainty |
| --- | --- | --- | --- | --- | --- |
| delete | dele stroke/tail | Target stroke and curled tail; whitespace remains producer-owned | PASS | UNSUPPORTED | Publisher curl variants remain. |
| insert | caret plus material | Caret, leader, actual word/punctuation in source face | PASS | UNSUPPORTED | Exact margin placement varies. |
| replace | dele + caret | One semantic replace composed from both constructions | PASS | UNSUPPORTED | House styles vary. |
| transpose | operand marks + `tr` | Separate brackets plus real `tr` text | PASS | UNSUPPORTED | GPO prefers replacement for some letter transpositions. |
| move | move instruction | Range-to-position route with `move` label | PASS | UNSUPPORTED | Directional abbreviations vary. |
| increase-spacing | number sign | Source-relative number-sign topology | PASS | UNSUPPORTED | House-style variants exist. |
| decrease-spacing | close-up curves | Opposing curves around selected whitespace | PASS | UNSUPPORTED | Delete-and-close-up remains a distinct composition. |
| cancel-correction | dots + `stet` | Dots under referenced proof plus `stet` | PASS | UNSUPPORTED | Capitalization and margin style vary. |

### Material before / after log

- Inserted and replacement material changed from fixed 15px UI-like text to measured-source 0.9em editorial material.
- Technical labels changed from a heavy fixed weight to a restrained 550 default; `tr`, `stet`, and `move` remain real SVG text.
- Stroke width now scales with the source em using clamps, preventing 1px hairlines at 32px text and heavy strokes at 12px.
- Vertical remains an empty unsupported scene; no rotated English proofmarks are produced.
