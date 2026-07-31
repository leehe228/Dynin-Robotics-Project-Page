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
    /\.section--inference \.section-lead__copy,\s+\.section--examples \.section-lead__copy,\s+\.section--real-world \.section-lead__copy,\s+\.section--performance \.section-lead__copy \{\s+max-width: 100%;/,
  );
  assert.match(
    css,
    /\.section--inference \.section-lead h2,\s+\.section--examples \.section-lead h2,\s+\.section--real-world \.section-lead h2,\s+\.section--performance \.section-lead h2 \{\s+max-width: none;/,
  );
  assert.match(
    css,
    /\.section--inference \.section-lead__copy > p,\s+\.section--examples \.section-lead__copy > p,\s+\.section--real-world \.section-lead__copy > p,\s+\.section--performance \.section-lead__copy > p \{\s+width: 100%;\s+max-width: none;/,
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
    /<section\s+className="section section--training"\s+hidden\s+id="training"/,
  );
  assert.match(
    html,
    /class="section section--training"[^>]*hidden=""[^>]*id="training"/,
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
    /\.inference-module\.is-inactive > header,\s*\.inference-module\.is-inactive > \.inference-module__row,\s*\.inference-module\.is-inactive > \.inference-module__core \{[\s\S]*?opacity: 0\.25;/,
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
  assert.match(html, /Goal-State Prediction/);
  assert.match(html, /World-Model Reranking/);
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
    ...Array.from(
      { length: 20 },
      (_, index) =>
        `assets/overview/tu_states/tu_state_${String(index).padStart(2, "0")}.png`,
    ),
    ...[
      "row_01_droid_sample_0003",
      "row_02_droid_sample_0000",
    ].flatMap((sample) =>
      ["input", "prediction", "target"].flatMap((kind) =>
        Array.from(
          { length: 5 },
          (_, index) =>
            `assets/qualitative/world/${sample}/${kind}_${String(index).padStart(3, "0")}.jpg`,
        ),
      ),
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

test("renders world-model evidence and keeps remaining media slots empty", async () => {
  const html = await readFile(indexUrl, "utf8");
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");

  assert.doesNotMatch(html, /assets\/paper\//);
  assert.match(
    html,
    /Goal-state and task-understanding media remain intentionally omitted/,
  );
  assert.match(html, /<h2>Examples<\/h2>/);
  assert.match(html, /id="real-world"/);
  assert.doesNotMatch(html, /class="qualitative-tabs"/);
  assert.equal(
    (html.match(/class="qualitative-example-row(?:\s|\")/g) ?? []).length,
    6,
  );
  assert.ok(
    html.indexOf("<h3>World Modeling</h3>") <
      html.indexOf("<h3>Goal-State Prediction</h3>"),
  );
  assert.ok(
    html.indexOf("<h3>Goal-State Prediction</h3>") <
      html.indexOf("<h3>Task Understanding</h3>"),
  );
  assert.ok(html.indexOf('id="examples"') < html.indexOf('id="real-world"'));
  assert.match(html, /frame playback/);

  const worldStart = html.indexOf('class="qualitative-capability is-world"');
  const goalStart = html.indexOf('class="qualitative-capability is-goal"');
  const worldHtml = html.slice(worldStart, goalStart);
  assert.doesNotMatch(worldHtml, /Example 01|5-frame context|5-frame generation/);
  assert.equal((worldHtml.match(/<img\b/g) ?? []).length, 30);
  assert.match(
    worldHtml,
    />0\.07<\/span><span>-0\.07<\/span><span>-0\.63<\/span><span>0\.30<\/span><span>-0\.81<\/span><span>0\.89<\/span>/,
  );
  assert.match(
    worldHtml,
    />0\.01<\/span><span>0\.01<\/span><span>-0\.12<\/span><span>-0\.02<\/span><span>0\.04<\/span><span>0\.00<\/span>/,
  );
  assert.match(
    worldHtml,
    /row_01_droid_sample_0003\/input_000\.jpg/,
  );
  assert.match(
    worldHtml,
    /row_02_droid_sample_0000\/target_004\.jpg/,
  );
  assert.equal(
    (worldHtml.match(/Ground truth next frames/g) ?? []).length,
    2,
  );
  assert.match(
    css,
    /\.qualitative-capability\.is-world \{[\s\S]*?border: 0;[\s\S]*?border-radius: 22px;[\s\S]*?background: var\(--surface-card\);/,
  );
  assert.match(
    css,
    /\.qualitative-frame-strip > img \{[\s\S]*?aspect-ratio: 1;[\s\S]*?object-fit: cover;/,
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
