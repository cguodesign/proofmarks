import type { Correction, CorrectionType, TextRangeTarget, WritingMode } from "proofmarks";
import { cns3927, enUS, gb, jis, ks } from "proofmarks/notations";
import { escapeHighlightMarkers, hl } from "./code-highlight";

/** The one room recommendation used by every copyable example. */
export const recommendedRoom = { padding: "44px 20px", lineHeight: 1.8 } as const;
export const languages = {
  enUS: { label: "English · US", lang: "en", pack: enUS, importName: "enUS", text: "The editor now reads.", word: "editor", replacement: "writer", before: "reads", insertion: "carefully ", swap: ["now", "reads"], move: " now", destination: ".", names: ["Delete", "Insert", "Replace", "Transpose", "Move", "Insert space", "Close up", "Stet"] },
  jis: { label: "日本語 · JIS", lang: "ja", pack: jis, importName: "jis", text: "編集者は丁寧に静かに原稿を読む。", word: "編集者", replacement: "著者", before: "原稿", insertion: "新しい", swap: ["丁寧に", "静かに"], move: "丁寧に", destination: "読む", names: ["トル", "挿入", "取り替え", "入れ替え", "移動", "空き量を増やす", "ベタ組", "イキ"] },
  gb: { label: "简体中文 · GB", lang: "zh-Hans", pack: gb, importName: "gb", text: "编辑仔细认真地审阅文稿。", word: "编辑", replacement: "作者", before: "文稿", insertion: "新的", swap: ["仔细", "认真"], move: "仔细", destination: "审阅", names: ["删除", "增补", "改正", "对调", "转移", "加大空距", "减小空距", "保留"] },
  cns3927: { label: "繁體中文 · CNS 3927", lang: "zh-Hant-TW", pack: cns3927, importName: "cns3927", text: "編輯仔細認真地審閱文稿。", word: "編輯", replacement: "作者", before: "文稿", insertion: "新的", swap: ["仔細", "認真"], move: "仔細", destination: "審閱", names: ["刪除", "插字", "改正錯字", "對調", "移動", "增加間距", "縮小間距", "保留"] },
  ks: { label: "한국어 · KS", lang: "ko", pack: ks, importName: "ks", text: "편집자는 차분히 꼼꼼히 원고를 읽는다.", word: "편집자", replacement: "저자", before: "원고", insertion: "새 ", swap: ["차분히", "꼼꼼히"], move: "차분히 ", destination: "읽는다", names: ["뺌표", "넣음표", "고침표", "자리 바꿈표", "자리 옮김", "띄움표", "붙임표", "취소 (일반 표기)"] },
} as const;
export type LanguageId = keyof typeof languages;
export const languageIds = Object.keys(languages) as LanguageId[];
/** The eight operations, in catalog order. Labels and descriptions live in the site dictionaries. */
export const operations = [
  { type: "delete", key: "delete" },
  { type: "insert", key: "insert" },
  { type: "replace", key: "replace" },
  { type: "transpose", key: "transpose" },
  { type: "move", key: "move" },
  { type: "increase-spacing", key: "increaseSpacing" },
  { type: "decrease-spacing", key: "decreaseSpacing" },
  { type: "cancel-correction", key: "cancelCorrection" },
] as const satisfies ReadonlyArray<{ type: CorrectionType; key: string }>;

function range(text: string, target: string): TextRangeTarget {
  const start = text.indexOf(target);
  if (start < 0) throw new Error(`Missing sample target: ${target}`);
  return { kind: "text-range", start, end: start + target.length };
}

export function sampleFor(language: LanguageId, type: CorrectionType, value?: string) {
  const sample = languages[language];
  let text: string = sample.text;
  let extraSpace = false;
  let correction: Correction;
  switch (type) {
    case "delete": correction = { id: type, type, target: range(text, sample.word) }; break;
    case "replace": correction = { id: type, type, target: range(text, sample.word), replacement: value ?? sample.replacement }; break;
    case "insert": correction = { id: type, type, target: { kind: "text-point", offset: text.indexOf(sample.before) }, content: value ?? sample.insertion }; break;
    case "transpose": correction = { id: type, type, targets: [range(text, sample.swap[0]), range(text, sample.swap[1])] }; break;
    case "move": correction = { id: type, type, source: range(text, sample.move), destination: { kind: "text-point", offset: text.indexOf(sample.destination) } }; break;
    case "increase-spacing": {
      const boundary = text.indexOf(sample.before);
      correction = { id: type, type, target: { kind: "text-point", offset: boundary } }; break;
    }
    case "decrease-spacing": {
      const boundary = text.indexOf(sample.before);
      text = text.slice(0, boundary) + " " + text.slice(boundary);
      extraSpace = true;
      correction = { id: type, type, target: { kind: "text-range", start: boundary, end: boundary + 1 } }; break;
    }
    case "cancel-correction": {
      const deletion: Correction = { id: "earlier-delete", type: "delete", target: range(text, sample.word) };
      correction = { id: type, type, target: { kind: "correction", correctionId: deletion.id } };
      return { text, corrections: [deletion, correction], extraSpace };
    }
  }
  return { text, corrections: [correction], extraSpace };
}

export function supportFor(language: LanguageId, operation: CorrectionType, mode: WritingMode) {
  const pack = languages[language].pack;
  if (!pack.writingModes.includes(mode)) return "Unsupported";
  return pack.support.some(entry => entry.operation === operation && entry.scales.includes("inline") && entry.writingModes.includes(mode))
    ? "Reference-based" : "Generic fallback";
}

/**
 * Usage code for one correction. With `highlight`, the target and payload
 * lines carry code-sample highlight markers (see code-highlight.ts).
 */
export function correctionCode(correction: Correction, { highlight = false }: { highlight?: boolean } = {}): string {
  const quote = (value: string) => escapeHighlightMarkers(JSON.stringify(value));
  const mark = (line: string) => highlight ? hl(line) : line;
  const target = (value: TextRangeTarget) => `{ kind: "text-range", start: ${value.start}, end: ${value.end} }`;
  const common = `  id: ${quote(correction.id)},\n  type: ${quote(correction.type)},`;
  switch (correction.type) {
    case "delete": case "decrease-spacing": return `{\n${common}\n  ${mark(`target: ${target(correction.target)},`)}\n}`;
    case "replace": return `{\n${common}\n  ${mark(`target: ${target(correction.target)},`)}\n  ${mark(`replacement: ${quote(correction.replacement)},`)}\n}`;
    case "insert": return `{\n${common}\n  ${mark(`target: { kind: "text-point", offset: ${correction.target.offset} },`)}\n  ${mark(`content: ${quote(correction.content)},`)}\n}`;
    case "increase-spacing": return `{\n${common}\n  ${mark(`target: { kind: "text-point", offset: ${correction.target.offset} },`)}\n}`;
    case "transpose": return `{\n${common}\n  ${mark(`targets: [`)}\n    ${mark(`${target(correction.targets[0])},`)}\n    ${mark(`${target(correction.targets[1])},`)}\n  ${mark("],")}\n}`;
    case "move": return `{\n${common}\n  ${mark(`source: ${target(correction.source)},`)}\n  ${mark(`destination: { kind: "text-point", offset: ${correction.destination.offset} },`)}\n}`;
    case "cancel-correction": return `{\n${common}\n  ${mark(`target: { kind: "correction", correctionId: ${quote(correction.target.correctionId)} },`)}\n}`;
  }
}

export function exampleCode(language: LanguageId, type: "replace" | "insert", value: string) {
  const sample = sampleFor(language, type, value);
  return `import type { Correction } from "proofmarks";\nimport { ${languages[language].importName} } from "proofmarks/notations";\nimport { Proofmarks } from "proofmarks/react";\nimport "proofmarks/styles.css";\n\nconst corrections = [${correctionCode(sample.corrections[0]!, { highlight: true })}] satisfies Correction[];\n\nexport default function App() {\n  return (\n    <Proofmarks\n      notation={${languages[language].importName}}\n      corrections={corrections}\n      lang=${JSON.stringify(languages[language].lang)}\n      appearance="editorial"\n      markStyle={{ strokeScale: 0.75 }}\n      style={{ padding: "44px 20px", fontSize: "1.5rem", lineHeight: 1.8 }}\n    >\n      {${escapeHighlightMarkers(JSON.stringify(sample.text))}}\n    </Proofmarks>\n  );\n}`;
}

/** Dictionary keys for the values `supportFor` returns (which stay English in data attributes). */
export const supportKeys = {
  "Reference-based": "referenceBased",
  "Generic fallback": "genericFallback",
  Unsupported: "unsupported",
} as const satisfies Record<ReturnType<typeof supportFor>, string>;
