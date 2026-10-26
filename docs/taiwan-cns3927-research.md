# Taiwan CNS 3927 research and implementation note

Status: evidence-backed first pass, 2026-08-30.

## Identity and edition

Taiwan is represented by its own `cns3927` notation pack. It is not an alias of
the Mainland China GB/T 14706 pack and it is not labelled as generic
“Traditional Chinese.”

| Field | Value |
| --- | --- |
| Public export | `cns3927` |
| Display name | `臺灣 · CNS 3927` |
| Standard | CNS 3927 / Z7050, 校對符號 / Proof Corrections |
| Edition | 1996-09-26 |
| Status | Current standard (`現行標準`) in the official CNS Online record |
| Locale metadata | `zh-Hant-TW` |
| Script metadata | `Hant` |
| Jurisdiction metadata | `TW` |

The BSMI 2026 English catalog lists `3927 Z7050 1996-09 Proof Corrections` and
states that the catalog contains standards current at the end of 2025. The
official CNS Online result gives the exact date as ROC 85/09/26, or 1996-09-26.

Official records:

- [CNS Online record for CNS 3927](https://www.cnsonline.com.tw/?node=result&generalno=3927&locale=zh_TW)
- [BSMI standards catalog page](https://www.bsmi.gov.tw/wSite/lp?BaseDSD=7&CtUnit=4197&ctNode=9837)
- [BSMI 2026 English catalog](https://www.bsmi.gov.tw/wSite/record/file_actData.jsp?filename=f1772506103728.pdf&fileuuid=126197)

The Mainland standard remains a separate jurisdictional source. The official
SAMR record lists GB/T 14706-1993 as current after its 2025 review:
[GB/T 14706-1993 record](https://std.samr.gov.cn/gb/search/gbDetailed?id=Sx5xizDR088%3D&mode=p).

## Access and redistribution

BSMI permits free online preview and sells electronic copies. Its published FAQ
states that reprinting or distributing national-standard material requires
prior BSMI permission. Proofmarks has not obtained that permission. Therefore:

- no CNS scans, screenshots, or reproduced standard diagrams are stored or
  published by this repository;
- code geometry is an original reconstruction from inspected source rules;
- descriptions are concise factual summaries rather than reproduced table text;
- “reference-based” does not mean certified or conformant.

The third-party PDF supplied for comparison was not used as a redistribution
source. It remains useful only as a discovery lead pending provenance and rights
verification.

## Source-action audit

The standard separates an interline mark (`行間符號`) from a page-margin mark
(`頁邊符號`). The implementation mirrors that structure: a fixed target or
insertion anchor lives beside the accepted text, while replacement/inserted
material is a separate movable payload connected by a leader.

| CNS source action | V0.1 semantic mapping | Decision |
| --- | --- | --- |
| 刪除 | `delete` | Faithful for an explicit text range. |
| 保留 | `cancel-correction` referencing a prior `delete` | Faithful as a correction-to-correction relation. It is not a “keep this text” annotation. Other referenced correction types fall back and are not called CNS 保留. |
| 插字（增補） | `insert` | Faithful for a text boundary and inserted content. Horizontal uses the source Y form; vertical uses the source left-arrow form. |
| 改正錯字 | `replace` | Faithful for one selected wrong-character range and its replacement. |
| 取代 | No faithful V0.1 mapping | The source describes a repeated/equivalence replacement convention. Core `replace` addresses one explicit range and cannot express page-wide occurrence scope, so this action is documented but not claimed as direct. |

No new correction type is introduced. In particular, `transpose`, `move`, and
the spacing operations are not inherited from GB.

## Capability and confidence matrix

“Direct” is an original source-backed construction. “Unverified” means the
semantic data remains valid but Proofmarks uses its visibly labelled generic
fallback rather than presenting borrowed or inferred geometry as CNS. “Generic
fallback” also applies to non-inline scales. “Unsupported” is reserved for a
semantic mismatch such as calling a cancellation of a non-delete correction
CNS 保留.

| V0.1 operation | Horizontal | Vertical `vertical-rl` | Confidence and missing evidence |
| --- | --- | --- | --- |
| `delete` | Direct | Unverified → generic fallback | Horizontal geometry high. Need licensed vertical examples or an explicit orientation rule before a vertical direct claim. |
| `insert` | Direct · Y | Direct · left arrow | High for the H/V distinction. Need broader vertical font and line-break corpus for placement confidence. |
| `replace` | Direct as 改正錯字 | Unverified → generic fallback | Horizontal geometry high for one wrong character. Need licensed vertical examples and multi-character scope evidence. |
| `transpose` | Unverified → generic fallback | Unverified → generic fallback | Not audited; deliberately not inherited from GB. |
| `move` | Unverified → generic fallback | Unverified → generic fallback | Not audited; deliberately not inherited from GB. |
| `increase-spacing` | Unverified → generic fallback | Unverified → generic fallback | CNS has character-position material, but V0.1 target semantics and exact geometry have not been audited. |
| `decrease-spacing` | Unverified → generic fallback | Unverified → generic fallback | Existing-whitespace range semantics remain valid, but no CNS-direct geometry is claimed. |
| `cancel-correction` | Direct only for prior `delete` | Unverified → generic fallback | Horizontal 保留 relation high. Cancellation of another operation is unsupported as CNS 保留; vertical geometry needs evidence. |

## Locale, text, and font validation

Notation and locale remain separate consumer choices. The pack publishes
`zh-Hant-TW` metadata, but selecting the pack never translates or rewrites source
text. Site fixtures use native Hant-TW text and UTF-16 offsets over the unchanged
DOM text.

The first test matrix covers:

| Writing mode | Serif stack | Sans stack | Status |
| --- | --- | --- | --- |
| Horizontal | `Noto Serif TC`, `Songti TC`, `PMingLiU`, serif | `Noto Sans TC`, `PingFang TC`, `Microsoft JhengHei`, sans-serif | Automated scene and UTF-16 fixture coverage |
| Vertical `vertical-rl` | same serif fallbacks | same sans fallbacks | Direct insertion only; other CNS geometry remains visibly unverified |

Remaining evidence needed for higher confidence:

1. A licensed copy or written BSMI permission for line-by-line audit citations.
2. Licensed vertical examples for deletion, wrong-character correction, and
   retention placement.
3. Evidence defining whether 取代 is always global, scoped to a page, or can be
   represented as explicit occurrence ranges.
4. Source-backed mappings for transpose, movement, and spacing target grammar.
5. Cross-browser screenshots on Windows fonts (`PMingLiU`, `Microsoft JhengHei`)
   and real Taiwan editorial samples.

Until those are available, the pack exposes conservative direct support and
explicitly labelled fallback states rather than invented symmetry.
