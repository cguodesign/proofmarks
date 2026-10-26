// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cns3927, enUS, gb, jis, ks } from "./notations";
import { createProofmarks, type ProofmarksIssue } from "./index";
import type { Correction } from "./schema";

class TestResizeObserver {
  static active = 0;
  private observing = false;

  constructor(_callback: ResizeObserverCallback) {}
  observe(): void {
    if (this.observing) return;
    this.observing = true;
    TestResizeObserver.active += 1;
  }
  disconnect(): void {
    if (!this.observing) return;
    this.observing = false;
    TestResizeObserver.active -= 1;
  }
  unobserve(): void {}
}

class TestMutationObserver {
  static active = 0;
  private observing = false;

  constructor(_callback: MutationCallback) {}
  observe(): void {
    if (this.observing) return;
    this.observing = true;
    TestMutationObserver.active += 1;
  }
  disconnect(): void {
    if (!this.observing) return;
    this.observing = false;
    TestMutationObserver.active -= 1;
  }
  takeRecords(): MutationRecord[] {
    return [];
  }
}

const sourceRect = new DOMRect(24, 32, 42, 24);

beforeEach(() => {
  TestResizeObserver.active = 0;
  TestMutationObserver.active = 0;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.stubGlobal("MutationObserver", TestMutationObserver);
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      ready: Promise.resolve(),
      addEventListener(): void {},
      removeEventListener(): void {},
    },
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [sourceRect],
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 480, 180),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  Reflect.deleteProperty(document, "fonts");
});

describe("createProofmarks visibility", () => {
  it("skips equal updates including new callbacks and normalized inline styles", () => {
    const element = document.createElement("p");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);
    const corrections = [{ id: "word", type: "replace", target: { kind: "text-range", start: 4, end: 10 }, replacement: "writer" }] as const;
    const firstRender = vi.fn();
    const nextRender = vi.fn();
    const instance = createProofmarks(element, { notation: enUS, corrections, markStyle: { ink: " red " }, onRender: firstRender });
    const mark = element.querySelector("[data-correction-id]");
    const reordered = [{ replacement: "writer", target: { end: 10, start: 4, kind: "text-range" }, type: "replace", id: "word" }] as const;
    instance.update({ notation: enUS, corrections: reordered, markStyle: { ink: "red" }, onRender: nextRender });
    expect(element.querySelector("[data-correction-id]")).toBe(mark);
    expect(firstRender).toHaveBeenCalledTimes(1);
    expect(nextRender).not.toHaveBeenCalled();
    instance.update({ notation: jis, corrections, onRender: nextRender });
    expect(nextRender).toHaveBeenCalledTimes(1);
    expect(nextRender).toHaveBeenCalledWith(expect.objectContaining({ fallbackCount: expect.any(Number), layoutMs: expect.any(Number) }));
    instance.destroy();
  });

  it("defaults to visible and toggles the existing overlay without touching source state", () => {
    const element = document.createElement("article");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);
    const sourceNode = element.firstChild!;
    const corrections = [
      {
        id: "delete-editor",
        type: "delete",
        target: { kind: "text-range", start: 4, end: 10 },
      },
    ] as const satisfies readonly Correction[];
    const instance = createProofmarks(element, { notation: enUS, corrections });
    const overlay = element.querySelector<SVGSVGElement>("[data-proofmarks-overlay]")!;
    const correctionGroup = element.querySelector<SVGGElement>("[data-correction-id]")!;
    const placement = correctionGroup.dataset.layoutCandidate;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(sourceNode, 4);
    range.setEnd(sourceNode, 10);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(overlay.dataset.proofmarksVisible).toBe("true");
    expect(selection.toString()).toBe("editor");

    instance.update({ notation: enUS, corrections, showProofmarks: false });
    expect(element.querySelector("[data-proofmarks-overlay]")).toBe(overlay);
    expect(element.querySelector("[data-correction-id]")).toBe(correctionGroup);
    expect(overlay.style.visibility).toBe("hidden");
    expect(element.firstChild).toBe(sourceNode);
    expect(sourceNode.textContent).toBe("The editor reviewed it.");
    expect(selection.toString()).toBe("editor");

    instance.update({ notation: enUS, corrections, showProofmarks: true });
    expect(element.querySelector("[data-proofmarks-overlay]")).toBe(overlay);
    expect(element.querySelector("[data-correction-id]")).toBe(correctionGroup);
    expect(overlay.style.visibility).toBe("visible");
    expect(correctionGroup.dataset.layoutCandidate).toBe(placement);
    expect(selection.toString()).toBe("editor");

    instance.destroy();
    expect(element.querySelector("[data-proofmarks-overlay]")).toBeNull();
    expect(element.textContent).toBe("The editor reviewed it.");
  });

  it("applies a constrained mark style without changing path geometry", () => {
    const element = document.createElement("article");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);
    const corrections = [{
      id: "replace-editor",
      type: "replace",
      target: { kind: "text-range", start: 4, end: 10 },
      replacement: "writer",
    }] as const satisfies readonly Correction[];
    const instance = createProofmarks(element, { notation: enUS, corrections });
    const overlay = element.querySelector<SVGSVGElement>("[data-proofmarks-overlay]")!;
    const geometryBefore = [...overlay.querySelectorAll<SVGElement>("line, path")].map(
      (mark) => [
        mark.tagName,
        mark.getAttribute("x1"),
        mark.getAttribute("y1"),
        mark.getAttribute("x2"),
        mark.getAttribute("y2"),
        mark.getAttribute("d"),
      ],
    );

    instance.update({
      notation: enUS,
      corrections,
      markStyle: {
        ink: "#173b63",
        labelInk: "#102a43",
        strokeScale: 1.15,
        opacity: 0.9,
      },
    });

    const geometryAfter = [...overlay.querySelectorAll<SVGElement>("line, path")].map(
      (mark) => [
        mark.tagName,
        mark.getAttribute("x1"),
        mark.getAttribute("y1"),
        mark.getAttribute("x2"),
        mark.getAttribute("y2"),
        mark.getAttribute("d"),
      ],
    );
    expect(geometryAfter).toEqual(geometryBefore);
    expect(overlay.style.getPropertyValue("--proofmarks-mark-ink")).toBe("#173b63");
    expect(overlay.style.getPropertyValue("--proofmarks-label-ink")).toBe("#102a43");
    expect(overlay.style.getPropertyValue("--proofmarks-mark-stroke-scale")).toBe("1.15");
    expect(overlay.querySelector("[data-correction-id]")?.getAttribute("opacity"))
      .toBe("var(--proofmarks-mark-opacity)");
    expect(overlay.querySelector('[data-proofmarks-role="replacement-text"]')?.getAttribute("fill"))
      .toBe("var(--proofmarks-label-ink)");
    expect(overlay.querySelector('line[data-proofmarks-role], path[data-proofmarks-role]')?.getAttribute("stroke"))
      .toBe("var(--proofmarks-mark-ink)");

    instance.destroy();
  });

  it("reports and safely normalizes invalid mark style input", () => {
    const element = document.createElement("article");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);
    const corrections = [{
      id: "delete-editor",
      type: "delete",
      target: { kind: "text-range", start: 4, end: 10 },
    }] as const satisfies readonly Correction[];
    const issues: ProofmarksIssue[] = [];
    const instance = createProofmarks(element, {
      notation: enUS,
      corrections,
      markStyle: { ink: "not a color", strokeScale: 9, opacity: -2 },
      onIssue: (issue) => issues.push(issue),
    });
    const overlay = element.querySelector<SVGSVGElement>("[data-proofmarks-overlay]")!;

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid-mark-style-color", property: "ink" }),
      expect.objectContaining({
        code: "mark-style-value-clamped",
        property: "strokeScale",
        appliedValue: 1.5,
      }),
      expect.objectContaining({
        code: "mark-style-value-clamped",
        property: "opacity",
        appliedValue: 0,
      }),
    ]));
    expect(overlay.style.getPropertyValue("--proofmarks-mark-ink")).toBe("");
    expect(overlay.style.getPropertyValue("--proofmarks-mark-stroke-scale")).toBe("1.5");
    expect(overlay.style.getPropertyValue("--proofmarks-mark-opacity")).toBe("0");
    expect(element.textContent).toBe("The editor reviewed it.");
    expect(element.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);

    instance.destroy();
  });

  it("renders adjacent spacing, delete/insert, and neighboring replacement targets", () => {
    const fixtures = [
      {
        text: "Set thisphrase   with care.",
        corrections: [
          {
            id: "open-boundary",
            type: "increase-spacing",
            target: { kind: "text-point", offset: 8 },
          },
          {
            id: "close-three-spaces",
            type: "decrease-spacing",
            target: { kind: "text-range", start: 14, end: 17 },
          },
        ],
      },
      {
        text: "Edit this copy.",
        corrections: [
          {
            id: "delete-this",
            type: "delete",
            target: { kind: "text-range", start: 5, end: 9 },
          },
          {
            id: "insert-that",
            type: "insert",
            target: { kind: "text-point", offset: 9 },
            content: "that",
          },
        ],
      },
      {
        text: "Alpha beta gamma.",
        corrections: [
          {
            id: "replace-alpha",
            type: "replace",
            target: { kind: "text-range", start: 0, end: 5 },
            replacement: "First",
          },
          {
            id: "replace-beta",
            type: "replace",
            target: { kind: "text-range", start: 6, end: 10 },
            replacement: "second",
          },
        ],
      },
      {
        text: "The careful editor reviewed it.",
        corrections: [
          {
            id: "replace-containing-range",
            type: "replace",
            target: { kind: "text-range", start: 4, end: 18 },
            replacement: "writer",
          },
          {
            id: "delete-contained-range",
            type: "delete",
            target: { kind: "text-range", start: 8, end: 15 },
          },
        ],
      },
    ] as const satisfies readonly {
      text: string;
      corrections: readonly Correction[];
    }[];

    for (const fixture of fixtures) {
      const element = document.createElement("article");
      element.textContent = fixture.text;
      document.body.append(element);
      const instance = createProofmarks(element, {
        notation: enUS,
        corrections: fixture.corrections,
      });
      expect(element.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
      expect(
        [...element.querySelectorAll<SVGGElement>("[data-correction-id]")].map(
          (group) => group.dataset.correctionId,
        ),
      ).toEqual(fixture.corrections.map(({ id }) => id));
      expect(element.firstChild?.textContent).toBe(fixture.text);
      instance.destroy();
      element.remove();
    }
  });

  it("rejects decrease-spacing ranges that include non-whitespace source text", () => {
    const element = document.createElement("article");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);

    expect(() =>
      createProofmarks(element, {
        notation: enUS,
        corrections: [{
          id: "close-editor",
          type: "decrease-spacing",
          target: { kind: "text-range", start: 4, end: 10 },
        }],
      }),
    ).toThrow(/existing whitespace only/);
    expect(element.querySelector("[data-proofmarks-overlay]")).toBeNull();
    expect(TestResizeObserver.active).toBe(0);
    expect(TestMutationObserver.active).toBe(0);
    expect(element.hasAttribute("data-proofmarks-root")).toBe(false);
  });

  it("keeps the previous valid scene when an update is rejected", () => {
    const element = document.createElement("article");
    element.textContent = "The editor  reviewed it.";
    document.body.append(element);
    const valid = [{
      id: "close-gap",
      type: "decrease-spacing",
      target: { kind: "text-range", start: 10, end: 12 },
    }] as const satisfies readonly Correction[];
    const instance = createProofmarks(element, { notation: enUS, corrections: valid });
    const overlay = element.querySelector("[data-proofmarks-overlay]");
    const group = element.querySelector("[data-correction-id='close-gap']");

    expect(() => instance.update({
      notation: enUS,
      corrections: [{
        id: "close-word",
        type: "decrease-spacing",
        target: { kind: "text-range", start: 4, end: 10 },
      }],
    })).toThrow(/existing whitespace only/);
    expect(element.querySelector("[data-proofmarks-overlay]")).toBe(overlay);
    expect(element.querySelector("[data-correction-id='close-gap']")).toBe(group);

    instance.destroy();
  });

  it("clears stale marks when the source text changed but keeps them for unchanged text", () => {
    const element = document.createElement("article");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);
    const corrections = [{ id: "editor", type: "delete", target: { kind: "text-range", start: 4, end: 10 } }] as const;
    const instance = createProofmarks(element, { notation: enUS, corrections });
    const invalid = [{ id: "far", type: "delete", target: { kind: "text-range", start: 40, end: 50 } }] as const;
    expect(() => instance.update({ notation: enUS, corrections: invalid })).toThrow(/far/);
    expect(element.querySelector("[data-correction-id='editor']")).not.toBeNull();

    element.firstChild!.textContent = "Hi";
    expect(() => instance.update({ notation: enUS, corrections })).toThrow(/editor/);
    expect(element.querySelector("[data-correction-id]")).toBeNull();
    expect(element.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);

    element.firstChild!.textContent = "The editor returned.";
    instance.update({ notation: enUS, corrections });
    expect(element.querySelector("[data-correction-id='editor']")).not.toBeNull();
    instance.destroy();
  });

  it("re-renders on window resize only when the measured box changed", async () => {
    const element = document.createElement("p");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);
    const onRender = vi.fn();
    const instance = createProofmarks(element, {
      notation: enUS,
      corrections: [{ id: "editor", type: "delete", target: { kind: "text-range", start: 4, end: 10 } }],
      onRender,
    });
    const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    window.dispatchEvent(new Event("resize"));
    await frame();
    expect(onRender).toHaveBeenCalledTimes(1);
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 400, 220));
    window.dispatchEvent(new Event("resize"));
    await frame();
    expect(onRender).toHaveBeenCalledTimes(2);
    instance.destroy();
  });

  it("reports an unverified right-to-left direction once per instance", () => {
    const element = document.createElement("p");
    element.dir = "rtl";
    element.style.direction = "rtl";
    element.textContent = "שלום עולם יפה";
    document.body.append(element);
    const issues: ProofmarksIssue[] = [];
    const corrections = [{ id: "word", type: "delete", target: { kind: "text-range", start: 5, end: 9 } }] as const;
    const instance = createProofmarks(element, { notation: enUS, corrections, onIssue: (issue) => issues.push(issue) });
    instance.update({ notation: jis, corrections, onIssue: (issue) => issues.push(issue) });
    expect(issues.filter((issue) => issue.code === "unverified-direction")).toEqual([
      expect.objectContaining({ code: "unverified-direction", direction: "rtl" }),
    ]);
    expect(element.querySelector("[data-correction-id='word']")).not.toBeNull();
    instance.destroy();

    const ltr = document.createElement("p");
    ltr.textContent = "The editor reviewed it.";
    document.body.append(ltr);
    const ltrIssues: ProofmarksIssue[] = [];
    createProofmarks(ltr, { notation: enUS, corrections, onIssue: (issue) => ltrIssues.push(issue) }).destroy();
    expect(ltrIssues.some((issue) => issue.code === "unverified-direction")).toBe(false);
  });

  it("balances overlays and observers across 100 vanilla mount/destroy cycles", () => {
    const element = document.createElement("article");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);
    const corrections = [{
      id: "delete-editor",
      type: "delete",
      target: { kind: "text-range", start: 4, end: 10 },
    }] as const satisfies readonly Correction[];

    for (let cycle = 0; cycle < 100; cycle += 1) {
      const instance = createProofmarks(element, { notation: enUS, corrections });
      expect(element.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
      instance.destroy();
      expect(element.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(0);
    }
    expect(TestResizeObserver.active).toBe(0);
    expect(TestMutationObserver.active).toBe(0);
  });

  it("switches all five notation packs 100 times without duplicating state", () => {
    const element = document.createElement("article");
    element.textContent = "The editor reviewed it.";
    document.body.append(element);
    const corrections = [{
      id: "delete-editor",
      type: "delete",
      target: { kind: "text-range", start: 4, end: 10 },
    }] as const satisfies readonly Correction[];
    const before = JSON.stringify(corrections);
    const instance = createProofmarks(element, { notation: jis, corrections });
    const packs = [jis, gb, cns3927, ks, enUS] as const;

    for (let cycle = 0; cycle < 100; cycle += 1) {
      instance.update({ notation: packs[cycle % packs.length]!, corrections });
      expect(element.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    }
    expect(JSON.stringify(corrections)).toBe(before);
    expect(TestResizeObserver.active).toBe(1);
    expect(TestMutationObserver.active).toBe(1);

    instance.destroy();
    expect(TestResizeObserver.active).toBe(0);
    expect(TestMutationObserver.active).toBe(0);
  });

  it("renders a 15k UTF-16 source with a modest correction set", () => {
    const element = document.createElement("article");
    element.textContent = "Proof text remains selectable. ".repeat(500);
    document.body.append(element);
    const corrections = Array.from({ length: 10 }, (_, index) => ({
      id: `insert-${index}`,
      type: "insert" as const,
      target: { kind: "text-point" as const, offset: index * 1_000 + 10 },
      content: "note",
    }));

    const instance = createProofmarks(element, { notation: enUS, corrections });
    expect(element.textContent?.length).toBeGreaterThanOrEqual(15_000);
    expect(element.querySelectorAll("[data-correction-id]")).toHaveLength(10);
    expect(element.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    instance.destroy();
  });
});
