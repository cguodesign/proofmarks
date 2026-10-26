import { expect, test } from "@playwright/test";

const sourceBase = `/@fs/${process.cwd()}/packages/proofmarks/src`;

test("editorial multi-instance benchmark matches the external 200-line fixture", async ({ page }) => {
  await page.goto("/");
  const results = await page.evaluate(async (base) => {
    const { createProofmarks } = await import(`${base}/index.ts`);
    const { enUS } = await import(`${base}/notations.ts`);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "width:1280px;height:900px;border:0";
    document.body.replaceChildren(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><style>
      body { margin:0; font:16px/1.6 -apple-system, "PingFang SC", sans-serif }
      #stage { max-width:900px; margin:0 auto; padding:16px }
      .line { padding-block:22px; white-space:pre; font:13px/20px ui-monospace, Menlo, monospace }
    </style><div id="stage"></div>`);
    doc.close();
    const stage = doc.getElementById("stage")!;
    const frame = (count = 2): Promise<void> => new Promise((resolve) => {
      const tick = (): void => { if (--count) iframe.contentWindow!.requestAnimationFrame(tick); else resolve(); };
      iframe.contentWindow!.requestAnimationFrame(tick);
    });
    const line = "  const total = items.lenght == 0 ? 0 : sum(items);";
    const output = [];
    for (const count of [100, 200]) {
      const roots = Array.from({ length: count }, () => {
        const root = doc.createElement("div");
        root.className = "line";
        root.textContent = line;
        stage.append(root);
        return root;
      });
      await frame();
      const renderCounts = Array<number>(count).fill(0);
      const instances = [];
      const started = performance.now();
      for (const [index, root] of roots.entries()) {
        instances.push(createProofmarks(root, {
          notation: enUS,
          appearance: "editorial",
          corrections: [
            { id: `r${index}`, type: "replace", target: { kind: "text-range", start: 22, end: 28 }, replacement: "length" },
            { id: `i${index}`, type: "insert", target: { kind: "text-point", offset: 31 }, content: "=" },
          ],
          onRender: () => { renderCounts[index]! += 1; },
        }));
      }
      const syncMs = performance.now() - started;
      await frame(3);
      const settledMs = performance.now() - started;
      await new Promise((resolve) => setTimeout(resolve, 300));
      output.push({ count, syncMs, settledMs, renderCounts, overlays: stage.querySelectorAll("[data-proofmarks-overlay]").length });
      instances.forEach((instance) => instance.destroy());
      stage.replaceChildren();
    }
    iframe.remove();
    return output;
  }, sourceBase);

  for (const result of results) {
    expect(result.overlays).toBe(result.count);
    expect(new Set(result.renderCounts)).toEqual(new Set([1]));
  }
  console.log(results.map(({ count, syncMs, settledMs }) =>
    `${count} rows: ${syncMs.toFixed(1)}ms mount, ${settledMs.toFixed(1)}ms settled`).join("; "));
});
