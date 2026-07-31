import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const exportRoot = new URL("../out/", import.meta.url);
const indexUrl = new URL("index.html", exportRoot);
const demonstrationVideoPaths = [
  "assets/benchmark/libero/spatial/spatial_task00_init000_steps106.mp4",
  "assets/benchmark/libero/spatial/spatial_task04_init024_steps121.mp4",
  "assets/benchmark/libero/spatial/spatial_task06_init037_steps108.mp4",
  "assets/benchmark/libero/spatial/spatial_task09_init049_steps119.mp4",
  "assets/benchmark/libero/object/object_task00_init000_steps182.mp4",
  "assets/benchmark/libero/object/object_task04_init024_steps142.mp4",
  "assets/benchmark/libero/object/object_task06_init037_steps169.mp4",
  "assets/benchmark/libero/object/object_task09_init049_steps137.mp4",
  "assets/benchmark/libero/goal/goal_task00_init000_steps151.mp4",
  "assets/benchmark/libero/goal/goal_task04_init024_steps081.mp4",
  "assets/benchmark/libero/goal/goal_task06_init037_steps091.mp4",
  "assets/benchmark/libero/goal/goal_task09_init049_steps119.mp4",
  "assets/benchmark/libero/long/long_task00_init000_steps287.mp4",
  "assets/benchmark/libero/long/long_task04_init024_steps252.mp4",
  "assets/benchmark/libero/long/long_task06_init037_steps210.mp4",
  "assets/benchmark/libero/long/long_task09_init049_steps238.mp4",
  "assets/benchmark/libero-plus/camera_viewpoints/success_01__libero_spatial__task_0713__difficulty_1.mp4",
  "assets/benchmark/libero-plus/camera_viewpoints/success_03__libero_spatial__task_0706__difficulty_1.mp4",
  "assets/benchmark/libero-plus/robot_initial_states/success_01__libero_spatial__task_0460__difficulty_1.mp4",
  "assets/benchmark/libero-plus/robot_initial_states/success_03__libero_spatial__task_0292__difficulty_1.mp4",
  "assets/benchmark/libero-plus/language_instructions/success_01__libero_spatial__task_1291__difficulty_1.mp4",
  "assets/benchmark/libero-plus/language_instructions/success_03__libero_spatial__task_1004__difficulty_1.mp4",
  "assets/benchmark/libero-plus/light_conditions/success_01__libero_spatial__task_2303__difficulty_1.mp4",
  "assets/benchmark/libero-plus/light_conditions/success_03__libero_spatial__task_2265__difficulty_1.mp4",
  "assets/benchmark/libero-plus/background_textures/success_01__libero_spatial__task_0022__difficulty_1.mp4",
  "assets/benchmark/libero-plus/background_textures/success_03__libero_spatial__task_0107__difficulty_1.mp4",
  "assets/benchmark/libero-plus/sensor_noise/success_01__libero_spatial__task_1525__difficulty_1.mp4",
  "assets/benchmark/libero-plus/sensor_noise/success_03__libero_spatial__task_1599__difficulty_1.mp4",
  "assets/benchmark/libero-plus/objects_layout/success_01__libero_spatial__task_1980__difficulty_1.mp4",
  "assets/benchmark/libero-plus/objects_layout/success_03__libero_spatial__task_1977__difficulty_1.mp4",
  "assets/benchmark/realworld/real_cubestack.mp4",
  "assets/benchmark/realworld/real_pnp1.mp4",
  "assets/benchmark/realworld/real_pnp2.mp4",
  "assets/benchmark/realworld/real_pnp3.mp4",
  "assets/benchmark/realworld/real_pnp4.mp4",
  "assets/benchmark/realworld/real_table.mp4",
  "assets/benchmark/realworld/real_table1.mp4",
  "assets/benchmark/realworld/real_table2.mp4",
  "assets/benchmark/realworld/real_table3.mp4",
  "assets/benchmark/realworld/real_table4.mp4",
];

test("exports the complete Dynin-Robotics landing page", async () => {
  const html = await readFile(indexUrl, "utf8");
  const pageSource = await readFile(
    new URL("app/page.tsx", projectRoot),
    "utf8",
  );
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");

  assert.match(html, /Dynin-Robotics/);
  assert.match(html, /unified objective training/);
  assert.match(html, /29\.15× higher effective action-token throughput/);
  assert.match(html, /id="overview"/);
  assert.match(html, /overview-original-ui/);
  assert.match(html, /paradigm-legend-inline/);
  assert.match(html, /Figure token legend/);
  assert.doesNotMatch(pageSource, /paradigm-legend-popover/);
  assert.doesNotMatch(pageSource, /ⓘ/);
  assert.match(
    css,
    /\.paradigm-legend-inline \{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?outline: 0;/,
  );
  assert.match(html, /aria-label="Robot capability"/);
  assert.match(html, /id="capabilities"/);
  const capabilitiesStart = html.indexOf('id="capabilities"');
  const capabilitiesEnd = html.indexOf('id="model"', capabilitiesStart);
  const capabilitiesSection = html.slice(
    capabilitiesStart,
    capabilitiesEnd,
  );
  assert.match(
    capabilitiesSection,
    /Four Capabilities for Robotics, One Unified Model/,
  );
  assert.match(
    capabilitiesSection,
    /Dynin-Robotics unifies policy generation, world modeling, task understanding, and goal-state prediction in a single masked-diffusion backbone\./,
  );
  assert.equal(
    (capabilitiesSection.match(/class="capability-summary-card"/g) ?? []).length,
    4,
  );
  assert.equal(
    (capabilitiesSection.match(/capability-summary-card__io/g) ?? []).length,
    4,
  );
  assert.ok(
    capabilitiesSection.indexOf("Policy") <
      capabilitiesSection.indexOf("World Modeling"),
  );
  assert.ok(
    capabilitiesSection.indexOf("World Modeling") <
      capabilitiesSection.indexOf("Goal-State Prediction"),
  );
  assert.ok(
    capabilitiesSection.indexOf("Goal-State Prediction") <
      capabilitiesSection.indexOf("Task Understanding"),
  );
  assert.match(
    capabilitiesSection,
    /Generate robot action sequences from the current visual state and task instruction\./,
  );
  assert.match(
    capabilitiesSection,
    /Predict future visual states from observed frames and robot actions\./,
  );
  assert.match(
    capabilitiesSection,
    /Generate a goal state from an initial observation and language instruction\./,
  );
  assert.match(
    capabilitiesSection,
    /Decode an observed task trajectory into a natural-language task description\./,
  );
  assert.match(
    capabilitiesSection,
    /Current states[\s\S]*?Instructions[\s\S]*?Goal state[\s\S]*?Sensor[\s\S]*?Action sequence/,
  );
  assert.match(
    capabilitiesSection,
    /Current states[\s\S]*?Instructions[\s\S]*?Actions[\s\S]*?Next states/,
  );
  assert.match(
    capabilitiesSection,
    /Initial state[\s\S]*?Instructions[\s\S]*?Goal state/,
  );
  assert.match(
    capabilitiesSection,
    /Task video frames[\s\S]*?Task description/,
  );
  assert.equal(
    (capabilitiesSection.match(/class="capability-policy-example"/g) ?? [])
      .length,
    1,
  );
  assert.match(capabilitiesSection, /assets\/training\/policy_input\.png/);
  assert.match(capabilitiesSection, /assets\/training\/policy_goal\.png/);
  assert.match(
    capabilitiesSection,
    /Put the glue stick inside the open drawer/,
  );
  assert.match(
    capabilitiesSection,
    />-0\.80<\/span><span>-0\.55<\/span><span>0\.18<\/span><span>0\.04<\/span><span>-0\.15<\/span><span>0\.41<\/span>/,
  );
  assert.equal(
    (capabilitiesSection.match(/class="capability-world-example"/g) ?? [])
      .length,
    1,
  );
  const worldExampleStart = capabilitiesSection.indexOf(
    'class="capability-world-example"',
  );
  const worldExampleHtml = capabilitiesSection.slice(
    worldExampleStart,
    capabilitiesSection.indexOf("</article>", worldExampleStart),
  );
  assert.match(worldExampleHtml, /assets\/training\/wm_input\.png/);
  assert.match(worldExampleHtml, /assets\/training\/wm_gen\.png/);
  assert.match(
    worldExampleHtml,
    /Take the purple plush toy out of the bowl/,
  );
  assert.match(
    worldExampleHtml,
    />0\.01<\/span><span>0\.13<\/span><span>0\.63<\/span><span>0\.40<\/span><span>-0\.25<\/span><span>-0\.05<\/span>/,
  );
  assert.ok(
    worldExampleHtml.indexOf("Current state") <
      worldExampleHtml.indexOf("Instruction"),
  );
  assert.ok(
    worldExampleHtml.indexOf("Instruction") <
      worldExampleHtml.indexOf("Action"),
  );
  assert.ok(
    worldExampleHtml.indexOf("Action") <
      worldExampleHtml.indexOf("Generated next state"),
  );
  assert.equal(
    (capabilitiesSection.match(/class="capability-goal-example"/g) ?? [])
      .length,
    1,
  );
  const goalExampleStart = capabilitiesSection.indexOf(
    'class="capability-goal-example"',
  );
  const goalExampleHtml = capabilitiesSection.slice(
    goalExampleStart,
    capabilitiesSection.indexOf("</article>", goalExampleStart),
  );
  assert.match(goalExampleHtml, /assets\/training\/goal_input\.png/);
  assert.match(goalExampleHtml, /assets\/training\/goal_gen\.png/);
  assert.match(goalExampleHtml, /Unfold the white towel on the table/);
  assert.ok(
    goalExampleHtml.indexOf("Initial state") <
      goalExampleHtml.indexOf("Instruction"),
  );
  assert.ok(
    goalExampleHtml.indexOf("Instruction") <
      goalExampleHtml.indexOf("Generated goal state"),
  );
  assert.equal(
    (capabilitiesSection.match(/class="capability-task-example"/g) ?? [])
      .length,
    1,
  );
  const taskExampleStart = capabilitiesSection.indexOf(
    'class="capability-task-example"',
  );
  const taskExampleHtml = capabilitiesSection.slice(
    taskExampleStart,
    capabilitiesSection.indexOf("</article>", taskExampleStart),
  );
  assert.match(
    taskExampleHtml,
    /assets\/training\/tu_input1\.png[\s\S]*?assets\/training\/tu_input2\.png[\s\S]*?assets\/training\/tu_input3\.png[\s\S]*?assets\/training\/tu_input4\.png[\s\S]*?assets\/training\/tu_input5\.png/,
  );
  assert.match(
    taskExampleHtml,
    /Push the faucet of the sink slightly to the left/,
  );
  assert.ok(
    taskExampleHtml.indexOf("Task video frames") <
      taskExampleHtml.indexOf("Generated task description"),
  );
  assert.equal(
    (capabilitiesSection.match(/class="is-vision"/g) ?? []).length,
    7,
  );
  assert.equal(
    (capabilitiesSection.match(/class="is-text"/g) ?? []).length,
    4,
  );
  assert.equal(
    (capabilitiesSection.match(/class="is-action"/g) ?? []).length,
    2,
  );
  assert.equal(
    (capabilitiesSection.match(/class="is-sensor"/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(
    capabilitiesSection,
    /capability-stack|capability-chapter|unified-query-figure|Visible context|Masked target/,
  );
  assert.match(
    css,
    /\.capability-summary-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?grid-auto-rows: 1fr;[\s\S]*?margin-top: clamp\(32px, 4vw, 52px\);/,
  );
  assert.match(
    css,
    /\.capability-summary-card \{[\s\S]*?padding: clamp\(26px, 3\.2vw, 40px\);[\s\S]*?border-radius: 22px;[\s\S]*?background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.capability-summary-card h3 \{[\s\S]*?font-size: clamp\(24px, 2\.4vw, 30px\);/,
  );
  assert.match(
    css,
    /\.capability-summary-card p \{[\s\S]*?margin-top: 9px;[\s\S]*?font-size: 14px;[\s\S]*?line-height: 1\.6;/,
  );
  assert.match(
    css,
    /\.capability-summary-card__io \{[\s\S]*?align-self: end;[\s\S]*?border-top: 1px solid var\(--line\);/,
  );
  assert.match(
    css,
    /\.capability-summary-card__io dd span \{[\s\S]*?border-radius: 8px;[\s\S]*?font-size: 12px;/,
  );
  assert.match(
    css,
    /\.capability-summary-card__io dd span\.is-vision \{[\s\S]*?background: var\(--blue-soft\);[\s\S]*?color: var\(--vision-ink\);/,
  );
  assert.match(
    css,
    /\.capability-summary-card__io dd span\.is-text \{[\s\S]*?background: var\(--instruction-surface\);[\s\S]*?color: var\(--instruction-ink\);/,
  );
  assert.match(
    css,
    /\.capability-summary-card__io dd span\.is-action \{[\s\S]*?background: var\(--action-surface\);[\s\S]*?color: var\(--action-ink\);/,
  );
  assert.match(
    css,
    /\.capability-summary-card__io dd span\.is-sensor \{[\s\S]*?background: var\(--violet-soft\);[\s\S]*?color: var\(--sensor-ink\);/,
  );
  assert.match(
    css,
    /\.capability-policy-example \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 20px minmax\(118px, 0\.48fr\);[\s\S]*?border-top: 1px solid var\(--line\);/,
  );
  assert.match(
    css,
    /\.capability-policy-example__instruction > span \{[\s\S]*?border: 5px solid var\(--instruction-surface\);[\s\S]*?font-family: var\(--mono\);/,
  );
  assert.match(
    css,
    /\.capability-policy-example__action \{[\s\S]*?background: var\(--action-surface\);/,
  );
  assert.match(
    css,
    /\.capability-policy-example__image img \{[\s\S]*?border: 5px solid var\(--blue-soft\);/,
  );
  assert.match(
    css,
    /@media \(max-width: 560px\) \{[\s\S]*?\.capability-policy-example \{[\s\S]*?grid-template-columns: 1fr;[\s\S]*?\.capability-policy-example__action > div \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    css,
    /\.capability-world-example \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\) 20px[\s\S]*?minmax\(0, 1fr\);[\s\S]*?border-top: 1px solid var\(--line\);/,
  );
  assert.match(
    css,
    /\.capability-world-example__instruction > span \{[\s\S]*?border: 5px solid var\(--instruction-surface\);[\s\S]*?font-family: var\(--mono\);/,
  );
  assert.match(
    css,
    /\.capability-world-example__action \{[\s\S]*?background: var\(--action-surface\);/,
  );
  assert.match(
    css,
    /\.capability-world-example__image img \{[\s\S]*?border: 5px solid var\(--blue-soft\);/,
  );
  assert.match(
    css,
    /@media \(max-width: 560px\) \{[\s\S]*?\.capability-world-example \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?\.capability-world-example__output \{[\s\S]*?width: min\(100%, 170px\);/,
  );
  assert.match(
    css,
    /\.capability-goal-example \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 20px minmax\(118px, 0\.48fr\);[\s\S]*?border-top: 1px solid var\(--line\);/,
  );
  assert.match(
    css,
    /\.capability-goal-example__instruction > span \{[\s\S]*?border: 5px solid var\(--instruction-surface\);[\s\S]*?font-family: var\(--mono\);/,
  );
  assert.match(
    css,
    /\.capability-goal-example__image img \{[\s\S]*?border: 5px solid var\(--blue-soft\);/,
  );
  assert.match(
    css,
    /@media \(max-width: 560px\) \{[\s\S]*?\.capability-goal-example \{[\s\S]*?grid-template-columns: 1fr;[\s\S]*?\.capability-goal-example__output \{[\s\S]*?width: min\(100%, 170px\);/,
  );
  assert.match(
    css,
    /\.capability-task-example \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 20px minmax\(118px, 0\.48fr\);[\s\S]*?border-top: 1px solid var\(--line\);/,
  );
  assert.match(
    css,
    /\.capability-task-example__frames img \{[\s\S]*?flex: 0 0 calc\(\(100% \+ 64px\) \/ 5\);[\s\S]*?border: 5px solid var\(--blue-soft\);/,
  );
  assert.match(
    css,
    /\.capability-task-example__description > span \{[\s\S]*?border: 5px solid var\(--instruction-surface\);[\s\S]*?font-family: var\(--mono\);/,
  );
  assert.match(
    css,
    /@media \(max-width: 560px\) \{[\s\S]*?\.capability-task-example \{[\s\S]*?grid-template-columns: 1fr;[\s\S]*?\.capability-task-example__description \{[\s\S]*?width: min\(100%, 220px\);/,
  );
  assert.match(
    css,
    /@media \(max-width: 820px\) \{[\s\S]*?\.capability-summary-grid \{[\s\S]*?grid-template-columns: 1fr;[\s\S]*?grid-auto-rows: auto;/,
  );
  assert.match(html, /id="model"/);
  assert.match(
    html,
    /aria-label="Dynin-Robotics training and inference architecture"/,
  );
  assert.match(html, /architecture-map__training/);
  assert.match(html, /architecture-map__inference/);
  assert.match(html, /Ground truth/);
  assert.match(html, /GT <!-- -->Text<!-- --> tokens/);
  assert.match(html, /GT <!-- -->Image \/ Video<!-- --> tokens/);
  assert.match(html, /GT <!-- -->Robot Action<!-- --> tokens/);
  assert.match(html, /Random masking/);
  assert.match(html, /Random block masking/);
  assert.match(pageSource, /<span>Loss<\/span>/);
  assert.match(html, /architecture-map__loss/);
  assert.match(html, /Masked Diffusion Language Model/);
  assert.match(html, /Fully parallel/);
  assert.match(html, /Block-wise parallel/);
  assert.match(html, /architecture-map__caption/);
  assert.doesNotMatch(pageSource, /<span>\(a\)<\/span>/);
  assert.doesNotMatch(pageSource, /<span>\(b\)<\/span>/);
  assert.doesNotMatch(
    pageSource,
    /Masked-token prediction|Shared bidirectional Transformer/,
  );
  assert.match(
    css,
    /\.architecture-map__tokens i\.is-predicted \{[\s\S]*?background: color-mix/,
  );
  assert.match(
    css,
    /\.architecture-map__training,\s+\.architecture-map__inference \{\s+background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.section--model \.section-lead__copy \{[\s\S]*?max-width: 100%;/,
  );
  assert.match(
    pageSource,
    /title=\{"One backbone,\\nmultiple parallel token pathways"\}/,
  );
  assert.match(
    css,
    /\.section--model \.section-lead h2 \{[\s\S]*?white-space: pre-line;/,
  );
  assert.match(
    css,
    /\.section--model \.section-lead__copy > p \{[\s\S]*?width: 100%;[\s\S]*?max-width: none;/,
  );
  assert.match(
    css,
    /\.section--capabilities \.section-lead__copy,\s+\.section--training \.section-lead__copy,\s+\.section--inference \.section-lead__copy,\s+\.section--demonstrations \.section-lead__copy,\s+\.section--examples \.section-lead__copy,\s+\.section--performance \.section-lead__copy \{\s+max-width: 100%;/,
  );
  assert.match(
    css,
    /\.section--capabilities \.section-lead h2,\s+\.section--training \.section-lead h2,\s+\.section--inference \.section-lead h2,\s+\.section--demonstrations \.section-lead h2,\s+\.section--examples \.section-lead h2,\s+\.section--performance \.section-lead h2 \{\s+max-width: none;/,
  );
  assert.match(
    css,
    /\.section--capabilities \.section-lead__copy > p,\s+\.section--training \.section-lead__copy > p,\s+\.section--inference \.section-lead__copy > p,\s+\.section--demonstrations \.section-lead__copy > p,\s+\.section--examples \.section-lead__copy > p,\s+\.section--performance \.section-lead__copy > p \{\s+width: 100%;\s+max-width: none;/,
  );
  assert.match(
    css,
    /\.architecture-map__training-row\.is-masked article,\s+\.architecture-map__training-row\.is-ground-truth article \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/,
  );
  assert.match(
    css,
    /\.architecture-map__training-row\.is-output article \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/,
  );
  assert.match(pageSource, /const architectureTokenCount = 8;/);
  assert.match(pageSource, /const inferenceTokenCount = 12;/);
  assert.match(pageSource, /const INFERENCE_STAGE_COUNT = 4;/);
  assert.match(pageSource, /const INFERENCE_STAGE_DURATION = 720;/);
  assert.match(pageSource, /const INFERENCE_FINAL_HOLD_DURATION = 1500;/);
  assert.match(pageSource, /const TRAINING_ANIMATION_MOMENTS = \[/);
  assert.match(
    pageSource,
    /\{ stage: 3, phase: "mask-seed", duration: 650 \},[\s\S]*?\{ stage: 3, phase: "masked", duration: 850 \}/,
  );
  assert.match(
    pageSource,
    /\{ stage: 5, phase: "output-seed", duration: 650 \},[\s\S]*?\{ stage: 5, phase: "predicted", duration: 900 \}/,
  );
  assert.match(
    pageSource,
    /\{ stage: 6, phase: "loss", duration: 1600 \}/,
  );
  assert.match(
    pageSource,
    /const \[trainingMomentIndex, setTrainingMomentIndex\] = useState\(0\);/,
  );
  assert.match(
    pageSource,
    /\(current \+ 1\) % TRAINING_ANIMATION_MOMENTS\.length/,
  );
  assert.match(
    pageSource,
    /data-training-phase=\{trainingMoment\.phase\}/,
  );
  assert.match(
    pageSource,
    /data-training-stage=\{trainingMoment\.stage\}/,
  );
  assert.match(pageSource, /const actionInferenceProgress = \[0, 4, 8, 12\];/);
  assert.match(
    pageSource,
    /const \[visibleInferenceRows, setVisibleInferenceRows\] = useState\(1\);/,
  );
  assert.match(
    pageSource,
    /current >= INFERENCE_STAGE_COUNT \? 1 : current \+ 1/,
  );
  assert.match(
    pageSource,
    /motionPreference\.addEventListener\("change", handleMotionPreferenceChange\)/,
  );
  assert.match(
    pageSource,
    /motionPreference\.removeEventListener\(\s*"change",\s*handleMotionPreferenceChange/,
  );
  assert.match(
    pageSource,
    /data-visible-rows=\{visibleInferenceRows\}/,
  );
  assert.match(
    pageSource,
    /isRevealed=\{rowIndex < visibleInferenceRows\}/,
  );
  assert.match(pageSource, /function ArchitectureTargetFlow/);
  assert.doesNotMatch(pageSource, /function ArchitectureTrainingFlow/);
  assert.match(
    pageSource,
    /states=\{maskApplied \? lane\.inputStates : groundTruthStates\}/,
  );
  assert.match(
    pageSource,
    /predictionApplied \? lane\.outputStates : lane\.inputStates/,
  );
  assert.match(pageSource, /key=\{index\}/);
  assert.match(
    pageSource,
    /state === "mask"[\s\S]*?style=\{\{ gridColumn: index \+ 1 \}\}/,
  );
  assert.equal(
    (html.match(/architecture-map__target-connector/g) ?? []).length,
    16,
  );
  assert.match(pageSource, /mode="through-model"/);
  assert.match(pageSource, /mode="spacer"/);
  assert.match(
    pageSource,
    /modality: "action" as const,[\s\S]*?inputStates: \[\s*"ground",\s*"ground",\s*"mask",\s*"mask",\s*"ground",\s*"ground",\s*"ground",\s*"ground",\s*\]/,
  );
  assert.match(
    pageSource,
    /Array\.from\(\s*\{ length: architectureTokenCount \}/,
  );
  assert.match(
    css,
    /\.architecture-map__tokens \{[\s\S]*?grid-template-columns: repeat\(8,/,
  );
  assert.match(
    css,
    /\.architecture-map__training-row \.architecture-map__tokens \{[\s\S]*?width: 100%;[\s\S]*?grid-template-columns: repeat\(8,[\s\S]*?justify-content: space-between;/,
  );
  assert.match(
    css,
    /\.architecture-map__decode-steps \.architecture-map__tokens \{[\s\S]*?width: 100%;[\s\S]*?grid-template-columns: repeat\(12,[\s\S]*?justify-content: space-between;/,
  );
  assert.match(
    css,
    /\.architecture-map__decode-steps \.architecture-map__tokens \{[\s\S]*?visibility: hidden;[\s\S]*?opacity: 0;[\s\S]*?transition:/,
  );
  assert.match(
    css,
    /\.architecture-map__decode-steps \.architecture-map__tokens\.is-revealed \{[\s\S]*?visibility: visible;[\s\S]*?opacity: 1;/,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.architecture-map__decode-steps \.architecture-map__tokens \{[\s\S]*?visibility: visible;[\s\S]*?opacity: 1;[\s\S]*?transition: none;/,
  );
  assert.match(
    css,
    /\.architecture-map__decode-steps \.architecture-map__tokens i \{[\s\S]*?width: 100%;[\s\S]*?max-width: none;[\s\S]*?aspect-ratio: 1;/,
  );
  assert.match(
    css,
    /\.architecture-map__target-flow-lane \{[\s\S]*?grid-template-columns: repeat\(8,[\s\S]*?justify-content: space-between;/,
  );
  assert.match(
    css,
    /\.architecture-map__target-connector \{[\s\S]*?repeating-linear-gradient/,
  );
  assert.match(
    css,
    /\.architecture-map__target-connector \{[\s\S]*?transform-origin: center bottom;/,
  );
  assert.match(
    css,
    /\.architecture-map__target-flow:not\(\.is-visible\)[\s\S]*?\.architecture-map__target-connector \{[\s\S]*?transform: scaleY\(0\);[\s\S]*?opacity: 0;/,
  );
  assert.match(
    css,
    /\.architecture-map__target-flow\.is-through-model[\s\S]*?\.architecture-map__target-connector \{[\s\S]*?height: calc\(100% \+ 112px\);/,
  );
  assert.match(
    css,
    /\.architecture-map__training-row\.is-masked[\s\S]*?\+ \.architecture-map__target-flow[\s\S]*?\.architecture-map__target-connector \{[\s\S]*?height: calc\(100% \+ 22px\);/,
  );
  assert.match(
    css,
    /\.architecture-map__backbone \{[\s\S]*?position: relative;[\s\S]*?z-index: 1;/,
  );
  assert.match(
    css,
    /\.architecture-map__training-layer \{[\s\S]*?visibility: hidden;[\s\S]*?opacity: 0;/,
  );
  assert.match(
    css,
    /\.architecture-map__training-layer\.is-visible \{[\s\S]*?visibility: visible;[\s\S]*?opacity: 1;/,
  );
  assert.match(css, /@keyframes architecture-token-mask-in/);
  assert.match(css, /@keyframes architecture-token-prediction-in/);
  assert.match(
    css,
    /\.architecture-map__training-row\.is-output article \{[\s\S]*?padding: 2px 0;/,
  );
  assert.match(
    css,
    /\.architecture-map__loss > i \{[\s\S]*?border-top: 1px solid var\(--line-strong\);[\s\S]*?border-left: 1px solid var\(--line-strong\);/,
  );
  assert.match(
    css,
    /\.architecture-map__loss > span \{[\s\S]*?width: 38px;[\s\S]*?text-align: right;/,
  );
  assert.doesNotMatch(css, /\.architecture-map__loss::after/);
  assert.match(
    css,
    /\.architecture-map__loss \{[\s\S]*?top: 52\.5px;[\s\S]*?bottom: 111px;/,
  );
  assert.match(
    css,
    /\.architecture-map__backbone > strong \{[\s\S]*?font-size: 18px;/,
  );
  assert.doesNotMatch(pageSource, /Figure 3, reconstructed/);
  assert.doesNotMatch(pageSource, /className="method-details/);
  assert.doesNotMatch(html, /Discrete interface|Decoding order/);
  assert.match(
    pageSource,
    /<section\s+className="section section--training"\s+id="training"/,
  );
  assert.match(
    html,
    /class="section section--training"\s+id="training"/,
  );
  assert.match(html, /id="inference"/);
  assert.match(html, /id="inference-mode-panel"/);
  assert.match(html, /Default Policy/);
  assert.match(html, /Objective/);
  assert.match(
    pageSource,
    /const inferenceStageSlots:[\s\S]*?key: "objective"[\s\S]*?symbol: "OBJ"[\s\S]*?key: "stateVision"[\s\S]*?symbol: "V"[\s\S]*?key: "instructionText"[\s\S]*?symbol: "T"[\s\S]*?key: "action"[\s\S]*?symbol: "A"[\s\S]*?key: "generatedVision"[\s\S]*?symbol: "V"[\s\S]*?key: "generatedText"[\s\S]*?symbol: "T"/,
  );
  assert.match(
    pageSource,
    /variant === "joint"[\s\S]*?\["action", "generatedVision"\]/,
  );
  assert.match(
    pageSource,
    /includeObjectiveOutput=\{[\s\S]*?!\["a", "b", "c", "d", "e", "f"\]\.includes\(mode\.key\)[\s\S]*?\}/,
  );
  assert.match(
    pageSource,
    /const policySolidOutputSlots:[\s\S]*?\["a", "c", "d", "f"\]\.includes\(mode\.key\)[\s\S]*?\["action"\][\s\S]*?\["b", "e"\]\.includes\(mode\.key\)[\s\S]*?\["action", "generatedVision"\]/,
  );
  assert.match(pageSource, /solidOutputSlots=\{policySolidOutputSlots\}/);
  assert.match(
    pageSource,
    /\["a", "c", "d", "f"\]\.includes\(mode\.key\)[\s\S]*?\["action"\][\s\S]*?\["b", "e"\]\.includes\(mode\.key\)[\s\S]*?\["action", "generatedVision"\]/,
  );
  assert.match(
    pageSource,
    /\["c", "e", "f"\]\.includes\(mode\.key\) \? \["generatedVision"\] : \[\]/,
  );
  assert.match(
    pageSource,
    /const goalSolidOutputSlots:[\s\S]*?\["c", "e", "f"\]\.includes\(mode\.key\) \? \["generatedVision"\] : \[\]/,
  );
  assert.match(
    pageSource,
    /const goalOutputSlotLabels:[\s\S]*?\["c", "e", "f"\]\.includes\(mode\.key\)[\s\S]*?\{ generatedVision: "Goal state" \}/,
  );
  assert.match(
    pageSource,
    /kind="goal"[\s\S]*?includeObjectiveOutput=\{!\["c", "e", "f"\]\.includes\(mode\.key\)\}[\s\S]*?solidOutputSlots=\{goalSolidOutputSlots\}[\s\S]*?flowSlots=\{goalFlowSlots\}[\s\S]*?outputSlotLabels=\{goalOutputSlotLabels\}/,
  );
  assert.match(pageSource, /flowSlots=\{policyFlowSlots\}/);
  assert.match(
    pageSource,
    /const policyInputSlotLabels:[\s\S]*?mode\.key === "c"[\s\S]*?\{ generatedVision: "Goal state" \}[\s\S]*?mode\.key === "d"[\s\S]*?\{ action: "Actions" \}[\s\S]*?mode\.key === "e"[\s\S]*?stateVision: "State"[\s\S]*?generatedVision: "State"[\s\S]*?mode\.key === "f"[\s\S]*?generatedVision: "Goal state"/,
  );
  assert.match(
    pageSource,
    /const policyOutputSlotLabels:[\s\S]*?mode\.key === "b"[\s\S]*?\{ generatedVision: "Next state" \}[\s\S]*?mode\.key === "d"[\s\S]*?\{ action: "Actions" \}[\s\S]*?mode\.key === "e"[\s\S]*?\{ generatedVision: "Next states" \}/,
  );
  assert.match(
    pageSource,
    /inputSlotLabels=\{policyInputSlotLabels\}[\s\S]*?outputSlotLabels=\{policyOutputSlotLabels\}[\s\S]*?mode\.key === "e"[\s\S]*?\["stateVision", "instructionText"\]/,
  );
  assert.match(
    pageSource,
    /const worldFlowSlots:[\s\S]*?\["d", "f"\]\.includes\(mode\.key\) \? \["generatedVision"\] : \[\]/,
  );
  assert.match(
    pageSource,
    /const worldSolidOutputSlots:[\s\S]*?\["d", "f"\]\.includes\(mode\.key\) \? \["generatedVision"\] : \[\]/,
  );
  assert.match(
    pageSource,
    /const worldOutputSlotLabels:[\s\S]*?\["d", "f"\]\.includes\(mode\.key\)[\s\S]*?\{ generatedVision: "Next states" \}/,
  );
  assert.match(
    pageSource,
    /kind="world"[\s\S]*?includeObjectiveOutput=\{!\["d", "f"\]\.includes\(mode\.key\)\}[\s\S]*?solidOutputSlots=\{worldSolidOutputSlots\}[\s\S]*?flowSlots=\{worldFlowSlots\}[\s\S]*?outputSlotLabels=\{worldOutputSlotLabels\}/,
  );
  assert.match(
    css,
    /\.inference-chain \{[\s\S]*?minmax\(280px, 1fr\) 60px minmax\(280px, 1fr\) 60px/,
  );
  assert.match(
    pageSource,
    /placement === "input" && flowSlots\.includes\(slot\.key\)/,
  );
  assert.match(
    pageSource,
    /slotLabels\[slot\.key\] \?\?[\s\S]*?!slotActive && slot\.key === "generatedVision"[\s\S]*?\? "State"[\s\S]*?: slot\.label/,
  );
  assert.match(
    pageSource,
    /data-multiline=\{slotLabel\.includes\("\\n"\)\}/,
  );
  assert.match(
    css,
    /\.inference-module__token > small\[data-multiline="true"\] \{[\s\S]*?white-space: pre-line;/,
  );
  assert.match(
    pageSource,
    /slot !== "objective" && !solidOutputSlots\.includes\(slot\)/,
  );
  assert.match(
    pageSource,
    /<InferenceStageRail[\s\S]*?placement="output"[\s\S]*?<InferenceStageRail[\s\S]*?placement="input"/,
  );
  assert.match(
    pageSource,
    /<div className="inference-explorer__figure-shell">[\s\S]*?<\/section>\s*<\/div>\s*<div\s+className="inference-tabs"/,
  );
  assert.match(
    css,
    /\.inference-module__rail \{[\s\S]*?grid-template-columns: repeat\(6,/,
  );
  assert.match(
    css,
    /\.inference-explorer \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/,
  );
  assert.match(
    pageSource,
    /<section\s+key=\{mode\.key\}\s+className="inference-panel"/,
  );
  assert.match(
    css,
    /\.inference-panel \{[\s\S]*?animation: inference-mode-enter 280ms cubic-bezier\(0\.22, 1, 0\.36, 1\)[\s\S]*?both;/,
  );
  assert.match(
    css,
    /@keyframes inference-mode-enter \{[\s\S]*?from \{\s*opacity: 0\.56;\s*\}[\s\S]*?to \{\s*opacity: 1;\s*\}/,
  );
  assert.doesNotMatch(
    css,
    /@keyframes inference-mode-enter \{(?:(?!^\}).)*transform:/ms,
  );
  assert.match(
    pageSource,
    /const INFERENCE_MODE_CYCLE_INTERVAL = 2000;/,
  );
  assert.match(
    pageSource,
    /modeTimer = window\.setTimeout\(\(\) => \{\s*setActiveMode\(\(current\) => \(current \+ 1\) % inferenceModes\.length\);\s*\}, INFERENCE_MODE_CYCLE_INTERVAL\);/,
  );
  assert.match(
    pageSource,
    /const \[cycleResetId, setCycleResetId\] = useState\(0\);/,
  );
  assert.match(
    pageSource,
    /const selectInferenceMode = useCallback\(\(index: number\) => \{\s*setActiveMode\(index\);\s*setCycleResetId\(\(current\) => current \+ 1\);\s*\}, \[\]\);/,
  );
  assert.match(
    pageSource,
    /motionPreference\.addEventListener\("change", scheduleNextMode\);[\s\S]*?motionPreference\.removeEventListener\("change", scheduleNextMode\);[\s\S]*?\}, \[activeMode, cycleResetId\]\);/,
  );
  assert.match(
    pageSource,
    /selectInferenceMode\(next\);[\s\S]*?onClick=\{\(\) => selectInferenceMode\(index\)\}/,
  );
  assert.doesNotMatch(
    pageSource,
    /className="inference-panel__intro"\s+aria-live=/,
  );
  assert.match(
    pageSource,
    /<div className="inference-module__core">\s*<strong>Dynin-Robotics<\/strong>\s*<\/div>/,
  );
  assert.match(
    css,
    /\.inference-module \{[\s\S]*?grid-template-rows: 48px 88px 52px 88px;/,
  );
  assert.match(
    css,
    /\.inference-module__core \{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;[\s\S]*?margin: 4px 13px;[\s\S]*?background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.inference-module\.is-inactive > header,\s*\.inference-module\.is-inactive > \.inference-module__row,\s*\.inference-module\.is-inactive > \.inference-module__core \{[\s\S]*?opacity: 0\.18;/,
  );
  assert.doesNotMatch(pageSource, /<b>(?:Outputs|Inputs)<\/b>/);
  assert.match(
    css,
    /\.inference-module__row\.is-output \{[\s\S]*?justify-content: flex-end;[\s\S]*?padding-block: 8px 10px;/,
  );
  assert.match(
    css,
    /\.inference-module__row\.is-input \{[\s\S]*?justify-content: flex-start;[\s\S]*?padding-block: 10px 8px;/,
  );
  assert.match(
    css,
    /\.inference-module__token > small \{[\s\S]*?font-family: var\(--sans\);[\s\S]*?font-size: 8px;/,
  );
  assert.match(
    css,
    /\.inference-module > header \{[\s\S]*?grid-template-columns: 20px minmax\(0, 1fr\);[\s\S]*?gap: 4px;/,
  );
  assert.match(
    css,
    /\.inference-module > header > span \{[\s\S]*?font-size: 11px;/,
  );
  assert.match(
    css,
    /\.inference-module > header > strong \{[\s\S]*?font-size: 14px;/,
  );
  assert.match(
    css,
    /\.inference-module\.has-token-flow[\s\S]*?\.inference-module__token\.is-flow-source[\s\S]*?> i::before \{[\s\S]*?bottom: calc\(100% \+ 8px\);[\s\S]*?height: 60px;[\s\S]*?background: var\(--line-strong\);/,
  );
  assert.match(
    css,
    /\.inference-module\.has-token-flow[\s\S]*?\.inference-module__token\.is-flow-source[\s\S]*?> i::after \{[\s\S]*?bottom: calc\(100% \+ 59px\);[\s\S]*?border-top: 1px solid var\(--line-strong\);[\s\S]*?border-left: 1px solid var\(--line-strong\);/,
  );
  assert.match(
    css,
    /\.inference-module\.has-token-flow\s+\.inference-module__row\.is-output\s+\.inference-module__token\.is-inactive \{\s+opacity: 0\.25;/,
  );
  assert.match(
    css,
    /\.inference-module\.has-token-flow\s+\.inference-module__row\.is-input\s+\.inference-module__token\.is-flow-source\s+> small \{\s+opacity: 1;/,
  );
  assert.match(
    css,
    /\.inference-module\.has-token-flow:not\(\.is-joint\)\s+\.inference-module__row\.is-input\s+\.inference-module__token\.is-inactive\s+> small \{\s+opacity: 1;/,
  );
  assert.match(
    css,
    /\.inference-connector\.is-inactive i \{\s+background: var\(--line-strong\);\s+\}\s+\.inference-connector\.is-inactive \{\s+opacity: 0\.25;/,
  );
  assert.match(
    css,
    /\.inference-connector i \{[\s\S]*?width: calc\(100% - 14px\);[\s\S]*?margin-inline: 7px;/,
  );
  assert.doesNotMatch(pageSource, /className="inference-metrics"/);
  assert.doesNotMatch(pageSource, /VLABench inference metrics/);
  assert.doesNotMatch(pageSource, /Figure 5 and Table 12/);
  assert.doesNotMatch(pageSource, /Mode \(\{mode\.key\}\)/);
  assert.doesNotMatch(pageSource, /<span>\(\{item\.key\}\)<\/span>/);
  assert.match(html, /id="examples"/);
  assert.match(html, /id="performance"/);
  const performanceStart = html.indexOf('id="performance"');
  const performanceEnd = html.indexOf('id="contributors"', performanceStart);
  const performanceSection = html.slice(performanceStart, performanceEnd);
  assert.match(performanceSection, /Benchmark Results/);
  assert.doesNotMatch(
    performanceSection,
    /Results in the context of major model families/,
  );
  assert.equal(
    (performanceSection.match(/class="benchmark-table reveal/g) ?? []).length,
    2,
  );
  assert.match(performanceSection, /<h3>LIBERO<\/h3>/);
  assert.match(performanceSection, /<h3>LIBERO-Plus<\/h3>/);
  assert.doesNotMatch(
    performanceSection,
    /Zero-shot evaluation across camera, robot, language, lighting, background, noise, and layout shifts\./,
  );
  assert.doesNotMatch(performanceSection, /LIBERO-Plus · zero-shot/);
  assert.equal(
    (
      performanceSection.match(
        /<caption class="sr-only">LIBERO(?:-Plus)?(?:<!-- -->)? — Success rate \(%\)<\/caption>/g,
      ) ?? []
    ).length,
    2,
  );
  assert.match(performanceSection, /aria-label="LIBERO benchmark results"/);
  assert.match(
    performanceSection,
    /aria-label="LIBERO-Plus benchmark results"/,
  );
  assert.match(performanceSection, /Success rate \(%\)/);
  assert.equal((performanceSection.match(/AVG ↑/g) ?? []).length, 2);
  assert.doesNotMatch(performanceSection, /Average ↑/);
  assert.doesNotMatch(
    performanceSection,
    /<th scope="col">Family<\/th>/,
  );
  assert.equal(
    (performanceSection.match(/class="benchmark-family-row"/g) ?? []).length,
    5,
  );
  assert.equal(
    (performanceSection.match(/Dynin-Robotics \(Ours\)/g) ?? []).length,
    2,
  );
  assert.match(performanceSection, /Vision-Language Model/);
  assert.match(performanceSection, /Video Generation Model/);
  assert.match(performanceSection, /Unified Model/);
  assert.match(performanceSection, /π0<\/th>/);
  assert.match(performanceSection, /π0-FAST<\/th>/);
  assert.match(performanceSection, /13\.8/);
  assert.match(performanceSection, /53\.6/);
  assert.match(performanceSection, /65\.1/);
  assert.match(performanceSection, /61\.6/);
  assert.equal(
    (performanceSection.match(/class="benchmark-model-row/g) ?? []).length,
    13,
  );
  assert.equal(
    (performanceSection.match(/colSpan="6"/g) ?? []).length,
    3,
  );
  assert.equal(
    (performanceSection.match(/colSpan="9"/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(
    performanceSection,
    /Paper Table [23]|selected major baselines|±/i,
  );
  assert.doesNotMatch(performanceSection, /results-note/);
  assert.doesNotMatch(
    performanceSection,
    /Dynin-Robotics reports 98\.1 average on LIBERO/,
  );
  assert.doesNotMatch(pageSource, /±/);
  assert.match(
    css,
    /\.benchmark-table \{[\s\S]*?padding: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/,
  );
  assert.match(
    css,
    /\.benchmark-table-list \{[\s\S]*?grid-template-columns: minmax\(0, 3fr\) minmax\(0, 5fr\);[\s\S]*?align-items: start;/,
  );
  assert.match(
    css,
    /\.table-scroll \{[\s\S]*?width: 100%;[\s\S]*?border-radius: 18px;[\s\S]*?background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.benchmark-table table \{[\s\S]*?min-width: 0;[\s\S]*?table-layout: fixed;[\s\S]*?font-size: 12px;/,
  );
  assert.match(css, /\.benchmark-table\.is-wide table \{\s+min-width: 0;/);
  assert.match(
    css,
    /\.benchmark-table th,\s+\.benchmark-table td \{[\s\S]*?padding: 11px 8px;[\s\S]*?border-bottom: 0;/,
  );
  assert.match(
    css,
    /\.benchmark-table tbody td \{[\s\S]*?font-family: var\(--mono\);[\s\S]*?font-weight: 400;/,
  );
  assert.match(
    css,
    /\.benchmark-table thead th \{[\s\S]*?font-size: 10px;/,
  );
  assert.match(
    css,
    /\.benchmark-family-row th \{[\s\S]*?font-size: 11px;/,
  );
  assert.match(
    css,
    /@media \(max-width: 1120px\) \{[\s\S]*?\.benchmark-table-list \{\s+grid-template-columns: 1fr;/,
  );
  assert.doesNotMatch(css, /\.results-note\b/);
  assert.doesNotMatch(
    css,
    /\.benchmark-table tbody tr\.is-ours \{[\s\S]*?background:/,
  );
  assert.doesNotMatch(css, /\.benchmark-table tbody tr\.is-ours td:last-child/);
  assert.doesNotMatch(css, /\.benchmark-table tbody td:nth-child\(2\)/);
  assert.equal(
    (performanceSection.match(/class="performance-subsection reveal"/g) ?? [])
      .length,
    3,
  );
  assert.ok(
    performanceSection.indexOf("Ablation Study") <
      performanceSection.indexOf("Acceleration"),
  );
  assert.ok(
    performanceSection.indexOf("Acceleration") <
      performanceSection.indexOf("VLM and Video Model Analysis"),
  );
  assert.match(
    performanceSection,
    /aria-labelledby="vlm-video-analysis-title" hidden=""/,
  );
  assert.doesNotMatch(
    performanceSection,
    /performance-grid|ablation-card|vlabench-card|Table 11|Table 4/,
  );
  assert.match(performanceSection, /Training Objective Ablation/);
  assert.match(performanceSection, /Inference Ablation Study/);
  assert.equal(
    (
      performanceSection.match(
        /class="ablation-panel benchmark-table is-(?:training|inference)-ablation"/g,
      ) ?? []
    ).length,
    2,
  );
  assert.equal(
    (performanceSection.match(/class="ablation-data-table"/g) ?? []).length,
    2,
  );
  assert.equal(
    (performanceSection.match(/class="training-ablation-row"/g) ?? []).length,
    4,
  );
  assert.equal(
    (performanceSection.match(/class="inference-ablation-row"/g) ?? []).length,
    6,
  );
  assert.doesNotMatch(performanceSection, /<span>0[1-4]<\/span>/);
  assert.match(performanceSection, /Training variant/);
  assert.match(performanceSection, /47\.15/);
  assert.match(performanceSection, /46\.01/);
  assert.match(performanceSection, /49\.38/);
  assert.match(performanceSection, /49\.61/);
  assert.match(performanceSection, /Action\/World Model Joint Denoise/);
  assert.match(performanceSection, /Goal-State Guided \+ Action Candidate Reranking/);
  assert.match(performanceSection, /9\.238/);
  assert.match(performanceSection, /8\.805/);
  assert.match(performanceSection, /9\.208/);
  assert.match(performanceSection, /4\.904/);
  assert.match(performanceSection, /8\.709/);
  assert.match(performanceSection, /4\.828/);
  assert.doesNotMatch(
    performanceSection,
    /The OOD gap decreases from 13\.27 to 2\.33 points/,
  );
  assert.match(performanceSection, /13\.27/);
  assert.match(performanceSection, /2\.33/);
  assert.match(performanceSection, /9\.221/);
  assert.match(performanceSection, /91\.236/);
  assert.match(performanceSection, /268\.834/);
  assert.match(
    performanceSection,
    /<small>\((?:<!-- -->)?1\.00x(?:<!-- -->)?\)<\/small>/,
  );
  assert.match(
    performanceSection,
    /<small>\((?:<!-- -->)?9\.89x(?:<!-- -->)?\)<\/small>/,
  );
  assert.match(
    performanceSection,
    /<small>\((?:<!-- -->)?29\.15x(?:<!-- -->)?\)<\/small>/,
  );
  assert.match(performanceSection, /Dynin-Robotics-dInfer-BL7/);
  assert.match(performanceSection, /Dynin-Robotics-dInfer-BL35/);
  assert.match(performanceSection, /Vision-Language Models/);
  assert.match(performanceSection, /Mask Diffusion Models/);
  assert.match(performanceSection, /OpenVLA-OFT/);
  assert.match(performanceSection, /LLaDA-VLA/);
  assert.match(performanceSection, /19\.114/);
  assert.match(performanceSection, /7\.351/);
  assert.match(performanceSection, /2\.079/);
  assert.match(performanceSection, /1\.827/);
  assert.equal(
    (performanceSection.match(/class="acceleration-comparison__value"/g) ?? [])
      .length,
    3,
  );
  assert.equal(
    (performanceSection.match(/<p>Effective TPS<\/p>/g) ?? []).length,
    3,
  );
  assert.doesNotMatch(
    performanceSection,
    /Speedup|Token accuracy|Action MAE|Effective TPS measures generated/,
  );
  assert.doesNotMatch(
    performanceSection,
    /0\.997545|0\.998214|0\.994643|0\.021317|0\.021383|0\.021468/,
  );
  assert.match(performanceSection, /π0\.5 loses 0\.16 success/);
  assert.match(performanceSection, /Mimic-Video changes by \+0\.10 and \+0\.02/);
  assert.match(
    css,
    /\.performance-subsection \{[\s\S]*?padding: clamp\(26px, 3\.2vw, 40px\);[\s\S]*?border-radius: 22px;[\s\S]*?background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.performance-subsection__header h3 \{[\s\S]*?font-size: clamp\(24px, 2\.4vw, 30px\);/,
  );
  assert.match(
    css,
    /\.performance-subsection\[aria-labelledby="ablation-study-title"\][\s\S]*?\.performance-subsection__header[\s\S]*?p \{[\s\S]*?width: 100%;[\s\S]*?max-width: none;/,
  );
  assert.match(
    css,
    /\.acceleration-comparison \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    css,
    /\.acceleration-comparison__value \{[\s\S]*?display: flex;[\s\S]*?align-items: baseline;[\s\S]*?gap: 8px;/,
  );
  assert.match(
    css,
    /\.acceleration-comparison__value small \{[\s\S]*?font-family: var\(--mono\);[\s\S]*?font-size: 12px;/,
  );
  assert.match(
    css,
    /\.acceleration-baselines__scroll \{[\s\S]*?border-radius: 16px;[\s\S]*?background: var\(--bg-soft\);/,
  );
  assert.match(
    css,
    /\.acceleration-baselines__model td \{[\s\S]*?font-family: var\(--mono\);[\s\S]*?font-weight: 400;/,
  );
  assert.doesNotMatch(css, /\.acceleration-comparison (?:dl|dt|dd)\b/);
  assert.match(
    css,
    /\.ablation-study-grid \{[\s\S]*?grid-template-columns: minmax\(0, 3fr\) minmax\(0, 5fr\);/,
  );
  assert.match(
    css,
    /\.ablation-panel \{[\s\S]*?padding: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/,
  );
  assert.match(
    css,
    /\.ablation-panel > \.ablation-panel__header \{[\s\S]*?margin-bottom: 6px;/,
  );
  assert.match(
    css,
    /\.ablation-panel\.is-training-ablation \.ablation-data-table th:first-child \{[\s\S]*?width: 52%;/,
  );
  assert.match(
    css,
    /\.ablation-panel\.is-inference-ablation \.ablation-data-table th:first-child \{[\s\S]*?width: 56%;/,
  );
  assert.match(
    css,
    /\.ablation-panel \.ablation-data-table thead th \{[\s\S]*?line-height: 1\.3;[\s\S]*?white-space: normal;/,
  );
  assert.match(
    css,
    /\.ablation-panel \.ablation-data-table th,\s+\.ablation-panel \.ablation-data-table td \{[\s\S]*?padding-inline: 6px;/,
  );
  assert.doesNotMatch(css, /\.performance-grid\b|\.ablation-card\b|\.vlabench-card\b/);
  assert.doesNotMatch(css, /\.ablation-list\b|\.inference-ablation-table\b/);
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
  assert.match(html, /Model and code will be released soon\./);
  assert.match(html, /Goal-State Prediction/);
  assert.match(html, /World-Model Reranking/);
  assert.match(pageSource, /<TrainingObjectiveGrid\s*\/>/);
  assert.doesNotMatch(html, /Original unified-model interaction/);
  assert.match(html, /ABot-M0/);
  assert.doesNotMatch(html, /text placeholder/);
  assert.match(html, /row_01_droid_sample_0000\/input\.jpg/);
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
  assert.match(pageSource, /Generated goal state/);
  assert.match(
    pageSource,
    /mode\.goal \? \([\s\S]*?goal[\s\S]*?<br \/>[\s\S]*?state[\s\S]*?\) : null/,
  );
  assert.doesNotMatch(pageSource, /mode\.goal \? "goal state" : ""/);
  assert.doesNotMatch(pageSource, /goal context/);
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
    /const \[overviewPlaybackId, setOverviewPlaybackId\] = useState\(0\);/,
  );
  assert.match(
    pageSource,
    /const \[overviewObjectiveKey, setOverviewObjectiveKey\][\s\S]*?useState<ObjectiveKey>\("policy"\);/,
  );
  assert.match(
    pageSource,
    /setOverviewPlaybackId\(\(value\) => value \+ 1\);/,
  );
  assert.match(
    pageSource,
    /overviewTimerTokenRef\.current \+= 1;/,
  );
  assert.match(
    pageSource,
    /if \(overviewTimerTokenRef\.current !== timerToken\) return;/,
  );
  assert.match(
    pageSource,
    /objectiveOrder\[\(currentIndex \+ 1\) % objectiveOrder\.length\]/,
  );
  assert.match(
    pageSource,
    /setOverviewObjectiveKey\(nextObjective\);[\s\S]*?setOverviewStage\(0\);/,
  );
  assert.match(
    pageSource,
    /key=\{`\$\{objective\.key\}-\$\{playbackId\}`\}/,
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
    "assets/training/policy_input.png",
    "assets/training/policy_goal.png",
    "assets/training/goal_input.png",
    "assets/training/goal_gen.png",
    "assets/training/wm_input.png",
    "assets/training/wm_gen.png",
    ...Array.from(
      { length: 5 },
      (_, index) => `assets/training/tu_input${index + 1}.png`,
    ),
    ...Array.from(
      { length: 20 },
      (_, index) =>
        `assets/overview/tu_states/tu_state_${String(index).padStart(2, "0")}.png`,
    ),
    ...[
      "row_02_droid_sample_0000",
      "row_03_rt-1_sample_0002",
      "row_04_taco_play_sample_0002",
      "row_05_jaco_play_sample_0001",
    ].flatMap((sample) =>
      ["input", "prediction", "target"].flatMap((kind) =>
        Array.from(
          { length: 5 },
          (_, index) =>
            `assets/qualitative/world/${sample}/${kind}_${String(index).padStart(3, "0")}.jpg`,
        ),
      ),
    ),
    ...[
      "row_01_droid_sample_0000",
      "row_02_rt-1_sample_0000",
      "row_03_droid_sample_0000",
      "row_04_jaco_play_sample_0006",
      "row_05_droid_sample_0000",
      "row_06_droid_sample_0000",
    ].flatMap((sample) =>
      ["input", "prediction", "target"].map(
        (kind) => `assets/qualitative/future/${sample}/${kind}.jpg`,
      ),
    ),
    ...[
      "row_01_droid_sample_0004",
      "row_02_droid_sample_0000",
      "row_03_rt-1_sample_0003",
      "row_04_taco_play_sample_0000",
      "row_05_jaco_play_sample_0002",
      "row_06_jaco_play_sample_0000",
    ].flatMap((sample) =>
      Array.from(
        { length: 30 },
        (_, index) =>
          `assets/qualitative/goal/${sample}/uniform_30_frames/tu_state${index}.jpg`,
      ),
    ),
    ...demonstrationVideoPaths,
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

test("renders world, goal-state, and task-understanding evidence", async () => {
  const html = await readFile(indexUrl, "utf8");
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  const pageSource = await readFile(
    new URL("app/page.tsx", projectRoot),
    "utf8",
  );

  assert.doesNotMatch(html, /assets\/paper\//);
  assert.doesNotMatch(
    html,
    /Task-understanding media remain intentionally omitted/,
  );
  assert.match(html, /<h2>Demonstrations<\/h2>/);
  assert.match(html, /<h2>Examples<\/h2>/);
  assert.match(html, /id="demonstrations"/);
  assert.doesNotMatch(html, /<section[^>]*\bid="real-world"/);
  assert.doesNotMatch(html, /Real-World Task Sequences/);
  assert.match(html, /<h3 id="demonstration-libero-title">LIBERO<\/h3>/);
  assert.match(
    html,
    /<h3 id="demonstration-libero-plus-title">LIBERO\+<\/h3>/,
  );
  assert.match(
    html,
    /<h3 id="demonstration-real-world-title">Real-World Manipulation<\/h3>/,
  );
  assert.equal(
    (html.match(/class="demonstration-subsection"/g) ?? []).length,
    3,
  );
  const demonstrationsStart = html.indexOf('id="demonstrations"');
  const examplesStart = html.indexOf('id="examples"');
  const demonstrationsHtml = html.slice(demonstrationsStart, examplesStart);
  const liberoGridStart = demonstrationsHtml.indexOf(
    'data-demonstration-grid="libero"',
  );
  const liberoPlusGridStart = demonstrationsHtml.indexOf(
    'data-demonstration-grid="libero-plus"',
  );
  const realWorldDemonstrationStart = demonstrationsHtml.indexOf(
    'id="demonstration-real-world-title"',
  );
  const liberoDemonstrationsHtml = demonstrationsHtml.slice(
    liberoGridStart,
    liberoPlusGridStart,
  );
  const liberoPlusDemonstrationsHtml = demonstrationsHtml.slice(
    liberoPlusGridStart,
    realWorldDemonstrationStart,
  );
  const realWorldDemonstrationsHtml = demonstrationsHtml.slice(
    realWorldDemonstrationStart,
  );
  assert.equal((demonstrationsHtml.match(/<video\b/g) ?? []).length, 40);
  assert.equal((liberoDemonstrationsHtml.match(/<video\b/g) ?? []).length, 16);
  assert.equal(
    (liberoPlusDemonstrationsHtml.match(/<video\b/g) ?? []).length,
    14,
  );
  assert.equal(
    (realWorldDemonstrationsHtml.match(/<video\b/g) ?? []).length,
    10,
  );
  assert.match(
    realWorldDemonstrationsHtml,
    /class="demonstration-real-world-note">2× · autonomous<\/p>/,
  );
  assert.doesNotMatch(realWorldDemonstrationsHtml, /demonstration-media-slot/);
  assert.equal(
    (liberoDemonstrationsHtml.match(/demonstration-video-column/g) ?? [])
      .length,
    4,
  );
  assert.equal(
    (liberoPlusDemonstrationsHtml.match(/demonstration-video-column/g) ?? [])
      .length,
    7,
  );
  for (const label of ["Spatial", "Object", "Goal", "Long"]) {
    assert.match(liberoDemonstrationsHtml, new RegExp(`<h4>${label}</h4>`));
  }
  for (const label of [
    "Camera",
    "Robot",
    "Language",
    "Light",
    "Background",
    "Noise",
    "Layout",
  ]) {
    assert.match(
      liberoPlusDemonstrationsHtml,
      new RegExp(`<h4>${label}</h4>`),
    );
  }
  for (const path of demonstrationVideoPaths) {
    assert.ok(
      demonstrationsHtml.includes(path),
      `${path} should be rendered in Demonstrations`,
    );
  }
  assert.match(
    pageSource,
    /<video[\s\S]*?autoPlay[\s\S]*?loop[\s\S]*?muted[\s\S]*?playsInline[\s\S]*?preload="metadata"/,
  );
  assert.match(
    pageSource,
    /variant === "libero"[\s\S]*?defaultPlaybackRate = 2;[\s\S]*?playbackRate = 2;/,
  );
  assert.equal(
    (pageSource.match(/defaultPlaybackRate = 2;/g) ?? []).length,
    4,
  );
  assert.equal((pageSource.match(/playbackRate = 2;/g) ?? []).length, 4);
  assert.match(
    css,
    /\.demonstration-video-grid\.is-libero \{[\s\S]*?grid-template-columns: repeat\(8, minmax\(0, 1fr\)\);[\s\S]*?min-width: 1080px;/,
  );
  assert.match(
    css,
    /\.demonstration-video-grid\.is-libero \.demonstration-video-column \{[\s\S]*?grid-column: span 2;/,
  );
  assert.match(
    css,
    /\.demonstration-video-grid\.is-libero \.demonstration-video-stack \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?grid-template-rows: repeat\(2, auto\);/,
  );
  assert.match(
    css,
    /\.demonstration-video-grid\.is-libero-plus \{[\s\S]*?grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);[\s\S]*?min-width: 1080px;/,
  );
  assert.match(
    css,
    /\.demonstration-subsection__header \{[\s\S]*?padding-bottom: 18px;/,
  );
  assert.match(
    css,
    /\.demonstration-video-column \{[\s\S]*?gap: 8px;/,
  );
  assert.match(
    css,
    /\.demonstration-video-column h4 \{[\s\S]*?margin: 0;/,
  );
  assert.match(
    css,
    /\.demonstration-video-grid\.is-libero-plus \.demonstration-video-stack \{[\s\S]*?grid-template-rows: repeat\(2, auto\);/,
  );
  assert.match(
    css,
    /\.demonstration-video-stack video \{[\s\S]*?aspect-ratio: 1;[\s\S]*?object-fit: cover;/,
  );
  assert.match(
    css,
    /\.demonstration-real-world-grid \{[\s\S]*?grid-template-columns: repeat\(10, minmax\(0, 1fr\)\);[\s\S]*?min-width: 1080px;/,
  );
  assert.match(
    css,
    /\.demonstration-real-world-grid video \{[\s\S]*?aspect-ratio: 2 \/ 3;[\s\S]*?object-fit: cover;/,
  );
  assert.match(
    css,
    /\.demonstration-subsection__header\.is-real-world \{[\s\S]*?align-items: baseline;[\s\S]*?justify-content: space-between;/,
  );
  assert.match(
    css,
    /\.demonstration-real-world-note \{[\s\S]*?margin: 0;[\s\S]*?font-size: clamp\(14px, 1vw, 15px\);/,
  );
  assert.doesNotMatch(html, /class="qualitative-tabs"/);
  assert.equal(
    (html.match(/class="qualitative-example-row(?:\s|\")/g) ?? []).length,
    10,
  );
  assert.ok(
    html.indexOf("<h3>World Modeling</h3>") <
      html.indexOf("<h3>Goal-State Prediction</h3>"),
  );
  assert.ok(
    html.indexOf("<h3>Goal-State Prediction</h3>") <
      html.indexOf("<h3>Task Understanding</h3>"),
  );
  assert.ok(
    html.indexOf('id="demonstrations"') < html.indexOf('id="examples"'),
  );
  assert.ok(html.indexOf('id="examples"') < html.indexOf('id="performance"'));
  assert.doesNotMatch(html, />10 Hz</);

  const worldStart = html.indexOf('class="qualitative-capability is-world"');
  const goalStart = html.indexOf('class="qualitative-capability is-goal"');
  const taskStart = html.indexOf('class="qualitative-capability is-task"');
  const performanceStart = html.indexOf('id="performance"');
  const worldHtml = html.slice(worldStart, goalStart);
  const goalHtml = html.slice(goalStart, taskStart);
  const taskHtml = html.slice(taskStart, performanceStart);
  assert.doesNotMatch(worldHtml, /Example 01|5-frame context|5-frame generation/);
  assert.equal((worldHtml.match(/<img\b/g) ?? []).length, 20);
  assert.match(
    worldHtml,
    />0\.01<\/span><span>0\.01<\/span><span>-0\.12<\/span><span>-0\.02<\/span><span>0\.04<\/span><span>0\.00<\/span>/,
  );
  assert.match(
    worldHtml,
    /row_02_droid_sample_0000\/input_000\.jpg/,
  );
  assert.match(worldHtml, /row_03_rt-1_sample_0002\/input_000\.jpg/);
  assert.doesNotMatch(worldHtml, /row_01_droid_sample_0003/);
  for (const sample of [
    "row_02_droid_sample_0000",
    "row_03_rt-1_sample_0002",
    "row_04_taco_play_sample_0002",
    "row_05_jaco_play_sample_0001",
  ]) {
    assert.match(pageSource, new RegExp(sample));
  }
  assert.doesNotMatch(pageSource, /key: "row_01_droid_sample_0003"/);
  assert.match(pageSource, /const WORLD_OUTPUT_FRAME_INTERVAL = 100;/);
  assert.match(pageSource, /const WORLD_OUTPUT_FINAL_HOLD_DURATION = 2500;/);
  assert.match(pageSource, /const WORLD_SAMPLE_FADE_DURATION = 280;/);
  assert.equal(
    (
      pageSource.match(
        /layerIndex === 0 \? worldOutputFramesVisible : 0/g,
      ) ?? []
    ).length,
    1,
  );
  assert.match(
    pageSource,
    /setWorldSamplesAreTransitioning\(true\);[\s\S]*?WORLD_OUTPUT_FINAL_HOLD_DURATION - WORLD_SAMPLE_FADE_DURATION/,
  );
  assert.match(
    pageSource,
    /setWorldOutputFramesVisible\(0\);[\s\S]*?setWorldRowIndex\([\s\S]*?setWorldSamplesAreTransitioning\(false\);/,
  );
  assert.match(
    pageSource,
    /className=\{`qualitative-world-carousel\$\{[\s\S]*?worldSamplesAreTransitioning \? " is-transitioning" : ""/,
  );
  assert.match(
    pageSource,
    /\[worldRowIndex, nextWorldRowIndex\]\.map\(\(rowIndex, layerIndex\)/,
  );
  assert.doesNotMatch(worldHtml, /Ground truth next frames|target_\d+\.jpg/);
  assert.equal((worldHtml.match(/Generated next frames/g) ?? []).length, 2);
  assert.doesNotMatch(worldHtml, /Predicted next frames/);
  assert.match(
    css,
    /\.qualitative-capability\.is-world \{[\s\S]*?border: 0;[\s\S]*?border-radius: 22px;[\s\S]*?background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.qualitative-frame-strip > img \{[\s\S]*?aspect-ratio: 1;[\s\S]*?object-fit: cover;/,
  );
  assert.match(
    css,
    /\.qualitative-flow\.is-world \{[\s\S]*?grid-template-columns: minmax\(0, 0\.72fr\) 36px minmax\(0, 1\.28fr\);[\s\S]*?gap: 16px;/,
  );
  assert.match(
    css,
    /\.qualitative-world-output \.qualitative-frame-strip > img \{[\s\S]*?aspect-ratio: 1;/,
  );
  assert.doesNotMatch(
    css,
    /\.qualitative-world-output \.qualitative-frame-strip > img \{[\s\S]*?aspect-ratio: auto;/,
  );
  assert.match(
    css,
    /\.qualitative-frame-strip\.is-sequenced > img \{[\s\S]*?translateX\(-6px\)[\s\S]*?opacity: 0;[\s\S]*?transform 240ms cubic-bezier\(0\.22, 1, 0\.36, 1\)[\s\S]*?opacity 220ms ease-out/,
  );
  assert.match(
    css,
    /\.qualitative-frame-strip\.is-sequenced > img\.is-visible \{[\s\S]*?opacity: 1;/,
  );
  assert.match(css, /\.qualitative-world-carousel \{\s+display: grid;/);
  assert.match(css, /\.qualitative-world-page \{\s+grid-area: 1 \/ 1;/);
  assert.match(
    css,
    /\.qualitative-world-carousel\.is-transitioning \.qualitative-world-page \{[\s\S]*?transition: opacity 280ms ease-in-out;[\s\S]*?will-change: opacity;/,
  );
  assert.match(
    css,
    /\.qualitative-world-carousel\.is-transitioning[\s\S]*?\.qualitative-world-page\.is-current \{\s+opacity: 0;/,
  );
  assert.match(
    css,
    /\.qualitative-world-carousel\.is-transitioning \.qualitative-world-page\.is-next \{\s+opacity: 1;/,
  );
  assert.equal(
    (goalHtml.match(/class="qualitative-example-row is-goal-row"/g) ?? [])
      .length,
    4,
  );
  assert.doesNotMatch(
    goalHtml,
    /Goal visualization|Example 01|Example 02|Image input|Text input|Image generation/,
  );
  assert.equal(
    (goalHtml.match(/class="qualitative-single-frame has-image"/g) ?? [])
      .length,
    8,
  );
  assert.equal(
    (goalHtml.match(/class="qualitative-text-placeholder"/g) ?? []).length,
    0,
  );
  assert.equal(
    (goalHtml.match(/class="qualitative-goal-output"/g) ?? []).length,
    4,
  );
  assert.doesNotMatch(goalHtml, /Ground-truth goal state|target\.jpg/);
  assert.equal((goalHtml.match(/<img\b/g) ?? []).length, 8);
  assert.match(
    goalHtml,
    /row_01_droid_sample_0000\/input\.jpg/,
  );
  assert.match(
    goalHtml,
    /row_02_rt-1_sample_0000\/prediction\.jpg/,
  );
  assert.match(
    goalHtml,
    /Take the pen out of the cup and place it on the counter/,
  );
  assert.match(goalHtml, /place apple into middle drawer/);
  for (const sample of [
    "row_01_droid_sample_0000",
    "row_02_rt-1_sample_0000",
    "row_03_droid_sample_0000",
    "row_04_jaco_play_sample_0006",
    "row_05_droid_sample_0000",
    "row_06_droid_sample_0000",
  ]) {
    assert.match(pageSource, new RegExp(sample));
  }
  assert.match(pageSource, /const GOAL_SAMPLES_PER_PAGE = 2;/);
  assert.match(pageSource, /const GOAL_SAMPLE_INTERVAL = 3000;/);
  assert.match(pageSource, /const GOAL_SAMPLE_FADE_DURATION = 280;/);
  assert.match(
    pageSource,
    /setGoalSamplesAreTransitioning\(true\);[\s\S]*?GOAL_SAMPLE_INTERVAL - GOAL_SAMPLE_FADE_DURATION/,
  );
  assert.match(
    pageSource,
    /setGoalPageIndex\([\s\S]*?setGoalSamplesAreTransitioning\(false\);[\s\S]*?GOAL_SAMPLE_INTERVAL/,
  );
  assert.match(
    pageSource,
    /className=\{`qualitative-goal-carousel\$\{[\s\S]*?goalSamplesAreTransitioning \? " is-transitioning" : ""/,
  );
  assert.match(
    pageSource,
    /\[goalPageIndex, nextGoalPageIndex\]\.map\(\(pageIndex, layerIndex\)/,
  );
  assert.ok(
    goalHtml.indexOf("Initial state") < goalHtml.indexOf("Instruction") &&
      goalHtml.indexOf("Instruction") <
        goalHtml.indexOf("Generated goal state"),
  );
  assert.equal((goalHtml.match(/Generated goal state/g) ?? []).length, 4);
  assert.doesNotMatch(goalHtml, /Predicted goal state/);
  assert.match(
    css,
    /\.qualitative-capability\.is-goal \{[\s\S]*?border: 0;[\s\S]*?border-radius: 22px;[\s\S]*?background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.qualitative-capability\.is-goal \.qualitative-example-list \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?gap: clamp\(56px, 6vw, 92px\);/,
  );
  assert.match(css, /\.qualitative-goal-carousel \{\s+display: grid;/);
  assert.match(css, /\.qualitative-goal-page \{\s+grid-area: 1 \/ 1;/);
  assert.match(
    css,
    /\.qualitative-goal-carousel\.is-transitioning \.qualitative-goal-page \{[\s\S]*?transition: opacity 280ms ease-in-out;[\s\S]*?will-change: opacity;/,
  );
  assert.match(
    css,
    /\.qualitative-goal-carousel\.is-transitioning[\s\S]*?\.qualitative-goal-page\.is-current \{\s+opacity: 0;/,
  );
  assert.match(
    css,
    /\.qualitative-goal-carousel\.is-transitioning \.qualitative-goal-page\.is-next \{\s+opacity: 1;/,
  );
  assert.match(
    css,
    /\.qualitative-flow\.is-goal \.qualitative-single-frame \{[\s\S]*?width: 100%;[\s\S]*?max-width: 300px;[\s\S]*?aspect-ratio: 1;/,
  );
  assert.match(
    css,
    /\.qualitative-flow\.is-goal[\s\S]*?\.qualitative-goal-input[\s\S]*?> \.qualitative-single-frame \{[\s\S]*?width: 92%;[\s\S]*?max-width: 220px;/,
  );
  assert.match(
    css,
    /\.qualitative-flow\.is-goal \{[\s\S]*?grid-template-columns: minmax\(0, 0\.86fr\) 24px minmax\(0, 1\.14fr\);[\s\S]*?gap: 12px;/,
  );
  assert.match(
    css,
    /\.qualitative-goal-input \{[\s\S]*?display: flex;[\s\S]*?align-items: flex-end;/,
  );
  assert.match(
    css,
    /\.qualitative-goal-input > header \{[\s\S]*?width: 92%;[\s\S]*?max-width: 220px;/,
  );
  assert.match(
    css,
    /\.qualitative-goal-instruction \{[\s\S]*?width: 92%;[\s\S]*?max-width: 220px;[\s\S]*?height: 128px;[\s\S]*?min-height: 128px;[\s\S]*?grid-template-columns: 1fr;[\s\S]*?align-items: stretch;[\s\S]*?background: var\(--instruction-surface\);/,
  );
  assert.match(
    css,
    /\.qualitative-goal-output \{[\s\S]*?display: flex;[\s\S]*?align-items: flex-start;/,
  );
  assert.match(
    css,
    /\.qualitative-goal-output > \.qualitative-flow-group \{[\s\S]*?width: 100%;/,
  );
  assert.match(
    css,
    /\.qualitative-single-frame\.has-image > img \{[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?object-fit: cover;/,
  );
  assert.match(
    css,
    /\.qualitative-goal-instruction > p \{[\s\S]*?background: var\(--surface-card\);[\s\S]*?font-family: var\(--mono\);[\s\S]*?font-weight: 500;[\s\S]*?line-height: 1\.45;/,
  );
  assert.match(
    css,
    /\.qualitative-action-placeholder \{[\s\S]*?background: var\(--action-surface\);/,
  );
  assert.match(
    css,
    /:root\[data-theme="light"\] \{[\s\S]*?--action-surface: #f7edcf;[\s\S]*?--instruction-surface: #eef1f3;/,
  );
  assert.equal(
    (taskHtml.match(/class="qualitative-example-row is-task-row"/g) ?? [])
      .length,
    4,
  );
  assert.equal(
    (taskHtml.match(/class="qualitative-task-video"/g) ?? []).length,
    4,
  );
  assert.equal((taskHtml.match(/<img\b/g) ?? []).length, 4);
  assert.equal(
    (taskHtml.match(/Generated task description/g) ?? []).length,
    4,
  );
  assert.doesNotMatch(taskHtml, /Predicted instruction/);
  assert.doesNotMatch(taskHtml, /Ground-truth instruction/);
  assert.equal(
    (taskHtml.match(/class="qualitative-task-instruction"/g) ?? []).length,
    4,
  );
  assert.match(
    taskHtml,
    /row_01_droid_sample_0004\/uniform_30_frames\/tu_state0\.jpg/,
  );
  assert.match(
    taskHtml,
    /row_02_droid_sample_0000\/uniform_30_frames\/tu_state0\.jpg/,
  );
  assert.match(
    taskHtml,
    /row_03_rt-1_sample_0003\/uniform_30_frames\/tu_state0\.jpg/,
  );
  assert.match(
    taskHtml,
    /row_04_taco_play_sample_0000\/uniform_30_frames\/tu_state0\.jpg/,
  );
  assert.match(taskHtml, /Put the purple object in the bowl/);
  assert.match(taskHtml, /Fold the cloth on the table/);
  assert.match(taskHtml, /Pick pepsi can from middle drawer/);
  assert.doesNotMatch(
    taskHtml,
    /Ground-truth instruction|inside the white bowl|<u\b|10 Hz|\*purple object\*|\*cloth\*/,
  );
  assert.doesNotMatch(
    taskHtml,
    /03 · Language reconstruction|Example 01|Example 02|Sequential playback|Text generation|qualitative-frame-strip|qualitative-text-placeholder/,
  );
  for (const sample of [
    "row_01_droid_sample_0004",
    "row_02_droid_sample_0000",
    "row_03_rt-1_sample_0003",
    "row_04_taco_play_sample_0000",
    "row_05_jaco_play_sample_0002",
    "row_06_jaco_play_sample_0000",
  ]) {
    assert.match(pageSource, new RegExp(sample));
  }
  assert.match(pageSource, /const TASK_SAMPLES_PER_PAGE = 2;/);
  assert.match(pageSource, /const TASK_SAMPLE_INTERVAL = 3000;/);
  assert.match(pageSource, /const TASK_SAMPLE_FADE_DURATION = 280;/);
  assert.match(pageSource, /const TASK_VIDEO_FRAME_COUNT = 30;/);
  assert.match(pageSource, /const TASK_VIDEO_FRAME_INTERVAL = 100;/);
  assert.match(
    pageSource,
    /setInterval\([\s\S]*?setTaskVideoFrameIndex\([\s\S]*?TASK_VIDEO_FRAME_INTERVAL/,
  );
  assert.match(
    pageSource,
    /setTaskSamplesAreTransitioning\(true\);[\s\S]*?TASK_SAMPLE_INTERVAL - TASK_SAMPLE_FADE_DURATION/,
  );
  assert.match(
    pageSource,
    /setTaskPageIndex\([\s\S]*?setTaskSamplesAreTransitioning\(false\);[\s\S]*?setTaskVideoFrameIndex\(0\);/,
  );
  assert.match(
    pageSource,
    /\[taskPageIndex, nextTaskPageIndex\]\.map\(\(pageIndex, layerIndex\)/,
  );
  assert.match(
    pageSource,
    /layerIndex === 0 \? taskVideoFrameIndex : 0/,
  );
  assert.match(pageSource, /await image\.decode\(\);/);
  assert.match(pageSource, /Promise\.all\(frameDecodes\)/);
  assert.doesNotMatch(pageSource, /function InstructionText|>10 Hz</);
  assert.match(
    css,
    /\.qualitative-capability\.is-task \{[\s\S]*?border: 0;[\s\S]*?border-radius: 22px;[\s\S]*?background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.qualitative-capability\.is-task \.qualitative-example-list \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?gap: clamp\(56px, 6vw, 92px\);/,
  );
  assert.match(
    css,
    /\.qualitative-flow\.is-task \{[\s\S]*?grid-template-columns: minmax\(0, 0\.9fr\) 24px minmax\(0, 1\.1fr\);[\s\S]*?gap: 12px;/,
  );
  assert.match(
    css,
    /\.qualitative-task-video \{[\s\S]*?max-width: 220px;[\s\S]*?overflow: hidden;[\s\S]*?aspect-ratio: 1;/,
  );
  assert.match(
    css,
    /\.qualitative-task-video > img \{[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?object-fit: cover;/,
  );
  assert.match(
    css,
    /\.qualitative-task-output \{[\s\S]*?display: flex;[\s\S]*?align-items: center;/,
  );
  assert.match(
    css,
    /\.qualitative-task-instruction \{[\s\S]*?width: 100%;[\s\S]*?height: 128px;[\s\S]*?min-height: 128px;[\s\S]*?background: var\(--instruction-surface\);/,
  );
  assert.match(
    css,
    /\.qualitative-task-instruction > p \{[\s\S]*?justify-content: flex-start;[\s\S]*?font-family: var\(--mono\);[\s\S]*?font-weight: 500;[\s\S]*?text-align: left;[\s\S]*?word-spacing: normal;/,
  );
  assert.doesNotMatch(
    css,
    /\.qualitative-task-video > span|\.qualitative-task-instruction > p u/,
  );
  assert.match(css, /\.qualitative-task-carousel \{\s+display: grid;/);
  assert.match(css, /\.qualitative-task-page \{\s+grid-area: 1 \/ 1;/);
  assert.match(
    css,
    /\.qualitative-task-carousel\.is-transitioning \.qualitative-task-page \{[\s\S]*?transition: opacity 280ms ease-in-out;[\s\S]*?will-change: opacity;/,
  );
  assert.match(
    css,
    /\.qualitative-task-carousel\.is-transitioning[\s\S]*?\.qualitative-task-page\.is-current \{\s+opacity: 0;/,
  );
  assert.match(
    css,
    /\.qualitative-task-carousel\.is-transitioning \.qualitative-task-page\.is-next \{\s+opacity: 1;/,
  );
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
    /\.overview-original-ui \.objective-switcher \{[\s\S]*?width: min\(100%, 640px\);[\s\S]*?height: 44px;/,
  );
  assert.match(
    css,
    /\.overview-original-ui__figure-shell \{[\s\S]*?padding: 52px clamp\(18px, 2vw, 28px\) 0;[\s\S]*?border-radius: 22px;[\s\S]*?background: var\(--bg-soft\);/,
  );
  assert.match(
    pageSource,
    /<div className="overview-original-ui__figure-shell">[\s\S]*?<div className="unified-workspace">[\s\S]*?<\/div>\s*<\/div>\s*<LegacyObjectiveSwitcher active=\{active\} onSelect=\{onSelect\} \/>/,
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
    css,
    /\.objective-output-value \{[\s\S]*?min-height: 66px;[\s\S]*?justify-content: center;/,
  );
  assert.match(
    css,
    /\.objective-output-value\.is-image \{\s+bottom: calc\(100% \+ 16px\);\s+width: 66px;\s+height: 66px;\s+min-height: 66px;/,
  );
  assert.match(
    css,
    /has-narrative-animation\.phase-0[\s\S]*?objective-condition-value\.is-sequence\.is-flight \{\s+opacity: 0;/,
  );
  assert.match(
    css,
    /:root\s+\.overview-original-ui\s+\.generation-stage\.has-narrative-animation\.phase-0\s+\.output-ports::after,[\s\S]*?\.generation-core::after \{[\s\S]*?background: var\(--overview-idle-route\);[\s\S]*?opacity: 1;/,
  );
  assert.match(
    pageSource,
    /prefers-reduced-motion: reduce[\s\S]*?matches/,
  );
});
