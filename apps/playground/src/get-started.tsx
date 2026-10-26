import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Proofmarks } from "proofmarks/react";
import { CodeSample, GuideLayout, LanguageSelect } from "./guide-ui";
import { hl } from "./code-highlight";
import { exampleCode, languages, sampleFor, type LanguageId } from "./public-content";
import { format, initSiteI18n, Rich, useSiteText } from "./i18n/site-i18n";

function Quoted({ text, lang }: { text: string; lang?: string }) {
  const { t } = useSiteText();
  return <span lang={lang}>{format(t.common.quote, { text })}</span>;
}

function BasicExample({ language, type }: { language: LanguageId; type: "replace" | "insert" }) {
  const { t } = useSiteText();
  const copy = t.getStarted;
  const defaults = languages[language];
  const initial = type === "replace" ? defaults.replacement : defaults.insertion;
  const [value, setValue] = useState<string>(initial);
  const [input, setInput] = useState<string>(initial);
  const sample = sampleFor(language, type, value);
  const correction = sample.corrections[0]!;
  return <section id={type} className="guide-section guide-basic-example" data-example={type}>
    <h2>{type === "replace" ? copy.replaceTitle : copy.insertTitle}</h2>
    <p>{type === "replace"
      ? <Rich text={copy.replaceLead} values={{ word: <Quoted text={defaults.word} lang={defaults.lang} /> }} />
      : <Rich text={copy.insertLead} values={{ before: <Quoted text={defaults.before} lang={defaults.lang} /> }} />}</p>
    <figure className="guide-example-result">
      <figcaption>{copy.result}</figcaption>
      <Proofmarks as="div" className="proof-text" notation={defaults.pack} corrections={sample.corrections}
        appearance="editorial" markStyle={{ strokeScale: 0.75 }} lang={defaults.lang} animate={false}>
        {sample.text}
      </Proofmarks>
    </figure>
    <form className="guide-try" onSubmit={event => { event.preventDefault(); if (input.trim()) setValue(input); }}>
      <div className="guide-field">
        <label htmlFor={`try-${type}`}>{type === "replace" ? copy.replaceTry : copy.insertTry}</label>
        <input id={`try-${type}`} type="text" value={input} maxLength={32} required
          onChange={event => setInput(event.target.value)} lang={defaults.lang} />
      </div>
      <button type="submit">{type === "replace" ? copy.replaceApply : copy.insertApply}</button>
    </form>
    <p className="guide-explanation guide-note" aria-live="polite">
      {correction.type === "replace"
        ? <Rich text={copy.replaceExplanation} values={{
          start: correction.target.start, end: correction.target.end,
          word: <Quoted text={defaults.word} lang={defaults.lang} />, value: <Quoted text={value} lang={defaults.lang} />,
        }} />
        : correction.type === "insert"
          ? <Rich text={copy.insertExplanation} values={{ offset: correction.target.offset, before: <Quoted text={defaults.before} lang={defaults.lang} /> }} />
          : null}
    </p>
    <CodeSample label={type === "replace" ? copy.replaceCode : copy.insertCode} source={exampleCode(language, type, value)} />
  </section>;
}

function GetStarted() {
  const { t } = useSiteText();
  const copy = t.getStarted;
  const [language, setLanguage] = useState<LanguageId>("enUS");
  const sample = languages[language];
  const sections = useMemo(() => (["install", "language", "replace", "insert", "next"] as const)
    .map(id => ({ id, label: copy.sections[id] })), [copy]);
  return <GuideLayout title={copy.title} description={t.meta.getStartedDescription} active="get-started" sections={sections}
    intro={<Rich text={copy.intro} values={{ summary: t.common.productSummary }} />}>
    <section id="install" className="guide-section">
      <h2>{copy.installTitle}</h2>
      <p>{copy.installLead}</p>
      <CodeSample label={copy.terminal} source={hl("npm install proofmarks")} />
      <p className="guide-note"><Rich text={copy.installNote} /></p>
      <p className="guide-note"><Rich text={copy.roomNote} /></p>
    </section>
    <section id="language" className="guide-section">
      <h2>{copy.languageTitle}</h2>
      <div className="guide-language"><LanguageSelect id="start-language" value={language} onChange={setLanguage} /></div>
      <CodeSample label={copy.notationLabel} source={`import { ${hl(sample.importName)} } from "proofmarks/notations";\n// Use ${hl(`notation={${sample.importName}}`)} and ${hl(`lang=${JSON.stringify(sample.lang)}`)}.`} />
      <p><Rich text={copy.languageLead} values={{ label: <span lang={sample.lang}>{sample.label}</span> }} /></p>
    </section>
    <BasicExample key={`${language}-replace`} language={language} type="replace" />
    <BasicExample key={`${language}-insert`} language={language} type="insert" />
    <section id="next" className="guide-section">
      <h2>{copy.nextTitle}</h2>
      <p><Rich text={copy.nextBody} /></p>
    </section>
  </GuideLayout>;
}

export async function renderGetStarted(container: HTMLElement): Promise<void> {
  await initSiteI18n();
  createRoot(container).render(<StrictMode><GetStarted /></StrictMode>);
}
