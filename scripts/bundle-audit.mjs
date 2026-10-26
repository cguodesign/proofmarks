import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..", "packages", "proofmarks");
const entries = {
  engine: { file: "dist/index.js" },
  reactWithEngine: { file: "dist/react.js" },
  reactAdapter: {
    file: "src/react.tsx",
    external: ["./index"],
  },
  jis: { file: "dist/notations/jis.js" },
  gb: { file: "dist/notations/gb.js" },
  cns3927: { file: "dist/notations/cns3927.js" },
  ks: { file: "dist/notations/ks.js" },
  enUS: { file: "dist/notations/en-us.js" },
  allNotations: { file: "dist/notations.js" },
};

const rows = [];
const outputs = new Map();
for (const [name, entry] of Object.entries(entries)) {
  const result = await build({
    entryPoints: [resolve(packageRoot, entry.file)],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    external: ["react", "react/jsx-runtime", ...(entry.external ?? [])],
    logLevel: "error",
  });
  const bytes = result.outputFiles[0]?.contents;
  if (!bytes) throw new Error(`No bundle output for ${name}.`);
  outputs.set(name, new TextDecoder().decode(bytes));
  rows.push({
    entry: name,
    minifiedBytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes).byteLength,
  });
}

function assertExcludes(entry, values) {
  const output = outputs.get(entry) ?? "";
  for (const value of values) {
    if (output.includes(value)) {
      throw new Error(`${entry} unexpectedly contains ${value}.`);
    }
  }
}

assertExcludes("engine", ["react", "ja-jis-z8208", "zh-gb-t14706", "cns3927", "ko-ks-a0104", "en-us-traditional"]);
assertExcludes("jis", ["zh-gb-t14706", "cns3927", "ko-ks-a0104", "en-us-traditional"]);
assertExcludes("gb", ["ja-jis-z8208", "cns3927", "ko-ks-a0104", "en-us-traditional"]);
assertExcludes("cns3927", ["ja-jis-z8208", "zh-gb-t14706", "ko-ks-a0104", "en-us-traditional"]);
assertExcludes("ks", ["ja-jis-z8208", "zh-gb-t14706", "cns3927", "en-us-traditional"]);
assertExcludes("enUS", ["ja-jis-z8208", "zh-gb-t14706", "cns3927", "ko-ks-a0104"]);

console.table(rows);
