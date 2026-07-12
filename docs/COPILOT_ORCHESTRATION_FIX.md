# Fuuz Copilot — Orchestration Remediation (ship plan)

**Date:** 2026-07-03 · **Owner:** Scott · **Extension:** `apps/vsCodeFuuzExtension` v1.0.45
**Goal:** Make the local, multi-agent Fuuz Copilot orchestrate cleanly — architect
plans, sub-agents build real flows/screens/models, changes commit to Fuuz over
MCP — with zero cloud required, dynamic per-role model config, and full logging.

---

## 1. Diagnosis (evidence-based, from `.fuuz/copilot/trace.log`)

The trace of the "build an OEE data flow" runs shows five concrete failure modes.
These are the causes of "we burn tokens and nothing gets done."

| # | Symptom in the trace | Root cause |
|---|----------------------|-----------|
| 1 | Roles ran as `planner → coder → executor` with **no sprint labels**; no "Architect planned N sprints" line | `parseTaskGraph()` got unparseable architect output → silent fallback to a single muddled team pass. **This is "no instructions from the local architect."** |
| 2 | `fuuz_data_flow_mutation` failed 10+ times: `dataFlowTypeId is required`, `must have required property 'id'/'type'`, `/nodes/0 must have required property 'name'`, `/type must be equal to one of the allowed values` | The executor **guessed the flow envelope**. Nothing deterministically handed it the exact version-container shape at the point of use. **This is the real "nothing gets done."** |
| 3 | `[coder] output(0 tool calls): ⚠️ Blocker: I need fuuz_list_model_fields(...)`; `[reviewer] output(0 tool calls): (no text)` | Weak non-builder roles **narrate** tool calls instead of emitting them; a silent reviewer defaults to APPROVE → a run reports success with zero artifacts. |
| 4 | `PROVIDER ERROR: claude … HTTP 429 — 10,000 input tokens per minute` | Opus architect + 246-model context blew the org's cloud rate limit. Cloud in the hot path is fragile. |
| 5 | `[coder] run_command: find … / grep …` | The generic shell tool let roles **drift off-domain** — exactly what you want gone (Copilot is Fuuz-only). |

Architecture note: the orchestration design is sound (`orchestrator.ts` is a clean
Planner→Coder→Executor→Reviewer state machine; `taskGraph.ts` does structured
hand-offs; a read cache and force-progress guards exist). The failures are at the
**seams**: plan parsing, the mutation payload contract, weak-model behavior,
cloud coupling, and domain scope.

---

## 2. Fixes shipped in this change (all typecheck; 298/298 tests pass)

### A. The architect is now *guaranteed* to emit a parseable plan
- Added structured output (`response_format: json_schema`, `strict:true`) plumbed
  through `ChatRequest → messageMapping → chatSession`. LM Studio compiles the
  schema to a grammar, so the architect **cannot** emit non-JSON.
  Files: `providerTypes.ts`, `messageMapping.ts`, `chatSession.ts`.
- `copilotRun.ts`: the architect turn runs with `TASK_GRAPH_SCHEMA`; if a provider
  ignores it, a **one-shot retry** with a hard "JSON only" nudge runs before any
  fallback. The raw output + parse result are logged.

### B. The executor gets the exact mutation contract at the point of use
- `fuuzMcpTools.ts`: each mutation tool description now embeds a **minimal valid
  skeleton** taken verbatim from the bundled skill — e.g. the data-flow version
  container (`header.dataFlowTypeId`, `version.flow{id,type,nodes[{id,name,type}]}`,
  the `System|Document|Integration|Screen|Edge` enum). This directly answers every
  validation error in the trace, even if the model never loads the skill.

### C. Fuuz-only + a leaner, self-checking crew
- **Removed the `run_command` shell tool** (`builtinTools.ts`) — no more `find`/`grep`
  drift. Builds go only through the approval-gated `fuuz_*` MCP tools; `fs_read`/
  `fs_list` remain for reading referenced specs.
- The single-pass and fallback paths now run the **lean build crew** (Executor +
  Reviewer), matching the sprint path — no more planner/coder discovery hops that
  caused analysis-paralysis.
- **Deterministic build gate everywhere**: a build request that creates zero
  artifacts is marked FAILED regardless of a silent/absent reviewer verdict, so a
  quiet reviewer can never report false success.

### D. Fully-local by default (Claude optional) + full logging
- `roleBindings.defaultBindings`: ships a fully-local lean crew (Architect +
  Executor + Reviewer on LM Studio). If an Anthropic provider is present, Architect
  + Reviewer bind to it automatically for extra reasoning — **never required**.
  Planner/Coder are off by default.
- Logging (`copilotRun.ts`): now traces the **payload the model sent** for every
  mutation (not just the result), the architect's raw output + parse count, and
  full (not 300-char-clipped) mutation/error results. This is your diagnosis feed
  in `.fuuz/copilot/trace.log` and the "Fuuz" output channel.
- Scaffold docs/rules (`aiDevEnvTemplates.ts`) updated to the fully-local posture
  (dropped "route JSONata to Claude" as mandatory).

Dynamic per-role model config already exists (`fuuz.copilot.roles` + the Copilot
Settings panel, all five roles) — no change needed; the new defaults just seed it.

---

## 3. Recommended models (Apple Silicon 96GB+, mid-2026)

Set the exact loaded LM Studio id per role in **Copilot Settings**.

| Role | Model | Why |
|------|-------|-----|
| **Architect** | `glm-4.6` (MoE) | Strongest OSS **tool-calling** (~90% CC-Bench vs ~77% Qwen3-Coder) + reasoning; reliable JSON. thinking on. |
| **Executor** | `qwen3-coder-next` (80B MoE, ~3B active, ~46GB) | Top local **agentic build** model (70.6% SWE-bench); great JS/JSONata. thinking off. |
| **Reviewer** | `glm-4.6` | Steady verification judgment. thinking on. |
| Planner / Coder | *(off)* | Enable only for very large builds needing an extra plan/code-spec hop. |

Alternatives: **Devstral 2** (123B dense, 256K ctx, 72.2% SWE-bench) if you prefer
a dense builder and have the headroom; **GLM-5.2 Air** (106B-A12B, ~30 tok/s on a
64GB Mac) as a lighter Architect/Reviewer. Prefer MLX 4-bit; fall back to GGUF
(llama.cpp/Metal) if the MLX runtime won't load. Keep the Executor hot and
swap the Architect/Reviewer model; on 128GB you can hold both.

**Important — enable structured output & tool calling in LM Studio:** the architect
fix relies on `response_format: json_schema`, and building relies on tool calling.
Confirm the loaded models advertise both (GLM-4.6 and Qwen3-Coder-Next do). For
GGUF, LM Studio uses llama.cpp grammar sampling for the schema constraint.

---

## 4. Ship checklist (needs your machine — I can't reach LM Studio/MCP from here)

1. Load `glm-4.6` and `qwen3-coder-next` in LM Studio; start the server on
   `http://localhost:1234/v1`; enable CORS. Run `scripts/setup/verify-local-llm.sh`.
2. Build the extension: `npm run compile` in `apps/vsCodeFuuzExtension` (or repackage
   the `.vsix`) and reload the window.
3. Copilot Settings → **Reset roles to defaults** → confirm Architect/Reviewer=`glm-4.6`,
   Executor=`qwen3-coder-next`. Adjust ids to match your loaded models.
4. Tether the Copilot to a tenant, then run the exact failing prompt:
   *"build a flow that calculates OEE for my plant manager."*
5. Watch `.fuuz/copilot/trace.log`. Expected now: `architect task graph parsed: N
   sprint(s)` → per-sprint `→ fuuz_data_flow_mutation PAYLOAD: {…}` → `ok`, ending
   with `created N artifact(s)`. If a mutation still fails, the full payload + full
   error are in the log — diff them against the skeleton and fold any missing rule
   into the `fuuz-data-flow` skill.

---

## 5. Follow-ups (post-ship, not blocking)

- Feed persistent mutation-validation errors back into the `fuuz-*` skills so the
  skeletons stay authoritative (self-improving skills).
- Consider constraining **tool-call arguments** (not just the answer) to the MCP
  `inputSchema` where LM Studio supports it, to make bad payloads impossible.
- Optional autocomplete model for inline edits (small dense coder).
