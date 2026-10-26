# JIS canonical audit

Status: Task 002B working record, 2026-08-26.

This audit covers only the five Japanese marks already modeled by Proofmarks. “Reference-based” means that geometry has been reconstructed from the strongest material available to this task. It does not mean verified JIS conformity.

## Source hierarchy and access limits

1. The [JSA official preview of JIS Z 8208:2007](https://webdesk.jsa.or.jp/preview/pre_jis_z_08208_000_000_2007_j_ed10_ch.pdf) confirms the title, edition, scope, JFPI/JSA origin, and replacement of JIS Z 8208:1965. Its public preview contains only five front-matter/opening pages and does **not** expose normative Table 1.
2. Geometry was audited against the accessible text and page-image reproduction of [JIS Z 8208:2007 at Kikakurui](https://kikakurui.com/z8/Z8208-2007-01.html), especially Table 1 items 1.1.1, 1.1.4, 1.1.6, 1.1.7, and 1.1.8. This is not an official host.
3. Constructions were cross-checked against the [Japan Printing Industry Federation Hokkaido chart](https://www.print.or.jp/printinghokkaido/no611/no611_image/p16.jpg), [Kyorin proof correction chart](https://www.kyorin.co.jp/uploads/kouseikigo.pdf), and the Japanese proofreading firm [Saishinsha's explanation](https://www.saishinsha.jp/kouseikigou.html).

The normative standard was not available in full from an official open source. All five gallery entries therefore retain the status **REFERENCE-BASED**.

## Architecture principle

```text
semantic operation
≠
localized notation terminology
```

The internal API uses `delete`, `insert`, `replace`, `transpose`, and notation-neutral `cancel-correction`. Japanese UI names follow the reference material rather than translating those enum values mechanically.

## 1. Delete

**Semantic operation**<br>
`delete`

**JIS terminology**<br>
`文字・記号を削除し、その部分を詰める`; annotation `トル` (`トルツメ` is permitted when explicitly clarifying closure).

**Horizontal reference**<br>
Table 1 item 1.1.4 delegates target indication to item 1.1.1. One character receives a diagonal target slash and leader. Two or more characters receive diagonal marks on both endpoint characters plus a centerline through the range; a leader routes to `トル`.

**Vertical reference**<br>
The same semantic components are shown in vertical composition. Boundaries, connector, and leader follow the vertical inline/block axes; the complete mark is not produced by rotating an SVG group.

**Observed construction**<br>
Single-character and multi-character deletion are distinct constructions. Multi-character deletion has meaningful start boundary, range connector, end boundary, leader, and notation label.

**Task 002 implementation**<br>
A single diagonal was stretched across the complete DOMRect, followed by a modern elbow leader. A two-character target therefore looked like a generic strike and did not encode endpoint boundaries.

**Required changes**<br>
- branch on one-character versus multi-character semantic extent
- add explicit start/end boundary primitives and a center range connector
- attach the leader to the range construction
- retain `トル` as real SVG text

**Confidence**<br>
High for inline one-line construction; uncertain for wrapped phrase/block construction, which remains `generic-fallback`.

**Source**<br>
JIS Z 8208:2007 Table 1 items 1.1.1 and 1.1.4 via the accessible reproduction; Kyorin chart cross-check.

## 2. Insert

**Semantic operation**<br>
`insert`

**JIS terminology**<br>
`文字・記号を挿入する`.

**Horizontal reference**<br>
Table 1 item 1.1.6 uses an `∧` insertion anchor in its horizontal example, a leader from the insertion point, and inserted material sandwiched between two parallel lines.

**Vertical reference**<br>
The table uses a `＞` insertion anchor in its vertical example. Inserted material follows the vertical inline direction and is sandwiched by parallel boundaries on its two block sides.

**Observed construction**<br>
Inserted content is not an arbitrary label. It is a notation component with a defined anchor, leader relationship, text orientation, and two content boundaries. JIS permits `＞` or `∧` at the insertion point; it does not uniquely bind one form to each writing mode. This reference rendering uses `∧` in the horizontal example and `＞` in the vertical example. The reference also permits omitting the anchor in an alternate form; Task 002B uses the explicit form.

**Task 002 implementation**<br>
The caret direction was approximately correct through logical coordinates, but the inserted character was a floating SVG label connected by one line. The two-line enclosure was missing.

**Required changes**<br>
- retain the point semantic target
- expose `insertion-anchor`, `leader`, two `insertion-content-boundary` nodes, and `inserted-text`
- route a curved leader into the content enclosure
- keep vertical inserted content upright in vertical flow

**Confidence**<br>
High for inline anchor/enclosure grammar; medium for exact digital spacing and curve proportions.

**Source**<br>
JIS Z 8208:2007 Table 1 item 1.1.6 via the accessible reproduction; Saishinsha insertion explanation.

## 3. Replace

**Semantic operation**<br>
`replace`

**JIS terminology**<br>
`文字・記号を取り替える`. Gallery wording `修正・置換` was a mechanical translation and is not retained.

**Horizontal reference**<br>
Table 1 item 1.1.1: slash the target character and route a leader to replacement material. For two or more characters, slash both endpoints, strike the centerline through the range, then route the replacement material.

**Vertical reference**<br>
The same target-removal grammar is independently placed in vertical composition, with replacement text oriented along the vertical inline axis.

**Observed construction**<br>
Replacement shares target-range primitives with deletion but terminates in replacement material rather than a `トル` label. It remains one public semantic correction, not public `delete + insert` data.

**Task 002 implementation**<br>
Replacement reused the single stretched diagonal and substituted the label text. Multi-character target boundaries were absent, so removal plus replacement was not explicit.

**Required changes**<br>
- reuse audited single/multi target-removal primitives
- route to a real `replacement-text` node
- keep deletion label and replacement material as distinct scene roles

**Confidence**<br>
High for inline target treatment and terminology; medium for digital leader placement.

**Source**<br>
JIS Z 8208:2007 Table 1 item 1.1.1 via the accessible reproduction.

## 4. Transpose

**Semantic operation**<br>
`transpose`

**JIS terminology**<br>
`文字を入れ替える`; short gallery name `入れ替え`.

**Horizontal reference**<br>
Table 1 item 1.1.7 uses an S-shaped or reverse-S-shaped exchange mark for adjacent single characters or adjacent character groups. The path wraps and crosses between the two operands.

**Vertical reference**<br>
The table supplies a separate vertical construction. Logical axes may share a scene algorithm, but the physical result must put the two lobes on opposing block sides of the vertical operands.

**Observed construction**<br>
The mark must expose operand A, operand B, and one exchange path. A wave floating above both operands does not communicate exchange.

**Task 002 implementation**<br>
The curve was placed above the complete range like a spell-check squiggle. It did not traverse the operands and was materially wrong.

**Required changes**<br>
- make the path begin on one block side of operand A, cross at the operand boundary, and finish on the opposite block side of operand B
- support both character-to-character and group-to-group adjacent targets
- retain fallback for separated or multi-line targets

**Confidence**<br>
High for the adjacent S/reverse-S grammar; medium for exact Bézier proportions in digital typography.

**Source**<br>
JIS Z 8208:2007 Table 1 item 1.1.7 via the accessible reproduction; Saishinsha exchange description.

## 5. Cancel correction / イキ

**Semantic operation**<br>
`cancel-correction` (neutral internal action).

**Developer-facing meaning**<br>
Cancel a previous correction; retain the proof as originally set. This is not a generic “keep this text” annotation: it cancels another correction in the annotation system.

**JIS terminology**<br>
`修正を取りやめ、校正刷又は出力見本の状態のままとする`; notation label `イキ`.

**Horizontal reference**<br>
Table 1 item 1.1.8 says `イキ` is written beside the source characters whose correction is being withdrawn. It is not placed at the end of a new leader.

**Vertical reference**<br>
`イキ` remains beside the affected characters, following the composition's nearby block side. The reference example also shows the prior correction instruction canceled.

**Observed construction**<br>
`イキ` cancels the prior correction and preserves the original setting. The state transition concerns an existing correction, not a new transformation of source text.

**Task 002 implementation**<br>
`イキ` was routed from the target by a fresh leader, which authoritative explanatory material warns can be misread as keeping the instruction at the leader tip. This was materially wrong.

**Task 003B relation implementation**<br>
- `cancel-correction` references the prior correction by stable ID
- the prior text geometry is resolved rather than duplicated in the cancellation
- a real `notation-label` is placed beside that referenced target without a new leader
- the core avoids the English-specific name `stet`; locale terminology remains in notation packs

**Confidence**<br>
High for meaning, terminology, and beside-target placement. Uncertain for automatic cancellation of a prior scene; that requires future correction identity/state modeling and is not invented in Task 002B.

**Source**<br>
JIS Z 8208:2007 Table 1 item 1.1.8 via the accessible reproduction; Saishinsha's warning about leader-tip ambiguity.

## Material corrections from Task 002

1. Multi-character delete and replace were not canonical range constructions; they lacked endpoint boundaries and center connectors.
2. Inserted content was a floating label; the required two-line enclosure was absent.
3. Transpose was a decorative wave above the operands instead of an exchange path traversing them.
4. `イキ` was incorrectly connected to a new leader rather than written beside the affected source.
5. Gallery term `修正・置換` was not the reference heading `文字・記号を取り替える`.

These are geometry and terminology corrections only. No new semantic operation or language pack is introduced.

## Task 009C final V0.1 audit

Task 009C rechecked all eight frozen operations as notation × writing mode cases. The technical renderer remains a reference-based reconstruction, not a JIS conformity claim.

| Operation | Semantic and source form | Current reconstruction | H | V | Remaining uncertainty |
| --- | --- | --- | --- | --- | --- |
| delete | `文字・記号を削除する`; endpoint boundaries and connector for a range | Source-relative target construction, leader, real `トル` text | PASS | PASS | Wrapped targets remain fallback. |
| insert | `文字・記号を挿入する`; ＞ or ∧, leader, bounded material | ∧ in H and ＞ in V specimen; payload uses measured source face at 0.9em | PASS | PASS | Exact curve and gap are reconstructed. |
| replace | `文字・記号を取り替える`; removal grammar plus material | Shared audited removal primitives with source-relative replacement text | PASS | PASS | Lane placement is reconstructed. |
| transpose | `文字を入れ替える`; S/reverse-S | One path crossing adjacent operands | PASS | PASS | Separated and wrapped operands fall back. |
| move | `指定位置へ移動` | JIS-specific source stroke, routed leader, destination arrow, `移` | PASS | PARTIAL | V0.1 vertical uses generic fallback. |
| increase-spacing | spacing increase / アキ | Source-relative caret topology plus `アキ` | PASS | PARTIAL | Amount and vertical form are deferred. |
| decrease-spacing | ベタ組 | Opposing close-up curves plus `ベタ` | PASS | PARTIAL | Vertical form is fallback. |
| cancel-correction | `修正を取りやめる`; イキ | Relation-aware beside-target `イキ`, no new leader | PASS | PASS | Exact automatic cancellation strokes are not inferred. |

### Material before / after log

- **Insert:** fixed 12/15px payload and 6/7px caret dimensions became measured source typography with named caret depth, payload extent, boundary gap, and lane distance.
- **Move:** the generic rounded target used by all systems became a JIS source stroke and a JIS-specific routed construction.
- **Spacing:** anonymous pixel offsets became source-relative `mark`, `gap`, and `lane` units; `アキ` and `ベタ` remain real text.
- **Presentation:** technical stroke width now scales conservatively with the source em and clamps at small and display sizes.

The JIS preferred local placement remains the nearby completed-proof side where space permits; Task 008 may escalate to a lane without changing the source anchor.
