import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const operations = [
  "delete",
  "insert",
  "replace",
  "transpose",
  "move",
  "increase-spacing",
  "decrease-spacing",
  "cancel-correction",
];
const files = [
  "docs/agent-guide.md",
  "docs/snippets/AGENTS.proofmarks.md",
  "docs/snippets/CLAUDE.proofmarks.md",
  "packages/proofmarks/AGENT_GUIDE.md",
  "apps/playground/public/llms.txt",
  "apps/playground/public/llms-full.txt",
];
const errors = [];
const packs = [
  ["jis", /\bjis\b/],
  ["gb", /\bgb\b/],
  ["cns3927", /\bcns3927\b/],
  ["ks", /\bks\b/],
  ["enUS", /\benUS\b/],
];
const required = [
  ["getSourceText", /getSourceText/],
  ["the offline package guide path", /node_modules\/proofmarks\/AGENT_GUIDE\.md/],
  ["the room recommendation", /padding: 44px 20px[\s\S]*line-height: 1\.8|padding: "44px 20px", lineHeight: 1\.8/],
  ["the density recommendation", /3–6[\s\S]{0,40}2–4 lines/],
  ["insufficient-room handling", /insufficient-room/],
  ["the collisions field", /collisions/],
  ["optional helpers", /proofmarks\/helpers/],
  ["the end-user picker option", /picker/],
  ["the RTL issue", /unverified-direction/],
];
// Phrases that contradicted the integrated contract in earlier revisions.
const forbidden = [
  ["the appended robustness section", /Consumer robustness/i],
  ["the ambiguous conflict wording", /Overlapping applications throw/i],
  ["the stale-overlay wording", /retains the last valid overlay/i],
  ["the over-strict export rule", /For export,? (?:use|set) `?animate: false`?/i],
  ["repository-only guide pointers", /^(?:Canonical guide|For schemas and examples, read): `docs\//m],
];
// A paragraph that triggers the first pattern must also satisfy the second.
const qualified = [
  ["mentions textContent without getSourceText", /textContent/, /getSourceText/],
  ["mentions styles.css without saying it is optional", /styles\.css/, /optional/i],
  ["says Proofmarks does not author corrections without naming helpers", /(?:does not|doesn't|never) author/i, /helpers/],
];

function check(condition, message) {
  if (!condition) errors.push(message);
}

const schema = readFileSync(join(repository, "packages/proofmarks/src/schema.ts"), "utf8");
const schemaOperations = [...schema.matchAll(/type:\s*"([a-z-]+)"/g)]
  .map((match) => match[1])
  .filter((operation) => operations.includes(operation));
check(
  JSON.stringify(schemaOperations) === JSON.stringify(operations),
  `Agent operation list drifted from the public schema: ${schemaOperations.join(", ")}.`,
);

for (const relativePath of files) {
  const absolutePath = join(repository, relativePath);
  check(existsSync(absolutePath), `Missing agent enablement file: ${relativePath}.`);
  if (!existsSync(absolutePath)) continue;
  const content = readFileSync(absolutePath, "utf8");
  for (const operation of operations) {
    check(content.includes(operation), `${relativePath} is missing ${operation}.`);
  }
  check(/UTF-16/i.test(content), `${relativePath} is missing the UTF-16 rule.`);
  check(/textContent/.test(content), `${relativePath} is missing the textContent rule.`);
  check(/whitespace/i.test(content), `${relativePath} is missing the whitespace-only rule.`);
  check(/onIssue/.test(content), `${relativePath} is missing unsupported-capability handling.`);
  check(
    /(never (?:fabricate|invent)|do not (?:fabricate|invent))/i.test(content),
    `${relativePath} is missing the no-fabrication rule.`,
  );
  for (const [pack, pattern] of packs) {
    check(pattern.test(content), `${relativePath} is missing the ${pack} notation pack.`);
  }
  for (const [label, pattern] of required) {
    check(pattern.test(content), `${relativePath} is missing ${label}.`);
  }
  for (const [label, pattern] of forbidden) {
    check(!pattern.test(content), `${relativePath} reintroduces ${label}.`);
  }
  for (const paragraph of content.split(/\n\s*\n|\n(?=\s*(?:[-*]|\d+\.)\s)/)) {
    for (const [label, trigger, qualifier] of qualified) {
      if (trigger.test(paragraph) && !qualifier.test(paragraph)) {
        errors.push(`${relativePath} ${label}: "${paragraph.trim().slice(0, 80)}…"`);
      }
    }
  }
}

const canonicalExample = readFileSync(join(repository, "docs/agent-guide.md"), "utf8").match(/```tsx\n([\s\S]*?)```/)?.[1] ?? "";
check(/padding: "44px 20px", lineHeight: 1\.8/.test(canonicalExample), "The agent guide's main example must reserve room like the README example.");

const packageGuide = readFileSync(
  join(repository, "packages/proofmarks/AGENT_GUIDE.md"),
  "utf8",
);
for (const entry of [
  "proofmarks/react",
  "proofmarks/notations",
  "proofmarks/styles.css",
]) {
  check(packageGuide.includes(entry), `Offline package guide is missing ${entry}.`);
}

const manifest = JSON.parse(
  readFileSync(join(repository, "packages/proofmarks/package.json"), "utf8"),
);
check(
  manifest.files?.includes("AGENT_GUIDE.md"),
  "The npm package files list does not include AGENT_GUIDE.md.",
);

console.log(JSON.stringify({ files: files.length, operations, errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;
