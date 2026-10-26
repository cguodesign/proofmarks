import type { Correction, TextRangeTarget } from "proofmarks";
import { localizedScene, localizedTradition, promptCopy, uiCopy } from "./i18n";
import type { SubtitleLanguage } from "./subtitles";

export type Segment = { text: string; tag?: "em" | "strong" | "a"; href?: string };
export type DemoSceneId = "arrival" | "column" | "invitation" | "walk" | "train" | "letter";
export type DemoScene = {
  id: DemoSceneId;
  title: string;
  chapter: string;
  lang: string;
  pack: "jis" | "gb" | "cns3927" | "ks" | "enUS";
  tradition: string;
  vertical: boolean;
  paragraphs: readonly (readonly Segment[])[];
  source: string;
  corrections: readonly Correction[];
  before: string;
  after: string;
  action: string;
  explanation: string;
  evidence?: { title: string; rows: readonly (readonly [string, string])[]; note: string };
};

const paragraphs = (...lines: string[]) => lines.map((text) => [{ text }]);
const sourceOf = (lines: DemoScene["paragraphs"]) => lines.map((line) => line.map(({ text }) => text).join("")).join("\n");
// Keep UTF-16 offsets tied to the actual selectable copy, including nested markup.
function range(source: string, text: string): TextRangeTarget {
  const start = source.indexOf(text);
  if (start < 0 || source.indexOf(text, start + 1) !== -1) {
    throw new Error(`Demo target must appear exactly once: ${text}`);
  }
  return { kind: "text-range", start, end: start + text.length };
}
function replace(source: string, text: string, replacement: string, id: string): Correction {
  return { id, type: "replace", target: range(source, text), replacement };
}

const arrivalBody = paragraphs("このたび、あなたを", "ファッション編集部に配属します。", "初日は、午前九時。", "赤鉛筆を一本、お持ちください。");
const arrivalSource = sourceOf(arrivalBody);
const columnBody = paragraphs("每一个微小的的地方，都值得认真看见。", "我们记录城市的声音，也记录声音里的城市。", "请带着好奇出发，现发日常里的风景。");
const columnSource = sourceOf(columnBody);
const invitationBody = paragraphs("邀請你，一起讀這座城市。", "新刊分享會，將在白井書店舉行。", "我們準備了一分新刊，也為你留了一個座位。");
const invitationSource = sourceOf(invitationBody);
const walkBody = paragraphs("서두르지 않는 산책", "역에서 서점까지 걸어서 3분.", "골목 끝 작은 서점에서 새로운 잡지를 만납니다.", "천천히 걸으며 이 도시의 표정을 읽어 보세요.");
const walkSource = sourceOf(walkBody);
const trainBody: DemoScene["paragraphs"] = [
  [{ text: "The first issue of " }, { text: "Side Streets", tag: "em" }, { text: " goes to print tonight." }],
  [{ text: "Take the " }, { text: "17:25", tag: "strong" }, { text: " train. Doors open at " }, { text: "17:30", tag: "strong" }, { text: "." }],
  [{ text: "Follow the " }, { text: "walking route", tag: "a", href: "/demo#walk" }, { text: " from the station." }],
];
const trainSource = sourceOf(trainBody);
const letterBody = paragraphs("この街で、", "たまには迷ってください。", "まだ知らない景色が、", "あなたを待っています。");
const letterSource = sourceOf(letterBody);

export const invitation: DemoScene = {
  id: "invitation", title: "新刊邀請", chapter: "第二幕 · 另一份校样", lang: "zh-Hant-TW", pack: "cns3927", tradition: "繁體中文 · CNS 3927", vertical: false,
  paragraphs: invitationBody, source: invitationSource,
  corrections: [{ id: "invitation-copy", type: "replace", target: { kind: "text-range", start: range(invitationSource, "一分").start + 1, end: range(invitationSource, "一分").end }, replacement: "份" }],
  before: "还有一份邀请函。读者会带着它来赴约。", after: "一份新刊，一个座位。邀请写清楚了。", action: "校对邀请函",
  explanation: "繁体稿使用台湾 CNS 3927 中已有依据的错字替换形式；它是独立的记号规范，并非简体 GB 的换字版。",
};

export const scenes: readonly DemoScene[] = [
  {
    id: "arrival", title: "採用通知", chapter: "第一幕 · 入职", lang: "ja", pack: "jis", tradition: "日本語 · JIS", vertical: true,
    paragraphs: arrivalBody, source: arrivalSource,
    corrections: [replace(arrivalSource, "ファッション編集部", "校閲部", "arrival-department")],
    before: "时尚编辑。连第一天穿什么，都想好了。", after: "衣服倒是没穿错。", action: "查看人事更正",
    explanation: "日文竖排上的替换记号。沿目标旁的虚线落笔，加入这笔预设校改；正文保持原样。「收起红笔」只控制覆盖层显隐。竖排来自浏览器 CSS，红笔使用 JIS 记号与 editorial 外观。",
  },
  {
    id: "column", title: "认真看见", chapter: "第二幕 · 第一份稿", lang: "zh-Hans", pack: "gb", tradition: "简体中文 · GB", vertical: false,
    paragraphs: columnBody, source: columnSource,
    corrections: [
      { id: "column-repeat", type: "delete", target: { kind: "text-range", start: range(columnSource, "的的").start, end: range(columnSource, "的的").start + 1 } },
      { id: "column-order", type: "transpose", targets: [
        { kind: "text-range", start: range(columnSource, "现发").start, end: range(columnSource, "现发").start + 1 },
        { kind: "text-range", start: range(columnSource, "现发").start + 1, end: range(columnSource, "现发").end },
      ] },
    ],
    before: "第一份工作：校对一篇教人细心的卷首语。", after: "教人细心的文章，也会多打一个字。", action: "落下第一笔",
    explanation: "一处重复字删除，以及相邻两字的对调。两笔修改共享原始正文的 UTF-16 位置，不先修改 DOM 再猜测标记应该落在哪里。",
  },
  {
    id: "walk", title: "골목을 걷다", chapter: "第三幕 · 三分钟的路", lang: "ko", pack: "ks", tradition: "한국어 · KS", vertical: false,
    paragraphs: walkBody, source: walkSource,
    corrections: [replace(walkSource, "3분", "15분", "walk-duration")],
    before: "这条路，真的只要三分钟吗？", after: "走了十五分钟。英文稿的到场时间，也得重新算。", action: "按实测时间更正",
    explanation: "韩文稿使用依公开来源重构的韩式校对记号（KS 记号包）。改变稿纸宽度时，浏览器负责文字换行，Proofmarks 根据新的文字位置重新测量与排布标记。",
    evidence: { title: "外勤记录", rows: [["车站出发", "16:40"], ["步行到书店", "16:55"], ["实际用时", "15 分钟"]], note: "故事中的虚构路线与实测记录。" },
  },
  {
    id: "train", title: "A little earlier.", chapter: "第四幕 · 迟到的读者", lang: "en", pack: "enUS", tradition: "English · US", vertical: false,
    paragraphs: trainBody, source: trainSource,
    corrections: [
      replace(trainSource, "17:25", "17:05", "train-departure"),
      { id: "train-walking-time", type: "insert", target: { kind: "text-point", offset: trainSource.length }, content: " Allow fifteen minutes on foot." },
    ],
    before: "列车到站时离开场只剩五分钟。读者会迟到。", after: "这次，你改掉的不只是一个数字。", action: "换一班车，补一句提醒",
    explanation: "替换与插入落在有斜体、加粗和链接的真实网页正文上。标记位置按 getSourceText 读出的整段正文计算，嵌套排版不改变修改数据。",
    evidence: { title: "赴约时间", rows: [["17:05 发车", "17:10 到站"], ["17:25 发车", "17:30 到站"], ["步行至书店", "15 分钟"], ["分享会开场", "17:35"]], note: "虚构列车时刻。17:30 开门，17:35 开场；较早一班可在 17:25 抵达。" },
  },
  {
    id: "letter", title: "編集後記", chapter: "第五幕 · 保留原文", lang: "ja", pack: "jis", tradition: "日本語 · JIS", vertical: true,
    paragraphs: letterBody, source: letterSource,
    corrections: [replace(letterSource, "迷って", "歩いて", "letter-voice")],
    before: "最后一页。把“迷路”改成“散步”，会不会更好？", after: "作者说：路线应该准确。但散步，不必只有一条路。", action: "看看这笔修改",
    explanation: "取消校改引用前一笔修改的稳定 id，JIS 用「イキ」表达保留原文。撤销留下真实校改记号；它与暂时隐藏全部红笔是不同的操作。",
  },
];

export const retainOriginal: Correction = { id: "letter-retain", type: "cancel-correction", target: { kind: "correction", correctionId: "letter-voice" } };

// Keep prose as inline DOM text so paragraph boxes do not become annotation obstacles.
export function segmentsFor(scene: DemoScene): Segment[] {
  const result: Segment[] = [];
  scene.paragraphs.forEach((paragraph, index) => {
    const segments: Segment[] = index ? [{ text: "\n" }, ...paragraph] : [...paragraph];
    for (const segment of segments) {
      const previous = result.at(-1);
      if (!segment.tag && previous && !previous.tag) previous.text += segment.text;
      else result.push({ ...segment });
    }
  });
  return result;
}

export function codeFor(scene: DemoScene, corrections: readonly Correction[], language: SubtitleLanguage = "zh-Hans"): string {
  const children = segmentsFor(scene).map(({ text, tag, href }) => {
    const value = `{${JSON.stringify(text)}}`;
    return tag ? `        <${tag}${href ? ` href=${JSON.stringify(href)}` : ""}>${value}</${tag}>` : `        ${value}`;
  }).join("\n");
  return `import { useState } from "react";
import type { Correction } from "proofmarks";
import { Proofmarks } from "proofmarks/react";
import { ${scene.pack} } from "proofmarks/notations";
import "proofmarks/styles.css";

const corrections = ${JSON.stringify(corrections, null, 2)} satisfies readonly Correction[];

export default function Example() {
  const [visible, setVisible] = useState(true);
  return (
    <section>
      <button onClick={() => setVisible(!visible)}>
        {visible ? ${JSON.stringify(uiCopy[language].hideInk)} : ${JSON.stringify(uiCopy[language].showInk)}}
      </button>
      <Proofmarks
        notation={${scene.pack}}
        corrections={corrections}
        appearance="editorial"
        showProofmarks={visible}
        lang="${scene.lang}"
        style={{
          writingMode: "${scene.vertical ? "vertical-rl" : "horizontal-tb"}",
          fontFamily: "serif", fontSize: 20, lineHeight: 3,
          whiteSpace: "pre-line",
          padding: 48, maxWidth: "100%",
          ${scene.vertical ? "height: 500," : "width: 680,"}
        }}
      >
${children}
      </Proofmarks>
    </section>
  );
}`;
}

export function promptFor(scene: DemoScene, corrections: readonly Correction[] = scene.corrections, language: SubtitleLanguage = "zh-Hans"): string {
  const copy = promptCopy[language];
  return `${copy.intro(localizedTradition(scene, language))}\n\n${localizedScene(scene, language).explanation}\n\n${copy.source}\n${scene.paragraphs.map((line) => line.map(({ text }) => text).join("")).join("\n")}\n\n${copy.corrections}\n${JSON.stringify(corrections, null, 2)}\n\n${copy.outro(scene.pack, scene.vertical)}`;
}
