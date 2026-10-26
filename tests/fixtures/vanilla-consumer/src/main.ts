import { createProofmarks, type Correction } from "proofmarks";
import { gb, jis } from "proofmarks/notations";
import "proofmarks/styles.css";

const element = document.querySelector<HTMLElement>("#proof");
if (!element) throw new Error("Missing proof element.");

const corrections = [
  {
    id: "delete-editor",
    type: "delete",
    target: { kind: "text-range", start: 4, end: 10 },
  },
] as const satisfies readonly Correction[];

const proofmarks = createProofmarks(element, {
  notation: jis,
  corrections,
  appearance: "editorial",
  markStyle: { ink: "#173b63", strokeScale: 1.15 },
});

document.querySelector("#use-gb")?.addEventListener("click", () => {
  proofmarks.update({
    notation: gb,
    corrections,
    appearance: "editorial",
    markStyle: { ink: "#173b63", strokeScale: 1.15 },
  });
});

document.querySelector("#destroy")?.addEventListener("click", () => {
  proofmarks.destroy();
});

window.addEventListener("pagehide", () => proofmarks.destroy(), { once: true });
