# Proofmarks notation capability matrix

Status: Updated with Taiwan CNS 3927 research, 2026-08-30.

## V0.1 runtime coverage

The runtime matrix uses the fixed status vocabulary below. These statuses describe implemented behavior, not mere similarity in a source table.

- **DIRECT** — source-backed notation construction is implemented for this operation and writing mode.
- **COMPOSED** — the semantic operation is expressed using multiple canonical components.
- **GENERIC-FALLBACK** — the engine preserves the semantic correction but uses neutral Proofmarks geometry.
- **UNSUPPORTED** — the pack intentionally emits no mark.
- **UNCERTAIN** — the available evidence is insufficient for a mapping decision.
- **NOT-FOUND** — the reviewed source does not contain an equivalent.

All eight V0.1 operations are direct in horizontal text for JIS, GB, and English · US. Korean horizontal mappings are source-backed reconstructions rather than verified KS geometry; `cancel-correction` remains `GENERIC-FALLBACK`. Taiwan CNS 3927 is intentionally narrower: only horizontal delete, insert, wrong-character replacement, and deletion retention are direct, plus its explicit vertical insertion form. Other CNS cells are `UNVERIFIED` and render through a labelled generic fallback rather than GB geometry. English · US vertical remains `UNSUPPORTED` for every operation.

| Operation | JIS H | JIS V | GB H | GB V | CNS H | CNS V | KS H | KS V | US H | US V |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `delete` | DIRECT | DIRECT | DIRECT | GENERIC-FALLBACK | DIRECT | UNVERIFIED | DIRECT | GENERIC-FALLBACK | DIRECT | UNSUPPORTED |
| `insert` | DIRECT | DIRECT | DIRECT | GENERIC-FALLBACK | DIRECT | DIRECT | DIRECT | GENERIC-FALLBACK | DIRECT | UNSUPPORTED |
| `replace` | DIRECT | DIRECT | DIRECT | GENERIC-FALLBACK | DIRECT | UNVERIFIED | DIRECT | GENERIC-FALLBACK | DIRECT | UNSUPPORTED |
| `transpose` | DIRECT | DIRECT | DIRECT | GENERIC-FALLBACK | UNVERIFIED | UNVERIFIED | DIRECT | GENERIC-FALLBACK | DIRECT | UNSUPPORTED |
| `move` | DIRECT | GENERIC-FALLBACK | DIRECT | GENERIC-FALLBACK | UNVERIFIED | UNVERIFIED | DIRECT | GENERIC-FALLBACK | DIRECT | UNSUPPORTED |
| `increase-spacing` | DIRECT | GENERIC-FALLBACK | DIRECT | GENERIC-FALLBACK | UNVERIFIED | UNVERIFIED | DIRECT | GENERIC-FALLBACK | DIRECT | UNSUPPORTED |
| `decrease-spacing` | DIRECT | GENERIC-FALLBACK | DIRECT | GENERIC-FALLBACK | UNVERIFIED | UNVERIFIED | DIRECT | GENERIC-FALLBACK | DIRECT | UNSUPPORTED |
| `cancel-correction` | DIRECT | DIRECT | DIRECT | GENERIC-FALLBACK | DIRECT for prior delete | UNVERIFIED | GENERIC-FALLBACK | GENERIC-FALLBACK | DIRECT | UNSUPPORTED |

This matrix asks whether five proofreading traditions can express the same editorial intent. It does not assert that similarly named marks have identical geometry or usage rules.

## Status vocabulary

- **direct equivalent** — the reference explicitly provides the same editorial operation.
- **rough equivalent** — a nearby convention exists, but its scope or construction differs.
- **composed equivalent** — the intent exists, but its canonical instruction acts on more than the current semantic target.
- **system-specific** — the operation exists but depends on a convention that should remain inside that notation pack.
- **not found** — no equivalent was found in the material reviewed.
- **uncertain** — the available material is incomplete or secondary; normative review is still required.

## Capability matrix

| Semantic operation | Japanese — JIS Z 8208:2007 | Chinese — GB/T 14706-1993 | Korean — KS A 0104 | en-US conventions | Architectural note |
| --- | --- | --- | --- | --- | --- |
| delete | **direct equivalent** — deletion is indicated as a correction and annotated `トル` / optionally `トルツメ` | **direct equivalent** — `删除`; circle the target and continue into a curled deletion tail, with no text label | **rough equivalent** — Korean official teaching material shows removal and Hancom documents `뺌표`; direct KS geometry remains unverified | **direct equivalent** — dele construction; delete and delete-and-close-up are distinct instructions | Stable core intent; target grammar and whitespace ownership are notation-specific. |
| insert | **direct equivalent** — JIS permits `＞` or `∧` at the insertion point; the audited reference rendering uses `∧` in its horizontal example and `＞` in its vertical example | **direct equivalent** — `增补`; mark the insertion position, connect it to the added material, and circle the material | **rough equivalent** — `넣음표` and insertion behavior are source-supported outside the inaccessible KS table | **direct equivalent** — caret plus the actual inserted word or punctuation | Stable point semantic; enclosure grammar is notation-specific. |
| replace | **direct equivalent** — mark target and route replacement material; construction varies with target extent and writing mode | **direct equivalent** — `改正`; circle both original and replacement material and join the circles | **rough equivalent** — official teaching examples and Hancom `고침표` support the intent and horizontal reference form | **direct equivalent** — visual composition of dele plus caret and replacement material | One stable `replace` semantic may produce multiple notation nodes. |
| transpose | **direct equivalent** — adjacent and separated material use different constructions | **direct equivalent** — `对调`; adjacent and separated words have distinct constructions; the adjacent form uses paired hooks | **rough equivalent** — Hancom `자리 바꿈표` supports adjacent character/word reversal; normative KS geometry remains unverified | **direct equivalent** — identify the operands and add `tr` | Stable two-target intent; adjacency selects notation-specific grammar. |
| cancel prior correction / restore original proof | **direct equivalent** — `イキ`: cancel a previous correction; retain the proof as originally set | **composed equivalent** — `保留`; place `△` under the originally deleted text and add two strokes to the referenced deletion mark | **uncertain** | **direct equivalent** — dots under the original proof plus `stet` | Relation-aware `cancel-correction` targets a stable prior correction ID; visual treatment remains notation-specific. |
| move | **direct equivalent** — move/shift instructions are present, with direction-dependent placement | **rough equivalent** in available previews | **uncertain** | **direct equivalent** — move left/right/up/down | Likely future operation; direction and destination need a neutral model. |
| join | **rough equivalent** — several close-up/line-joining instructions exist, but scope varies | **direct equivalent** in available previews | **uncertain** | **direct equivalent** — close up / join | “Join characters,” “join lines,” and “remove space” may not be one primitive. |
| split / paragraph break | **direct equivalent** for paragraphing and line-break instructions | **direct equivalent** in available previews | **uncertain** | **direct equivalent** — new paragraph / no paragraph | Future model should distinguish paragraph structure from visual line breaks. |
| space increase | **direct equivalent** — spacing instructions exist | **direct equivalent** in available previews | **uncertain** | **direct equivalent** — insert space | Amount and typography context may be notation-specific. |
| space decrease | **direct equivalent** — spacing/close-up instructions exist | **direct equivalent** in available previews | **uncertain** | **direct equivalent** — close up / remove space | Do not collapse into `delete`; this edits spacing, not text content. |
| style / typeface change | **direct equivalent** — character style/typeface instructions are present | **direct equivalent** in available previews | **uncertain** | **direct equivalent** — roman, italic, bold, caps, etc. | Likely parameterized semantic operation rather than one mark per style. |

## Findings that affect Tasks 002–003

1. `delete`, `insert`, `replace`, and `transpose` are reasonable shared semantic operations even though their visual grammar differs.
2. English `stet` and Japanese `イキ` express the same higher-level intent: cancel a previous correction; retain the proof as originally set. Task 003B models the editorial action as notation-neutral `cancel-correction`, targeting a prior correction rather than duplicating its text range.
3. Insertion is a point operation. Modeling it as a fake one-character range would leak a rendering convenience into semantic data.
4. Transposition needs two ordered targets. A single stretched range cannot describe separated transposition reliably.
5. JIS permits `＞` or `∧` at the insertion point; it does not uniquely assign one form to each writing mode. The audited reference rendering uses `∧` in its horizontal example and `＞` in its vertical example. A whole-overlay rotation is still not an acceptable implementation strategy because the full construction must follow live logical geometry.
6. The standard traditions contain nearby operations whose boundaries do not align perfectly: close-up, join, spacing reduction, no-paragraph, and line joining must not be forced into one universal operation without more research.
7. Canonical local marks do not imply canonical large-range marks. Multi-rect and block-scale rendering must report `generic-fallback` until a notation-specific representation has been researched.
8. GB/T 14706—93 provides horizontal examples for the audited set but no verified vertical forms. GB `vertical-rl` therefore falls back rather than rotating horizontal geometry.
9. Shared scene primitives can remain neutral while complete constructions differ: GB circles target/content, JIS uses endpoint/range grammar and notation labels.
10. GB `保留` proves that cancellation needs correction identity: its canonical form addresses both the referenced source target and the actual earlier deletion scene.
11. Korean public evidence supports a narrow horizontal pack, but not blind vertical rotation or a canonical cancellation construction. Those mappings remain explicit fallbacks.
12. Traditional US conventions converge across institutional sources but are not one national standard. Product copy must say “Traditional US proofreading,” not imply federal or standards-body authority.
13. `replace` is a useful composition boundary: the semantic operation stays singular even when the US scene is assembled from delete and insert constructions.
14. Pack-level writing-mode metadata distinguishes “known generic fallback” from “not supported at all.” The English pack declares only `horizontal-tb`; its vertical scenes are empty and report `unsupported`.
15. Latin proofing makes whitespace part of target authorship visible. A producer may target `very` or `very `, and the renderer must preserve that exact UTF-16 range rather than infer close-up behavior.

## Source notes and limitations

### Japanese — JIS Z 8208

- Edition investigated: **JIS Z 8208:2007, Proof correction marks**.
- The JISC catalogue/search establishes the standard identity, but the normative text was not available through an open official page during this task.
- Operation details were reconstructed from the text-and-table reproduction at [Kikakurui, JIS Z 8208:2007](https://kikakurui.com/z8/Z8208-2007-01.html) and visually cross-checked against the [Japan Printing Industry Federation Hokkaido chart](https://www.print.or.jp/printinghokkaido/no611/no611_image/p16.jpg).
- Implemented JIS marks are therefore described as **reference-based reconstructions**, not verified standards-conformant renderings.

### Chinese — GB/T 14706

- Edition investigated: **GB/T 14706-1993, Proofreader's marks and their application**.
- The [National Public Service Platform for Standards Information](https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=654F6E33383AD2645F3AB15623E43E06) reports publication on 1993-11-16, implementation on 1994-07-01, and a current status.
- Geometry was audited from a public five-page [GB/T 14706—93 table reproduction](https://www.slarc.org.cn/dwyx/attached/file/20240521/20240521153325_825.pdf), cross-checked with the [Zhangye municipal explanation](https://www.zhangye.gov.cn/szb/dzdt/zsbx/201703/t20170301_51832_ghb.html).
- The PDF exposes all 21 table items and Appendix A, but is a scanned public reproduction rather than a digitally signed official distribution. Implemented geometry remains reference-based rather than certified conformant.
- The reviewed material shows horizontal composition only. Vertical GB mappings remain uncertain and use explicit fallback.

### Korean — KS A 0104

- Standard investigated: **KS A 0104, 교정 기호 (proof correction marks)**.
- The Korean standards catalogue confirms the standard identity/status; the [KSSN record](https://www.kssn.net/search/stddetail.do?itemNo=K001010133619) lists a 2021 confirmation and paid normative PDF.
- The paid normative operation table was not accessible. The [Incheon Office of Education teacher guide](https://www.ice.go.kr/upload/ice/na/bbs_1630/2026/01/994f202efa1edf012d24dc5af2e11115.pdf), page 35, reproduces principal proofreading marks and cites the 2025 Ministry of Education grade 6 Korean textbook.
- [Hancom proofreading-mark documentation](https://help.hancom.com/hoffice/multi/ko_kr/hwp/insert/proofreadmark/proofreadmark(insert).htm) provides source-supported Korean terminology and applied operation examples.
- These sources justify **reference-based horizontal reconstructions**, not verified KS conformity. Vertical and cancel-correction mappings remain uncertain.

### English — established US conventions

- US conventions are not represented here as one national standard. The comparison uses established institutional publishing/teaching material.
- The strongest geometry sources reviewed were the Oregon Judicial Department [Standard Proofreader's Marks appendix](https://www.courts.oregon.gov/publications/Documents/UpdatedStyleManual2002.pdf), the [Caltech PhD Thesis Guidelines (rev. 04-2024)](https://gradoffice.caltech.edu/documents/28130/phd-thesis_guidelines_rev_04-2024.pdf), and [MIT OpenCourseWare proofreading marks](https://ocw.mit.edu/courses/15-279-management-communication-for-undergraduates-fall-2012/resources/mit15_279f12_proofrdrmarks/).
- The [U.S. Government Publishing Office Style Manual](https://www.gpo.gov/fdsys/pkg/GPO-STYLEMANUAL-2016/pdf/GPO-STYLEMANUAL-2016.pdf) corroborates institutional proof-correction practice and transposition cautions, but does not turn these marks into a national standard.
- These sources establish conventional usage; they do not make the renderer standards-conformant.
- The implemented pack is horizontal-only. No reviewed source established a vertical US proofreading grammar.

## Implementation references for Task 002

| Core operation | JIS display name | Task 002 representation | Fidelity |
| --- | --- | --- | --- |
| `delete` | 文字・記号を削除する (`トル`) | single slash, or endpoint boundaries plus center connector; leader and `トル` | `reference-based` for one rect; `generic-fallback` for multi-rect |
| `insert` | 文字・記号を挿入する | reference-example anchor (`∧` in the horizontal fixture, `＞` in the vertical fixture), leader, content between two lines; JIS permits either anchor form | `reference-based` for one insertion point |
| `replace` | 文字・記号を取り替える | single/multi target-removal grammar, leader, replacement material | `reference-based` for one rect; `generic-fallback` for multi-rect |
| `transpose` | 文字を入れ替える | S/reverse-S exchange path through adjacent character or group operands | `reference-based` only when both targets resolve to one adjacent line/column; otherwise fallback |
| `cancel-correction` | 修正を取りやめる (`イキ`) | resolve the referenced correction, then place `イキ` beside its affected text without a new leader | `reference-based` for one referenced inline rect; `generic-fallback` for multi-rect |

The fidelity value describes the implementation evidence and scale, not a guarantee of legal or normative compliance.

## Implementation references for Task 003

| Core operation | GB display name | Task 003 representation | Fidelity |
| --- | --- | --- | --- |
| `delete` | 删除 | closed target boundary plus curled deletion tail | `reference-based` for horizontal single-rect inline targets; otherwise fallback |
| `insert` | 增补 | hooked insertion position, leader, circled inserted material | `reference-based` for horizontal inline points; otherwise fallback |
| `replace` | 改正 | circled target and circled replacement material joined by a leader | `reference-based` for horizontal single-rect inline targets; otherwise fallback |
| `transpose` | 对调 | paired exchange hooks for adjacent character/group operands | `reference-based` for horizontal adjacent inline targets; otherwise fallback |
| `cancel-correction` | 保留 | `△` under the referenced deletion target plus two cancellation strokes on the actual referenced deletion scene | `reference-based` for a horizontal inline GB deletion; otherwise fallback |

## Implementation references for Task 004

| Core operation | Korean display name | Task 004 representation | Fidelity |
| --- | --- | --- | --- |
| `delete` | 글자 빼기 · 뺌표 | target-attached V construction | `reference-based` for horizontal single-rect inline targets; otherwise fallback |
| `insert` | 글자 넣기 · 넣음표 | hooked insertion point, leader, and real inserted text | `reference-based` for horizontal inline points; otherwise fallback |
| `replace` | 글자 고치기 · 고침표 | target loop, leader, and real replacement text | `reference-based` for horizontal single-rect inline targets; otherwise fallback |
| `transpose` | 자리 바꾸기 · 자리 바꿈표 | one continuous interlocking U path for adjacent character/group operands | `reference-based` for horizontal adjacent inline targets; otherwise fallback |
| `cancel-correction` | 이전 교정 취소 | preserve the correction reference but use the neutral fallback scene | `generic-fallback`; no canonical KS geometry claimed |

## Implementation references for Task 005

| Core operation | English display name | Task 005 representation | Fidelity |
| --- | --- | --- | --- |
| `delete` | Delete · dele | target stroke plus curled dele tail; exact target may include punctuation or whitespace | `reference-based` for horizontal single-rect inline targets; otherwise fallback, vertical unsupported |
| `insert` | Insert · caret | caret, leader, and real inserted word or punctuation | `reference-based` for horizontal inline points; otherwise fallback, vertical unsupported |
| `replace` | Replace · dele + insert | one semantic correction composed from dele plus caret, leader, and replacement text | `reference-based` for horizontal single-rect inline targets; otherwise fallback, vertical unsupported |
| `transpose` | Transpose · tr | separate operand brackets plus `tr` for adjacent letters or words | `reference-based` for horizontal adjacent inline targets; otherwise fallback, vertical unsupported |
| `cancel-correction` | Cancel correction · stet | resolve the referenced correction, dot the original proof, and place `stet` nearby | `reference-based` for a horizontal inline reference; otherwise fallback, vertical unsupported |
