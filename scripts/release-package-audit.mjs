import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const packageDirectory = join(repository, "packages", "proofmarks");
const manifest = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8"));
const errors = [];
const packRoot = mkdtempSync(join(tmpdir(), "proofmarks-package-audit-"));
const npmEnvironment = {
  ...process.env,
  NPM_CONFIG_CACHE: join(packRoot, "npm-cache"),
};

function check(condition, message) {
  if (!condition) errors.push(message);
}

const expectedExports = [
  ".",
  "./react",
  "./notations",
  "./notations/jis",
  "./notations/gb",
  "./notations/cns3927",
  "./notations/ks",
  "./notations/en-us",
  "./styles.css",
  "./package.json",
  "./helpers",
];
check(
  JSON.stringify(Object.keys(manifest.exports)) === JSON.stringify(expectedExports),
  "Package exports differ from the documented entry list.",
);
for (const field of [
  "name",
  "version",
  "description",
  "repository",
  "homepage",
  "bugs",
  "keywords",
  "type",
  "license",
  "sideEffects",
  "files",
  "exports",
  "types",
  "peerDependencies",
]) {
  check(manifest[field] !== undefined, `Package metadata is missing ${field}.`);
}
check(manifest.name === "proofmarks", "Package name must remain proofmarks.");
check(manifest.version === "0.1.0", "Release candidate version must be 0.1.0.");
check(manifest.license !== "UNLICENSED", "Release blocker: the public package license is UNLICENSED.");
check(
  manifest.peerDependencies?.react === "^18.2.0 || ^19.0.0",
  "React peer range differs from the tested React 18/19 contract.",
);

const declarationFiles = readdirSync(join(packageDirectory, "dist"), { recursive: true })
  .filter((name) => String(name).endsWith(".d.ts"));
const declarations = declarationFiles
  .map((name) => readFileSync(join(packageDirectory, "dist", String(name)), "utf8"))
  .join("\n");
for (const internalName of [
  "@proofmarks/",
  "SceneNode",
  "ProofmarkScene",
  "LogicalRect",
  "LayoutOptions",
  "ProseMirror",
  "suggesting",
  "reference-corpus",
  "test fixture",
]) {
  check(!declarations.includes(internalName), `Public declarations leak ${internalName}.`);
}

const sourceMaps = readdirSync(join(packageDirectory, "dist"), { recursive: true })
  .filter((name) => String(name).endsWith(".map"));
check(sourceMaps.length > 0, "The intentional V0.1 source-map policy produced no maps.");
for (const name of sourceMaps) {
  const map = JSON.parse(readFileSync(join(packageDirectory, "dist", String(name)), "utf8"));
  for (const source of map.sources ?? []) {
    check(!source.startsWith("/"), `Source map ${name} contains an absolute source path.`);
    check(!source.includes("/Users/"), `Source map ${name} contains a local user path.`);
    check(!source.includes("/var/folders/"), `Source map ${name} contains a temporary path.`);
  }
}

const dryRun = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: packageDirectory,
  encoding: "utf8",
  env: npmEnvironment,
}));
check(dryRun.length === 1, "npm pack --dry-run did not return one package.");

const packed = JSON.parse(execFileSync(
  "npm",
  ["pack", "--json", "--pack-destination", packRoot],
  { cwd: packageDirectory, encoding: "utf8", env: npmEnvironment },
));
const archive = join(packRoot, packed[0]?.filename ?? "");
check(existsSync(archive), "npm pack did not create the audited local RC archive.");
const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
  .trim()
  .split("\n");
for (const entry of entries) {
  check(
    /^package\/(?:LICENSE|README\.md|AGENT_GUIDE\.md|package\.json|src\/styles\.css|dist\/.+)$/.test(entry),
    `Unexpected packed file: ${entry}`,
  );
}
check(
  entries.includes("package/AGENT_GUIDE.md"),
  "Packed archive is missing the offline agent guide.",
);
for (const forbidden of [
  "apps/",
  "demos/",
  "docs/",
  "tests/",
  "fixtures/",
  "playwright",
  "coverage",
  ".pdf",
  ".png",
  ".jpg",
]) {
  check(entries.every((entry) => !entry.includes(forbidden)), `Packed archive contains ${forbidden}.`);
}

const runtimeEntries = {
  root: ["createProofmarks", "getSourceText", "validateCorrection", "validateCorrections"],
  helpers: ["applyCorrections", "correctionsFromDiff", "findRange", "getSourceText", "offsetsFromSelection"],
  react: ["Proofmarks"],
  notations: ["cns3927", "enUS", "gb", "jis", "ks"],
};
const runtimeResults = {};
for (const [name, expected] of Object.entries(runtimeEntries)) {
  const file = name === "root" ? "index.js" : `${name}.js`;
  const exports = Object.keys(await import(join(packageDirectory, "dist", file))).sort();
  runtimeResults[name] = exports;
  check(
    JSON.stringify(exports) === JSON.stringify([...expected].sort()),
    `${name} runtime exports differ from the documented contract: ${exports.join(", ")}.`,
  );
}

console.log(JSON.stringify({
  archive,
  files: entries.length,
  packedBytes: packed[0]?.size,
  unpackedBytes: packed[0]?.unpackedSize,
  runtimeExports: runtimeResults,
  sourceMaps: sourceMaps.length,
  errors,
}, null, 2));

if (errors.length > 0) process.exitCode = 1;
