import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const exportRoot = new URL("../out/", import.meta.url);
const indexUrl = new URL("index.html", exportRoot);

test("exports the complete Dynin-Robotics landing page", async () => {
  const html = await readFile(indexUrl, "utf8");

  assert.match(html, /Dynin-Robotics/);
  assert.match(html, /One shared trajectory/);
  assert.match(html, /id="overview"/);
  assert.match(html, /id="capabilities"/);
  assert.match(html, /id="model"/);
  assert.match(html, /id="training"/);
  assert.match(html, /id="inference"/);
  assert.match(html, /id="examples"/);
  assert.match(html, /id="performance"/);
  assert.match(html, /\/Dynin-Robotics-Project-Page\/_next\//);
  assert.match(html, /\/Dynin-Robotics-Project-Page\/paper\.pdf/);
  assert.match(
    html,
    /https:\/\/leehe228\.github\.io\/Dynin-Robotics-Project-Page\/og\.png/,
  );
  assert.doesNotMatch(html, /kim-jake|dynin-robotics-ui/);
  assert.doesNotMatch(
    html,
    /github\.com\/AIDASLab\/Dynin-Robotics|huggingface\.co\/snu-aidas\/Dynin-Robotics|https:\/\/dynin\.ai\/robotics\//,
  );
  assert.match(html, /release pending/);
  assert.match(html, /Goal-State Query/);
  assert.match(html, /World-Model Query/);
  assert.match(html, /Figure 4 training-objective mapping/);
  assert.doesNotMatch(html, /Original unified-model interaction/);
  assert.match(html, /ABot-M0/);
  assert.match(html, /asset placeholder/);
});

test("copies required paper assets into the static export", async () => {
  const files = [
    "paper.pdf",
    "assets/paper/world-modeling-qualitative.png",
    "assets/paper/goal-state-qualitative.png",
    "assets/paper/task-understanding-qualitative.png",
    "assets/paper/real-world-tasks.png",
    "assets/paper/vlabench-instructions.png",
  ];

  await Promise.all(
    files.map(async (path) => {
      const url = new URL(path, exportRoot);
      await access(url);
      assert.ok((await stat(url)).size > 0, `${path} should not be empty`);
    }),
  );
});

test("keeps the source PDF outside rendered page media", async () => {
  const html = await readFile(indexUrl, "utf8");
  assert.doesNotMatch(html, /<(iframe|embed|object)[^>]+paper\.pdf/i);
  await access(new URL("public/paper.pdf", projectRoot));
});

test("keeps qualitative evidence as native empty media slots", async () => {
  const html = await readFile(indexUrl, "utf8");

  assert.doesNotMatch(html, /<img\b/i);
  assert.doesNotMatch(html, /assets\/paper\//);
  assert.match(html, /Media intentionally omitted in this draft/);
});

test("ships a system-aware three-way theme toggle", async () => {
  const html = await readFile(indexUrl, "utf8");

  assert.match(html, /dynin-color-theme/);
  assert.match(html, /prefers-color-scheme: light/);
  assert.match(html, /Choose color theme/);
  assert.match(html, /Use light theme/);
  assert.match(html, /Use dark theme/);
  assert.match(html, /Use system theme/);
  assert.match(html, /theme-light/);
  assert.match(html, /theme-dark/);
  assert.match(html, /theme-auto/);
});
