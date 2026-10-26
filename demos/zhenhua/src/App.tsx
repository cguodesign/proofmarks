import { useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toPng } from "html-to-image";
import type { Correction, ProofmarksIssue } from "proofmarks";
import { applyCorrections, offsetsFromSelection } from "proofmarks/helpers";
import { cns3927, enUS, gb, jis, ks } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";
import { MODES, type ModeId } from "./dict";
import { buildCorrections, conflicts } from "./engine";

const NOTATIONS = { gb, cns3927, jis, ks, enUS } as const;
type NotationId = keyof typeof NOTATIONS;
const NOTATION_LABEL: Record<NotationId, string> = {
  gb: "大陆 GB",
  cns3927: "台湾 CNS",
  jis: "日本 JIS",
  ks: "韩国 KS",
  enUS: "美式 en-US",
};

const PENS = {
  red: { label: "红笔", ink: "#c8102e" },
  blue: { label: "蓝笔", ink: "#1f4fa3" },
  pencil: { label: "铅笔", ink: "#4a4a4a" },
} as const;
type PenId = keyof typeof PENS;

const LEVELS = {
  light: { label: "轻", limit: 3 },
  medium: { label: "中", limit: 6 },
  all: { label: "狠", limit: Infinity },
} as const;

export function App() {
  const [modeId, setModeId] = useState<ModeId>("decode");
  const mode = MODES.find((m) => m.id === modeId)!;
  const [text, setText] = useState(mode.sample);
  const [manual, setManual] = useState<Correction[]>([]);
  const [notationId, setNotationId] = useState<NotationId>("gb");
  const [pen, setPen] = useState<PenId>("red");
  const [stroke, setStroke] = useState(1.1);
  const [editorial, setEditorial] = useState(true);
  const [showMarks, setShowMarks] = useState(true);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [png, setPng] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [level, setLevel] = useState<keyof typeof LEVELS>("all");
  const auto = useMemo(() => buildCorrections(text, mode.rules, LEVELS[level].limit), [text, mode, level]);
  const corrections = useMemo(() => [...auto, ...manual], [auto, manual]);
  // applyCorrections validates first, so a bad correction set surfaces here as a message.
  const [result, valid] = useMemo((): [string, string | null] => {
    try {
      return [applyCorrections(text, corrections), null];
    } catch (e) {
      return ["", (e as Error).message];
    }
  }, [text, corrections]);

  const switchMode = (id: ModeId) => {
    setModeId(id);
    setText(MODES.find((m) => m.id === id)!.sample);
    setManual([]);
    setSel(null);
    setPng(null);
  };

  const onIssue = useCallback(
    (issue: ProofmarksIssue) =>
      setIssues((xs) => {
        const line = `${issue.code}: ${issue.message}`;
        return xs.includes(line) ? xs : [...xs, line];
      }),
    [],
  );
  const markStyle = useMemo(() => ({ ink: PENS[pen].ink, strokeScale: stroke }), [pen, stroke]);

  const captureSelection = () => {
    const s = window.getSelection();
    const root = rootRef.current?.querySelector<HTMLElement>("[data-proofmarks-root]");
    if (!s || s.rangeCount === 0 || !root) return;
    const range = s.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    const t = offsetsFromSelection(root, range);
    setSel(t.kind === "text-point" ? { start: t.offset, end: t.offset } : { start: t.start, end: t.end });
  };

  const addManual = (kind: "delete" | "replace" | "insert") => {
    if (!sel) return;
    const id = `manual-${Date.now()}`;
    const span = kind === "insert" ? { start: sel.end, end: sel.end } : sel;
    if (kind !== "insert" && sel.start === sel.end) return setError("先选中一段文字");
    if ((kind === "replace" || kind === "insert") && !draft.trim()) return setError("写点内容再批");
    if (conflicts(span, corrections)) return setError("这里已经批过了，换个地方");
    setError(null);
    const target = { kind: "text-range" as const, start: span.start, end: span.end };
    const c: Correction =
      kind === "delete"
        ? { id, type: "delete", target }
        : kind === "replace"
          ? { id, type: "replace", target, replacement: draft.trim() }
          : { id, type: "insert", target: { kind: "text-point", offset: span.start }, content: draft.trim() };
    setManual((m) => [...m, c]);
    setDraft("");
    setSel(null);
  };

  const exportPng = async () => {
    if (!cardRef.current) return;
    setPng(null);
    // Static ink for the capture: turn editorial motion off and commit before
    // the exporter copies computed styles.
    flushSync(() => setExporting(true));
    try {
      setPng(await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#fbf8f1" }));
    } catch (e) {
      setError(`导出失败：${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const selectedText = sel ? text.slice(sel.start, sel.end) : "";

  return (
    <main className="app">
      <header>
        <h1>真话机</h1>
        <p>粘一段话进去，让红笔老师帮你翻译、包装或者消气，然后截图发群里。</p>
      </header>

      <nav className="modes">
        {MODES.map((m) => (
          <button key={m.id} className={m.id === modeId ? "on" : ""} onClick={() => switchMode(m.id)}>
            {m.name}
            <small>{m.tagline}</small>
          </button>
        ))}
      </nav>

      <section className="grid">
        <div className="controls">
          <label>
            原文
            <textarea
              value={text}
              rows={6}
              onChange={(e) => {
                setText(e.target.value);
                setManual([]);
                setSel(null);
              }}
            />
          </label>

          <fieldset>
            <legend>力度</legend>
            {(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((id) => (
              <label key={id} className="chip">
                <input type="radio" checked={level === id} onChange={() => { setLevel(id); setManual([]); }} />
                {LEVELS[id].label}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>批改符号</legend>
            {(Object.keys(NOTATIONS) as NotationId[]).map((id) => (
              <label key={id} className="chip">
                <input type="radio" checked={notationId === id} onChange={() => setNotationId(id)} />
                {NOTATION_LABEL[id]}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>笔</legend>
            {(Object.keys(PENS) as PenId[]).map((id) => (
              <label key={id} className="chip">
                <input type="radio" checked={pen === id} onChange={() => setPen(id)} />
                {PENS[id].label}
              </label>
            ))}
            <label className="chip">
              粗细
              <input type="range" min={0.6} max={1.8} step={0.1} value={stroke} onChange={(e) => setStroke(+e.target.value)} />
              {stroke.toFixed(1)}
            </label>
            <label className="chip">
              <input type="checkbox" checked={editorial} onChange={(e) => setEditorial(e.target.checked)} />
              手写味
            </label>
            <label className="chip">
              <input type="checkbox" checked={showMarks} onChange={(e) => setShowMarks(e.target.checked)} />
              显示批改
            </label>
          </fieldset>

          <fieldset>
            <legend>自己补一刀（在右边卡片里选中文字）</legend>
            <p className="sel" data-testid="selection">
              {sel ? `选中「${selectedText || "▏"}」 ${sel.start}–${sel.end}` : "还没选中"}
            </p>
            <input value={draft} placeholder="改成 / 插入的内容" onChange={(e) => setDraft(e.target.value)} />
            <div className="row">
              <button onClick={() => addManual("delete")}>删掉</button>
              <button onClick={() => addManual("replace")}>改成</button>
              <button onClick={() => addManual("insert")}>在后面插入</button>
              <button onClick={() => setManual([])} disabled={!manual.length}>清空手批（{manual.length}）</button>
            </div>
          </fieldset>
          {error && <p className="error">{error}</p>}
          {valid && <p className="error">数据不合法：{valid}</p>}
          {issues.length > 0 && (
            <details open>
              <summary>onIssue（{issues.length}）</summary>
              <ul>{issues.map((i) => <li key={i}>{i}</li>)}</ul>
            </details>
          )}
        </div>

        <div className="preview">
          <div className="card" ref={cardRef} data-testid="card">
            <div className="card-head">
              <span>{mode.name}</span>
              <span className="stamp">{mode.stamp}</span>
            </div>
            <div ref={rootRef} onMouseUp={captureSelection} onKeyUp={captureSelection}>
              <Proofmarks
                as="p"
                className="proof"
                lang="zh-CN"
                notation={NOTATIONS[notationId]}
                corrections={corrections}
                appearance={editorial ? "editorial" : "technical"}
                animate={!exporting}
                showProofmarks={showMarks}
                markStyle={markStyle}
                onIssue={onIssue}
              >
                {text}
              </Proofmarks>
            </div>
            <div className="card-foot">
              <b>改完：</b>
              <span data-testid="result">{result}</span>
            </div>
            <div className="sign">— 批改：真话机 · {NOTATION_LABEL[notationId]} · {corrections.length} 处</div>
          </div>
          <div className="row">
            <button className="primary" onClick={exportPng}>导出截图</button>
            {png && (
              <a href={png} download={`zhenhua-${modeId}.png`}>下载 PNG</a>
            )}
          </div>
          {png && <img className="png" src={png} alt="导出的截图" data-testid="png" />}
        </div>
      </section>
    </main>
  );
}
