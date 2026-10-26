import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "../apps/playground/dist-pages");
const base = process.env.PROOFMARKS_SITE_BASE ?? "/proofmarks/";
const port = Number(process.env.PROOFMARKS_PAGES_TEST_PORT ?? 4175);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain", ".svg": "image/svg+xml" };

// Test the static artifact with directory redirects and real 404s, never SPA fallback.
createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith(base)) throw new Error("Outside site base");
    let file = resolve(root, decodeURIComponent(url.pathname.slice(base.length)));
    if (file !== root && !file.startsWith(`${root}${sep}`)) throw new Error("Outside artifact");
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
        return;
      }
      file = resolve(file, "index.html");
    }
    await stat(file);
    const extension = file.slice(file.lastIndexOf("."));
    response.writeHead(200, { "content-type": `${types[extension] ?? "application/octet-stream"}; charset=utf-8` });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    createReadStream(resolve(root, "404.html")).pipe(response);
  }
}).listen(port, "127.0.0.1", () => console.log(`Static Pages preview: http://127.0.0.1:${port}${base}`));
