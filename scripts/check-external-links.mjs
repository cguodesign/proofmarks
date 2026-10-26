import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const sourceFiles = [
  "apps/playground/src/site.tsx",
  "apps/playground/src/site-chrome.ts",
  "apps/playground/src/site-ui.tsx",
];
const urls = [...new Set(sourceFiles.flatMap((file) =>
  readFileSync(resolve(repository, file), "utf8").match(/https:\/\/[^\s"'<>]+/g) ?? [],
))].sort();

async function check(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Proofmarks local release link audit" },
    });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "Proofmarks local release link audit" },
      });
    }
    return { url, status: response.status, finalUrl: response.url, available: response.ok };
  } catch (error) {
    return {
      url,
      status: null,
      available: false,
      error: error instanceof Error ? error.name : "UnknownError",
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (let index = 0; index < urls.length; index += 4) {
  results.push(...await Promise.all(urls.slice(index, index + 4).map(check)));
}
console.log(JSON.stringify({ checked: results.length, results }, null, 2));
