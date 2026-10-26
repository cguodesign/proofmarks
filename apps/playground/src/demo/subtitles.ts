import type { DemoScene, DemoSceneId } from "./scenes";

export const subtitleLanguages = [
  { id: "zh-Hans", label: "简体" },
  { id: "zh-Hant", label: "繁體" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
] as const;

export type SubtitleLanguage = (typeof subtitleLanguages)[number]["id"];
type CaptionPair = { before: string; after: string };

const translations = {
  "zh-Hant": {
    arrival: { before: "時尚編輯。連第一天穿什麼都想好了。", after: "衣服倒是沒穿錯。" },
    column: { before: "第一份工作：校對一篇教人細心的卷首語。", after: "教人細心的文章，也會多打一個字。" },
    invitation: { before: "還有一份邀請函。讀者會帶著它來赴約。", after: "一份新刊，一個座位。邀請寫清楚了。" },
    walk: { before: "這條路，真的只要三分鐘嗎？", after: "走了十五分鐘。英文稿的抵達時間，也得重新算。" },
    train: { before: "列車到站時，離開場只剩五分鐘。讀者會遲到。", after: "這次，你改掉的不只是一個數字。" },
    letter: { before: "最後一頁。把「迷路」改成「散步」，會不會更好？", after: "作者說：路線應該準確。但散步，不必只有一條路。" },
  },
  ja: {
    arrival: { before: "ファッション編集者。初日の服装まで考えていた。", after: "服装だけは、間違っていなかった。" },
    column: { before: "最初の仕事は、細部を見ることを説く巻頭言の校正。", after: "細部を説く文章にも、余分な一字がある。" },
    invitation: { before: "もう一通、読者への招待状。これを手に会場へ向かう。", after: "新刊を一冊、席を一つ。招待状は明確になった。" },
    walk: { before: "この道は、本当に三分で歩ける？", after: "十五分かかった。英語の案内にある到着時刻も直そう。" },
    train: { before: "電車が着くのはイベント開始の五分前。読者は間に合わない。", after: "直したのは、数字だけではない。" },
    letter: { before: "最後のページ。「迷う」を「歩く」に変えた方がいいだろうか。", after: "著者は言う。道順は正確に。でも、散歩に道は一つだけではない。" },
  },
  ko: {
    arrival: { before: "패션 편집자. 첫 출근에 입을 옷까지 골라 두었다.", after: "옷차림만큼은 틀리지 않았다." },
    column: { before: "첫 업무는 세심함을 이야기하는 머리글을 교정하는 일.", after: "세심함을 말하는 글에도 글자 하나가 더 들어갈 수 있다." },
    invitation: { before: "독자가 들고 올 초대장이 하나 더 있다.", after: "새 잡지 한 권, 자리 하나. 초대장이 분명해졌다." },
    walk: { before: "이 길, 정말 3분이면 갈 수 있을까?", after: "15분이 걸렸다. 영어 안내문의 도착 시간도 고쳐야 한다." },
    train: { before: "열차가 도착하면 행사 시작까지 5분. 독자는 늦는다.", after: "이번에는 숫자만 고친 게 아니다." },
    letter: { before: "마지막 페이지. ‘길을 잃다’를 ‘걷다’로 바꾸는 게 나을까?", after: "작가의 말: 길 안내는 정확해야 한다. 하지만 산책길은 하나일 필요가 없다." },
  },
  en: {
    arrival: { before: "A fashion editor. You had even planned what to wear on day one.", after: "At least the outfit was right." },
    column: { before: "First assignment: proofread an editorial about paying attention.", after: "Even a piece about noticing details can contain an extra character." },
    invitation: { before: "One more invitation. The reader will bring it to the event.", after: "One new issue, one reserved seat. The invitation now says it clearly." },
    walk: { before: "Can this walk really take only three minutes?", after: "It took fifteen. The arrival time in the English copy needs another look." },
    train: { before: "The train arrives five minutes before the event begins. The reader will be late.", after: "This time, you changed more than a number." },
    letter: { before: "Final page. Would ‘walk’ be better than ‘get lost’?", after: "The author says: directions must be accurate. A walk can still take more than one path." },
  },
} satisfies Record<Exclude<SubtitleLanguage, "zh-Hans">, Record<DemoSceneId, CaptionPair>>;

const endingCaptions = {
  "zh-Hans": { retained: "最后一笔，是决定不改。", finished: "创刊号，付印。你的第一天，完成。" },
  "zh-Hant": { retained: "最後一筆，是決定不改。", finished: "創刊號，付印。你的第一天，完成。" },
  ja: { retained: "最後の赤字は、直さないという判断。", finished: "創刊号、印刷へ。初日の仕事が終わった。" },
  ko: { retained: "마지막 교정은 고치지 않기로 한 결정.", finished: "창간호 인쇄 준비 완료. 첫날의 일이 끝났다." },
  en: { retained: "The last edit is a decision to leave the words as they are.", finished: "The first issue goes to print. Your first day is done." },
} satisfies Record<SubtitleLanguage, { retained: string; finished: string }>;

export function subtitleFor(scene: DemoScene, language: SubtitleLanguage, state: "before" | "after" | "retained" | "finished"): string {
  if (state === "retained" || state === "finished") return endingCaptions[language][state];
  if (language === "zh-Hans") return scene[state];
  return translations[language][scene.id][state];
}
