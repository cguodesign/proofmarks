// Word-level rewrite rules for each mode. `to: ""` means delete.
// `insertAfter` rules add a short aside right after an anchor phrase.

export type ModeId = "decode" | "encode" | "calm";

export type Rule =
  | { from: string; to: string }
  | { insertAfter: string; content: string }
  | { insertAtStart: string }
  | { insertAtEnd: string };

export type Mode = {
  id: ModeId;
  name: string;
  tagline: string;
  stamp: string;
  sample: string;
  rules: Rule[];
};

export const MODES: Mode[] = [
  {
    id: "decode",
    name: "黑话 → 真话",
    tagline: "把周报翻译成人话",
    stamp: "已翻译",
    sample:
      "本周我们要对齐一下颗粒度，拉通各方资源，用组合拳打造闭环。其实底层逻辑很简单：给到用户价值，沉淀方法论，最终实现降本增效。公司实行弹性工作制和扁平化管理，欢迎抗压能力强的同学加入。",
    rules: [
      { from: "对齐一下颗粒度", to: "聊聊细节" },
      { from: "降本增效", to: "裁员" },
      { from: "底层逻辑", to: "原因" },
      { from: "组合拳", to: "几招" },
      { from: "方法论", to: "经验" },
      { from: "颗粒度", to: "细节" },
      { from: "赋能", to: "帮忙" },
      { from: "抓手", to: "办法" },
      { from: "闭环", to: "收尾" },
      { from: "对齐", to: "商量" },
      { from: "拉通", to: "叫上" },
      { from: "沉淀", to: "记下" },
      { from: "打法", to: "做法" },
      { from: "链路", to: "流程" },
      { from: "心智", to: "印象" },
      { from: "痛点", to: "麻烦" },
      { from: "倒逼", to: "逼" },
      { from: "复盘", to: "回头看" },
      { from: "赛道", to: "行业" },
      { from: "对标", to: "抄" },
      { from: "给到", to: "给" },
      { from: "落地", to: "做出来" },
      { from: "打造", to: "做" },
      { from: "其实", to: "" },
      { from: "本质上", to: "" },
      { from: "最终", to: "" },
      { from: "各方资源", to: "大家" },
      { insertAfter: "弹性工作制", content: "（随时加班）" },
      { insertAfter: "扁平化管理", content: "（没人管）" },
      { insertAfter: "抗压能力强", content: "（能熬夜）" },
    ],
  },
  {
    id: "encode",
    name: "真话 → 黑话",
    tagline: "把大白话包装成周报",
    stamp: "已赋能",
    sample:
      "下周开会商量一下细节，看看问题出在哪。我觉得原因是计划没做完，之后要改。麻烦帮忙抄一下竞品的办法。",
    rules: [
      { from: "开会商量一下细节", to: "对齐颗粒度" },
      { from: "看看问题出在哪", to: "复盘痛点" },
      { from: "我觉得", to: "从底层逻辑看" },
      { from: "原因", to: "根因" },
      { from: "计划", to: "打法" },
      { from: "没做完", to: "未形成闭环" },
      { from: "改", to: "迭代" },
      { from: "帮忙", to: "赋能" },
      { from: "抄一下", to: "对标" },
      { from: "办法", to: "抓手" },
      { from: "麻烦", to: "" },
      { insertAtEnd: "（以上，请拉通）" },
    ],
  },
  {
    id: "calm",
    name: "消气模式",
    tagline: "发出去之前先过一遍",
    stamp: "已消气",
    sample:
      "你是不是傻？？？我早就说了这个方案不行！！！凭什么又让我改？简直离谱😡 立刻给我一个解释！！",
    rules: [
      { from: "你是不是傻", to: "可能我没说清楚" },
      { from: "早就说了", to: "之前提过" },
      { from: "不行", to: "有风险" },
      { from: "凭什么", to: "想了解下为什么" },
      { from: "简直", to: "" },
      { from: "离谱", to: "意外" },
      { from: "😡", to: "" },
      { from: "立刻", to: "方便时" },
      { from: "给我", to: "给" },
      { from: "？？？", to: "？" },
      { from: "！！！", to: "。" },
      { from: "！！", to: "～" },
      { insertAtStart: "辛苦了，" },
    ],
  },
];
