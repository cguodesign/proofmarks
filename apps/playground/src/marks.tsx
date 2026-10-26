import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ProofmarksAppearance, ProofmarksMarkStyle, WritingMode } from "proofmarks";
import { Proofmarks } from "proofmarks/react";
import { SiteFooter, SiteHeader } from "./site-ui";
import { CodeSample, LanguageSelect } from "./guide-ui";
import { correctionCode, languages, operations, sampleFor, supportFor, supportKeys, type LanguageId } from "./public-content";
import { format, initSiteI18n, Rich, useDocumentMeta, useSiteText } from "./i18n/site-i18n";

function MarksPage() {
  const { t } = useSiteText();
  const copy = t.marks;
  const [language, setLanguage] = useState<LanguageId>("enUS");
  const [appearance, setAppearance] = useState<ProofmarksAppearance>("editorial");
  const [mode, setMode] = useState<WritingMode>("horizontal-tb");
  const [ink, setInk] = useState("#b3261e");
  const [labelInk, setLabelInk] = useState("#b3261e");
  const [weight, setWeight] = useState(0.75);
  const [opacity, setOpacity] = useState(1);
  const pack = languages[language];
  const style: ProofmarksMarkStyle = { ink, labelInk, strokeScale: weight, opacity };
  useDocumentMeta(`${copy.title} — proofmarks`, t.meta.marksDescription);
  const reset = () => { setAppearance("editorial"); setMode("horizontal-tb"); setInk("#b3261e"); setLabelInk("#b3261e"); setWeight(0.75); setOpacity(1); };
  return <div className="public-site guide-page catalog-page">
    <SiteHeader active="marks" />
    <main id="main-content" tabIndex={-1}>
      <header className="guide-intro"><h1>{copy.title}</h1><p><Rich text={copy.intro} values={{ summary: t.common.productSummary }} /></p></header>
      <div className="catalog-language"><LanguageSelect id="marks-language" value={language} onChange={setLanguage} /></div>
      <div className="catalog-controls" role="group" aria-label={copy.customizeAll}>
        <div className="guide-field"><label htmlFor="marks-appearance">{copy.appearance}</label><select id="marks-appearance" value={appearance} onChange={event => setAppearance(event.target.value as ProofmarksAppearance)}><option value="editorial">{copy.editorial}</option><option value="technical">{copy.technical}</option></select></div>
        <div className="guide-field"><label htmlFor="marks-mode">{copy.writingMode}</label><select id="marks-mode" value={mode} onChange={event => setMode(event.target.value as WritingMode)}><option value="horizontal-tb">{copy.horizontal}</option><option value="vertical-rl">{copy.vertical}</option></select></div>
        <div className="guide-field"><label htmlFor="marks-ink">{copy.ink}</label><input id="marks-ink" type="color" value={ink} onChange={event => setInk(event.target.value)} /></div>
        <div className="guide-field"><label htmlFor="marks-label-ink">{copy.labelInk}</label><input id="marks-label-ink" type="color" value={labelInk} onChange={event => setLabelInk(event.target.value)} /></div>
        <div className="guide-field"><label htmlFor="marks-weight">{copy.lineWeight}</label><div className="guide-range"><input id="marks-weight" type="range" min="0.75" max="1.5" step="0.05" value={weight} aria-valuetext={`${Math.round(weight * 100)}%`} onChange={event => setWeight(event.currentTarget.valueAsNumber)} /><output htmlFor="marks-weight">{Math.round(weight * 100)}%</output></div></div>
        <div className="guide-field"><label htmlFor="marks-opacity">{copy.opacity}</label><div className="guide-range"><input id="marks-opacity" type="range" min="0" max="1" step="0.05" value={opacity} aria-valuetext={`${Math.round(opacity * 100)}%`} onChange={event => setOpacity(event.currentTarget.valueAsNumber)} /><output htmlFor="marks-opacity">{Math.round(opacity * 100)}%</output></div></div>
        <button type="button" className="catalog-reset" onClick={reset}>{copy.reset}</button>
      </div>
      <p className="guide-note catalog-source"><Rich text={copy.sourceNote} /></p>
      <table className="catalog-table" aria-label={format(copy.tableLabel, { pack: pack.label })}>
        <colgroup><col /><col /><col /><col /></colgroup>
        <thead><tr><th scope="col">{copy.result}</th><th scope="col">{copy.name}</th><th scope="col">{copy.explanation}</th><th scope="col">{copy.usage}</th></tr></thead>
        <tbody>{operations.map((operation, index) => {
          const sample = sampleFor(language, operation.type);
          const support = supportFor(language, operation.type, mode);
          const operationCopy = t.operations[operation.key];
          return <tr key={operation.type} data-mark-row={operation.type} data-support={support}>
            <td data-label={copy.result}>
              {support === "Unsupported" ? <div className="catalog-empty">{copy.unsupportedVertical}</div> :
                <Proofmarks as="div" className={`proof-text${mode === "vertical-rl" ? " proof-text--vertical" : ""}`}
                  style={{ writingMode: mode }} notation={pack.pack} lang={pack.lang}
                  corrections={sample.corrections} appearance={appearance} markStyle={style} animate={false}>
                  {sample.text}
                </Proofmarks>}
              {sample.extraSpace && support !== "Unsupported" ? <p className="guide-note">{copy.extraSpace}</p> : null}
            </td>
            <td data-label={copy.name}><span className="catalog-name" lang={pack.lang}>{pack.names[index]}</span>{pack.names[index] !== operationCopy.label ? <p>{operationCopy.label}</p> : null}<span className="catalog-status">{t.support[supportKeys[support]]}</span></td>
            <td data-label={copy.explanation}><p>{operationCopy.description}</p>{support === "Generic fallback" ? <p className="guide-note">{copy.fallbackNote}</p> : null}</td>
            <td data-label={copy.usage}><CodeSample label={`${copy.usage} · ${operationCopy.label}`} source={sample.corrections.map(correction => correctionCode(correction, { highlight: true })).join(",\n")} /></td>
          </tr>;
        })}</tbody>
      </table>
      <p className="guide-note"><Rich text={copy.footnote} /></p>
    </main>
    <SiteFooter />
  </div>;
}
export async function renderMarks(container: HTMLElement): Promise<void> {
  await initSiteI18n();
  createRoot(container).render(<StrictMode><MarksPage /></StrictMode>);
}
