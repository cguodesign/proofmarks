// @vitest-environment jsdom

import { StrictMode, act, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enUS, gb, jis } from "./notations";
import { Proofmarks } from "./react";
import type { Correction, ProofmarksIssue, ProofmarksMarkStyle } from "./schema";

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

let testFonts: {
  ready: Promise<void>;
  active: number;
  addEventListener(type: string): void;
  removeEventListener(type: string): void;
};

const rect = new DOMRect(20, 24, 18, 24);

beforeEach(() => {
  TestResizeObserver.active = 0;
  TestMutationObserver.active = 0;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.stubGlobal("MutationObserver", TestMutationObserver);
  testFonts = {
    ready: Promise.resolve(),
    active: 0,
    addEventListener(type): void {
      if (type === "loadingdone") this.active += 1;
    },
    removeEventListener(type): void {
      if (type === "loadingdone") this.active -= 1;
    },
  };
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: testFonts,
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [rect],
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

describe("Proofmarks React lifecycle", () => {
  it.each([
    ["object color", () => ({ ink: {} as never })],
    ["array style", () => [] as unknown as ProofmarksMarkStyle],
  ] as const)("settles state-driven diagnostics for malformed JS %s input", async (_name, getStyle) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const reports: ProofmarksIssue[] = [];
    function Host() {
      const [issue, setIssue] = useState<ProofmarksIssue>();
      return <><output>{issue?.code}</output><Proofmarks notation={enUS} corrections={[]}
        markStyle={getStyle()} onIssue={(next) => {
          reports.push(next);
          if (reports.length < 6) setIssue(next);
        }}>The editor reads.</Proofmarks></>;
    }
    try {
      await act(async () => root.render(<Host />));
      expect(reports).toHaveLength(1);
      expect(host.querySelector("output")?.textContent).toBe(reports[0]!.code);
      expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it.each([
    { ink: "not-a-css-color" },
    { strokeScale: 9 },
    { opacity: Number.NaN },
  ] satisfies ProofmarksMarkStyle[])("settles state-driven style diagnostics for %j", async (markStyle) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const reports: ProofmarksIssue[] = [];
    const nextCallback = vi.fn();
    function Host({ value, onReport }: { value: ProofmarksMarkStyle; onReport?: (issue: ProofmarksIssue) => void }) {
      const [issue, setIssue] = useState<ProofmarksIssue>();
      return <>
        <output>{issue?.code}</output>
        <Proofmarks notation={enUS} corrections={[]} markStyle={{ ...value }}
          onIssue={(next) => {
            reports.push(next);
            onReport?.(next);
            // Bound the old failure so this regression cannot hang the suite.
            if (reports.length < 6) setIssue(next);
          }}>
          The editor reads.
        </Proofmarks>
      </>;
    }
    try {
      await act(async () => root.render(<Host value={markStyle} />));
      expect(reports).toHaveLength(1);
      expect(host.querySelector("output")?.textContent).toBe(reports[0]!.code);
      await act(async () => root.render(<Host value={{ ...markStyle }} onReport={nextCallback} />));
      expect(reports).toHaveLength(1);
      expect(nextCallback).not.toHaveBeenCalled();
      await act(async () => root.render(<Host value={{ ink: "red", strokeScale: 1, opacity: 1 }} onReport={nextCallback} />));
      await act(async () => root.render(<Host value={markStyle} onReport={nextCallback} />));
      expect(reports).toHaveLength(2);
      expect(nextCallback).toHaveBeenCalledTimes(1);
      expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps unrelated React content and clears stale marks when text outruns corrections", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const issues = vi.fn();
    const corrections = [{ id: "stale-editor", type: "delete", target: { kind: "text-range", start: 4, end: 10 } }] as const;
    const draw = async (text: string, data = corrections): Promise<void> => {
      await act(async () => root.render(<><h1>Still here</h1><Proofmarks notation={enUS} corrections={data} onIssue={issues}>{text}</Proofmarks></>));
    };
    await draw("The editor reviewed it.");
    const mark = host.querySelector("[data-correction-id]");
    expect(mark).not.toBeNull();
    await draw("The editor reviewed it.", [{ id: "far", type: "delete", target: { kind: "text-range", start: 40, end: 50 } }] as never);
    expect(host.querySelector("[data-correction-id]")).toBe(mark);
    await draw("Hi");
    expect(host.querySelector("h1")?.textContent).toBe("Still here");
    expect(host.querySelector("[data-correction-id]")).toBeNull();
    expect(issues).toHaveBeenCalledWith(expect.objectContaining({ code: "invalid-corrections", correctionId: "stale-editor", message: expect.stringContaining("stale-editor") }));
    await draw("The editor returned.");
    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    expect(host.querySelector("[data-correction-id='stale-editor']")).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("recovers from an invalid first mount and compares inline options by value", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const oldIssue = vi.fn();
    const newIssue = vi.fn();
    const draw = async (text: string, callback = oldIssue): Promise<void> => {
      await act(async () => root.render(<Proofmarks as="h2" notation={enUS}
        corrections={[{ id: "delete-word", type: "delete", target: { kind: "text-range", start: 4, end: 10 } }]}
        markStyle={{ ink: "red" }} onIssue={(issue) => callback(issue)}>{text}</Proofmarks>));
    };
    await draw("Hi");
    expect(host.querySelector("h2")?.firstChild?.textContent).toBe("Hi");
    expect(oldIssue).toHaveBeenCalledTimes(1);
    await draw("The editor returned.");
    const mark = host.querySelector("[data-correction-id]");
    expect(mark).not.toBeNull();
    await draw("The editor returned.", newIssue);
    expect(host.querySelector("[data-correction-id]")).toBe(mark);
    await draw("Hi", newIssue);
    expect(newIssue).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it("balances overlays and observers across 100 React mount/unmount cycles", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const corrections = [{
      id: "delete-editor",
      type: "delete",
      target: { kind: "text-range", start: 4, end: 10 },
    }] as const satisfies readonly Correction[];

    for (let cycle = 0; cycle < 100; cycle += 1) {
      const root = createRoot(host);
      await act(async () => {
        root.render(
          <Proofmarks notation={enUS} corrections={corrections}>
            The editor reviewed it.
          </Proofmarks>,
        );
      });
      expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
      await act(async () => root.unmount());
      expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(0);
    }
    expect(TestResizeObserver.active).toBe(0);
    expect(TestMutationObserver.active).toBe(0);
    expect(testFonts.active).toBe(0);
  });

  it("keeps editorial variation deterministic and separate from layout semantics", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const correction: Correction = {
      id: "insert-editorial-word",
      type: "insert",
      target: { kind: "text-point", offset: 4 },
      content: "careful ",
    };

    await act(async () => {
      root.render(
        <Proofmarks
          notation={enUS}
          corrections={[correction]}
          appearance="editorial"
        >
          The editor reviewed it.
        </Proofmarks>,
      );
    });

    const overlay = host.querySelector<SVGSVGElement>("[data-proofmarks-overlay]")!;
    const group = host.querySelector<SVGGElement>("[data-correction-id]")!;
    const firstEditorial = host
      .querySelector<SVGLineElement>('[data-proofmarks-role="insertion-anchor"]')!
      .outerHTML;
    const labelTransform = host
      .querySelector<SVGTextElement>('[data-proofmarks-role="inserted-text"]')!
      .getAttribute("transform");
    const placement = {
      lane: group.dataset.layoutLane,
      candidate: group.dataset.layoutCandidate,
      route: group.dataset.leaderRoute,
    };
    expect(overlay.dataset.proofmarksAppearance).toBe("editorial");
    expect(host.querySelectorAll("[data-proofmarks-second-pass]").length).toBeGreaterThan(0);
    expect(labelTransform).toMatch(/rotate/);

    await act(async () => {
      root.render(
        <Proofmarks
          notation={enUS}
          corrections={[correction]}
          appearance="editorial"
        >
          The editor reviewed it.
        </Proofmarks>,
      );
    });
    expect(
      host.querySelector<SVGLineElement>('[data-proofmarks-role="insertion-anchor"]')!
        .outerHTML,
    ).toBe(firstEditorial);

    await act(async () => {
      root.render(
        <Proofmarks
          notation={enUS}
          corrections={[correction]}
          appearance="technical"
        >
          The editor reviewed it.
        </Proofmarks>,
      );
    });
    const technicalGroup = host.querySelector<SVGGElement>("[data-correction-id]")!;
    expect(overlay.dataset.proofmarksAppearance).toBe("technical");
    expect(host.querySelectorAll("[data-proofmarks-second-pass]")).toHaveLength(0);
    expect({
      lane: technicalGroup.dataset.layoutLane,
      candidate: technicalGroup.dataset.layoutCandidate,
      route: technicalGroup.dataset.leaderRoute,
    }).toEqual(placement);
    expect(
      host.querySelector<SVGLineElement>('[data-proofmarks-role="insertion-anchor"]')!
        .outerHTML,
    ).not.toBe(firstEditorial);

    await act(async () => root.unmount());
  });

  it("survives Strict Mode, updates declaratively, and never mutates props", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const correction: Correction = {
      id: "delete-editor",
      type: "delete",
      target: { kind: "text-range", start: 4, end: 10 },
    };
    const correctionBefore = structuredClone(correction);
    const notationBefore = {
      id: jis.id,
      displayName: jis.displayName,
      locale: jis.locale,
      writingModes: [...jis.writingModes],
      supportedCorrections: [...jis.supportedCorrections],
    };

    await act(async () => {
      root.render(
        <StrictMode>
          <Proofmarks as="article" notation={jis} corrections={[correction]}>
            The <em>editor</em> reviewed it.
          </Proofmarks>
        </StrictMode>,
      );
    });

    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    expect(TestResizeObserver.active).toBe(1);
    expect(TestMutationObserver.active).toBe(1);
    expect(testFonts.active).toBe(1);
    expect(
      host.querySelector('[data-operation="delete"]')?.getAttribute("data-notation-id"),
    ).toBe("ja-jis-z8208-reference");

    await act(async () => {
      root.render(
        <StrictMode>
          <Proofmarks as="article" notation={gb} corrections={[correction]}>
            The <em>editor</em> reviewed it.
          </Proofmarks>
        </StrictMode>,
      );
    });

    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    expect(TestResizeObserver.active).toBe(1);
    expect(TestMutationObserver.active).toBe(1);
    expect(
      host.querySelector('[data-operation="delete"]')?.getAttribute("data-notation-id"),
    ).toBe("zh-gb-t14706-reference");
    expect(correction).toEqual(correctionBefore);
    expect({
      id: jis.id,
      displayName: jis.displayName,
      locale: jis.locale,
      writingModes: [...jis.writingModes],
      supportedCorrections: [...jis.supportedCorrections],
    }).toEqual(notationBefore);

    const movedCorrection: Correction = {
      id: "delete-moved-editor",
      type: "delete",
      target: { kind: "text-range", start: 12, end: 18 },
    };
    await act(async () => {
      root.render(
        <StrictMode>
          <Proofmarks as="article" notation={gb} corrections={[movedCorrection]}>
            The careful <em>editor</em> reviewed it.
          </Proofmarks>
        </StrictMode>,
      );
    });
    expect(
      host.querySelector('[data-operation="delete"]')?.getAttribute("data-correction-id"),
    ).toBe("delete-moved-editor");
    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);

    await act(async () => root.unmount());
    expect(TestResizeObserver.active).toBe(0);
    expect(TestMutationObserver.active).toBe(0);
    expect(testFonts.active).toBe(0);
    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(0);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "resize"),
    ).toHaveLength(
      removeEventListener.mock.calls.filter(([type]) => type === "resize").length,
    );

    const remount = createRoot(host);
    await act(async () => {
      remount.render(
        <StrictMode>
          <Proofmarks notation={jis} corrections={[correction]}>
            The <em>editor</em> reviewed it.
          </Proofmarks>
        </StrictMode>,
      );
    });
    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    expect(TestResizeObserver.active).toBe(1);
    expect(TestMutationObserver.active).toBe(1);
    expect(testFonts.active).toBe(1);

    await act(async () => remount.unmount());
    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(0);
    expect(TestResizeObserver.active).toBe(0);
    expect(TestMutationObserver.active).toBe(0);
    expect(testFonts.active).toBe(0);
  });

  it("toggles only overlay visibility without remounting or losing source selection", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const corrections = [
      {
        id: "replace-editor",
        type: "replace",
        target: { kind: "text-range", start: 4, end: 10 },
        replacement: "writer",
      },
    ] as const satisfies readonly Correction[];
    const renderProof = (showProofmarks: boolean) => (
      <Proofmarks
        as="article"
        notation={enUS}
        corrections={corrections}
        showProofmarks={showProofmarks}
      >
        The editor reviewed it.
      </Proofmarks>
    );

    await act(async () => root.render(renderProof(true)));
    const proof = host.querySelector<HTMLElement>("[data-proofmarks-root]")!;
    const sourceNode = proof.firstChild!;
    const overlay = proof.querySelector<SVGSVGElement>("[data-proofmarks-overlay]")!;
    const correctionGroup = proof.querySelector<SVGGElement>("[data-correction-id]")!;
    const placement = {
      lane: correctionGroup.dataset.layoutLane,
      candidate: correctionGroup.dataset.layoutCandidate,
    };
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(sourceNode, 4);
    range.setEnd(sourceNode, 10);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(overlay.dataset.proofmarksVisible).toBe("true");
    expect(selection.toString()).toBe("editor");
    expect(TestResizeObserver.active).toBe(1);

    await act(async () => root.render(renderProof(false)));
    expect(proof.querySelector("[data-proofmarks-overlay]")).toBe(overlay);
    expect(proof.querySelector("[data-correction-id]")).toBe(correctionGroup);
    expect(overlay.style.visibility).toBe("hidden");
    expect(overlay.dataset.proofmarksVisible).toBe("false");
    expect(sourceNode.textContent).toBe("The editor reviewed it.");
    expect(selection.toString()).toBe("editor");
    expect(TestResizeObserver.active).toBe(1);

    await act(async () => root.render(renderProof(true)));
    expect(proof.querySelector("[data-proofmarks-overlay]")).toBe(overlay);
    expect(proof.querySelector("[data-correction-id]")).toBe(correctionGroup);
    expect(overlay.style.visibility).toBe("visible");
    expect(overlay.dataset.proofmarksVisible).toBe("true");
    expect({
      lane: correctionGroup.dataset.layoutLane,
      candidate: correctionGroup.dataset.layoutCandidate,
    }).toEqual(placement);
    expect(selection.toString()).toBe("editor");

    await act(async () => root.unmount());
  });

  it("updates marker styling declaratively while preserving one overlay", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const corrections = [{
      id: "replace-editor",
      type: "replace",
      target: { kind: "text-range", start: 4, end: 10 },
      replacement: "writer",
    }] as const satisfies readonly Correction[];

    await act(async () => root.render(
      <Proofmarks notation={enUS} corrections={corrections}>
        The editor reviewed it.
      </Proofmarks>,
    ));
    const overlay = host.querySelector<SVGSVGElement>("[data-proofmarks-overlay]")!;
    const geometry = overlay.querySelector("path")?.getAttribute("d");

    await act(async () => root.render(
      <Proofmarks
        notation={enUS}
        corrections={corrections}
        markStyle={{ ink: "#173b63", labelInk: "#102a43", strokeScale: 1.15 }}
      >
        The editor reviewed it.
      </Proofmarks>,
    ));

    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    expect(host.querySelector("[data-proofmarks-overlay]")).toBe(overlay);
    expect(overlay.style.getPropertyValue("--proofmarks-mark-ink")).toBe("#173b63");
    expect(overlay.querySelector("path")?.getAttribute("d")).toBe(geometry);
    expect(host.querySelector("[data-proofmarks-root]")?.firstChild?.textContent)
      .toBe("The editor reviewed it.");

    await act(async () => root.unmount());
  });

  it("reports an unsupported writing mode without fabricating a mark", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onIssue = vi.fn();

    await act(async () => {
      root.render(
        <Proofmarks
          notation={enUS}
          corrections={[
            {
              id: "delete-word",
              type: "delete",
              target: { kind: "text-range", start: 4, end: 10 },
            },
          ]}
          style={{ writingMode: "vertical-rl" }}
          onIssue={onIssue}
        >
          The editor reviewed it.
        </Proofmarks>,
      );
    });

    expect(onIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "unsupported-writing-mode",
        correctionId: "delete-word",
      }),
    );
    expect(host.querySelector('[data-operation="delete"]')?.getAttribute("data-fidelity"))
      .toBe("unsupported");
    expect(host.querySelectorAll("[data-proofmarks-role]")).toHaveLength(0);

    await act(async () => root.unmount());
  });

  it("hydrates server-rendered content before attaching one browser overlay", async () => {
    const view = (
      <Proofmarks
        as="p"
        notation={jis}
        corrections={[
          {
            id: "delete-name",
            type: "delete",
            target: { kind: "text-range", start: 8, end: 10 },
          },
        ]}
      >
        吾輩は猫である。<em>名前</em>はまだ無い。
      </Proofmarks>
    );
    const serverHtml = renderToString(view);
    expect(serverHtml).toContain("吾輩は猫である。");
    expect(serverHtml).not.toContain("data-proofmarks-overlay");

    const host = document.createElement("div");
    host.innerHTML = serverHtml;
    document.body.append(host);
    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(0);

    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(host, view);
      await Promise.resolve();
    });
    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(1);
    expect(TestResizeObserver.active).toBe(1);
    expect(TestMutationObserver.active).toBe(1);
    expect(testFonts.active).toBe(1);

    await act(async () => root!.unmount());
    expect(host.querySelectorAll("[data-proofmarks-overlay]")).toHaveLength(0);
    expect(TestResizeObserver.active).toBe(0);
    expect(TestMutationObserver.active).toBe(0);
    expect(testFonts.active).toBe(0);
  });
});
