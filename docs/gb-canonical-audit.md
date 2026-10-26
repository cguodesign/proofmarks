# GB/T 14706 canonical audit

Status: Task 003 working record, 2026-08-26.

This audit covers the five semantic operations already modeled by Proofmarks. “Reference-based” means that scene geometry is reconstructed from the cited standard table. It does not mean certification or verified conformity.

## Source hierarchy and access limits

1. The [National Standard Information Public Service Platform record](https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D78887D3A7E05397BE0A0AB82A) establishes the identity and current status of **GB/T 14706-1993, 校对符号及其用法 / Proofreader’s marks and their application**. It records publication on 1993-11-16, implementation on 1994-07-01, a 2025-08-04 review conclusion of continued validity, TC170 ownership, and supervision by the National Press and Publication Administration.
2. Geometry was audited from the public five-page [GB/T 14706—93 table reproduction](https://www.slarc.org.cn/dwyx/attached/file/20240521/20240521153325_825.pdf). It contains the complete 21-item table, usage notes, and Appendix A example.
3. The [Zhangye municipal history office explanation](https://www.zhangye.gov.cn/szb/dzdt/zsbx/201703/t20170301_51832_ghb.html) was used as a government-hosted prose cross-check for `改正`, `删除`, `增补`, and `保留`.

The publicly accessible PDF appears to be a scanned reproduction rather than a digitally signed official distribution. Implemented geometry therefore remains **REFERENCE-BASED**, not certified GB/T conformity.

## Architecture principle

```text
semantic operation
≠
Chinese proofreading term
≠
GB visual grammar
```

The public correction schema uses `delete`, `insert`, `replace`, `transpose`, and notation-neutral `cancel-correction`. The Chinese pack owns `删除`, `增补`, `改正`, `对调`, and `保留` as locale-facing terminology.

## Writing-mode finding

GB/T 14706—93 states that it applies to Chinese and other minority-language proofs, but the table and Appendix A reviewed here demonstrate horizontal composition only. No vertical form for the five audited operations was found in the standard material.

Proofmarks therefore does not rotate the horizontal GB construction and call it canonical. Every `vertical-rl` GB scene is an explicit `generic-fallback` until a strong vertical reference is found.

## 1. Delete

**Semantic operation**<br>
`delete`

**Chinese terminology**<br>
`删除` (table item 2).

**Reference construction**<br>
Circle the character or material to remove and continue from that boundary into the characteristic curled deletion tail. The construction carries no `トル`-like text label.

**Horizontal form**<br>
A target boundary encloses the semantic range. A curled path departs from that boundary and forms the deletion instruction.

**Vertical form**<br>
Not documented in the reviewed material; `generic-fallback`.

**Current implementation**<br>
One closed `target-boundary` path plus an independent `deletion-tail` path. Single-rect inline targets are reference-based. Multi-rect/phrase/block targets fall back.

**Confidence**<br>
High for the operation and circle-plus-tail grammar; medium for digital curl proportions and multi-character circle shaping.

**Source**<br>
GB/T 14706—93 item 2 and Appendix A; Zhangye municipal explanation.

## 2. Insert

**Semantic operation**<br>
`insert`

**Chinese terminology**<br>
`增补` (table item 3).

**Reference construction**<br>
Mark the insertion position, connect it to the added material, and circle that material. When the added material is too large to circle, the table permits describing the range at the page edge.

**Horizontal form**<br>
The current scene uses an open hooked insertion-position path, a leader, a closed boundary around the inserted content, and real SVG text.

**Vertical form**<br>
Not documented in the reviewed material; `generic-fallback`.

**Current implementation**<br>
`insertion-anchor` + `leader` + `content-boundary` + `inserted-text` for inline horizontal geometry.

**Confidence**<br>
High for the point/leader/circled-content relationship; medium for the exact digital hook curvature.

**Source**<br>
GB/T 14706—93 item 3 and Appendix A; Zhangye municipal explanation.

## 3. Replace

**Semantic operation**<br>
`replace`

**Chinese terminology**<br>
`改正` (table item 1), not a mechanical translation of the enum name.

**Reference construction**<br>
Circle the material being corrected and the replacement material, then connect the two circles. For a large target that is difficult to circle, the standard permits showing the correction range at the page edge.

**Horizontal form**<br>
Target boundary, curved leader, content boundary, and replacement text.

**Vertical form**<br>
Not documented in the reviewed material; `generic-fallback`.

**Current implementation**<br>
The semantic correction remains one `replace` operation. The GB pack composes two circles and a leader; it does not inherit JIS slash/range-connector geometry.

**Confidence**<br>
High for the two-circle relationship; medium for digital lane placement and large-target handling, which falls back.

**Source**<br>
GB/T 14706—93 item 1 and Appendix A; Zhangye municipal explanation.

## 4. Transpose

**Semantic operation**<br>
`transpose`

**Chinese terminology**<br>
`对调` (table item 6).

**Reference construction**<br>
The table supplies different constructions for adjacent words and separated words. The adjacent form uses a pair of opposing exchange hooks. The separated form is not equivalent to stretching the adjacent mark.

**Horizontal form**<br>
Two independent `exchange-path` hooks span the two ordered adjacent targets. This is deliberately different from JIS’s single S/reverse-S exchange path.

**Vertical form**<br>
Not documented in the reviewed material; `generic-fallback`.

**Current implementation**<br>
Adjacent character and adjacent group operands are reference-based. Separated or multi-line operands fall back.

**Confidence**<br>
High for the adjacent-vs-separated distinction; medium for exact digital hook proportions.

**Source**<br>
GB/T 14706—93 item 6.

## 5. Cancel correction / retain

**Semantic operation**<br>
`cancel-correction` (neutral internal action).

**Chinese terminology**<br>
`保留` (table item 19).

**Reference construction**<br>
The table requires two simultaneous actions: draw `△` under the originally deleted characters, and draw two vertical strokes on the original deletion mark.

**Horizontal form**<br>
This is a composed correction-state instruction. It cannot be reconstructed from a source-text range alone because the scene must also identify and cancel a prior deletion mark.

**Vertical form**<br>
Not documented in the reviewed material.

**Current implementation**<br>
Task 003B resolves the referenced deletion by stable correction ID. The renderer places a `retention-mark` triangle beneath the referenced text and derives two `cancel-stroke` lines from the actual referenced GB deletion-tail scene. Horizontal single-rect deletion relations are `reference-based`; unsupported geometry remains fallback.

**Confidence**<br>
High for the semantic relationship and required composition; medium for exact digital stroke placement on the reconstructed deletion curl.

**Source**<br>
GB/T 14706—93 item 19; Zhangye municipal explanation.

## JIS assumptions uncovered and removed

1. A deletion does not universally use a target slash plus text label. GB uses a circled target and curled tail with no label.
2. Inserted or replacement content is not universally enclosed by parallel lines. GB circles correction material.
3. Transposition is not universally one S/reverse-S path. GB’s adjacent construction is a pair of opposing hooks.
4. `cancel-correction` cannot be treated as a generic beside-target label across systems. GB requires a composed edit to a referenced deletion mark.
5. A notation pack’s support cannot be inferred from scale alone. Writing-mode evidence matters; GB vertical geometry is currently unverified.

The shared layer required no notation-specific geometry. Only neutral path, line, text, logical coordinates, fidelity metadata, and DOM resolution remain shared.

## Task 009C final V0.1 audit

The eight-operation set is frozen. Horizontal GB scenes are audited independently; every vertical scene remains a labeled generic fallback because no reviewed source supplied a vertical grammar.

| Operation | Reference form | Current reconstruction | H | V | Remaining uncertainty |
| --- | --- | --- | --- | --- | --- |
| delete | item 2: enclosed target with curled tail | Target-sized ellipse and source-em-scaled deletion curl | PASS | PARTIAL | Exact multi-character contour remains reconstructed. |
| insert | item 3: insertion hook, leader, circled material | Hook, independent leader, source-face payload, content boundary | PASS | PARTIAL | Exact hook curvature is medium confidence. |
| replace | item 1: two circled regions joined | Independent target/content boundaries and leader | PASS | PARTIAL | Large page-edge form remains fallback. |
| transpose | item 6: adjacent opposing hooks | Two independent exchange hooks | PASS | PARTIAL | Separated form is not V0.1 canonical. |
| move | item 9: transfer to another position | Rounded source boundary plus orthogonal GB route and arrow | PASS | PARTIAL | Exact label/route placement is medium confidence. |
| increase-spacing | items 15/17 | Number-sign topology at the boundary | PASS | PARTIAL | Explicit physical amount is not modeled. |
| decrease-spacing | item 16 | Opposing close-up curves around whitespace | PASS | PARTIAL | Exact curve proportion is medium confidence. |
| cancel-correction | item 19: △ plus two strokes on old deletion | Relation-aware triangle and cancellation strokes on referenced scene | PASS | PARTIAL | Stroke placement inherits reconstructed curl geometry. |

### Material before / after log

- **Delete:** fixed 9px minimum radii and a fixed 18-40px curl became target- and source-em-relative proportions.
- **Insert/replace:** fixed 12px payload circles and character-count × 8 sizing became measured 0.9em payload sizing using the source font family.
- **Move:** the shared Bézier route was replaced by an orthogonal GB route, preserving the transfer grammar as a separate reconstruction.
- **Vertical:** no horizontal form was rotated or visually upgraded; all claims remain fallback.
