import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

// These tests assert English site copy; pin the browser language explicitly.
test.use({ locale: "en-US" });

const artifactFolders = [
  ["task009b-", "08282026-task009b-coverage-expansion"],
  ["task009c-", "08282026-task009c-canonical-fidelity"],
  ["task009d-", "08282026-task009d-release-demo"],
  ["task009e-", "08302026-task009e-responsive-polish"],
  ["task009-", "08272026-task009-public-website"],
] as const;

const artifactPath = (...parts: string[]) => {
  const filename = parts[parts.length - 1] ?? "";
  const taskFolder = artifactFolders.find(([prefix]) => filename.startsWith(prefix))?.[1];
  if (!taskFolder) throw new Error(`No task artifact folder for ${filename}`);
  return path.join(process.cwd(), "docs", "tasks", taskFolder, "artifacts", ...parts);
};

async function waitForProofmarks(page: Page): Promise<void> {
  await expect(page.locator("[data-proofmarks-overlay]").first()).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function prepareArtifact(page: Page): Promise<void> {
  await page.waitForTimeout(700);
  await page.locator(".skip-link").evaluate((element) => {
    (element as HTMLElement).style.visibility = "hidden";
  });
}

test.describe("Task 009 public website", () => {
  test("homepage leads with a live proof and switches notation declaratively", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/re:proofmarks — Proofreading notation/);
    await expect(page.getByRole("link", { name: "re:proofmarks overview" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Proofreading notation for the browser." }),
    ).toBeVisible();
    await expect(page.getByText("npm install proofmarks").first()).toBeVisible();
    await waitForProofmarks(page);

    const hero = page.locator(".hero-proof-wrap");
    await hero.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(hero.locator("[data-proofmarks-overlay]")).toHaveCount(1);
    await expect(hero.locator("[data-correction-id]")).toHaveCount(2);
    await expect(hero.getByRole("button", { name: "Hide proofmarks" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Read an interactive proof/ })).toBeVisible();

    for (const sample of [
      { label: "日本 · JIS", lang: "ja", text: "小さな印。\n静かな変化。\n言葉が動き出す。" },
      { label: "中文 · GB", lang: "zh-Hans", text: "小小的记号。\n轻轻的修改。\n让文字被看见。" },
      { label: "臺灣 · CNS 3927", lang: "zh-Hant-TW", text: "小小的記號。\n輕輕的修改。\n讓文字被看見。" },
      { label: "한국 · KS", lang: "ko", text: "작은 표시.\n조용한 변화.\n글이 달라집니다." },
    ]) {
      await hero.getByRole("button", { name: sample.label, exact: true }).click();
      await expect(hero.locator(".hero-proof-sheet")).toHaveAttribute("lang", sample.lang);
      expect(await hero.locator(".hero-proof-sheet").evaluate((element) => element.firstChild?.textContent)).toBe(sample.text);
      await expect(hero.locator("[data-proofmarks-overlay]")).toHaveCount(1);
      await expect(hero.locator("[data-correction-id]")).toHaveCount(2);
      await expect(hero.locator('[data-fidelity="generic-fallback"]')).toHaveCount(0);
    }

    await expect(page.locator(".tradition-proof")).toHaveCount(5);
    await expect(page.locator(".tradition-proof [data-proofmarks-overlay]")).toHaveCount(5);
    await expect(page.locator('.tradition-proof [data-fidelity="generic-fallback"]')).toHaveCount(0);
    await expect(page.locator(".tradition-proof [lang='ja']")).toContainText("余白を残す。");
    await expect(page.locator(".tradition-proof [lang='zh-Hans']")).toContainText("在细节里现发美。");
    await expect(page.locator(".tradition-proof [lang='zh-Hant-TW']")).toContainText("編輯仔細校對這分文稿。");
    await expect(page.locator(".tradition-proof [lang='ko']")).toContainText("함께읽는 문장.");
    await expect(page.locator(".tradition-proof [lang='en']")).toContainText(
      "Keep the quiet voice.",
    );
    await expect(page.locator(".suggesting-preview [data-proofmarks-overlay]")).toHaveCount(1);
    await expect(page.locator(".suggesting-preview .preview-copy")).toHaveText(
      "The writer reviewed the manuscript.",
    );
    await expect(page.locator(".suggesting-preview .preview-proof")).toContainText(
      "The editor reviewed the manuscript.",
    );

    await expect(page.locator(".home-resources")).toContainText("Plain corrections become source-aware marks");

    await hero.getByRole("button", { name: "English · US" }).click();
    await expect(hero.locator(".proof-timeline")).toHaveCount(1);
    await expect(hero.getByText("English · US", { exact: true })).toHaveCount(0);
    await expect(hero.locator(".hero-proof-sheet")).toHaveAttribute("lang", "en");
    await expect(hero.locator(".hero-proof-sheet")).toContainText("Small marks.");
    await prepareArtifact(page);

    await page.locator(".home-hero").screenshot({
      path: artifactPath("task009-homepage-hero.png"),
    });
    await page.locator(".tradition-grid").screenshot({
      path: artifactPath("task009-four-traditions.png"),
    });
    await page.locator(".suggesting-preview").screenshot({
      path: artifactPath("task009-suggesting-section.png"),
    });
    await page.screenshot({
      path: artifactPath("task009-homepage-full.png"),
      fullPage: true,
    });
  });

  for (const route of ["/", "/get-started", "/marks", "/references", "/docs"]) {
    test(`${route} has public navigation, one main landmark, and a skip target`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("#main-content")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const githubLink = page
        .getByRole("navigation", { name: "Footer navigation" })
        .getByRole("link", { name: "GitHub" });
      await expect(githubLink).toHaveCSS("white-space", "nowrap");
    });
  }

  test("public pages use neutral white surfaces without paper tint or texture", async ({
    page,
  }) => {
    const routes = [
      { route: "/", surfaces: [".hero-proof-sheet", ".tradition-proof > div"] },
      { route: "/get-started", surfaces: [".proof-text"] },
      { route: "/marks", surfaces: [".proof-text"] },
      { route: "/docs", surfaces: [] },
      { route: "/references", surfaces: [] },
    ] as const;

    for (const { route, surfaces } of routes) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      const audit = await page.evaluate((selectors) => {
        const colorChannels = (value: string): [number, number, number] => {
          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) throw new Error("Canvas color parser unavailable.");
          context.fillStyle = value;
          context.fillRect(0, 0, 1, 1);
          const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
          return [red, green, blue];
        };
        const luminance = ([red, green, blue]: [number, number, number]) => {
          const linear = [red, green, blue].map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
        };
        const bodyStyle = getComputedStyle(document.body);
        const background = colorChannels(bodyStyle.backgroundColor);
        const ink = colorChannels(bodyStyle.color);
        const lighter = Math.max(luminance(background), luminance(ink));
        const darker = Math.min(luminance(background), luminance(ink));

        return {
          background,
          contrast: (lighter + 0.05) / (darker + 0.05),
          backgroundImage: bodyStyle.backgroundImage,
          texturedElements: [...document.querySelectorAll<HTMLElement>(".public-site *")]
            .filter((element) => getComputedStyle(element).backgroundImage !== "none")
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: element.className,
              backgroundImage: getComputedStyle(element).backgroundImage,
            })),
          surfaces: selectors.flatMap((selector) =>
            [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
              const style = getComputedStyle(element);
              return {
                selector,
                background: colorChannels(style.backgroundColor),
                backgroundImage: style.backgroundImage,
              };
            }),
          ),
        };
      }, surfaces);

      expect(audit.background, `${route} page background`).toEqual([255, 255, 255]);
      expect(audit.backgroundImage, `${route} page texture`).toBe("none");
      expect(audit.texturedElements, `${route} textured elements`).toEqual([]);
      expect(audit.contrast, `${route} body contrast`).toBeGreaterThanOrEqual(7);
      for (const surface of audit.surfaces) {
        expect(new Set(surface.background).size, `${route} neutral surface`).toBe(1);
        expect(surface.background[0], `${route} near-white surface`).toBeGreaterThanOrEqual(248);
        expect(surface.backgroundImage, `${route} ${surface.selector} texture`).toBe("none");
      }
    }
  });

  test("public pages never transform interface copy to all caps", async ({ page }) => {
    for (const route of ["/", "/get-started", "/marks", "/references", "/docs"]) {
      await page.goto(route);
      const uppercaseTransforms = await page.locator(".public-site *").evaluateAll((elements) =>
        elements
          .filter((element) => getComputedStyle(element).textTransform === "uppercase")
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: element.getAttribute("class"),
            text: element.textContent?.trim().slice(0, 80),
          })),
      );
      expect(uppercaseTransforms, `${route} contains all-caps transforms`).toEqual([]);
    }
  });

  test("publishes concise and full coding-agent discovery files", async ({ request }) => {
    const concise = await request.get("/llms.txt");
    expect(concise.ok()).toBe(true);
    expect(concise.headers()["content-type"]).toContain("text/plain");
    expect(await concise.text()).toContain("Offsets are UTF-16 code units");

    const full = await request.get("/llms-full.txt");
    expect(full.ok()).toBe(true);
    expect(full.headers()["content-type"]).toContain("text/plain");
    const fullText = await full.text();
    expect(fullText).toContain("The renderer consumes corrections");
    for (const pack of ["jis", "gb", "cns3927", "ks", "enUS"]) expect(fullText).toContain(pack);
    expect(fullText).toContain("node_modules/proofmarks/AGENT_GUIDE.md");
  });

  test("keyboard skip link reaches the public main content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("skip link stays hidden after navigating between public pages", async ({ page }) => {
    const hidden = () => page.locator(".skip-link").evaluate((element) => element.getBoundingClientRect().bottom <= 0);
    await page.goto("/");
    const primary = page.getByRole("navigation", { name: "Primary navigation" });
    for (const link of ["Docs", "Get started", "Marks", "Demo"]) {
      await primary.getByRole("link", { name: link, exact: true }).click();
      await page.waitForLoadState("load");
      await expect.poll(hidden).toBe(true);
    }
    await page.goBack();
    await expect.poll(hidden).toBe(true);
  });

  test("get started lives at /get-started and the former /playground URL still works", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Get started", exact: true })).toHaveAttribute("href", "/get-started");
    await expect(page.locator(".home-resources").getByRole("link", { name: /Get started/ })).toHaveAttribute("href", "/get-started");
    await expect(page.getByRole("link", { name: /Connect your editor/ })).toHaveAttribute("href", "/docs#editing");
    await page.goto("/playground#insert");
    await expect(page).toHaveURL(/\/get-started#insert$/);
    await expect(page).toHaveTitle("Get started — re:proofmarks");
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Get started", exact: true })).toHaveAttribute("aria-current", "page");
  });
});

test("homepage playback pauses for reading, manual choices, and offscreen content", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const hero = page.locator(".hero-proof-wrap");
  const proof = hero.locator(".hero-proof-sheet");
  await expect(hero).toHaveAttribute("data-playing", "true");
  await hero.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.fastForward(20000);
  await expect(proof).toHaveAttribute("lang", "en");
  await hero.getByRole("button", { name: "Play animation" }).click();
  await page.clock.fastForward(8100);
  await expect(proof).toHaveAttribute("lang", "ja");
  await hero.getByRole("button", { name: "中文 · GB", exact: true }).click();
  await page.clock.fastForward(10000);
  await expect(proof).toHaveAttribute("lang", "zh-Hans");
  await expect(hero).toHaveAttribute("data-playing", "false");
  await hero.getByRole("button", { name: "Play animation" }).click();
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await expect(hero).toHaveAttribute("data-playing", "false");
  await page.clock.fastForward(20000);
  await expect(proof).toHaveAttribute("lang", "zh-Hans");
});

test("each language dissolves from its own aligned ASCII passage", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".hero-proof-wrap");
  const impressions = new Set<string>();
  for (const [label, lang] of [
    ["English · US", "en"], ["日本 · JIS", "ja"], ["中文 · GB", "zh-Hans"],
    ["臺灣 · CNS 3927", "zh-Hant-TW"], ["한국 · KS", "ko"],
  ]) {
    await hero.getByRole("button", { name: label, exact: true }).click();
    await expect(hero.locator(".proof-performance-scene")).toHaveAttribute("data-ready", "true");
    await expect(hero.locator("canvas")).toHaveAttribute("lang", lang!);
    const result = await hero.evaluate((element) => {
      const canvas = element.querySelector("canvas")!;
      const proof = element.querySelector(".hero-proof-sheet")!;
      const source = proof.firstChild!;
      const box = proof.getBoundingClientRect();
      const scale = canvas.width / box.width;
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let offset = 0;
      const lines = source.textContent!.split("\n").map((line) => {
        const range = document.createRange();
        range.setStart(source, offset);
        range.setEnd(source, offset + line.length);
        offset += line.length + 1;
        const rect = range.getBoundingClientRect();
        let ink = 0;
        for (let y = Math.max(0, Math.floor((rect.top - box.top) * scale)); y < Math.min(canvas.height, (rect.bottom - box.top) * scale); y++) {
          for (let x = Math.max(0, Math.floor((rect.left - box.left) * scale)); x < Math.min(canvas.width, (rect.right - box.left) * scale); x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3]) ink++;
          }
        }
        return ink;
      });
      return { image: canvas.toDataURL(), lines };
    });
    expect(result.lines).toHaveLength(3);
    for (const ink of result.lines) expect(ink).toBeGreaterThan(100);
    expect(impressions.has(result.image)).toBe(false);
    impressions.add(result.image);
    // Capture the ASCII and font phases without depending on screenshot timing.
    await hero.locator(".proof-performance-scene").evaluate((scene) => {
      for (const animation of scene.getAnimations({ subtree: true })) {
        animation.pause(); animation.currentTime = 500;
      }
    });
    await hero.screenshot({ path: `/tmp/proofmarks-ascii-${lang}.png` });
    await hero.locator(".proof-performance-scene").evaluate((scene) => {
      for (const animation of scene.getAnimations({ subtree: true })) animation.finish();
    });
    await hero.screenshot({ path: `/tmp/proofmarks-native-${lang}.png` });
  }
});

test("reduced-motion homepage stays still and advances only on request", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const hero = page.locator(".hero-proof-wrap");
  await expect(hero).toHaveAttribute("data-playing", "false");
  await expect(hero.locator(".proof-ascii")).toBeHidden();
  await page.clock.fastForward(20000);
  await expect(hero.locator(".hero-proof-sheet")).toHaveAttribute("lang", "en");
  await hero.getByRole("button", { name: "Next proof" }).click();
  await expect(hero.locator(".hero-proof-sheet")).toHaveAttribute("lang", "ja");
  expect(await hero.locator(".hero-proof-sheet").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});

test.describe("Task 009 responsive and motion behavior", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("homepage fits a phone viewport and keeps navigation reachable", async ({ page }) => {
    await page.goto("/");
    await waitForProofmarks(page);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
    await expect(page.locator(".hero-proof-wrap [data-correction-id]")).toHaveCount(2);
    const mobileProofFontSize = await page
      .locator(".hero-proof-sheet")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(mobileProofFontSize).toBeGreaterThanOrEqual(21);

    const primaryNavigation = page.getByRole("navigation", { name: "Primary navigation" });
    for (const link of ["Demo", "Get started", "Marks", "Docs"]) {
      const target = primaryNavigation.getByRole("link", { name: link, exact: true });
      await target.scrollIntoViewIfNeeded();
      await expect(target).toBeVisible();
      expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await prepareArtifact(page);

    await page.screenshot({
      path: artifactPath("task009-mobile-home.png"),
      fullPage: true,
    });
  });


});

test.describe("Task 009 tablet behavior", () => {
  test.use({ viewport: { width: 834, height: 1112 }, hasTouch: true });

  test("homepage keeps the enlarged native proof readable", async ({ page }) => {
    await page.goto("/");
    await waitForProofmarks(page);
    await expect(page.locator(".hero-proof-wrap [data-correction-id]")).toHaveCount(2);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);

    await prepareArtifact(page);
    await page.locator(".home-hero").screenshot({
      path: artifactPath("task009-tablet-hero.png"),
    });
  });
});

test("public tools reflow at an effective 200 percent zoom", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 640, height: 450 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  for (const route of ["/get-started", "/marks"]) {
    await page.goto(`${baseURL}${route}`);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page, `${route} width at 200%`).toBeLessThanOrEqual(
      dimensions.viewport + 1,
    );
  }
  await page.goto(`${baseURL}/get-started`);
  await prepareArtifact(page);
  await page.screenshot({
    path: artifactPath("task009e-playground-200-percent.png"),
  });
  await context.close();
});

test("reduced motion removes meaningful transition duration", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${baseURL}/`);
  const transitionDuration = await page
    .getByRole("link", { name: "Docs", exact: true })
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001);
  await page.goto(`${baseURL}/get-started`);
  const overlay = page.locator(".guide-example-result [data-proofmarks-overlay]").first();
  await expect(overlay).toHaveCount(1);
  await page.getByLabel("Language & notation", { exact: true }).selectOption("gb");
  await expect(overlay.locator("[data-notation-id]").first()).toHaveAttribute("data-notation-id", /gb/);
  const overlayTransition = await overlay.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(overlayTransition).toBeLessThanOrEqual(0.001);
  await context.close();
});
