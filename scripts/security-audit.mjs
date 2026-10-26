import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  ".pnpm-store",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(relative(repository, absolute));
  }
  return files;
}

function listRepositoryFiles() {
  try {
    return execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim().split("\n").filter(Boolean);
  } catch {
    return walk(repository);
  }
}

const files = listRepositoryFiles();
const patterns = [
  /AKIA[0-9A-Z]{16}/,
  /ASIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /(?:^|[^A-Za-z])sk-[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:api[_-]?key|password|secret)\s*[:=]\s*["'][^"']{8,}/i,
];
const findings = [];

for (const file of files) {
  if (/\.(?:png|jpe?g|gif|webp|zip|tgz|pdf|DS_Store)$/i.test(file)) continue;
  let text;
  try {
    text = readFileSync(resolve(repository, file), "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue;
  if (patterns.some((pattern) => pattern.test(text))) findings.push(file);
}

console.log(JSON.stringify({ scannedFiles: files.length, findingFiles: findings }, null, 2));
if (findings.length > 0) process.exitCode = 1;
