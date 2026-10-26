import type { DemoScene, DemoSceneId } from "./scenes";
import type { SubtitleLanguage } from "./subtitles";

type UiCopy = {
  story: string; endingChapter: string; endingLine: string; home: string; skip: string;
  proof: string; mark: string; retain: string; switchSimplified: string; switchTraditional: string;
  scriptSwitch: string; widen: string; narrow: string; widthHint: string;
  tryIt: string; restart: string; viewEvidence: string; paging: string; previous: string;
  next: string; finish: string; keyHint: string; showInk: string; hideInk: string;
  subtitles: string; subtitleLanguage: string; docsTitle: string; closeDocs: string;
  docsType: string; promptTab: string; codeTab: string; copyPrompt: string;
  copyCode: string; copied: string; copyFailed: string; demoCredit: string;
  fullDocs: string; references: string;
};

export const uiCopy: Record<SubtitleLanguage, UiCopy> = {
  "zh-Hans": {
    story: "今天付印", endingChapter: "终 · 今天付印", endingLine: "五种校对传统，同一份认真。", home: "proofmarks 首页", skip: "跳至校样",
    proof: "原始校样", mark: "在虚线处落笔", retain: "保留原文", switchSimplified: "切换至简体卷首语", switchTraditional: "切换至繁体邀请函",
    scriptSwitch: "简 / 繁", widen: "展开稿纸", narrow: "收窄稿纸", widthHint: "改变稿纸宽度，观察红笔随文字换行",
    tryIt: "自己拿起红笔", restart: "重新读一遍", viewEvidence: "查看", paging: "故事翻页", previous: "上一页",
    next: "下一页", finish: "交付定稿", keyHint: "← → 键翻页", showInk: "显示红笔", hideInk: "收起红笔",
    subtitles: "字幕", subtitleLanguage: "字幕语言", docsTitle: "这个效果怎么做？", closeDocs: "关闭效果说明",
    docsType: "说明类型", promptTab: "让 AI 帮我做", codeTab: "查看代码", copyPrompt: "复制 Prompt",
    copyCode: "复制代码", copied: "已复制", copyFailed: "未能访问剪贴板，请选中文字复制。", demoCredit: "原创演示稿 · 预设校改，非自动校对",
    fullDocs: "完整文档", references: "记号依据",
  },
  "zh-Hant": {
    story: "今天付印", endingChapter: "終 · 今天付印", endingLine: "五種校對傳統，同一份認真。", home: "proofmarks 首頁", skip: "跳至校樣",
    proof: "原始校樣", mark: "在虛線處落筆", retain: "保留原文", switchSimplified: "切換至簡體卷首語", switchTraditional: "切換至繁體邀請函",
    scriptSwitch: "簡 / 繁", widen: "展開稿紙", narrow: "收窄稿紙", widthHint: "改變稿紙寬度，觀察紅筆如何隨文字換行",
    tryIt: "親自拿起紅筆", restart: "重新讀一遍", viewEvidence: "查看", paging: "故事翻頁", previous: "上一頁",
    next: "下一頁", finish: "交付定稿", keyHint: "← → 鍵翻頁", showInk: "顯示紅筆", hideInk: "收起紅筆",
    subtitles: "字幕", subtitleLanguage: "字幕語言", docsTitle: "這個效果怎麼做？", closeDocs: "關閉效果說明",
    docsType: "說明類型", promptTab: "請 AI 幫我做", codeTab: "查看程式碼", copyPrompt: "複製 Prompt",
    copyCode: "複製程式碼", copied: "已複製", copyFailed: "無法存取剪貼簿，請選取文字複製。", demoCredit: "原創示範稿 · 預設校改，非自動校對",
    fullDocs: "完整文件", references: "記號依據",
  },
  ja: {
    story: "本日、印刷へ", endingChapter: "終幕 · 本日、印刷へ", endingLine: "五つの校正の伝統に、同じだけの心配りを。", home: "proofmarks ホーム", skip: "校正刷りへ移動",
    proof: "元の校正刷り", mark: "点線に沿って赤字を入れる", retain: "原文を残す", switchSimplified: "簡体字の巻頭言に切り替え", switchTraditional: "繁体字の招待状に切り替え",
    scriptSwitch: "簡 / 繁", widen: "紙面を広げる", narrow: "紙面を狭める", widthHint: "紙面の幅を変え、改行に合わせて赤字が移動する様子を見る",
    tryIt: "自分で赤字を入れる", restart: "もう一度読む", viewEvidence: "記録を見る：", paging: "ページ移動", previous: "前のページ",
    next: "次のページ", finish: "印刷へ進む", keyHint: "← → キーで移動", showInk: "赤字を表示", hideInk: "赤字を隠す",
    subtitles: "字幕", subtitleLanguage: "字幕の言語", docsTitle: "この効果の作り方", closeDocs: "作り方を閉じる",
    docsType: "説明の種類", promptTab: "AI に作ってもらう", codeTab: "コードを見る", copyPrompt: "プロンプトをコピー",
    copyCode: "コードをコピー", copied: "コピーしました", copyFailed: "クリップボードを使えません。文字を選択してコピーしてください。", demoCredit: "デモ用の原稿 · 事前に設定した校正であり、自動校正ではありません",
    fullDocs: "ドキュメント", references: "記号の出典",
  },
  ko: {
    story: "오늘 인쇄", endingChapter: "끝 · 오늘 인쇄", endingLine: "다섯 교정 전통에 같은 정성을 담았습니다.", home: "proofmarks 홈", skip: "교정지로 이동",
    proof: "원본 교정지", mark: "점선을 따라 교정 표시하기", retain: "원문 유지", switchSimplified: "간체 머리글로 전환", switchTraditional: "번체 초대장으로 전환",
    scriptSwitch: "간 / 번", widen: "지면 넓히기", narrow: "지면 좁히기", widthHint: "지면 너비를 바꾸고 줄바꿈에 따라 교정 표시가 이동하는 모습을 보세요",
    tryIt: "직접 교정하기", restart: "다시 읽기", viewEvidence: "기록 보기: ", paging: "페이지 이동", previous: "이전 페이지",
    next: "다음 페이지", finish: "최종 원고 전달", keyHint: "← → 키로 이동", showInk: "교정 표시 보이기", hideInk: "교정 표시 숨기기",
    subtitles: "자막", subtitleLanguage: "자막 언어", docsTitle: "이 효과는 어떻게 만들었나요?", closeDocs: "설명 닫기",
    docsType: "설명 종류", promptTab: "AI에게 만들기 요청", codeTab: "코드 보기", copyPrompt: "프롬프트 복사",
    copyCode: "코드 복사", copied: "복사됨", copyFailed: "클립보드에 접근할 수 없습니다. 텍스트를 선택해 복사하세요.", demoCredit: "데모용 원고 · 미리 정한 교정이며 자동 교정이 아닙니다",
    fullDocs: "전체 문서", references: "교정 기호 근거",
  },
  en: {
    story: "Going to press today", endingChapter: "Final act · Going to press", endingLine: "Five traditions. The same care for each.", home: "proofmarks home", skip: "Skip to the proof",
    proof: "original proof", mark: "Mark along the dotted line", retain: "Keep the original", switchSimplified: "Switch to the Simplified Chinese editorial", switchTraditional: "Switch to the Traditional Chinese invitation",
    scriptSwitch: "S / T", widen: "Widen the page", narrow: "Narrow the page", widthHint: "Change the page width to see the marks follow the text as it wraps",
    tryIt: "Pick up the red pencil", restart: "Read it again", viewEvidence: "View ", paging: "Story pages", previous: "Previous page",
    next: "Next page", finish: "Send to press", keyHint: "Use ← → to turn pages", showInk: "Show marks", hideInk: "Hide marks",
    subtitles: "Captions", subtitleLanguage: "Caption language", docsTitle: "How was this made?", closeDocs: "Close the explanation",
    docsType: "Explanation type", promptTab: "Build it with AI", codeTab: "View code", copyPrompt: "Copy prompt",
    copyCode: "Copy code", copied: "Copied", copyFailed: "Clipboard unavailable. Select the text to copy it.", demoCredit: "Original demo copy · Preset corrections, not automated proofreading",
    fullDocs: "Full documentation", references: "Notation references",
  },
};

type SceneCopy = {
  chapter: string; action: string; explanation: string;
  evidence?: { title: string; rows: readonly (readonly [string, string])[]; note: string };
};

const sceneTranslations: Record<Exclude<SubtitleLanguage, "zh-Hans">, Record<DemoSceneId, SceneCopy>> = {
  "zh-Hant": {
    arrival: { chapter: "第一幕 · 入職", action: "查看人事更正", explanation: "日文直排上的替換記號。沿目標旁的虛線落筆，加入這筆預設校改；正文保持原樣。「收起紅筆」只控制覆蓋層顯隱。直排來自瀏覽器 CSS，紅筆使用 JIS 記號與 editorial 外觀。" },
    column: { chapter: "第二幕 · 第一份稿", action: "落下第一筆", explanation: "刪除一個重複字，並對調相鄰兩字。兩筆修改共用原始正文的 UTF-16 位置；不必先修改 DOM 再猜測記號應落在哪裡。" },
    invitation: { chapter: "第二幕 · 另一份校樣", action: "校對邀請函", explanation: "繁體稿使用臺灣 CNS 3927 中有依據的錯字替換形式。它是獨立的記號規範，並非簡體 GB 的換字版。" },
    walk: { chapter: "第三幕 · 三分鐘的路", action: "按實測時間更正", explanation: "韓文稿使用依公開來源重建的韓式校對記號（KS 記號套件）。改變稿紙寬度時，瀏覽器負責文字換行，Proofmarks 依照新的文字位置重新測量與排布記號。", evidence: { title: "外勤記錄", rows: [["車站出發", "16:40"], ["步行到書店", "16:55"], ["實際用時", "15 分鐘"]], note: "故事中的虛構路線與實測記錄。" } },
    train: { chapter: "第四幕 · 遲到的讀者", action: "換一班車，補一句提醒", explanation: "替換與插入落在含有斜體、粗體和連結的真實網頁正文上。記號位置依 getSourceText 讀出的整段正文計算，巢狀排版不改變校改資料。", evidence: { title: "赴約時間", rows: [["17:05 發車", "17:10 到站"], ["17:25 發車", "17:30 到站"], ["步行至書店", "15 分鐘"], ["分享會開場", "17:35"]], note: "虛構列車時刻。17:30 開門，17:35 開場；搭較早一班可在 17:25 抵達。" } },
    letter: { chapter: "第五幕 · 保留原文", action: "看看這筆修改", explanation: "取消校改會引用前一筆修改的穩定 id，JIS 以「イキ」表示保留原文。撤銷會留下真正的校改記號；這與暫時隱藏所有紅筆是不同的操作。" },
  },
  ja: {
    arrival: { chapter: "第一幕 · 入社", action: "人事の訂正を見る", explanation: "縦書きの日本語に置換記号を重ねています。対象の横にある点線をなぞると、用意された訂正が一つ加わります。本文はそのままです。「赤字を隠す」は重ねた記号の表示だけを切り替えます。縦書きはブラウザーの CSS、赤字は JIS の記号と editorial スタイルによるものです。" },
    column: { chapter: "第二幕 · 最初の原稿", action: "最初の赤字を入れる", explanation: "重複する一字を削除し、隣り合う二字を入れ替えます。どちらも元の本文の UTF-16 位置を参照します。先に DOM を書き換えて記号の位置を推測する必要はありません。" },
    invitation: { chapter: "第二幕 · もう一つの校正刷り", action: "招待状を校正する", explanation: "繁体字の原稿には、台湾の CNS 3927 で裏付けられた誤字置換の記号を使います。簡体字の GB を文字だけ置き換えたものではなく、独立した規格です。" },
    walk: { chapter: "第三幕 · 三分の道", action: "実測時間に直す", explanation: "韓国語の原稿には、公開資料に基づいて再構成した韓国式の校正記号（KS パック）を使います。紙面の幅を変えると、ブラウザーが本文を折り返し、Proofmarks が新しい文字位置に合わせて記号を測り直します。", evidence: { title: "現地調査の記録", rows: [["駅を出発", "16:40"], ["書店に到着", "16:55"], ["実際の所要時間", "15 分"]], note: "物語の中の架空の道順と計測記録です。" } },
    train: { chapter: "第四幕 · 遅れる読者", action: "早い電車に変え、案内を加える", explanation: "置換と挿入の記号は、斜体・太字・リンクを含む実際のウェブ本文に重なります。位置は getSourceText で読み取った本文全体から求めるため、入れ子の書式でも訂正データは変わりません。", evidence: { title: "会場までの時刻", rows: [["17:05 発", "17:10 着"], ["17:25 発", "17:30 着"], ["書店まで徒歩", "15 分"], ["イベント開始", "17:35"]], note: "架空の列車時刻です。開場は 17:30、開始は 17:35。早い便なら 17:25 に着きます。" } },
    letter: { chapter: "第五幕 · 原文を残す", action: "この訂正を見る", explanation: "訂正の取り消しは、先の訂正の安定した id を参照します。JIS では「イキ」で原文を残します。取り消し自体も校正記号として残り、赤字全体を一時的に隠す操作とは異なります。" },
  },
  ko: {
    arrival: { chapter: "제1막 · 입사", action: "인사 발령 수정 보기", explanation: "세로쓰기 일본어 원고에 교체 기호를 표시합니다. 대상 옆 점선을 따라 그으면 미리 정한 교정이 추가되고, 본문은 그대로 유지됩니다. ‘교정 표시 숨기기’는 표시 레이어만 전환합니다. 세로쓰기는 브라우저 CSS, 교정 표시는 JIS 기호와 editorial 스타일을 사용합니다." },
    column: { chapter: "제2막 · 첫 원고", action: "첫 교정 표시하기", explanation: "반복된 글자 하나를 삭제하고 이웃한 두 글자의 순서를 바꿉니다. 두 교정 모두 원본 본문의 UTF-16 위치를 참조합니다. DOM을 먼저 바꾸고 기호 위치를 추측하지 않습니다." },
    invitation: { chapter: "제2막 · 또 다른 교정지", action: "초대장 교정하기", explanation: "번체 원고에는 대만 CNS 3927에 근거한 오자 교체 기호를 사용합니다. 간체 GB의 글자만 바꾼 방식이 아니라 독립된 교정 규격입니다." },
    walk: { chapter: "제3막 · 3분 거리", action: "실측 시간으로 수정", explanation: "한국어 원고에는 공개 자료에 근거해 재구성한 한국식 교정 기호(KS 팩)를 사용합니다. 지면 너비를 바꾸면 브라우저가 본문을 줄바꿈하고 Proofmarks가 새로운 글자 위치에 맞춰 기호를 다시 측정합니다.", evidence: { title: "현장 기록", rows: [["역 출발", "16:40"], ["서점 도착", "16:55"], ["실제 소요 시간", "15분"]], note: "이야기 속 가상의 경로와 측정 기록입니다." } },
    train: { chapter: "제4막 · 늦는 독자", action: "더 이른 열차로 바꾸고 안내 추가", explanation: "교체와 삽입 기호가 기울임꼴, 굵은 글씨, 링크를 포함한 실제 웹 본문 위에 놓입니다. 위치는 getSourceText로 읽은 본문 전체를 기준으로 계산하므로 중첩된 서식이 교정 데이터를 바꾸지 않습니다.", evidence: { title: "행사 시간", rows: [["17:05 출발", "17:10 도착"], ["17:25 출발", "17:30 도착"], ["서점까지 도보", "15분"], ["행사 시작", "17:35"]], note: "가상의 열차 시간표입니다. 17:30에 문을 열고 17:35에 시작합니다. 이른 열차는 17:25까지 도착할 수 있습니다." } },
    letter: { chapter: "제5막 · 원문 유지", action: "이 수정 살펴보기", explanation: "교정 취소는 앞선 수정의 안정적인 id를 참조합니다. JIS는 ‘イキ’로 원문 유지를 표시합니다. 취소도 실제 교정 기호로 남으며 모든 교정 표시를 잠시 숨기는 것과는 다릅니다." },
  },
  en: {
    arrival: { chapter: "Act one · Arrival", action: "Review the personnel correction", explanation: "A replacement mark on vertical Japanese text. Draw along the dotted line beside the target to add this preset correction; the source text stays intact. “Hide marks” only toggles the overlay. The browser supplies vertical layout through CSS; the red mark uses JIS notation and the editorial appearance." },
    column: { chapter: "Act two · First assignment", action: "Make the first mark", explanation: "One repeated character is deleted, and two adjacent characters are transposed. Both corrections refer to UTF-16 offsets in the original text. There is no need to alter the DOM first and guess where the marks belong." },
    invitation: { chapter: "Act two · Another proof", action: "Proofread the invitation", explanation: "The Traditional Chinese proof uses a supported replacement form from Taiwan’s CNS 3927. It is a distinct notation standard, not a relabeled version of Simplified Chinese GB." },
    walk: { chapter: "Act three · A three-minute walk", action: "Correct the walking time", explanation: "The Korean proof uses reference-based Korean proofreading marks from the KS pack. When you change the page width, the browser wraps the text and Proofmarks measures the new text positions to lay out the marks again.", evidence: { title: "Field notes", rows: [["Depart station", "16:40"], ["Reach bookstore", "16:55"], ["Actual walk", "15 minutes"]], note: "A fictional route and timing record for this story." } },
    train: { chapter: "Act four · A late reader", action: "Take an earlier train and add a reminder", explanation: "Replacement and insertion marks sit over real browser text containing italics, bold text, and a link. Their positions come from the source text returned by getSourceText, so nested formatting does not change the correction data.", evidence: { title: "Event timing", rows: [["17:05 departure", "17:10 arrival"], ["17:25 departure", "17:30 arrival"], ["Walk to bookstore", "15 minutes"], ["Event begins", "17:35"]], note: "Fictional train times. Doors open at 17:30 and the event starts at 17:35; the earlier train gets you there by 17:25." } },
    letter: { chapter: "Act five · Keep the original", action: "Review this edit", explanation: "A cancellation refers to the stable id of an earlier correction. JIS uses イキ to indicate that the original should stand. The cancellation leaves a real proof mark; it is different from temporarily hiding all marks." },
  },
};

export function localizedScene(scene: DemoScene, language: SubtitleLanguage): SceneCopy {
  if (language === "zh-Hans") return scene;
  return sceneTranslations[language][scene.id];
}

const traditionTranslations: Record<Exclude<SubtitleLanguage, "zh-Hans">, Record<DemoSceneId, string>> = {
  "zh-Hant": { arrival: "日本語 · JIS", column: "簡體中文 · GB", invitation: "繁體中文 · CNS 3927", walk: "한국어 · KS", train: "English · US", letter: "日本語 · JIS" },
  ja: { arrival: "日本語 · JIS", column: "簡体字中国語 · GB", invitation: "繁体字中国語 · CNS 3927", walk: "한국어 · KS", train: "English · US", letter: "日本語 · JIS" },
  ko: { arrival: "日本語 · JIS", column: "중국어 간체 · GB", invitation: "중국어 번체 · CNS 3927", walk: "한국어 · KS", train: "English · US", letter: "日本語 · JIS" },
  en: { arrival: "Japanese · JIS", column: "Simplified Chinese · GB", invitation: "Traditional Chinese · CNS 3927", walk: "Korean · KS", train: "English · US", letter: "Japanese · JIS" },
};

export function localizedTradition(scene: DemoScene, language: SubtitleLanguage): string {
  return language === "zh-Hans" ? scene.tradition : traditionTranslations[language][scene.id];
}

type PromptCopy = { intro: (tradition: string) => string; source: string; corrections: string; outro: (pack: string, vertical: boolean) => string };
export const promptCopy: Record<SubtitleLanguage, PromptCopy> = {
  "zh-Hans": { intro: (tradition) => `使用 npm 包 proofmarks，为下面的${tradition}校样实现一个可操作的网页。`, source: "原稿（段落之间保留一个换行字符）：", corrections: "预设校改：", outro: (pack, vertical) => `使用 proofmarks/react 的 Proofmarks 和 proofmarks/notations 的 ${pack}。正文必须保持可选择、可复制，使用 appearance="editorial"，以 showProofmarks 控制显隐。使用 ${vertical ? "CSS writing-mode: vertical-rl" : "自然横排"}，尊重 prefers-reduced-motion。校改数据由应用提供；不要宣称 Proofmarks 会自动检查语言或核实事实。不要用图片或 canvas 替代正文。给正文上下留出批注空间：padding 至少 44px 20px，line-height 不低于 1.8（示例代码因校改较密用了更大的值）；校改保持少量、词级，并通过 onIssue 处理 insufficient-room。` },
  "zh-Hant": { intro: (tradition) => `使用 npm 套件 proofmarks，為以下${tradition}校樣製作可操作的網頁。`, source: "原稿（段落之間保留一個換行字元）：", corrections: "預設校改：", outro: (pack, vertical) => `使用 proofmarks/react 的 Proofmarks 與 proofmarks/notations 的 ${pack}。正文必須可選取、可複製；使用 appearance="editorial"，以 showProofmarks 控制顯隱。採用${vertical ? " CSS writing-mode: vertical-rl" : "自然橫排"}，尊重 prefers-reduced-motion。校改資料由應用提供；不要宣稱 Proofmarks 會自動檢查語言或查證事實。不要以圖片或 canvas 取代正文。為正文上下預留批註空間：padding 至少 44px 20px，line-height 不低於 1.8（範例程式碼因校改較密使用了更大的值）；校改保持少量、詞級，並透過 onIssue 處理 insufficient-room。` },
  ja: { intro: (tradition) => `npm パッケージ proofmarks を使い、次の${tradition}の校正刷りを操作できるウェブページを作成してください。`, source: "元の原稿（段落間には改行文字を一つ残す）：", corrections: "事前に設定した訂正：", outro: (pack, vertical) => `proofmarks/react の Proofmarks と proofmarks/notations の ${pack} を使用してください。本文は選択・コピーできる状態に保ち、appearance="editorial" を指定し、showProofmarks で記号の表示を切り替えます。${vertical ? "CSS writing-mode: vertical-rl を使い" : "自然な横書きにし"}、prefers-reduced-motion を尊重してください。訂正データはアプリ側から渡します。Proofmarks が言語を自動校正したり、事実を検証したりすると説明しないでください。本文を画像や canvas に置き換えないでください。本文の上下に注記用の余白を確保してください。padding は 44px 20px 以上、line-height は 1.8 以上にします（サンプルコードは訂正が密なため、より大きな値を使っています）。訂正は語単位で少なめに保ち、onIssue の insufficient-room に対応してください。` },
  ko: { intro: (tradition) => `npm 패키지 proofmarks를 사용해 다음 ${tradition} 교정지를 조작할 수 있는 웹페이지를 만드세요.`, source: "원본 원고(문단 사이에 줄바꿈 문자 하나 유지):", corrections: "미리 정한 교정:", outro: (pack, vertical) => `proofmarks/react의 Proofmarks와 proofmarks/notations의 ${pack}를 사용하세요. 본문은 선택하고 복사할 수 있어야 합니다. appearance="editorial"을 지정하고 showProofmarks로 표시 여부를 제어하세요. ${vertical ? "CSS writing-mode: vertical-rl을 사용하고" : "자연스러운 가로쓰기를 사용하고"} prefers-reduced-motion을 존중하세요. 교정 데이터는 앱에서 제공합니다. Proofmarks가 언어를 자동 교정하거나 사실을 확인한다고 주장하지 마세요. 본문을 이미지나 canvas로 대체하지 마세요. 본문 위아래에 주석 공간을 확보하세요. padding은 최소 44px 20px, line-height는 1.8 이상으로 합니다(예제 코드는 교정이 많아 더 큰 값을 씁니다). 교정은 단어 단위로 적게 유지하고 onIssue의 insufficient-room을 처리하세요.` },
  en: { intro: (tradition) => `Use the npm package proofmarks to build an interactive web proof for this ${tradition} specimen.`, source: "Source copy (keep one newline between paragraphs):", corrections: "Preset corrections:", outro: (pack, vertical) => `Use Proofmarks from proofmarks/react and ${pack} from proofmarks/notations. Keep the text selectable and copyable. Set appearance="editorial" and use showProofmarks to toggle the marks. Use ${vertical ? "CSS writing-mode: vertical-rl" : "natural horizontal layout"} and respect prefers-reduced-motion. The app supplies correction data; do not claim that Proofmarks automatically checks language or verifies facts. Do not replace the text with an image or canvas. Reserve room above and below the text for annotations: at least padding: 44px 20px and line-height: 1.8 (the example code uses more because this proof is dense). Keep corrections few and word-level, and handle insufficient-room from onIssue.` },
};
