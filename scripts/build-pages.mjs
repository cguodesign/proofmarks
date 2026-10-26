import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const base = process.env.PROOFMARKS_SITE_BASE ?? "/proofmarks/";
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) {
  throw new Error("PROOFMARKS_SITE_BASE must be / or a slash-delimited path such as /proofmarks/.");
}

execFileSync("pnpm", ["--filter", "@proofmarks/playground", "exec", "vite", "build", "--base", base, "--outDir", "dist-pages"], {
  cwd: repository,
  stdio: "inherit",
});

const output = resolve(repository, "apps/playground/dist-pages");
const html = readFileSync(resolve(output, "index.html"), "utf8");
// Pages serves directories, without the dev server's implicit SPA fallback.
for (const route of ["get-started", "playground", "marks", "references", "docs", "demo", "suggest", "workbench", "compare", "dx", "layout"]) {
  const directory = resolve(output, route);
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "index.html"), html);
}
writeFileSync(resolve(output, ".nojekyll"), "");
writeFileSync(resolve(output, "404.html"), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Page not found — re:proofmarks</title><body>
<main><h1>Page not found</h1><p><a href="${base}">Return to re:proofmarks</a></p></main>
</body></html>\n`);
console.log(`Pages artifact ready: ${output} (base ${base})`);
