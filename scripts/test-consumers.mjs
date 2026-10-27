import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const repository = resolve(import.meta.dirname, "..");
const packageDirectory = join(repository, "packages", "proofmarks");
const fixtureDirectory = join(repository, "tests", "fixtures");
const temporaryRoot = mkdtempSync(join(tmpdir(), "proofmarks-consumers-"));
const npmCache = join(temporaryRoot, "npm-cache");
const artifactDirectory = join(
  repository,
  "docs",
  "tasks",
  "08302026-task010a-release-hardening",
  "artifacts",
);
mkdirSync(artifactDirectory, { recursive: true });

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, NPM_CONFIG_CACHE: npmCache },
  });
}

function verifyExpectedTypeError(cwd) {
  try {
    execFileSync(
      "npm",
      ["exec", "tsc", "--", "--project", "tsconfig.invalid.json"],
      {
        cwd,
        encoding: "utf8",
        env: { ...process.env, NPM_CONFIG_CACHE: npmCache },
        stdio: "pipe",
      },
    );
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    const diagnostics = output.match(/error TS\d+:/g) ?? [];
    assert(
      diagnostics.length >= 8 &&
        output.includes('Type \'"text-range"\' is not assignable to type \'"correction"\'') &&
        output.includes("not assignable to type 'readonly [TextRangeTarget, TextRangeTarget]'") &&
        output.includes("Type 'number' is not assignable to type 'string'"),
      `The eight invalid public operations failed for unexpected reasons.\n${output}`,
    );
    console.log(`Expected public type errors verified: ${diagnostics.length}`);
    return;
  }
  throw new Error("Invalid public correction operations unexpectedly passed TypeScript.");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a local consumer port."));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitForServer(url, server, getLogs) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Consumer preview exited early.\n${getLogs()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Consumer preview did not start at ${url}.\n${getLogs()}`);
}

async function stopPreviewServer(server) {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const closed = once(server, "close");
  const forceKill = setTimeout(() => server.kill("SIGKILL"), 5_000);
  forceKill.unref();
  server.kill("SIGTERM");
  try {
    await closed;
  } finally {
    clearTimeout(forceKill);
  }
}

async function verifyRuntime(fixtureName, consumerKind, consumerDirectory) {
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  let serverLogs = "";
  // Own the actual server process; killing an npm launcher can leave its Vite
  // child holding these pipes open and prevent this verification from exiting.
  const server = spawn(
    process.execPath,
    [join(consumerDirectory, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: consumerDirectory,
      env: { ...process.env, NPM_CONFIG_CACHE: npmCache },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => { serverLogs += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverLogs += chunk.toString(); });

  let browser;
  try {
    await waitForServer(url, server, () => serverLogs);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1080, height: 720 } });
    const runtimeErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("[data-proofmarks-overlay]").waitFor();

    if (consumerKind === "react") {
      const correctionBefore = await page.locator("#correction-json").textContent();
      assert(
        await page.locator("[data-proofmarks-overlay]").count() === 1,
        "React consumer must mount exactly one overlay.",
      );
      assert(
        await page.locator('[data-notation-id="ja-jis-z8208-reference"]').count() === 1,
        "React consumer did not render the JIS scene.",
      );
      assert(
        await page.locator('[data-operation="delete"]').getAttribute("data-fidelity") ===
          "reference-based",
        "React consumer JIS scene was not reference-based.",
      );
      assert(
        await page.locator("[data-proofmarks-role]").count() > 0,
        "React consumer rendered no visible proofmark primitives.",
      );
      await page.getByRole("button", { name: "Use Editorial" }).click();
      await page.locator('[data-proofmarks-appearance="editorial"]').waitFor();
      assert(
        await page.locator("[data-proofmarks-second-pass]").count() > 0,
        "React consumer editorial appearance rendered no pressure pass.",
      );
      await page.screenshot({
        path: join(artifactDirectory, `task010a-${fixtureName}-jis.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Use GB" }).click();
      await page.locator('[data-notation-id="zh-gb-t14706-reference"]').waitFor();
      assert(
        await page.locator('[data-operation="delete"]').getAttribute("data-fidelity") ===
          "reference-based",
        "React consumer GB scene was not reference-based.",
      );
      assert(
        await page.locator("[data-proofmarks-overlay]").count() === 1,
        "React notation update created a duplicate overlay.",
      );
      assert(
        await page.locator("#correction-json").textContent() === correctionBefore,
        "React notation update mutated correction JSON.",
      );
      await page.screenshot({
        path: join(artifactDirectory, `task010a-${fixtureName}-gb.png`),
        fullPage: true,
      });
    } else if (consumerKind === "vanilla") {
      assert(
        await page.locator("[data-proofmarks-overlay]").getAttribute(
          "data-proofmarks-appearance",
        ) === "editorial",
        "Vanilla consumer did not receive the editorial appearance option.",
      );
      assert(
        await page.locator('[data-notation-id="ja-jis-z8208-reference"]').count() === 1,
        "Vanilla consumer did not render its initial JIS scene.",
      );
      await page.getByRole("button", { name: "Use GB" }).click();
      await page.locator('[data-notation-id="zh-gb-t14706-reference"]').waitFor();
      assert(
        await page.locator('[data-operation="delete"]').getAttribute("data-fidelity") ===
          "reference-based",
        "Vanilla consumer GB scene was not reference-based.",
      );
      assert(
        await page.locator("[data-proofmarks-overlay]").count() === 1,
        "Vanilla update created a duplicate overlay.",
      );
      await page.screenshot({
        path: join(artifactDirectory, "task010a-vanilla-consumer.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Destroy" }).click();
      assert(
        await page.locator("[data-proofmarks-overlay]").count() === 0,
        "Vanilla destroy did not remove the overlay.",
      );
    } else {
      assert(
        await page.locator("[data-proofmarks-overlay]").count() === 1,
        "The docs quickstart must mount exactly one overlay.",
      );
      assert(
        await page.locator('[data-notation-id="ja-jis-z8208-reference"]').count() === 1,
        "The docs quickstart did not render its documented JIS scene.",
      );
      assert(
        (await page.locator("body").textContent()).includes("吾輩は猫である。名前はまだ無い。"),
        "The docs quickstart lost its documented source text.",
      );
    }

    assert(runtimeErrors.length === 0, `${fixtureName} logged runtime errors: ${runtimeErrors.join("\n")}`);
    return { fixtureName, url, runtimeErrors: runtimeErrors.length };
  } finally {
    try {
      await browser?.close();
    } finally {
      await stopPreviewServer(server);
    }
  }
}

run("pnpm", ["build"], packageDirectory);
run("npm", ["pack", "--pack-destination", temporaryRoot], packageDirectory);

const archive = readdirSync(temporaryRoot).find((name) => name.endsWith(".tgz"));
if (!archive) throw new Error("npm pack did not produce a Proofmarks archive.");
const archivePath = join(temporaryRoot, archive);
const archiveEntries = execFileSync("tar", ["-tzf", archivePath], {
  encoding: "utf8",
}).trim().split("\n");
for (const forbidden of ["apps/", "docs/", "fixtures/", "playwright", ".test."]) {
  assert(
    archiveEntries.every((entry) => !entry.includes(forbidden)),
    `Published archive unexpectedly contains ${forbidden}.`,
  );
}
const runtimeResults = [];

const consumers = [
  {
    fixtureName: "react-19-consumer",
    fixtureSource: "react-consumer",
    kind: "react",
  },
  {
    fixtureName: "react-18-consumer",
    fixtureSource: "react-consumer",
    kind: "react",
    reactVersion: "18.2.0",
    reactTypesVersion: "18.2.79",
    reactDomTypesVersion: "18.2.25",
  },
  {
    fixtureName: "quickstart-consumer",
    fixtureSource: "quickstart-consumer",
    kind: "quickstart",
  },
  {
    fixtureName: "agent-guide-consumer",
    fixtureSource: "quickstart-consumer",
    kind: "agent-guide",
  },
  {
    fixtureName: "vanilla-consumer",
    fixtureSource: "vanilla-consumer",
    kind: "vanilla",
  },
];

for (const consumer of consumers) {
  const { fixtureName, fixtureSource, kind } = consumer;
  const consumerDirectory = join(temporaryRoot, fixtureName);
  cpSync(join(fixtureDirectory, fixtureSource), consumerDirectory, { recursive: true });
  if (kind === "quickstart" || kind === "agent-guide") {
    const documentName = kind === "quickstart" ? "quickstart.md" : "agent-guide.md";
    const sourceDocument = readFileSync(join(repository, "docs", documentName), "utf8");
    const match = sourceDocument.match(/```tsx\n([\s\S]*?)\n```/);
    assert(match, `The documented React example in ${documentName} is unavailable.`);
    writeFileSync(join(consumerDirectory, "src", "Example.tsx"), `${match[1]}\n`);
  }
  const manifestPath = join(consumerDirectory, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.dependencies = {
    ...(manifest.dependencies ?? {}),
    proofmarks: `file:${archivePath}`,
  };
  if (consumer.reactVersion) {
    manifest.dependencies.react = consumer.reactVersion;
    manifest.dependencies["react-dom"] = consumer.reactVersion;
    manifest.devDependencies["@types/react"] = consumer.reactTypesVersion;
    manifest.devDependencies["@types/react-dom"] = consumer.reactDomTypesVersion;
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  run("npm", ["install", "--no-package-lock", "--ignore-scripts"], consumerDirectory);
  run("npm", ["run", "typecheck"], consumerDirectory);
  if (kind === "react") {
    verifyExpectedTypeError(consumerDirectory);
    run("npm", ["run", "build:ssr"], consumerDirectory);
    const serverHtml = execFileSync("node", ["dist-ssr/ssr.js"], {
      cwd: consumerDirectory,
      encoding: "utf8",
    });
    assert(
      serverHtml.includes("吾輩は猫である。名前はまだ無い。"),
      "Fresh React SSR consumer lost the source content.",
    );
    assert(
      !serverHtml.includes("data-proofmarks-overlay"),
      "Fresh React SSR consumer emitted a browser overlay on the server.",
    );
  }
  run("npm", ["run", "build"], consumerDirectory);

  if (!existsSync(join(consumerDirectory, "dist", "index.html"))) {
    throw new Error(`${fixtureName} did not produce a Vite build.`);
  }
  const installedPackagePath = join(
    consumerDirectory,
    "node_modules",
    "proofmarks",
    "package.json",
  );
  assert(existsSync(installedPackagePath), `${fixtureName} did not install proofmarks.`);
  assert(
    !lstatSync(join(consumerDirectory, "node_modules", "proofmarks")).isSymbolicLink(),
    `${fixtureName} resolved proofmarks through a symlink instead of the packed archive.`,
  );
  assert(
    realpathSync(installedPackagePath).startsWith(realpathSync(consumerDirectory)),
    `${fixtureName} escaped its temporary consumer directory.`,
  );
  if (
    kind === "vanilla" &&
    existsSync(join(consumerDirectory, "node_modules", "react"))
  ) {
    throw new Error("The vanilla consumer unexpectedly installed React.");
  }
  if (kind === "quickstart" || kind === "agent-guide") {
    const serverResult = await verifyRuntime(fixtureName, "quickstart", consumerDirectory);
    runtimeResults.push(serverResult);
  } else {
    runtimeResults.push(await verifyRuntime(fixtureName, kind, consumerDirectory));
  }
}

console.log(`Consumer fixtures passed from ${archivePath}`);
console.log(JSON.stringify(runtimeResults, null, 2));
