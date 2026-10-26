import { siteHref } from "../site-path";
import { StrictMode, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Proofmarks } from "proofmarks/react";
import "proofmarks/styles.css";
import { cns3927, enUS, gb, jis, ks } from "proofmarks/notations";
import type { Correction } from "proofmarks";
import { codeFor, invitation, promptFor, retainOriginal, scenes, segmentsFor, type DemoScene } from "./scenes";
import { subtitleFor, subtitleLanguages, type SubtitleLanguage } from "./subtitles";
import { localizedScene, localizedTradition, uiCopy } from "./i18n";
import { InkTarget } from "./ink-target";
import "./demo.css";

const notations = { cns3927, enUS, gb, jis, ks };
const noMarks: readonly string[] = [];

function currentChapter(): number {
  const id = window.location.hash.slice(1);
  return Math.max(0, scenes.findIndex((scene) => scene.id === id));
}

function Manuscript({ scene }: { scene: DemoScene }): ReactNode {
  return segmentsFor(scene).map(({ text, tag, href }, index) => {
    if (tag === "em") return <em key={index}>{text}</em>;
    if (tag === "strong") return <strong key={index}>{text}</strong>;
    if (tag === "a") return <a key={index} href={href}>{text}</a>;
    return text;
  });
}

function Demo() {
  const [chapter, setChapter] = useState(currentChapter);
  const [taiwan, setTaiwan] = useState(false);
  const [marked, setMarked] = useState<Record<string, readonly string[]>>({});
  const [retained, setRetained] = useState(false);
  const [finished, setFinished] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docMode, setDocMode] = useState<"prompt" | "code">("prompt");
  const [copyStatus, setCopyStatus] = useState("");
  const [narrow, setNarrow] = useState(false);
  const [hideInk, setHideInk] = useState(false);
  const [subtitleLanguage, setSubtitleLanguage] = useState<SubtitleLanguage>("zh-Hans");
  const paperRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const docsRef = useRef<HTMLElement>(null);
  const docButtonRef = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scene = (chapter === 1 && taiwan ? invitation : scenes[chapter])!;
  const copyText = uiCopy[subtitleLanguage];
  const sceneText = localizedScene(scene, subtitleLanguage);
  const markedIds = marked[scene.id] ?? noMarks;
  const reviewed = scene.corrections.every(({ id }) => markedIds.includes(id));
  const pending = scene.corrections.find(({ id }) => !markedIds.includes(id));
  const retaining = scene.id === "letter" && reviewed && !retained;
  const inkTarget = pending ?? (retaining ? scene.corrections[0] : undefined);
  const corrections: readonly Correction[] = useMemo(() => scene.id === "letter" && retained
    ? [...scene.corrections, retainOriginal]
    : scene.corrections, [scene, retained]);
  const visibleCorrections = useMemo(() => corrections.filter(({ id }) => markedIds.includes(id) || (id === retainOriginal.id && retained)), [corrections, markedIds, retained]);
  const manuscript = useMemo(() => <Manuscript scene={scene} />, [scene]);
  const docText = docMode === "code" ? codeFor(scene, corrections, subtitleLanguage) : promptFor(scene, corrections, subtitleLanguage);

  useEffect(() => {
    const onHash = () => {
      setChapter(currentChapter());
      setDocsOpen(false);
      setHideInk(false);
      setFinished(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (docsOpen || event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      if (event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable], pre, #story-docs")) return;

      const next = currentChapter() + (event.key === "ArrowRight" ? 1 : -1);
      if (next < 0 || next >= scenes.length) return;
      event.preventDefault();
      window.location.hash = scenes[next]!.id;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [docsOpen]);

  useEffect(() => {
    document.title = finished ? `${copyText.story} — re:proofmarks` : `${scene.title} · ${copyText.story} — re:proofmarks`;
    document.documentElement.lang = subtitleLanguage;
    const skipLink = document.querySelector<HTMLAnchorElement>(".skip-link");
    if (skipLink) skipLink.textContent = copyText.skip;
  }, [scene.title, finished, subtitleLanguage]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    setCopyStatus("");
  }, [scene.id]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (docsOpen) {
      docsRef.current?.focus({ preventScroll: true });
      docsRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [docsOpen]);

  function closeDocs() {
    setDocsOpen(false);
    docButtonRef.current?.focus({ preventScroll: true });
  }

  async function copy() {
    clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(docText);
      setCopyStatus(copyText.copied);
    } catch {
      setCopyStatus(copyText.copyFailed);
    }
    copyTimer.current = setTimeout(() => setCopyStatus(""), 3500);
  }

  function markTarget() {
    setHideInk(false);
    if (retaining) setRetained(true);
    else if (pending) setMarked((previous) => ({
      ...previous,
      [scene.id]: [...(previous[scene.id] ?? []), pending.id],
    }));
  }

  const hintText = {
    "zh-Hans": retaining ? "再划一笔，保留原文" : "沿虚线划一笔，也可以轻点",
    "zh-Hant": retaining ? "再劃一筆，保留原文" : "沿虛線劃一筆，也可以輕點",
    ja: retaining ? "もう一筆で、原文を残す" : "点線をなぞるか、タップしてください",
    ko: retaining ? "한 번 더 그어 원문을 유지하세요" : "점선을 따라 긋거나 가볍게 누르세요",
    en: retaining ? "One more stroke to keep the original" : "Draw along the dotted line, or tap it",
  }[subtitleLanguage];

  const captionState = finished ? "finished"
    : retained && scene.id === "letter" ? "retained"
    : reviewed ? "after" : "before";
  const caption = subtitleFor(scene, subtitleLanguage, captionState);

  useEffect(() => { setCopyStatus(""); }, [subtitleLanguage]);

  return (
    <div className="story-demo">
      <header className="story-header">
        <a className="story-brand" href={siteHref("/")} aria-label={copyText.home}>re:proofmarks</a>
        <span>{copyText.story}</span>
      </header>
      <main id="main-content" tabIndex={-1}>
        <div className={`story-stage${scene.vertical ? " is-vertical" : ""}${narrow && scene.id === "walk" ? " is-narrow" : ""}`}>
          <article className={`story-paper${finished ? " is-finished" : ""}`} key={scene.id} aria-labelledby="story-title">
            <div className="story-paper-interior" ref={paperRef}>
              <p className="story-chapter">{finished ? copyText.endingChapter : sceneText.chapter}</p>
              <h1 id="story-title" ref={titleRef} tabIndex={-1} lang={finished ? subtitleLanguage : scene.lang}>{finished ? copyText.story : scene.title}</h1>
              {finished ? (
                <div className="story-colophon">
                  <p>{copyText.endingLine}</p>
                  <p lang="en">Side Streets · Vol. 01</p>
                  <span>白井出版</span>
                </div>
              ) : (
                <Proofmarks
                  className="story-proof"
                  notation={notations[scene.pack]}
                  corrections={visibleCorrections}
                  appearance="editorial"
                  showProofmarks={visibleCorrections.length > 0 && !hideInk}
                  lang={scene.lang}
                  aria-label={`${scene.title} ${copyText.proof}`}
                >
                  {manuscript}
                </Proofmarks>
              )}
              {!finished && inkTarget && !hideInk && <InkTarget
                key={`${scene.id}-${retaining ? "retain" : inkTarget.id}`}
                paperRef={paperRef}
                correction={inkTarget}
                vertical={scene.vertical}
                label={`${retaining ? copyText.retain : sceneText.action}: ${copyText.mark}`}
                onMark={markTarget}
              />}
              <p className="story-signature" lang="ja">白井出版<span>{chapter === 0 ? "人事部　四月一日" : "創刊号　第一稿"}</span></p>
              {!finished && (
                <div className="story-paper-tools">
                  {inkTarget && !hideInk && <span className="story-ink-hint" lang={subtitleLanguage}>{hintText}</span>}
                  {chapter === 1 && <button type="button" aria-label={taiwan ? copyText.switchSimplified : copyText.switchTraditional} onClick={() => { setTaiwan(!taiwan); setHideInk(false); }}>{copyText.scriptSwitch} <span aria-hidden="true">↔</span></button>}
                  {scene.id === "walk" && <button type="button" aria-pressed={narrow} onClick={() => setNarrow(!narrow)} title={copyText.widthHint}>{narrow ? copyText.widen : copyText.narrow} <span aria-hidden="true">↔</span></button>}
                </div>
              )}
            </div>
          </article>
        </div>
        <div className="story-below">
          <p className="story-caption" lang={subtitleLanguage} aria-live="polite" aria-atomic="true">{caption}</p>
          <div className="story-actions">
            {finished ? <><a href={siteHref("/get-started")}>{copyText.tryIt} <span aria-hidden="true">↗</span></a><button onClick={() => { setFinished(false); setRetained(false); setMarked({}); setTaiwan(false); setHideInk(false); window.location.hash = "arrival"; }}>{copyText.restart}</button></>
              : null}
            {!finished && sceneText.evidence && <details className="story-evidence"><summary>{copyText.viewEvidence}{sceneText.evidence.title}</summary><div><h2>{sceneText.evidence.title}</h2><dl>{sceneText.evidence.rows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p>{sceneText.evidence.note}</p></div></details>}
          </div>
        </div>
        <footer className="story-controls">
          <span className="story-current">{localizedTradition(scene, subtitleLanguage)}</span>
          <nav aria-label={copyText.paging}>
            {chapter > 0 ? <a href={`#${scenes[chapter - 1]!.id}`} aria-label={copyText.previous} aria-keyshortcuts={docsOpen ? undefined : "ArrowLeft"} className="story-arrow">←</a> : <span className="story-arrow-placeholder" />}
            <span className="story-page-number"><b>{String(chapter + 1).padStart(2, "0")}</b><i aria-hidden="true" /><span>05</span></span>
            {chapter < scenes.length - 1 ? <a href={`#${scenes[chapter + 1]!.id}`} aria-label={copyText.next} aria-keyshortcuts={docsOpen ? undefined : "ArrowRight"} className="story-arrow">→</a> : !finished && retained ? <button type="button" className="story-arrow" aria-label={copyText.finish} title={copyText.finish} onClick={() => setFinished(true)}>→</button> : <span className="story-arrow-placeholder" />}
            {!docsOpen && <span className="story-key-hint" aria-hidden="true">{copyText.keyHint}</span>}
          </nav>
          <div className="story-utility">
            {!finished && markedIds.length > 0 && <button type="button" className="story-ink-toggle" aria-pressed={hideInk} onClick={() => setHideInk(!hideInk)}>{hideInk ? copyText.showInk : copyText.hideInk}</button>}
            <label className="story-subtitle-control">
              <span>{copyText.subtitles}</span>
              <select aria-label={copyText.subtitleLanguage} value={subtitleLanguage} onChange={(event) => setSubtitleLanguage(event.target.value as SubtitleLanguage)}>
                {subtitleLanguages.map(({ id, label }) => <option key={id} value={id} lang={id}>{label}</option>)}
              </select>
            </label>
            <button className="story-code-toggle" ref={docButtonRef} aria-label={copyText.docsTitle} aria-expanded={docsOpen} aria-controls="story-docs" title={copyText.docsTitle} onClick={() => setDocsOpen(!docsOpen)}><span aria-hidden="true">〈/〉</span></button>
          </div>
        </footer>
        {docsOpen && <section id="story-docs" className="story-docs" ref={docsRef} tabIndex={-1} lang={subtitleLanguage} aria-labelledby="story-docs-title" onKeyDown={(event) => { if (event.key === "Escape") closeDocs(); }}>
          <div className="story-docs-heading"><h2 id="story-docs-title">{copyText.docsTitle}</h2><button onClick={closeDocs} aria-label={copyText.closeDocs}>×</button></div>
          <p>{sceneText.explanation}</p>
          <div className="story-docs-toolbar"><div role="group" aria-label={copyText.docsType}><button aria-pressed={docMode === "prompt"} onClick={() => { setDocMode("prompt"); setCopyStatus(""); }}>{copyText.promptTab}</button><button aria-pressed={docMode === "code"} onClick={() => { setDocMode("code"); setCopyStatus(""); }}>{copyText.codeTab}</button></div><button onClick={() => void copy()}>{docMode === "code" ? copyText.copyCode : copyText.copyPrompt}</button></div>
          <p className="story-copy-status" role="status">{copyStatus}</p>
          <pre tabIndex={0}><code>{docText}</code></pre>
          <div className="story-docs-footer"><span>{copyText.demoCredit}</span><a href={siteHref("/docs")}>{copyText.fullDocs} ↗</a><a href={siteHref("/references")}>{copyText.references} ↗</a></div>
        </section>}
      </main>
    </div>
  );
}

export function renderStoryDemo(container: HTMLElement): void {
  document.documentElement.lang = "zh-Hans";
  document.body.classList.add("story-surface");
  const skipLink = document.querySelector<HTMLAnchorElement>(".skip-link");
  if (skipLink) skipLink.textContent = "跳至校样";
  createRoot(container).render(<StrictMode><Demo /></StrictMode>);
}
