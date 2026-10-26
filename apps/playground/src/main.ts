import { siteHref, sitePathname } from "./site-path";
import { getCorrectionTargets, type Correction } from "@proofmarks/core";
import {
  createProofmarks,
  technicalNotationPack,
  type NotationPack,
  type ProofmarksInstance,
  type ProofmarksOptions,
  type WritingMode,
} from "@proofmarks/dom";
import {
  chineseGbNotationPack,
  englishUsNotationPack,
  getCns3927Capability,
  japaneseJisNotationPack,
  koreanKsNotationPack,
  taiwanCns3927NotationPack,
} from "@proofmarks/notations";
import { publicFooterMarkup, publicHeaderMarkup } from "./site-chrome";
import "./style.css";
import "./site.css";

type FixtureId =
  | "delete-single"
  | "delete-multi"
  | "insert"
  | "insert-punctuation"
  | "replace-single"
  | "replace-multi"
  | "transpose"
  | "transpose-group"
  | "move"
  | "increase-spacing"
  | "decrease-spacing"
  | "cancel-correction"
  | "wrapped";
type NotationId = "technical" | "jis" | "gb" | "cns" | "ks" | "en";
type ReferenceNotationId = Exclude<NotationId, "technical">;

type Fixture = {
  label: string;
  variantLabel: string;
  text: string;
  gbText?: string;
  cnsText?: string;
  ksText?: string;
  enText?: string;
  enVariantLabel?: string;
  gbCorrection?: Correction;
  gbCorrections?: readonly Correction[];
  cnsCorrection?: Correction;
  cnsCorrections?: readonly Correction[];
  ksCorrection?: Correction;
  ksCorrections?: readonly Correction[];
  enCorrection?: Correction;
  enCorrections?: readonly Correction[];
  correction: Correction;
  corrections?: readonly Correction[];
};

type LocalizedOperation = {
  name: string;
  sourceNote: string;
};

type OperationSpec = {
  id: Correction["type"];
  label: string;
  variants: FixtureId[];
  enVariants?: FixtureId[];
  jis: LocalizedOperation;
  gb: LocalizedOperation;
  cns: LocalizedOperation;
  ks: LocalizedOperation;
  en: LocalizedOperation;
};

const fixtures: Record<FixtureId, Fixture> = {
  "delete-single": {
    label: "Delete · 1 character",
    variantLabel: "1 character",
    text: "文章をを校正する。",
    gbText: "文字需需校对。",
    cnsText: "文字需需校對。",
    ksText: "문장을을 교정한다.",
    enText: "The editor reviewed, the manuscript.",
    enVariantLabel: "Punctuation",
    enCorrection: {
      id: "en-delete-comma",
      type: "delete",
      target: { kind: "text-range", start: 19, end: 20 },
    },
    ksCorrection: {
      id: "ks-delete-duplicate",
      type: "delete",
      target: { kind: "text-range", start: 3, end: 4 },
    },
    cnsCorrection: {
      id: "cns-delete-duplicate",
      type: "delete",
      target: { kind: "text-range", start: 3, end: 4 },
    },
    correction: {
      id: "delete-duplicate",
      type: "delete",
      target: { kind: "text-range", start: 3, end: 4 },
    },
  },
  "delete-multi": {
    label: "Delete · multiple characters",
    variantLabel: "Multiple characters",
    text: "すぐ校正する。",
    gbText: "立即校对文字。",
    cnsText: "立刻立刻校對文字。",
    ksText: "매우매우 정확하다.",
    enText: "The editor very carefully reviewed the manuscript.",
    enVariantLabel: "Word + trailing space",
    enCorrection: {
      id: "en-delete-word-space",
      type: "delete",
      target: { kind: "text-range", start: 11, end: 16 },
    },
    ksCorrection: {
      id: "ks-delete-phrase",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 2 },
    },
    cnsCorrection: {
      id: "cns-delete-phrase",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 2 },
    },
    correction: {
      id: "delete-phrase",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 2 },
    },
  },
  insert: {
    label: "Insert",
    variantLabel: "Inline",
    text: "文章校正する。",
    gbText: "文字校对内容。",
    cnsText: "文字校對內容。",
    ksText: "문장 교정한다.",
    enText: "The editor reviewed the manuscript.",
    enVariantLabel: "Word",
    enCorrection: {
      id: "en-insert-word",
      type: "insert",
      target: { kind: "text-point", offset: 24 },
      content: "final ",
    },
    ksCorrection: {
      id: "ks-insert-particle",
      type: "insert",
      target: { kind: "text-point", offset: 2 },
      content: "을",
    },
    cnsCorrection: {
      id: "cns-insert-character",
      type: "insert",
      target: { kind: "text-point", offset: 2 },
      content: "需",
    },
    correction: {
      id: "insert-particle",
      type: "insert",
      target: { kind: "text-point", offset: 2 },
      content: "再",
    },
  },
  "insert-punctuation": {
    label: "Insert · punctuation",
    variantLabel: "Punctuation",
    text: "After review the editor approved it.",
    cnsText: "審閱後編輯核准。",
    enText: "After review the editor approved it.",
    enVariantLabel: "Punctuation",
    correction: {
      id: "insert-comma",
      type: "insert",
      target: { kind: "text-point", offset: 12 },
      content: ",",
    },
    enCorrection: {
      id: "en-insert-comma",
      type: "insert",
      target: { kind: "text-point", offset: 12 },
      content: ",",
    },
    cnsCorrection: {
      id: "cns-insert-comma",
      type: "insert",
      target: { kind: "text-point", offset: 3 },
      content: "，",
    },
  },
  "replace-single": {
    label: "Replace · 1 character",
    variantLabel: "1 character",
    text: "文書を校正する。",
    gbText: "文张需要校对。",
    cnsText: "文分需要校對。",
    ksText: "문장을 교정한댜.",
    enText: "The editor read the manuscript.",
    enVariantLabel: "Word",
    enCorrection: {
      id: "en-replace-word",
      type: "replace",
      target: { kind: "text-range", start: 11, end: 15 },
      replacement: "reviewed",
    },
    ksCorrection: {
      id: "ks-replace-character",
      type: "replace",
      target: { kind: "text-range", start: 7, end: 8 },
      replacement: "다",
    },
    cnsCorrection: {
      id: "cns-replace-character",
      type: "replace",
      target: { kind: "text-range", start: 1, end: 2 },
      replacement: "份",
    },
    correction: {
      id: "replace-character",
      type: "replace",
      target: { kind: "text-range", start: 1, end: 2 },
      replacement: "章",
    },
  },
  "replace-multi": {
    label: "Replace · multiple characters",
    variantLabel: "Multiple characters",
    text: "文面を校正する。",
    gbText: "文稿需要校对。",
    cnsText: "這分文稿需校對。",
    ksText: "문안을 교정한다.",
    enText: "The editor checked quickly the manuscript.",
    enVariantLabel: "Phrase",
    enCorrection: {
      id: "en-replace-phrase",
      type: "replace",
      target: { kind: "text-range", start: 11, end: 26 },
      replacement: "reviewed carefully",
    },
    ksCorrection: {
      id: "ks-replace-phrase",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 2 },
      replacement: "문장",
    },
    cnsCorrection: {
      id: "cns-replace-phrase",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 2 },
      replacement: "這份",
    },
    correction: {
      id: "replace-phrase",
      type: "replace",
      target: { kind: "text-range", start: 0, end: 2 },
      replacement: "文章",
    },
  },
  transpose: {
    label: "Transpose · character pair",
    variantLabel: "Character ↔ character",
    text: "章文を校正する。",
    gbText: "章文需要校对。",
    cnsText: "稿文需要校對。",
    ksText: "장문을 교정한다.",
    enText: "The edtior reviewed it.",
    enVariantLabel: "Adjacent letters",
    enCorrection: {
      id: "en-transpose-letters",
      type: "transpose",
      targets: [
        { kind: "text-range", start: 6, end: 7 },
        { kind: "text-range", start: 7, end: 8 },
      ],
    },
    ksCorrection: {
      id: "ks-transpose-characters",
      type: "transpose",
      targets: [
        { kind: "text-range", start: 0, end: 1 },
        { kind: "text-range", start: 1, end: 2 },
      ],
    },
    cnsCorrection: {
      id: "cns-transpose-characters",
      type: "transpose",
      targets: [
        { kind: "text-range", start: 0, end: 1 },
        { kind: "text-range", start: 1, end: 2 },
      ],
    },
    correction: {
      id: "transpose-characters",
      type: "transpose",
      targets: [
        { kind: "text-range", start: 0, end: 1 },
        { kind: "text-range", start: 1, end: 2 },
      ],
    },
  },
  "transpose-group": {
    label: "Transpose · adjacent groups",
    variantLabel: "Group ↔ group",
    text: "後半前半を入れ替える。",
    gbText: "后半前半需要对调。",
    cnsText: "後段前段需要調整。",
    ksText: "후반전반을 바꾼다.",
    enText: "The manuscript editor reviewed carefully.",
    enVariantLabel: "Adjacent words",
    enCorrection: {
      id: "en-transpose-words",
      type: "transpose",
      targets: [
        { kind: "text-range", start: 4, end: 14 },
        { kind: "text-range", start: 15, end: 21 },
      ],
    },
    ksCorrection: {
      id: "ks-transpose-groups",
      type: "transpose",
      targets: [
        { kind: "text-range", start: 0, end: 2 },
        { kind: "text-range", start: 2, end: 4 },
      ],
    },
    cnsCorrection: {
      id: "cns-transpose-groups",
      type: "transpose",
      targets: [
        { kind: "text-range", start: 0, end: 2 },
        { kind: "text-range", start: 2, end: 4 },
      ],
    },
    correction: {
      id: "transpose-groups",
      type: "transpose",
      targets: [
        { kind: "text-range", start: 0, end: 2 },
        { kind: "text-range", start: 2, end: 4 },
      ],
    },
  },
  move: {
    label: "Move",
    variantLabel: "Range → position",
    text: "結論を先に示す。",
    gbText: "先解释再说结论。",
    cnsText: "先說明再提出結論。",
    ksText: "결론을 먼저 설명한다.",
    enText: "First explain, then state the conclusion.",
    correction: {
      id: "move-conclusion-ja",
      type: "move",
      source: { kind: "text-range", start: 0, end: 2 },
      destination: { kind: "text-point", offset: 6 },
    },
    gbCorrection: {
      id: "move-conclusion-zh",
      type: "move",
      source: { kind: "text-range", start: 6, end: 8 },
      destination: { kind: "text-point", offset: 0 },
    },
    cnsCorrection: {
      id: "cns-move-conclusion",
      type: "move",
      source: { kind: "text-range", start: 6, end: 8 },
      destination: { kind: "text-point", offset: 0 },
    },
    ksCorrection: {
      id: "move-conclusion-ko",
      type: "move",
      source: { kind: "text-range", start: 0, end: 2 },
      destination: { kind: "text-point", offset: 5 },
    },
    enCorrection: {
      id: "move-conclusion-en",
      type: "move",
      source: { kind: "text-range", start: 0, end: 5 },
      destination: { kind: "text-point", offset: 20 },
    },
  },
  "increase-spacing": {
    label: "Increase spacing",
    variantLabel: "Text boundary",
    text: "語間を空ける。",
    gbText: "字词间距需调整。",
    cnsText: "字詞間距需調整。",
    ksText: "단어사이를 띄운다.",
    enText: "twowords need a space.",
    correction: {
      id: "increase-spacing-ja",
      type: "increase-spacing",
      target: { kind: "text-point", offset: 1 },
    },
    gbCorrection: {
      id: "increase-spacing-zh",
      type: "increase-spacing",
      target: { kind: "text-point", offset: 1 },
    },
    cnsCorrection: {
      id: "cns-increase-spacing",
      type: "increase-spacing",
      target: { kind: "text-point", offset: 1 },
    },
    ksCorrection: {
      id: "increase-spacing-ko",
      type: "increase-spacing",
      target: { kind: "text-point", offset: 2 },
    },
    enCorrection: {
      id: "increase-spacing-en",
      type: "increase-spacing",
      target: { kind: "text-point", offset: 3 },
    },
  },
  "decrease-spacing": {
    label: "Decrease spacing",
    variantLabel: "Existing whitespace",
    text: "語　間を詰める。",
    gbText: "字 词间距需调整。",
    cnsText: "字　詞間距需調整。",
    ksText: "단어 사이를 붙인다.",
    enText: "close  up this gap.",
    correction: {
      id: "decrease-spacing-ja",
      type: "decrease-spacing",
      target: { kind: "text-range", start: 1, end: 2 },
    },
    gbCorrection: {
      id: "decrease-spacing-zh",
      type: "decrease-spacing",
      target: { kind: "text-range", start: 1, end: 2 },
    },
    cnsCorrection: {
      id: "cns-decrease-spacing",
      type: "decrease-spacing",
      target: { kind: "text-range", start: 1, end: 2 },
    },
    ksCorrection: {
      id: "decrease-spacing-ko",
      type: "decrease-spacing",
      target: { kind: "text-range", start: 2, end: 3 },
    },
    enCorrection: {
      id: "decrease-spacing-en",
      type: "decrease-spacing",
      target: { kind: "text-range", start: 5, end: 7 },
    },
  },
  "cancel-correction": {
    label: "Cancel previous correction",
    variantLabel: "Cancel correction",
    text: "文章を校正する。",
    gbText: "文字需要校对。",
    cnsText: "文字需要校對。",
    ksText: "문장을 교정한다.",
    enText: "The editor reviewed the manuscript.",
    enVariantLabel: "Cancel a deletion",
    enCorrection: {
      id: "en-cancel-delete-word",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "en-delete-word" },
    },
    enCorrections: [
      {
        id: "en-delete-word",
        type: "delete",
        target: { kind: "text-range", start: 4, end: 10 },
      },
      {
        id: "en-cancel-delete-word",
        type: "cancel-correction",
        target: { kind: "correction", correctionId: "en-delete-word" },
      },
    ],
    ksCorrection: {
      id: "ks-cancel-delete-original",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "ks-delete-original" },
    },
    ksCorrections: [
      {
        id: "ks-delete-original",
        type: "delete",
        target: { kind: "text-range", start: 0, end: 3 },
      },
      {
        id: "ks-cancel-delete-original",
        type: "cancel-correction",
        target: { kind: "correction", correctionId: "ks-delete-original" },
      },
    ],
    cnsCorrection: {
      id: "cns-retain-delete",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "cns-delete-original" },
    },
    cnsCorrections: [
      {
        id: "cns-delete-original",
        type: "delete",
        target: { kind: "text-range", start: 0, end: 2 },
      },
      {
        id: "cns-retain-delete",
        type: "cancel-correction",
        target: { kind: "correction", correctionId: "cns-delete-original" },
      },
    ],
    correction: {
      id: "cancel-delete-original",
      type: "cancel-correction",
      target: { kind: "correction", correctionId: "delete-original" },
    },
    corrections: [
      {
        id: "delete-original",
        type: "delete",
        target: { kind: "text-range", start: 0, end: 2 },
      },
      {
        id: "cancel-delete-original",
        type: "cancel-correction",
        target: { kind: "correction", correctionId: "delete-original" },
      },
    ],
  },
  wrapped: {
    label: "Wrapped fallback",
    variantLabel: "Engineering stress fixture",
    text: "名字还没有。在哪里出生也不知道。这是一段用于测试换行和多矩形目标的校样文字。",
    correction: {
      id: "delete-wrapped-range",
      type: "delete",
      target: { kind: "text-range", start: 0, end: 15 },
    },
  },
};

const operations: OperationSpec[] = [
  {
    id: "delete",
    label: "Delete",
    variants: ["delete-single", "delete-multi"],
    jis: {
      name: "文字・記号を削除する · トル",
      sourceNote: "JIS Z 8208:2007 Table 1, 1.1.4, using target construction 1.1.1.",
    },
    gb: {
      name: "删除",
      sourceNote:
        "GB/T 14706—93 item 2: circle the material to remove and continue into the characteristic curled deletion tail.",
    },
    cns: {
      name: "刪除",
      sourceNote:
        "CNS 3927 row 1 separates the interline target from the page-margin deletion mark. Horizontal geometry is source-backed; vertical placement remains unverified.",
    },
    ks: {
      name: "글자 빼기 · 뺌표",
      sourceNote:
        "Horizontal reference reconstruction. Korean Ministry of Education teaching material shows the deletion construction; Hancom documents 뺌표 for removing unnecessary letters. Direct KS table access remains unavailable.",
    },
    en: {
      name: "Delete · dele",
      sourceNote:
        "Traditional US references distinguish delete from delete-and-close-up. This reconstruction uses a target stroke with a curled dele tail; the semantic target, including any trailing space, remains producer-owned.",
    },
  },
  {
    id: "insert",
    label: "Insert",
    variants: ["insert"],
    enVariants: ["insert", "insert-punctuation"],
    jis: {
      name: "文字・記号を挿入する",
      sourceNote:
        "This reference rendering uses ∧ in the horizontal example and ＞ in the vertical example. JIS permits either insertion-point form. JIS Z 8208:2007 Table 1, 1.1.6.",
    },
    gb: {
      name: "增补",
      sourceNote:
        "GB/T 14706—93 item 3: mark the insertion position, connect it to the added material, and circle that material.",
    },
    cns: {
      name: "插字（增補）",
      sourceNote:
        "CNS 3927 row 3 specifies Y at a horizontal insertion point and a left arrow in vertical setting, with added material shown separately at the page margin.",
    },
    ks: {
      name: "글자 넣기 · 넣음표",
      sourceNote:
        "Horizontal reference reconstruction. Korean Ministry of Education material and Hancom documentation both show an insertion point connected to the added material; vertical use is unverified.",
    },
    en: {
      name: "Insert · caret",
      sourceNote:
        "Traditional US references use a caret at the insertion point and write the actual added word or punctuation. Both examples preserve that content as semantic data.",
    },
  },
  {
    id: "replace",
    label: "Replace",
    variants: ["replace-single", "replace-multi"],
    jis: {
      name: "文字・記号を取り替える",
      sourceNote: "JIS Z 8208:2007 Table 1, 1.1.1.",
    },
    gb: {
      name: "改正",
      sourceNote:
        "GB/T 14706—93 item 1: circle both the material being corrected and the replacement material, then join the circles.",
    },
    cns: {
      name: "改正錯字",
      sourceNote:
        "CNS 3927 row 4 connects the marked wrong character to circled replacement material. V0.1 maps one explicit range; vertical geometry remains unverified.",
    },
    ks: {
      name: "글자 고치기 · 고침표",
      sourceNote:
        "Horizontal reference reconstruction of the one- and multi-character correction examples in Korean official teaching material, cross-checked against Hancom 고침표 examples.",
    },
    en: {
      name: "Replace · dele + insert",
      sourceNote:
        "One replace correction resolves into a traditional US composition: delete the original, place a caret, and write the replacement. The semantic operation remains replace.",
    },
  },
  {
    id: "transpose",
    label: "Transpose",
    variants: ["transpose", "transpose-group"],
    jis: {
      name: "文字を入れ替える",
      sourceNote: "JIS Z 8208:2007 Table 1, 1.1.7.",
    },
    gb: {
      name: "对调",
      sourceNote:
        "GB/T 14706—93 item 6 provides separate forms for adjacent and separated words. This pack implements the adjacent two-hook construction only.",
    },
    cns: {
      name: "對調 · 尚未核實",
      sourceNote:
        "No CNS-direct transpose construction is claimed in this pass. The semantic correction remains valid and the gallery deliberately uses a generic fallback rather than GB geometry.",
    },
    ks: {
      name: "자리 바꾸기 · 자리 바꿈표",
      sourceNote:
        "Horizontal adjacent-target reconstruction. Hancom documents 자리 바꿈표 for reversing character or word order; separated and vertical variants remain unverified.",
    },
    en: {
      name: "Transpose · tr",
      sourceNote:
        "Traditional US references identify the two operands and add tr. The examples cover adjacent letters and adjacent words without changing the transpose semantic model.",
    },
  },
  {
    id: "cancel-correction",
    label: "Cancel previous correction",
    variants: ["cancel-correction"],
    jis: {
      name: "修正を取りやめる · イキ",
      sourceNote:
        "Cancel a previous correction; retain the proof as originally set. JIS Z 8208:2007 Table 1, 1.1.8.",
    },
    gb: {
      name: "保留",
      sourceNote:
        "GB/T 14706—93 item 19: place △ under the originally deleted characters and add two vertical cancellation strokes to the referenced deletion mark.",
    },
    cns: {
      name: "保留",
      sourceNote:
        "CNS 3927 row 2 preserves material from a prior deletion: △ is placed under the text and two strokes cancel the referenced deletion mark. This is a correction relation, not a keep-text annotation.",
    },
    ks: {
      name: "이전 교정 취소",
      sourceNote:
        "The semantic relation is preserved, but no operation-level KS source reviewed in Task 004 established a canonical cancellation construction. This example intentionally uses the generic Proofmarks fallback.",
    },
    en: {
      name: "Cancel correction · stet",
      sourceNote:
        "Stet cancels a previous correction: dots appear beneath the original proof and stet is written nearby. This scene resolves an actual correction reference rather than annotating text to keep.",
    },
  },
  {
    id: "move",
    label: "Move",
    variants: ["move"],
    jis: {
      name: "指定位置へ移動",
      sourceNote: "JIS Z 8208:2007 Table 1, 1.1.9 directs characters or lines to a specified position. V0.1 implements a horizontal inline range-to-position construction.",
    },
    gb: {
      name: "转移",
      sourceNote: "GB/T 14706—93 item 9 specifies transferring material to another position. This reconstruction implements the horizontal inline form.",
    },
    cns: {
      name: "移動 · 尚未核實",
      sourceNote:
        "No CNS-direct move mapping is claimed in this pass. The pack does not inherit GB geometry and presents the operation as a generic fallback.",
    },
    ks: {
      name: "자리 옮김",
      sourceNote: "Hancom documents left and right move marks. This is a horizontal source-backed reconstruction; direct KS geometry remains unverified.",
    },
    en: {
      name: "Move",
      sourceNote: "Traditional US proofreading charts include move-left and move-right instructions. The semantic operation remains direction-neutral and destination-based.",
    },
  },
  {
    id: "increase-spacing",
    label: "Increase spacing",
    variants: ["increase-spacing"],
    jis: {
      name: "空き量を増やす",
      sourceNote: "JIS Z 8208:2007 includes explicit spacing instructions. V0.1 marks a single text boundary and leaves the visible amount to the notation.",
    },
    gb: {
      name: "加大空距",
      sourceNote: "GB/T 14706—93 item 15 specifies increasing character spacing; item 17 provides exact amounts. V0.1 models the boundary intent, not a physical distance.",
    },
    cns: {
      name: "增加間距 · 尚未核實",
      sourceNote:
        "CNS contains character-position material, but its target grammar and geometry have not yet been audited against the V0.1 text-point model. GB geometry is not inherited.",
    },
    ks: {
      name: "띄움표",
      sourceNote: "Hancom documents 띄움표 when material that should be spaced is joined. Horizontal source-backed reconstruction; direct KS geometry remains unverified.",
    },
    en: {
      name: "Insert space",
      sourceNote: "Traditional US charts use the number sign to insert spacing at a text boundary.",
    },
  },
  {
    id: "decrease-spacing",
    label: "Decrease spacing",
    variants: ["decrease-spacing"],
    jis: {
      name: "ベタ組",
      sourceNote: "JIS Z 8208:2007 includes ベタ組 for closing spacing. The V0.1 range must select existing whitespace.",
    },
    gb: {
      name: "减小空距",
      sourceNote: "GB/T 14706—93 item 16 specifies reducing spacing. The V0.1 range selects the spacing already present in source text.",
    },
    cns: {
      name: "縮小間距 · 尚未核實",
      sourceNote:
        "The existing-whitespace range remains valid semantic data, but no CNS-direct geometry is claimed until the source target grammar is audited.",
    },
    ks: {
      name: "붙임표",
      sourceNote: "Hancom documents 붙임표 when separated material should be joined. Horizontal source-backed reconstruction; direct KS geometry remains unverified.",
    },
    en: {
      name: "Close up",
      sourceNote: "Traditional US charts use close-up marks around unwanted space. The semantic target is the existing whitespace range.",
    },
  },
];

const notationPacks: Record<NotationId, NotationPack> = {
  technical: technicalNotationPack,
  jis: japaneseJisNotationPack,
  gb: chineseGbNotationPack,
  cns: taiwanCns3927NotationPack,
  ks: koreanKsNotationPack,
  en: englishUsNotationPack,
};

const galleryPacks: Record<ReferenceNotationId, NotationPack> = {
  jis: japaneseJisNotationPack,
  gb: chineseGbNotationPack,
  cns: taiwanCns3927NotationPack,
  ks: koreanKsNotationPack,
  en: englishUsNotationPack,
};

const galleryPackIds = ["jis", "gb", "cns", "ks", "en"] as const;

function requireElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Playground element not found: ${selector}`);
  return element;
}

const app = requireElement<HTMLElement>("#app");
const skipLink = document.querySelector<HTMLAnchorElement>(".skip-link");

skipLink?.addEventListener("click", (event) => {
  const mainContent = document.querySelector<HTMLElement>("#main-content");
  if (!mainContent) return;
  event.preventDefault();
  mainContent.focus();
  mainContent.scrollIntoView({ block: "start" });
});
// A page restored from history must not keep the skip link focused over the logo.
window.addEventListener("pageshow", () => {
  if (document.activeElement === skipLink) skipLink?.blur();
});

function correctionsForFixture(fixture: Fixture): readonly Correction[] {
  return fixture.corrections ?? [fixture.correction];
}

function galleryCorrection(
  fixture: Fixture,
  pack: ReferenceNotationId,
): Correction {
  if (pack === "gb") return fixture.gbCorrection ?? fixture.correction;
  if (pack === "cns") return fixture.cnsCorrection ?? fixture.correction;
  if (pack === "ks") return fixture.ksCorrection ?? fixture.correction;
  if (pack === "en") return fixture.enCorrection ?? fixture.correction;
  return fixture.correction;
}

function galleryCorrections(
  fixture: Fixture,
  pack: ReferenceNotationId,
): readonly Correction[] {
  if (pack === "ks") {
    if (fixture.ksCorrections) return fixture.ksCorrections;
    if (fixture.ksCorrection) return [fixture.ksCorrection];
    return correctionsForFixture(fixture);
  }
  if (pack === "en") {
    if (fixture.enCorrections) return fixture.enCorrections;
    if (fixture.enCorrection) return [fixture.enCorrection];
    return correctionsForFixture(fixture);
  }
  if (pack === "gb") {
    if (fixture.gbCorrections) return fixture.gbCorrections;
    if (fixture.gbCorrection) return [fixture.gbCorrection];
    return correctionsForFixture(fixture);
  }
  if (pack === "cns") {
    if (fixture.cnsCorrections) return fixture.cnsCorrections;
    if (fixture.cnsCorrection) return [fixture.cnsCorrection];
    return correctionsForFixture(fixture);
  }
  return correctionsForFixture(fixture);
}

function galleryText(fixture: Fixture, pack: ReferenceNotationId): string {
  if (pack === "gb") return fixture.gbText ?? fixture.text;
  if (pack === "cns") return fixture.cnsText ?? fixture.text;
  if (pack === "ks") return fixture.ksText ?? fixture.text;
  if (pack === "en") return fixture.enText ?? fixture.text;
  return fixture.text;
}

function galleryVariantLabel(fixture: Fixture, pack: ReferenceNotationId): string {
  return pack === "en" ? (fixture.enVariantLabel ?? fixture.variantLabel) : fixture.variantLabel;
}

function galleryVariants(operation: OperationSpec, pack: ReferenceNotationId): FixtureId[] {
  return pack === "en" ? (operation.enVariants ?? operation.variants) : operation.variants;
}

function directCorrection(
  correction: Correction,
  corrections: readonly Correction[],
): Exclude<Correction, { type: "cancel-correction" }> {
  let current = correction;
  const visited = new Set<string>();
  while (current.type === "cancel-correction") {
    if (visited.has(current.id)) throw new Error("Cyclic fixture correction relation.");
    visited.add(current.id);
    const referencedId = current.target.correctionId;
    const referenced = corrections.find(
      ({ id }) => id === referencedId,
    );
    if (!referenced) throw new Error(`Missing fixture correction ${referencedId}.`);
    current = referenced;
  }
  return current;
}

function setTargetDataset(
  element: HTMLElement,
  correction: Correction,
  corrections: readonly Correction[] = [correction],
): void {
  delete element.dataset.targetStart;
  delete element.dataset.targetEnd;
  delete element.dataset.targetOffset;
  const resolved = directCorrection(correction, corrections);
  const target = getCorrectionTargets(resolved)[0]!;
  if (target.kind === "text-point") {
    element.dataset.targetOffset = String(target.offset);
  } else {
    element.dataset.targetStart = String(target.start);
    element.dataset.targetEnd = String(target.end);
  }
}

function notationScope(notation: NotationId, fidelity: string): string {
  if (notation === "technical") {
    return "Technical renderer — useful for geometry inspection, not a traditional notation.";
  }
  if (fidelity.includes("unsupported")) {
    return "Unsupported writing mode — Traditional US proofreading is implemented for horizontal text only; no vertical construction is claimed.";
  }
  if (fidelity.includes("generic-fallback")) {
    if (notation === "gb") {
      return "Generic Proofmarks fallback — GB/T 14706 canonical status is not claimed for this operation, scale, or writing mode.";
    }
    if (notation === "cns") {
      return "Generic Proofmarks fallback — this CNS 3927 cell remains unverified and does not inherit GB geometry.";
    }
    if (notation === "ks") {
      return "Generic Proofmarks fallback — KS A 0104 canonical status is not claimed for this operation, scale, or writing mode.";
    }
    return "Generic Proofmarks fallback — JIS canonical status is not claimed for this geometry.";
  }
  if (notation === "gb") {
    return "Reference-based GB/T 14706 reconstruction — not a certification or conformity claim.";
  }
  if (notation === "cns") {
    return "Reference-based Taiwan CNS 3927 reconstruction — official source inspected; no certification, conformity, or redistribution claim.";
  }
  if (notation === "ks") {
    return "Korean horizontal reference reconstruction — cross-checked against official teaching and product documentation; not verified KS-conformant.";
  }
  if (notation === "en") {
    return "Reference-based traditional US reconstruction — conventions vary by publisher and house style; this is not a national-standard claim.";
  }
  return "Reference-based JIS reconstruction — not verified standards-conformant.";
}

function renderWorkbench(): void {
  app.innerHTML = `
    <header class="masthead">
      <div>
        <p class="eyebrow">English · US notation pack · Task 005</p>
        <h1>re:proofmarks</h1>
      </div>
      <div class="masthead-copy">
        <p class="premise">Encode the editorial intent once. Let each notation decide how it should be typeset.</p>
        <nav class="route-links" aria-label="Engineering views">
          <a class="text-link" href="${siteHref("/get-started")}">Open Get started →</a>
          <a class="text-link" href="${siteHref("/marks")}">Open mark galleries →</a>
          <a class="text-link" href="${siteHref("/compare")}">Compare all five systems →</a>
          <a class="text-link" href="${siteHref("/dx")}">Developer quickstart →</a>
          <a class="text-link" href="${siteHref("/")}">Public overview →</a>
        </nav>
      </div>
    </header>

    <section class="workbench" aria-labelledby="workbench-title">
      <div class="controls">
        <label class="select-control" for="notation-select">
          <span class="control-label">Notation</span>
          <select id="notation-select" aria-label="Notation">
            <option value="technical">Technical</option>
            <option value="jis" selected>日本 · JIS</option>
            <option value="gb">中文 · GB</option>
            <option value="cns">臺灣 · CNS 3927</option>
            <option value="ks">한국 · KS</option>
            <option value="en">English · US</option>
          </select>
        </label>

        <label class="select-control" for="fixture-select">
          <span class="control-label">Fixture</span>
          <select id="fixture-select" aria-label="Fixture">
            ${Object.entries(fixtures)
              .map(([id, fixture]) => `<option value="${id}">${fixture.label}</option>`)
              .join("")}
          </select>
        </label>

        <div>
          <p class="control-label" id="workbench-title">Writing direction</p>
          <div class="mode-switch" role="radiogroup" aria-labelledby="workbench-title">
            <label><input type="radio" name="writing-mode" value="horizontal-tb" checked /><span>Horizontal</span></label>
            <label><input type="radio" name="writing-mode" value="vertical-rl" /><span>Vertical</span></label>
          </div>
        </div>

        <label class="size-control" for="sheet-width">
          <span class="control-label">Document width</span>
          <span class="size-readout"><output id="sheet-width-output">640</output> px</span>
          <input id="sheet-width" type="range" min="260" max="800" value="640" step="10" />
        </label>

        <label class="debug-toggle" for="show-geometry">
          <input id="show-geometry" type="checkbox" />
          <span class="debug-box" aria-hidden="true"></span>
          <span>Show geometry</span>
        </label>
      </div>

      <div class="render-status" aria-live="polite">
        <span class="status-dot" aria-hidden="true"></span>
        <span id="mode-status">horizontal-tb</span>
        <span aria-hidden="true">·</span>
        <span id="rect-status">1 DOMRect</span>
        <span aria-hidden="true">·</span>
        <strong id="fidelity-status">reference-based</strong>
      </div>

      <div class="stage" id="proof-stage">
        <article
          class="proof-sheet"
          id="proof-document"
          data-testid="proof-document"
          data-writing-mode="horizontal-tb"
          lang="ja"
          style="width: 640px"
        >${fixtures["delete-single"].text}</article>
      </div>

      <p class="scope-note" id="scope-note">Reference-based JIS reconstruction — not verified standards-conformant.</p>
    </section>

    <aside class="correction-data" aria-labelledby="correction-title">
      <div>
        <p class="eyebrow">Semantic data · unchanged by notation or layout</p>
        <h2 id="correction-title">Coordinates stay out of the correction.</h2>
      </div>
      <pre><code id="semantic-json">${JSON.stringify(fixtures["delete-single"].correction, null, 2)}</code></pre>
    </aside>
  `;

  const documentElement = requireElement<HTMLElement>("#proof-document");
  const notationSelect = requireElement<HTMLSelectElement>("#notation-select");
  const fixtureSelect = requireElement<HTMLSelectElement>("#fixture-select");
  const widthInput = requireElement<HTMLInputElement>("#sheet-width");
  const widthOutput = requireElement<HTMLOutputElement>("#sheet-width-output");
  const geometryInput = requireElement<HTMLInputElement>("#show-geometry");
  const modeStatus = requireElement<HTMLElement>("#mode-status");
  const rectStatus = requireElement<HTMLElement>("#rect-status");
  const fidelityStatus = requireElement<HTMLElement>("#fidelity-status");
  const scopeNote = requireElement<HTMLElement>("#scope-note");
  const semanticJson = requireElement<HTMLElement>("#semantic-json");

  let activeFixture = fixtures["delete-single"];
  const options: ProofmarksOptions = {
    corrections: correctionsForFixture(activeFixture),
    notation: japaneseJisNotationPack,
    debug: false,
  };
  const proofmarks = createProofmarks(documentElement, options);

  function updateStatus(): void {
    const overlay = documentElement.querySelector<SVGSVGElement>("[data-proofmarks-overlay]");
    const count = Number(overlay?.dataset.clientRectCount ?? 0);
    const fidelity = overlay?.dataset.fidelity || "unresolved";
    const notation = notationSelect.value as NotationId;
    rectStatus.textContent = `${count} ${count === 1 ? "DOMRect" : "DOMRects"}`;
    fidelityStatus.textContent = fidelity;
    scopeNote.textContent = notationScope(notation, fidelity);
  }

  function renderAndReport(): void {
    proofmarks.update(options);
    updateStatus();
  }

  function setFixture(id: FixtureId): void {
    activeFixture = fixtures[id];
    const sourceNode = documentElement.firstChild;
    if (!(sourceNode instanceof Text)) {
      throw new Error("The proof fixture must begin with a source text node.");
    }
    sourceNode.data = activeFixture.text;
    const corrections = correctionsForFixture(activeFixture);
    options.corrections = corrections;
    setTargetDataset(documentElement, activeFixture.correction, corrections);
    semanticJson.textContent = JSON.stringify(
      corrections.length === 1 ? activeFixture.correction : { corrections },
      null,
      2,
    );
    renderAndReport();
  }

  notationSelect.addEventListener("change", () => {
    const notation = notationSelect.value as NotationId;
    options.notation = notationPacks[notation];
    documentElement.lang = notationPacks[notation].locale;
    renderAndReport();
  });
  fixtureSelect.addEventListener("change", () => setFixture(fixtureSelect.value as FixtureId));
  document.querySelectorAll<HTMLInputElement>('input[name="writing-mode"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      documentElement.style.writingMode = input.value;
      documentElement.dataset.writingMode = input.value;
      modeStatus.textContent = input.value;
      renderAndReport();
    });
  });
  widthInput.addEventListener("input", () => {
    documentElement.style.width = `${widthInput.value}px`;
    widthOutput.value = widthInput.value;
    renderAndReport();
  });
  geometryInput.addEventListener("change", () => {
    options.debug = geometryInput.checked;
    renderAndReport();
  });

  setFixture("delete-single");
  window.addEventListener("pagehide", () => proofmarks.destroy(), { once: true });
}

function expectedGalleryFidelity(
  pack: ReferenceNotationId,
  operation: Correction["type"],
  mode: WritingMode,
): "reference-based" | "generic-fallback" | "unsupported" {
  if (!galleryPacks[pack].writingModes.includes(mode)) return "unsupported";
  if (pack === "jis") {
    if (mode === "vertical-rl" && ["move", "increase-spacing", "decrease-spacing"].includes(operation)) {
      return "generic-fallback";
    }
    return "reference-based";
  }
  if (pack === "cns") {
    return getCns3927Capability(operation, "inline", mode) === "reference-based"
      ? "reference-based"
      : "generic-fallback";
  }
  if (mode === "vertical-rl") return "generic-fallback";
  if (pack === "ks" && operation === "cancel-correction") {
    return "generic-fallback";
  }
  return "reference-based";
}

function escapeMarkup(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function visibleSourceText(value: string): string {
  return [...value].map((character) => {
    if (character === " ") return "␠";
    if (character === "\t") return "⇥";
    if (character === "\n") return "↵";
    if (character === "\r") return "␍";
    if (character === "\u00a0") return "␣";
    if (character === "\u3000") return "□";
    return character;
  }).join("");
}

function describedCodePoints(value: string): string {
  const whitespaceNames: Record<string, string> = {
    " ": "SPACE",
    "\t": "TAB",
    "\n": "LINE FEED",
    "\r": "CARRIAGE RETURN",
    "\u00a0": "NO-BREAK SPACE",
    "\u3000": "IDEOGRAPHIC SPACE",
  };
  return [...value]
    .map((character) => {
      const point = `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
      return `${whitespaceNames[character] ?? `CHARACTER ${visibleSourceText(character)}`} · ${point}`;
    })
    .join(" · ");
}

function rangeMetadataMarkup(
  text: string,
  target: { start: number; end: number },
  label = "Selected range",
): string {
  const selected = text.slice(target.start, target.end);
  const characters = [...selected];
  const needsCodePoints =
    (characters.length > 0 && characters.every((character) => /\s/u.test(character))) ||
    characters.some((character) => /[\t\n\r\u00a0\u3000]/u.test(character));
  return `
    <p><span>${label}</span><code>“${escapeMarkup(visibleSourceText(selected))}”</code></p>
    <p><span>UTF-16 range</span><code>${target.start}–${target.end}</code></p>
    ${needsCodePoints ? `<p><span>Whitespace characters</span><code>${describedCodePoints(selected)}</code></p>` : ""}`;
}

function targetMetadataMarkup(fixture: Fixture, pack: ReferenceNotationId): string {
  const text = galleryText(fixture, pack);
  const corrections = galleryCorrections(fixture, pack);
  const correction = galleryCorrection(fixture, pack);
  let direct: Exclude<Correction, { type: "cancel-correction" }>;
  let relation = "";
  if (correction.type === "cancel-correction") {
    const referenced = corrections.find(({ id }) => id === correction.target.correctionId);
    if (!referenced || referenced.type === "cancel-correction") return "";
    direct = referenced;
    relation = `<p data-correction-relation><span>Correction relation</span><code>${escapeMarkup(correction.id)} → ${escapeMarkup(referenced.id)}</code></p>`;
  } else {
    direct = correction;
  }

  let targets = "";
  if (direct.type === "transpose") {
    targets = direct.targets
      .map((target, index) => rangeMetadataMarkup(text, target, `Selected range ${index + 1}`))
      .join("");
  } else if (direct.type === "move") {
    targets = `${rangeMetadataMarkup(text, direct.source, "Selected source")}<p><span>Destination boundary</span><code>${direct.destination.offset}</code></p>`;
  } else if (direct.target.kind === "text-point") {
    const offset = direct.target.offset;
    const left = visibleSourceText(text.slice(Math.max(0, offset - 1), offset));
    const right = visibleSourceText(text.slice(offset, offset + 1));
    targets = `<p><span>Text boundary</span><code>${offset} · ${escapeMarkup(left)}|${escapeMarkup(right)}</code></p>`;
  } else {
    targets = rangeMetadataMarkup(
      text,
      direct.target,
      correction.type === "cancel-correction" ? "Referenced text" : "Selected range",
    );
  }
  return `<div class="specimen-target-metadata" data-target-metadata>${relation}${targets}</div>`;
}

function galleryPackMarkup(pack: ReferenceNotationId): string {
  const metadata: Record<
    ReferenceNotationId,
    { eyebrow: string; title: string; summary: string }
  > = {
    jis: {
      eyebrow: "日本 · JIS Z 8208",
      title: "Japanese reference pack",
      summary: "Horizontal and vertical inline constructions are reference-based.",
    },
    gb: {
      eyebrow: "中文 · GB/T 14706",
      title: "Chinese reference pack",
      summary:
        "Horizontal constructions, including relation-aware 保留, are reference-based; vertical remains an explicit fallback.",
    },
    cns: {
      eyebrow: "臺灣 · CNS 3927",
      title: "Taiwan reference pack",
      summary:
        "CNS-specific delete, insert, wrong-character correction, and delete retention are reconstructed independently. Unverified operations never inherit GB geometry.",
    },
    ks: {
      eyebrow: "한국 · KS A 0104",
      title: "Korean reference pack",
      summary:
        "Eight horizontal operations are source-backed reconstructions; vertical and cancel-correction remain explicit fallbacks.",
    },
    en: {
      eyebrow: "English · US",
      title: "Traditional US proofreading",
      summary:
        "Horizontal forms are reference-based reconstructions across several US publishing sources. Vertical is explicitly unsupported, and publisher variation is expected.",
    },
  };
  const details = metadata[pack];
  return `
    <section class="notation-gallery" data-gallery-pack="${pack}" aria-labelledby="${pack}-gallery-title">
      <header class="notation-gallery-header">
        <div>
          <p class="eyebrow">${details.eyebrow}</p>
          <h2 id="${pack}-gallery-title">${details.title}</h2>
        </div>
        <p>${details.summary}</p>
      </header>
      <div class="mark-gallery">
        ${operations
          .map((operation) => {
            const localized = operation[pack];
            return `
              <section id="mark-${pack}-${operation.id}" class="mark-card" data-gallery-operation="${pack}-${operation.id}" data-operation-filter="${operation.id}">
                <header class="mark-card-header">
                  <div><p class="eyebrow">${operation.label}</p><h3>${localized.name}</h3></div>
                </header>
                <div class="mark-examples">
                  ${galleryVariants(operation, pack)
                    .flatMap((variantId) =>
                      (["horizontal-tb", "vertical-rl"] as const).map((mode) => {
                        const fixture = fixtures[variantId];
                        const fidelity = expectedGalleryFidelity(pack, operation.id, mode);
                        return `
                          <figure data-gallery-mode="${mode}">
                            <figcaption>
                              <span>${galleryVariantLabel(fixture, pack)} · ${mode === "horizontal-tb" ? "Horizontal" : "Vertical · rl"}</span>
                              <span class="fidelity-badge" data-expected-fidelity="${fidelity}">${fidelity}</span>
                            </figcaption>
                            <article
                              class="gallery-sheet"
                              data-gallery-sheet="${pack}-${variantId}-${mode}"
                              data-gallery-variant="${variantId}"
                              data-writing-mode="${mode}"
                              lang="${galleryPacks[pack].locale}"
                              style="writing-mode:${mode}"
                            >${galleryText(fixture, pack)}</article>
                            ${targetMetadataMarkup(fixture, pack)}
                          </figure>`;
                      }),
                    )
                    .join("")}
                </div>
                <details class="source-note audit-note">
                  <summary>Source and confidence</summary>
                  <p>${localized.sourceNote}</p>
                  <p>${pack === "cns" ? "Direct cells: geometry high · typography medium · placement medium. Other cells remain unverified." : pack === "ks" ? "Geometry medium · typography medium · placement low" : pack === "en" ? "Geometry medium · typography medium · placement medium" : "Geometry high · typography medium · placement medium"}</p>
                </details>
              </section>`;
          })
          .join("")}
      </div>
    </section>`;
}

function nativeSpecimensMarkup(): string {
  return `
    <section class="native-specimens-intro" aria-labelledby="native-specimens-title">
      <p class="small-label">Native canonical specimens</p>
      <h2 id="native-specimens-title">Each notation returns to its own language.</h2>
      <p>JIS uses Japanese, GB uses Mainland Chinese, CNS 3927 uses Taiwan Hant, KS uses Korean, and English · US uses English. These native inspection fixtures stay separate from the shared-English engineering stress test.</p>
    </section>`;
}

const spacingAuditOperations = ["increase-spacing", "decrease-spacing"] as const;
const multiWhitespaceStressText = "close \t\u00a0  up this gap.";
const multiWhitespaceStressCorrection = {
  id: "stress-close-mixed-whitespace",
  type: "decrease-spacing",
  target: { kind: "text-range", start: 5, end: 10 },
} as const satisfies Correction;

function spacingTargetLabel(correction: Correction): string {
  if (correction.type === "increase-spacing") {
    return `text-point · offset ${correction.target.offset}`;
  }
  if (correction.type === "decrease-spacing") {
    return `text-range · ${correction.target.start}–${correction.target.end}`;
  }
  throw new Error(`Unexpected spacing correction: ${correction.type}`);
}

function spacingAuditMarkup(): string {
  return `
    <section class="spacing-audit-section" aria-labelledby="spacing-audit-title">
      <header>
        <p class="small-label">Spacing family · priority audit</p>
        <h2 id="spacing-audit-title">A point opens. A range closes.</h2>
        <p>Each row uses native source text and a deliberately generous proof. Increase spacing targets one boundary; decrease spacing selects whitespace that already exists. Similar intent does not imply identical notation grammar.</p>
      </header>
      <div class="spacing-audit-list">
        ${galleryPackIds.map((pack) => `
          <section class="spacing-audit-row" data-spacing-pack="${pack}" aria-labelledby="spacing-${pack}-title">
            <header>
              <p class="eyebrow">${pack === "en" ? "English · US" : galleryPacks[pack].displayName}</p>
              <h3 id="spacing-${pack}-title">${pack === "jis" ? "アキ / ベタ" : pack === "gb" ? "加大空距 / 减小空距" : pack === "cns" ? "間距操作 · 尚未核實" : pack === "ks" ? "띄움표 / 붙임표" : "Insert space / close up"}</h3>
            </header>
            <div class="spacing-audit-pair">
              ${spacingAuditOperations.map((operationId) => {
                const fixture = fixtures[operationId];
                const correction = galleryCorrection(fixture, pack);
                const opening = operationId === "increase-spacing";
                return `
                  <figure data-spacing-operation="${pack}-${operationId}">
                    <figcaption>
                      <span>${opening ? "Open the boundary" : "Close the selected gap"}</span>
                      <code>${spacingTargetLabel(correction)}</code>
                    </figcaption>
                    <article class="spacing-audit-proof" data-spacing-audit="${pack}-${operationId}" lang="${galleryPacks[pack].locale}">${galleryText(fixture, pack)}</article>
                    <p>${opening ? "The mark attaches to a boundary between characters." : "The mark gathers an identified whitespace range."}</p>
                  </figure>`;
              }).join("")}
            </div>
          </section>`).join("")}
      </div>
      <figure class="multi-whitespace-stress" data-fixture-kind="multi-whitespace-stress">
        <figcaption>
          <span>Engineering target audit · English · US</span>
          <code>space + tab + no-break space + two spaces</code>
        </figcaption>
        <article class="spacing-audit-proof" data-spacing-multi-stress lang="en">${multiWhitespaceStressText}</article>
        <div class="specimen-target-metadata" data-target-metadata>
          ${rangeMetadataMarkup(multiWhitespaceStressText, multiWhitespaceStressCorrection.target)}
        </div>
      </figure>
      <p class="spacing-audit-limit">Horizontal forms are shown here. CNS spacing cells remain unverified and deliberately use generic fallback; JIS, GB, and KS vertical spacing also remain explicit fallbacks. English · US vertical spacing is unsupported.</p>
    </section>`;
}

function specimenControlsMarkup(): string {
  return `
    <details class="specimen-controls">
      <summary id="specimen-controls-title">
        <span>Specimen settings</span>
        <span class="specimen-readout" aria-live="polite">16 px · line height 1.5 · medium width · serif / Mincho · technical</span>
      </summary>
      <p>Change source typography without changing correction data or notation geometry.</p>
      <div class="specimen-control-row" aria-labelledby="specimen-controls-title">
        <label>Source size
          <select data-specimen-control="size">
            <option value="12">12 px</option>
            <option value="16" selected>16 px</option>
            <option value="24">24 px</option>
            <option value="32">32 px</option>
          </select>
        </label>
        <label>Line height
          <select data-specimen-control="line-height">
            <option value="1.2">Tight · 1.2</option>
            <option value="1.5" selected>Normal · 1.5</option>
            <option value="2">Loose · 2.0</option>
          </select>
        </label>
        <label>Proof width
          <select data-specimen-control="width">
            <option value="280">Narrow</option>
            <option value="420" selected>Medium</option>
            <option value="620">Wide</option>
          </select>
        </label>
        <label>Source face
          <select data-specimen-control="font">
            <option value="serif" selected>Serif / Mincho</option>
            <option value="sans">Sans / Gothic</option>
          </select>
        </label>
        <label>Appearance
          <select data-specimen-control="appearance">
            <option value="technical" selected>Technical</option>
            <option value="editorial">Editorial</option>
          </select>
        </label>
      </div>
    </details>`;
}

function marksFiltersMarkup(): string {
  return `
    <section class="marks-filters" aria-label="Filter canonical specimens">
      <div class="marks-filter-fields">
        <label>Notation
          <select data-marks-filter="notation">
            <option value="all">All notations</option>
            <option value="jis" selected>JIS</option>
            <option value="gb">GB</option>
            <option value="cns">臺灣 · CNS 3927</option>
            <option value="ks">KS</option>
            <option value="en">English · US</option>
          </select>
        </label>
        <label>Operation
          <select data-marks-filter="operation">
            <option value="all">All eight operations</option>
            ${operations.map(({ id, label }) => `<option value="${id}">${label}</option>`).join("")}
          </select>
        </label>
        <label>Writing mode
          <select data-marks-filter="writing-mode">
            <option value="all">Horizontal and vertical</option>
            <option value="horizontal-tb" selected>Horizontal</option>
            <option value="vertical-rl">Vertical · rl</option>
          </select>
        </label>
        <button type="button" data-marks-filter-reset>Show all marks</button>
      </div>
    </section>`;
}

type CoverageStatus = "DIRECT" | "GENERIC-FALLBACK" | "UNSUPPORTED" | "UNVERIFIED";

const coverageOperations = [
  "delete",
  "insert",
  "replace",
  "transpose",
  "move",
  "increase-spacing",
  "decrease-spacing",
  "cancel-correction",
] as const satisfies readonly Correction["type"][];

function coverageStatus(
  pack: ReferenceNotationId,
  operation: Correction["type"],
  writingMode: WritingMode,
): CoverageStatus {
  if (pack === "cns") {
    const capability = getCns3927Capability(operation, "inline", writingMode);
    if (capability === "reference-based") return "DIRECT";
    if (capability === "unsupported") return "UNSUPPORTED";
    if (capability === "unverified") return "UNVERIFIED";
    return "GENERIC-FALLBACK";
  }
  const fidelity = expectedGalleryFidelity(pack, operation, writingMode);
  if (fidelity === "unsupported") return "UNSUPPORTED";
  if (fidelity === "generic-fallback") return "GENERIC-FALLBACK";
  return "DIRECT";
}

function coverageLabel(status: CoverageStatus): string {
  if (status === "DIRECT") return "Direct";
  if (status === "GENERIC-FALLBACK") return "Generic fallback";
  if (status === "UNVERIFIED") return "Unverified · fallback";
  return "Unsupported";
}

function capabilityMatrixMarkup(): string {
  return `
    <section class="coverage-matrix-section" aria-labelledby="coverage-title">
      <header>
        <p class="small-label">V0.1 capability contract</p>
        <h2 id="coverage-title">Eight operations, without invented symmetry.</h2>
        <p>Each cell is evaluated per notation and writing mode. “Direct” means a source-backed pack construction; fallback and unsupported remain visible public states.</p>
      </header>
      <div class="coverage-table-wrap">
        <table class="coverage-table">
          <thead><tr><th scope="col">Operation</th>${galleryPackIds.map((pack) => `<th scope="col">${pack === "en" ? "US" : pack === "cns" ? "CNS 3927" : pack.toUpperCase()}</th>`).join("")}</tr></thead>
          <tbody>
            ${coverageOperations.map((operation) => `
              <tr>
                <th scope="row"><code>${operation}</code></th>
                ${galleryPackIds.map((pack) => {
                  const horizontal = coverageStatus(pack, operation, "horizontal-tb");
                  const vertical = coverageStatus(pack, operation, "vertical-rl");
                  return `<td><span data-coverage-status="${horizontal}">H · ${coverageLabel(horizontal)}</span><span data-coverage-status="${vertical}">V · ${coverageLabel(vertical)}</span></td>`;
                }).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>`;
}

const openingProofText = "文章を校正すゐ。";
const openingProofCorrections = [{
  id: "opening-replace-kana",
  type: "replace",
  target: { kind: "text-range", start: 6, end: 7 },
  replacement: "る",
}] as const satisfies readonly Correction[];

function openingProofMarkup(): string {
  return `
    <figure class="marks-opening-specimen">
      <figcaption>
        <span>Live canonical proof</span>
        <span>日本 · JIS · replace</span>
      </figcaption>
      <article data-marks-opening-proof lang="ja">${openingProofText}</article>
      <p>One semantic correction rendered around live selectable text.</p>
    </figure>`;
}

const mixedProofText = "The editor carefully reviewed  the final manuscript yesterday.";
const mixedProofCorrections = [
  { id: "mixed-delete", type: "delete", target: { kind: "text-range", start: 11, end: 21 } },
  { id: "mixed-insert", type: "insert", target: { kind: "text-point", offset: 52 }, content: "edited " },
  { id: "mixed-replace", type: "replace", target: { kind: "text-range", start: 4, end: 10 }, replacement: "writer" },
  { id: "mixed-transpose", type: "transpose", targets: [{ kind: "text-range", start: 35, end: 40 }, { kind: "text-range", start: 41, end: 51 }] },
  { id: "mixed-move", type: "move", source: { kind: "text-range", start: 52, end: 61 }, destination: { kind: "text-point", offset: 0 } },
  { id: "mixed-increase", type: "increase-spacing", target: { kind: "text-point", offset: 3 } },
  { id: "mixed-decrease", type: "decrease-spacing", target: { kind: "text-range", start: 29, end: 31 } },
  { id: "mixed-cancel", type: "cancel-correction", target: { kind: "correction", correctionId: "mixed-delete" } },
] as const satisfies readonly Correction[];

function mixedProofMarkup(): string {
  return `
    <section class="mixed-proof-section" data-fixture-kind="layout-stress" aria-labelledby="mixed-proof-title">
      <header>
        <p class="small-label">Mixed proof · engineering layout stress fixture</p>
        <h2 id="mixed-proof-title">Eight operations share one intentionally dense proof.</h2>
        <p>This is an integration demonstration, not a canonical specimen or recommended proofreading density. The English source and semantic corrections stay fixed; only the notation pack changes.</p>
      </header>
      <div class="mixed-proof-grid">
        ${galleryPackIds.map((pack) => `
          <figure>
            <figcaption>${pack === "en" ? "English · US" : galleryPacks[pack].displayName} · shared English fixture</figcaption>
            <article class="gallery-sheet mixed-proof-sheet" data-mixed-proof="${pack}" lang="en">${mixedProofText}</article>
          </figure>`).join("")}
      </div>
      <details class="compare-semantic"><summary>Inspect the eight corrections</summary><pre><code>${JSON.stringify(mixedProofCorrections, null, 2)}</code></pre></details>
    </section>`;
}

function renderGallery(): void {
  document.title = "Marks — re:proofmarks";
  app.innerHTML = `
    <div class="public-site marks-page" data-specimen-appearance="technical">
      ${publicHeaderMarkup("marks")}
      <main id="main-content" tabindex="-1">
        <header class="page-intro marks-intro">
          <div>
            <p class="small-label">Proofreading marks</p>
            <h1>Five visual grammars,<br>kept precise.</h1>
            <p>Browse source-backed marks on real, selectable text.</p>
          </div>
          ${openingProofMarkup()}
        </header>
        ${marksFiltersMarkup()}
        ${nativeSpecimensMarkup()}
        ${specimenControlsMarkup()}
        <div class="marks-content">
          ${galleryPackMarkup("jis")}
          ${galleryPackMarkup("gb")}
          ${galleryPackMarkup("cns")}
          ${galleryPackMarkup("ks")}
          ${galleryPackMarkup("en")}
        </div>
        <details class="marks-deep-dive">
          <summary>Technical evidence and stress tests</summary>
          <p class="reference-debug-note">Direct, fallback, unverified, and unsupported states are labeled; no conformity claim is made.</p>
          ${capabilityMatrixMarkup()}
          ${spacingAuditMarkup()}
          ${mixedProofMarkup()}
          <nav class="marks-tools" aria-label="Engineering views">
            <a href="${siteHref("/compare")}">Compare the same input</a>
            <a href="${siteHref("/workbench")}">Geometry workbench</a>
          </nav>
        </details>
        <footer class="gallery-footer">Sources, limits, and attribution are documented in <a href="${siteHref("/docs#references")}">References</a>.</footer>
      </main>
      ${publicFooterMarkup()}
    </div>
  `;

  const instances: ProofmarksInstance[] = [];
  const technicalInstances: ProofmarksInstance[] = [];
  const specimenInstances: Array<{
    element: HTMLElement;
    corrections: readonly Correction[];
    notation: NotationPack;
    instance: ProofmarksInstance;
  }> = [];
  const openingProofElement = requireElement<HTMLElement>("[data-marks-opening-proof]");
  const openingProofInstance = createProofmarks(openingProofElement, {
    corrections: openingProofCorrections,
    notation: japaneseJisNotationPack,
    appearance: "technical",
  });
  openingProofInstance.render();
  instances.push(openingProofInstance);
  for (const packId of galleryPackIds) {
    const element = requireElement<HTMLElement>(`[data-mixed-proof="${packId}"]`);
    const instance = createProofmarks(element, {
      corrections: mixedProofCorrections,
      notation: galleryPacks[packId],
    });
    instances.push(instance);
    technicalInstances.push(instance);
  }
  for (const packId of galleryPackIds) {
    for (const operationId of spacingAuditOperations) {
      const fixture = fixtures[operationId];
      const element = requireElement<HTMLElement>(
        `[data-spacing-audit="${packId}-${operationId}"]`,
      );
      const instance = createProofmarks(element, {
        corrections: galleryCorrections(fixture, packId),
        notation: galleryPacks[packId],
      });
      instance.render();
      instances.push(instance);
      technicalInstances.push(instance);
    }
  }
  const multiWhitespaceElement = requireElement<HTMLElement>("[data-spacing-multi-stress]");
  const multiWhitespaceInstance = createProofmarks(multiWhitespaceElement, {
    corrections: [multiWhitespaceStressCorrection],
    notation: englishUsNotationPack,
  });
  multiWhitespaceInstance.render();
  instances.push(multiWhitespaceInstance);
  technicalInstances.push(multiWhitespaceInstance);
  for (const packId of galleryPackIds) {
    for (const operation of operations) {
      for (const variantId of galleryVariants(operation, packId)) {
        for (const mode of ["horizontal-tb", "vertical-rl"] as const) {
          const element = requireElement<HTMLElement>(
            `[data-gallery-sheet="${packId}-${variantId}-${mode}"]`,
          );
          const corrections = galleryCorrections(fixtures[variantId], packId);
          const notation = galleryPacks[packId];
          const instance = createProofmarks(element, {
            corrections,
            notation,
          });
          instance.render();
          instances.push(instance);
          specimenInstances.push({ element, corrections, notation, instance });
        }
      }
    }
  }

  const sizeControl = requireElement<HTMLSelectElement>('[data-specimen-control="size"]');
  const lineHeightControl = requireElement<HTMLSelectElement>('[data-specimen-control="line-height"]');
  const widthControl = requireElement<HTMLSelectElement>('[data-specimen-control="width"]');
  const fontControl = requireElement<HTMLSelectElement>('[data-specimen-control="font"]');
  const appearanceControl = requireElement<HTMLSelectElement>('[data-specimen-control="appearance"]');
  const readout = requireElement<HTMLElement>(".specimen-readout");
  const marksPage = requireElement<HTMLElement>(".marks-page");
  const applySpecimenControls = (): void => {
    const fontFamily = fontControl.value === "sans"
      ? '"Noto Sans CJK JP", "Noto Sans TC", "PingFang TC", "Yu Gothic", "Malgun Gothic", "Microsoft JhengHei", "Microsoft YaHei", sans-serif'
      : '"Noto Serif CJK JP", "Noto Serif TC", "Songti TC", "Yu Mincho", "Batang", PMingLiU, "Songti SC", serif';
    for (const item of specimenInstances) {
      item.element.style.fontSize = `${sizeControl.value}px`;
      item.element.style.lineHeight = lineHeightControl.value;
      item.element.style.fontFamily = fontFamily;
      item.element.style.inlineSize = `${widthControl.value}px`;
      item.instance.update({
        corrections: item.corrections,
        notation: item.notation,
        appearance: appearanceControl.value as "technical" | "editorial",
      });
    }
    marksPage.dataset.specimenAppearance = appearanceControl.value;
    readout.textContent = `${sizeControl.value} px · line height ${lineHeightControl.value} · ${widthControl.options[widthControl.selectedIndex]?.text.toLowerCase()} width · ${fontControl.options[fontControl.selectedIndex]?.text.toLowerCase()} · ${appearanceControl.value}`;
  };
  for (const control of [sizeControl, lineHeightControl, widthControl, fontControl, appearanceControl]) {
    control.addEventListener("change", applySpecimenControls);
  }
  applySpecimenControls();

  const notationFilter = requireElement<HTMLSelectElement>('[data-marks-filter="notation"]');
  const operationFilter = requireElement<HTMLSelectElement>('[data-marks-filter="operation"]');
  const writingModeFilter = requireElement<HTMLSelectElement>('[data-marks-filter="writing-mode"]');
  const resetFilters = requireElement<HTMLButtonElement>("[data-marks-filter-reset]");
  const applyMarksFilters = (): void => {
    for (const gallery of document.querySelectorAll<HTMLElement>("[data-gallery-pack]")) {
      gallery.hidden = notationFilter.value !== "all" &&
        gallery.dataset.galleryPack !== notationFilter.value;
    }
    for (const card of document.querySelectorAll<HTMLElement>("[data-operation-filter]")) {
      card.hidden = operationFilter.value !== "all" &&
        card.dataset.operationFilter !== operationFilter.value;
    }
    for (const figure of document.querySelectorAll<HTMLElement>("[data-gallery-mode]")) {
      figure.hidden = writingModeFilter.value !== "all" &&
        figure.dataset.galleryMode !== writingModeFilter.value;
    }
    resetFilters.hidden = notationFilter.value === "all" &&
      operationFilter.value === "all" &&
      writingModeFilter.value === "all";
  };
  for (const filter of [notationFilter, operationFilter, writingModeFilter]) {
    filter.addEventListener("change", () => {
      applyMarksFilters();
      requestAnimationFrame(() => {
        for (const item of specimenInstances) {
          if (!item.element.closest("[hidden]")) item.instance.render();
        }
      });
    });
  }
  resetFilters.addEventListener("click", () => {
      notationFilter.value = "all";
      operationFilter.value = "all";
      writingModeFilter.value = "all";
      notationFilter.focus();
      applyMarksFilters();
    });
  applyMarksFilters();
  const deepDive = requireElement<HTMLDetailsElement>(".marks-deep-dive");
  deepDive.addEventListener("toggle", () => {
    if (deepDive.open) requestAnimationFrame(() => technicalInstances.forEach((instance) => instance.render()));
  });
  window.addEventListener("pagehide", () => instances.forEach((instance) => instance.destroy()), {
    once: true,
  });
}

const compareCases: Array<{ operation: Correction["type"]; fixture: FixtureId }> = [
  { operation: "delete", fixture: "delete-single" },
  { operation: "insert", fixture: "insert" },
  { operation: "replace", fixture: "replace-single" },
  { operation: "transpose", fixture: "transpose" },
  { operation: "cancel-correction", fixture: "cancel-correction" },
];

function renderCompare(): void {
  app.innerHTML = `
    <header class="gallery-header compare-header">
      <div>
        <p class="eyebrow">Same input, five notations</p>
        <h1>Compare proofreading marks</h1>
      </div>
      <div class="masthead-copy">
        <p class="premise">Select an edit to compare how JIS, GB, CNS 3927, KS, and US notation mark the same text.</p>
        <nav class="route-links" aria-label="Engineering views">
          <a class="text-link" href="${siteHref("/marks")}">Mark gallery</a>
          <a class="text-link" href="${siteHref("/workbench")}">Geometry workbench</a>
        </nav>
      </div>
    </header>
    <main class="compare-list">
      ${compareCases
        .map(({ operation, fixture: fixtureId }) => {
          const fixture = fixtures[fixtureId];
          const operationSpec = operations.find((item) => item.id === operation)!;
          return `
            <details class="compare-case" data-compare-operation="${operation}" open>
              <summary class="compare-case-header"><h2>${operationSpec.label}</h2></summary>
              <div class="compare-grid">
                <figure>
                  <figcaption>日本 · JIS <span class="fidelity-badge">reference-based</span></figcaption>
                  <article class="gallery-sheet compare-sheet" data-compare-side="jis" data-compare-sheet="${operation}-jis" lang="en">${fixture.text}</article>
                </figure>
                <figure>
                  <figcaption>中文 · GB <span class="fidelity-badge">reference-based</span></figcaption>
                  <article class="gallery-sheet compare-sheet" data-compare-side="gb" data-compare-sheet="${operation}-gb" lang="en">${fixture.text}</article>
                </figure>
                <figure>
                  <figcaption>臺灣 · CNS 3927 <span class="fidelity-badge" data-expected-fidelity="${expectedGalleryFidelity("cns", operation, "horizontal-tb")}">${getCns3927Capability(operation, "inline", "horizontal-tb") === "unverified" ? "unverified · fallback" : "reference-based"}</span></figcaption>
                  <article class="gallery-sheet compare-sheet" data-compare-side="cns" data-compare-sheet="${operation}-cns" lang="en">${fixture.text}</article>
                </figure>
                <figure>
                  <figcaption>한국 · KS <span class="fidelity-badge" data-expected-fidelity="${operation === "cancel-correction" ? "generic-fallback" : "reference-based"}">${operation === "cancel-correction" ? "generic-fallback" : "reference-based"}</span></figcaption>
                  <article class="gallery-sheet compare-sheet" data-compare-side="ks" data-compare-sheet="${operation}-ks" lang="en">${fixture.text}</article>
                </figure>
                <figure>
                  <figcaption>English · US <span class="fidelity-badge" data-expected-fidelity="reference-based">reference-based</span></figcaption>
                  <article class="gallery-sheet compare-sheet" data-compare-side="en" data-compare-sheet="${operation}-en" lang="en">${fixture.text}</article>
                </figure>
              </div>
              <details class="compare-semantic">
                <summary>Inspect shared semantic correction</summary>
                <pre><code data-compare-semantic="${operation}">${JSON.stringify(fixture.correction, null, 2)}</code></pre>
              </details>
              ${operation === "cancel-correction" ? '<p class="source-note">Same correction relation: JIS places イキ by the referenced text; GB and CNS 3927 each render their independently sourced retention forms against the referenced deletion; KS remains an explicit fallback; English · US places dotted retention marks under the original and adds stet. All five resolve the referenced correction before rendering.</p>' : ""}
            </details>`;
        })
        .join("")}
    </main>
  `;

  const instances: ProofmarksInstance[] = [];
  const instancesByOperation = new Map<Correction["type"], ProofmarksInstance[]>();
  for (const { operation, fixture: fixtureId } of compareCases) {
    const correction = fixtures[fixtureId].correction;
    const operationInstances: ProofmarksInstance[] = [];
    for (const packId of galleryPackIds) {
      const element = requireElement<HTMLElement>(
        `[data-compare-sheet="${operation}-${packId}"]`,
      );
      const corrections = correctionsForFixture(fixtures[fixtureId]);
      setTargetDataset(element, correction, corrections);
      const instance = createProofmarks(element, {
        corrections,
        notation: galleryPacks[packId],
      });
      instance.render();
      instances.push(instance);
      operationInstances.push(instance);
    }
    instancesByOperation.set(operation, operationInstances);
  }
  for (const { operation } of compareCases.slice(1)) {
    const section = requireElement<HTMLDetailsElement>(`[data-compare-operation="${operation}"]`);
    section.open = false;
    section.addEventListener("toggle", () => {
      if (section.open) {
        for (const instance of instancesByOperation.get(operation) ?? []) instance.render();
      }
    });
  }
  window.addEventListener("pagehide", () => instances.forEach((instance) => instance.destroy()), {
    once: true,
  });
}

const publicPaths = new Set([
  "/",
  "/get-started",
  "/playground",
  "/suggest",
  "/marks",
  "/references",
  "/docs",
  "/demo",
]);
const pathname = sitePathname(window.location.pathname);
document.body.classList.toggle("public-surface", publicPaths.has(pathname));

if (pathname === "/demo") {
  void import("./demo/demo").then(({ renderStoryDemo }) => renderStoryDemo(app));
} else if (pathname === "/") {
  void import("./site").then(({ renderPublicSite }) => renderPublicSite(app, "overview"));
} else if (pathname === "/references") {
  window.location.replace(`${siteHref("/docs")}${window.location.search}#references`);
} else if (pathname === "/docs") {
  void import("./docs").then(({ renderDocs }) => renderDocs(app));
} else if (pathname === "/marks") {
  void import("./marks").then(({ renderMarks }) => renderMarks(app));
}
else if (import.meta.env.DEV && pathname === "/fixtures/marks") renderGallery();
else if (pathname === "/workbench") renderWorkbench();
else if (pathname === "/compare") renderCompare();
else if (pathname === "/dx") {
  void import("./dx").then(({ renderDeveloperExperience }) => {
    renderDeveloperExperience(app);
  });
} else if (pathname === "/get-started" || pathname === "/playground") {
  // The former /playground URL stays an alias of Get started.
  if (pathname === "/playground") {
    history.replaceState(history.state, "", `${siteHref("/get-started")}${window.location.search}${window.location.hash}`);
  }
  void import("./get-started").then(({ renderGetStarted }) => renderGetStarted(app));
} else if (pathname === "/suggest") {
  void import("./suggesting").then(({ renderSuggestingWorkbench }) => {
    renderSuggestingWorkbench(app);
  });
} else if (pathname === "/layout") {
  void import("./layout-lab").then(({ renderLayoutLab }) => {
    renderLayoutLab(app);
  });
} else renderWorkbench();
