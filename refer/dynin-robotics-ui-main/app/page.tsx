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

const objectiveOrder: ObjectiveKey[] = [
  "policy",
  "world",
  "goal",
  "instruction",
];

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
    short: "Default",
    title: "Default Policy",
    summary:
      "Directly denoise an action chunk from the current state and instruction.",
    goal: false,
    world: "off" as const,
    id: "45.8",
    ood: "41.4",
    gap: "4.4",
    tps: "9.238",
  },
  {
    key: "b",
    short: "Joint",
    title: "Action / World Model Joint Denoise",
    summary:
      "Decode actions and their next-state consequence together without a goal-state query.",
    goal: false,
    world: "joint" as const,
    id: "46.4",
    ood: "40.5",
    gap: "5.9",
    tps: "8.805",
  },
  {
    key: "c",
    short: "Goal guided",
    title: "Goal-State Guided Policy",
    summary:
      "Predict a goal-state context first, then expose it to the policy query.",
    goal: true,
    world: "off" as const,
    id: "45.6",
    ood: "38.2",
    gap: "7.1",
    tps: "9.208",
  },
  {
    key: "d",
    short: "Rerank",
    title: "Action Candidate Reranking",
    summary:
      "Generate policy candidates and use the world-model likelihood of their visual consequences as a conservative score.",
    goal: false,
    world: "rerank" as const,
    id: "46.3",
    ood: "42.0",
    gap: "4.3",
    tps: "4.904",
  },
  {
    key: "e",
    short: "Goal + joint",
    title: "Goal-State Guided + Joint Denoise",
    summary:
      "Use a predicted goal, then jointly decode the action and next visual state.",
    goal: true,
    world: "joint" as const,
    id: "49.6",
    ood: "47.2",
    gap: "2.4",
    tps: "8.709",
  },
  {
    key: "f",
    short: "Goal + rerank",
    title: "Goal-State Guided + Candidate Reranking",
    summary:
      "Use the predicted goal for policy generation, then score action candidates with the world-model query.",
    goal: true,
    world: "rerank" as const,
    id: "48.9",
    ood: "47.7",
    gap: "1.4",
    tps: "4.828",
  },
];

const qualitativeExamples = [
  {
    key: "world",
    label: "World Modeling",
    figure: "Figure 9 structure",
    title: "Action-conditioned visual prediction",
    copy:
      "Each row will align an observed state and action with the predicted and reference next states.",
    slots: [
      { label: "Observed state sₜ", kind: "frame" },
      { label: "Action aₜ", kind: "action" },
      { label: "Predicted sₜ₊₁", kind: "frame" },
      { label: "Reference sₜ₊₁", kind: "frame" },
    ],
  },
  {
    key: "goal",
    label: "Goal-State",
    figure: "Figure 10 structure",
    title: "Instruction-conditioned goal visualization",
    copy:
      "The final assets will compare the initial state and instruction with predicted and reference goal states.",
    slots: [
      { label: "Initial state s₀", kind: "frame" },
      { label: "Instruction ℓ", kind: "text" },
      { label: "Predicted goal s_T", kind: "frame" },
      { label: "Reference goal s_T", kind: "frame" },
    ],
  },
  {
    key: "task",
    label: "Task Understanding",
    figure: "Figure 11 structure",
    title: "Trajectory-to-language reconstruction",
    copy:
      "Sampled frames will remain ordered horizontally, followed by the predicted and reference instructions.",
    slots: [
      { label: "Trajectory t₀", kind: "frame" },
      { label: "Trajectory t₁", kind: "frame" },
      { label: "Trajectory t₂", kind: "frame" },
      { label: "Predicted instruction", kind: "text" },
      { label: "Reference instruction", kind: "text" },
    ],
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

function assetPath(path: string) {
  return `${assetBase}${path}`;
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
  index,
  eyebrow,
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
      <div className="section-lead__meta">
        <span>{index}</span>
        <p>{eyebrow}</p>
      </div>
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
      number: "(a)",
      title: "Vision-Language Model",
      note: "Language-conditioned policy",
      core: "Vision-Language Model",
      expert: "Latent condition → action expert",
      inputs: [
        { label: "States", modality: "vision" as const, symbol: "V", active: true },
        { label: "Instruction", modality: "text" as const, symbol: "T", active: true },
        { label: "Action", modality: "action" as const, symbol: "A", active: false },
      ],
      outputs: [
        { label: "Text", modality: "text" as const, symbol: "T", active: true },
        { label: "Future state", modality: "vision" as const, symbol: "V", active: false },
        { label: "Action", modality: "action" as const, symbol: "A", active: true },
      ],
    },
    {
      key: "video",
      number: "(b)",
      title: "Video Generation Model",
      note: "Video / world-model policy",
      core: "Video Generation Model",
      expert: "Latent condition → action expert",
      inputs: [
        { label: "States", modality: "vision" as const, symbol: "V", active: true },
        { label: "Instruction", modality: "text" as const, symbol: "T", active: true },
        { label: "Action", modality: "action" as const, symbol: "A", active: false },
      ],
      outputs: [
        { label: "Text", modality: "text" as const, symbol: "T", active: false },
        { label: "Next state", modality: "vision" as const, symbol: "V", active: true },
        { label: "Action", modality: "action" as const, symbol: "A", active: true },
      ],
    },
    {
      key: "unified",
      number: "(c)",
      title: "Unified Model",
      note: "Dynin-Robotics",
      core: "One shared masked-diffusion model",
      expert: "",
      inputs: [
        { label: "States", modality: "vision" as const, symbol: "V", active: true },
        { label: "Instruction", modality: "text" as const, symbol: "T", active: true },
        { label: "Action", modality: "action" as const, symbol: "A", active: true },
      ],
      outputs: [
        { label: "Text", modality: "text" as const, symbol: "T", active: true },
        { label: "Future state", modality: "vision" as const, symbol: "V", active: true },
        { label: "Action", modality: "action" as const, symbol: "A", active: true },
      ],
    },
  ];

  return (
    <figure className="paradigm-figure reveal" aria-label="Modeling paradigms">
      <div className="paradigm-grid">
        {paradigms.map((item) => (
          <article className={`paradigm-card is-${item.key}`} key={item.key}>
            <header>
              <span>{item.number}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.note}</p>
              </div>
            </header>
            <div className="paradigm-card__outputs">
              {item.outputs.map((output) => (
                <div
                  className={`modality-${output.modality} ${
                    output.active ? "is-active" : "is-inactive"
                  }`}
                  key={output.label}
                >
                  <small>{output.label}</small>
                  <TokenStrip
                    modality={output.modality}
                    symbol={output.symbol}
                    active={output.active}
                    count={2}
                  />
                </div>
              ))}
            </div>
            <div className="paradigm-card__core">
              <div className="paradigm-card__primary">
                <strong>{item.core}</strong>
                <span>
                  {item.key === "unified"
                    ? "shared parameters"
                    : "primary representation model"}
                </span>
              </div>
              {item.expert && (
                <>
                  <i className="paradigm-card__latent" aria-hidden="true">
                    latent
                  </i>
                  <div className="paradigm-card__expert">
                    <strong>Action expert</strong>
                    <span>{item.expert}</span>
                  </div>
                </>
              )}
            </div>
            <div className="paradigm-card__inputs">
              {item.inputs.map((input) => (
                <div
                  className={`modality-${input.modality} ${
                    input.active ? "is-active" : "is-inactive"
                  }`}
                  key={input.label}
                >
                  <TokenStrip
                    modality={input.modality}
                    symbol={input.symbol}
                    active={input.active}
                    count={2}
                  />
                  <small>{input.label}</small>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <figcaption>
        Figure 2, reconstructed in HTML/CSS. The comparison preserves the
        paper&apos;s distinction: VLM policies emphasize semantic grounding,
        video models emphasize future-state dynamics, and Dynin-Robotics exposes
        text, visual states, and actions as variables of one shared model.
      </figcaption>
    </figure>
  );
}

function ArchitectureFigure() {
  const lanes = [
    {
      name: "Text",
      modality: "text" as const,
      symbol: "T",
      input: "Task instruction",
      tokenizer: "Frozen text tokenizer",
      decoder: "Text detokenizer",
      decode: "Fully parallel decoding",
      masking: "Random token masking",
    },
    {
      name: "Image / Video",
      modality: "vision" as const,
      symbol: "V",
      input: "Observation · future · goal",
      tokenizer: "Frozen visual tokenizer",
      decoder: "Visual detokenizer",
      decode: "Fully parallel decoding",
      masking: "Random token masking",
    },
    {
      name: "Robot Action",
      modality: "action" as const,
      symbol: "A",
      input: "Continuous 7-DoF chunk",
      tokenizer: "Action tokenizer",
      decoder: "Action detokenizer",
      decode: "Block-wise parallel decoding",
      masking: "Contiguous block masking",
    },
  ];

  return (
    <figure className="architecture-figure reveal" aria-label="Dynin-Robotics architecture">
      <div className="architecture-level-label">
        <span>Decoded predictions</span>
        <b>OUTPUTS</b>
      </div>
      <div className="architecture-row architecture-row--outputs">
        {lanes.map((lane) => (
          <article className={`modality-${lane.modality}`} key={lane.name}>
            <span>{lane.name}</span>
            <TokenStrip modality={lane.modality} symbol={lane.symbol} count={7} />
            <b>{lane.decode}</b>
            <small>{lane.decoder}</small>
            <em>cross-entropy on masked positions</em>
          </article>
        ))}
      </div>
      <div className="architecture-flow is-output" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="architecture-core">
        <span>Bidirectional Transformer</span>
        <strong>Dynin-Robotics</strong>
        <p>
          shared token embeddings · shared masked-prediction head · random or
          block masking
        </p>
        <div aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="architecture-flow is-input" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="architecture-level-label architecture-level-label--sequence">
        <span>Masked multimodal token sequence</span>
        <b>MODEL INPUT</b>
      </div>
      <div className="architecture-mask-row">
        {lanes.map((lane) => (
          <article className={`modality-${lane.modality}`} key={lane.name}>
            <span>{lane.name} tokens</span>
            <TokenStrip
              modality={lane.modality}
              symbol={lane.symbol}
              count={7}
              maskIndices={
                lane.modality === "text"
                  ? [1, 4, 6]
                  : lane.modality === "vision"
                    ? [0, 3, 5]
                    : [3, 4, 5]
              }
            />
            <small>{lane.masking}</small>
          </article>
        ))}
      </div>
      <div className="architecture-flow is-input is-short" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="architecture-level-label">
        <span>Raw trajectory variables</span>
        <b>INPUTS</b>
      </div>
      <div className="architecture-row architecture-row--inputs">
        {lanes.map((lane) => (
          <article className={`modality-${lane.modality}`} key={lane.name}>
            <span>{lane.name}</span>
            <strong>{lane.input}</strong>
            <b>{lane.masking}</b>
            <small>{lane.tokenizer}</small>
          </article>
        ))}
      </div>
      <figcaption>
        Figure 3, reconstructed with the model in the center, raw inputs below,
        and decoded outputs above. Text, visual, and action pathways remain
        parallel; only action tokens use block-wise decoding to preserve local
        temporal structure.
      </figcaption>
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

function InferenceStage({
  index,
  label,
  active,
  kind,
  variant,
  detail,
  activeInputs,
}: {
  index: string;
  label: string;
  active: boolean;
  kind: "goal" | "policy" | "world";
  variant?: "policy" | "joint" | "candidate" | "rerank";
  detail: string;
  activeInputs: ConditionKey[];
}) {
  const isJoint = kind === "policy" && variant === "joint";
  const isCandidate = kind === "policy" && variant === "candidate";
  const outputLabel =
    kind === "goal"
      ? "Goal state"
      : kind === "policy"
        ? isJoint
          ? "Actions + next state"
          : isCandidate
            ? "Action candidates"
            : "Action chunk"
        : "Predicted consequence / score";
  const activeOutputs: Array<Exclude<Modality, "sensor">> =
    kind === "goal"
      ? ["vision"]
      : kind === "policy"
        ? isJoint
          ? ["vision", "action"]
          : ["action"]
        : ["vision"];

  return (
    <article
      className={`inference-module is-${kind} ${
        active ? "is-active" : "is-inactive"
      } is-${variant ?? kind}`}
      aria-label={`${label}: ${active ? "active" : "inactive"}`}
    >
      <header>
        <span>Stage {index}</span>
        <b>{active ? "ACTIVE" : "NOT USED"}</b>
      </header>
      <div className="inference-module__output">
        <small>{outputLabel}</small>
        <div className="inference-module__output-rail">
          {outputLanes.map((lane) => {
            const laneActive =
              active && activeOutputs.includes(lane.modality);
            return (
              <div
                className={laneActive ? "is-active" : "is-inactive"}
                key={lane.modality}
              >
                <TokenStrip
                  modality={lane.modality}
                  symbol={lane.symbol}
                  active={laneActive}
                  count={2}
                />
                <span>{lane.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="inference-module__core">
        <strong>{label}</strong>
        <span>same Dynin-Robotics backbone</span>
      </div>
      <div className="inference-module__inputs">
        {conditionSlots.map((slot) => {
          const slotActive = active && activeInputs.includes(slot.key);
          return (
            <div
              className={slotActive ? "is-active" : "is-inactive"}
              key={slot.key}
            >
              <TokenStrip
                modality={slot.modality}
                symbol={slot.symbol}
                active={slotActive}
                count={1}
              />
              <small>{slot.label}</small>
            </div>
          );
        })}
      </div>
      <p>{detail}</p>
    </article>
  );
}

function InferenceExplorer() {
  const [activeMode, setActiveMode] = useState(0);
  const mode = inferenceModes[activeMode];
  const worldActive = mode.world === "rerank";
  const worldDetail =
    mode.world === "rerank"
        ? "Score policy candidates by predicted visual consequence."
        : mode.world === "joint"
          ? "Joint decoding occurs in Stage 2; no separate reranker query is used."
          : "No world-model query in this mode.";

  return (
    <div className="inference-explorer reveal">
      <div
        className="inference-tabs"
        role="tablist"
        aria-label="Inference mode"
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
        {inferenceModes.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === index}
            aria-controls={`inference-panel-${item.key}`}
            id={`inference-tab-${item.key}`}
            tabIndex={activeMode === index ? 0 : -1}
            className={activeMode === index ? "is-active" : ""}
            onClick={() => setActiveMode(index)}
            key={item.key}
          >
            <span>({item.key})</span>
            {item.short}
          </button>
        ))}
      </div>

      <section
        className="inference-panel"
        role="tabpanel"
        id={`inference-panel-${mode.key}`}
        aria-labelledby={`inference-tab-${mode.key}`}
        tabIndex={0}
        key={mode.key}
      >
        <div className="inference-panel__intro">
          <div>
            <span>Mode ({mode.key}) · Figure 5</span>
            <h3>{mode.title}</h3>
          </div>
          <p>{mode.summary}</p>
        </div>

        <div className="inference-chain-scroll">
          <div
            className={`inference-chain world-${mode.world} ${
              mode.goal ? "goal-active" : "goal-inactive"
            }`}
          >
            <InferenceStage
              index="1"
              label="Goal-State Query"
              active={mode.goal}
              kind="goal"
              activeInputs={["state", "instruction"]}
              detail={
                mode.goal
                  ? "Predict a successful terminal state from the initial state and instruction."
                  : "No goal-state prediction in this mode."
              }
            />
            <div
              className={`inference-connector ${
                mode.goal ? "is-active" : "is-inactive"
              }`}
              aria-hidden="true"
            >
              <span>{mode.goal ? "goal context" : "bypass"}</span>
              <i />
            </div>
            <InferenceStage
              index="2"
              label="Policy Query"
              active
              kind="policy"
              variant={
                mode.world === "joint"
                  ? "joint"
                  : mode.world === "rerank"
                    ? "candidate"
                    : "policy"
              }
              activeInputs={
                mode.goal
                  ? ["state", "instruction", "goal"]
                  : ["state", "instruction"]
              }
              detail={
                mode.world === "joint"
                  ? "Jointly denoise action and next-state targets in this query."
                  : mode.world === "rerank"
                  ? "Generate a local set of action candidates."
                  : "Denoise the masked action chunk."
              }
            />
            <div
              className={`inference-connector ${
                worldActive ? "is-active" : "is-inactive"
              }`}
              aria-hidden="true"
            >
              <span>
                {mode.world === "rerank"
                    ? "action candidates A*"
                    : mode.world === "joint"
                      ? "joint at stage 2"
                      : "bypass"}
              </span>
              <i />
            </div>
            <InferenceStage
              index="3"
              label="World-Model Query"
              active={worldActive}
              kind="world"
              variant="rerank"
              activeInputs={["state", "instruction", "action"]}
              detail={worldDetail}
            />
          </div>
        </div>

        <div className="inference-metrics" aria-label="VLABench inference metrics">
          <div>
            <span>ID success</span>
            <strong>{mode.id}</strong>
          </div>
          <div>
            <span>OOD success</span>
            <strong>{mode.ood}</strong>
          </div>
          <div>
            <span>OOD gap ↓</span>
            <strong>{mode.gap}</strong>
          </div>
          <div>
            <span>Effective TPS ↑</span>
            <strong>{mode.tps}</strong>
          </div>
        </div>
      </section>
      <p className="figure-note">
        Figure 5 and Table 12, reconstructed as one fixed three-stage chain.
        Every mode keeps goal, policy, and world-model positions aligned; inactive
        queries remain visible in gray. Reranking evaluates candidates produced
        by the policy—it is not a separate action generator.
      </p>
    </div>
  );
}

function QualitativeGallery() {
  const [activeExample, setActiveExample] = useState(0);
  const example = qualitativeExamples[activeExample];

  return (
    <div className="qualitative-gallery reveal">
      <div
        className="qualitative-tabs"
        role="tablist"
        aria-label="Qualitative result"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
          }
          event.preventDefault();
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? qualitativeExamples.length - 1
                : (activeExample +
                    (event.key === "ArrowLeft" ? -1 : 1) +
                    qualitativeExamples.length) %
                  qualitativeExamples.length;
          setActiveExample(next);
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>('[role="tab"]')
            [next]?.focus();
        }}
      >
        {qualitativeExamples.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeExample === index}
            aria-controls={`qualitative-panel-${item.key}`}
            id={`qualitative-tab-${item.key}`}
            tabIndex={activeExample === index ? 0 : -1}
            className={activeExample === index ? "is-active" : ""}
            onClick={() => setActiveExample(index)}
            key={item.key}
          >
            {item.label}
          </button>
        ))}
      </div>

      <article
        className="qualitative-panel"
        role="tabpanel"
        id={`qualitative-panel-${example.key}`}
        aria-labelledby={`qualitative-tab-${example.key}`}
        tabIndex={0}
        key={example.key}
      >
        <div className="qualitative-panel__copy">
          <span>{example.figure}</span>
          <h3>{example.title}</h3>
          <p>{example.copy}</p>
          <small>
            Media intentionally omitted in this draft. Each outlined slot is an
            independent future image or video asset.
          </small>
        </div>
        <div className={`qualitative-slots is-${example.key}`}>
          {example.slots.map((slot, index) => (
            <div className={`media-slot is-${slot.kind}`} key={slot.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div aria-hidden="true">
                {slot.kind === "action" ? (
                  <TokenStrip modality="action" symbol="A" count={5} />
                ) : slot.kind === "text" ? (
                  <>
                    <i />
                    <i />
                    <i />
                  </>
                ) : (
                  <>
                    <b />
                    <i />
                  </>
                )}
              </div>
              <strong>{slot.label}</strong>
              <small>asset placeholder</small>
            </div>
          ))}
        </div>
      </article>
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
    <article className="real-world-placeholders reveal">
      <div className="real-world-placeholders__intro">
        <span>Figure 8 structure · Franka Research 3</span>
        <h3>Real-world task sequences</h3>
        <p>
          Each task row reserves a consistent sequence of video keyframes. Final
          media can be inserted without changing the surrounding layout.
        </p>
      </div>
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
    </article>
  );
}

function ThemeToggle() {
  useEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
    const syncWithSystem = (event: MediaQueryListEvent) => {
      const saved = window.localStorage.getItem("dynin-color-theme");
      if (saved === "light" || saved === "dark") return;
      const theme = event.matches ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };

    systemTheme.addEventListener("change", syncWithSystem);
    return () => systemTheme.removeEventListener("change", syncWithSystem);
  }, []);

  const toggleTheme = () => {
    const current =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem("dynin-color-theme", next);
  };

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle light and dark color theme"
    >
      <i className="theme-toggle__icon" aria-hidden="true" />
      <span className="theme-toggle__to-light">Light mode</span>
      <span className="theme-toggle__to-dark">Dark mode</span>
      <small>Theme</small>
    </button>
  );
}

export default function Home() {
  const [activeObjective, setActiveObjective] =
    useState<ObjectiveKey>("policy");
  const [stage, setStage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objective = objectives[activeObjective];

  const selectObjective = useCallback((key: ObjectiveKey) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveObjective(key);
    setStage(0);
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

  return (
    <div className="research-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="site-brand" href="#top" aria-label="Dynin-Robotics home">
          <span>DY</span>
          <strong>Dynin-Robotics</strong>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#overview">Overview</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#model">Model</a>
          <a href="#examples">Examples</a>
          <a href="#performance">Performance</a>
        </nav>
        <div className="header-links">
          <a href={assetPath("/paper.pdf")}>Paper ↗</a>
          <span title="Public repository link pending">Code · soon</span>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top">
          <div className="hero__copy reveal is-visible">
            <p className="eyebrow">Research project · AIDAS Lab, Seoul National University</p>
            <h1>Dynin-Robotics</h1>
            <h2>
              Omnimodal Unified Diffusion
              <br />
              Vision-Language-Action Model
            </h2>
            <p className="hero__summary">
              Generalist robot policies must connect task language, visual
              observations, future consequences, and executable actions.
              Dynin-Robotics represents these variables as a partially observed
              multimodal trajectory and learns their conditional relationships
              with one masked-diffusion backbone.
            </p>
            <p className="hero__thesis">
              One shared trajectory, four observed–masked views: policy, world
              modeling, goal-state prediction, and task understanding.
            </p>
            <div className="hero__authors">
              <span>Hoeun Lee</span>
              <span>Jaeyoung Do</span>
              <span>2026</span>
            </div>
            <div className="hero__links">
              <a href={assetPath("/paper.pdf")}>Read the paper ↗</a>
              <a href="#overview">Method overview ↓</a>
            </div>
          </div>

          <div className="hero__figure reveal is-visible">
            <div className="figure-heading">
              <div>
                <span>Figure 1 · conditional query view</span>
                <strong>{objective.title}</strong>
              </div>
              <small>
                pass {stage + 1}/5 · target {objective.targetLabel}
              </small>
            </div>
            <div
              className="figure-scroll"
              role="tabpanel"
              id={`hero-objective-${activeObjective}`}
              aria-labelledby={`hero-objective-tab-${activeObjective}`}
              tabIndex={0}
            >
              <UnifiedQueryFigure objective={objective} stage={stage} compact />
            </div>
            <ObjectiveTabs
              active={activeObjective}
              onSelect={selectObjective}
              controlsPrefix="hero-objective"
            />
          </div>
        </section>

        <section className="section section--overview" id="overview">
          <div className="container">
            <SectionLead
              index="01"
              eyebrow="Overview"
              title="Why unify semantics, dynamics, and control?"
              body="Language-oriented policies and video/world-model policies bring complementary priors. The former are strong at grounding instructions; the latter explicitly model how the scene changes. Dynin-Robotics treats language, visual states, goals, and actions as variables of one conditional denoising problem."
            />
            <div className="academic-note reveal">
              <strong>Formulation.</strong>
              <p>
                Given an objective token, the model keeps the corresponding
                conditions visible and masks one target segment. A capability is
                therefore selected by changing the observed and masked variables,
                rather than routing the input to a separately trained expert.
              </p>
            </div>
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
              title="One backbone, three parallel token pathways"
              body="Dynin-Robotics preserves the text and visual interface of Dynin-Omni and extends the discrete sequence with robot-action tokens. Frozen text and visual tokenizers and the action tokenizer connect the raw trajectory to one bidirectional Transformer."
            />
            <ArchitectureFigure />
            <div className="method-details reveal">
              <article>
                <span>Discrete interface</span>
                <h3>Text, vision, and action share one sequence.</h3>
                <p>
                  Each modality retains its own tokenizer and detokenizer, but
                  their discrete tokens are interleaved and processed by the same
                  model parameters.
                </p>
              </article>
              <article>
                <span>Decoding order</span>
                <h3>Visual and text targets are fully parallel.</h3>
                <p>
                  Action targets are refined block-wise to preserve local temporal
                  structure, while every pass remains bidirectional within the
                  visible multimodal context.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--training" id="training">
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
                    stage={stage}
                    caption="Figure 4 training-objective mapping. Optional conditions use dashed borders; inactive variables remain visible only to preserve a stable comparison grid."
                  />
                </div>
                <div className="training-progress">
                  <span>Iterative denoising</span>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={4}
                    aria-valuenow={stage}
                    aria-label={`${objective.title} denoising progress`}
                  >
                    <i style={{ width: `${(stage / 4) * 100}%` }} />
                  </div>
                  <b>{stage === 4 ? "complete" : `pass ${stage + 1}`}</b>
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
              title="A media-ready structure for per-example evidence"
              body="Paper crops have been removed from this draft. The HTML/CSS layout below reserves independent, consistently labeled slots for the final images and videos, so future assets can be added without redrawing the page."
            />
            <QualitativeGallery />
            <RealWorldPlaceholders />
          </div>
        </section>

        <section className="section section--performance" id="performance">
          <div className="container">
            <SectionLead
              index="07"
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

        <section className="paper-section">
          <div className="container">
            <div className="paper-section__copy reveal">
              <p className="eyebrow">Paper and resources</p>
              <h2>Dynin-Robotics</h2>
              <p>
                Omnimodal Unified Diffusion Vision-Language-Action Model
              </p>
            </div>
            <div className="paper-section__links reveal">
              <a href={assetPath("/paper.pdf")}>
                <span>Paper</span>
                <strong>PDF ↗</strong>
              </a>
              <div>
                <span>Code</span>
                <strong>release pending</strong>
              </div>
              <div>
                <span>Model</span>
                <strong>release pending</strong>
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
            <span>Hoeun Lee · Jaeyoung Do</span>
            <span>© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
