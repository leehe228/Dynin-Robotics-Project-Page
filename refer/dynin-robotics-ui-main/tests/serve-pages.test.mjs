import assert from "node:assert/strict";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createPreviewServer,
  resolveRequestPath,
} from "../scripts/serve-pages.mjs";

const exportRoot = new URL("../out/", import.meta.url);

test("serves the GitHub Pages export from both local URL shapes", async () => {
  const html = await readFile(new URL("index.html", exportRoot), "utf8");
  const cssHref = html.match(/href="([^"]+\.css[^"]*)"/)?.[1];

  assert.ok(cssHref, "The static export should link a stylesheet.");
  assert.equal(
    resolveRequestPath("/"),
    fileURLToPath(new URL("index.html", exportRoot)),
  );
  assert.equal(
    resolveRequestPath("/Dynin-Robotics-Project-Page/"),
    fileURLToPath(new URL("index.html", exportRoot)),
  );

  const cssPath = resolveRequestPath(cssHref);
  assert.ok(cssPath, "The preview should map the Pages-prefixed stylesheet.");
  await access(cssPath);
});

test("returns every exported stylesheet and script over HTTP", async (context) => {
  const server = createPreviewServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;

  for (const pagePath of ["/", "/Dynin-Robotics-Project-Page/"]) {
    const response = await fetch(`${origin}${pagePath}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  }

  const html = await readFile(new URL("index.html", exportRoot), "utf8");
  const assetPaths = [
    ...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js)(?:[^"]*)?)"/g),
  ].map((match) => match[1]);

  assert.ok(assetPaths.length > 0);
  for (const assetPath of assetPaths) {
    const response = await fetch(`${origin}${assetPath}`);
    assert.equal(response.status, 200, assetPath);
    assert.doesNotMatch(
      response.headers.get("content-type") ?? "",
      /^text\/plain/,
      assetPath,
    );
  }
});
