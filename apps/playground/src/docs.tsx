import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import type { Correction } from "proofmarks";
import { findRange } from "proofmarks/helpers";
import { enUS } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";
import { CodeSample, GuideLayout } from "./guide-ui";
import { languageIds, languages, operations, recommendedRoom, supportFor } from "./public-content";
import { standards } from "./reference-data";
import { initSiteI18n, Rich, useSiteText } from "./i18n/site-i18n";

const sectionKeys = [
  ["corrections", "corrections"], ["notation", "notation"], ["react", "react"], ["vanilla", "vanilla"],
  ["helpers", "helpers"], ["room", "room"], ["lifecycle", "lifecycle"], ["editing", "editing"],
  ["marker-style", "markerStyle"], ["motion", "motion"], ["writing-modes", "writingModes"], ["unsupported", "unsupported"],
  ["compatibility", "compatibility"], ["agents", "agents"], ["references", "references"], ["visual-sources", "visualSources"],
] as const;

const densityText = "The edtor reed the the draft todday.";
const comfortableText = "The edtor read the the draft today.";
const target = (text: string, phrase: string, nth = 0) => findRange(text, phrase, nth)!;
const denseCorrections = [
  { id: "dense-editor", type: "replace", target: target(densityText, "edtor"), replacement: "editor" },
  { id: "dense-read", type: "replace", target: target(densityText, "reed"), replacement: "read" },
  { id: "dense-the", type: "delete", target: target(densityText, "the ", 1) },
  { id: "dense-first", type: "insert", target: { kind: "text-point", offset: target(densityText, "draft").start }, content: "first " },
  { id: "dense-today", type: "replace", target: target(densityText, "todday"), replacement: "today" },
] satisfies Correction[];
const comfortableCorrections = [
  { id: "comfortable-editor", type: "replace", target: target(comfortableText, "edtor"), replacement: "editor" },
  { id: "comfortable-the", type: "delete", target: target(comfortableText, "the ", 1) },
] satisfies Correction[];

function DensityComparison() {
  const { t } = useSiteText();
  return <div className="guide-density">
    <figure>
      <figcaption><Rich text={t.docs.room.tooDense} /></figcaption>
      <Proofmarks as="p" className="guide-density-proof" notation={enUS} corrections={denseCorrections}
        appearance="editorial" animate={false} lang="en" style={{ padding: "4px 8px", lineHeight: 1.3 }}>
        {densityText}
      </Proofmarks>
    </figure>
    <figure>
      <figcaption><Rich text={t.docs.room.comfortable} /></figcaption>
      <Proofmarks as="p" className="guide-density-proof" notation={enUS} corrections={comfortableCorrections}
        appearance="editorial" animate={false} lang="en" style={recommendedRoom}>
        {comfortableText}
      </Proofmarks>
    </figure>
  </div>;
}

const reactSource = `import { Proofmarks } from "proofmarks/react";
import { enUS } from "proofmarks/notations";
import "proofmarks/styles.css"; // optional default tokens

<Proofmarks
  as="p"
  ⟦notation={enUS}
  corrections={corrections}⟧
  appearance="editorial"
  markStyle={{ strokeScale: 0.75 }}
  style={{ padding: "44px 20px", lineHeight: 1.8 }}
  onIssue={(issue) => console.warn(issue.code, issue.message)}
>
  The <em>editor</em> reads the draft.
</Proofmarks>`;

const vanillaSource = `import { createProofmarks } from "proofmarks";
import { enUS } from "proofmarks/notations";
import "proofmarks/styles.css"; // optional default tokens

const element = document.querySelector<HTMLElement>("#proof");
if (!element) throw new Error("Missing #proof element");
element.textContent = "The editor reads.";
element.style.padding = "44px 20px";
element.style.lineHeight = "1.8";

const proof = ⟦createProofmarks(element, {⟧
  notation: enUS,
  corrections: [{
    id: "editor-to-writer", type: "replace",
    target: { kind: "text-range", start: 4, end: 10 },
    replacement: "writer",
  }],
  onIssue: (issue) => console.warn(issue.code, issue.message),
});

// Call after your application reviews the suggestions.
export function clearSuggestions() {
  ⟦proof.update({ notation: enUS, corrections: [] });⟧
}

// Call when the view is removed.
export function unmountProof() {
  ⟦proof.destroy();⟧
}`;

const helpersSource = `import {
  getSourceText, findRange, offsetsFromSelection,
  correctionsFromDiff, applyCorrections,
} from "proofmarks/helpers";

const element = document.querySelector<HTMLElement>(".proof")!;
const text = ⟦getSourceText(element)⟧;          // source only, no labels
const editor = ⟦findRange(text, "editor")⟧;     // null when absent
const second = ⟦findRange(text, "the", 1)⟧;     // nth is zero-based
const picked = ⟦offsetsFromSelection(element, getSelection()!.getRangeAt(0))⟧;
console.log(editor, second, picked);

const corrections = ⟦correctionsFromDiff(text, "The writer reads.", {⟧
  granularity: "word",   // "character", or "code" for source code
  idPrefix: "line-3-",   // unique IDs across many proofs
});
⟦applyCorrections(text, corrections)⟧ === "The writer reads."; // true`;

const motionSource = `<Proofmarks
  notation={enUS}
  corrections={corrections}
  appearance="editorial"
  ⟦animate={false}⟧
  showProofmarks={showMarks}
  style={{ padding: "44px 20px", lineHeight: 1.8 }}
>
  {text}
</Proofmarks>

// Vanilla: write the marks on again, on request.
⟦proof.replay();⟧`;

const lifecycleSource = `// Vanilla: create and update throw for invalid data.
try {
  proof.update({ notation: enUS, corrections: next });
⟦} catch (error) {⟧
  console.warn(error);
}

// React: invalid data is reported, never thrown.
<Proofmarks
  notation={enUS}
  corrections={corrections}
  ⟦onIssue={(issue) => {
    if (issue.code === "invalid-corrections") {⟧
      console.warn(issue.correctionId, issue.message); // rebase or regenerate
    }
  }}
>
  {text}
</Proofmarks>`;

function Docs() {
  const { t } = useSiteText();
  const d = t.docs;
  const sections = useMemo(() => sectionKeys.map(([id, key]) => ({ id, label: d.sections[key] })), [d]);
  const row = (code: string, text: string) => <tr><td><code>{code}</code></td><td><Rich text={text} /></td></tr>;
  return <GuideLayout title={d.title} description={t.meta.docsDescription} active="docs" sections={sections}
    intro={<Rich text={d.intro} values={{ summary: t.common.productSummary }} />}>
    <section id="corrections" className="guide-section">
      <h2>{d.corrections.title}</h2>
      <p>{d.corrections.lead}</p>
      <div className="guide-overflow"><table className="guide-data-table"><thead><tr><th>{d.corrections.operation}</th><th>{d.corrections.target}</th><th>{d.corrections.payload}</th></tr></thead><tbody>
        {operations.map(operation => <tr key={operation.type}>
          <td><code>{operation.type}</code></td>
          <td><Rich text={d.corrections.targets[operation.key]} /></td>
          <td>{operation.type === "insert" ? <code>content</code> : operation.type === "replace" ? <code>replacement</code> : "—"}</td>
        </tr>)}
      </tbody></table></div>
      <h3>{d.corrections.positionsTitle}</h3>
      <p><Rich text={d.corrections.positions} /></p>
      <p><Rich text={d.corrections.sourceText} /></p>
      <CodeSample label={d.labels.targets} source={`import { findRange, getSourceText } from "proofmarks/helpers";\n\nconst text = ⟦getSourceText(element)⟧; // "The editor reads."\nconst target = findRange(text, "editor"); // ⟦{ kind: "text-range", start: 4, end: 10 }⟧\nconst reads = findRange(text, "reads")!;\nconst point = { kind: "text-point", offset: reads.start };`} />
      <p><Rich text={d.corrections.stable} /></p>
      <h3>{d.corrections.spacingTitle}</h3>
      <p>{d.corrections.spacing}</p>
      <CodeSample label={d.labels.cancel} source={`import type { Correction } from "proofmarks";\n\nconst corrections: Correction[] = [\n  { id: "remove-editor", type: "delete",\n    target: { kind: "text-range", start: 4, end: 10 } },\n  ⟦{ id: "keep-editor", type: "cancel-correction",\n    target: { kind: "correction", correctionId: "remove-editor" } },⟧\n];`} />
    </section>

    <section id="notation" className="guide-section">
      <h2>{d.notation.title}</h2>
      <p>{d.notation.lead}</p>
      <CodeSample label={d.labels.notationImports} source={`⟦import { jis, gb, cns3927, ks, enUS } from "proofmarks/notations";⟧\n// A pack-specific entry is also available:\n// import { cns3927 } from "proofmarks/notations/cns3927";`} />
      <p>{d.notation.evidence}</p>
      <div className="guide-overflow"><table className="guide-data-table guide-coverage-table" aria-label={d.notation.tableLabel}><caption>{d.notation.caption}</caption><thead><tr><th>{d.notation.operation}</th>{languageIds.map(id => <th key={id}>{languages[id].importName}</th>)}</tr></thead><tbody>
        {operations.map(operation => <tr key={operation.type}><th scope="row">{t.operations[operation.key].label}</th>{languageIds.map(id => <td key={id}>{supportFor(id, operation.type, "horizontal-tb") === "Reference-based" ? d.notation.direct : d.notation.fallback}</td>)}</tr>)}
      </tbody></table></div>
      <p className="guide-note"><Rich text={d.notation.legend} /></p>
      <h3 id="scale">{d.notation.scaleTitle}</h3>
      <p><Rich text={d.notation.scale} /></p>
      <h3 id="pack-metadata">{d.notation.metadataTitle}</h3>
      <p><Rich text={d.notation.metadata} /></p>
      <CodeSample label={d.labels.notationPicker} source={`import { cns3927, enUS, gb, jis, ks } from "proofmarks/notations";\n\nconst packs = [jis, gb, cns3927, ks, enUS];\nconst options = packs.map((pack) => ({ value: pack.id, label: ⟦pack.displayName⟧, lang: ⟦pack.locale⟧ }));\nconst canMove = enUS.⟦supportedCorrections⟧.includes("move");`} />
    </section>

    <section id="react" className="guide-section">
      <h2>{d.react.title}</h2>
      <p>{d.react.lead}</p>
      <CodeSample label={d.labels.react} source={reactSource} />
      <p>{d.react.after}</p>
      <h3 id="react-props">{d.react.propsTitle}</h3>
      <p><Rich text={d.react.asList} /></p>
      <p><Rich text={d.react.passThrough} /></p>
      <h3 id="copy-accessibility">{d.react.copyTitle}</h3>
      <p><Rich text={d.react.copy} /></p>
    </section>

    <section id="vanilla" className="guide-section">
      <h2>{d.vanilla.title}</h2>
      <p>{d.vanilla.lead}</p>
      <CodeSample label={d.labels.vanilla} source={vanillaSource} />
    </section>

    <section id="helpers" className="guide-section">
      <h2>{d.helpers.title}</h2>
      <p><Rich text={d.helpers.lead} /></p>
      <CodeSample label={d.labels.helpers} source={helpersSource} />
      <div className="guide-overflow"><table className="guide-data-table"><thead><tr><th>{d.helpers.helper}</th><th>{d.helpers.behavior}</th></tr></thead><tbody>
        {row("getSourceText(element)", d.helpers.getSourceText)}
        {row("findRange(text, phrase, nth?)", d.helpers.findRange)}
        {row("offsetsFromSelection(element, range)", d.helpers.offsetsFromSelection)}
        {row("correctionsFromDiff(before, after, options?)", d.helpers.correctionsFromDiff)}
        {row("applyCorrections(text, corrections)", d.helpers.applyCorrections)}
      </tbody></table></div>
      <p className="guide-note"><Rich text={d.helpers.note} /></p>
    </section>

    <section id="room" className="guide-section">
      <h2>{d.room.title}</h2>
      <p><Rich text={d.room.lead} /></p>
      <CodeSample label={d.labels.css} source={`.proof {\n  ⟦padding: 44px 20px;\n  line-height: 1.8;⟧\n}`} />
      <p><Rich text={d.room.density} /></p>
      <DensityComparison />
      <p>{d.room.scope}</p>
    </section>

    <section id="lifecycle" className="guide-section">
      <h2>{d.lifecycle.title}</h2>
      <p>{d.lifecycle.lead}</p>
      <ul>
        <li><Rich text={d.lifecycle.react} /></li>
        <li><Rich text={d.lifecycle.vanilla} /></li>
      </ul>
      <p><Rich text={d.lifecycle.stale} /></p>
      <CodeSample label={d.labels.lifecycle} source={lifecycleSource} />
    </section>

    <section id="editing" className="guide-section">
      <h2>{d.editing.title}</h2>
      <p>{d.editing.lead}</p>
      <ol><li>{d.editing.step1}</li><li>{d.editing.step2}</li><li>{d.editing.step3}</li><li><Rich text={d.editing.step4} /></li></ol>
      <p><Rich text={d.editing.model} /></p>
    </section>

    <section id="marker-style" className="guide-section">
      <h2>{d.markerStyle.title}</h2>
      <p><Rich text={d.markerStyle.lead} /></p>
      <CodeSample label={d.labels.appearance} source={`<Proofmarks\n  notation={enUS}\n  corrections={corrections}\n  ⟦appearance="editorial"\n  markStyle={{\n    ink: "#b3261e",\n    labelInk: "#b3261e",\n    strokeScale: 0.75,\n    opacity: 1,\n  }}⟧\n  style={{ padding: "44px 20px", lineHeight: 1.8 }}\n>\n  {text}\n</Proofmarks>`} />
      <div className="guide-overflow"><table className="guide-data-table"><thead><tr><th>{d.markerStyle.option}</th><th>{d.markerStyle.values}</th></tr></thead><tbody>
        {row("appearance", d.markerStyle.appearance)}
        {row("markStyle.ink", d.markerStyle.ink)}
        {row("markStyle.labelInk", d.markerStyle.labelInk)}
        {row("markStyle.strokeScale", d.markerStyle.strokeScale)}
        {row("markStyle.opacity", d.markerStyle.opacity)}
      </tbody></table></div>
      <p><Rich text={d.markerStyle.css} /></p>
      <h3 id="css-variables">{d.markerStyle.variablesTitle}</h3>
      <p><Rich text={d.markerStyle.variables} /></p>
      <div className="guide-overflow"><table className="guide-data-table"><thead><tr><th>{d.markerStyle.variable}</th><th>{d.markerStyle.defaultValue}</th><th>{d.markerStyle.usedFor}</th></tr></thead><tbody>
        <tr><td><code>--proofmarks-color</code></td><td><code>oklch(52% 0.22 28)</code></td><td>{d.markerStyle.color}</td></tr>
        <tr><td><code>--proofmarks-stroke-width</code></td><td><code>1.75px</code></td><td><Rich text={d.markerStyle.strokeWidth} /></td></tr>
        <tr><td><code>--proofmarks-label-font</code></td><td><code>ui-sans-serif, sans-serif</code></td><td>{d.markerStyle.labelFont}</td></tr>
        <tr><td><code>--proofmarks-halo</code></td><td><code>transparent</code></td><td>{d.markerStyle.halo}</td></tr>
        <tr><td><code>--proofmarks-editorial-color</code></td><td><code>oklch(50% 0.19 31)</code></td><td>{d.markerStyle.editorialColor}</td></tr>
        <tr><td><code>--proofmarks-editorial-second-stroke</code></td><td><code>1.05px</code></td><td>{d.markerStyle.secondStroke}</td></tr>
        <tr><td><code>--proofmarks-editorial-font</code></td><td>{d.markerStyle.editorialFontDefault}</td><td>{d.markerStyle.editorialFont}</td></tr>
      </tbody></table></div>
      <h3 id="dark-mode">{d.markerStyle.darkTitle}</h3>
      <p>{d.markerStyle.dark}</p>
      <CodeSample label={d.labels.darkMode} source={`@media (prefers-color-scheme: dark) {\n  .proof {\n    ⟦--proofmarks-color: oklch(72% 0.17 28);\n    --proofmarks-editorial-color: oklch(72% 0.17 28);\n    --proofmarks-halo: #111;⟧\n  }\n}`} />
      <p className="guide-note"><Rich text={d.markerStyle.darkNote} /></p>
    </section>

    <section id="motion" className="guide-section">
      <h2>{d.motion.title}</h2>
      <h3 id="visibility">{d.motion.visibilityTitle}</h3>
      <p><Rich text={d.motion.visibility} /></p>
      <CodeSample label={d.labels.motion} source={motionSource} />
      <h3 id="export">{d.motion.exportTitle}</h3>
      <p><Rich text={d.motion.export} /></p>
      <p><Rich text={d.motion.many} /></p>
    </section>

    <section id="writing-modes" className="guide-section">
      <h2>{d.writingModes.title}</h2>
      <p><Rich text={d.writingModes.lead} /></p>
      <ul><li>{d.writingModes.jis}</li><li>{d.writingModes.cns}</li><li>{d.writingModes.gbKs}</li><li>{d.writingModes.en}</li></ul>
      <CodeSample label={d.labels.vertical} source={`<Proofmarks notation={jis} corrections={corrections}\n  style={{ ⟦writingMode: "vertical-rl"⟧, paddingBlock: 44, paddingInline: 20,\n    lineHeight: 1.8, height: "24rem" }}>\n  {text}\n</Proofmarks>`} />
      <p className="guide-note"><Rich text={d.writingModes.logical} /></p>
      <h3 id="rtl">{d.writingModes.rtlTitle}</h3>
      <p><Rich text={d.writingModes.rtl} /></p>
    </section>

    <section id="unsupported" className="guide-section">
      <h2>{d.unsupported.title}</h2>
      <p><Rich text={d.unsupported.lead} /></p>
      <CodeSample label={d.labels.feedback} source={`<Proofmarks\n  notation={notation}\n  corrections={corrections}\n  ⟦onIssue={(issue) => console.warn(issue.code, issue.message)}\n  onRender={(info) => {⟧\n    console.log(⟦info.fidelity⟧, info.fallbackCount, info.layoutMs);\n  }}\n>\n  {text}\n</Proofmarks>`} />
      <div className="guide-overflow"><table className="guide-data-table"><thead><tr><th>{d.unsupported.issue}</th><th>{d.unsupported.meaning}</th></tr></thead><tbody>
        {row("invalid-corrections", d.unsupported.invalid)}
        {row("insufficient-room", d.unsupported.room)}
        {row("unsupported-writing-mode", d.unsupported.writingMode)}
        {row("unverified-direction", d.unsupported.direction)}
        <tr><td><code>invalid-mark-style-color</code>, <code>invalid-mark-style-value</code>, <code>mark-style-value-clamped</code></td><td><Rich text={d.unsupported.markStyle} /></td></tr>
      </tbody></table></div>
      <p><Rich text={d.unsupported.fidelity} /></p>
    </section>

    <section id="compatibility" className="guide-section">
      <h2>{d.compatibility.title}</h2>
      <div className="guide-overflow"><table className="guide-data-table"><thead><tr><th>{d.compatibility.surface}</th><th>{d.compatibility.status}</th></tr></thead><tbody>
        {(["browsers", "safari", "mobile", "react", "ssr", "rtl", "bundle", "license"] as const).map(key =>
          <tr key={key}><td>{d.compatibility[key]}</td><td><Rich text={d.compatibility[`${key}Status`]} /></td></tr>)}
      </tbody></table></div>
    </section>

    <section id="agents" className="guide-section">
      <h2>{d.agents.title}</h2>
      <p><Rich text={d.agents.body} /></p>
    </section>

    <section id="references" className="guide-section">
      <h2>{d.references.title}</h2>
      <p>{d.references.lead}</p>
      {standards.map(item => {
        const copy = d.references[item.id];
        const labels: Record<string, string> = copy.links;
        return <article className="guide-reference" key={item.id}>
          <h3>{item.system}</h3>
          <p>{item.source ?? d.references.en.source} · {copy.confidence}</p>
          <dl><dt>{d.references.scope}</dt><dd>{copy.coverage}</dd><dt>{d.references.evidence}</dt><dd>{copy.note}</dd></dl>
          <div className="guide-reference-links">{item.links.map(([key, href]) => <a key={href} href={href}>{labels[key]} ↗</a>)}</div>
        </article>;
      })}
    </section>

    <section id="visual-sources" className="guide-section">
      <h2>{d.credits.title}</h2>
      <p>{d.credits.lead}</p>
      <div className="guide-credits">
        <figure><figcaption><a href="https://archives.ichigaya-letterpress.jp/api/image/3/007_012.tif/1800,1200,1700,2100/800,/0/default.jpg"><span lang="ja">明朝五号活字摘要録</span> · {d.credits.august1913} ↗</a><br /><span lang="ja">大日本印刷株式会社／市谷の杜 本と活字館</span> · CC BY 4.0</figcaption></figure>
        <figure><figcaption><a href="https://archives.ichigaya-letterpress.jp/api/image/3/T3_006.tif/726,703,2718,2718/900,/0/default.jpg"><span lang="ja">主要活字見本帳</span> · {d.credits.october1948} ↗</a><br /><span lang="ja">大日本印刷株式会社／市谷の杜 本と活字館</span> · CC BY 4.0</figcaption></figure>
      </div>
    </section>
  </GuideLayout>;
}

export async function renderDocs(container: HTMLElement): Promise<void> {
  await initSiteI18n();
  createRoot(container).render(<StrictMode><Docs /></StrictMode>);
}
