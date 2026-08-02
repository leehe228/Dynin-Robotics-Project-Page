"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
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
const WORLD_OUTPUT_FRAME_COUNT = 5;
const WORLD_OUTPUT_FRAME_INTERVAL = 100;
const WORLD_OUTPUT_FINAL_HOLD_DURATION = 4500;
const WORLD_SAMPLE_FADE_DURATION = 280;
const GOAL_SAMPLES_PER_PAGE = 2;
const GOAL_SAMPLE_INTERVAL = 5000;
const GOAL_SAMPLE_FADE_DURATION = 280;
const TASK_SAMPLES_PER_PAGE = 2;
const TASK_SAMPLE_INTERVAL = 5000;
const TASK_SAMPLE_FADE_DURATION = 280;
const TASK_VIDEO_FRAME_COUNT = 30;
const TASK_VIDEO_FRAME_INTERVAL = 100;
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
      lines: [" 0.01", " 0.13", " 0.63", " 0.40", "-0.25", "-0.05"],
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

const overviewPolicyActionValues = [
  "-0.80",
  "-0.55",
  " 0.18",
  "-0.38",
  " 0.87",
  " 0.04",
  "-0.15",
  " 0.41",
  " 0.09",
  " 1.00",
] as const;
const overviewPolicyActionColumnCount = 5;
const overviewPolicyActionRevealCounts = [0, 2, 4, 6, 8, 10] as const;
const overviewTaskInstructionWords = [
  "Push",
  "the",
  "faucet",
  "of",
  "the",
  "sink",
  "slightly",
  "to",
  "the",
  "left",
] as const;
const overviewTaskInstructionRevealOrder = [
  4, 9, 1, 7, 0, 6, 3, 8, 2, 5,
] as const;
const overviewTaskInstructionRevealCounts = [0, 2, 4, 6, 8, 10] as const;

const capabilitySummaryCards = [
  {
    key: "policy",
    title: "Policy",
    body: "Generate robot action sequences from the current visual state and task instruction.",
    inputs: [
      { label: "Current states", modality: "vision" },
      { label: "Instructions", modality: "text" },
      { label: "Goal state", modality: "vision" },
      { label: "Sensor", modality: "sensor" },
    ],
    output: { label: "Action sequence", modality: "action" },
  },
  {
    key: "world",
    title: "World Modeling",
    body: "Predict future visual states from observed frames and robot actions.",
    inputs: [
      { label: "Current states", modality: "vision" },
      { label: "Instructions", modality: "text" },
      { label: "Actions", modality: "action" },
    ],
    output: { label: "Next states", modality: "vision" },
  },
  {
    key: "goal",
    title: "Goal-State Prediction",
    body: "Generate a goal state from an initial observation and language instruction.",
    inputs: [
      { label: "Initial state", modality: "vision" },
      { label: "Instructions", modality: "text" },
    ],
    output: { label: "Goal state", modality: "vision" },
  },
  {
    key: "instruction",
    title: "Task Understanding",
    body: "Decode an observed task trajectory into a natural-language task description.",
    inputs: [{ label: "Task video frames", modality: "vision" }],
    output: { label: "Task description", modality: "text" },
  },
] as const;

const policyCapabilityExample = {
  input: "/assets/training/policy_input.png",
  instruction: "Put the glue stick inside the open drawer",
  goal: "/assets/training/policy_goal.png",
  action: ["-0.80", "-0.55", "0.18", "0.04", "-0.15", "0.41"],
} as const;

const goalCapabilityExample = {
  input: "/assets/training/goal_input.png",
  instruction: "Unfold the white towel on the table",
  generated: "/assets/training/goal_gen.png",
} as const;

const worldCapabilityExample = {
  input: "/assets/training/wm_input.png",
  instruction: "Take the purple plush toy out of the bowl",
  action: ["0.01", "0.13", "0.63", "0.40", "-0.25", "-0.05"],
  generated: "/assets/training/wm_gen.png",
} as const;

const taskCapabilityExample = {
  frames: [
    "/assets/training/tu_input1.png",
    "/assets/training/tu_input2.png",
    "/assets/training/tu_input3.png",
    "/assets/training/tu_input4.png",
    "/assets/training/tu_input5.png",
  ],
  description: "Push the faucet of the sink slightly to the left",
} as const;

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

const INFERENCE_MODE_CYCLE_INTERVAL = 2000;

type InferenceStageKind = "goal" | "policy" | "world";
type ObjectiveTokenSymbol = "PO" | "WM" | "GP" | "TU";

const objectiveTokenSymbols: Record<ObjectiveKey, ObjectiveTokenSymbol> = {
  policy: "PO",
  world: "WM",
  goal: "GP",
  instruction: "TU",
};

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

type TrainingObjectiveSlotKey =
  | "objective"
  | "state"
  | "instruction"
  | "action"
  | "goal"
  | "sensor";

type TrainingObjectiveTokenState =
  | "required"
  | "optional"
  | "masked"
  | "inactive";

type TrainingObjectiveCardConfig = {
  key: ObjectiveKey;
  title: string;
  summary: string;
  targetSlot: TrainingObjectiveSlotKey;
  targetLabel: string;
  inputLabels?: Partial<Record<TrainingObjectiveSlotKey, string>>;
  outputLabels?: Partial<Record<TrainingObjectiveSlotKey, string>>;
  inputStates: Record<
    TrainingObjectiveSlotKey,
    TrainingObjectiveTokenState
  >;
};

const trainingObjectiveSlots: Array<{
  key: TrainingObjectiveSlotKey;
  symbol: "OBJ" | "V" | "T" | "A" | "S";
  label: string;
  modality: "objective" | Modality;
}> = [
  {
    key: "objective",
    symbol: "OBJ",
    label: "Objective",
    modality: "objective",
  },
  { key: "state", symbol: "V", label: "State", modality: "vision" },
  {
    key: "instruction",
    symbol: "T",
    label: "Instruction",
    modality: "text",
  },
  { key: "action", symbol: "A", label: "Action", modality: "action" },
  {
    key: "goal",
    symbol: "V",
    label: "Goal state",
    modality: "vision",
  },
  { key: "sensor", symbol: "S", label: "Sensor", modality: "sensor" },
];

const trainingObjectiveCards: TrainingObjectiveCardConfig[] = [
  {
    key: "policy",
    title: "Policy",
    summary:
      "Generate robot actions from the observed state and instruction, with optional goal-state context and sensor input.",
    targetSlot: "action",
    targetLabel: "Action",
    inputStates: {
      objective: "required",
      state: "required",
      instruction: "required",
      action: "masked",
      goal: "optional",
      sensor: "optional",
    },
  },
  {
    key: "world",
    title: "World Modeling",
    summary:
      "Predict the next visual state from the current state, with language and action provided when available.",
    targetSlot: "goal",
    targetLabel: "Next state",
    inputLabels: {
      state: "Current state",
      goal: "State",
    },
    outputLabels: {
      state: "State",
    },
    inputStates: {
      objective: "required",
      state: "required",
      instruction: "optional",
      action: "optional",
      goal: "masked",
      sensor: "inactive",
    },
  },
  {
    key: "goal",
    title: "Goal-State Prediction",
    summary:
      "Generate a visual goal state from the initial observation and task instruction.",
    targetSlot: "goal",
    targetLabel: "Goal state",
    inputLabels: {
      state: "Initial state",
      goal: "State",
    },
    inputStates: {
      objective: "required",
      state: "required",
      instruction: "required",
      action: "inactive",
      goal: "masked",
      sensor: "inactive",
    },
  },
  {
    key: "instruction",
    title: "Task Understanding",
    summary:
      "Recover the task instruction from an observed sequence of robot states.",
    targetSlot: "instruction",
    targetLabel: "Instruction",
    inputLabels: {
      state: "State sequence",
      goal: "State",
    },
    inputStates: {
      objective: "required",
      state: "required",
      instruction: "masked",
      action: "inactive",
      goal: "inactive",
      sensor: "inactive",
    },
  },
];

const liberoRows = [
  {
    model: "π0.5",
    family: "Vision-Language Model",
    values: ["98.8", "98.2", "98.0", "92.4", "96.9"],
  },
  {
    model: "ABot-M0",
    family: "Vision-Language Model",
    values: ["98.8", "99.8", "99.0", "96.6", "98.6"],
  },
  {
    model: "Cosmos Policy",
    family: "Video Generation Model",
    values: ["98.1", "100.0", "98.2", "97.6", "98.5"],
  },
  {
    model: "LingBot-VA",
    family: "Video Generation Model",
    values: ["98.5", "99.6", "97.2", "98.5", "98.5"],
  },
  {
    model: "MMaDA-VLA",
    family: "Unified Model",
    values: ["98.8", "99.8", "98.0", "95.2", "98.0"],
  },
  {
    model: "Dynin-Robotics",
    family: "Unified Model",
    values: ["98.9", "99.8", "97.8", "95.8", "98.1"],
    ours: true,
  },
];

const liberoPlusRows = [
  {
    model: "OpenVLA-OFT",
    family: "Vision-Language Model",
    values: ["56.4", "31.9", "79.5", "88.7", "93.3", "75.8", "74.2", "69.6"],
  },
  {
    model: "π0",
    family: "Vision-Language Model",
    values: ["13.8", "6.0", "58.8", "85.0", "81.4", "79.0", "68.9", "53.6"],
  },
  {
    model: "π0-FAST",
    family: "Vision-Language Model",
    values: ["65.1", "21.6", "61.0", "73.2", "73.2", "74.4", "68.8", "61.6"],
  },
  {
    model: "RIPT-VLA",
    family: "Vision-Language Model",
    values: ["55.2", "31.2", "77.6", "88.4", "91.6", "73.5", "74.2", "68.4"],
  },
  {
    model: "ABot-M0",
    family: "Vision-Language Model",
    values: ["60.4", "67.9", "86.4", "96.2", "91.6", "86.4", "82.6", "80.5"],
  },
  {
    model: "UniVLA",
    family: "Unified Model",
    values: ["1.8", "46.2", "69.6", "69.0", "81.0", "21.2", "31.9", "42.9"],
  },
  {
    model: "Dynin-Robotics",
    family: "Unified Model",
    values: [
      "59.8",
      "48.2",
      "85.0",
      "83.5",
      "84.6",
      "78.2",
      "71.8",
      "73.0",
    ],
    ours: true,
  },
];

const objectiveAblation = [
  { label: "Policy only", id: "47.15", ood: "33.88", gap: "13.27" },
  { label: "+ World Modeling", id: "46.01", ood: "39.54", gap: "6.47" },
  { label: "+ Task Understanding", id: "49.38", ood: "45.29", gap: "4.09" },
  {
    label: "+ Goal-State Prediction",
    id: "49.61",
    ood: "47.28",
    gap: "2.33",
  },
];

const inferenceAblationResults = [
  {
    variant: "(a) Default Policy",
    id: "45.8",
    ood: "41.4",
    gap: "4.4",
    effectiveTps: "9.238",
  },
  {
    variant: "(b) Action/World Model Joint Denoise",
    id: "46.4",
    ood: "40.5",
    gap: "5.9",
    effectiveTps: "8.805",
  },
  {
    variant: "(c) Goal-State Guided Policy",
    id: "45.6",
    ood: "38.2",
    gap: "7.1",
    effectiveTps: "9.208",
  },
  {
    variant: "(d) Action Candidate Reranking",
    id: "46.3",
    ood: "42.0",
    gap: "4.3",
    effectiveTps: "4.904",
  },
  {
    variant: "(e) Goal-State Guided + Action/World Model Joint Denoise",
    id: "49.6",
    ood: "47.2",
    gap: "2.4",
    effectiveTps: "8.709",
  },
  {
    variant: "(f) Goal-State Guided + Action Candidate Reranking",
    id: "48.9",
    ood: "47.7",
    gap: "1.4",
    effectiveTps: "4.828",
  },
] as const;

const accelerationResults = [
  {
    variant: "Base",
    effectiveTps: "9.221",
  },
  {
    variant: "dInfer-BL7",
    effectiveTps: "91.236",
  },
  {
    variant: "dInfer-BL35",
    effectiveTps: "268.834",
  },
] as const;

const accelerationBaselineGroups = [
  {
    family: "Vision-Language Model",
    rows: [
      { model: "OpenVLA-OFT", effectiveTps: "19.114" },
      { model: "π0.5", effectiveTps: "7.351" },
    ],
  },
  {
    family: "Mask Diffusion Model",
    rows: [
      { model: "LLaDA-VLA", effectiveTps: "2.079" },
      { model: "MMaDA-VLA", effectiveTps: "1.827" },
    ],
  },
] as const;

const ACCELERATION_BAR_MAX_TPS = 300;
const accelerationBarTicks = [0, 50, 100, 150, 200, 250, 300] as const;

function getAccelerationBarStyle(effectiveTps: string) {
  const percentage = Math.min(
    (Number(effectiveTps) / ACCELERATION_BAR_MAX_TPS) * 100,
    100,
  );

  return {
    "--acceleration-bar-width": `${percentage}%`,
  } as CSSProperties;
}

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
    key: "row_02_droid_sample_0000",
    action: ["0.01", "0.01", "-0.12", "-0.02", "0.04", "0.00"],
  },
  {
    key: "row_03_rt-1_sample_0002",
    action: ["0.16", "0.20", "-0.11", "-0.09", "0.22", "0.15"],
  },
  {
    key: "row_04_taco_play_sample_0002",
    action: ["-0.13", "0.03", "-0.49", "0.03", "0.36", "-0.04"],
  },
  {
    key: "row_05_jaco_play_sample_0001",
    action: ["-0.90", "-0.71", "0.03", "0.00", "0.00", "0.00"],
  },
] as const;

const goalQualitativeSamples = [
  {
    key: "row_01_droid_sample_0000",
    instruction: "Take the pen out of the cup and place it on the counter",
  },
  {
    key: "row_02_rt-1_sample_0000",
    instruction: "place apple into middle drawer",
  },
  {
    key: "row_03_droid_sample_0000",
    instruction: "Place the t-shirts on the brown box",
  },
  {
    key: "row_04_jaco_play_sample_0006",
    instruction: "place the steak meat in the white plate",
  },
  {
    key: "row_05_droid_sample_0000",
    instruction:
      "Remove the green cloth from the drawer and place it on the bed",
  },
  {
    key: "row_06_droid_sample_0000",
    instruction: "Put the rubik's cube on the top of the shelf",
  },
] as const;

const taskQualitativeSamples = [
  {
    key: "row_01_droid_sample_0004",
    prediction: "Put the purple object in the bowl",
  },
  {
    key: "row_02_droid_sample_0000",
    prediction: "Fold the cloth on the table",
  },
  {
    key: "row_03_rt-1_sample_0003",
    prediction: "Pick pepsi can from middle drawer and place on counter",
  },
  {
    key: "row_04_taco_play_sample_0000",
    prediction: "Grasp the door handle, slide the door to the left",
  },
  {
    key: "row_05_jaco_play_sample_0002",
    prediction: "Pick up the yellow cup",
  },
  {
    key: "row_06_jaco_play_sample_0000",
    prediction: "Place the milk dairy on the table",
  },
] as const;

const goalSamplePageCount = Math.ceil(
  goalQualitativeSamples.length / GOAL_SAMPLES_PER_PAGE,
);

const taskSamplePageCount = Math.ceil(
  taskQualitativeSamples.length / TASK_SAMPLES_PER_PAGE,
);

function worldFramePaths(
  sample: string,
  kind: "input" | "prediction",
) {
  return Array.from(
    { length: WORLD_OUTPUT_FRAME_COUNT },
    (_, index) =>
      `/assets/qualitative/world/${sample}/${kind}_${String(index).padStart(3, "0")}.jpg`,
  );
}

function goalFramePath(
  sample: string,
  kind: "input" | "prediction",
) {
  return `/assets/qualitative/future/${sample}/${kind}.jpg`;
}

function taskVideoFramePath(sample: string, frameIndex: number) {
  return `/assets/qualitative/goal/${sample}/uniform_30_frames/tu_state${frameIndex}.jpg`;
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

function SectionLead({
  title,
  body,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
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
        { count: 1, slot: "text-generation" },
        { count: 2, slot: "generation" },
      ],
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

function TrainingObjectiveRail({
  objective,
  placement,
}: {
  objective: TrainingObjectiveCardConfig;
  placement: "input" | "output";
}) {
  const targetSlot = trainingObjectiveSlots.find(
    (slot) => slot.key === objective.targetSlot,
  );
  const railLabel =
    placement === "output"
      ? `Prediction target: ${objective.targetLabel}`
      : `Training inputs for ${objective.title}`;

  return (
    <div
      className={`inference-module__rail training-objective-card__rail is-${placement}`}
      aria-label={railLabel}
    >
      {trainingObjectiveSlots.map((slot) => {
        const tokenState =
          placement === "output"
            ? slot.key === objective.targetSlot
              ? "target"
              : "inactive"
            : objective.inputStates[slot.key];
        const slotSymbol =
          slot.key === "objective"
            ? objectiveTokenSymbols[objective.key]
            : slot.symbol;
        const isActive = ["required", "optional", "target"].includes(
          tokenState,
        );
        const isTrainingTargetFlow =
          ["policy", "world", "goal", "instruction"].includes(
            objective.key,
          ) &&
          placement === "input" &&
          slot.key === objective.targetSlot;
        const slotLabel =
          placement === "output" && slot.key === objective.targetSlot
            ? objective.targetLabel
            : placement === "output"
              ? objective.outputLabels?.[slot.key] ??
                objective.inputLabels?.[slot.key] ??
                slot.label
              : objective.inputLabels?.[slot.key] ?? slot.label;

        return (
          <span
            className={`inference-module__token training-objective-card__token modality-${slot.modality} is-${tokenState} ${
              isActive ? "is-active" : "is-inactive"
            } ${tokenState === "target" ? "is-target" : ""} ${
              isTrainingTargetFlow ? "is-flow-source" : ""
            }`}
            data-slot={slot.key}
            key={slot.key}
          >
            <i aria-hidden="true">
              {isActive
                ? slot.key === objective.targetSlot && placement === "output"
                  ? targetSlot?.symbol
                  : slotSymbol
                : ""}
            </i>
            <small data-multiline={slotLabel.includes(" ")}>
              {slotLabel}
            </small>
          </span>
        );
      })}
    </div>
  );
}

function TrainingObjectiveCard({
  objective,
}: {
  objective: TrainingObjectiveCardConfig;
}) {
  const headingId = `training-objective-${objective.key}-title`;

  return (
    <article
      className={`inference-module is-active training-objective-card is-${objective.key} ${
        ["policy", "world", "goal", "instruction"].includes(objective.key)
          ? "has-token-flow"
          : ""
      }`}
      aria-labelledby={headingId}
    >
      <header>
        <h3 id={headingId}>{objective.title}</h3>
        <p>{objective.summary}</p>
      </header>
      <div className="inference-module__row is-output">
        <TrainingObjectiveRail objective={objective} placement="output" />
      </div>
      <div className="inference-module__core">
        <strong>Dynin-Robotics</strong>
      </div>
      <div className="inference-module__row is-input">
        <TrainingObjectiveRail objective={objective} placement="input" />
      </div>
    </article>
  );
}

function TrainingObjectiveGrid() {
  return (
    <figure
      className="training-objective-explorer reveal"
      aria-label="Four unified training objectives"
    >
      <div
        className="training-objective-explorer__legend"
        aria-label="Token state legend"
      >
        <span>
          <i className="is-condition" aria-hidden="true" />
          Visible condition
        </span>
        <span>
          <i className="is-optional" aria-hidden="true" />
          Optional
        </span>
      </div>
      <div className="training-objective-grid">
        {trainingObjectiveCards.map((objective) => (
          <TrainingObjectiveCard objective={objective} key={objective.key} />
        ))}
      </div>
      <figcaption className="sr-only">
        Policy, world modeling, goal-state prediction, and instruction
        understanding share the same Dynin-Robotics backbone. Solid tokens are
        visible conditions, dashed tokens are optional, and the masked input is
        reconstructed as the prediction target.
      </figcaption>
    </figure>
  );
}

function InferenceStageRail({
  active,
  activeSlots,
  objectiveSymbol,
  targetSlots = [],
  flowSlots = [],
  slotLabels = {},
  placement,
}: {
  active: boolean;
  activeSlots: InferenceSlotKey[];
  objectiveSymbol: ObjectiveTokenSymbol;
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
        const slotSymbol =
          slot.key === "objective" ? objectiveSymbol : slot.symbol;
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
            data-symbol={slotSymbol}
            key={slot.key}
          >
            <i aria-hidden="true">{slotActive ? slotSymbol : ""}</i>
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
          objectiveSymbol={objectiveTokenSymbols[kind]}
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
          objectiveSymbol={objectiveTokenSymbols[kind]}
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
  const [cycleResetId, setCycleResetId] = useState(0);
  const [tabsFocused, setTabsFocused] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mode = inferenceModes[activeMode];

  const selectInferenceMode = useCallback((index: number) => {
    setActiveMode(index);
    setCycleResetId((current) => current + 1);
  }, []);

  const updateInferencePlatePosition = useCallback(() => {
    const tabs = tabsRef.current;
    const activeButton = tabButtonRefs.current[activeMode];
    if (!tabs || !activeButton) return;

    tabs.style.setProperty(
      "--inference-plate-left",
      `${activeButton.offsetLeft}px`,
    );
    tabs.style.setProperty(
      "--inference-plate-width",
      `${activeButton.offsetWidth}px`,
    );
    tabs.dataset.plateReady = "true";
  }, [activeMode]);

  useLayoutEffect(() => {
    updateInferencePlatePosition();

    const tabs = tabsRef.current;
    if (!tabs || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateInferencePlatePosition);
    observer.observe(tabs);
    tabButtonRefs.current.forEach((button) => {
      if (button) observer.observe(button);
    });

    return () => observer.disconnect();
  }, [updateInferencePlatePosition]);

  useEffect(() => {
    if (tabsFocused) return;

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let modeTimer: number | undefined;

    const scheduleNextMode = () => {
      if (modeTimer !== undefined) window.clearTimeout(modeTimer);
      if (motionPreference.matches) return;

      modeTimer = window.setTimeout(() => {
        setActiveMode((current) => (current + 1) % inferenceModes.length);
      }, INFERENCE_MODE_CYCLE_INTERVAL);
    };

    motionPreference.addEventListener("change", scheduleNextMode);
    scheduleNextMode();

    return () => {
      if (modeTimer !== undefined) window.clearTimeout(modeTimer);
      motionPreference.removeEventListener("change", scheduleNextMode);
    };
  }, [activeMode, cycleResetId, tabsFocused]);

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
          key={mode.key}
          className="inference-panel"
          role="tabpanel"
          id="inference-mode-panel"
          aria-labelledby="inference-mode-title"
          aria-describedby="inference-mode-summary"
          tabIndex={0}
        >
          <div className="inference-panel__intro">
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
        ref={tabsRef}
        className="inference-tabs"
        role="tablist"
        aria-label="Inference mode"
        style={
          {
            "--active-index": activeMode,
          } as CSSProperties
        }
        onFocusCapture={() => setTabsFocused(true)}
        onBlurCapture={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setTabsFocused(false);
          }
        }}
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
          selectInferenceMode(next);
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>('[role="tab"]')
            [next]?.focus();
        }}
      >
        <span className="inference-tabs__plate" aria-hidden="true" />
        {inferenceModes.map((item, index) => (
          <button
            ref={(node) => {
              tabButtonRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={activeMode === index}
            aria-controls="inference-mode-panel"
            id={`inference-tab-${item.key}`}
            tabIndex={activeMode === index ? 0 : -1}
            className={activeMode === index ? "is-active" : ""}
            onClick={() => selectInferenceMode(index)}
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
  numbered = true,
  images,
  label,
  visibleCount,
}: {
  count?: number;
  numbered?: boolean;
  images?: string[];
  label: string;
  visibleCount?: number;
}) {
  const isSequenced = visibleCount !== undefined;

  return (
    <div
      className={`qualitative-frame-strip${isSequenced ? " is-sequenced" : ""}`}
      aria-label={label}
    >
      {images
        ? images.map((src, index) => {
            const isVisible = !isSequenced || index < visibleCount;

            return (
              <img
                alt={`${label}, frame ${index + 1}`}
                aria-hidden={!isVisible}
                className={isVisible ? "is-visible" : undefined}
                decoding="async"
                key={src}
                loading="lazy"
                src={assetPath(src)}
              />
            );
          })
        : Array.from({ length: count }, (_, index) => (
            <i
              aria-hidden="true"
              key={index}
              style={{ "--frame-index": index } as CSSProperties}
            >
              {numbered && <span>{String(index + 1).padStart(2, "0")}</span>}
            </i>
          ))}
    </div>
  );
}

function SingleFrameImage({ src, label }: { src: string; label: string }) {
  return (
    <div className="qualitative-single-frame has-image">
      <img
        alt={label}
        decoding="async"
        loading="lazy"
        src={assetPath(src)}
      />
    </div>
  );
}

function TaskVideoFrame({ src, label }: { src: string; label: string }) {
  return (
    <div aria-label={label} className="qualitative-task-video" role="img">
      <img
        alt=""
        aria-hidden="true"
        decoding="async"
        src={assetPath(src)}
      />
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

function QualitativeSampleNavigation({
  label,
  onPrevious,
  onNext,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div
      aria-label={`${label} sample navigation`}
      className="qualitative-sample-navigation"
      role="group"
    >
      <button
        aria-label={`Previous ${label} sample`}
        onClick={onPrevious}
        type="button"
      >
        <span
          aria-hidden="true"
          className="qualitative-sample-navigation__chevron is-previous"
        />
      </button>
      <button
        aria-label={`Next ${label} sample`}
        onClick={onNext}
        type="button"
      >
        <span
          aria-hidden="true"
          className="qualitative-sample-navigation__chevron is-next"
        />
      </button>
    </div>
  );
}

function TaskUnderstandingResults() {
  const [taskPageIndex, setTaskPageIndex] = useState(0);
  const [taskSamplesAreTransitioning, setTaskSamplesAreTransitioning] =
    useState(false);
  const [taskVideoFrameIndex, setTaskVideoFrameIndex] = useState(0);
  const [taskVideoFramesAreReady, setTaskVideoFramesAreReady] = useState(false);
  const [taskVideoMotionIsReduced, setTaskVideoMotionIsReduced] =
    useState(false);

  useEffect(() => {
    let isCancelled = false;
    const frameDecodes = taskQualitativeSamples.flatMap((sample) =>
      Array.from({ length: TASK_VIDEO_FRAME_COUNT }, async (_, frameIndex) => {
        const image = new window.Image();
        image.src = assetPath(taskVideoFramePath(sample.key, frameIndex));

        try {
          await image.decode();
        } catch {
          // A failed decode should not prevent the remaining frames from playing.
        }
      }),
    );

    void Promise.all(frameDecodes).then(() => {
      if (!isCancelled) {
        setTaskVideoFramesAreReady(true);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncMotionPreference = () => {
      setTaskVideoMotionIsReduced(motionPreference.matches);
      if (motionPreference.matches) {
        setTaskVideoFrameIndex(0);
      }
    };

    syncMotionPreference();
    motionPreference.addEventListener("change", syncMotionPreference);

    return () => {
      motionPreference.removeEventListener("change", syncMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (!taskVideoFramesAreReady || taskVideoMotionIsReduced) {
      return;
    }

    const frameTimer = window.setInterval(() => {
      setTaskVideoFrameIndex(
        (current) => (current + 1) % TASK_VIDEO_FRAME_COUNT,
      );
    }, TASK_VIDEO_FRAME_INTERVAL);

    return () => window.clearInterval(frameTimer);
  }, [taskVideoFramesAreReady, taskVideoMotionIsReduced]);

  useEffect(() => {
    if (!taskVideoFramesAreReady) {
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setTaskSamplesAreTransitioning(true);
    }, TASK_SAMPLE_INTERVAL - TASK_SAMPLE_FADE_DURATION);

    const swapTimer = window.setTimeout(() => {
      setTaskPageIndex((current) => (current + 1) % taskSamplePageCount);
      setTaskSamplesAreTransitioning(false);
      setTaskVideoFrameIndex(0);
    }, TASK_SAMPLE_INTERVAL);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(swapTimer);
    };
  }, [taskPageIndex, taskVideoFramesAreReady]);

  const moveTaskSamplePage = useCallback((offset: -1 | 1) => {
    setTaskSamplesAreTransitioning(false);
    setTaskVideoFrameIndex(0);
    setTaskPageIndex(
      (current) =>
        (current + offset + taskSamplePageCount) % taskSamplePageCount,
    );
  }, []);

  const nextTaskPageIndex = (taskPageIndex + 1) % taskSamplePageCount;
  const visibleTransitionIsActive =
    taskSamplesAreTransitioning && !taskVideoMotionIsReduced;

  return (
    <section className="qualitative-capability is-task">
      <header className="qualitative-capability__header">
        <div>
          <h3>Task Understanding</h3>
          <p>
            An ordered frame sequence plays as a short clip and is decoded into
            a task instruction.
          </p>
        </div>
      </header>
      <div
        className={`qualitative-task-carousel${
          taskSamplesAreTransitioning ? " is-transitioning" : ""
        }`}
      >
        {[taskPageIndex, nextTaskPageIndex].map((pageIndex, layerIndex) => (
          <div
            aria-hidden={
              layerIndex === 0
                ? visibleTransitionIsActive
                : !visibleTransitionIsActive
            }
            className={`qualitative-example-list qualitative-task-page ${
              layerIndex === 0 ? "is-current" : "is-next"
            }`}
            key={layerIndex}
          >
            {taskQualitativeSamples
              .slice(
                pageIndex * TASK_SAMPLES_PER_PAGE,
                (pageIndex + 1) * TASK_SAMPLES_PER_PAGE,
              )
              .map((sample, sampleOffset) => {
                const sampleNumber =
                  pageIndex * TASK_SAMPLES_PER_PAGE + sampleOffset + 1;
                const frameIndex =
                  layerIndex === 0 ? taskVideoFrameIndex : 0;

                return (
                  <article
                    aria-label={`Task-understanding example ${sampleNumber}`}
                    className="qualitative-example-row is-task-row"
                    key={sample.key}
                  >
                    <div className="qualitative-flow is-task">
                      <div className="qualitative-flow-group qualitative-task-input">
                        <header>
                          <strong>Task video</strong>
                        </header>
                        <TaskVideoFrame
                          label={`Task-understanding example ${sampleNumber}: 30-frame task video`}
                          src={taskVideoFramePath(sample.key, frameIndex)}
                        />
                      </div>
                      <FlowArrow />
                      <div className="qualitative-task-output">
                        <div className="qualitative-task-instruction">
                          <strong>Generated task description</strong>
                          <p>{sample.prediction}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        ))}
      </div>
      <QualitativeSampleNavigation
        label="Task Understanding"
        onNext={() => moveTaskSamplePage(1)}
        onPrevious={() => moveTaskSamplePage(-1)}
      />
    </section>
  );
}

function QualitativeResults() {
  const [worldRowIndex, setWorldRowIndex] = useState(0);
  const [worldOutputFramesVisible, setWorldOutputFramesVisible] = useState(0);
  const [worldSamplesAreTransitioning, setWorldSamplesAreTransitioning] =
    useState(false);
  const [goalPageIndex, setGoalPageIndex] = useState(0);
  const [goalSamplesAreTransitioning, setGoalSamplesAreTransitioning] =
    useState(false);

  useEffect(() => {
    for (const row of worldQualitativeRows) {
      for (const kind of ["input", "prediction"] as const) {
        for (const src of worldFramePaths(row.key, kind)) {
          const image = new window.Image();
          image.src = assetPath(src);
        }
      }
    }

    for (const sample of goalQualitativeSamples) {
      for (const kind of ["input", "prediction"] as const) {
        const image = new window.Image();
        image.src = assetPath(goalFramePath(sample.key, kind));
      }
    }

  }, []);

  useEffect(() => {
    if (worldOutputFramesVisible < WORLD_OUTPUT_FRAME_COUNT) {
      const revealTimer = window.setTimeout(() => {
        setWorldOutputFramesVisible((current) =>
          Math.min(current + 1, WORLD_OUTPUT_FRAME_COUNT),
        );
      }, WORLD_OUTPUT_FRAME_INTERVAL);

      return () => window.clearTimeout(revealTimer);
    }

    const fadeTimer = window.setTimeout(() => {
      setWorldSamplesAreTransitioning(true);
    }, WORLD_OUTPUT_FINAL_HOLD_DURATION - WORLD_SAMPLE_FADE_DURATION);

    const nextRowTimer = window.setTimeout(() => {
      setWorldOutputFramesVisible(0);
      setWorldRowIndex(
        (current) => (current + 1) % worldQualitativeRows.length,
      );
      setWorldSamplesAreTransitioning(false);
    }, WORLD_OUTPUT_FINAL_HOLD_DURATION);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(nextRowTimer);
    };
  }, [worldOutputFramesVisible, worldRowIndex]);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setGoalSamplesAreTransitioning(true);
    }, GOAL_SAMPLE_INTERVAL - GOAL_SAMPLE_FADE_DURATION);

    const swapTimer = window.setTimeout(() => {
      setGoalPageIndex((current) => (current + 1) % goalSamplePageCount);
      setGoalSamplesAreTransitioning(false);
    }, GOAL_SAMPLE_INTERVAL);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(swapTimer);
    };
  }, [goalPageIndex]);

  const moveWorldSample = useCallback((offset: -1 | 1) => {
    setWorldSamplesAreTransitioning(false);
    setWorldOutputFramesVisible(0);
    setWorldRowIndex(
      (current) =>
        (current + offset + worldQualitativeRows.length) %
        worldQualitativeRows.length,
    );
  }, []);

  const moveGoalSamplePage = useCallback((offset: -1 | 1) => {
    setGoalSamplesAreTransitioning(false);
    setGoalPageIndex(
      (current) =>
        (current + offset + goalSamplePageCount) % goalSamplePageCount,
    );
  }, []);

  const nextWorldRowIndex =
    (worldRowIndex + 1) % worldQualitativeRows.length;
  const nextGoalPageIndex = (goalPageIndex + 1) % goalSamplePageCount;

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
        <div
          className={`qualitative-world-carousel${
            worldSamplesAreTransitioning ? " is-transitioning" : ""
          }`}
        >
          {[worldRowIndex, nextWorldRowIndex].map((rowIndex, layerIndex) => {
            const worldRow = worldQualitativeRows[rowIndex];

            return (
              <div
                aria-hidden={
                  layerIndex === 0
                    ? worldSamplesAreTransitioning
                    : !worldSamplesAreTransitioning
                }
                className={`qualitative-example-list qualitative-world-page ${
                  layerIndex === 0 ? "is-current" : "is-next"
                }`}
                key={layerIndex}
              >
                <article
                  className="qualitative-example-row is-world-row"
                  key={worldRow.key}
                >
                  <div className="qualitative-flow is-world">
                    <div className="qualitative-flow-group">
                      <header>
                        <strong>Past frames</strong>
                      </header>
                      <FrameStrip
                        images={worldFramePaths(worldRow.key, "input")}
                        numbered={false}
                        label={`World modeling sample ${rowIndex + 1}: past frames`}
                      />
                      <div className="qualitative-action-placeholder">
                        <strong>Action</strong>
                        <div
                          aria-label={`World modeling sample ${rowIndex + 1}: six-dimensional action`}
                        >
                          {worldRow.action.map((value, actionIndex) => (
                            <span key={actionIndex}>{value}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <FlowArrow />
                    <div className="qualitative-world-output">
                      <div className="qualitative-flow-group">
                        <header>
                          <strong>Generated next frames</strong>
                        </header>
                        <FrameStrip
                          images={worldFramePaths(worldRow.key, "prediction")}
                          numbered={false}
                          label={`World modeling sample ${rowIndex + 1}: generated next frames`}
                          visibleCount={
                            layerIndex === 0 ? worldOutputFramesVisible : 0
                          }
                        />
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
        <QualitativeSampleNavigation
          label="World Modeling"
          onNext={() => moveWorldSample(1)}
          onPrevious={() => moveWorldSample(-1)}
        />
      </section>

      <section className="qualitative-capability is-goal">
        <header className="qualitative-capability__header">
          <div>
            <h3>Goal-State Prediction</h3>
            <p>
              An initial state and a language instruction condition the
              generated goal state.
            </p>
          </div>
        </header>
        <div
          className={`qualitative-goal-carousel${
            goalSamplesAreTransitioning ? " is-transitioning" : ""
          }`}
        >
          {[goalPageIndex, nextGoalPageIndex].map((pageIndex, layerIndex) => (
            <div
              aria-hidden={
                layerIndex === 0
                  ? goalSamplesAreTransitioning
                  : !goalSamplesAreTransitioning
              }
              className={`qualitative-example-list qualitative-goal-page ${
                layerIndex === 0 ? "is-current" : "is-next"
              }`}
              key={layerIndex}
            >
              {goalQualitativeSamples
                .slice(
                  pageIndex * GOAL_SAMPLES_PER_PAGE,
                  (pageIndex + 1) * GOAL_SAMPLES_PER_PAGE,
                )
                .map((sample, sampleOffset) => {
                  const sampleNumber =
                    pageIndex * GOAL_SAMPLES_PER_PAGE + sampleOffset + 1;

                  return (
                    <article
                      aria-label={`Goal-state example ${sampleNumber}`}
                      className="qualitative-example-row is-goal-row"
                      key={sample.key}
                    >
                      <div className="qualitative-flow is-goal">
                        <div className="qualitative-flow-group qualitative-goal-input">
                          <header>
                            <strong>Initial state</strong>
                          </header>
                          <SingleFrameImage
                            label={`Goal-state example ${sampleNumber}: initial state`}
                            src={goalFramePath(sample.key, "input")}
                          />
                          <div className="qualitative-goal-instruction">
                            <strong>Instruction</strong>
                            <p>{sample.instruction}</p>
                          </div>
                        </div>
                        <FlowArrow />
                        <div className="qualitative-goal-output">
                          <div className="qualitative-flow-group">
                            <header>
                              <strong>Generated goal state</strong>
                            </header>
                            <SingleFrameImage
                              label={`Goal-state example ${sampleNumber}: generated goal state`}
                              src={goalFramePath(sample.key, "prediction")}
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          ))}
        </div>
        <QualitativeSampleNavigation
          label="Goal-State Prediction"
          onNext={() => moveGoalSamplePage(1)}
          onPrevious={() => moveGoalSamplePage(-1)}
        />
      </section>

      <TaskUnderstandingResults />
    </div>
  );
}

const liberoDemonstrations = [
  {
    key: "spatial",
    title: "Spatial",
    videos: [
      "/assets/benchmark/libero/spatial/spatial_task00_init000_steps106.mp4",
      "/assets/benchmark/libero/spatial/spatial_task04_init024_steps121.mp4",
      "/assets/benchmark/libero/spatial/spatial_task06_init037_steps108.mp4",
      "/assets/benchmark/libero/spatial/spatial_task09_init049_steps119.mp4",
    ],
  },
  {
    key: "object",
    title: "Object",
    videos: [
      "/assets/benchmark/libero/object/object_task00_init000_steps182.mp4",
      "/assets/benchmark/libero/object/object_task04_init024_steps142.mp4",
      "/assets/benchmark/libero/object/object_task06_init037_steps169.mp4",
      "/assets/benchmark/libero/object/object_task09_init049_steps137.mp4",
    ],
  },
  {
    key: "goal",
    title: "Goal",
    videos: [
      "/assets/benchmark/libero/goal/goal_task00_init000_steps151.mp4",
      "/assets/benchmark/libero/goal/goal_task04_init024_steps081.mp4",
      "/assets/benchmark/libero/goal/goal_task06_init037_steps091.mp4",
      "/assets/benchmark/libero/goal/goal_task09_init049_steps119.mp4",
    ],
  },
  {
    key: "long",
    title: "Long",
    videos: [
      "/assets/benchmark/libero/long/long_task00_init000_steps287.mp4",
      "/assets/benchmark/libero/long/long_task04_init024_steps252.mp4",
      "/assets/benchmark/libero/long/long_task06_init037_steps210.mp4",
      "/assets/benchmark/libero/long/long_task09_init049_steps238.mp4",
    ],
  },
] as const;

const liberoPlusDemonstrations = [
  {
    key: "camera",
    title: "Camera",
    videos: [
      "/assets/benchmark/libero-plus/camera_viewpoints/success_01__libero_spatial__task_0713__difficulty_1.mp4",
      "/assets/benchmark/libero-plus/camera_viewpoints/success_03__libero_spatial__task_0706__difficulty_1.mp4",
    ],
  },
  {
    key: "robot",
    title: "Robot",
    videos: [
      "/assets/benchmark/libero-plus/robot_initial_states/success_01__libero_spatial__task_0460__difficulty_1.mp4",
      "/assets/benchmark/libero-plus/robot_initial_states/success_03__libero_spatial__task_0292__difficulty_1.mp4",
    ],
  },
  {
    key: "language",
    title: "Language",
    videos: [
      "/assets/benchmark/libero-plus/language_instructions/success_01__libero_spatial__task_1291__difficulty_1.mp4",
      "/assets/benchmark/libero-plus/language_instructions/success_03__libero_spatial__task_1004__difficulty_1.mp4",
    ],
  },
  {
    key: "light",
    title: "Light",
    videos: [
      "/assets/benchmark/libero-plus/light_conditions/success_01__libero_spatial__task_2303__difficulty_1.mp4",
      "/assets/benchmark/libero-plus/light_conditions/success_03__libero_spatial__task_2265__difficulty_1.mp4",
    ],
  },
  {
    key: "background",
    title: "Background",
    videos: [
      "/assets/benchmark/libero-plus/background_textures/success_01__libero_spatial__task_0022__difficulty_1.mp4",
      "/assets/benchmark/libero-plus/background_textures/success_03__libero_spatial__task_0107__difficulty_1.mp4",
    ],
  },
  {
    key: "noise",
    title: "Noise",
    videos: [
      "/assets/benchmark/libero-plus/sensor_noise/success_01__libero_spatial__task_1525__difficulty_1.mp4",
      "/assets/benchmark/libero-plus/sensor_noise/success_03__libero_spatial__task_1599__difficulty_1.mp4",
    ],
  },
  {
    key: "layout",
    title: "Layout",
    videos: [
      "/assets/benchmark/libero-plus/objects_layout/success_01__libero_spatial__task_1980__difficulty_1.mp4",
      "/assets/benchmark/libero-plus/objects_layout/success_03__libero_spatial__task_1977__difficulty_1.mp4",
    ],
  },
] as const;

const realWorldDemonstrations = [
  "/assets/benchmark/realworld/real_cubestack.mp4",
  "/assets/benchmark/realworld/real_pnp1.mp4",
  "/assets/benchmark/realworld/real_pnp2.mp4",
  "/assets/benchmark/realworld/real_pnp3.mp4",
  "/assets/benchmark/realworld/real_pnp4.mp4",
  "/assets/benchmark/realworld/real_table1.mp4",
  "/assets/benchmark/realworld/real_table2.mp4",
  "/assets/benchmark/realworld/real_table3.mp4",
  "/assets/benchmark/realworld/real_table4.mp4",
] as const;

function DemonstrationVideoGrid({
  label,
  variant,
  columns,
}: {
  label: string;
  variant: "libero" | "libero-plus";
  columns: ReadonlyArray<{
    key: string;
    title: string;
    videos: readonly string[];
  }>;
}) {
  return (
    <div
      aria-label={`${label} demonstration grid`}
      className="demonstration-grid-scroll"
      role="region"
      tabIndex={0}
    >
      <div
        className={`demonstration-video-grid is-${variant}`}
        data-demonstration-grid={variant}
      >
        {columns.map((column) => (
          <article className="demonstration-video-column" key={column.key}>
            <h4>{column.title}</h4>
            <div className="demonstration-video-stack">
              {column.videos.map((src, index) => (
                <video
                  aria-label={`${label} ${column.title} demonstration ${index + 1}`}
                  autoPlay
                  key={src}
                  loop
                  muted
                  onLoadedMetadata={(event) => {
                    if (variant === "libero") {
                      event.currentTarget.defaultPlaybackRate = 2;
                      event.currentTarget.playbackRate = 2;
                    }
                  }}
                  playsInline
                  preload="metadata"
                  ref={(video) => {
                    if (variant === "libero" && video) {
                      video.defaultPlaybackRate = 2;
                      video.playbackRate = 2;
                    }
                  }}
                  src={assetPath(src)}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function DemonstrationResults() {
  return (
    <div className="demonstration-results reveal">
      <section
        aria-labelledby="demonstration-libero-title"
        className="demonstration-subsection"
      >
        <header className="demonstration-subsection__header">
          <h3 id="demonstration-libero-title">LIBERO</h3>
        </header>
        <DemonstrationVideoGrid
          columns={liberoDemonstrations}
          label="LIBERO"
          variant="libero"
        />
      </section>

      <section
        aria-labelledby="demonstration-libero-plus-title"
        className="demonstration-subsection"
      >
        <header className="demonstration-subsection__header">
          <h3 id="demonstration-libero-plus-title">LIBERO+</h3>
        </header>
        <DemonstrationVideoGrid
          columns={liberoPlusDemonstrations}
          label="LIBERO+"
          variant="libero-plus"
        />
      </section>

      <section
        aria-labelledby="demonstration-real-world-title"
        className="demonstration-subsection"
      >
        <header className="demonstration-subsection__header is-real-world">
          <h3 id="demonstration-real-world-title">
            Real-World Manipulation
          </h3>
          <p className="demonstration-real-world-note">
            2× · autonomous
          </p>
        </header>
        <div
          aria-label="Real-World Manipulation demonstration grid"
          className="demonstration-grid-scroll"
          role="region"
          tabIndex={0}
        >
          <div
            className="demonstration-real-world-grid"
            data-demonstration-grid="real-world"
          >
            {realWorldDemonstrations.map((src, index) => (
              <video
                aria-label={`Real-World Manipulation demonstration ${index + 1}`}
                autoPlay
                key={src}
                loop
                muted
                onLoadedMetadata={(event) => {
                  event.currentTarget.defaultPlaybackRate = 2;
                  event.currentTarget.playbackRate = 2;
                }}
                playsInline
                preload="metadata"
                ref={(video) => {
                  if (video) {
                    video.defaultPlaybackRate = 2;
                    video.playbackRate = 2;
                  }
                }}
                src={assetPath(src)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function BenchmarkTable({
  title,
  description,
  columns,
  rows,
  showFamilyDividers = false,
}: {
  title: string;
  description?: string;
  columns: string[];
  rows: Array<{
    model: string;
    family: string;
    values: string[];
    ours?: boolean;
  }>;
  showFamilyDividers?: boolean;
}) {
  const rowGroups = rows.reduce<
    Array<{ family: string; rows: typeof rows }>
  >((groups, row) => {
    const currentGroup = groups.at(-1);

    if (!currentGroup || currentGroup.family !== row.family) {
      groups.push({ family: row.family, rows: [row] });
    } else {
      currentGroup.rows.push(row);
    }

    return groups;
  }, []);

  return (
    <article
      className={`benchmark-table reveal${columns.length > 5 ? " is-wide" : ""}`}
    >
      <header>
        <div className="benchmark-table__heading">
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        <p className="benchmark-table__metric">Success rate (%)</p>
      </header>
      <div
        aria-label={`${title} benchmark results`}
        className="table-scroll"
        role="region"
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">{title} — Success rate (%)</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              {columns.map((column) => (
                <th scope="col" key={column}>
                  {column.endsWith(" ↑") ? (
                    <>
                      {column.slice(0, -2)}
                      <span className="benchmark-table__sort-arrow">↑</span>
                    </>
                  ) : (
                    column
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {rowGroups.map((group, groupIndex) => (
            <tbody aria-label={group.family} key={group.family}>
              <tr
                className={`benchmark-family-row${
                  showFamilyDividers && groupIndex > 0 ? " has-divider" : ""
                }`}
              >
                <th colSpan={columns.length + 1} scope="rowgroup">
                  {group.family}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr
                  className={`benchmark-model-row${row.ours ? " is-ours" : ""}`}
                  key={row.model}
                >
                  <th scope="row">{row.model}</th>
                  {row.values.map((value, index) => (
                    <td key={`${row.model}-${columns[index]}`}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </article>
  );
}

function LegacyObjectiveSwitcher({
  active,
  onSelect,
  onFocusWithinChange,
}: {
  active: ObjectiveKey;
  onSelect: (key: ObjectiveKey) => void;
  onFocusWithinChange?: (focused: boolean) => void;
}) {
  const labels: Record<ObjectiveKey, string> = {
    policy: "Policy",
    world: "World Modeling",
    goal: "Goal-State Prediction",
    instruction: "Task Understanding",
  };
  const switcherRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<ObjectiveKey, HTMLButtonElement | null>>({
    policy: null,
    world: null,
    goal: null,
    instruction: null,
  });

  const updatePlatePosition = useCallback(() => {
    const switcher = switcherRef.current;
    const activeButton = buttonRefs.current[active];
    if (!switcher || !activeButton) return;

    switcher.style.setProperty(
      "--switcher-plate-left",
      `${activeButton.offsetLeft}px`,
    );
    switcher.style.setProperty(
      "--switcher-plate-width",
      `${activeButton.offsetWidth}px`,
    );
    switcher.dataset.plateReady = "true";
  }, [active]);

  useLayoutEffect(() => {
    updatePlatePosition();

    const switcher = switcherRef.current;
    if (!switcher || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updatePlatePosition);
    observer.observe(switcher);
    objectiveOrder.forEach((key) => {
      const button = buttonRefs.current[key];
      if (button) observer.observe(button);
    });

    return () => observer.disconnect();
  }, [updatePlatePosition]);

  const handleSwitcherKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    key: ObjectiveKey,
  ) => {
    const currentIndex = objectiveOrder.indexOf(key);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % objectiveOrder.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + objectiveOrder.length) % objectiveOrder.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = objectiveOrder.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextKey = objectiveOrder[nextIndex];
    buttonRefs.current[nextKey]?.focus();
    onSelect(nextKey);
  };

  return (
    <div
      ref={switcherRef}
      className="objective-switcher"
      role="tablist"
      aria-label="Robot capability"
      onFocusCapture={() => onFocusWithinChange?.(true)}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          onFocusWithinChange?.(false);
        }
      }}
      style={
        {
          "--active-index": objectiveOrder.indexOf(active),
        } as CSSProperties
      }
    >
      <span className="objective-switcher__plate" aria-hidden="true" />
      {objectiveOrder.map((key) => (
        <button
          ref={(node) => {
            buttonRefs.current[key] = node;
          }}
          type="button"
          role="tab"
          aria-selected={active === key}
          tabIndex={active === key ? 0 : -1}
          className={active === key ? "is-active" : ""}
          onClick={() => onSelect(key)}
          onKeyDown={(event) => handleSwitcherKeyDown(event, key)}
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
    instruction: [...overviewTaskInstructionRevealOrder],
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
  const isOutputSettled =
    !hasNarrativeAnimation || activeStage >= outputCommitCounts.length - 1;
  const policyActionStep = Math.max(
    0,
    Math.min(
      activeStage - 4,
      overviewPolicyActionRevealCounts.length - 1,
    ),
  );
  const policyActionRevealCount =
    overviewPolicyActionRevealCounts[policyActionStep];
  const policyActionRevealColumns = policyActionRevealCount / 2;
  const taskInstructionStep = Math.max(
    0,
    Math.min(
      activeStage - 4,
      overviewTaskInstructionRevealCounts.length - 1,
    ),
  );
  const taskInstructionRevealCount =
    overviewTaskInstructionRevealCounts[taskInstructionStep];
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
                  className={`objective-output-value is-action-vector ${
                    isActive ? "is-visible" : ""
                  }`}
                  role="img"
                  aria-hidden={!isActive}
                  aria-label={`Action prediction step ${policyActionStep}: ${overviewPolicyActionValues
                    .map((value, index) =>
                      index % overviewPolicyActionColumnCount <
                      policyActionRevealColumns
                        ? value
                        : "MASK",
                    )
                    .join(", ")}`}
                  data-prediction-step={policyActionStep}
                >
                  {overviewPolicyActionValues.map((value, index) => {
                    const isPredicted =
                      index % overviewPolicyActionColumnCount <
                      policyActionRevealColumns;
                    return (
                      <span
                        className={`objective-action-value ${
                          isPredicted ? "is-predicted" : "is-mask"
                        }`}
                        key={`${index}-${isPredicted ? "predicted" : "mask"}`}
                      >
                        {isPredicted ? value : "MASK"}
                      </span>
                    );
                  })}
                </span>
              ) : null}
              {objective.key === "world" && port.key === "state" ? (
                <span
                  className="objective-output-value is-image"
                  role="img"
                  aria-label="Predicted world state"
                  aria-hidden={!isOutputSettled}
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
                  aria-label="Generated goal state"
                  aria-hidden={!isOutputSettled}
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
                  className={`objective-output-value is-instruction-text ${
                    isActive ? "is-visible" : ""
                  }`}
                  role="img"
                  aria-hidden={!isActive}
                  aria-label={`Task instruction prediction step ${taskInstructionStep}: ${overviewTaskInstructionWords
                    .map((word, index) =>
                      outputOrder.indexOf(index) < taskInstructionRevealCount
                        ? word
                        : "MASK",
                    )
                    .join(", ")}`}
                  data-prediction-step={taskInstructionStep}
                >
                  <span className="objective-instruction-flow">
                    {overviewTaskInstructionWords.map((word, index) => {
                      const isPredicted =
                        outputOrder.indexOf(index) <
                        taskInstructionRevealCount;
                      return (
                        <span
                          className={`objective-instruction-word ${
                            isPredicted ? "is-predicted" : "is-mask"
                          }`}
                          key={`${index}-${isPredicted ? "predicted" : "mask"}`}
                        >
                          {isPredicted ? word : "MASK"}
                          {index < overviewTaskInstructionWords.length - 1
                            ? " "
                            : null}
                        </span>
                      );
                    })}
                  </span>
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
            const isWorldActionGrid =
              objective.key === "world" &&
              item.key === "action" &&
              value.kind === "text";
            const hasDashedValueOutline =
              (objective.key === "policy" &&
                (item.key === "goal" || item.key === "sensor")) ||
              (objective.key === "world" &&
                (item.key === "instruction" || item.key === "action"));
            const dashedOutlineClass = hasDashedValueOutline
              ? " is-dashed-outline"
              : "";
            const valueClass =
              value.kind === "text"
                ? `is-${value.tone}${
                    isWorldActionGrid ? " is-action-grid" : ""
                  }${dashedOutlineClass}`
                : `is-image ${
                    value.kind === "sequence" ? "is-sequence" : ""
                  }${dashedOutlineClass}`;
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
  onSwitcherFocusChange,
}: {
  active: ObjectiveKey;
  objective: Objective;
  stage: number;
  playbackId: number;
  onSelect: (key: ObjectiveKey) => void;
  onSwitcherFocusChange: (focused: boolean) => void;
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
      <LegacyObjectiveSwitcher
        active={active}
        onSelect={onSelect}
        onFocusWithinChange={onSwitcherFocusChange}
      />
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

function PolicyCapabilityExample() {
  return (
    <div
      aria-label="Policy example from current state, instruction, and goal state to action sequence"
      className="capability-policy-example"
    >
      <div className="capability-policy-example__inputs">
        <figure className="capability-policy-example__image">
          <figcaption>State</figcaption>
          <img
            alt="Robot workspace before placing the glue stick in the drawer"
            decoding="async"
            loading="lazy"
            src={assetPath(policyCapabilityExample.input)}
          />
        </figure>
        <div className="capability-policy-example__instruction">
          <strong>Instruction</strong>
          <span>{policyCapabilityExample.instruction}</span>
        </div>
        <figure className="capability-policy-example__image">
          <figcaption>Goal state</figcaption>
          <img
            alt="Robot workspace with the glue stick inside the open drawer"
            decoding="async"
            loading="lazy"
            src={assetPath(policyCapabilityExample.goal)}
          />
        </figure>
      </div>
      <span className="capability-policy-example__arrow" aria-hidden="true">
        <i />
      </span>
      <div className="capability-policy-example__action">
        <strong>Action sequence</strong>
        <div aria-label="Six-dimensional action sequence">
          {policyCapabilityExample.action.map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorldCapabilityExample() {
  return (
    <div
      aria-label="World modeling example from current state, instruction, and action to next state"
      className="capability-world-example"
    >
      <figure className="capability-world-example__image">
        <figcaption>State</figcaption>
        <img
          alt="Robot holding a purple plush toy over a bowl"
          decoding="async"
          loading="lazy"
          src={assetPath(worldCapabilityExample.input)}
        />
      </figure>
      <div className="capability-world-example__instruction">
        <strong>Instruction</strong>
        <span>{worldCapabilityExample.instruction}</span>
      </div>
      <div className="capability-world-example__action">
        <strong>Action</strong>
        <div aria-label="Six-dimensional robot action">
          {worldCapabilityExample.action.map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
      </div>
      <span className="capability-world-example__arrow" aria-hidden="true">
        <i />
      </span>
      <figure className="capability-world-example__image capability-world-example__output">
        <figcaption>Next state</figcaption>
        <img
          alt="Next state after the purple plush toy is lifted from the bowl"
          decoding="async"
          loading="lazy"
          src={assetPath(worldCapabilityExample.generated)}
        />
      </figure>
    </div>
  );
}

function GoalStateCapabilityExample() {
  return (
    <div
      aria-label="Goal-state prediction example from initial state and instruction to goal state"
      className="capability-goal-example"
    >
      <div className="capability-goal-example__inputs">
        <figure className="capability-goal-example__image">
          <figcaption>Initial state</figcaption>
          <img
            alt="Folded white towel on the table before the task"
            decoding="async"
            loading="lazy"
            src={assetPath(goalCapabilityExample.input)}
          />
        </figure>
        <div className="capability-goal-example__instruction">
          <strong>Instruction</strong>
          <span>{goalCapabilityExample.instruction}</span>
        </div>
      </div>
      <span className="capability-goal-example__arrow" aria-hidden="true">
        <i />
      </span>
      <figure className="capability-goal-example__image capability-goal-example__output">
        <figcaption>Goal state</figcaption>
        <img
          alt="Goal state with the white towel unfolded on the table"
          decoding="async"
          loading="lazy"
          src={assetPath(goalCapabilityExample.generated)}
        />
      </figure>
    </div>
  );
}

function TaskUnderstandingCapabilityExample() {
  return (
    <div
      aria-label="Task understanding example from ordered video frames to a task description"
      className="capability-task-example"
    >
      <div className="capability-task-example__frames">
        <strong>Task video frames</strong>
        <div aria-label="Five ordered task video frames">
          {taskCapabilityExample.frames.map((frame, index) => (
            <img
              alt={`Task video frame ${index + 1} of the robot moving the sink faucet`}
              decoding="async"
              key={frame}
              loading="lazy"
              src={assetPath(frame)}
            />
          ))}
        </div>
      </div>
      <span className="capability-task-example__arrow" aria-hidden="true">
        <i />
      </span>
      <div className="capability-task-example__description">
        <strong>Task description</strong>
        <span>{taskCapabilityExample.description}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [overviewObjectiveKey, setOverviewObjectiveKey] =
    useState<ObjectiveKey>("policy");
  const [overviewStage, setOverviewStage] = useState(0);
  const [overviewPlaybackId, setOverviewPlaybackId] = useState(0);
  const [overviewSwitcherFocused, setOverviewSwitcherFocused] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const overviewTimerTokenRef = useRef(0);
  const overviewObjective = objectives[overviewObjectiveKey];

  const selectOverviewObjective = useCallback((key: ObjectiveKey) => {
    overviewTimerTokenRef.current += 1;
    setOverviewObjectiveKey(key);
    setOverviewStage(0);
    setOverviewPlaybackId((value) => value + 1);
  }, []);

  useEffect(() => {
    if (overviewSwitcherFocused) return;

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
  }, [
    overviewObjectiveKey,
    overviewPlaybackId,
    overviewStage,
    overviewSwitcherFocused,
  ]);

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
          <span className="header-paper is-disabled" aria-disabled="true">
            Paper ↗
          </span>
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
              <button className="is-paper" type="button" disabled>
                Paper
              </button>
              <button type="button" disabled>
                Model
              </button>
              <button type="button" disabled>
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
            <OriginalUnifiedOverview
              active={overviewObjectiveKey}
              objective={overviewObjective}
              stage={overviewStage}
              playbackId={overviewPlaybackId}
              onSelect={selectOverviewObjective}
              onSwitcherFocusChange={setOverviewSwitcherFocused}
            />

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
          </div>
        </section>

        <section className="section section--motivation">
          <div className="container">
            <SectionLead
              index="01"
              eyebrow="Overview"
              title="Why Unify Semantics, Dynamics, and Control?"
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
              title={
                <>
                  Four Capabilities for Robotics,
                  <br />
                  One Unified Model
                </>
              }
              body="Dynin-Robotics unifies policy generation, world modeling, task understanding, and goal-state prediction in a single masked-diffusion backbone. Each capability is realized as a different conditional denoising query over the same multimodal robot trajectory."
            />
            <div className="capability-summary-grid reveal">
              {capabilitySummaryCards.map((capability) => (
                <article
                  className="capability-summary-card"
                  key={capability.key}
                >
                  <h3>{capability.title}</h3>
                  <p>{capability.body}</p>
                  <dl className="capability-summary-card__io">
                    <div>
                      <dt>Input</dt>
                      <dd>
                        {capability.inputs.map((input) => (
                          <span
                            className={`is-${input.modality}`}
                            key={input.label}
                          >
                            {input.label}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt>Output</dt>
                      <dd>
                        <span className={`is-${capability.output.modality}`}>
                          {capability.output.label}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  {capability.key === "policy" && <PolicyCapabilityExample />}
                  {capability.key === "world" && <WorldCapabilityExample />}
                  {capability.key === "goal" && (
                    <GoalStateCapabilityExample />
                  )}
                  {capability.key === "instruction" && (
                    <TaskUnderstandingCapabilityExample />
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--model" id="model">
          <div className="container">
            <SectionLead
              index="03"
              eyebrow="Architecture"
              title={
                <>
                  One Backbone,
                  <br />
                  Multiple Parallel Token Pathways
                </>
              }
              body="A shared bidirectional Transformer reconstructs masked text, image/video, and action tokens through three parallel modality pathways."
            />
            <ArchitectureFigure />
          </div>
        </section>

        <section className="section section--training" id="training">
          <div className="container">
            <SectionLead
              index="04"
              eyebrow="Unified objective training"
              title="Omnimodal Unified Objective Training"
              body="A single Dynin-Robotics backbone learns policy, world modeling, goal-state prediction, and instruction understanding by changing which trajectory tokens are visible, optional, or masked for prediction."
            />
            <TrainingObjectiveGrid />
          </div>
        </section>

        <section className="section section--inference" id="inference">
          <div className="container">
            <SectionLead
              index="05"
              eyebrow="Unified inference"
              title="Composable Unified Inference"
              body="One post-trained model composes policy, goal-state, and world-model predictions into six inference strategies, ranging from direct action decoding to goal-guided joint denoising and dynamics-aware candidate reranking."
            />
            <InferenceExplorer />
          </div>
        </section>

        <section
          className="section section--demonstrations"
          id="demonstrations"
        >
          <div className="container">
            <SectionLead
              index="06"
              eyebrow="Demonstrations"
              title="Demonstrations"
              body="Demonstration rollouts across LIBERO, LIBERO+, and real-world manipulation tasks on the Franka Research 3 platform."
            />
            <DemonstrationResults />
          </div>
        </section>

        <section className="section section--examples" id="examples">
          <div className="container">
            <SectionLead
              index="07"
              eyebrow="Qualitative examples"
              title="Examples"
              body="Qualitative results show how Dynin-Robotics predicts visual futures, imagines instruction-conditioned goal states, and reconstructs task language from frame sequences."
            />
            <QualitativeResults />
          </div>
        </section>

        <section className="section section--performance" id="performance">
          <div className="container">
            <SectionLead
              index="08"
              eyebrow="Performance"
              title="Performance"
              body="The selected comparison rows below retain the paper’s model-family grouping. LIBERO is close to saturation, while LIBERO-Plus more clearly exposes robustness to camera, embodiment, language, lighting, background, noise, and layout shifts. The throughput results also summarize action-decoding gains from the modified dInfer framework."
            />
            <div className="benchmark-table-list">
              <BenchmarkTable
                title="LIBERO"
                columns={["Spatial", "Object", "Goal", "Long", "AVG ↑"]}
                rows={liberoRows}
                showFamilyDividers
              />
              <BenchmarkTable
                title="LIBERO-Plus"
                columns={[
                  "Camera",
                  "Robot",
                  "Language",
                  "Light",
                  "Background",
                  "Noise",
                  "Layout",
                  "AVG ↑",
                ]}
                rows={liberoPlusRows}
                showFamilyDividers
              />
            </div>

            <div className="performance-subsections">
              <section
                className="performance-subsection reveal"
                aria-labelledby="ablation-study-title"
                hidden
              >
                <header className="performance-subsection__header">
                  <h3 id="ablation-study-title">Ablation Study</h3>
                  <p>
                    We ablate both unified post-training objectives and
                    inference strategies on VLABench to examine how
                    complementary supervision and inference-time composition
                    affect robustness to out-of-distribution instructions. ID
                    and OOD results are shown together with the reported OOD
                    gap and effective throughput.
                  </p>
                </header>
                <div className="ablation-study-grid">
                  <article className="ablation-panel benchmark-table is-training-ablation">
                    <header className="ablation-panel__header">
                      <h4>Training Objective Ablation</h4>
                    </header>
                    <div
                      className="table-scroll ablation-table-scroll"
                      role="region"
                      aria-label="Training objective ablation results"
                      tabIndex={0}
                    >
                      <table className="ablation-data-table">
                        <caption className="sr-only">
                          Training objective ablation on VLABench
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Training variant</th>
                            <th scope="col">ID</th>
                            <th scope="col">OOD</th>
                            <th scope="col">Gap ↓</th>
                          </tr>
                        </thead>
                        <tbody>
                          {objectiveAblation.map((item) => (
                            <tr className="training-ablation-row" key={item.label}>
                              <th scope="row">{item.label}</th>
                              <td>{item.id}</td>
                              <td>{item.ood}</td>
                              <td>{item.gap}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="ablation-panel benchmark-table is-inference-ablation">
                    <header className="ablation-panel__header">
                      <h4>Inference Ablation Study</h4>
                    </header>
                    <div
                      className="table-scroll ablation-table-scroll"
                      role="region"
                      aria-label="Inference ablation results"
                      tabIndex={0}
                    >
                      <table className="ablation-data-table">
                        <caption className="sr-only">
                          Inference strategy ablation on VLABench
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Inference variant</th>
                            <th scope="col">ID</th>
                            <th scope="col">OOD</th>
                            <th scope="col">Gap ↓</th>
                            <th scope="col">Throughput ↑</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inferenceAblationResults.map((item) => (
                            <tr
                              className="inference-ablation-row"
                              key={item.variant}
                            >
                              <th scope="row">{item.variant}</th>
                              <td>{item.id}</td>
                              <td>{item.ood}</td>
                              <td>{item.gap}</td>
                              <td>{item.effectiveTps}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </div>
              </section>

              <section
                className="performance-subsection acceleration-bars-section reveal"
                aria-labelledby="acceleration-bars-title"
              >
                <header className="performance-subsection__header">
                  <h3 id="acceleration-bars-title">Acceleration</h3>
                  <p>
                    Dynin-Robotics uses a modified{" "}
                    <code className="acceleration-mono">dInfer</code> framework
                    with algorithmic optimizations (block-wise confidence-aware
                    parallel decoding and approximate KV-cache reuse) and
                    system-level optimizations (torch.compile, CUDA Graph
                    replay, and loop unrolling) for efficient action decoding.
                    Below, we compare action tokens per second (TPS).
                  </p>
                </header>

                <figure
                  className="acceleration-bars"
                  aria-labelledby="acceleration-bars-title"
                >
                  <div className="acceleration-bars__axis" aria-hidden="true">
                    <span>Model</span>
                    <div>
                      {accelerationBarTicks.map((tick) => (
                        <span
                          key={tick}
                          style={
                            {
                              "--acceleration-tick-position": `${
                                (tick / ACCELERATION_BAR_MAX_TPS) * 100
                              }%`,
                            } as CSSProperties
                          }
                        >
                          {tick}
                        </span>
                      ))}
                    </div>
                    <span>
                      TPS
                      <span className="acceleration-bars__sort-arrow">↑</span>
                    </span>
                  </div>

                  <div className="acceleration-bars__group is-baseline">
                    {accelerationBaselineGroups.map((group) => (
                      <div
                        aria-label={group.family}
                        className="acceleration-bars__family"
                        key={group.family}
                        role="group"
                      >
                        <h4>{group.family}</h4>
                        <div className="acceleration-bars__rows" role="list">
                          {group.rows.map((item) => (
                            <div
                              className="acceleration-bars__row"
                              key={item.model}
                              role="listitem"
                            >
                              <div className="acceleration-bars__label">
                                <strong>{item.model}</strong>
                              </div>
                              <div
                                className="acceleration-bars__track"
                                aria-hidden="true"
                              >
                                <i
                                  style={getAccelerationBarStyle(
                                    item.effectiveTps,
                                  )}
                                />
                              </div>
                              <div className="acceleration-bars__value">
                                <strong>{item.effectiveTps}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="acceleration-bars__group is-ours">
                    <div className="acceleration-bars__rows" role="list">
                      {accelerationResults.map((item) => (
                        <div
                          className="acceleration-bars__row"
                          key={item.variant}
                          role="listitem"
                        >
                          <div className="acceleration-bars__label">
                            <strong>
                              Dynin-Robotics (
                              <code className="acceleration-mono">
                                {item.variant}
                              </code>
                              )
                            </strong>
                          </div>
                          <div
                            className="acceleration-bars__track"
                            aria-hidden="true"
                          >
                            <i style={getAccelerationBarStyle(item.effectiveTps)} />
                          </div>
                          <div className="acceleration-bars__value">
                            <strong>{item.effectiveTps}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <figcaption className="sr-only">
                    Action tokens per second comparison. Baseline models are
                    listed first, followed by Dynin-Robotics models on a shared
                    linear scale.
                  </figcaption>
                </figure>
              </section>

              <section
                className="performance-subsection reveal"
                aria-labelledby="vlm-video-analysis-title"
                hidden
              >
                <header className="performance-subsection__header">
                  <h3 id="vlm-video-analysis-title">
                    VLM and Video Model Analysis
                  </h3>
                  <p>
                    Random-instruction diagnostics reveal complementary
                    language and visual-dynamics priors.
                  </p>
                </header>
                <p className="performance-subsection__body">
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
                <p className="performance-subsection__note">
                  This diagnostic explains complementary priors; it is not a
                  standalone ranking of overall policy quality.
                </p>
              </section>
            </div>
          </div>
        </section>

        <section className="contributors-section" id="contributors">
          <div className="container">
            <h2 className="reveal">Contributors</h2>
            {/* Add `hidden` to this wrapper to hide the contributor details again. */}
            <div>
              <ul className="contributors-section__list reveal">
                <li>
                  <a
                    className="contributors-section__link"
                    href="https://aidas.snu.ac.kr/people/?s=Hoeun+Lee#:~:text=Hoeun%20Lee"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <strong>
                      Hoeun Lee
                      <sup>§ ¶</sup>
                    </strong>
                    <span>Project Leader</span>
                  </a>
                </li>
                <li>
                  <a
                    className="contributors-section__link"
                    href="https://aidas.snu.ac.kr/people/?s=Jaeik+Kim#:~:text=Jaeik%20Kim"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <strong>
                      Jaeik Kim
                      <sup>¶</sup>
                    </strong>
                    <span>Core Contributor</span>
                  </a>
                </li>
                <li>
                  <a
                    className="contributors-section__link"
                    href="https://aidas.snu.ac.kr/people/?s=Jusang+Oh#:~:text=Jusang%20Oh"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <strong>
                      Jusang Oh
                      <sup>¶</sup>
                    </strong>
                    <span>Core Contributor</span>
                  </a>
                </li>
                <li>
                  <a
                    className="contributors-section__link"
                    href="https://aidas.snu.ac.kr/people/?s=Jinhyeok+Kim#:~:text=Jinhyeok%20Kim"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <strong>Jinhyeok Kim</strong>
                    <span>Acceleration</span>
                  </a>
                </li>
                <li>
                  <a
                    className="contributors-section__link"
                    href="https://aidas.snu.ac.kr/people/?s=Geon+Choi#:~:text=Geon%20Choi"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <strong>Geon Choi</strong>
                    <span>Evaluation</span>
                  </a>
                </li>
                <li>
                  <a
                    className="contributors-section__link"
                    href="https://aidas.snu.ac.kr/people/?s=Hyeonggeun+Kim#:~:text=Hyeonggeun%20Kim"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <strong>Hyeonggeun Kim</strong>
                    <span>Infrastructure</span>
                  </a>
                </li>
                <li>
                  <a
                    className="contributors-section__link"
                    href="https://aidas.snu.ac.kr/people/?s=Jaeyoung+Do#:~:text=Jaeyoung%20Do"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <strong>
                      Jaeyoung Do
                      <sup>†</sup>
                    </strong>
                    <span>Supervisor</span>
                  </a>
                </li>
              </ul>
              <div
                className="contributors-section__notes reveal"
                aria-label="Contributor role notes"
              >
                <p>
                  <sup>§</sup> Project lead
                </p>
                <p>
                  <sup>¶</sup> Core contributors
                </p>
                <p>
                  <sup>†</sup> Supervision and Corresponding author
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div>
            <a
              className="site-footer__lab-link"
              href="https://aidas.snu.ac.kr"
              target="_blank"
              rel="noreferrer"
            >
              <strong>AIDAS LAB</strong>
            </a>
            <p>Seoul National University</p>
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
