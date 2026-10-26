import { siteHref } from "./site-path";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Correction, NotationPack, ProofmarksIssue } from "proofmarks";
import { cns3927, enUS, gb, jis, ks } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";

type NotationChoice = "jis" | "gb" | "cns3927" | "ks" | "enUS";

const notationChoices: Record<NotationChoice, NotationPack> = {
  jis,
  gb,
  cns3927,
  ks,
  enUS,
};

const notationLabels: Record<NotationChoice, string> = {
  jis: "JIS",
  gb: "GB",
  cns3927: "CNS 3927",
  ks: "KS",
  enUS: "en-US",
};

const content = "吾輩は猫である。名前はまだ無い。";

const primaryCorrection: Correction = {
  id: "c1",
  type: "delete",
  target: { kind: "text-range", start: 8, end: 10 },
};

const additionalCorrection: Correction = {
  id: "c2",
  type: "insert",
  target: { kind: "text-point", offset: 11 },
  content: "今",
};

const proofWidths = [620, 460, 320] as const;

function DeveloperExperience() {
  const [notationId, setNotationId] = useState<NotationChoice>("jis");
  const [corrections, setCorrections] = useState<readonly Correction[]>([
    primaryCorrection,
  ]);
  const [widthIndex, setWidthIndex] = useState(0);
  const [issue, setIssue] = useState<ProofmarksIssue | null>(null);
  const notation = notationChoices[notationId];
  const proofWidth = proofWidths[widthIndex]!;
  const correctionJson = JSON.stringify(corrections, null, 2);

  return (
    <main className="dx-shell" id="proof-stage">
      <header className="dx-masthead">
        <div>
          <p className="eyebrow">Task 006 · hero validation</p>
          <h1>Describe the edit.<br />Change the grammar.</h1>
        </div>
        <div className="dx-intro">
          <p>
            The correction stays plain data. React receives new props. The selected
            notation decides how the mark appears.
          </p>
          <nav className="route-links" aria-label="Engineering views">
            <a className="text-link" href={siteHref("/suggest")}>Suggesting editor</a>
            <a className="text-link" href={siteHref("/workbench")}>Workbench</a>
            <a className="text-link" href={siteHref("/marks")}>Mark atlas</a>
          </nav>
        </div>
      </header>

      <div className="dx-hero">
        <section className="dx-input" aria-label="Proofmarks inputs">
          <div className="dx-input-heading">
            <span>01</span>
            <div>
              <p className="eyebrow">React props</p>
              <h2>Three inputs. Nothing geometric.</h2>
            </div>
          </div>

          <section className="dx-field" aria-labelledby="dx-content-title">
            <div className="dx-field-title">
              <h3 id="dx-content-title">content</h3>
              <span>UTF-16 · 16 units</span>
            </div>
            <p className="dx-content-value" lang="ja">{content}</p>
          </section>

          <section className="dx-field" aria-labelledby="dx-corrections-title">
            <div className="dx-field-title">
              <h3 id="dx-corrections-title">corrections</h3>
              <span>{corrections.length} active</span>
            </div>
            <pre className="dx-json"><code>{correctionJson}</code></pre>
            <div className="dx-action-row">
              <button
                type="button"
                disabled={corrections.length > 1}
                onClick={() => {
                  setIssue(null);
                  setCorrections((current) => [...current, additionalCorrection]);
                }}
              >
                Add correction
              </button>
              <button
                type="button"
                disabled={corrections.length === 1}
                onClick={() => {
                  setIssue(null);
                  setCorrections([primaryCorrection]);
                }}
              >
                Remove correction
              </button>
            </div>
          </section>

          <section className="dx-field" aria-labelledby="dx-notation-title">
            <div className="dx-field-title">
              <h3 id="dx-notation-title">notation</h3>
              <span>renderer object</span>
            </div>
            <div className="dx-notation-switch" role="group" aria-label="Notation">
              {(Object.keys(notationChoices) as NotationChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={choice === notationId}
                  onClick={() => {
                    setIssue(null);
                    setNotationId(choice);
                  }}
                >
                  {notationLabels[choice]}
                </button>
              ))}
            </div>
          </section>

          <button
            className="dx-width-control"
            type="button"
            onClick={() => setWidthIndex((current) => (current + 1) % proofWidths.length)}
          >
            <span>Change text width</span>
            <strong>{proofWidth}px</strong>
          </button>
        </section>

        <section className="dx-output" aria-labelledby="dx-result-title">
          <header className="dx-output-heading">
            <div>
              <p className="eyebrow">02 · rendered result</p>
              <h2 id="dx-result-title">Same intent.<br />Different mark.</h2>
            </div>
            <span className="dx-live-indicator"><i /> React live</span>
          </header>

          <div className="dx-proof-stage">
            <Proofmarks
              as="article"
              notation={notation}
              corrections={corrections}
              className="dx-proof"
              style={{ width: proofWidth }}
              lang="ja"
              onIssue={setIssue}
            >
              吾輩は猫である。名前はまだ無い。
            </Proofmarks>
          </div>

          <div className="dx-output-meta">
            <div>
              <span>notation</span>
              <strong>{notationId}</strong>
            </div>
            <div>
              <span>pack</span>
              <strong>{notation.displayName}</strong>
            </div>
            <div>
              <span>corrections</span>
              <strong>{corrections.length}</strong>
            </div>
          </div>

          <code className="dx-prop-line">
            {`<Proofmarks notation={${notationId}} corrections={corrections}>`}
          </code>

          {issue ? (
            <p className="dx-issue" role="status">{issue.code}: {issue.message}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function renderDeveloperExperience(container: HTMLElement): void {
  createRoot(container).render(<DeveloperExperience />);
}
