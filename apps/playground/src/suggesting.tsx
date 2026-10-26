import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Correction,
  NotationPack,
  ProofmarksAppearance,
  ProofmarksIssue,
  ProofmarksMarkStyle,
} from "proofmarks";
import { cns3927, enUS, gb, jis, ks } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";
import { SuggestingEditor, type SuggestingEditorHandle } from "./suggesting/editor";
import { SiteFooter, SiteHeader } from "./site-ui";
import {
  acceptSuggestion,
  activeCorrections,
  applyDraftEdit,
  createSuggestingState,
  describeCorrection,
  draftText,
  rejectSuggestion,
  setAcceptedText,
  suggestionOwnership,
  transposeSelection,
  type DraftEdit,
  type SuggestingState,
} from "./suggesting/model";

type NotationId = "jis" | "gb" | "cns3927" | "ks" | "enUS";
type DemoPresetId = "replace-insert" | "delete-transpose" | "spacing";
type MarkThemeId = "canonical" | "high-contrast";

const notations: Record<NotationId, NotationPack> = { jis, gb, cns3927, ks, enUS };
const notationLabels: Record<NotationId, string> = {
  jis: "日本 · JIS",
  gb: "中文 · GB",
  cns3927: "臺灣 · CNS 3927",
  ks: "한국 · KS",
  enUS: "English · US",
};

const notationRenderLabels: Record<NotationId, string> = {
  jis: "JIS",
  gb: "GB",
  cns3927: "CNS 3927",
  ks: "KS",
  enUS: "English · US",
};

const INSPECTION_HIGHLIGHT = "proofmarks-suggestion-target";

const markThemes = {
  canonical: {
    label: "Canonical ink",
    description: "Pack-calibrated presentation with the default proofreader ink.",
    style: undefined,
  },
  "high-contrast": {
    label: "High contrast blue",
    description: "Presentation only · the notation grammar and geometry do not change.",
    style: {
      ink: "#173b63",
      labelInk: "#102a43",
      strokeScale: 1.15,
    },
  },
} as const satisfies Record<MarkThemeId, {
  label: string;
  description: string;
  style: ProofmarksMarkStyle | undefined;
}>;

function inspectedCorrectionRanges(
  proof: HTMLElement,
  correction: Correction,
  corrections: readonly Correction[],
): Range[] {
  const direct = correction.type === "cancel-correction"
    ? corrections.find(({ id }) => id === correction.target.correctionId)
    : correction;
  if (!direct || direct.type === "cancel-correction") return [];
  const sourceText = proof.textContent ?? "";
  const targets = direct.type === "transpose"
    ? direct.targets
    : direct.type === "move"
      ? [direct.source]
      : direct.target.kind === "text-range"
        ? [direct.target]
        : [{
            kind: "text-range" as const,
            start: Math.min(direct.target.offset, Math.max(0, sourceText.length - 1)),
            end: Math.min(sourceText.length, Math.max(1, direct.target.offset + 1)),
          }];
  const sourceNodes: Text[] = [];
  const walker = document.createTreeWalker(proof, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest("[data-proofmarks-overlay]")) continue;
    sourceNodes.push(node);
  }
  const locate = (offset: number) => {
    let cursor = 0;
    for (const node of sourceNodes) {
      const next = cursor + node.data.length;
      if (offset <= next) return { node, offset: Math.max(0, offset - cursor) };
      cursor = next;
    }
    const node = sourceNodes.at(-1);
    return node ? { node, offset: node.data.length } : null;
  };
  return targets.flatMap((target) => {
    const start = locate(target.start);
    const end = locate(target.end);
    if (!start || !end) return [];
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return [range];
  });
}

const demoPresets = {
  "replace-insert": {
    label: "Replace + insert",
    description: "Change editor to writer, then insert new before manuscript.",
    acceptedText: "The editor carefully reviewed the manuscript.",
    corrections: [
      {
        id: "preset-replace-editor",
        type: "replace",
        target: { kind: "text-range", start: 4, end: 10 },
        replacement: "writer",
      },
      {
        id: "preset-insert-new",
        type: "insert",
        target: { kind: "text-point", offset: 34 },
        content: "new ",
      },
    ],
  },
  "delete-transpose": {
    label: "Delete + transpose",
    description: "Remove carefully, then exchange final and manuscript.",
    acceptedText: "The editor carefully reviewed the final manuscript.",
    corrections: [
      {
        id: "preset-delete-carefully",
        type: "delete",
        target: { kind: "text-range", start: 11, end: 21 },
      },
      {
        id: "preset-transpose-ending",
        type: "transpose",
        targets: [
          { kind: "text-range", start: 34, end: 39 },
          { kind: "text-range", start: 40, end: 50 },
        ],
      },
    ],
  },
  spacing: {
    label: "Open + close spacing",
    description: "Open one text boundary and close three existing spaces.",
    acceptedText: "Set thisphrase    with uneven spacing.",
    corrections: [
      {
        id: "preset-open-boundary",
        type: "increase-spacing",
        target: { kind: "text-point", offset: 8 },
      },
      {
        id: "preset-close-whitespace",
        type: "decrease-spacing",
        target: { kind: "text-range", start: 14, end: 17 },
      },
    ],
  },
} as const satisfies Record<DemoPresetId, {
  label: string;
  description: string;
  acceptedText: string;
  corrections: readonly Correction[];
}>;

function stateForPreset(id: DemoPresetId): SuggestingState {
  const preset = demoPresets[id];
  return createSuggestingState(preset.acceptedText, preset.corrections);
}

function SuggestingWorkbench() {
  const [mode, setMode] = useState<"editing" | "suggesting">("suggesting");
  const [notationId, setNotationId] = useState<NotationId>("enUS");
  const [presetId, setPresetId] = useState<DemoPresetId>("replace-insert");
  const [suggesting, setSuggesting] = useState<SuggestingState>(() =>
    stateForPreset("replace-insert"),
  );
  const [message, setMessage] = useState("Try editing the working copy, or review the two suggestions below.");
  const [issue, setIssue] = useState<ProofmarksIssue | null>(null);
  const [appearance, setAppearance] = useState<ProofmarksAppearance>("editorial");
  const [customStrokeScale, setCustomStrokeScale] = useState<number | undefined>(undefined);
  const [markThemeId, setMarkThemeId] = useState<MarkThemeId>("canonical");
  const [showProofmarks, setShowProofmarks] = useState(true);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [markPhase, setMarkPhase] = useState<"visible" | "fading-out" | "fading-in" | "hidden">("visible");
  const [inspection, setInspection] = useState<{ id: string; nonce: number } | null>(null);
  const stateRef = useRef(suggesting);
  const editorRef = useRef<SuggestingEditorHandle | null>(null);
  const proofStageRef = useRef<HTMLDivElement | null>(null);
  const markTimerRef = useRef<number | null>(null);
  const markFrameRef = useRef<number | null>(null);
  const inspectionTimerRef = useRef<number | null>(null);
  stateRef.current = suggesting;

  const notation = notations[notationId];
  const markTheme = markThemes[markThemeId];
  const strokeScale = customStrokeScale ?? markTheme.style?.strokeScale ?? 1;
  const markStyle = { ...markTheme.style, strokeScale };
  const draft = draftText(suggesting);
  const active = activeCorrections(suggesting);
  const cancellations = suggesting.corrections.filter(
    (correction) => correction.type === "cancel-correction",
  );
  const historyCount = suggesting.corrections.length - active.length;
  const correctionJson = JSON.stringify(suggesting.corrections, null, 2);
  const ownershipJson = JSON.stringify(suggestionOwnership(suggesting), null, 2);

  useEffect(() => {
    document.title = "Playground — proofmarks";
  }, []);

  useEffect(() => () => {
    if (markTimerRef.current !== null) window.clearTimeout(markTimerRef.current);
    if (markFrameRef.current !== null) window.cancelAnimationFrame(markFrameRef.current);
    if (inspectionTimerRef.current !== null) window.clearTimeout(inspectionTimerRef.current);
  }, []);

  useEffect(() => {
    const proof = proofStageRef.current?.querySelector<HTMLElement>(".suggest-proof");
    const registry = (CSS as unknown as {
      highlights?: { set(name: string, highlight: unknown): void; delete(name: string): void };
    }).highlights;
    const HighlightConstructor = (window as unknown as {
      Highlight?: new (...ranges: Range[]) => unknown;
    }).Highlight;
    registry?.delete(INSPECTION_HIGHLIGHT);
    proof?.removeAttribute("data-inspection-active");
    proof?.querySelectorAll("[data-correction-id][data-inspected]").forEach((group) => {
      group.removeAttribute("data-inspected");
    });
    if (!inspection || !proof) return;
    const correction = suggesting.corrections.find(({ id }) => id === inspection.id);
    const group = proof.querySelector<SVGGElement>(
      `[data-correction-id="${CSS.escape(inspection.id)}"]`,
    );
    if (!correction || !group) return;
    proof.dataset.inspectionActive = "true";
    group.dataset.inspected = "true";
    const ranges = inspectedCorrectionRanges(proof, correction, suggesting.corrections);
    if (registry && HighlightConstructor && ranges.length > 0) {
      registry.set(INSPECTION_HIGHLIGHT, new HighlightConstructor(...ranges));
    }
    inspectionTimerRef.current = window.setTimeout(() => setInspection(null), 1100);
    return () => {
      registry?.delete(INSPECTION_HIGHLIGHT);
      if (inspectionTimerRef.current !== null) window.clearTimeout(inspectionTimerRef.current);
    };
  }, [inspection, suggesting.corrections, notationId]);

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clearMarkMotion = () => {
    if (markTimerRef.current !== null) window.clearTimeout(markTimerRef.current);
    if (markFrameRef.current !== null) window.cancelAnimationFrame(markFrameRef.current);
    markTimerRef.current = null;
    markFrameRef.current = null;
  };

  const revealMarkLayer = () => {
    setOverlayEnabled(true);
    if (prefersReducedMotion()) {
      setMarkPhase("visible");
      return;
    }
    setMarkPhase("fading-in");
    markFrameRef.current = window.requestAnimationFrame(() => {
      markFrameRef.current = window.requestAnimationFrame(() => setMarkPhase("visible"));
    });
  };

  const toggleProofmarks = () => {
    clearMarkMotion();
    if (showProofmarks) {
      setShowProofmarks(false);
      setMessage("Proofmarks hidden · accepted text and correction data are unchanged.");
      if (prefersReducedMotion()) {
        setOverlayEnabled(false);
        setMarkPhase("hidden");
      } else {
        setMarkPhase("fading-out");
        markTimerRef.current = window.setTimeout(() => {
          setOverlayEnabled(false);
          setMarkPhase("hidden");
        }, 190);
      }
      return;
    }
    setShowProofmarks(true);
    setMessage(`Same correction data · rendered as ${notationRenderLabels[notationId]}.`);
    revealMarkLayer();
  };

  const chooseNotation = (id: NotationId) => {
    if (id === notationId) return;
    clearMarkMotion();
    const applyNotation = () => {
      setNotationId(id);
      setIssue(null);
      setMessage(`Same correction data · rendered as ${notationRenderLabels[id]}.`);
      if (showProofmarks) revealMarkLayer();
      else setMarkPhase("hidden");
    };
    if (!showProofmarks || prefersReducedMotion()) {
      applyNotation();
      return;
    }
    setMarkPhase("fading-out");
    markTimerRef.current = window.setTimeout(applyNotation, 100);
  };

  const inspectSuggestion = (correction: Parameters<typeof describeCorrection>[0]) => {
    proofStageRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "instant" : "smooth", block: "nearest",
    });
    setInspection({ id: correction.id, nonce: Date.now() });
    setMessage(`Inspecting ${describeCorrection(correction, suggesting.acceptedText)}.`);
  };

  const commitResult = (
    result: ReturnType<typeof applyDraftEdit>,
    successMessage: string,
  ): boolean => {
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    stateRef.current = result.state;
    setSuggesting(result.state);
    setMessage(successMessage);
    setIssue(null);
    return true;
  };

  const handleSuggest = (edit: DraftEdit): boolean =>
    commitResult(
      applyDraftEdit(stateRef.current, edit),
      edit.inputType === "insertCompositionText"
        ? "Composition committed as one suggestion."
        : "Suggestion added to the proof.",
    );

  const loadPreset = (nextId: DemoPresetId) => {
    const next = stateForPreset(nextId);
    stateRef.current = next;
    setPresetId(nextId);
    setSuggesting(next);
    setMode("suggesting");
    setMessage(`${demoPresets[nextId].label} demo loaded.`);
    setIssue(null);
  };

  const resetDemo = () => loadPreset(presetId);

  const clearSuggestions = () => {
    const next = createSuggestingState(suggesting.acceptedText);
    stateRef.current = next;
    setSuggesting(next);
    setMessage("Suggestions cleared. You can start a new edit.");
    setIssue(null);
  };

  const chooseMode = (nextMode: "editing" | "suggesting") => {
    if (nextMode === mode) return;
    if (nextMode === "editing" && suggesting.corrections.length > 0) {
      const committed = setAcceptedText(suggesting, draft);
      stateRef.current = committed;
      setSuggesting(committed);
      setMessage("Pending suggestions accepted. Direct editing is on.");
    } else {
      setMessage(nextMode === "suggesting" ? "Suggesting is on." : "Direct editing is on.");
    }
    setMode(nextMode);
  };

  const review = (id: string, action: "accept" | "reject") => {
    const result =
      action === "accept"
        ? acceptSuggestion(stateRef.current, id)
        : rejectSuggestion(stateRef.current, id);
    commitResult(
      result,
      action === "accept"
        ? "Suggestion accepted. Original text updated."
        : "Suggestion rejected. Original wording kept.",
    );
  };

  const createTranspose = () => {
    const selection = editorRef.current?.selection() ?? { from: 0, to: 0 };
    const result = transposeSelection(stateRef.current, selection.from, selection.to);
    commitResult(result, "Selected words marked for exchange.");
  };

  return (
    <div className="suggest-shell public-site">
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <header className="suggest-masthead">
          <div>
            <p className="small-label">Playground</p>
            <h1>Edit the text. Inspect the proof.</h1>
          </div>
          <div className="suggest-intro">
            <p>Choose an example, then edit or review its corrections.</p>
          </div>
        </header>

        <section className="suggest-example-bar" aria-label="Example controls">
          <div className="suggest-select-field">
                <label htmlFor="demo-preset">Example</label>
            <select id="demo-preset" value={presetId}
              onChange={(event) => loadPreset(event.target.value as DemoPresetId)}>
              {(Object.keys(demoPresets) as DemoPresetId[]).map((id) => (
                <option key={id} value={id}>{demoPresets[id].label}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={resetDemo}>Reset example</button>
        </section>

        <div className="suggest-workbench">
          <section id="proof-stage" className="suggest-pane suggest-proof-pane"
            aria-labelledby="proof-title" data-mark-phase={markPhase}>
            <header className="suggest-pane-header">
              <h2 id="proof-title">Accepted proof</h2>
              <button className="suggest-compare-action" type="button"
                aria-pressed={showProofmarks} onClick={toggleProofmarks}>
                {showProofmarks ? "Hide proofmarks" : "Show proofmarks"}
              </button>
            </header>
            <div className="suggest-pane-tools">
              <div className="suggest-select-field">
                <label htmlFor="proof-notation">Notation</label>
                <select id="proof-notation" value={notationId}
                  onChange={(event) => chooseNotation(event.target.value as NotationId)}>
                  {(Object.keys(notations) as NotationId[]).map((id) => (
                    <option key={id} value={id}>{notationLabels[id]}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="suggest-pane-note">Original text with your suggested changes marked.</p>
            <div className="suggest-proof-stage" ref={proofStageRef}>
              <Proofmarks as="article" className={`suggest-proof suggest-proof--${appearance}`}
                notation={notation} corrections={suggesting.corrections} appearance={appearance}
                showProofmarks={overlayEnabled} markStyle={markStyle} lang="en" onIssue={setIssue}>
                {suggesting.acceptedText}
              </Proofmarks>
            </div>
            <details className="suggest-marker-style">
              <summary>Marker style</summary>
              <div className="suggest-marker-style-body">
                <div className="suggest-select-field">
                <label htmlFor="proof-appearance">Appearance</label>
                  <select id="proof-appearance" value={appearance}
                    onChange={(event) => setAppearance(event.target.value as ProofmarksAppearance)}>
                    <option value="editorial">Editorial</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <div className="suggest-select-field">
                <label htmlFor="proof-ink">Ink</label>
                  <select id="proof-ink" value={markThemeId} onChange={(event) => {
                    setMarkThemeId(event.target.value as MarkThemeId);
                    setIssue(null);
                  }}>
                    <option value="canonical">Proofreader red</option>
                    <option value="high-contrast">High contrast blue</option>
                  </select>
                </div>
                <label className="suggest-stroke-control">
                  <span>Line weight</span>
                  <input type="range" min="0.75" max="1.5" step="0.05"
                    value={strokeScale} aria-valuetext={`${Math.round(strokeScale * 100)}%`}
                    onChange={(event) => setCustomStrokeScale(event.currentTarget.valueAsNumber)} />
                  <output>{Math.round(strokeScale * 100)}%</output>
                </label>
              </div>
            </details>
            <details className="suggest-proof-details">
              <summary>Proof data</summary>
              <div className="suggest-proof-contract">
                <span>Accepted text</span><code>{suggesting.acceptedText.length} UTF-16 units</code>
                <span>Corrections</span><code data-testid="proof-corrections-total">{suggesting.corrections.length}</code>
                <span>Active</span><code data-testid="proof-active">{active.length}</code>
                <span>History</span><code data-testid="proof-history">{historyCount}</code>
              </div>
            </details>
            {issue ? <p className="suggest-issue">{issue.code}: {issue.message}</p> : null}
          </section>

          <section className="suggest-pane suggest-draft-pane" aria-labelledby="draft-title">
            <header className="suggest-pane-header">
              <h2 id="draft-title">Working copy</h2>
            </header>
            <div className="suggest-pane-tools">
              <div className="suggest-select-field">
                <label htmlFor="edit-mode">Edit mode</label>
                <select id="edit-mode" value={mode} aria-describedby="edit-mode-help"
                  onChange={(event) => chooseMode(event.target.value as "editing" | "suggesting")}>
                  <option value="suggesting">Suggest changes</option>
                  <option value="editing">Edit directly</option>
                </select>
              </div>
            </div>
            <p className="suggest-pane-note" id="edit-mode-help">
              {mode === "suggesting" ? "Suggest changes for review. Direct editing accepts pending suggestions." : "Your edits update the original text immediately."}
            </p>
            <SuggestingEditor ref={editorRef}
              value={mode === "suggesting" ? draft : suggesting.acceptedText}
              mode={mode} language="en" ariaDescribedBy="edit-mode-help working-copy-safety"
              onSuggest={handleSuggest}
              onDirectEdit={(text) => {
                const next = setAcceptedText(stateRef.current, text);
                stateRef.current = next;
                setSuggesting(next);
                setMessage("Original text updated.");
              }} />
            <div className="suggest-editor-actions">
              <button type="button" onClick={createTranspose} disabled={mode !== "suggesting"}>
                Transpose selection
              </button>
              <details className="suggest-more-actions">
                <summary>More</summary>
                <button type="button" onClick={clearSuggestions}>Clear suggestions</button>
              </details>
            </div>
            <p className="suggest-editor-help" id="working-copy-safety">To edit across an existing suggestion, accept or reject it first.</p>
          </section>
        </div>
        <p className="suggest-status" role="status">{message}</p>

      <section className="suggest-review" aria-labelledby="suggestions-title">
        <header className="suggest-review-header">
          <div>
            <h2 id="suggestions-title">Suggestions</h2>
          </div>
          <span>{active.length} to review</span>
        </header>
        <div className="suggest-review-body">
          {active.length > 0 ? (
            <ol className="suggest-list">
              {active.map((correction) => (
                <li key={correction.id} data-suggestion-id={correction.id}>
                  <span className="suggest-index">{String(active.indexOf(correction) + 1).padStart(2, "0")}</span>
                  <button
                    className="suggest-inspect-target"
                    type="button"
                    aria-pressed={inspection?.id === correction.id}
                    onClick={() => inspectSuggestion(correction)}
                  >
                    <strong>{describeCorrection(correction, suggesting.acceptedText)}</strong>
                    <span>Locate in proof</span>
                  </button>
                  <div className="suggest-review-actions">
                    <button type="button" onClick={() => review(correction.id, "accept")} aria-label={`Accept ${correction.id}`}>Accept</button>
                    <button type="button" onClick={() => review(correction.id, "reject")} aria-label={`Reject ${correction.id}`}>Reject</button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="suggest-empty">
              <strong>The proof is settled.</strong>
              <span>Choose Suggest changes in the working copy to make another edit.</span>
            </div>
          )}
          <details className="suggest-semantic-compact" aria-label="Semantic correction data">
            <summary>Correction data</summary>
            <pre><code data-testid="preset-semantic-corrections">{correctionJson}</code></pre>
          </details>
        </div>
      </section>

      <details className="suggest-inspector">
        <summary>Inspect adapter state</summary>
        <div className="suggest-inspector-grid">
          <section>
            <h3>accepted text</h3>
            <pre><code data-testid="accepted-text">{suggesting.acceptedText}</code></pre>
          </section>
          <section>
            <h3>draft text</h3>
            <pre><code data-testid="draft-text">{draft}</code></pre>
          </section>
          <section className="suggest-inspector-wide">
            <h3>semantic corrections</h3>
            <pre><code data-testid="semantic-corrections">{correctionJson}</code></pre>
          </section>
          <section className="suggest-inspector-wide">
            <h3>suggestion identity · internal ownership</h3>
            <pre><code data-testid="suggestion-ownership">{ownershipJson}</code></pre>
          </section>
          <section>
            <h3>active suggestions</h3>
            <pre><code>{JSON.stringify(active.map((correction) => correction.id), null, 2)}</code></pre>
          </section>
          <section>
            <h3>historical cancel-corrections</h3>
            <pre><code>{JSON.stringify(cancellations, null, 2)}</code></pre>
          </section>
        </div>
        </details>
      </main>
      <SiteFooter />
    </div>
  );
}

export function renderSuggestingWorkbench(container: HTMLElement): void {
  createRoot(container).render(
    <StrictMode>
      <SuggestingWorkbench />
    </StrictMode>,
  );
}
