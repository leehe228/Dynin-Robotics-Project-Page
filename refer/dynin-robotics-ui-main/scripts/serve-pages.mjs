import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const basePath = "/Dynin-Robotics-Project-Page";
const exportRoot = fileURLToPath(new URL("../out/", import.meta.url));

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

export function resolveRequestPath(requestUrl = "/") {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === basePath || pathname.startsWith(`${basePath}/`)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const relativePath = normalize(pathname).replace(/^[/\\]+/, "");
  const filePath = join(exportRoot, relativePath);
  const rootPrefix = exportRoot.endsWith(sep) ? exportRoot : `${exportRoot}${sep}`;

  if (filePath !== exportRoot && !filePath.startsWith(rootPrefix)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    return join(filePath, "index.html");
  }

  return filePath;
}

export function createPreviewServer() {
  return createServer((request, response) => {
    const filePath = resolveRequestPath(request.url);

    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type":
        contentTypes.get(extname(filePath).toLowerCase()) ??
        "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createPreviewServer();
  server.listen(port, host, () => {
    console.log(`Dynin-Robotics Pages preview: http://localhost:${port}/`);
  });
}
