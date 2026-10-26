import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Correction,
  ProofmarksAppearance,
  ProofmarksMarkStyle,
} from "proofmarks";
import { gb, jis } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";
import "proofmarks/styles.css";
import "./style.css";

const corrections = [
  {
    id: "delete-name",
    type: "delete",
    target: { kind: "text-range", start: 8, end: 10 },
  },
] as const satisfies readonly Correction[];

const markStyle = {
  ink: "#173b63",
  strokeScale: 1.15,
} as const satisfies ProofmarksMarkStyle;

function App() {
  const [notation, setNotation] = useState(jis);
  const [appearance, setAppearance] = useState<ProofmarksAppearance>("technical");

  return (
    <main>
      <div className="consumer-controls">
        <button type="button" onClick={() => setNotation(jis)}>Use JIS</button>
        <button type="button" onClick={() => setNotation(gb)}>Use GB</button>
        <button type="button" onClick={() => setAppearance("editorial")}>Use Editorial</button>
      </div>
      <Proofmarks
        id="proof"
        as="p"
        notation={notation}
        corrections={corrections}
        appearance={appearance}
        markStyle={markStyle}
        lang="ja"
      >
        吾輩は猫である。名前はまだ無い。
      </Proofmarks>
      <pre id="correction-json">{JSON.stringify(corrections)}</pre>
    </main>
  );
}

const root = document.querySelector("#root");
if (!root) throw new Error("Missing root element.");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
