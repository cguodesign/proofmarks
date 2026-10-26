// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  createTextPointRange,
  createTextRange,
  getSourceTextLength,
} from "./range";

describe("createTextRange", () => {
  it("resolves offsets across ordinary nested text nodes", () => {
    const container = document.createElement("div");
    container.innerHTML = "吾輩は猫である。<em>名前</em>はまだ無い。";

    const range = createTextRange(container, {
      kind: "text-range",
      start: 8,
      end: 10,
    });

    expect(range.toString()).toBe("名前");
  });

  it("resolves one range across plain and emphasized text nodes", () => {
    const container = document.createElement("div");
    container.innerHTML = "The <em>editor</em> reviewed the manuscript.";

    const range = createTextRange(container, {
      kind: "text-range",
      start: 0,
      end: 10,
    });

    expect(range.toString()).toBe("The editor");
    expect(range.startContainer).toBe(container.firstChild);
    expect(range.endContainer).toBe(container.querySelector("em")?.firstChild);
  });

  it("excludes the proofmarks overlay from source offsets", () => {
    const container = document.createElement("div");
    container.textContent = "本文";
    const overlay = document.createElement("svg");
    overlay.dataset.proofmarksOverlay = "";
    overlay.textContent = "トル";
    container.append(overlay);

    expect(getSourceTextLength(container)).toBe(2);
  });

  it("resolves an insertion as a collapsed point instead of a fake range", () => {
    const container = document.createElement("div");
    container.textContent = "名前";

    const range = createTextPointRange(container, {
      kind: "text-point",
      offset: 1,
    });

    expect(range.collapsed).toBe(true);
    expect(range.startOffset).toBe(1);
  });

  it("resolves precomposed Hangul and Korean punctuation with UTF-16 offsets", () => {
    const container = document.createElement("div");
    container.textContent = "문장을 교정한다.";

    expect(
      createTextRange(container, { kind: "text-range", start: 4, end: 7 }).toString(),
    ).toBe("교정한");
    expect(
      createTextRange(container, { kind: "text-range", start: 7, end: 9 }).toString(),
    ).toBe("다.");
  });

  it("keeps Hangul, Latin, and numeric segments aligned to DOM UTF-16 units", () => {
    const container = document.createElement("div");
    container.innerHTML = "교정 <em>Proof</em> 2026.";

    expect(getSourceTextLength(container)).toBe(14);
    expect(
      createTextRange(container, { kind: "text-range", start: 3, end: 8 }).toString(),
    ).toBe("Proof");
    expect(
      createTextRange(container, { kind: "text-range", start: 9, end: 13 }).toString(),
    ).toBe("2026");
  });

  it("preserves whitespace-sensitive English word ranges exactly", () => {
    const container = document.createElement("div");
    container.textContent = "The editor very carefully reviewed.";

    expect(
      createTextRange(container, { kind: "text-range", start: 11, end: 15 }).toString(),
    ).toBe("very");
    expect(
      createTextRange(container, { kind: "text-range", start: 11, end: 16 }).toString(),
    ).toBe("very ");
  });

  it("resolves curly quotes, an em dash, apostrophes, and accented Latin", () => {
    const container = document.createElement("div");
    container.textContent = "“Café”—editor’s proof.";

    expect(
      createTextRange(container, { kind: "text-range", start: 1, end: 5 }).toString(),
    ).toBe("Café");
    expect(
      createTextRange(container, { kind: "text-range", start: 7, end: 15 }).toString(),
    ).toBe("editor’s");
    expect(
      createTextRange(container, { kind: "text-range", start: 16, end: 21 }).toString(),
    ).toBe("proof");
  });

  it("keeps punctuation insertion as a true collapsed text position", () => {
    const container = document.createElement("div");
    container.textContent = "After review the editor approved it.";
    const range = createTextPointRange(container, {
      kind: "text-point",
      offset: 12,
    });

    expect(range.collapsed).toBe(true);
    expect(range.startContainer.textContent?.slice(0, range.startOffset)).toBe(
      "After review",
    );
  });
});
