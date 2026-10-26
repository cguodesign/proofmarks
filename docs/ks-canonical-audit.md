# KS A 0104 canonical audit

Status: Task 004 implementation audit, 2026-08-26.

## Conclusion

Proofmarks now includes an independent Korean reference pack identified as `ko-ks-a0104-reference`. The pack does **not** claim verified conformity with KS A 0104.

The official standards catalogue establishes that **KS A 0104, 교정 기호** exists and was confirmed on 2021-10-25, but its normative Korean PDF is sold rather than openly exposed. Publicly accessible Korean Ministry of Education teaching material and Hancom documentation provide enough converging evidence for narrow horizontal reconstructions of delete, insert, replace, and adjacent transpose. They do not establish verified vertical constructions or a canonical mark for canceling a prior correction.

Accordingly:

- horizontal inline `delete`, `insert`, `replace`, and adjacent `transpose` report `reference-based`;
- vertical, phrase/block, multi-rect, separated transpose, and `cancel-correction` report `generic-fallback`;
- the public UI labels every fallback and states that direct KS table access was unavailable.

## Source hierarchy

### 1. Official standards identity and status

- [Korean Standards Association KSSN catalogue record](https://www.kssn.net/search/stddetail.do?itemNo=K001010133619): the cited-standards table lists `KS A 0104`, title `교정 기호`, Korean PDF, and `2021-10-25(확인)`.
- [e나라 표준인증 2016 revision notice](https://standard.go.kr/KSCI/standardIntro/standardPrvntcView.do?menuId=920&ntfcManageNo=2016-00433&topMenuId=502): independently identifies `KSA0104` and the title `교정 기호`.

These records support identity and status only. They do not expose the normative operation table or authorize an exact geometry claim.

### 2. Official Korean educational material

- [Incheon Metropolitan City Office of Education teacher guide](https://www.ice.go.kr/upload/ice/na/bbs_1630/2026/01/994f202efa1edf012d24dc5af2e11115.pdf), page 35. The table is labeled `주요 교정 부호는 다음과 같아요` and cites `초등학교 6-1 국어, 교육부, 2025` as its source. It visually documents marks for removing text, joining text, correcting one or several characters, inserting characters, and adding content.

This is the strongest openly accessible operation-level Korean institutional source reviewed. It is educational material derived from a Ministry textbook, not the normative KS table.

### 3. Established Korean product documentation

- [Hancom Office — 교정 부호 넣기](https://help.hancom.com/hoffice/multi/ko_kr/hwp/insert/proofreadmark/proofreadmark(insert).htm) names and defines `넣음표`, `고침표`, `뺌표`, and `자리 바꿈표`, and distinguishes marks that require correction content or a second target position.
- [Hancom Office — 교정 부호 examples](https://help.hancom.com/hoffice_mac/ko_kr/hwp/view/proofreadmark.htm) supplies applied examples and resulting text for the same operations.

Hancom is useful corroboration for terminology, operation scope, and applied appearance. It is not treated as proof that its implementation exactly reproduces KS A 0104.

### 4. Terminology cross-check

- [National Institute of Korean Language — 교정 기호](https://kli.korean.go.kr/term/trgtWord/indexTrgtWord.do?trgtWordNo=2055514) defines the term and records `교정 부호` as a related expression.

## Operation audit

| Core intent | Korean UI term | Reviewed evidence | Implemented horizontal construction | Fidelity boundary |
| --- | --- | --- | --- | --- |
| `delete` | 글자 빼기 · `뺌표` | Ministry-derived teaching table shows removal; Hancom defines `뺌표` as removing unnecessary letters | target-attached V construction | reference-based for one horizontal inline rect; otherwise fallback |
| `insert` | 글자 넣기 · `넣음표` | teaching table and Hancom both show an insertion point connected to added material | hooked insertion point, leader, real SVG inserted text | reference-based for a horizontal inline text position; otherwise fallback |
| `replace` | 글자 고치기 · `고침표` | teaching table distinguishes one- and multi-character correction; Hancom defines `고침표` | target loop, leader, real SVG replacement text | reference-based for one horizontal inline rect; otherwise fallback |
| `transpose` | 자리 바꾸기 · `자리 바꿈표` | Hancom defines reversal of character/word order and shows an applied adjacent example | one continuous path that passes below the first operand, rises at the junction, and passes above the second | reference-based only for two adjacent horizontal inline targets; otherwise fallback |
| `cancel-correction` | 이전 교정 취소 | the semantic need exists in the shared model, but reviewed public sources did not establish a canonical KS construction | generic relation-aware fallback | always fallback in the KS pack |

The Korean labels describe operations conservatively. They do not imply that an inaccessible normative heading has been reproduced verbatim.

## Writing-mode audit

All reviewed operation-level examples use horizontal Korean composition. No reviewed source established vertical `vertical-rl` variants or a rule that permits rotating the complete horizontal construction. Proofmarks therefore does not rotate KS marks into a fabricated vertical grammar.

The renderer still resolves vertical Korean DOM geometry correctly. It then selects `generic-fallback`, and the gallery exposes that decision beside every vertical sample.

## Hangul and UTF-16 audit

DOM `Range` offsets remain UTF-16 code-unit offsets. Precomposed Hangul syllables such as `문`, `장`, and `교` each occupy one UTF-16 unit, so native Korean fixtures map directly to DOM offsets. Tests additionally cover:

- precomposed Hangul ranges;
- Korean punctuation boundaries;
- mixed Hangul + Latin text (`교정 Proof`);
- mixed Hangul + numbers (`2026`);
- nested text nodes while preserving aggregate source offsets.

This audit does not claim grapheme-cluster indexing. A future editor-facing API may need an explicit conversion layer if it accepts user-perceived character offsets rather than DOM UTF-16 offsets.

## Native showcase vs engineering compare

The KS gallery uses native Korean documents and Korean correction content. The engineering workbench and `/compare` intentionally keep one source document, target, and correction object while switching notation packs. This preserves the architectural proof while keeping the cultural showcase understandable.

## Known limitations

- The paid normative KS A 0104 operation table was not reviewed.
- Exact stroke proportion, handwriting variation, and placement tolerances are not certified.
- `cancel-correction`, vertical writing, separated transpose, phrase/block scale, and multi-rect targets use generic fallback.
- Korean terminology is source-supported, but not asserted to reproduce every normative KS heading.
- Chromium is tested; Safari and Firefox remain unverified.

## Task 009C final V0.1 audit

Direct KS A 0104 geometry remains inaccessible. Task 009C therefore preserves a deliberate split between directly verified identity/status and source-backed secondary reconstruction.

| Operation | Evidence | Current reconstruction | H | V | Final confidence |
| --- | --- | --- | --- | --- | --- |
| delete | Ministry-derived teaching table + Hancom `뺌표` | Target-attached V construction | PASS | PARTIAL | geometry medium; placement medium |
| insert | teaching table + Hancom `넣음표` | Hook, leader, real inserted material | PASS | PARTIAL | geometry medium; placement medium |
| replace | teaching table + Hancom `고침표` | Target loop, leader, real replacement material | PASS | PARTIAL | geometry medium; placement medium |
| transpose | Hancom `자리 바꿈표` | Continuous adjacent interlocking path | PASS | PARTIAL | geometry medium; placement medium |
| move | Hancom right/left move marks | Destination route with Korean `옮김` label | PARTIAL | PARTIAL | geometry medium; placement low |
| increase-spacing | Hancom `띄움표` | Number-sign topology | PARTIAL | PARTIAL | geometry medium; placement low |
| decrease-spacing | Hancom `붙임표` | Opposing close-up curves | PARTIAL | PARTIAL | geometry medium; placement low |
| cancel-correction | no operation-level canonical source found | Relation-aware generic Proofmarks fallback | PARTIAL | PARTIAL | geometry/placement low |

### Material before / after log

- Fixed label and inserted-material sizes now follow measured source typography and retain cross-platform CJK font fallbacks.
- The new Task 009B operations no longer imply verified KS geometry simply because Hancom names them; their final audit rows are explicitly partial.
- Vertical and cancellation states were not visually promoted. The renderer continues to expose fallback fidelity.

No paid standard PDF, teaching scan, or proprietary product image is stored in the runtime or repository.
