import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const rootDir = resolve(process.cwd());
const port = Number(process.argv[2] || process.env.PORT || 4173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
}

function getFilePath(urlPathname = "/") {
  const pathname = decodeURIComponent(urlPathname.split("?")[0]);
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");

  return join(rootDir, safePath);
}

const server = createServer(async (request, response) => {
  try {
    const filePath = getFilePath(request.url || "/");

    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      sendNotFound(response);
      return;
    }

    const info = await stat(filePath);

    if (!info.isFile()) {
      sendNotFound(response);
      return;
    }

    const type = MIME_TYPES[extname(filePath)] || "application/octet-stream";

    response.writeHead(200, { "Content-Type": type });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Server error: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Static server running on http://127.0.0.1:${port}`);
});
