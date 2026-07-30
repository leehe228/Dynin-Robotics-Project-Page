import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const exportRoot = new URL("../out/", import.meta.url);
const indexUrl = new URL("index.html", exportRoot);

test("exports the complete Dynin-Robotics landing page", async () => {
  const html = await readFile(indexUrl, "utf8");
  const pageSource = await readFile(
    new URL("app/page.tsx", projectRoot),
    "utf8",
  );

  assert.match(html, /Dynin-Robotics/);
  assert.match(html, /unified objective training/);
  assert.match(html, /29\.15× higher effective action-token throughput/);
  assert.match(html, /id="overview"/);
  assert.match(html, /overview-original-ui/);
  assert.match(html, /aria-label="Robot capability"/);
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
  assert.match(pageSource, /const tokenCount = 10;/);
  assert.match(
    pageSource,
    /const narrativeOutputCommitCounts = \[[\s\S]*?0, 0, 0, 0, 0, 2, 4, 6, 8, 10, 10,[\s\S]*?\];/,
  );
  assert.match(
    pageSource,
    /instruction: \[4, 9, 1, 7, 0, 6, 3, 8, 2, 5\]/,
  );
  assert.match(html, /Put the glue stick inside the open drawer/);
  assert.match(pageSource, /Take the purple plush toy out of the bowl/);
  assert.match(pageSource, /Unfold the white towel on the table/);
  assert.match(html, /0\.01, 0\.13, 0\.63, 0\.40, -0\.25, -0\.05/);
  assert.match(pageSource, /0\.01, 0\.13, 0\.63,/);
  assert.match(pageSource, /0\.40, -0\.25, -0\.05/);
  assert.match(html, /-0\.80, -0\.55, 0\.18,/);
  assert.match(html, /0\.04, -0\.15, 0\.41/);
  assert.match(pageSource, /Predicted world state/);
  assert.match(pageSource, /Predicted goal state/);
  assert.match(pageSource, /Push the faucet of the sink/);
  assert.match(pageSource, /slightly to the left/);
  assert.match(pageSource, /kind: "sequence"/);
  assert.match(pageSource, /assets: Array\.from\([\s\S]*?length: 20/);
  assert.match(pageSource, /ObjectiveFrameSequence/);
  assert.match(pageSource, /setInterval[\s\S]*?100/);
  assert.match(pageSource, /objective-sequence-still/);
  assert.match(
    pageSource,
    /overviewNarrativeObjectives\.includes\(objective\.key\)/,
  );
  assert.match(
    pageSource,
    /const \[overviewStage, setOverviewStage\] = useState\(0\);/,
  );
  assert.match(
    pageSource,
    /1000, 850, 1050, 1050, 320, 200, 200, 200, 200, 200, 1800/,
  );
  assert.match(pageSource, /objective-condition-value-stack/);
  assert.match(pageSource, /objective-condition-value \$\{valueClass\} is-base/);
  assert.match(pageSource, /objective-condition-value \$\{valueClass\} is-flight/);
  assert.match(pageSource, /hasNarrativeAnimation/);
});

test("copies required paper assets into the static export", async () => {
  const files = [
    "paper.pdf",
    "assets/paper/world-modeling-qualitative.png",
    "assets/paper/goal-state-qualitative.png",
    "assets/paper/task-understanding-qualitative.png",
    "assets/paper/real-world-tasks.png",
    "assets/paper/vlabench-instructions.png",
    "assets/overview/policy_state.png",
    "assets/overview/policy_goal.png",
    "assets/overview/wm_state.png",
    "assets/overview/wm_predict.png",
    "assets/overview/goal_state.png",
    "assets/overview/goal_predict.png",
    ...Array.from(
      { length: 20 },
      (_, index) =>
        `assets/overview/tu_states/tu_state_${String(index).padStart(2, "0")}.png`,
    ),
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
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  const pageSource = await readFile(
    new URL("app/page.tsx", projectRoot),
    "utf8",
  );

  assert.match(html, /dynin-color-theme/);
  assert.match(html, /prefers-color-scheme: light/);
  assert.match(html, /Choose color theme/);
  assert.match(html, /Use light theme/);
  assert.match(html, /Use dark theme/);
  assert.match(html, /Use system theme/);
  assert.match(html, /theme-light/);
  assert.match(html, /theme-dark/);
  assert.match(html, /theme-auto/);
  assert.match(
    css,
    /:root\[data-theme="light"\] \.overview-original-ui/,
  );
  assert.match(
    css,
    /\.overview-original-ui \.generation-progress \{\s+display: none;/,
  );
  assert.match(
    css,
    /\.overview-original-ui \.objective-switcher \{[\s\S]*?background: transparent;/,
  );
  assert.match(
    css,
    /\.overview-original-ui \.output-port__glyph i,[\s\S]*?aspect-ratio: 1;/,
  );
  assert.match(
    css,
    /output-port\.is-active[\s\S]*?i\.is-pending[\s\S]*?repeating-linear-gradient/,
  );
  assert.match(
    css,
    /\.overview-original-ui \.condition-flow-dot,[\s\S]*?\.overview-original-ui \.output-flow-comet \{\s+opacity: 0;/,
  );
  assert.match(
    css,
    /has-narrative-animation\.phase-2[\s\S]*?condition-flow-dot[\s\S]*?animation: legacy-condition-flow[\s\S]*?1\s+both;/,
  );
  assert.match(
    css,
    /has-narrative-animation\.phase-3[\s\S]*?output-flow-comet[\s\S]*?animation: legacy-output-flow[\s\S]*?1 both;/,
  );
  assert.match(css, /--overview-idle-route: #c5cdd5;/);
  assert.match(
    css,
    /has-narrative-animation\.phase-0[\s\S]*?condition-route-highlight \{[\s\S]*?opacity: 0;/,
  );
  assert.match(
    css,
    /\.objective-sequence-image \{[\s\S]*?object-fit: cover;/,
  );
  assert.match(
    css,
    /\.objective-sequence-still \{[\s\S]*?background-image: var\(--sequence-frame-image\);/,
  );
  assert.match(
    pageSource,
    /prefers-reduced-motion: reduce[\s\S]*?matches/,
  );
});
