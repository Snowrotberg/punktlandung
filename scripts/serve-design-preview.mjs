import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "test-artifacts/design-comparison");
const port = Number(process.argv[3] ?? 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${request.headers.host}`).pathname);
  const relativePath = pathname === "/" ? "design-preview-rendered.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(root, relativePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => response.writeHead(404).end("Not found"));
  response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
  stream.pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Design preview available at http://127.0.0.1:${port}`);
});
