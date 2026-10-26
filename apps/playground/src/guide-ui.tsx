import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./site-ui";
import { languages, languageIds, type LanguageId } from "./public-content";
import { formatLineRanges, parseHighlightedSource } from "./code-highlight";
import { format, useDocumentMeta, useSiteText } from "./i18n/site-i18n";
import "./guide.css";

/**
 * A copyable code sample. Wrap the lines or tokens the surrounding text
 * explains in `⟦` … `⟧` (see `hl` in code-highlight.ts); the markers are
 * stripped from what is shown and copied.
 */
export function CodeSample({ source, label = "TypeScript" }: { source: string; label?: string }) {
  const { t } = useSiteText();
  const [message, setMessage] = useState<"" | "copied" | "failed">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descriptionId = useId();
  const parsed = useMemo(() => parseHighlightedSource(source), [source]);
  const highlighted = parsed.highlightedLines.length > 0;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(parsed.source);
      setMessage("copied");
      timer.current = setTimeout(() => setMessage(""), 1800);
    } catch { setMessage("failed"); }
  };
  const lineCount = parsed.lines.length;
  return <figure className="guide-code" data-highlighted-lines={highlighted ? parsed.highlightedLines.join(",") : undefined}>
    <figcaption><span>{label}</span><span className="guide-copy"><span role="status">{message === "copied" ? t.common.copied : message === "failed" ? t.common.copyFailed : ""}</span><button type="button" onClick={copy} aria-label={format(t.common.copyLabel, { label })}>{t.common.copy}</button></span></figcaption>
    <pre tabIndex={0} aria-label={label} aria-describedby={highlighted ? descriptionId : undefined}><code>{
      parsed.lines.map((line, index) => {
        const content = line.segments.map((segment, part) => segment.token
          ? <mark key={part} className="guide-code-token">{segment.text}</mark>
          : <Fragment key={part}>{segment.text}</Fragment>);
        return <Fragment key={index}>
          {line.highlighted
            ? <mark className="guide-code-line" data-line={index + 1}>{content}</mark>
            : <span className="guide-code-line" data-line={index + 1}>{content}</span>}
          {index < lineCount - 1 ? "\n" : null}
        </Fragment>;
      })
    }</code></pre>
    {highlighted ? <p id={descriptionId} className="visually-hidden">
      {format(parsed.highlightedLines.length === 1 ? t.common.highlightedLine : t.common.highlightedLines, { lines: formatLineRanges(parsed.highlightedLines), total: lineCount })}
    </p> : null}
  </figure>;
}

export function LanguageSelect({ value, onChange, id = "language" }: { value: LanguageId; onChange(value: LanguageId): void; id?: string }) {
  const { t } = useSiteText();
  return <div className="guide-field"><label htmlFor={id}>{t.common.languageAndNotation}</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value as LanguageId)}>
      {languageIds.map(key => <option key={key} value={key} lang={languages[key].lang}>{languages[key].label}</option>)}
    </select>
  </div>;
}

export function GuideLayout({ title, description, intro, active, sections, children }: {
  title: string; description: string; intro: ReactNode; active: "get-started" | "docs";
  sections: ReadonlyArray<{ id: string; label: string }>; children: ReactNode;
}) {
  const { t } = useSiteText();
  const [current, setCurrent] = useState(sections[0]?.id);
  useDocumentMeta(`${title} — re:proofmarks`, description);
  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }, []);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let next = sections[0]?.id;
      for (const section of sections) if ((document.getElementById(section.id)?.getBoundingClientRect().top ?? Infinity) <= 180) next = section.id;
      setCurrent(next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [sections]);
  return <div className="public-site guide-page">
    <SiteHeader active={active} />
    <div className="guide-layout">
      <nav className="guide-contents" aria-label={t.common.onThisPage}>
        <span>{title}</span>{sections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={current === section.id ? "location" : undefined}>{section.label}</a>)}
      </nav>
      <main id="main-content" tabIndex={-1}>
        <header className="guide-intro"><h1>{title}</h1><p>{intro}</p></header>
        {children}
      </main>
    </div>
    <SiteFooter />
  </div>;
}
