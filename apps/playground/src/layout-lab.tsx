import { siteHref } from "./site-path";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Correction } from "@proofmarks/core";
import {
  createProofmarks,
  type NotationPack,
  type ProofmarksAppearance,
  type ProofmarksInstance,
  type WritingMode,
} from "@proofmarks/dom";
import {
  chineseGbNotationPack,
  englishUsNotationPack,
  japaneseJisNotationPack,
  koreanKsNotationPack,
  taiwanCns3927NotationPack,
} from "@proofmarks/notations";

type NotationId = "jis" | "gb" | "cns" | "ks" | "en";
type Density =
  | "regression"
  | "dense"
  | "profile-1"
  | "profile-10"
  | "profile-30"
  | "profile-100";

const notationPacks: Record<NotationId, NotationPack> = {
  jis: japaneseJisNotationPack,
  gb: chineseGbNotationPack,
  cns: taiwanCns3927NotationPack,
  ks: koreanKsNotationPack,
  en: englishUsNotationPack,
};

const notationLabels: Record<NotationId, string> = {
  jis: "JIS",
  gb: "GB",
  cns: "CNS 3927",
  ks: "KS",
  en: "en-US",
};

const regressionText = "The editor carefully reviewed the manuscript.";
const regressionCorrections: readonly Correction[] = [
  {
    id: "replace-editor",
    type: "replace",
    target: { kind: "text-range", start: 4, end: 10 },
    replacement: "writer",
  },
  {
    id: "insert-new",
    type: "insert",
    target: { kind: "text-point", offset: 10 },
    content: " new",
  },
  {
    id: "insert-s",
    type: "insert",
    target: { kind: "text-point", offset: 45 },
    content: "s",
  },
];

const denseText =
  "The careful editor reviewed a long manuscript before final publication.";

function wordRange(text: string, word: string): { start: number; end: number } {
  const start = text.indexOf(word);
  if (start < 0) throw new Error(`Dense fixture word ${word} is unavailable.`);
  return { start, end: start + word.length };
}

const careful = wordRange(denseText, "careful");
const editor = wordRange(denseText, "editor");
const reviewed = wordRange(denseText, "reviewed");
const long = wordRange(denseText, "long");
const manuscript = wordRange(denseText, "manuscript");
const before = wordRange(denseText, "before");
const finalWord = wordRange(denseText, "final");
const publication = wordRange(denseText, "publication");

const denseCorrections: readonly Correction[] = [
  {
    id: "dense-replace-careful",
    type: "replace",
    target: { kind: "text-range", ...careful },
    replacement: "precise",
  },
  {
    id: "dense-insert-careful",
    type: "insert",
    target: { kind: "text-point", offset: careful.end },
    content: " and patient",
  },
  {
    id: "dense-delete-editor",
    type: "delete",
    target: { kind: "text-range", ...editor },
  },
  {
    id: "dense-cancel-editor",
    type: "cancel-correction",
    target: { kind: "correction", correctionId: "dense-delete-editor" },
  },
  {
    id: "dense-replace-reviewed",
    type: "replace",
    target: { kind: "text-range", ...reviewed },
    replacement: "examined",
  },
  {
    id: "dense-insert-reviewed",
    type: "insert",
    target: { kind: "text-point", offset: reviewed.end },
    content: " closely",
  },
  {
    id: "dense-delete-long",
    type: "delete",
    target: { kind: "text-range", ...long },
  },
  {
    id: "dense-replace-manuscript",
    type: "replace",
    target: { kind: "text-range", ...manuscript },
    replacement: "proof",
  },
  {
    id: "dense-insert-before",
    type: "insert",
    target: { kind: "text-point", offset: before.start },
    content: "well ",
  },
  {
    id: "dense-delete-before",
    type: "delete",
    target: { kind: "text-range", ...before },
  },
  {
    id: "dense-transpose-ending",
    type: "transpose",
    targets: [
      { kind: "text-range", ...finalWord },
      { kind: "text-range", ...publication },
    ],
  },
  {
    id: "dense-insert-ending",
    type: "insert",
    target: { kind: "text-point", offset: publication.end },
    content: " copy",
  },
];

const performanceText = Array.from(
  { length: 24 },
  (_, index) =>
    `Paragraph ${index + 1} gives the compositor enough ordinary browser text to measure and annotate.`,
).join(" ");

function performanceCorrections(count: 1 | 10 | 30 | 100): readonly Correction[] {
  const spacing = Math.floor((performanceText.length - 40) / count);
  return Array.from({ length: count }, (_, index) => ({
    id: `profile-insert-${index + 1}`,
    type: "insert" as const,
    target: {
      kind: "text-point" as const,
      offset: 20 + spacing * index,
    },
    content: ` note ${index + 1}`,
  }));
}

const profileCorrections = {
  "profile-1": performanceCorrections(1),
  "profile-10": performanceCorrections(10),
  "profile-30": performanceCorrections(30),
  "profile-100": performanceCorrections(100),
} satisfies Record<`profile-${1 | 10 | 30 | 100}`, readonly Correction[]>;

function ProofSheet({
  text,
  corrections,
  notation,
  debug,
  writingMode,
  width,
  appearance,
}: {
  text: string;
  corrections: readonly Correction[];
  notation: NotationPack;
  debug: boolean;
  writingMode: WritingMode;
  width: number;
  appearance: ProofmarksAppearance;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const instance = useRef<ProofmarksInstance | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const proofmarks = createProofmarks(element, {
      notation,
      corrections,
      debug,
      appearance,
    });
    instance.current = proofmarks;
    return () => {
      proofmarks.destroy();
      if (instance.current === proofmarks) instance.current = null;
    };
  }, []);

  useEffect(() => {
    instance.current?.update({ notation, corrections, debug, appearance });
  }, [notation, corrections, debug, appearance, text, writingMode, width]);

  return (
    <article
      ref={ref}
      className={`layout-proof-sheet layout-proof-sheet--${appearance}`}
      data-testid="layout-proof-sheet"
      style={{
        width: `${width}px`,
        writingMode,
        ...(writingMode === "vertical-rl" ? { height: "31rem" } : {}),
      }}
      lang={notation.locale}
    >
      {text}
    </article>
  );
}

function LayoutLab() {
  const [notationId, setNotationId] = useState<NotationId>("en");
  const [density, setDensity] = useState<Density>("regression");
  const [writingMode, setWritingMode] = useState<WritingMode>("horizontal-tb");
  const [debug, setDebug] = useState(false);
  const [width, setWidth] = useState(640);
  const [appearance, setAppearance] = useState<ProofmarksAppearance>("technical");
  const fixture = useMemo(
    () => {
      if (density === "regression") {
        return { text: regressionText, corrections: regressionCorrections };
      }
      if (density === "dense") {
        return { text: denseText, corrections: denseCorrections };
      }
      return { text: performanceText, corrections: profileCorrections[density] };
    },
    [density],
  );
  const notation = notationPacks[notationId];

  return (
    <main className="layout-shell">
      <header className="layout-masthead">
        <div>
          <p className="eyebrow">Task 008 · editorial composition lab</p>
          <h1>Give every mark<br />room to speak.</h1>
        </div>
        <div className="layout-intro">
          <p>
            Canonical marks stay attached to browser text. Movable annotations
            compete for logical lanes, then leaders reconnect the chosen positions.
          </p>
          <nav className="route-links" aria-label="Engineering views">
            <a className="text-link" href={siteHref("/suggest")}>Suggesting editor →</a>
            <a className="text-link" href={siteHref("/marks")}>Mark atlas →</a>
          </nav>
        </div>
      </header>

      <section className="layout-controls" aria-label="Layout laboratory controls">
        <fieldset>
          <legend>Fixture</legend>
          {(["regression", "dense", "profile-1", "profile-10", "profile-30", "profile-100"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={density === choice}
              onClick={() => setDensity(choice)}
            >
              {choice === "regression"
                ? "writer + new + s"
                : choice === "dense"
                  ? "Dense · 12"
                  : `Profile · ${choice.slice(8)}`}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Notation</legend>
          {(Object.keys(notationPacks) as NotationId[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={notationId === id}
              onClick={() => setNotationId(id)}
            >
              {notationLabels[id]}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Writing mode</legend>
          {(["horizontal-tb", "vertical-rl"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={writingMode === mode}
              onClick={() => setWritingMode(mode)}
            >
              {mode === "horizontal-tb" ? "Horizontal" : "Vertical · rl"}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Appearance</legend>
          {(["technical", "editorial"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={appearance === choice}
              onClick={() => setAppearance(choice)}
            >
              {choice === "technical" ? "Technical" : "Editorial"}
            </button>
          ))}
        </fieldset>
        <label className="layout-debug-toggle">
          <input
            type="checkbox"
            checked={debug}
            onChange={(event) => setDebug(event.target.checked)}
          />
          <span>Layout debug</span>
        </label>
        <label className="layout-width-control">
          <span>Paper width</span>
          <input
            type="range"
            min="360"
            max="720"
            step="20"
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
          <output>{width}px</output>
        </label>
      </section>

      <section className="layout-stage" id="proof-stage">
        <ProofSheet
          text={fixture.text}
          corrections={fixture.corrections}
          notation={notation}
          debug={debug}
          writingMode={writingMode}
          width={width}
          appearance={appearance}
        />
      </section>

      <section className="layout-contract">
        <div>
          <p className="eyebrow">Semantic input · untouched</p>
          <h2>{fixture.corrections.length} corrections enter. One scene leaves.</h2>
        </div>
        <pre><code data-testid="layout-corrections">{JSON.stringify(fixture.corrections, null, 2)}</code></pre>
      </section>
    </main>
  );
}

export function renderLayoutLab(container: HTMLElement): void {
  createRoot(container).render(
    <StrictMode>
      <LayoutLab />
    </StrictMode>,
  );
}
