import { expect, test } from "@playwright/test";

const sourceBase = `/@fs/${process.cwd()}/packages/proofmarks/src`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("an unsupported empty scene preserves the first visible editorial animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const result = await page.evaluate(async (base) => {
    const { createProofmarks } = await import(`${base}/index.ts`);
    const { enUS } = await import(`${base}/notations.ts`);
    const element = document.createElement("p");
    element.style.cssText = "writing-mode:vertical-rl;height:400px;padding:44px 20px;font:24px/1.8 serif";
    element.textContent = "The editor reads.";
    document.body.prepend(element);
    const options = {
      notation: enUS, appearance: "editorial",
      corrections: [{ id: "delete-editor", type: "delete", target: { kind: "text-range", start: 4, end: 10 } }],
    };
    const proof = createProofmarks(element, options);
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await frame();
    const emptyPaths = element.querySelectorAll("path").length;
    const emptyAnimations = element.getAnimations({ subtree: true }).length;
    element.style.writingMode = "horizontal-tb";
    proof.update(options);
    await frame();
    const visiblePaths = element.querySelectorAll("path").length;
    const firstAnimations = element.getAnimations({ subtree: true }).length;
    proof.update({ ...options, markStyle: { ink: "red" } });
    await frame();
    const laterAnimations = element.getAnimations({ subtree: true }).length;
    proof.destroy();
    return { emptyPaths, emptyAnimations, visiblePaths, firstAnimations, laterAnimations };
  }, sourceBase);
  expect(result.emptyPaths).toBe(0);
  expect(result.emptyAnimations).toBe(0);
  expect(result.visiblePaths).toBeGreaterThan(0);
  expect(result.firstAnimations).toBeGreaterThan(0);
  expect(result.laterAnimations).toBe(0);
});

test("source selection and real clipboard exclude labels; cloned editorial SVG retains ink", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const result = await page.evaluate(async (base) => {
    const { createProofmarks, getSourceText } = await import(`${base}/index.ts`);
    const { enUS } = await import(`${base}/notations.ts`);
    const root = document.createElement("p");
    root.id = "copy-proof";
    root.style.cssText = "position:relative;width:500px;padding:44px 20px;font:24px/1.8 serif;background:white";
    root.textContent = "The editor reviewed it.";
    document.body.prepend(root);
    const issues: unknown[] = [];
    const proof = createProofmarks(root, {
      notation: enUS, appearance: "editorial", markStyle: { ink: "#ff0000" },
      corrections: [{ id: "replace-editor", type: "replace", target: { kind: "text-range", start: 4, end: 10 }, replacement: "writer" }],
      onIssue: (issue: unknown) => issues.push(issue),
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const svg = root.querySelector("svg")!;
    const active = svg.getAnimations({ subtree: true }).length;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "540"); clone.setAttribute("height", "132");
    clone.style.width = "540px"; clone.style.height = "132px";
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 540; canvas.height = 132;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, 540, 132).data;
    let red = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! > 150 && pixels[i + 1]! < 100 && pixels[i + 3]! > 40) red += 1;
    const range = document.createRange(); range.selectNodeContents(root);
    const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    // Keep the instance alive until the clipboard shortcut has completed.
    Object.assign(window, { testProof: proof });
    return { source: getSourceText(root), selection: selection.toString(), active, red, styles: svg.querySelectorAll("style").length, issues };
  }, sourceBase);
  expect(result.source).toBe("The editor reviewed it.");
  expect(result.selection).toBe(result.source);
  expect(result.active).toBeGreaterThan(0);
  expect(result.styles).toBe(0);
  expect(result.red).toBeGreaterThan(200);
  expect(result.issues).toEqual([]);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+c" : "Control+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(result.source);
});

test("multiple instances render once, share read/write phases and do not replay on resize", async ({ page }) => {
  const result = await page.evaluate(async (base) => {
    const { createProofmarks } = await import(`${base}/index.ts`);
    const { enUS } = await import(`${base}/notations.ts`);
    const host = document.createElement("section"); document.body.prepend(host);
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const counts: number[] = [];
    const roots: HTMLElement[] = [];
    const instances = [];
    const options = {
      notation: enUS, appearance: "editorial",
      corrections: [{ id: "replace", type: "replace", target: { kind: "text-range", start: 4, end: 10 }, replacement: "writer" }],
    };
    const started = performance.now();
    for (let i = 0; i < 100; i += 1) {
      const root = document.createElement("p");
      root.style.cssText = "position:relative;width:500px;padding:44px 20px;font:20px/1.8 serif";
      root.textContent = "The editor reviewed it."; host.append(root); roots.push(root); counts[i] = 0;
      instances.push(createProofmarks(root, { ...options, onRender: () => { counts[i]! += 1; } }));
    }
    const mountMs = performance.now() - started;
    await frame(); await frame();
    const mountCounts = [...counts];
    instances.forEach((instance, i) => instance.update({ ...options, markStyle: {}, onRender: () => { counts[i]! += 1; } }));
    const noopCounts = [...counts];
    const phases: string[] = [];
    const getRects = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { phases.push("read"); return getRects.call(this); };
    const replace = Element.prototype.replaceChildren;
    Element.prototype.replaceChildren = function (...nodes) { if (this.matches("[data-proofmarks-overlay]")) phases.push("write"); replace.apply(this, nodes); };
    roots.forEach((root) => { root.style.width = "510px"; });
    await frame(); await frame();
    Range.prototype.getClientRects = getRects;
    Element.prototype.replaceChildren = replace;
    const resizeCounts = [...counts];
    const animationCount = roots.reduce((total, root) => total + root.getAnimations({ subtree: true }).length, 0);
    const beforeFont = counts.reduce((a, b) => a + b, 0);
    const event = new Event("loadingdone"); Object.assign(event, { fontfaces: [{ family: "unused-test-family" }] });
    document.fonts.dispatchEvent(event); await frame();
    const afterFont = counts.reduce((a, b) => a + b, 0);
    instances[0]!.replay(); await frame();
    const replayCount = roots[0]!.getAnimations({ subtree: true }).length;
    instances[0]!.update({ ...options, animate: false });
    const disabledCount = roots[0]!.getAnimations({ subtree: true }).length;
    instances.forEach((instance) => instance.destroy());
    return { mountMs, mountCounts, noopCounts, resizeCounts, phases, animationCount, beforeFont, afterFont, replayCount, disabledCount, remaining: host.querySelectorAll("svg").length };
  }, sourceBase);
  expect(new Set(result.mountCounts)).toEqual(new Set([1]));
  expect(result.noopCounts).toEqual(result.mountCounts);
  expect(new Set(result.resizeCounts)).toEqual(new Set([2]));
  expect(result.phases).toContain("read"); expect(result.phases).toContain("write");
  expect(result.phases.slice(result.phases.indexOf("write"))).not.toContain("read");
  expect(result.animationCount).toBe(0);
  expect(result.afterFont).toBe(result.beforeFont);
  expect(result.replayCount).toBeGreaterThan(0);
  expect(result.disabledCount).toBe(0);
  expect(result.remaining).toBe(0);
  console.log(`100 editorial instances: ${result.mountMs.toFixed(1)}ms synchronous mount`);
});

test("stale source reports an issue asynchronously, recovers, and reduced motion stays static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  const result = await page.evaluate(async (base) => {
    const { createProofmarks } = await import(`${base}/index.ts`);
    const { enUS } = await import(`${base}/notations.ts`);
    const root = document.createElement("p"); root.textContent = "The editor reviewed it."; document.body.prepend(root);
    const issues: { code: string; correctionId?: string }[] = [];
    const proof = createProofmarks(root, { notation: enUS, appearance: "editorial", corrections: [{ id: "old", type: "replace", target: { kind: "text-range", start: 4, end: 10 }, replacement: "writer" }], onIssue: (issue: { code: string }) => issues.push(issue) });
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await frame();
    const mark = root.querySelector("[data-correction-id]");
    let rejected = false;
    try { proof.update({ notation: enUS, appearance: "editorial", corrections: [{ id: "far", type: "delete", target: { kind: "text-range", start: 40, end: 50 } }] }); } catch { rejected = true; }
    const keptForSameText = rejected && root.querySelector("[data-correction-id]") === mark;
    root.firstChild!.textContent = "Hi"; await frame();
    const cleared = root.querySelector("[data-correction-id]") === null && root.querySelectorAll("[data-proofmarks-overlay]").length === 1;
    root.firstChild!.textContent = "The editor returned."; await frame();
    const recovered = root.querySelector("[data-correction-id]") !== mark;
    proof.replay(); await frame();
    const animations = root.getAnimations({ subtree: true }).length;
    proof.destroy();
    return { keptForSameText, cleared, recovered, issues, animations };
  }, sourceBase);
  expect(result.keptForSameText).toBe(true); expect(result.cleared).toBe(true); expect(result.recovered).toBe(true);
  expect(result.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "invalid-corrections", correctionId: "old" }),
    expect.objectContaining({ code: "insufficient-room", collisions: expect.arrayContaining([expect.stringMatching(/^(source-text|exits-paper|annotation)$/)]) }),
  ]));
  expect(result.animations).toBe(0); expect(errors).toEqual([]);
});

test("window resize skips fixed-size roots; RTL roots report an unverified direction", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const setup = await page.evaluate(async (base) => {
    const { createProofmarks } = await import(`${base}/index.ts`);
    const { enUS } = await import(`${base}/notations.ts`);
    const host = document.createElement("section"); document.body.prepend(host);
    const counts = { fixed: 0, fluid: 0 };
    const issues: { code: string; direction?: string }[] = [];
    const mount = (key: "fixed" | "fluid", width: string, text: string, dir = "ltr") => {
      const root = document.createElement("p");
      root.dir = dir;
      root.style.cssText = `width:${width};padding:44px 20px;font:20px/1.8 serif`;
      root.textContent = text; host.append(root);
      return createProofmarks(root, {
        notation: enUS,
        corrections: [{ id: key, type: "delete", target: { kind: "text-range", start: 4, end: 10 } }],
        onRender: () => { counts[key] += 1; },
        onIssue: (issue: { code: string }) => issues.push(issue),
      });
    };
    mount("fixed", "600px", "The editor reviewed it.");
    mount("fluid", "50vw", "שלום עולם יפה מאוד", "rtl");
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    Object.assign(window, { proofCounts: counts, proofIssues: issues });
    return { ...counts };
  }, sourceBase);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const after = await page.evaluate(() => ({ ...(window as unknown as { proofCounts: { fixed: number; fluid: number } }).proofCounts }));
  const issues = await page.evaluate(() => (window as unknown as { proofIssues: unknown[] }).proofIssues);
  expect(setup).toEqual({ fixed: 1, fluid: 1 });
  expect(after.fixed).toBe(1);
  expect(after.fluid).toBe(2);
  expect(issues.filter((issue) => (issue as { code: string }).code === "unverified-direction")).toEqual([
    expect.objectContaining({ code: "unverified-direction", direction: "rtl" }),
  ]);
});

test("window resize re-renders a fixed-size root whose responsive font changed", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(async (base) => {
    const { createProofmarks } = await import(`${base}/index.ts`);
    const { enUS } = await import(`${base}/notations.ts`);
    // Box size is fixed; only the glyphs scale with the viewport.
    const root = document.createElement("p");
    root.id = "responsive-proof";
    root.style.cssText = "box-sizing:border-box;width:700px;height:160px;padding:44px 20px;margin:0;font-family:serif;font-size:2vw;line-height:40px;white-space:nowrap";
    root.textContent = "The editor reviewed it.";
    document.body.prepend(root);
    let renders = 0;
    createProofmarks(root, {
      notation: enUS,
      corrections: [{ id: "del", type: "delete", target: { kind: "text-range", start: 4, end: 10 } }],
      onRender: () => { renders += 1; },
    });
    Object.assign(window, { responsiveRenders: () => renders });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, sourceBase);
  const measure = () => page.evaluate(() => {
    const root = document.getElementById("responsive-proof")!;
    const text = root.firstChild as Text;
    const range = document.createRange(); range.setStart(text, 4); range.setEnd(text, 10);
    const word = range.getBoundingClientRect();
    const strokes = [...root.querySelectorAll<SVGGraphicsElement>("[data-proofmarks-overlay] [data-proofmarks-role]")]
      .map((node) => node.getBoundingClientRect()).filter((rect) => rect.width > 0);
    const box = root.getBoundingClientRect();
    return {
      renders: (window as unknown as { responsiveRenders(): number }).responsiveRenders(),
      box: [Math.round(box.width), Math.round(box.height)],
      wordLeft: word.left, wordRight: word.right,
      markLeft: Math.min(...strokes.map((rect) => rect.left)),
    };
  });
  const before = await measure();
  await page.setViewportSize({ width: 900, height: 900 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const after = await measure();
  expect(after.box).toEqual(before.box);
  expect(after.wordRight - after.wordLeft).toBeLessThan((before.wordRight - before.wordLeft) * 0.8);
  expect(after.renders).toBe(before.renders + 1);
  expect(Math.abs(after.markLeft - after.wordLeft)).toBeLessThan(6);
});

test("window resize re-renders when inline fragments move inside unchanged text bounds", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.evaluate(async (base) => {
    const { createProofmarks } = await import(`${base}/index.ts`);
    const { enUS } = await import(`${base}/notations.ts`);
    // The two spans swap sizes at 900px, so the overall text extent stays the same.
    const style = document.createElement("style");
    style.textContent = `#inline-proof .first { font-size: 20px } #inline-proof .second { font-size: 40px }
      @media (max-width: 900px) { #inline-proof .first { font-size: 40px } #inline-proof .second { font-size: 20px } }`;
    document.head.append(style);
    const root = document.createElement("p");
    root.id = "inline-proof";
    root.style.cssText = "box-sizing:border-box;width:700px;height:200px;padding:44px 20px;margin:0;font:20px/1.8 serif;white-space:nowrap";
    root.innerHTML = 'The <span class="first">editor</span> and <span class="second">editor</span> read.';
    document.body.prepend(root);
    let renders = 0;
    createProofmarks(root, {
      notation: enUS,
      corrections: [{ id: "del", type: "delete", target: { kind: "text-range", start: 4, end: 10 } }],
      onRender: () => { renders += 1; },
    });
    Object.assign(window, { inlineRenders: () => renders });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, sourceBase);
  const measure = () => page.evaluate(() => {
    const root = document.getElementById("inline-proof")!;
    const word = root.querySelector(".first")!.getBoundingClientRect();
    const strokes = [...root.querySelectorAll<SVGGraphicsElement>("[data-proofmarks-overlay] [data-proofmarks-role]")]
      .map((node) => node.getBoundingClientRect()).filter((rect) => rect.width > 0);
    return {
      renders: (window as unknown as { inlineRenders(): number }).inlineRenders(),
      wordWidth: word.width, wordRight: word.right,
      markRight: Math.max(...strokes.map((rect) => rect.right)),
    };
  });
  const before = await measure();
  await page.setViewportSize({ width: 800, height: 900 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const after = await measure();
  expect(after.wordWidth).toBeGreaterThan(before.wordWidth * 1.5);
  expect(after.renders).toBe(before.renders + 1);
  expect(Math.abs(after.markRight - after.wordRight)).toBeLessThan(12);
});
