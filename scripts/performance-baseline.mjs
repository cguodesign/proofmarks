import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const repository = resolve(import.meta.dirname, "..");

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No local port."));
      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitForServer(url, server, logs) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Benchmark server exited.\n${logs()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Benchmark server did not start.\n${logs()}`);
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

const port = await freePort();
const url = `http://127.0.0.1:${port}`;
let serverLogs = "";
const server = spawn(
  "pnpm",
  ["--filter", "@proofmarks/playground", "dev", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: repository, stdio: ["ignore", "pipe", "pipe"] },
);
server.stdout.on("data", (chunk) => { serverLogs += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverLogs += chunk.toString(); });

let browser;
try {
  await waitForServer(url, server, () => serverLogs);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${url}/layout`);
  const results = [];
  for (const count of [1, 10, 30, 100]) {
    const samples = [];
    for (let sample = 0; sample < 9; sample += 1) {
      await page.getByRole("button", { name: "writer + new + s", exact: true }).click();
      await page.getByRole("button", { name: `Profile · ${count}`, exact: true }).click();
      await page.evaluate(() => new Promise((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
      ));
      samples.push(await page.locator("[data-proofmarks-overlay]").evaluate((overlay) => {
        const data = overlay.dataset;
        return {
          measurement: Number(data.proofmarksMeasurementMs),
          sceneBuild: Number(data.proofmarksSceneBuildMs),
          layout: Number(data.proofmarksLayoutMs),
          sceneRender: Number(data.proofmarksSceneRenderMs),
          candidates: Number(data.proofmarksCandidateCount),
        };
      }));
    }
    const totals = samples.map((sample) =>
      sample.measurement + sample.sceneBuild + sample.layout + sample.sceneRender,
    );
    results.push({
      corrections: count,
      candidates: samples.at(-1).candidates,
      medianMs: Number(percentile(totals, 0.5).toFixed(3)),
      p95Ms: Number(percentile(totals, 0.95).toFixed(3)),
      stageMedianMs: Object.fromEntries(
        ["measurement", "sceneBuild", "layout", "sceneRender"].map((stage) => [
          stage,
          Number(percentile(samples.map((sample) => sample[stage]), 0.5).toFixed(3)),
        ]),
      ),
    });
  }
  console.log(JSON.stringify({
    browser: await browser.version(),
    viewport: "1440x900",
    sourceUtf16Units: 2102,
    warmSamples: 9,
    results,
  }, null, 2));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
