import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Correction, NotationPack } from "proofmarks";
import { Proofmarks } from "proofmarks/react";
import { cns3927, enUS, gb, jis, ks } from "proofmarks/notations";
import { SectionHeading, SiteFooter, SiteHeader } from "./site-ui";
import { HeroProof } from "./home-proof";
import { initSiteI18n, Rich, useDocumentMeta, useSiteText, type SiteDictionary } from "./i18n/site-i18n";

type NotationId = "jis" | "gb" | "cns3927" | "ks" | "enUS";
const suggestingAcceptedText = "The editor reviewed the manuscript.";
const suggestingCorrections = [
  {
    id: "preview-replace-editor",
    type: "replace",
    target: { kind: "text-range", start: 4, end: 10 },
    replacement: "writer",
  },
] as const satisfies readonly Correction[];

const nativeTraditions = [
  {
    id: "ja",
    notationId: "jis",
    label: "日本語 · JIS",
    lang: "ja",
    notation: jis,
    text: "余白を残す。",
    corrections: [
      {
        id: "native-delete-ja",
        type: "delete",
        target: { kind: "text-range", start: 0, end: 2 },
      },
      { id: "native-retain-ja", type: "cancel-correction", target: { kind: "correction", correctionId: "native-delete-ja" } },
    ],
  },
  {
    id: "zh",
    notationId: "gb",
    label: "中文 · GB",
    lang: "zh-Hans",
    notation: gb,
    text: "在细节里现发美。",
    corrections: [
      {
        id: "native-transpose-zh",
        type: "transpose",
        targets: [{ kind: "text-range", start: 4, end: 5 }, { kind: "text-range", start: 5, end: 6 }],
      },
    ],
  },
  {
    id: "ko",
    notationId: "ks",
    label: "한국어 · KS",
    lang: "ko",
    notation: ks,
    text: "함께읽는 문장.",
    corrections: [
      {
        id: "native-spacing-ko",
        type: "increase-spacing",
        target: { kind: "text-point", offset: 2 },
      },
    ],
  },
  {
    id: "zh-hant-tw",
    notationId: "cns3927",
    label: "臺灣 · CNS 3927",
    lang: "zh-Hant-TW",
    notation: cns3927,
    text: "編輯仔細校對這分文稿。",
    corrections: [
      {
        id: "native-replace-tw",
        type: "replace",
        target: { kind: "text-range", start: 7, end: 8 },
        replacement: "份",
      },
    ],
  },
  {
    id: "en",
    notationId: "enUS",
    label: "English · US",
    lang: "en",
    notation: enUS,
    text: "Keep the quiet voice.",
    corrections: [
      {
        id: "native-delete-en",
        type: "delete",
        target: { kind: "text-range", start: 9, end: 14 },
      },
      { id: "native-retain-en", type: "cancel-correction", target: { kind: "correction", correctionId: "native-delete-en" } },
    ],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  notationId: NotationId;
  label: string;
  lang: string;
  notation: NotationPack;
  text: string;
  corrections: readonly Correction[];
}>;

const traditionCopy = {
  ja: "ja", zh: "zh", ko: "ko", "zh-hant-tw": "tw", en: "en",
} as const satisfies Record<(typeof nativeTraditions)[number]["id"], keyof SiteDictionary["home"]["traditions"]>;

function NativeTraditions() {
  const { t } = useSiteText();
  return (
    <div className="tradition-grid">
      {nativeTraditions.map(({ id, label, lang, notation, text, corrections }) => {
        const { usage, note } = t.home.traditions[traditionCopy[id]];
        return (
        <figure className="tradition-proof" key={id}>
          <figcaption>{label}</figcaption>
          <p className="tradition-usage">{usage}</p>
          <Proofmarks
            as="div"
            notation={notation}
            corrections={corrections}
            appearance="editorial"
            markStyle={{ strokeScale: 0.75 }}
            lang={lang}
          >
            {text}
          </Proofmarks>
          <p className="tradition-note">{note}</p>
        </figure>
      );})}
    </div>
  );
}

function SuggestingPreview() {
  const { t } = useSiteText();
  return (
    <div className="suggesting-preview">
      <section className="working-copy-preview">
        <p className="small-label">{t.home.workingCopy}</p>
        <p className="preview-copy">The writer reviewed the manuscript.</p>
      </section>
      <section className="accepted-proof-preview">
        <p className="small-label">{t.home.acceptedProof}</p>
        <Proofmarks
          as="p"
          className="preview-proof"
          notation={enUS}
          corrections={suggestingCorrections}
          appearance="editorial"
          markStyle={{ strokeScale: 0.75 }}
        >
          {suggestingAcceptedText}
        </Proofmarks>
      </section>
    </div>
  );
}

function HomePage() {
  const { t, href } = useSiteText();
  const copy = t.home;
  useDocumentMeta(t.meta.homeTitle, t.meta.homeDescription);

  return (
    <div className="public-site home-page">
      <SiteHeader active="overview" />
      <main id="main-content" tabIndex={-1}>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero-copy">
            <h1 id="home-title"><Rich text={copy.heroTitle} /></h1>
            <p>{copy.heroLead}</p>
            <div className="install-line" aria-label={copy.installLabel}>
              <span aria-hidden="true">$</span>
              <code>npm install proofmarks</code>
            </div>
            <a className="quiet-link" href={href("/demo")}>{copy.demoLink} <span aria-hidden="true">→</span></a>
          </div>
          <HeroProof />
        </section>

        <section className="site-section" aria-labelledby="traditions-title">
          <SectionHeading title={copy.traditionsTitle}>
            <p id="traditions-title">{copy.traditionsLead}</p>
          </SectionHeading>
          <NativeTraditions />
        </section>

        <section className="site-section" aria-labelledby="suggesting-title">
          <SectionHeading title={copy.suggestingTitle}>
            <p id="suggesting-title">{copy.suggestingLead}</p>
            <a className="quiet-link" href={href("/docs#editing")}>{copy.connectEditor} <span aria-hidden="true">→</span></a>
          </SectionHeading>
          <SuggestingPreview />
        </section>

        <section className="home-resources" aria-label={copy.resourcesLabel}>
          <p>{copy.resourcesLead}</p>
          <nav aria-label={copy.exploreFurther}>
            <a href={href("/get-started")}>{copy.getStarted} <span aria-hidden="true">→</span></a>
            <a href={href("/docs")}>{copy.readDocs} <span aria-hidden="true">→</span></a>
            <a href={href("/docs#references")}>{copy.readReferences} <span aria-hidden="true">→</span></a>
          </nav>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export async function renderPublicSite(container: HTMLElement, _page: "overview"): Promise<void> {
  await initSiteI18n();
  createRoot(container).render(<StrictMode><HomePage /></StrictMode>);
}
