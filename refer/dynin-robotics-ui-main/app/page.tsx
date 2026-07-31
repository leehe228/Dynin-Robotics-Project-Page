"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ObjectiveKey = "policy" | "world" | "goal" | "instruction";
type Modality = "text" | "vision" | "action" | "sensor";
type ConditionKey = "state" | "instruction" | "action" | "goal" | "sensor";
type ConditionState = "required" | "optional" | "inactive";

const INFERENCE_STAGE_COUNT = 4;
const INFERENCE_STAGE_DURATION = 720;
const INFERENCE_FINAL_HOLD_DURATION = 1500;
const TRAINING_ANIMATION_MOMENTS = [
  { stage: 0, phase: "initial", duration: 850 },
  { stage: 1, phase: "ground-truth", duration: 750 },
  { stage: 2, phase: "masking-flow", duration: 650 },
  { stage: 3, phase: "mask-seed", duration: 650 },
  { stage: 3, phase: "masked", duration: 850 },
  { stage: 4, phase: "output-flow", duration: 900 },
  { stage: 5, phase: "output-seed", duration: 650 },
  { stage: 5, phase: "predicted", duration: 900 },
  { stage: 6, phase: "loss", duration: 1600 },
] as const;
const TRAINING_FINAL_MOMENT_INDEX = TRAINING_ANIMATION_MOMENTS.length - 1;

type ObjectiveInputValue =
  | {
      kind: "image";
      asset: string;
      label: string;
    }
  | {
      kind: "sequence";
      assets: string[];
      label: string;
    }
  | {
      kind: "text";
      lines: string[];
      tone: "text" | "action" | "sensor";
    };

type Objective = {
  key: ObjectiveKey;
  index: string;
  short: string;
  title: string;
  subtitle: string;
  description: string;
  inputSummary: string;
  outputSummary: string;
  targetLabel: string;
  targetSymbol: string;
  targetModality: Exclude<Modality, "sensor">;
  conditions: Record<ConditionKey, ConditionState>;
};

const objectives: Record<ObjectiveKey, Objective> = {
  policy: {
    key: "policy",
    index: "(a)",
    short: "Policy",
    title: "Policy",
    subtitle: "Action generation",
    description:
      "The policy query keeps the current visual state and task instruction visible, optionally adds a predicted goal state or sensor context, and denoises a masked action chunk.",
    inputSummary: "State · instruction · optional goal · optional sensor",
    outputSummary: "Block-wise robot action chunk",
    targetLabel: "Actions aₜ",
    targetSymbol: "A",
    targetModality: "action",
    conditions: {
      state: "required",
      instruction: "required",
      action: "inactive",
      goal: "optional",
      sensor: "optional",
    },
  },
  world: {
    key: "world",
    index: "(b)",
    short: "World",
    title: "World Modeling",
    subtitle: "Action-conditioned future prediction",
    description:
      "The world-model query observes the current state and an action chunk, optionally reads the instruction, and reconstructs the next visual state in the shared visual-token space.",
    inputSummary: "State · action · optional instruction",
    outputSummary: "Next visual state",
    targetLabel: "Next state sₜ₊₁",
    targetSymbol: "V",
    targetModality: "vision",
    conditions: {
      state: "required",
      instruction: "optional",
      action: "required",
      goal: "inactive",
      sensor: "inactive",
    },
  },
  goal: {
    key: "goal",
    index: "(c)",
    short: "Goal state",
    title: "Goal-State Prediction",
    subtitle: "Instruction-conditioned goal visualization",
    description:
      "The goal-state query uses an initial observation and instruction to reconstruct a terminal or successful scene before the policy produces an action.",
    inputSummary: "Initial state · instruction",
    outputSummary: "Goal-state image",
    targetLabel: "Goal state s_T",
    targetSymbol: "V",
    targetModality: "vision",
    conditions: {
      state: "required",
      instruction: "required",
      action: "inactive",
      goal: "inactive",
      sensor: "inactive",
    },
  },
  instruction: {
    key: "instruction",
    index: "(d)",
    short: "Task",
    title: "Task Understanding",
    subtitle: "Trajectory-to-language understanding",
    description:
      "The task-understanding query observes sampled trajectory frames and reconstructs the instruction with bidirectional, fully parallel text decoding.",
    inputSummary: "Sampled trajectory states",
    outputSummary: "Task instruction",
    targetLabel: "Instruction ℓ",
    targetSymbol: "T",
    targetModality: "text",
    conditions: {
      state: "required",
      instruction: "inactive",
      action: "inactive",
      goal: "inactive",
      sensor: "inactive",
    },
  },
};

const overviewInputValues: Partial<
  Record<ObjectiveKey, Partial<Record<ConditionKey, ObjectiveInputValue>>>
> = {
  policy: {
    state: {
      kind: "image",
      asset: "/assets/overview/policy_state.png",
      label: "Current robot state",
    },
    instruction: {
      kind: "text",
      lines: ["Put the glue stick inside the open drawer"],
      tone: "text",
    },
    goal: {
      kind: "image",
      asset: "/assets/overview/policy_goal.png",
      label: "Goal robot state",
    },
    sensor: {
      kind: "text",
      lines: ["0.01, 0.13, 0.63, 0.40, -0.25, -0.05"],
      tone: "sensor",
    },
  },
  world: {
    state: {
      kind: "image",
      asset: "/assets/overview/wm_state.png",
      label: "Observed world state",
    },
    instruction: {
      kind: "text",
      lines: ["Take the purple plush toy out of the bowl"],
      tone: "text",
    },
    action: {
      kind: "text",
      lines: ["0.01, 0.13, 0.63,", "0.40, -0.25, -0.05"],
      tone: "action",
    },
  },
  goal: {
    state: {
      kind: "image",
      asset: "/assets/overview/goal_state.png",
      label: "Initial robot state",
    },
    instruction: {
      kind: "text",
      lines: ["Unfold the white towel on the table"],
      tone: "text",
    },
  },
  instruction: {
    state: {
      kind: "sequence",
      assets: Array.from(
        { length: 20 },
        (_, index) =>
          `/assets/overview/tu_states/tu_state_${index
            .toString()
            .padStart(2, "0")}.png`,
      ),
      label: "Observed task trajectory video",
    },
  },
};

const objectiveOrder: ObjectiveKey[] = [
  "policy",
  "world",
  "goal",
  "instruction",
];

const overviewNarrativeObjectives: ObjectiveKey[] = [...objectiveOrder];

const conditionSlots: Array<{
  key: ConditionKey;
  label: string;
  symbol: string;
  modality: Modality;
}> = [
  { key: "state", label: "State", symbol: "V", modality: "vision" },
  { key: "instruction", label: "Instruction", symbol: "T", modality: "text" },
  { key: "action", label: "Action", symbol: "A", modality: "action" },
  { key: "goal", label: "Goal state", symbol: "V", modality: "vision" },
  { key: "sensor", label: "Sensor", symbol: "S", modality: "sensor" },
];

const outputLanes: Array<{
  modality: Exclude<Modality, "sensor">;
  label: string;
  symbol: string;
}> = [
  { modality: "text", label: "Text", symbol: "T" },
  { modality: "vision", label: "Vision", symbol: "V" },
  { modality: "action", label: "Action", symbol: "A" },
];

const capabilityChapters = objectiveOrder.map((key, index) => ({
  number: `0${index + 1}`,
  objective: objectives[key],
}));

const inferenceModes = [
  {
    key: "a",
    short: "Default Policy",
    title: "Default Policy",
    summary:
      "Directly denoise an action chunk from the current state and instruction.",
    goal: false,
    world: "off" as const,
  },
  {
    key: "b",
    short: "Joint Denoise",
    title: "Action / World Model Joint Denoise",
    summary:
      "Decode actions and their next-state consequence together without a goal-state query.",
    goal: false,
    world: "joint" as const,
  },
  {
    key: "c",
    short: "Goal Guided",
    title: "Goal-State Guided Policy",
    summary:
      "Predict a goal-state context first, then expose it to the policy query.",
    goal: true,
    world: "off" as const,
  },
  {
    key: "d",
    short: "Candidate Rerank",
    title: "Action Candidate Reranking",
    summary:
      "Generate policy candidates and use the world-model likelihood of their visual consequences as a conservative score.",
    goal: false,
    world: "rerank" as const,
  },
  {
    key: "e",
    short: "Goal + Joint",
    title: "Goal-State Guided + Joint Denoise",
    summary:
      "Use a predicted goal, then jointly decode the action and next visual state.",
    goal: true,
    world: "joint" as const,
  },
  {
    key: "f",
    short: "Goal + Rerank",
    title: "Goal-State Guided + Candidate Reranking",
    summary:
      "Use the predicted goal for policy generation, then score action candidates with the world-model query.",
    goal: true,
    world: "rerank" as const,
  },
];

type InferenceStageKind = "goal" | "policy" | "world";
type InferenceSlotKey =
  | "objective"
  | "stateVision"
  | "instructionText"
  | "action"
  | "generatedVision"
  | "generatedText";

const inferenceStageSlots: Array<{
  key: InferenceSlotKey;
  symbol: "OBJ" | "V" | "T" | "A";
  label: string;
  modality: "objective" | "vision" | "text" | "action";
}> = [
  {
    key: "objective",
    symbol: "OBJ",
    label: "Objective",
    modality: "objective",
  },
  {
    key: "stateVision",
    symbol: "V",
    label: "State",
    modality: "vision",
  },
  {
    key: "instructionText",
    symbol: "T",
    label: "Instruction",
    modality: "text",
  },
  {
    key: "action",
    symbol: "A",
    label: "Action",
    modality: "action",
  },
  {
    key: "generatedVision",
    symbol: "V",
    label: "Goal / next state",
    modality: "vision",
  },
  {
    key: "generatedText",
    symbol: "T",
    label: "Text",
    modality: "text",
  },
];

const liberoRows = [
  {
    model: "π0.5",
    family: "Vision-language",
    values: ["98.8", "98.2", "98.0", "92.4", "96.9"],
  },
  {
    model: "ABot-M0",
    family: "Vision-language",
    values: ["98.8", "99.8", "99.0", "96.6", "98.6"],
  },
  {
    model: "Cosmos Policy",
    family: "Video generation",
    values: ["98.1", "100.0", "98.2", "97.6", "98.5"],
  },
  {
    model: "LingBot-VA",
    family: "Video generation",
    values: ["98.5", "99.6", "97.2", "98.5", "98.5"],
  },
  {
    model: "MMaDA-VLA",
    family: "Unified",
    values: ["98.8", "99.8", "98.0", "95.2", "98.0"],
  },
  {
    model: "Dynin-Robotics",
    family: "Unified · ours",
    values: ["98.9±0.3", "99.8±0.1", "97.8±0.4", "95.8±0.5", "98.1"],
    ours: true,
  },
];

const liberoPlusRows = [
  {
    model: "OpenVLA-OFT",
    family: "Vision-language",
    values: ["56.4", "31.9", "79.5", "88.7", "93.3", "75.8", "74.2", "69.6"],
  },
  {
    model: "RIPT-VLA",
    family: "Vision-language",
    values: ["55.2", "31.2", "77.6", "88.4", "91.6", "73.5", "74.2", "68.4"],
  },
  {
    model: "ABot-M0",
    family: "Vision-language",
    values: ["60.4", "67.9", "86.4", "96.2", "91.6", "86.4", "82.6", "80.5"],
  },
  {
    model: "UniVLA",
    family: "Unified",
    values: ["1.8", "46.2", "69.6", "69.0", "81.0", "21.2", "31.9", "42.9"],
  },
  {
    model: "Dynin-Robotics",
    family: "Unified · ours",
    values: [
      "59.8±1.3",
      "48.2±1.9",
      "85.0±0.9",
      "83.5±2.1",
      "84.6±0.5",
      "78.2±1.4",
      "71.8±1.0",
      "73.0",
    ],
    ours: true,
  },
];

const objectiveAblation = [
  { label: "Policy only", gap: "13.27", ood: "33.88" },
  { label: "+ World Modeling", gap: "6.47", ood: "39.54" },
  { label: "+ Task Understanding", gap: "4.09", ood: "45.29" },
  { label: "+ Goal-State Prediction", gap: "2.33", ood: "47.28" },
];

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const primaryNavigation = [
  { id: "overview", label: "Overview" },
  { id: "capabilities", label: "Capabilities" },
  { id: "model", label: "Model" },
  { id: "examples", label: "Examples" },
  { id: "performance", label: "Performance" },
] as const;

function assetPath(path: string) {
  return `${assetBase}${path}`;
}

const worldQualitativeRows = [
  {
    key: "row_01_droid_sample_0003",
    action: ["0.07", "-0.07", "-0.63", "0.30", "-0.81", "0.89"],
  },
  {
    key: "row_02_droid_sample_0000",
    action: ["0.01", "0.01", "-0.12", "-0.02", "0.04", "0.00"],
  },
] as const;

function worldFramePaths(
  sample: string,
  kind: "input" | "prediction" | "target",
) {
  return Array.from(
    { length: 5 },
    (_, index) =>
      `/assets/qualitative/world/${sample}/${kind}_${String(index).padStart(3, "0")}.jpg`,
  );
}

function TokenStrip({
  modality,
  symbol,
  active = true,
  optional = false,
  masked = false,
  count = 6,
  resolved = count,
  maskIndices,
}: {
  modality: Modality;
  symbol: string;
  active?: boolean;
  optional?: boolean;
  masked?: boolean;
  count?: number;
  resolved?: number;
  maskIndices?: number[];
}) {
  return (
    <span
      className={`token-strip modality-${modality} ${
        active ? "is-active" : "is-inactive"
      } ${optional ? "is-optional" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => {
        const isExplicitMask = maskIndices?.includes(index) ?? false;
        const isProgressMask = masked && index >= resolved;
        const isMask = isExplicitMask || isProgressMask;
        return (
          <i
            className={`${isMask ? "is-mask" : ""} ${
              masked && !isMask ? "is-resolved" : ""
            }`}
            style={{ "--token-index": index } as CSSProperties}
            key={index}
          >
            {isMask ? "" : symbol}
          </i>
        );
      })}
    </span>
  );
}

function ObjectiveTabs({
  active,
  onSelect,
  controlsPrefix,
}: {
  active: ObjectiveKey;
  onSelect: (key: ObjectiveKey) => void;
  controlsPrefix: string;
}) {
  return (
    <div
      className="objective-tabs"
      role="tablist"
      aria-label="Unified training objective"
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          return;
        }
        event.preventDefault();
        const current = objectiveOrder.indexOf(active);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? objectiveOrder.length - 1
              : (current +
                  (event.key === "ArrowLeft" ? -1 : 1) +
                  objectiveOrder.length) %
                objectiveOrder.length;
        onSelect(objectiveOrder[next]);
        event.currentTarget
          .querySelectorAll<HTMLButtonElement>('[role="tab"]')
          [next]?.focus();
      }}
    >
      {objectiveOrder.map((key) => (
        <button
          type="button"
          role="tab"
          aria-selected={active === key}
          aria-controls={`${controlsPrefix}-${key}`}
          id={`${controlsPrefix}-tab-${key}`}
          tabIndex={active === key ? 0 : -1}
          className={active === key ? "is-active" : ""}
          onClick={() => onSelect(key)}
          key={key}
        >
          <span>{objectives[key].index}</span>
          {objectives[key].title}
        </button>
      ))}
    </div>
  );
}

function UnifiedQueryFigure({
  objective,
  stage = 4,
  compact = false,
  caption,
}: {
  objective: Objective;
  stage?: number;
  compact?: boolean;
  caption?: string;
}) {
  const resolved = stage === 0 ? 0 : Math.min(6, stage + 2);
  const activeConditions = conditionSlots.filter(
    (slot) => objective.conditions[slot.key] !== "inactive",
  );

  return (
    <figure
      className={`unified-query-figure is-${objective.key} ${
        compact ? "is-compact" : ""
      }`}
      aria-label={`${objective.title} conditional query`}
    >
      <div className="query-level-label">
        <span>Prediction targets</span>
        <b>OUTPUTS</b>
      </div>
      <div className="query-output-row">
        {outputLanes.map((lane) => {
          const active = objective.targetModality === lane.modality;
          return (
            <article
              className={`query-output modality-${lane.modality} ${
                active ? "is-active" : "is-inactive"
              }`}
              key={lane.modality}
            >
              <span>{active ? objective.targetLabel : lane.label}</span>
              <TokenStrip
                modality={lane.modality}
                symbol={active ? objective.targetSymbol : lane.symbol}
                active={active}
                masked={active}
                resolved={resolved}
                count={compact ? 4 : 6}
              />
              <small>
                {active
                  ? lane.modality === "action"
                    ? "block-wise parallel"
                    : "fully parallel"
                  : "not queried"}
              </small>
            </article>
          );
        })}
      </div>

      <div className="query-vertical-flow is-output" aria-hidden="true">
        <span />
      </div>

      <div className="query-core">
        <small>{objective.index} objective token</small>
        <strong>Dynin-Robotics</strong>
        <p>one bidirectional masked-diffusion backbone</p>
        <div className="query-core__passes" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <i className={index <= stage - 1 ? "is-active" : ""} key={index} />
          ))}
        </div>
      </div>

      <div className="query-vertical-flow is-input" aria-hidden="true">
        <span />
      </div>

      <div className="query-level-label">
        <span>Visible trajectory variables</span>
        <b>INPUTS</b>
      </div>
      <div className="query-input-row">
        {conditionSlots.map((slot) => {
          const state = objective.conditions[slot.key];
          return (
            <article
              className={`query-input modality-${slot.modality} is-${state}`}
              key={slot.key}
            >
              <span>{slot.label}</span>
              <TokenStrip
                modality={slot.modality}
                symbol={slot.symbol}
                active={state !== "inactive"}
                optional={state === "optional"}
                count={compact ? 3 : 5}
              />
              <small>
                {state === "required"
                  ? "visible"
                  : state === "optional"
                    ? "optional"
                    : "unused"}
              </small>
            </article>
          );
        })}
      </div>

      {caption && <figcaption>{caption}</figcaption>}
      <span className="sr-only">
        Inputs are shown below the centered Dynin-Robotics model. The active
        output is shown above. Active inputs:{" "}
        {activeConditions.map((slot) => slot.label).join(", ")}. Target:{" "}
        {objective.targetLabel}.
      </span>
    </figure>
  );
}

function SectionLead({
  title,
  body,
}: {
  index: string;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="section-lead reveal">
      <div className="section-lead__copy">
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
    </div>
  );
}

function ParadigmFigure() {
  const paradigms = [
    {
      key: "vlm",
      title: "Vision-Language Model",
      examples: "(\u03c00.5, GR00T)",
      core: "Vision-Language Model",
      inputs: [
        {
          label: "States",
          modality: "vision" as const,
          symbol: "V",
          count: 2,
          slot: "states",
        },
        {
          label: "Instructions",
          modality: "text" as const,
          symbol: "T",
          count: 1,
          slot: "instructions",
        },
      ],
      outputs: [
        {
          label: "Text",
          modality: "text" as const,
          symbol: "T",
          count: 1,
          slot: "text",
          optional: true,
        },
        {
          label: "Actions",
          modality: "action" as const,
          symbol: "A",
          count: 2,
          slot: "actions",
          optional: false,
        },
      ],
      masks: [{ count: 2, slot: "generation" }],
    },
    {
      key: "video",
      title: "Video Generation Model",
      examples: "(Cosmos Policy, Mimic Video)",
      core: "Video Generation Model",
      inputs: [
        {
          label: "States",
          modality: "vision" as const,
          symbol: "V",
          count: 2,
          slot: "states",
        },
        {
          label: "Instructions",
          modality: "text" as const,
          symbol: "T",
          count: 1,
          slot: "instructions",
        },
      ],
      outputs: [
        {
          label: "Next states",
          modality: "vision" as const,
          symbol: "V",
          count: 2,
          slot: "future",
          optional: true,
        },
        {
          label: "Actions",
          modality: "action" as const,
          symbol: "A",
          count: 2,
          slot: "actions",
          optional: false,
        },
      ],
      masks: [
        { count: 2, slot: "future-generation" },
        { count: 2, slot: "action-generation" },
      ],
    },
    {
      key: "unified",
      title: "Unified Model",
      examples: "(Dynin-Robotics)",
      core: "Unified Model",
      inputs: [
        {
          label: "States",
          modality: "vision" as const,
          symbol: "V",
          count: 2,
          slot: "states",
        },
        {
          label: "Instructions",
          modality: "text" as const,
          symbol: "T",
          count: 1,
          slot: "instructions",
        },
        {
          label: "Action",
          modality: "action" as const,
          symbol: "A",
          count: 2,
          slot: "action-input",
        },
      ],
      outputs: [
        {
          label: "Text",
          modality: "text" as const,
          symbol: "T",
          count: 1,
          slot: "text",
          optional: false,
        },
        {
          label: "Future states",
          modality: "vision" as const,
          symbol: "V",
          count: 2,
          slot: "future",
          optional: false,
        },
        {
          label: "Actions",
          modality: "action" as const,
          symbol: "A",
          count: 2,
          slot: "actions",
          optional: false,
        },
      ],
      masks: [
        { count: 1, slot: "pre-action" },
        { count: 4, slot: "generation" },
      ],
    },
  ];

  return (
    <figure className="paradigm-figure reveal" aria-label="Modeling paradigms">
      <div className="paradigm-grid">
        {paradigms.map((item) => (
          <div className={`paradigm-item is-${item.key}`} key={item.key}>
            <article className={`paradigm-card is-${item.key}`}>
              <div className="paradigm-card__zones" aria-hidden="true">
                {item.key !== "video" && <span>Understanding</span>}
                {item.key !== "vlm" && <span>Generation</span>}
                {item.key === "vlm" && <span>Generation</span>}
              </div>
              <div className="paradigm-card__outputs">
                {item.outputs.map((output) => (
                  <div
                    className={`modality-${output.modality} is-active is-slot-${output.slot}`}
                    key={`${item.key}-${output.slot}`}
                  >
                    <small>{output.label}</small>
                    <TokenStrip
                      modality={output.modality}
                      symbol={output.symbol}
                      optional={output.optional}
                      count={output.count}
                    />
                  </div>
                ))}
              </div>
              <div className="paradigm-card__core">
                <div className="paradigm-card__primary">
                  <strong>{item.core}</strong>
                </div>
                {item.key !== "unified" && (
                  <>
                    <i className="paradigm-card__latent" aria-hidden="true" />
                    <div className="paradigm-card__expert">
                      <strong>Expert</strong>
                    </div>
                  </>
                )}
              </div>
              <div className="paradigm-card__inputs">
                {item.inputs.map((input) => (
                  <div
                    className={`modality-${input.modality} is-active is-slot-${input.slot}`}
                    key={`${item.key}-${input.slot}`}
                  >
                    <TokenStrip
                      modality={input.modality}
                      symbol={input.symbol}
                      count={input.count}
                    />
                    <small>{input.label}</small>
                  </div>
                ))}
                {item.masks.map((mask) => (
                  <div
                    className={`paradigm-card__mask is-slot-${mask.slot}`}
                    aria-label={`${mask.count} masked token positions`}
                    key={`${item.key}-mask-${mask.slot}`}
                  >
                    <TokenStrip
                      modality="text"
                      symbol=""
                      masked
                      count={mask.count}
                      resolved={0}
                    />
                  </div>
                ))}
              </div>
            </article>
            <div className="paradigm-card__caption">
              <h3>
                <strong>{item.title}</strong>
                <span>{item.examples}</span>
              </h3>
            </div>
          </div>
        ))}
      </div>
      <div
        className="paradigm-legend-inline"
        aria-label="Figure 2 token legend"
      >
        <ul className="paradigm-legend" aria-label="Figure token legend">
          <li>
            <i
              className="paradigm-legend__swatch is-text"
              aria-hidden="true"
            />
            <span>Text</span>
          </li>
          <li>
            <i
              className="paradigm-legend__swatch is-vision"
              aria-hidden="true"
            />
            <span>Vision</span>
          </li>
          <li>
            <i
              className="paradigm-legend__swatch is-action"
              aria-hidden="true"
            />
            <span>Action</span>
          </li>
          <li>
            <i
              className="paradigm-legend__swatch is-mask"
              aria-hidden="true"
            />
            <span>Noise / Mask</span>
          </li>
          <li>
            <i
              className="paradigm-legend__swatch is-optional"
              aria-hidden="true"
            />
            <span>Optional</span>
          </li>
          <li>
            <i className="paradigm-legend__latent" aria-hidden="true" />
            <span>Latent condition</span>
          </li>
        </ul>
      </div>
    </figure>
  );
}

function ArchitectureTokenSequence({
  isRevealed = true,
  modality,
  states,
  symbol,
}: {
  isRevealed?: boolean;
  modality: "text" | "vision" | "action";
  states: string[];
  symbol: string;
}) {
  return (
    <span
      className={`architecture-map__tokens is-${modality}${isRevealed ? " is-revealed" : ""}`}
      aria-hidden="true"
    >
      {states.map((state, index) => (
        <i
          className={`is-${state}`}
          key={index}
          style={{ "--architecture-token-index": index } as CSSProperties}
        >
          {state === "ground" ? symbol : ""}
        </i>
      ))}
    </span>
  );
}

function ArchitectureTargetFlow({
  isVisible = true,
  lanes,
  mode = "standard",
}: {
  isVisible?: boolean;
  lanes: Array<{
    modality: "text" | "vision" | "action";
    inputStates: string[];
  }>;
  mode?: "standard" | "through-model" | "spacer";
}) {
  return (
    <div
      className={`architecture-map__target-flow is-${mode}${isVisible ? " is-visible" : ""}`}
      aria-hidden="true"
    >
      {lanes.map((lane) => (
        <span
          className={`architecture-map__target-flow-lane is-${lane.modality}`}
          key={lane.modality}
        >
          {mode === "spacer"
            ? null
            : lane.inputStates.map((state, index) =>
                state === "mask" ? (
                  <i
                    className="architecture-map__target-connector"
                    key={`${lane.modality}-${index}`}
                    style={{ gridColumn: index + 1 }}
                  />
                ) : null,
              )}
        </span>
      ))}
    </div>
  );
}

function ArchitectureFigure() {
  const [trainingMomentIndex, setTrainingMomentIndex] = useState(0);
  const [visibleInferenceRows, setVisibleInferenceRows] = useState(1);
  const architectureTokenCount = 8;
  const lanes = [
    {
      name: "Text",
      modality: "text" as const,
      symbol: "T",
      input: "Instruction",
      tokenizer: "Text tokenizer",
      output: "Text",
      decode: "Fully parallel",
      outputStates: [
        "ground",
        "predicted",
        "predicted",
        "ground",
        "ground",
        "predicted",
        "ground",
        "ground",
      ],
      inputStates: [
        "ground",
        "mask",
        "mask",
        "ground",
        "ground",
        "mask",
        "ground",
        "ground",
      ],
    },
    {
      name: "Image / Video",
      modality: "vision" as const,
      symbol: "V",
      input: "Observation · future · goal",
      tokenizer: "Vision tokenizer",
      output: "Image",
      decode: "Fully parallel",
      outputStates: [
        "predicted",
        "ground",
        "ground",
        "predicted",
        "ground",
        "ground",
        "predicted",
        "ground",
      ],
      inputStates: [
        "mask",
        "ground",
        "ground",
        "mask",
        "ground",
        "ground",
        "mask",
        "ground",
      ],
    },
    {
      name: "Robot Action",
      modality: "action" as const,
      symbol: "A",
      input: "Continuous 7-DoF chunk",
      tokenizer: "Action tokenizer",
      output: "Action",
      decode: "Block-wise parallel",
      outputStates: [
        "ground",
        "ground",
        "predicted",
        "predicted",
        "ground",
        "ground",
        "ground",
        "ground",
      ],
      inputStates: [
        "ground",
        "ground",
        "mask",
        "mask",
        "ground",
        "ground",
        "ground",
        "ground",
      ],
    },
  ];

  const inferenceTokenCount = 12;
  const completedInferenceIndices = Array.from(
    { length: inferenceTokenCount },
    (_, index) => index,
  );
  const buildRandomInferenceStates = (progress: number[][]) =>
    progress.map((predictedIndices) =>
      Array.from({ length: inferenceTokenCount }, (_, index) =>
        predictedIndices.includes(index) ? "predicted" : "mask",
      ),
    );
  const actionInferenceProgress = [0, 4, 8, 12];
  const inferenceStates = {
    text: buildRandomInferenceStates([
      [],
      [1, 4, 7, 10],
      [0, 1, 3, 4, 6, 7, 9, 10],
      completedInferenceIndices,
    ]),
    vision: buildRandomInferenceStates([
      [],
      [0, 3, 8, 11],
      [0, 2, 3, 5, 7, 8, 10, 11],
      completedInferenceIndices,
    ]),
    action: actionInferenceProgress.map((filledCount) =>
      Array.from({ length: inferenceTokenCount }, (_, index) =>
        index < filledCount ? "predicted" : "mask",
      ),
    ),
  };
  const groundTruthStates = Array.from(
    { length: architectureTokenCount },
    () => "ground",
  );
  const trainingMoment = TRAINING_ANIMATION_MOMENTS[trainingMomentIndex];
  const groundTruthVisible = trainingMomentIndex >= 1;
  const maskingFlowVisible = trainingMomentIndex >= 2;
  const maskedRowVisible = trainingMomentIndex >= 3;
  const maskApplied = trainingMomentIndex >= 4;
  const outputFlowVisible = trainingMomentIndex >= 5;
  const outputRowVisible = trainingMomentIndex >= 6;
  const predictionApplied = trainingMomentIndex >= 7;
  const lossVisible = trainingMomentIndex >= TRAINING_FINAL_MOMENT_INDEX;

  useEffect(() => {
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let momentTimer: number | undefined;

    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (momentTimer !== undefined) window.clearTimeout(momentTimer);
      setTrainingMomentIndex(
        event.matches ? TRAINING_FINAL_MOMENT_INDEX : 0,
      );
    };

    motionPreference.addEventListener("change", handleMotionPreferenceChange);

    if (motionPreference.matches) {
      if (trainingMomentIndex !== TRAINING_FINAL_MOMENT_INDEX) {
        momentTimer = window.setTimeout(
          () => setTrainingMomentIndex(TRAINING_FINAL_MOMENT_INDEX),
          0,
        );
      }
    } else {
      momentTimer = window.setTimeout(
        () =>
          setTrainingMomentIndex(
            (current) => (current + 1) % TRAINING_ANIMATION_MOMENTS.length,
          ),
        trainingMoment.duration,
      );
    }

    return () => {
      if (momentTimer !== undefined) window.clearTimeout(momentTimer);
      motionPreference.removeEventListener(
        "change",
        handleMotionPreferenceChange,
      );
    };
  }, [trainingMoment.duration, trainingMomentIndex]);

  useEffect(() => {
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let stageTimer: number | undefined;

    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (stageTimer !== undefined) window.clearTimeout(stageTimer);
      setVisibleInferenceRows(event.matches ? INFERENCE_STAGE_COUNT : 1);
    };

    motionPreference.addEventListener("change", handleMotionPreferenceChange);

    if (motionPreference.matches) {
      if (visibleInferenceRows !== INFERENCE_STAGE_COUNT) {
        stageTimer = window.setTimeout(
          () => setVisibleInferenceRows(INFERENCE_STAGE_COUNT),
          0,
        );
      }
    } else {
      stageTimer = window.setTimeout(
        () =>
          setVisibleInferenceRows((current) =>
            current >= INFERENCE_STAGE_COUNT ? 1 : current + 1,
          ),
        visibleInferenceRows >= INFERENCE_STAGE_COUNT
          ? INFERENCE_FINAL_HOLD_DURATION
          : INFERENCE_STAGE_DURATION,
      );
    }

    return () => {
      if (stageTimer !== undefined) window.clearTimeout(stageTimer);
      motionPreference.removeEventListener(
        "change",
        handleMotionPreferenceChange,
      );
    };
  }, [visibleInferenceRows]);

  return (
    <figure
      className="architecture-map reveal"
      aria-label="Dynin-Robotics training and inference architecture"
    >
      <div className="architecture-map__legend" aria-label="Token states">
        <span>
          <i className="is-ground" aria-hidden="true" />
          Ground truth
        </span>
        <span>
          <i className="is-predicted" aria-hidden="true" />
          Predicted
        </span>
        <span>
          <i className="is-mask" aria-hidden="true" />
          Mask
        </span>
      </div>

      <div className="architecture-map__layout">
        <figure
          className="architecture-map__column"
          aria-labelledby="architecture-training-title"
        >
          <section
            className="architecture-map__panel architecture-map__training"
            data-training-phase={trainingMoment.phase}
            data-training-stage={trainingMoment.stage}
          >
            <aside
              className={`architecture-map__loss architecture-map__training-layer${lossVisible ? " is-visible" : ""}`}
              aria-label="Loss between ground-truth and output tokens"
            >
              <span>Loss</span>
              <i aria-hidden="true" />
            </aside>

            <div
              className={`architecture-map__training-row architecture-map__training-layer is-output${outputRowVisible ? " is-visible" : ""}${trainingMoment.phase === "predicted" ? " is-resolving-output" : ""}`}
              data-token-phase={predictionApplied ? "predicted" : "masked"}
            >
              {lanes.map((lane) => (
                <article className={`is-${lane.modality}`} key={lane.name}>
                  <small>Output {lane.name} tokens</small>
                  <ArchitectureTokenSequence
                    modality={lane.modality}
                    states={
                      predictionApplied ? lane.outputStates : lane.inputStates
                    }
                    symbol={lane.symbol}
                  />
                </article>
              ))}
            </div>

            <ArchitectureTargetFlow
              isVisible={outputFlowVisible}
              lanes={lanes}
              mode="through-model"
            />

            <div className="architecture-map__backbone">
              <strong>Dynin-Robotics</strong>
              <small>Masked Diffusion Language Model</small>
            </div>

            <ArchitectureTargetFlow lanes={lanes} mode="spacer" />

            <div
              className={`architecture-map__training-row architecture-map__training-layer is-masked${maskedRowVisible ? " is-visible" : ""}${trainingMoment.phase === "masked" ? " is-applying-mask" : ""}`}
              data-token-phase={maskApplied ? "masked" : "ground"}
            >
              {lanes.map((lane) => (
                <article className={`is-${lane.modality}`} key={lane.name}>
                  <small>
                    {lane.modality === "action"
                      ? "Random block masking"
                      : "Random masking"}
                  </small>
                  <ArchitectureTokenSequence
                    modality={lane.modality}
                    states={maskApplied ? lane.inputStates : groundTruthStates}
                    symbol={lane.symbol}
                  />
                </article>
              ))}
            </div>

            <ArchitectureTargetFlow
              isVisible={maskingFlowVisible}
              lanes={lanes}
            />

            <div
              className={`architecture-map__training-row architecture-map__training-layer is-ground-truth${groundTruthVisible ? " is-visible" : ""}`}
            >
              {lanes.map((lane) => (
                <article className={`is-${lane.modality}`} key={lane.name}>
                  <small>GT {lane.name} tokens</small>
                  <ArchitectureTokenSequence
                    modality={lane.modality}
                    states={groundTruthStates}
                    symbol={lane.symbol}
                  />
                </article>
              ))}
            </div>

            <div
              className={`architecture-map__sources${groundTruthVisible ? " is-flow-visible" : ""}`}
            >
              {lanes.map((lane) => (
                <article className={`is-${lane.modality}`} key={lane.name}>
                  <span>{lane.tokenizer}</span>
                  <strong>{lane.input}</strong>
                </article>
              ))}
            </div>
          </section>
          <figcaption
            className="architecture-map__caption"
            id="architecture-training-title"
          >
            Training
          </figcaption>
        </figure>

        <figure
          className="architecture-map__column"
          aria-labelledby="architecture-inference-title"
        >
          <section className="architecture-map__panel architecture-map__inference">
            <div className="architecture-map__inference-stack">
              {lanes.map((lane) => (
                <article
                  className={`architecture-map__decoder is-${lane.modality}`}
                  key={lane.name}
                >
                  <header>
                    <strong>{lane.name}</strong>
                    <span>{lane.decode}</span>
                  </header>
                  <div className="architecture-map__decode-flow">
                    <div
                      className="architecture-map__decode-steps"
                      data-visible-rows={visibleInferenceRows}
                    >
                      {inferenceStates[lane.modality].map(
                        (states, rowIndex) => (
                          <ArchitectureTokenSequence
                            isRevealed={rowIndex < visibleInferenceRows}
                            modality={lane.modality}
                            states={states}
                            symbol={lane.symbol}
                            key={rowIndex}
                          />
                        ),
                      )}
                    </div>
                    <span
                      className="architecture-map__decode-arrow"
                      aria-hidden="true"
                    />
                    <div className="architecture-map__detokenizer">
                      <small>{lane.output}</small>
                      <span>Detokenizer</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <figcaption
            className="architecture-map__caption"
            id="architecture-inference-title"
          >
            Inference
          </figcaption>
        </figure>
      </div>
    </figure>
  );
}

function CapabilityChapter({
  number,
  objective,
}: {
  number: string;
  objective: Objective;
}) {
  return (
    <article className="capability-chapter reveal">
      <div className="capability-copy">
        <div>
          <span>{number}</span>
          <p>{objective.subtitle}</p>
        </div>
        <h3>{objective.title}</h3>
        <p>{objective.description}</p>
        <dl>
          <div>
            <dt>Visible context</dt>
            <dd>{objective.inputSummary}</dd>
          </div>
          <div>
            <dt>Masked target</dt>
            <dd>{objective.outputSummary}</dd>
          </div>
        </dl>
      </div>
      <UnifiedQueryFigure objective={objective} stage={4} compact />
    </article>
  );
}

function InferenceStageRail({
  active,
  activeSlots,
  targetSlots = [],
  flowSlots = [],
  slotLabels = {},
  placement,
}: {
  active: boolean;
  activeSlots: InferenceSlotKey[];
  targetSlots?: InferenceSlotKey[];
  flowSlots?: InferenceSlotKey[];
  slotLabels?: Partial<Record<InferenceSlotKey, string>>;
  placement: "input" | "output";
}) {
  const visibleLabels = inferenceStageSlots
    .filter((slot) => active && activeSlots.includes(slot.key))
    .map((slot) => slotLabels[slot.key] ?? slot.label)
    .join(", ");

  return (
    <div
      className={`inference-module__rail is-${placement}`}
      aria-label={`${placement === "output" ? "Outputs" : "Inputs"}: ${
        visibleLabels || "none"
      }`}
    >
      {inferenceStageSlots.map((slot) => {
        const slotActive = active && activeSlots.includes(slot.key);
        const isTarget = slotActive && targetSlots.includes(slot.key);
        const isFlowSource =
          placement === "input" && flowSlots.includes(slot.key);
        const slotLabel =
          slotLabels[slot.key] ??
          (!slotActive && slot.key === "generatedVision"
            ? "State"
            : slot.label);

        return (
          <span
            className={`inference-module__token modality-${slot.modality} ${
              slotActive ? "is-active" : "is-inactive"
            } ${isTarget ? "is-target" : ""} ${
              isFlowSource ? "is-flow-source" : ""
            }`}
            data-active={slotActive}
            data-slot={slot.key}
            data-symbol={slot.symbol}
            key={slot.key}
          >
            <i aria-hidden="true">{slotActive ? slot.symbol : ""}</i>
            <small data-multiline={slotLabel.includes("\n")}>
              {slotLabel}
            </small>
          </span>
        );
      })}
    </div>
  );
}

function InferenceStage({
  index,
  label,
  active,
  kind,
  variant,
  activeInputs,
  includeObjectiveOutput = true,
  solidOutputSlots = [],
  flowSlots = [],
  inputSlotLabels = {},
  outputSlotLabels = {},
}: {
  index: string;
  label: string;
  active: boolean;
  kind: InferenceStageKind;
  variant?: "policy" | "joint" | "candidate" | "rerank";
  activeInputs: InferenceSlotKey[];
  includeObjectiveOutput?: boolean;
  solidOutputSlots?: InferenceSlotKey[];
  flowSlots?: InferenceSlotKey[];
  inputSlotLabels?: Partial<Record<InferenceSlotKey, string>>;
  outputSlotLabels?: Partial<Record<InferenceSlotKey, string>>;
}) {
  const modalityOutputs: InferenceSlotKey[] =
    kind === "goal"
      ? ["generatedVision"]
      : kind === "policy"
        ? variant === "joint"
          ? ["action", "generatedVision"]
          : ["action"]
        : ["generatedVision"];
  const activeOutputs: InferenceSlotKey[] = [
    ...(includeObjectiveOutput ? (["objective"] as InferenceSlotKey[]) : []),
    ...modalityOutputs,
  ];
  const targetOutputs = activeOutputs.filter(
    (slot) => slot !== "objective" && !solidOutputSlots.includes(slot),
  );

  return (
    <article
      className={`inference-module is-${kind} ${
        active ? "is-active" : "is-inactive"
      } is-${variant ?? kind} ${flowSlots.length ? "has-token-flow" : ""}`}
      aria-label={`Stage ${index}, ${label}: ${
        active ? "active" : "not used"
      }`}
    >
      <header>
        <span>{index.padStart(2, "0")}</span>
        <strong>{label}</strong>
      </header>
      <div className="inference-module__row is-output">
        <InferenceStageRail
          active={active}
          activeSlots={activeOutputs}
          targetSlots={targetOutputs}
          slotLabels={outputSlotLabels}
          placement="output"
        />
      </div>
      <div className="inference-module__core">
        <strong>Dynin-Robotics</strong>
      </div>
      <div className="inference-module__row is-input">
        <InferenceStageRail
          active={active}
          activeSlots={["objective", ...activeInputs]}
          flowSlots={flowSlots}
          slotLabels={inputSlotLabels}
          placement="input"
        />
      </div>
    </article>
  );
}

function InferenceExplorer() {
  const [activeMode, setActiveMode] = useState(0);
  const mode = inferenceModes[activeMode];
  const worldActive = mode.world === "rerank";
  const policyVariant =
    mode.world === "joint"
      ? ("joint" as const)
      : mode.world === "rerank"
        ? ("candidate" as const)
        : ("policy" as const);
  const policyLabel =
    policyVariant === "joint"
      ? "Policy + World Model"
      : policyVariant === "candidate"
        ? "Policy Candidates"
        : "Policy";
  const goalFlowSlots: InferenceSlotKey[] =
    ["c", "e", "f"].includes(mode.key) ? ["generatedVision"] : [];
  const goalSolidOutputSlots: InferenceSlotKey[] =
    ["c", "e", "f"].includes(mode.key) ? ["generatedVision"] : [];
  const goalOutputSlotLabels: Partial<Record<InferenceSlotKey, string>> =
    ["c", "e", "f"].includes(mode.key)
      ? { generatedVision: "Goal state" }
      : {};
  const policyFlowSlots: InferenceSlotKey[] =
    ["a", "c", "d", "f"].includes(mode.key)
      ? ["action"]
      : ["b", "e"].includes(mode.key)
        ? ["action", "generatedVision"]
        : [];
  const policySolidOutputSlots: InferenceSlotKey[] =
    ["a", "c", "d", "f"].includes(mode.key)
      ? ["action"]
      : ["b", "e"].includes(mode.key)
        ? ["action", "generatedVision"]
        : [];
  const policyInputSlotLabels: Partial<Record<InferenceSlotKey, string>> =
    mode.key === "c"
      ? { generatedVision: "Goal state" }
      : mode.key === "d"
        ? { action: "Actions" }
        : mode.key === "e"
          ? {
              stateVision: "State",
              generatedVision: "State",
            }
          : mode.key === "f"
            ? { generatedVision: "Goal state" }
            : {};
  const policyOutputSlotLabels: Partial<Record<InferenceSlotKey, string>> =
    mode.key === "b"
      ? { generatedVision: "Next state" }
      : mode.key === "d"
        ? { action: "Actions" }
        : mode.key === "e"
          ? { generatedVision: "Next states" }
          : {};
  const worldFlowSlots: InferenceSlotKey[] =
    ["d", "f"].includes(mode.key) ? ["generatedVision"] : [];
  const worldSolidOutputSlots: InferenceSlotKey[] =
    ["d", "f"].includes(mode.key) ? ["generatedVision"] : [];
  const worldOutputSlotLabels: Partial<Record<InferenceSlotKey, string>> =
    ["d", "f"].includes(mode.key)
      ? { generatedVision: "Next states" }
      : {};

  return (
    <div className="inference-explorer reveal">
      <div className="inference-explorer__figure-shell">
        <section
          className="inference-panel"
          role="tabpanel"
          id="inference-mode-panel"
          aria-labelledby="inference-mode-title"
          aria-describedby="inference-mode-summary"
          tabIndex={0}
        >
          <div
            className="inference-panel__intro"
            aria-live="polite"
            aria-atomic="true"
          >
            <h3 id="inference-mode-title">{mode.title}</h3>
            <p id="inference-mode-summary">{mode.summary}</p>
          </div>

          <div className="inference-chain-scroll">
            <div
              className={`inference-chain world-${mode.world} ${
                mode.goal ? "goal-active" : "goal-inactive"
              }`}
            >
              <InferenceStage
                index="1"
                label="Goal-State Prediction"
                active={mode.goal}
                kind="goal"
                activeInputs={["stateVision", "instructionText"]}
                includeObjectiveOutput={!["c", "e", "f"].includes(mode.key)}
                solidOutputSlots={goalSolidOutputSlots}
                flowSlots={goalFlowSlots}
                outputSlotLabels={goalOutputSlotLabels}
              />
              <div
                className={`inference-connector ${
                  mode.goal ? "is-active" : "is-inactive"
                }`}
                aria-hidden="true"
              >
                <span>
                  {mode.goal ? (
                    <>
                      goal
                      <br />
                      state
                    </>
                  ) : null}
                </span>
                <i />
              </div>
              <InferenceStage
                index="2"
                label={policyLabel}
                active
                kind="policy"
                variant={policyVariant}
                includeObjectiveOutput={
                  !["a", "b", "c", "d", "e", "f"].includes(mode.key)
                }
                solidOutputSlots={policySolidOutputSlots}
                flowSlots={policyFlowSlots}
                inputSlotLabels={policyInputSlotLabels}
                outputSlotLabels={policyOutputSlotLabels}
                activeInputs={
                  mode.key === "e"
                    ? ["stateVision", "instructionText"]
                    : mode.goal
                      ? [
                          "stateVision",
                          "instructionText",
                          "generatedVision",
                        ]
                      : ["stateVision", "instructionText"]
                }
              />
              <div
                className={`inference-connector ${
                  worldActive ? "is-active" : "is-inactive"
                }`}
                aria-hidden="true"
              >
                <span>{worldActive ? "action candidates" : ""}</span>
                <i />
              </div>
              <InferenceStage
                index="3"
                label="World-Model Reranking"
                active={worldActive}
                kind="world"
                variant="rerank"
                includeObjectiveOutput={!["d", "f"].includes(mode.key)}
                solidOutputSlots={worldSolidOutputSlots}
                flowSlots={worldFlowSlots}
                outputSlotLabels={worldOutputSlotLabels}
                activeInputs={[
                  "stateVision",
                  "instructionText",
                  "action",
                ]}
              />
            </div>
          </div>
        </section>
      </div>

      <div
        className="inference-tabs"
        role="tablist"
        aria-label="Inference mode"
        style={
          {
            "--active-index": activeMode,
          } as CSSProperties
        }
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
          }
          event.preventDefault();
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? inferenceModes.length - 1
                : (activeMode +
                    (event.key === "ArrowLeft" ? -1 : 1) +
                    inferenceModes.length) %
                  inferenceModes.length;
          setActiveMode(next);
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>('[role="tab"]')
            [next]?.focus();
        }}
      >
        <span className="inference-tabs__plate" aria-hidden="true" />
        {inferenceModes.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === index}
            aria-controls="inference-mode-panel"
            id={`inference-tab-${item.key}`}
            tabIndex={activeMode === index ? 0 : -1}
            className={activeMode === index ? "is-active" : ""}
            onClick={() => setActiveMode(index)}
            key={item.key}
          >
            {item.short}
          </button>
        ))}
      </div>
    </div>
  );
}

function FrameStrip({
  count = 5,
  playback = false,
  numbered = true,
  images,
  label,
}: {
  count?: number;
  playback?: boolean;
  numbered?: boolean;
  images?: string[];
  label: string;
}) {
  return (
    <div
      className={`qualitative-frame-strip${playback ? " is-playback" : ""}`}
      aria-label={label}
    >
      {images
        ? images.map((src, index) => (
            <img
              alt={`${label}, frame ${index + 1}`}
              decoding="async"
              key={src}
              loading="lazy"
              src={assetPath(src)}
            />
          ))
        : Array.from({ length: count }, (_, index) => (
            <i
              aria-hidden="true"
              key={index}
              style={{ "--frame-index": index } as CSSProperties}
            >
              {numbered && <span>{String(index + 1).padStart(2, "0")}</span>}
            </i>
          ))}
      {playback && (
        <span className="qualitative-playback-label" aria-hidden="true">
          <i />
          frame playback
        </span>
      )}
    </div>
  );
}

function SingleFramePlaceholder({ label }: { label: string }) {
  return (
    <div className="qualitative-single-frame" aria-label={label}>
      <span aria-hidden="true">asset placeholder</span>
    </div>
  );
}

function TextPlaceholder({ label }: { label: string }) {
  return (
    <div className="qualitative-text-placeholder" aria-label={label}>
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <small aria-hidden="true">text placeholder</small>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="qualitative-flow-arrow" aria-hidden="true">
      <i />
    </div>
  );
}

function QualitativeResults() {
  return (
    <div className="qualitative-results reveal">
      <section className="qualitative-capability is-world">
        <header className="qualitative-capability__header">
          <div>
            <h3>World Modeling</h3>
            <p>
              Predict future visual states from five observed frames and a
              six-dimensional robot action.
            </p>
          </div>
        </header>
        <div className="qualitative-example-list">
          {worldQualitativeRows.map((row, index) => (
            <article
              className="qualitative-example-row is-world-row"
              key={row.key}
            >
              <div className="qualitative-flow is-world">
                <div className="qualitative-flow-group">
                  <header>
                    <strong>Past frames</strong>
                  </header>
                  <FrameStrip
                    images={worldFramePaths(row.key, "input")}
                    numbered={false}
                    label={`World modeling row ${index + 1}: past frames`}
                  />
                  <div className="qualitative-action-placeholder">
                    <strong>Action</strong>
                    <div
                      aria-label={`World modeling row ${index + 1}: six-dimensional action`}
                    >
                      {row.action.map((value, actionIndex) => (
                        <span key={actionIndex}>{value}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <FlowArrow />
                <div className="qualitative-world-output">
                  <div className="qualitative-flow-group">
                    <header>
                      <strong>Predicted next frames</strong>
                    </header>
                    <FrameStrip
                      images={worldFramePaths(row.key, "prediction")}
                      numbered={false}
                      label={`World modeling row ${index + 1}: predicted next frames`}
                    />
                  </div>
                  <div className="qualitative-flow-group">
                    <header>
                      <strong>Ground truth next frames</strong>
                    </header>
                    <FrameStrip
                      images={worldFramePaths(row.key, "target")}
                      numbered={false}
                      label={`World modeling row ${index + 1}: ground-truth next frames`}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="qualitative-capability is-goal">
        <header className="qualitative-capability__header">
          <span>02 · Goal visualization</span>
          <div>
            <h3>Goal-State Prediction</h3>
            <p>
              An initial state and a language instruction condition the
              generated goal state.
            </p>
          </div>
        </header>
        <div className="qualitative-example-list">
          {[1, 2].map((example) => (
            <article className="qualitative-example-row" key={example}>
              <span className="qualitative-example-index">
                Example {String(example).padStart(2, "0")}
              </span>
              <div className="qualitative-flow is-goal">
                <div className="qualitative-flow-group">
                  <header>
                    <strong>Initial state</strong>
                    <span>Image input</span>
                  </header>
                  <SingleFramePlaceholder
                    label={`Goal-state example ${example}: initial-state image placeholder`}
                  />
                </div>
                <div className="qualitative-flow-group">
                  <header>
                    <strong>Instruction</strong>
                    <span>Text input</span>
                  </header>
                  <TextPlaceholder
                    label={`Goal-state example ${example}: instruction placeholder`}
                  />
                </div>
                <FlowArrow />
                <div className="qualitative-flow-group">
                  <header>
                    <strong>Predicted goal state</strong>
                    <span>Image generation</span>
                  </header>
                  <SingleFramePlaceholder
                    label={`Goal-state example ${example}: generated goal-state placeholder`}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="qualitative-capability is-task">
        <header className="qualitative-capability__header">
          <span>03 · Language reconstruction</span>
          <div>
            <h3>Task Understanding</h3>
            <p>
              An ordered frame sequence plays as a short clip and is decoded
              into a task instruction.
            </p>
          </div>
        </header>
        <div className="qualitative-example-list">
          {[1, 2].map((example) => (
            <article className="qualitative-example-row" key={example}>
              <span className="qualitative-example-index">
                Example {String(example).padStart(2, "0")}
              </span>
              <div className="qualitative-flow is-task">
                <div className="qualitative-flow-group">
                  <header>
                    <strong>Task video frames</strong>
                    <span>Sequential playback</span>
                  </header>
                  <FrameStrip
                    count={6}
                    playback
                    label={`Task-understanding example ${example}: six-frame video placeholder`}
                  />
                </div>
                <FlowArrow />
                <div className="qualitative-flow-group">
                  <header>
                    <strong>Generated instruction</strong>
                    <span>Text generation</span>
                  </header>
                  <TextPlaceholder
                    label={`Task-understanding example ${example}: generated instruction placeholder`}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="qualitative-results__note">
        Goal-state and task-understanding media remain intentionally omitted in
        this draft. Their outlined slots are ready for final assets.
      </p>
    </div>
  );
}

function BenchmarkTable({
  title,
  caption,
  columns,
  rows,
}: {
  title: string;
  caption: string;
  columns: string[];
  rows: Array<{
    model: string;
    family: string;
    values: string[];
    ours?: boolean;
  }>;
}) {
  return (
    <article className="benchmark-table reveal">
      <header>
        <div>
          <span>{caption}</span>
          <h3>{title}</h3>
        </div>
        <p>Success rate (%)</p>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Family</th>
              {columns.map((column) => (
                <th scope="col" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={row.ours ? "is-ours" : ""} key={row.model}>
                <th scope="row">{row.model}</th>
                <td>{row.family}</td>
                {row.values.map((value, index) => (
                  <td key={`${row.model}-${columns[index]}`}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function RealWorldPlaceholders() {
  const tasks = [
    { name: "Fruit PnP", score: "97.5" },
    { name: "Cube Sort", score: "85.5" },
    { name: "Cube Stack", score: "62.0" },
    { name: "Color-Ordered Stack", score: "68.5" },
  ];
  return (
    <div className="real-world-placeholders reveal">
      <div className="real-world-task-grid">
        {tasks.map((task) => (
          <div className="real-world-task" key={task.name}>
            <header>
              <strong>{task.name}</strong>
              <span>{task.score}% SR</span>
            </header>
            <div>
              {Array.from({ length: 4 }, (_, index) => (
                <i key={index}>
                  <span>{index + 1}</span>
                </i>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="figure-note">
        Real-world average: 78.4%. Video and frame assets are intentionally empty
        in the current structural draft.
      </p>
    </div>
  );
}

function LegacyObjectiveSwitcher({
  active,
  onSelect,
}: {
  active: ObjectiveKey;
  onSelect: (key: ObjectiveKey) => void;
}) {
  const labels: Record<ObjectiveKey, string> = {
    policy: "Policy",
    world: "World Modeling",
    goal: "Goal State\nPrediction",
    instruction: "Task Understanding",
  };

  return (
    <div
      className="objective-switcher"
      role="tablist"
      aria-label="Robot capability"
      style={
        {
          "--active-index": objectiveOrder.indexOf(active),
        } as CSSProperties
      }
    >
      <span className="objective-switcher__plate" aria-hidden="true" />
      {objectiveOrder.map((key) => (
        <button
          type="button"
          role="tab"
          aria-selected={active === key}
          className={active === key ? "is-active" : ""}
          onClick={() => onSelect(key)}
          key={key}
        >
          {labels[key]}
        </button>
      ))}
    </div>
  );
}

function ObjectiveFrameSequence({
  assets,
  label,
}: {
  assets: string[];
  label: string;
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const preloadFrames = assets.map((asset) => {
      const image = new Image();
      image.src = assetPath(asset);
      return image.decode().catch(() => undefined);
    });

    void Promise.all(preloadFrames).then(() => {
      if (!cancelled) {
        setFrameIndex(0);
        setIsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [assets]);

  useEffect(() => {
    if (
      !isReady ||
      assets.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % assets.length);
    }, 100);

    return () => window.clearInterval(timer);
  }, [assets.length, isReady]);

  return (
    <img
      className="objective-sequence-image"
      src={assetPath(assets[frameIndex])}
      alt={label}
      draggable={false}
    />
  );
}

function LegacyObjectiveFigure({
  objective,
  stage,
}: {
  objective: Objective;
  stage: number;
}) {
  const conditionUnion: Array<{
    key: ConditionKey;
    label: string;
    modality: Modality;
  }> = [
    { key: "state", label: "State", modality: "vision" },
    { key: "instruction", label: "Instruction", modality: "text" },
    { key: "action", label: "Action", modality: "action" },
    { key: "goal", label: "Goal", modality: "vision" },
    { key: "sensor", label: "Sensor", modality: "sensor" },
  ];
  const activeOutput: Record<ObjectiveKey, ConditionKey> = {
    policy: "action",
    world: "state",
    goal: "goal",
    instruction: "instruction",
  };
  const tokenCount = 10;
  const outputOrders: Record<ConditionKey, number[]> = {
    state: [7, 2, 9, 0, 5, 8, 1, 6, 3, 4],
    instruction: [4, 9, 1, 7, 0, 6, 3, 8, 2, 5],
    action: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    goal: [3, 9, 0, 7, 2, 8, 1, 6, 4, 5],
    sensor: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  };
  const outputKey = activeOutput[objective.key];
  const outputSlotIndex = conditionUnion.findIndex(
    (item) => item.key === outputKey,
  );
  const outputSlotPosition = (outputSlotIndex + 0.5) * 20;
  const outputModality = conditionUnion[outputSlotIndex].modality;
  const hasNarrativeAnimation =
    overviewNarrativeObjectives.includes(objective.key);
  const narrativeOutputCommitCounts = [
    0, 0, 0, 0, 0, 2, 4, 6, 8, 10, 10,
  ];
  const outputCommitCounts = narrativeOutputCommitCounts;
  const activeStage = Math.min(stage, outputCommitCounts.length - 1);
  const committed = outputCommitCounts[activeStage];
  const previousCommitted =
    activeStage === 0 ? 0 : outputCommitCounts[activeStage - 1];
  const outputOrder = outputOrders[outputKey];
  const inputValues = overviewInputValues[objective.key] ?? {};

  return (
    <figure
      className={`generation-stage objective-${objective.key} phase-${activeStage} modality-${objective.targetModality} ${
        hasNarrativeAnimation ? "has-narrative-animation" : ""
      }`}
      aria-label={`${objective.title} reference animation`}
    >
      <div className="output-ports" aria-label="Output modalities">
        <span
          className={`output-route-highlight modality-${outputModality}`}
          style={
            {
              "--route-start": `${Math.min(50, outputSlotPosition)}%`,
              "--route-width": `${Math.abs(50 - outputSlotPosition)}%`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
        <span
          className={`output-flow-comet modality-${outputModality}`}
          style={
            {
              "--output-slot": `${outputSlotPosition}%`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
        {conditionUnion.map((port) => {
          const isTarget = outputKey === port.key;
          const isActive =
            isTarget && (!hasNarrativeAnimation || activeStage >= 3);
          return (
            <div
              className={`output-port modality-${port.modality} ${
                isActive ? "is-active" : ""
              }`}
              key={port.key}
            >
              {objective.key === "policy" && port.key === "action" ? (
                <span
                  className="objective-output-value is-action-vector"
                  aria-hidden={activeStage !== 10}
                >
                  <span>-0.80, -0.55, 0.18,</span>
                  <span>0.04, -0.15, 0.41</span>
                </span>
              ) : null}
              {objective.key === "world" && port.key === "state" ? (
                <span
                  className="objective-output-value is-image"
                  role="img"
                  aria-label="Predicted world state"
                  aria-hidden={activeStage !== 10}
                  style={
                    {
                      "--objective-image": `url("${assetPath(
                        "/assets/overview/wm_predict.png",
                      )}")`,
                    } as CSSProperties
                  }
                />
              ) : null}
              {objective.key === "goal" && port.key === "goal" ? (
                <span
                  className="objective-output-value is-image"
                  role="img"
                  aria-label="Predicted goal state"
                  aria-hidden={activeStage !== 10}
                  style={
                    {
                      "--objective-image": `url("${assetPath(
                        "/assets/overview/goal_predict.png",
                      )}")`,
                    } as CSSProperties
                  }
                />
              ) : null}
              {objective.key === "instruction" &&
              port.key === "instruction" ? (
                <span
                  className="objective-output-value is-instruction-text"
                  aria-hidden={activeStage !== 10}
                >
                  <span>Push the faucet of the sink</span>
                  <span>slightly to the left</span>
                </span>
              ) : null}
              <span
                className={`output-port__glyph modality-${port.modality}`}
                aria-hidden="true"
              >
                {Array.from({ length: tokenCount }, (_, index) => {
                  const rank = outputOrder.indexOf(index);
                  const generated = isActive && rank < committed;
                  const isNew =
                    isActive &&
                    rank >= previousCommitted &&
                    rank < committed;
                  return (
                    <i
                      className={`${generated ? "is-generated" : "is-pending"} ${
                        isNew ? "is-new" : ""
                      }`}
                      style={
                        {
                          "--token-delay": `${
                            Math.max(0, rank - previousCommitted) *
                            (hasNarrativeAnimation ? 24 : 64)
                          }ms`,
                        } as CSSProperties
                      }
                      key={index}
                    />
                  );
                })}
              </span>
              <small>{port.label}</small>
            </div>
          );
        })}
      </div>

      <div className="generation-core">
        <span>Dynin-Robotics</span>
      </div>

      <div className="condition-union" aria-label="Condition token union">
        {conditionUnion.map((item, index) => {
          const state = objective.conditions[item.key];
          const slotPosition = (index + 0.5) * 20;
          return state !== "inactive" ? (
            <span
              className={`condition-route-highlight modality-${item.modality}`}
              style={
                {
                  "--route-start": `${Math.min(50, slotPosition)}%`,
                  "--route-width": `${Math.abs(50 - slotPosition)}%`,
                } as CSSProperties
              }
              key={`route-${item.key}`}
              aria-hidden="true"
            />
          ) : null;
        })}
        {conditionUnion.map((item, index) =>
          objective.conditions[item.key] !== "inactive" ? (
            <span
              className={`condition-flow-dot modality-${item.modality}`}
              style={
                {
                  "--flow-slot": `${(index + 0.5) * 20}%`,
                } as CSSProperties
              }
              key={`flow-${item.key}`}
              aria-hidden="true"
            />
          ) : null,
        )}
        {conditionUnion.map((item) => {
          const state = objective.conditions[item.key];
          return (
            <div
              className={`condition-token modality-${item.modality} is-${state}`}
              key={item.key}
            >
              <span
                className={`condition-token__glyph modality-${item.modality}`}
                aria-hidden="true"
              >
                {Array.from({ length: tokenCount }, (_, index) => (
                  <i key={index} />
                ))}
              </span>
              <small>{item.label}</small>
            </div>
          );
        })}
      </div>

      {hasNarrativeAnimation ? (
        <div
          className="objective-condition-values"
          aria-label={`${objective.title} input values`}
        >
          {conditionUnion.map((item) => {
            const value = inputValues[item.key];
            if (!value) {
              return (
                <span
                  className="objective-condition-value-spacer"
                  aria-hidden="true"
                  key={item.key}
                />
              );
            }

            const isVisualValue =
              value.kind === "image" || value.kind === "sequence";
            const valueClass =
              value.kind === "text"
                ? `is-${value.tone}`
                : `is-image ${
                    value.kind === "sequence" ? "is-sequence" : ""
                  }`;
            const valueStyle =
              value.kind === "image"
                ? ({
                    "--objective-image": `url("${assetPath(value.asset)}")`,
                  } as CSSProperties)
                : undefined;
            const renderValueContent = (layer: "base" | "flight") => {
              if (value.kind === "text") {
                return value.lines.map((line) => (
                  <span key={line}>{line}</span>
                ));
              }
              if (value.kind === "sequence") {
                if (layer === "flight") {
                  const stillAsset =
                    value.assets[Math.floor(value.assets.length / 2)];
                  return (
                    <i
                      className="objective-sequence-still"
                      style={
                        {
                          "--sequence-frame-image": `url("${assetPath(
                            stillAsset,
                          )}")`,
                        } as CSSProperties
                      }
                      aria-hidden="true"
                    />
                  );
                }
                return (
                  <ObjectiveFrameSequence
                    assets={value.assets}
                    label={value.label}
                  />
                );
              }
              return null;
            };

            return (
              <span
                className={`objective-condition-value-stack ${valueClass}`}
                key={item.key}
              >
                <span
                  className={`objective-condition-value ${valueClass} is-base`}
                  role={isVisualValue ? "img" : undefined}
                  aria-label={isVisualValue ? value.label : undefined}
                  style={valueStyle}
                >
                  {renderValueContent("base")}
                </span>
                <span
                  className={`objective-condition-value ${valueClass} is-flight`}
                  aria-hidden="true"
                  style={valueStyle}
                >
                  {renderValueContent("flight")}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="generation-progress">
        <div>
          <span>Generation</span>
        </div>
        <div
          className="generation-progress__track"
          role="progressbar"
          aria-label={`${objective.title} reference generation`}
          aria-valuemin={0}
          aria-valuemax={tokenCount}
          aria-valuenow={committed}
        >
          <span style={{ width: `${(committed / tokenCount) * 100}%` }} />
        </div>
      </div>
    </figure>
  );
}

function OriginalUnifiedOverview({
  active,
  objective,
  stage,
  playbackId,
  onSelect,
}: {
  active: ObjectiveKey;
  objective: Objective;
  stage: number;
  playbackId: number;
  onSelect: (key: ObjectiveKey) => void;
}) {
  return (
    <div className="overview-original-ui reveal">
      <div className="overview-original-ui__figure-shell">
        <div className="unified-workspace">
          <LegacyObjectiveFigure
            key={`${objective.key}-${playbackId}`}
            objective={objective}
            stage={stage}
          />
        </div>
      </div>
      <LegacyObjectiveSwitcher active={active} onSelect={onSelect} />
    </div>
  );
}

function LegacyTrainingComparison({
  active,
  objective,
  stage,
  onSelect,
}: {
  active: ObjectiveKey;
  objective: Objective;
  stage: number;
  onSelect: (key: ObjectiveKey) => void;
}) {
  return (
    <div className="legacy-training-comparison reveal">
      <div className="legacy-training-comparison__intro">
        <div>
          <span>Reference implementation</span>
          <h3>Original unified-model interaction</h3>
        </div>
        <p>
          The team implementation is retained for direct comparison. Its
          topology and motion are unchanged; only the original dark palette is
          translated to a light theme.
        </p>
      </div>
      <LegacyObjectiveSwitcher active={active} onSelect={onSelect} />
      <div className="unified-workspace">
        <LegacyObjectiveFigure objective={objective} stage={stage} />
      </div>
    </div>
  );
}

type ThemePreference = "light" | "dark" | "auto";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: string;
}> = [
  { value: "light", label: "Use light theme", icon: "☀" },
  { value: "dark", label: "Use dark theme", icon: "☾" },
  { value: "auto", label: "Use system theme", icon: "A" },
];

function applyThemePreference(preference: ThemePreference) {
  const resolved =
    preference === "auto"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : preference;

  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

function getInitialThemePreference(): ThemePreference {
  if (typeof document === "undefined") return "auto";
  const saved = document.documentElement.dataset.themePreference;
  return saved === "light" || saved === "dark" || saved === "auto"
    ? saved
    : "auto";
}

function ThemeToggle() {
  const [preference, setPreference] =
    useState<ThemePreference>(getInitialThemePreference);

  useEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
    const syncWithSystem = (event: MediaQueryListEvent) => {
      if (document.documentElement.dataset.themePreference !== "auto") return;
      const theme = event.matches ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };

    systemTheme.addEventListener("change", syncWithSystem);
    return () => systemTheme.removeEventListener("change", syncWithSystem);
  }, []);

  const selectTheme = (next: ThemePreference) => {
    setPreference(next);
    window.localStorage.setItem("dynin-color-theme", next);
    applyThemePreference(next);
  };

  return (
    <fieldset className="theme-toggle" aria-label="Choose color theme">
      <legend className="sr-only">Choose color theme</legend>
      {themeOptions.map((option) => (
        <span className="theme-toggle__option" key={option.value}>
          <input
            type="radio"
            name="dynin-color-theme"
            id={`theme-${option.value}`}
            value={option.value}
            checked={preference === option.value}
            onChange={() => selectTheme(option.value)}
            aria-label={option.label}
            suppressHydrationWarning
          />
          <label
            htmlFor={`theme-${option.value}`}
            title={option.label}
            className={`theme-toggle__label is-${option.value}`}
          >
            <span aria-hidden="true">{option.icon}</span>
          </label>
        </span>
      ))}
    </fieldset>
  );
}

export default function Home() {
  const [activeObjective, setActiveObjective] =
    useState<ObjectiveKey>("policy");
  const [overviewObjectiveKey, setOverviewObjectiveKey] =
    useState<ObjectiveKey>("policy");
  const [stage, setStage] = useState(0);
  const [overviewStage, setOverviewStage] = useState(0);
  const [overviewPlaybackId, setOverviewPlaybackId] = useState(0);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewTimerTokenRef = useRef(0);
  const objective = objectives[activeObjective];
  const overviewObjective = objectives[overviewObjectiveKey];
  const trainingStage = Math.min(stage, 4);

  const selectObjective = useCallback((key: ObjectiveKey) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveObjective(key);
    setStage(0);
  }, []);

  const selectOverviewObjective = useCallback((key: ObjectiveKey) => {
    overviewTimerTokenRef.current += 1;
    setOverviewObjectiveKey(key);
    setOverviewStage(0);
    setOverviewPlaybackId((value) => value + 1);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      timerRef.current = setTimeout(() => setStage(4), 0);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    timerRef.current = setTimeout(
      () => setStage((value) => (value >= 4 ? 0 : value + 1)),
      stage === 0 ? 650 : stage === 4 ? 1250 : 760,
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeObjective, stage]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasNarrativeAnimation =
      overviewNarrativeObjectives.includes(overviewObjectiveKey);
    const finalStage = hasNarrativeAnimation ? 10 : 5;
    const timerToken = overviewTimerTokenRef.current + 1;
    overviewTimerTokenRef.current = timerToken;

    if (reduced) {
      const reducedTimer = window.setTimeout(() => {
        if (overviewTimerTokenRef.current === timerToken) {
          setOverviewStage(finalStage);
        }
      }, 0);
      return () => window.clearTimeout(reducedTimer);
    }

    const narrativeDurations = [
      1000, 850, 1050, 1050, 320, 200, 200, 200, 200, 200, 1800,
    ];
    const standardDurations = [760, 760, 760, 760, 760, 1250];
    const duration = hasNarrativeAnimation
      ? narrativeDurations[overviewStage]
      : standardDurations[overviewStage];

    const overviewTimer = window.setTimeout(() => {
      if (overviewTimerTokenRef.current !== timerToken) return;

      if (overviewStage >= finalStage) {
        const currentIndex = objectiveOrder.indexOf(overviewObjectiveKey);
        const nextObjective =
          objectiveOrder[(currentIndex + 1) % objectiveOrder.length];
        setOverviewObjectiveKey(nextObjective);
        setOverviewStage(0);
        return;
      }

      setOverviewStage((value) => value + 1);
    }, duration);
    return () => window.clearTimeout(overviewTimer);
  }, [overviewObjectiveKey, overviewPlaybackId, overviewStage]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateActiveSection = () => {
      const activationLine = 96;
      let currentSection: string | null = null;

      primaryNavigation.forEach(({ id }) => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= activationLine) {
          currentSection = id;
        }
      });

      setActiveSection(currentSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  return (
    <div className="research-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="site-brand" href="#top" aria-label="Dynin-Robotics home">
          <strong>Dynin-Robotics</strong>
        </a>
        <nav aria-label="Primary navigation">
          {primaryNavigation.map(({ id, label }) => {
            const isActive = activeSection === id;
            return (
              <a
                href={`#${id}`}
                className={isActive ? "is-active" : undefined}
                aria-current={isActive ? "location" : undefined}
                key={id}
              >
                {label}
              </a>
            );
          })}
        </nav>
        <div className="header-links">
          <a href={assetPath("/paper.pdf")}>Paper ↗</a>
          <a href="https://aidas.snu.ac.kr" target="_blank" rel="noreferrer">
            AIDAS Lab
          </a>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top">
          <div className="hero__copy reveal is-visible">
            <time className="hero__date" dateTime="2026-08-01">
              August 01, 2026
            </time>
            <h1>Dynin-Robotics</h1>
            <p className="hero__summary">
              Dynin-Robotics is an{" "}
              <strong>
                omnimodal unified diffusion vision-language-action model
              </strong>{" "}
              that formulates language, visual dynamics, goal states, and robot
              actions as conditional targets of a single masked-diffusion
              backbone.
            </p>
            <div className="hero__links">
              <a href={assetPath("/paper.pdf")}>Paper</a>
              <button type="button" disabled title="Model release pending">
                Model
              </button>
              <button type="button" disabled title="Code release pending">
                Code
              </button>
            </div>
            <p className="hero__release-note">
              Model and code will be released soon.
            </p>
          </div>
        </section>

        <section
          className="section section--project-overview"
          id="overview"
        >
          <div className="container">
            <div className="project-overview__intro reveal">
              <h2>Overview</h2>
              <p>
                <strong>Dynin-Robotics</strong> is an omnimodal
                vision-language-action model built on the masked-diffusion
                model (MDM) backbone of Dynin-Omni. It extends a shared discrete
                token space to language, visual observations and future states,
                robot actions, and optional sensor or metadata context,
                representing them as variables of one partially observed
                trajectory. Through unified objective training, a single model
                learns policy generation, action-conditioned world modeling,
                instruction understanding, and goal-state prediction by
                changing only which spans are visible and which are denoised.
                At inference time, this shared interface supports six operating
                modes that combine block-wise action generation with optional
                goal prediction, joint world-action denoising, or
                world-model-based candidate reranking. Across LIBERO,
                LIBERO-Plus, VLABench, and real-world FR3 manipulation,{" "}
                <strong>Dynin-Robotics</strong> achieves strong performance and
                robustness, while an accelerated dInfer path delivers up to
                29.15× higher effective action-token throughput with minimal
                prediction quality degradation.
              </p>
            </div>

            <OriginalUnifiedOverview
              active={overviewObjectiveKey}
              objective={overviewObjective}
              stage={overviewStage}
              playbackId={overviewPlaybackId}
              onSelect={selectOverviewObjective}
            />
          </div>
        </section>

        <section className="section section--motivation">
          <div className="container">
            <SectionLead
              index="01"
              eyebrow="Overview"
              title="Why unify semantics, dynamics, and control?"
              body="Language-oriented policies understand instructions, while video and world models predict how scenes change. Dynin-Robotics brings both abilities—and action generation—into one shared model."
            />
            <ParadigmFigure />
          </div>
        </section>

        <section className="section section--capabilities" id="capabilities">
          <div className="container">
            <SectionLead
              index="02"
              eyebrow="Capabilities"
              title="Four conditional views of the same trajectory"
              body="Every diagram below follows the paper’s Figure 1 and Figure 4 convention: visible inputs sit below the shared model and the queried output sits above it. The horizontal lanes keep text, vision, action, and optional sensor context comparable across objectives."
            />
            <div className="capability-stack">
              {capabilityChapters.map((chapter) => (
                <CapabilityChapter
                  number={chapter.number}
                  objective={chapter.objective}
                  key={chapter.objective.key}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="section section--model" id="model">
          <div className="container">
            <SectionLead
              index="03"
              eyebrow="Architecture"
              title={"One backbone,\nmultiple parallel token pathways"}
              body="A shared bidirectional Transformer reconstructs masked text, image/video, and action tokens through three parallel modality pathways."
            />
            <ArchitectureFigure />
          </div>
        </section>

        <section
          className="section section--training"
          hidden
          id="training"
        >
          <div className="container">
            <SectionLead
              index="04"
              eyebrow="Unified objective training"
              title="Training changes the mask, not the backbone"
              body="For a sampled objective, conditioning tokens remain visible while masking is applied inside the selected target span. Cross-entropy is computed only on masked target positions. The animation shows iterative prediction, confidence-based commitment, and remasking."
            />
            <div className="training-explorer reveal">
              <ObjectiveTabs
                active={activeObjective}
                onSelect={selectObjective}
                controlsPrefix="training-objective"
              />
              <div
                className="training-panel"
                role="tabpanel"
                id={`training-objective-${activeObjective}`}
                aria-labelledby={`training-objective-tab-${activeObjective}`}
                tabIndex={0}
              >
                <div className="training-panel__meta">
                  <div>
                    <span>{objective.index} {objective.title}</span>
                    <strong>{objective.targetLabel}</strong>
                  </div>
                  <p>
                    predict → commit high-confidence tokens → remask uncertainty →
                    repeat
                  </p>
                </div>
                <div className="figure-scroll">
                  <UnifiedQueryFigure
                    objective={objective}
                    stage={trainingStage}
                    caption="Figure 4 training-objective mapping. Optional conditions use dashed borders; inactive variables remain visible only to preserve a stable comparison grid."
                  />
                </div>
                <div className="training-progress">
                  <span>Iterative denoising</span>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={4}
                    aria-valuenow={trainingStage}
                    aria-label={`${objective.title} denoising progress`}
                  >
                    <i style={{ width: `${(trainingStage / 4) * 100}%` }} />
                  </div>
                  <b>
                    {trainingStage === 4
                      ? "complete"
                      : `pass ${trainingStage + 1}`}
                  </b>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--inference" id="inference">
          <div className="container">
            <SectionLead
              index="05"
              eyebrow="Unified inference"
              title="Six modes aligned on one three-stage pipeline"
              body="The same post-trained model can compose goal-state, policy, and world-model queries in different ways. Keeping all three positions fixed makes each mode’s active and inactive queries—and the extra cost of joint decoding or reranking—explicit."
            />
            <InferenceExplorer />
          </div>
        </section>

        <section className="section section--examples" id="examples">
          <div className="container">
            <SectionLead
              index="06"
              eyebrow="Qualitative examples"
              title="Examples"
              body="Qualitative results show how Dynin-Robotics predicts visual futures, imagines instruction-conditioned goal states, and reconstructs task language from frame sequences."
            />
            <QualitativeResults />
          </div>
        </section>

        <section className="section section--real-world" id="real-world">
          <div className="container">
            <SectionLead
              index="07"
              eyebrow="Real-world evaluation"
              title="Real-World Task Sequences"
              body="Four Franka Research 3 tasks are reserved as independent four-frame sequences. Final videos can be inserted without changing the layout."
            />
            <RealWorldPlaceholders />
          </div>
        </section>

        <section className="section section--performance" id="performance">
          <div className="container">
            <SectionLead
              index="08"
              eyebrow="Performance"
              title="Results in the context of major model families"
              body="The selected comparison rows below retain the paper’s model-family grouping. LIBERO is close to saturation, while LIBERO-Plus more clearly exposes robustness to camera, embodiment, language, lighting, background, noise, and layout shifts."
            />
            <BenchmarkTable
              title="LIBERO"
              caption="Paper Table 2 · selected major baselines"
              columns={["Spatial", "Object", "Goal", "Long", "Average ↑"]}
              rows={liberoRows}
            />
            <BenchmarkTable
              title="LIBERO-Plus · zero-shot"
              caption="Paper Table 3 · selected major baselines"
              columns={[
                "Camera",
                "Robot",
                "Language",
                "Light",
                "Background",
                "Noise",
                "Layout",
                "Average ↑",
              ]}
              rows={liberoPlusRows}
            />

            <div className="performance-grid">
              <article className="ablation-card reveal">
                <header>
                  <span>Unified training · Table 11</span>
                  <h3>Objective mixture and instruction-shift robustness</h3>
                </header>
                <div className="ablation-list">
                  {objectiveAblation.map((item, index) => (
                    <div key={item.label}>
                      <span>0{index + 1}</span>
                      <strong>{item.label}</strong>
                      <p>OOD {item.ood}</p>
                      <b>{item.gap} gap</b>
                    </div>
                  ))}
                </div>
                <p>
                  In this sequential ablation, the OOD gap decreases from 13.27
                  to 2.33 points as world modeling, task understanding, and
                  goal-state prediction are added.
                </p>
              </article>

              <article className="vlabench-card reveal">
                <header>
                  <span>VLABench diagnostic · Table 4</span>
                  <h3>VLM and video-model priors fail differently</h3>
                </header>
                <p>
                  Under random instructions, π0.5 loses 0.16 success on
                  InsertFlower and 0.30 on SelectFruit, showing clear language
                  sensitivity. Mimic-Video changes by +0.10 and +0.02,
                  respectively, indicating stronger reliance on visual and
                  task-level action priors.
                </p>
                <div className="prior-comparison">
                  <div>
                    <span>π0.5</span>
                    <strong>Language-oriented prior</strong>
                    <p>stronger semantic sensitivity</p>
                  </div>
                  <i aria-hidden="true" />
                  <div>
                    <span>Mimic-Video</span>
                    <strong>Dynamics-oriented prior</strong>
                    <p>stronger task-level visual prior</p>
                  </div>
                </div>
                <small>
                  This diagnostic explains complementary priors; it is not a
                  standalone ranking of overall policy quality.
                </small>
              </article>
            </div>
            <p className="results-note reveal">
              Dynin-Robotics reports 98.1 average on LIBERO and 73.0 zero-shot
              average on LIBERO-Plus. ABot-M0 remains higher on both selected
              comparison tables (98.6 and 80.5), while Dynin-Robotics is higher
              than the listed unified baselines MMaDA-VLA on LIBERO and UniVLA
              on LIBERO-Plus.
            </p>
          </div>
        </section>

        <section className="contributors-section" id="contributors">
          <div className="container">
            <h2 className="reveal">Contributors</h2>
            {/* Add `hidden` to this wrapper to hide the contributor details again. */}
            <div>
              <ul className="contributors-section__list reveal">
                <li>
                  <strong>
                    Hoeun Lee
                    <sup>§ ¶</sup>
                  </strong>
                  <span>Project Lead</span>
                </li>
                <li>
                  <strong>
                    Jaeik Kim
                    <sup>¶</sup>
                  </strong>
                  <span>Core Contributor</span>
                </li>
                <li>
                  <strong>
                    Jusang Oh
                    <sup>¶</sup>
                  </strong>
                  <span>Core Contributor</span>
                </li>
                <li>
                  <strong>Geon Choi</strong>
                  <span>Evaluation</span>
                </li>
                <li>
                  <strong>Jinhyeok Kim</strong>
                  <span>Acceleration</span>
                </li>
                <li>
                  <strong>Hyeonggeun Kim</strong>
                  <span>Real-World Setup</span>
                </li>
                <li>
                  <strong>
                    Jaeyoung Do
                    <sup>†</sup>
                  </strong>
                  <span>Supervisor</span>
                </li>
              </ul>
              <div
                className="contributors-section__notes reveal"
                aria-label="Contributor role notes"
              >
                <p>
                  <sup>§</sup>: Project lead.
                </p>
                <p>
                  <sup>¶</sup>: Core contributors
                </p>
                <p>
                  <sup>†</sup>: Supervision and Corresponding author
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div>
            <strong>Dynin-Robotics</strong>
            <p>AIDAS Lab · Seoul National University</p>
          </div>
          <ThemeToggle />
          <div>
            <span>© 2026 Dynin-Robotics</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
