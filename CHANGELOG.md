# Changelog

All notable changes to **Fuuz for VS Code**.

## 1.1.0

> 🧪 **Open Beta** — this repository and extension are in open beta; features and
> APIs may change and you may hit rough edges. Feedback and bug reports welcome.

### Removed — the in-extension Fuuz Copilot
The built-in multi-agent Copilot has been removed. Agent-driven building now
happens through your own AI coding assistant (e.g. the Claude VS Code extension)
pointed at the **Fuuz MCP server** the extension registers — that path is kept and
is the intended interface going forward.

Removed: the Copilot chat panel and settings panel, the `fuuzCopilot` view, all
`fuuz.copilot.*` commands/settings, provider credentials + OAuth sign-in, the
multi-agent orchestrator, the `Create New Tool` command, and the local-AI
dev-environment setup (`fuuz.setupAiDevEnv` / `fuuz.checkLocalAi`,
`fuuz.localAi.*`).

Kept: tenant connections, the Resources tree, ERD, schema/flow/screen **compliance
checks**, QA/UAT, deploy, GitHub mirroring, the bundled **skills** (`resources/skills/`),
and **Fuuz MCP server registration** for your AI assistant.

### Fixed — multi-tenant resource loading
The Resources tree could show a tenant as **connected but empty** and never
recover. A transient MCP hiccup during a sync (e.g. an idle SSE stream drop) was
cached as an empty snapshot in `globalState`, which the tree then served
indefinitely — worst when switching between tenants to build across several.

- A failed or empty MCP snapshot no longer evicts a previously-good cache.
- An empty cached snapshot is treated as stale and re-synced (self-heal), with a
  short grace window so genuinely MCP-less tenants aren't re-fetched every render.
- Switching the active tenant now eagerly (re)loads its resources in the
  background, not just on startup — so a switched-to tenant shows live data.
- **Empty `tools/list` no longer blanks the tree.** Some tenants return an empty or
  filtered tool catalog while the platform `system_*` tools stay fully callable
  (seen on sibling "site" tenants). Resource discovery no longer gates its
  `system_query_model` / `system_list_models` calls on tool-catalog membership, so
  those tenants load their resources instead of showing "connected but empty".

### Added
- **Restart Fuuz MCP** command (and Connections view button): drops pooled MCP
  sessions, re-resolves the registered servers for VS Code's Copilot, and re-syncs
  the active tenant — recovering a wedged/stale connection without reloading the
  window. (Claude still needs its own restart to reload MCP servers.)

## 1.0.72

### Changed — point the Builder at the right node-reference files
The Builder kept guessing non-existent skill references (e.g. `query.md`) and so
never loaded a node's exact `data` schema, producing malformed nodes ("must have
required property 'nextNodes'/'api'", "must NOT have additional properties"). The
flow guidance now maps node types to their real **category** reference files
(Query/Mutate → `fuuz.md`, Request/Response → `events.md`, HTTP/SQL →
`integration.md`, array ops → `transformation.md`, etc.) and notes there is no
per-node file. A data-model read is the **Query** node (fuuz.md); returning to the
caller is the **Response** node (events.md).

## 1.0.71

### Added — ToS-clean Claude OAuth via the `ant` CLI broker
A sanctioned OAuth sign-in that does **not** impersonate a first-party client:
set a Claude provider's `auth` to `"ant"` and the extension fetches a short-lived
OAuth token from Anthropic's official CLI (`ant auth print-credentials
--access-token`) per run, sent as `Bearer` + `anthropic-beta: oauth-2025-04-20`.
The CLI owns the handshake and token refresh — nothing is stored by the extension.

Setup: `brew install anthropics/tap/ant` → `ant auth login` → set the provider's
`auth: "ant"`.

> **Billing note:** this authenticates to your **API org and bills API credits** —
> the same pool as an API key. It is a sign-in convenience, **not** a way to use a
> Claude Pro/Max subscription (that is first-party-only and cannot be reached from
> a third-party extension without violating Anthropic's ToS).

## 1.0.70

### Fixed — flow-generation correctness (JSONata, response node, real fields)
Three classes of agent mistakes the reviewer was letting through:
- **JSONata operator lint (enforced).** Transforms in a data-flow mutation are now
  scanned for JavaScript-style operators before the mutation is sent — `=>`/`=<`
  (should be `>=`/`<=`), `&&`/`||` (should be `and`/`or`), `==` (should be `=`) —
  and the build is blocked with the exact fix. Only `*Transform` (JSONata) fields
  are checked, so Script-node JavaScript is left alone.
- **Response node guidance.** The Builder is told a callable/Integration flow must
  end with a real node of **type `response`** (with `responseTransform`), not a
  `transform` node mislabeled "response".
- **Real-field validation.** Builder and Reviewer guidance now require every model
  field/query name to be verified against `fuuz_list_model_fields` — no invented
  names (e.g. `equipmentUnitNode` vs the real `equipmentUnit`). The Reviewer must
  confirm queried fields exist before approving.
- The `fuuz-expressions` skill gained a prominent JSONata-vs-JavaScript operator
  cheat sheet.

## 1.0.69

### Added — Claude OAuth token refresh (subscription sign-in durability)
Groundwork for using a Claude subscription (Pro/Max) sign-in instead of a
pay-per-use API key:
- OAuth access tokens are now **refreshed automatically** before a request when
  they're near expiry (via the stored refresh_token + the provider's
  `oauth.tokenEndpoint`), so a subscription session no longer dies after ~1 hour.
- (The Bearer + `anthropic-beta: oauth-2025-04-20` headers and the PKCE sign-in
  flow were already in place; this closes the session-durability gap.)

## 1.0.68

### Fixed — models could create an EMPTY data flow
The flow guard allowed a header-only payload (treating it as an "update"), so a
CREATE that sent only a header — which models did after fighting the earlier
`where`/`content` errors — saved a data flow with **no nodes** (nothing runs or
renders).
- The guard now **requires a flow body with a non-empty `nodes` array on a
  create** (any mutation without a `where.id` targeting an existing flow). Only an
  id-targeted metadata update (rename / toggle active) may omit the flow body.
- Reverted the swarm to the local crew (Architect/Reviewer → glm-4.7-flash,
  Executor → qwen3-coder-next) since Claude credits were exhausted.

## 1.0.67

### Fixed — QA falsely flagged embedded value fields as missing a foreign key
Fields typed `Measure` / `RatioMeasure` / `Address` (e.g. a Handling Unit's
`height`, `width`, `length`) are Fuuz **embedded value types** — composite scalars
(value + unit / parts), not relations. The schema audit was treating any non-scalar
type as a relation, so it demanded a `heightId` FK that must never exist.
- Added `Measure`, `RatioMeasure`, `Address` to the scalar-type set (`Duration`
  was already there), so `isRelationType` no longer classifies them as relations.
  They now correctly appear as fields — no phantom FK-pairing finding, no ERD edge.
  Only fields ending in `Id` (paired with a navigation field) are relations.
- Documented the distinction in the `fuuz-data-model` skill.

## 1.0.66

### Fixed — true connection state + restored system tools
- **Connections page no longer false-positives.** It showed a live connection
  whenever a key was *stored*, without ever checking. It now **actively probes
  every tenant's MCP endpoint on open** and shows the real per-endpoint result.
- **Resources panel shows live connection state.** The header now leads with a
  status dot — 🟢 Connected / 🟡 Auth error / 🔴 Disconnected / ⚪ Not checked —
  before the "last synced" time. The active tenant is probed on startup and on
  tenant switch, and the indicator updates the moment health changes (e.g. a
  runtime call fails).
- **Restored the System tools in the Resources tree.** A previous cleanup hid the
  platform `system_*` tools; the "MCP Tools" node again lists both **Custom (Data
  Flows)** and **System** so you can see the full catalog the tenant exposes.

## 1.0.65

### Fixed — data-flow mutation kept failing on a "content" wrapper
The trace showed the Builder calling `fuuz_data_flow_mutation` ~10 times, always
getting `Either "where.id" or "where.name" (or "header.name") must be provided` —
because it wrapped the payload in a `{"content": …}` object (and invented
`version_id`/`module_id`), so the server never saw the top-level `header`/`where`.
- **`unwrapFlowContainer` preprocess** lifts the real container out of any
  `content`/`payload`/`data`/`definition` wrapper (and drops invented
  `version_id`/`module_id` siblings) before the mutation is sent — the model's
  wrapper mistake now self-corrects.
- The tool instructions now state explicitly: the argument IS the version
  container; the only top-level keys are `header`/`version` (+ `where` for
  updates); never wrap it.

## 1.0.64

### Fixed — tolerate mangled tool names from open-weight models
Local models emitted malformed tool names (`fuuzlist_model_fields` with a dropped
underscore) and leaked chat-template tokens (`fuuz_..._fields<|observation|>`),
which dead-ended as "unknown tool" and sent the role into a 90+-call loop.
- **Fuzzy tool-name resolution**: a near-miss name (dropped punctuation, wrong
  case, or a trailing `<|…|>` control token) now routes to the real tool instead
  of erroring. This is harness-side forgiveness — the extension brokers every
  tool call for both local and cloud models, so a small spelling slip no longer
  breaks the run.

(For the record: LM Studio models have the same Fuuz tool access Claude does —
the extension is the MCP client for both; the model only emits the call.)

## 1.0.63

### Fixed — flow builds failed on the diagram
The agents kept sending a hand-built `diagram` with the flow, which fails: the
platform's own tool says to OMIT it and auto-generate (manual diagrams have wrong
ports/layout and break the designer). We were even *auto-building* one ourselves
(`ensureFlowDiagram`) on an outdated assumption. Fixed by enforcement, not
instruction:
- **The diagram is now stripped in code** (`stripFlowDiagram`) before every
  data-flow mutation — whatever the model builds, the field is removed so the
  platform auto-generates it. Models that ignore the "omit the diagram" guidance
  can no longer break the build.
- The Copilot no longer constructs the diagram itself.

## 1.0.62

### Changed — instructions shaped for open-weight models
Open-weight models get lost mid-run (they lose the goal as tool output piles up).
Reshaped the prompting to help them:
- **Objective goes LAST in the prompt.** Background (history, prior work) is moved
  up front and the actionable brief is the last thing the model reads before it
  acts — open models weight the prompt's end most.
- **Goal re-anchored inside the tool loop.** Every tool result the Builder sees is
  now tagged with a one-line "build the artifact now" reminder until it actually
  builds, so it stops drifting into endless discovery.
- **Lean 3-role crew by default** (Architect → Executor → Reviewer; Planner/Coder
  off) — fewer hand-offs, less context to lose.
- Local default model is now **GLM-4.7** (`zai-org/glm-4.7-flash`) across the crew.

## 1.0.61

### Fixed — cut Claude input tokens per request (was blowing rate limits)
Requests were exceeding ~10k input tokens and tripping normal Claude limits.
Trimmed the biggest contributors:
- **Compact tool schemas.** The real Fuuz MCP inputSchemas (the data-flow mutation
  schema alone is ~2KB of prose) are now stripped of descriptions/examples/defaults
  and have big enums truncated before they enter a tool definition — structure kept,
  tokens cut sharply.
- **Leaner tenant context.** Inventory list caps reduced (models 120→50, flows/
  screens 80→25, scripts/queries 60→15, modules 60→40) and the redundant `system_*`
  platform-tool list dropped (reached via the `fuuz_*` wrappers anyway).
- **Smaller hand-offs.** Conversation history trimmed (3 turns / 2.5k chars) and
  prior-role notes capped to a ~4k-char budget carried between agents.
- **Tool results capped** at 6k chars (they're re-sent each loop step, so large
  reads compounded input tokens fast).
- Combined with the 429 backoff from 1.0.60, runs should stay under normal limits.

## 1.0.60

### Changed — the Copilot swarm now runs on Claude by default
Local models proved unreliable for agentic Fuuz builds (weak tool-calling,
no-JSON plans, context-length overflows). The swarm now runs on Claude:
- **Default bindings are a Claude swarm** whenever a Claude provider is present —
  a lean Architect → Executor → Reviewer crew on the auto-picked model. Enter your
  Claude API key and the team configures itself; no per-role setup required.
- **Model auto-pick** (`pickClaudeModel`) chooses the best available model,
  preferring `claude-sonnet-5` (strong tool-calling, high rate limits) over Opus
  (which kept hitting 429s as the Architect).
- **Rate-limit resilience**: provider requests now retry 429/503/529 with
  exponential backoff (1→2→4→8s), so a single rate-limit blip no longer kills a run.
- Local models remain the fallback only when no Claude provider is configured.

## 1.0.45

### Changed — smaller requests: only the Builder carries the mutation schemas
To help the request fit local context windows: non-builder roles (Architect,
Planner, Coder, Reviewer) no longer receive the large Fuuz MCP mutation/deploy
tool schemas — they get only the auto-approved read/utility tools they actually
need. Only the Executor (which builds) carries the full mutation schemas. This
substantially shrinks 4 of the 5 role requests.

> The Executor still needs the full schemas to build, so its request is larger —
> load that model with a 32k context window in LM Studio.

## 1.0.44

### Fixed — silent "(no text)" was a swallowed context-length error
Root cause of roles doing nothing: LM Studio returns **HTTP 200 with an SSE
`error` payload** ("the number of tokens … is greater than the context length")
when the request overflows the model's loaded context window — and our streaming
reader ignored that payload, yielding an empty response that looked like the model
"did nothing".
- The OpenAI-compatible streaming client now **detects the SSE `error` payload and
  raises a real error**, which surfaces in the panel and the trace (with the
  `[kind @ url]` prefix) instead of a silent empty turn.
- Provider errors are also written to `.fuuz/copilot/trace.log` now.

> **Note:** the underlying cause is the local model being loaded with too small a
> context window. Load your LM Studio models with a larger context (e.g. 16k–32k)
> so the system prompt + tool schemas fit.

## 1.0.43

### Added — role text output in the trace + run delimiters
- The trace (`.fuuz/copilot/trace.log`) now logs **each role's final text output**
  (plan/JSON/summary), not just tool calls — so a role that "did nothing" (e.g.
  reasoned but never emitted an answer) is finally visible.
- Each run starts with a `===== RUN "…" =====` delimiter so builds are findable
  in the cumulative trace without clearing it.

## 1.0.42

### Changed — planners keep MCP access; just don't re-fetch the lists
Refines 1.0.41: the Architect/Planner plan-only lock was too strict. They **can
and should** make Fuuz MCP calls when they need more than the tree provides.
- Restored the full toolset for all roles. The rule is now narrower: don't
  re-fetch the **lists** already in the resource inventory (`fuuz_list_resources` /
  `fuuz_list_models`), but you **may** drill in with `fuuz_list_model_fields` /
  `fuuz_query_model` for a specific model's fields or a data sample.
- The injected inventory now also includes **scripts and queries** — so all the
  list types (models, flows, screens, scripts, queries) are present and there's no
  reason to re-list any of them.

## 1.0.41

### Changed — cleaner Resources tree, and planners work from it
- **Resources tree no longer lists the generic `system_*` platform tools.** Those
  8 MCP tools (data-flow/model/screen mutations, deploy, list, query) are identical
  on every tenant and are build plumbing, not resources — they were just noise
  under "MCP Tools". The node is now **"Data Flow Tools"** and shows only the
  tenant's own custom data-flow tools (its callable APIs), flattened.
- **Architect & Planner now get the full resource inventory in context** — module
  groups, data models, **data flows, and screens** — and are given a **plan-only
  toolset (no Fuuz MCP reads/mutations)**. They plan from the injected tree instead
  of spending turns re-discovering it, so builds start faster.

## 1.0.40

### Fixed — Builder explored forever and never built (confirmed from the trace)
The trace file showed the local Builder making dozens of read calls
(`list_model_fields`, `query_model`, `load_skill`) and **never a mutation** — and
the earlier force-progress guard never engaged because (a) it counted *steps* not
tool calls, so endless *distinct* reads slipped past it, and (b) the stall guard
ended the turn before the guard's threshold.
- **Discovery budget now counts non-progress tool calls, not steps.** After N
  reads with no build (default 8), the Builder's read/list tools are withdrawn and
  only mutations + `ask_developer` remain — so distinct-argument read spelunking
  (querying model after model) trips it too.
- **A stall now ESCALATES to force-progress instead of ending the turn.** When the
  Builder repeats a capped call, reads are withdrawn and a mutation/ask is required
  — the run pushes toward a build (or a human question) rather than quitting with
  nothing.
- Together with `tool_choice: required`, the Builder is now compelled to attempt
  the mutation (or ask you) — any remaining failure is a payload error the trace
  will show verbatim, not an invisible loop.

### Changed — discover from context, not repeated tool calls
- The injected tenant context now **tells the Builder the model inventory is
  already provided** (raised the shown list to 120) and to NOT call
  `fuuz_list_resources` / `fuuz_list_models` to re-list it — pick the models you
  need, call `fuuz_list_model_fields` for only those, sample with
  `fuuz_query_model` if useful. An **empty result (`[]`) is expected for an unused
  model — not a blocker**; proceed with the design. This cuts the read volume that
  was feeding the loop.

## 1.0.39

### Fixed — agents recalled tools instead of "receiving" results
Root cause: when a local server (LM Studio and others) returns tool calls
**without an id**, the tool RESULT was written with an empty `tool_call_id`, so
the model couldn't link the result to its call — it saw the result as orphaned
and **recalled the same tool** until the loop guard stopped it, building nothing.
- **Stable synthesized tool-call ids.** When the server omits an id, we now
  assign a unique `call_<index>` and use it consistently for both the assistant's
  tool call and the tool result — so results link and the model moves forward.
  Applies to streaming and non-streaming OpenAI-compatible responses.
- **Durable trace file.** Every Copilot tool call + result is now also appended
  to `.fuuz/copilot/trace.log` in the workspace (gitignored), so a failed run can
  be diagnosed from disk, not just the live panel.

## 1.0.38

### Fixed — builds now work regardless of which model you pick
Root cause (found in the tool trace): the **Builder was narrating** "I'll load
the skills and examine the models…" **without emitting a real tool call**, so the
turn ended on prose and nothing was ever built. Mid-size local models do this;
the loop never recovered.
- **Forced tool calls (model-agnostic).** The Builder now runs with
  `tool_choice: required` (OpenAI) / `{type:'any'}` (Anthropic) until it makes
  real progress — any picked model, local or cloud, is compelled to emit an
  actual `tool_use` call instead of describing one. Relaxes to auto once a
  mutation lands so it can still write its summary. Nothing is hardcoded to a
  specific model.
- **Zero-tool-call diagnostic.** If a Builder still emits no tool call, the run
  says so plainly ("the Builder «model» produced no tool call — try a stronger
  tool-calling model") instead of silently looping.
- Builder/coder prompts are no longer worded as if the Builder is always Claude.

## 1.0.37

### Changed — the data flow is the API deliverable
- Architect and Reviewer guidance now encode the platform fact that the only
  callable API/tool on Fuuz is a **data flow** (executeFlow / MCP), and a saved
  transform is reusable logic invoked *inside* a flow. When the goal is an
  API/tool/endpoint, the plan must culminate in a **data flow** (a transform
  alone is incomplete) — the Reviewer now REVISEs a run that produced only a
  transform.

## 1.0.36

### Fixed — Copilot "runs in circles, never builds"
Diagnosed from the local conversation transcript: the crew was burning entire
sprints narrating discovery ("I'll load the skills and examine the models…") and
almost never reaching the flow mutation — analysis-paralysis, not a payload or
approval bug.
- **Lean build crew.** Build sprints now run only the (cloud) **Builder +
  Reviewer** — the local planner/coder discovery hops that caused the loop are
  cut. The Architect's self-contained brief goes straight to a Builder that
  discovers-then-builds in one context. Falls back to the full crew if no
  executor is bound.
- **Force-progress guard.** After a bounded discovery budget (14 tool steps), the
  Builder's read/list tools are **withdrawn** — only mutations and `ask_developer`
  remain offered. It must build or ask; it can no longer keep discovering.
- **Real tool tracing.** Every Copilot tool call + result (ok / DENIED / FAILED
  with the message) is now logged to the **Fuuz** output channel, tagged by
  sprint + role — so build failures are diagnosable, not guessed.
- Builder guidance rewritten for the no-coder reality: bounded discovery, then
  build; report the exact tool error verbatim on failure.

## 1.0.35

### Changed — Copilot sprint hand-offs & honest completion
- **Structured artifact registry threaded across sprints.** Every successful
  mutation/deploy now records what was built (type · name · **real id** · version)
  into a run-level registry injected into every *later* sprint's brief. Dependent
  artifacts (a data flow that must *call* a saved transform) now wire by the real
  id instead of a lossy prose summary — the root cause of "Sprint 2 built it,
  Sprint 3 couldn't find it."
- **Deterministic sprint verification.** A sprint meant to build (model / flow /
  screen / transform / deploy) that produces **no artifact** is now reported
  **FAILED** — even if the reviewer approved. No more "DONE — (no message text)"
  masking a sprint that built nothing. The run summary lists what was built.
- Builder guidance now references earlier sprints' artifacts by real id from the
  registry, never inventing an id or rebuilding.

## 1.0.34

### Changed
- **Copilot chat sticks to bottom only when you're already there.** Scroll up to
  read and new messages/streaming no longer yank you back down; return to the
  bottom to resume auto-follow. Your own messages always scroll into view.

## 1.0.33

### Fixed
- **Build tools now expose the Fuuz MCP server's real `inputSchema`.** Previously
  the mutation tools (`fuuz_data_flow_mutation`, `fuuz_data_model_mutation`, …)
  advertised a formless `{additionalProperties:true}` schema, so the model didn't
  know the exact payload to build and kept reading/deferring instead of calling
  the mutation. The extension now fetches each tool's `inputSchema` from the
  connected tenant's MCP server (tools/list) and uses it as the tool's parameters,
  falling back to the generic schema when unavailable.

## 1.0.32

### Fixed
- **Router no longer swallows build requests.** The 1.0.31 intent router could be
  handed the full tool set and "do the work" (discovery + a plan) instead of
  classifying, then return that plan as a chat answer — so a build request like
  "build a data flow…" never reached the build pipeline. Now: an imperative build
  request skips the router entirely (`looksLikeBuild`), and when the router does
  run it has **read-only tools only** and is told to reply `[[BUILD]]` without
  planning or doing work.

## 1.0.31

### Fixed
- **Questions no longer trigger the whole crew.** A fast intent router now
  answers questions/discussion with a single agent (preferring a local model);
  only an explicit request to create/modify/deploy artifacts escalates to the
  architect/sprint build pipeline. Asking "what is the active tenant?" gets a
  one-agent answer instead of spinning up architect → sprints → 4 build agents.

## 1.0.30

### Added
- **Human-in-the-loop `ask_developer` tool.** Agents pause and ask the developer
  (dropdown or input) for decisions that are the developer's to make (ambiguous
  requirements, whether a relation is required/unique, naming, choices) instead
  of deciding unilaterally. If dismissed, the agent reports it's blocked rather
  than guessing.
- **Tenant-tagged conversation transcripts.** Copilot conversations are archived
  under `.fuuz/copilot/conversations/<tenant>/<date>.md` (self-gitignored) with a
  tenant header, so history is tagged to the app it pertains to.

### Changed
- **Shared agent rules** (every role): plan/build only to Fuuz platform
  conventions; **verify + reuse system data models before creating custom ones**;
  ask the developer for design decisions; never spin — hand off or ask.
- **Skill:** `fuuz-data-model` documents reusing system models and that shifts /
  shift cycles are defined via `ScheduleGroup` + `Schedule`.

## 1.0.29

### Added
- **Architect role + sprint loop (hierarchical orchestration).** A new
  `architect` role decomposes a goal into an ordered, dependency-aware task graph
  (setup models → entities+relations → transforms → flows → screens → deploy).
  The code orchestrator then runs the Planner→Coder→Executor→Reviewer team **per
  sprint**, each with a clean self-contained brief (objective, exact artifacts,
  acceptance, and what earlier sprints already built) — Anthropic orchestrator-
  worker style, so hand-offs work cleanly across different models. Falls back to
  the previous single pass when no architect role is enabled. Sprint progress is
  shown in the Copilot panel.

## 1.0.28

### Added
- **Model dropdowns in Copilot Settings.** Once a provider is connected, its
  available models are listed and assignable per role from a dropdown: LM Studio /
  OpenAI-compatible via the live `/models` endpoint, and Claude/OpenAI/Google via
  their authenticated model APIs (Anthropic falls back to a curated list of known
  Claude models when offline or no key). Models auto-detect when the panel opens
  and re-populate when a role's provider changes.

## 1.0.26

### Changed
- **Shared discovery across agents.** Identical auto-approved read calls
  (list_models, list_model_fields, query_model, list_resources) are now cached
  for the whole run — the Planner's discovery is reused by the Coder and
  Executor instead of each role re-hitting the server. The Planner is also told
  to plan from the already-injected tenant inventory rather than re-listing it.

## 1.0.25

### Fixed
- **Builder now actually builds** instead of exhausting its budget on discovery.
  The Executor is told the mutation tools create-or-update (so no existence
  pre-checks), to read spec files at most once, and to call a mutation as its
  first action and keep going artifact-by-artifact. Builder tool budget raised
  18 → 40 for multi-model builds.

### Added
- **"Allow all this run"** on the Copilot approval prompt — approve once and the
  rest of a multi-artifact build proceeds without a modal per mutation (resets
  each new message).

## 1.0.24

### Changed
- **Copilot asks about relation cardinality.** The `fuuz-data-model` skill now
  instructs the Copilot to ask the developer whether each relation is required
  (`ID!`) or optional (`ID`) and whether unique — noting setup relations
  (status/type/category) are usually required — instead of assuming. FK type is
  still always `ID`/`ID!`, never `String`.

## 1.0.23

### Added
- **Relation foreign keys must be `ID`.** Enforced everywhere data models are
  involved: (1) a blocking compliance rule `relation-fk-is-id` (any relation FK
  typed `String` is an audit error); (2) the Copilot **auto-fixes** relation FKs
  to `ID`/`ID!` before a data-model mutation; (3) the Reviewer treats a `String`
  FK as a REVISE; (4) the `fuuz-data-model` skill now states the rule explicitly.

## 1.0.22

### Changed
- **Discovery on the local Coder, building on the cloud Builder.** The Coder
  (local) now gathers all schema once and emits a complete, build-ready spec; the
  Builder (Claude) trusts that spec and goes straight to the mutation instead of
  re-running discovery reads — cutting the cloud model's token usage. Reviewer no
  longer receives the skills block (it judges from the spec + evidence), and the
  read-query default dropped from 50 to 25 records.

## 1.0.21

### Fixed
- **Much lower token throughput to Claude.** Two changes cut how much every
  Copilot request sends: (1) **prompt caching** — the stable system prompt +
  tool list are now cached (`cache_control: ephemeral`), so each step of a
  role's tool loop reads the large prefix from cache instead of reprocessing it;
  (2) **payload caps** — read-tool results are bounded (query/list/model-fields
  ~16k chars, resource inventory ~20k, file reads ~40k) so the transcript no
  longer balloons across tool steps. Addresses tokens-per-second rate limits.

## 1.0.20

### Fixed
- **Anthropic thinking now uses adaptive mode.** Requests sent
  `thinking: {type: "enabled", budget_tokens: N}`, which current Claude models
  (Opus 4.8/4.7, Sonnet 5, Fable 5) reject with HTTP 400. Now sends
  `thinking: {type: "adaptive", display: "summarized"}` for thinking-enabled roles.

## 1.0.19

### Changed
- **Clearer provider errors** — Copilot HTTP errors now include the provider kind
  and target URL (e.g. `claude [anthropic @ http://localhost:1234/v1]: HTTP 400`),
  making a mispointed `baseUrl` obvious instead of looking like a Claude failure.

## 1.0.18

### Fixed
- **GitHub mirror is now app-scoped.** "Push App to GitHub" no longer mirrors the
  whole tenant — it prompts for which app(s) (module group(s)) to mirror and
  includes only those apps' screens, flows, data models, documents, scripts and
  queries. Other apps, tenant-global scripts/queries/documents, custom MCP tools,
  and system data models are excluded. (Direction unchanged: Fuuz → local repo →
  git.)

## 1.0.17

- Rebuild/reinstall of 1.0.16 (forces the extension host to reload the Copilot
  app-memory feature). No functional changes.

## 1.0.16

### Added
- **Copilot app memory** (`.fuuz/COPILOT.md`) — a per-app, committed knowledge
  file (the CLAUDE.md analog) that the Copilot reads on every run. Durable
  preferences, conventions, gotchas and context stay scoped to the app (no
  cross-app sprawl) and travel with the repo.
  - **Auto-capture + manual**: the Copilot records durable feedback via an
    approval-gated `fuuz_remember` tool, and you can add memories via **Fuuz:
    Remember for this App** / edit **Fuuz: Open Copilot Memory**.
  - **Conversation transcripts** are archived locally to
    `.fuuz/copilot/conversations/` (self-gitignored) for later review.
  - New setting `fuuz.copilot.memoryFile`.

## 1.0.15

### Fixed
- **Copilot tool-call loop guard** — a model repeating the identical tool call
  (e.g. `fuuz_list_model_fields` over and over) is now stopped after 2 repeats:
  further identical calls get a "don't repeat, move on" nudge, and a fully
  stalled turn ends instead of spinning to the step limit.
- **Copilot session memory** — the panel now carries prior turns (recent user
  requests + assistant results) into each run, so you no longer have to re-explain
  the goal on every message.

## 1.0.14

### Added
- **Skill delete / disable / replace** in **Fuuz: Manage Copilot Skills** — delete
  custom skills, disable/enable bundled standard skills (new setting
  `fuuz.copilot.disabledSkills`), and replace a standard skill with a same-named
  workspace copy. Disabling a standard skill never hides a workspace replacement.

## 1.0.13

### Fixed
- **Copilot no longer spins without finishing.** Each role now hands off a real
  "Actions taken" log (tool calls + results), so the Reviewer sees what the
  Builder actually created and approves instead of looping. Builder gets a larger
  tool budget (18 steps), prompts push it to *act* (not narrate) and the Reviewer
  to *approve on evidence*, and the revise loop is bounded to one cycle.

### Changed
- **Default role models** — Planner → Claude Opus 4.8; Coder → `qwen3-coder-next`;
  Executor → `devstral-small-2-2512` (agentic tool-calling); Reviewer →
  `qwen3.6-27b`. Seed defaults only; fully overridable in Copilot Settings.

## 1.0.12

### Changed
- **fuuz-expressions skill** now states the platform's supported JSONata version
  (**2.1.1**) so the Copilot targets it when writing/validating expressions.

## 1.0.11

### Added
- **Fuuz Copilot skills** — bundled standard skills (data flows, nodes, data
  models, expressions, GraphQL, integration, screens, styling) plus user skills
  in `.fuuz/skills` (a same-named skill overrides a standard one). Skill metadata
  is injected into the Copilot; full guidance loads on demand via a new
  `fuuz_load_skill` tool. New command **Fuuz: Manage Copilot Skills** and settings
  `fuuz.copilot.skillsDirs` / `fuuz.copilot.includeBuiltinSkills`.
- **Copilot tenant awareness** — a connected-tenant context block (tenant,
  resource inventory, MCP catalog) is injected into every run, plus read tools
  `fuuz_list_resources` and `fuuz_list_model_fields`.
- **Full Fuuz MCP catalog wired into the Copilot** — read tools (`fuuz_list_models`,
  `fuuz_list_references`, `fuuz_environment_info`, auto-approved) and
  approval-gated build/deploy tools (`fuuz_data_flow_mutation`,
  `fuuz_data_model_mutation`, `fuuz_screen_mutation`, `fuuz_saved_transform_mutation`,
  `fuuz_deploy`), plus a generic `fuuz_mcp_call` for custom data-flow tools. The
  Copilot can now discover and build in the tenant end-to-end.

### Changed
- **Create Tool** now runs inside the Fuuz Copilot instead of VS Code's native chat.

## 1.0.10

### Fixed
- Welcome panel logo now renders — `media/logo-white.png` was excluded from the
  package by `.vscodeignore`; it is now bundled.

## 1.0.9

### Added
- **Welcome / getting-started panel** (`fuuz.welcome`) — an editor webview with
  the Fuuz logo, a 3-step getting-started flow, feature cards, and links to
  GitHub, fuuz.com, support.fuuz.com, and academy.fuuz.com. Opens automatically
  on first activation and is reachable from the Fuuz Copilot / Connections views.

### Changed
- **Activity Bar redesign** — replaced the flat "Fuuz" menu tree with native
  views (Fuuz Copilot, Connections, Resources, QA Runs). The old menu's actions
  now live in each view's title bar (primary as icons, the rest in `⋯`), with
  welcome views for empty states.

## 1.0.8

### Changed
- **Resources tree:** removed the intermediate **Modules** folder. Modules now
  sit directly under their module group (`ModuleGroup ▸ Module ▸ …`).

## 1.0.7

### Changed
- **Removed all Roo Code / Cline references.** Everything that relied on a
  third-party agent extension is now housed natively in Fuuz Copilot: rules load
  only from `.fuuz/rules` (default no longer includes `.roo/rules`), the
  local-AI scaffolder templates and setup guide describe Fuuz Copilot roles
  (`planner`/`coder`/`executor`/`reviewer`) and providers instead of Roo modes +
  profiles, and the empty Roo MCP-writer stubs were deleted.

## 1.0.0 — Fuuz Copilot

Major release introducing **Fuuz Copilot**, the built-in, self-contained
multi-agent assistant — the primary AI experience for the extension, while still
coexisting with any other tools you use.

### Added
- **Fuuz Copilot foundations (Phase 0):** provider-agnostic model layer designed
  for multiple backends — LM Studio (local), Anthropic Claude (direct API), and
  other frontier LLMs (OpenAI, Google, any OpenAI-compatible endpoint).
  - Provider-agnostic chat/tool types (`copilot/providerTypes.ts`).
  - Pure request/stream mapping for OpenAI-compatible **and** Anthropic, including
    reasoning-trace handling and tool-calling (`copilot/messageMapping.ts`).
  - Auth layer supporting **API key and OAuth**; secrets in SecretStorage
    (`copilot/auth.ts`).
  - **Optional, configurable agent roles** — bind Planner/Coder/Executor/Reviewer
    each to any provider+model, or disable any role (`copilot/roleBindings.ts`).
  - **Custom rules & tools from the user's repo** — markdown rules
    (`.fuuz/rules/`) with glob/`alwaysApply` targeting, and JSON
    custom-tool manifests (`.fuuz/tools/`) (`copilot/customRules.ts`,
    `copilot/customTools.ts`).
  - Settings: `fuuz.copilot.enabled`, `.providers`, `.roles`, `.rulesDirs`, `.toolsDir`.
- **Local AI dev environment setup** — auto-scaffolds the multi-agent config and
  shows an LM Studio health indicator (`fuuz.setupAiDevEnv`, `fuuz.checkLocalAi`,
  `fuuz.localAi.*`).

- **Live provider clients + streaming** — OpenAI-compatible (LM Studio/OpenAI/
  Google) and Anthropic streaming clients with tool-calling, SSE decoding, and
  tool-call accumulation (`copilot/providers.ts`, `streaming.ts`).
- **Credential UI** — `Fuuz: Manage Copilot Provider Credentials` / `Sign Out`:
  API-key entry and an OAuth PKCE loopback sign-in flow; secrets in SecretStorage.
- **Multi-agent orchestration** — pure Planner→Coder→Executor→Reviewer state
  machine with a review→revise loop and iteration/hard-cap guards
  (`copilot/orchestrator.ts`), driven by `copilot/copilotRun.ts`.
- **Agentic tool loop + tools** — the chat session runs tools and feeds results
  back until the model stops; built-in tools `fs_read`/`fs_list`/`fs_edit`
  (approval)/`run_command` (approval)/`fuuz_query_model`, plus the user's repo
  custom tools, with project rules injected into the system prompt
  (`copilot/chatSession.ts`, `toolRegistry.ts`, `builtinTools.ts`, `contextLoader.ts`).
- **Chat panel** — `Fuuz: Open Copilot` runs the full multi-agent loop in a
  self-contained webview with per-role phases, streaming, and tool-call cards.

### Notes
- The pure logic (mapping, streaming, orchestration, tool dispatch, role binding,
  rules/tools loading, review parsing) is unit-tested. Custom-tool *execution*
  (command/http/mcp) is stubbed pending Phase 2.1.

## 0.37.0

Industrial best-practice checks across data models, flows and screens (type-aware,
cross-referenced against the live tenant; all suggestions flow into the Fix Plan).

- **Data models** (when the model type is known):
  - *Setup* models should have `color`, an `active`/`isActive` flag, and a `code` (with `id == code`, both immutable).
  - *Master/Transactional* models should reference a standard setup type (status/type/group/category) and carry a `status`/`isActive` (prefer soft-state over hard delete).
  - A model **named** like a setup type (…Status/Type/Group/Category/State) that isn't a setup model is flagged.
  - **Units of measure**: bare-number measurement fields should use the `Measure`/`Ratio` scalar or relate to the system `Unit` model.
- **Flows**:
  - Every `mutexLock` must have a matching `mutexUnlock` (deadlock guard).
  - Multi-write flows need a Try/Catch **transaction boundary**.
  - **Create-in-script** mutation values flagged as a data-import/integration risk (set defaults in triggers / data-change flows).
  - References to **deprecated** saved transforms flagged.
  - Error-handling flows should return a **standardized error response**.
- **Screens**:
  - `$integrate` in any screen element transform → use a Connection + integration flow.
  - A Form/Table bound to a **large transactional model with no server-side filter** is flagged for perf.
- **Duration** stays a composite scalar (from 0.36) and is never flagged as a missing-unit measure.

_Deferred pending live schema confirmation_: data-change-capture retention/disable rules
(history/telemetry), composite-index suggestions via the model trigger, app "no roles configured",
and deployment hygiene — these need exact Fuuz field names verified over MCP before shipping.

## 0.36.0

- **AI-assisted remediation — "Generate Fix Plan (Claude)"**: turn compliance findings
  into an actionable, Claude-ready Markdown brief that you review/accept, then run with
  Claude Code, which applies the changes via the Fuuz MCP. The extension never mutates the
  tenant itself. Available per-flow (tree context menu) and per-tenant (command palette).
  The plan groups work into concrete steps with **node ids**, **heuristic name suggestions**
  (Claude refines), and the exact `system_*` mutation tools to use — renames, descriptions,
  extracting long/duplicated scripts to Saved Scripts, similar queries to Saved Queries,
  adding payload-contract (`validate`) nodes, scoping/paginating queries, `$integrate`→http,
  credential fixes, and release-notes — then redeploy.
- **Highly-similar (not just identical) cross-flow detection**: scripts and queries embedded
  across flows are now clustered by token-shingle similarity (≈80%+), so near-duplicates that
  drifted apart are still surfaced for extraction into Saved Scripts / Saved Queries.
- **Heuristic naming suggestions** seeded into findings (e.g. a query on `productionRun` →
  "Query Production Run"; a script's jsdoc title → its name) and carried into the fix plan.
- **Long-script threshold raised to 300 lines** before suggesting extraction to a Saved Script.
- **Duration is a scalar**: `Duration` (`{ milliseconds, text }`, text ISO) is no longer treated
  as a relation in the ERD or schema compliance — no phantom edge / FK requirement.

## 0.35.0

- **View saved script/query content from the tree**: click a Script or Query in the
  resource tree (or use its inline "View Content" button) to open its real body in a
  read-only editor — `SavedTransform.transform` for scripts (opened as JavaScript /
  JSONata) and `SavedQuery.queryText` for queries (GraphQL). Fetched on demand over the
  platform `system_query_model` tool via a read-only `fuuz:` virtual document.

## 0.34.0

- **Flow compliance rebuilt on the real Fuuz node model** (validated against a live
  tenant). The analyzers now read `DataFlowElement` over the platform
  `system_query_model` tool and decode each node's real `configuration` (a new
  recursive TRON/JSON decoder), reasoning about the actual node types — `request`,
  `fork`, `collect`, `ifElse`, `switch`, `javascriptTransform`, `transform`,
  `savedTransformV2`, `query`, `http`, `tryCatch`, `validate`, … New & revised rules:
  - **Entry points** surfaced — multiple `request` nodes = separate paths (info, not an error).
  - **Fork/collect**: forks need NOT always recombine (parallel terminal paths are fine);
    a collect's batch count should match its fork's branch count; orphan collects flagged.
  - **Payload contract**: a saved script/query fed the whole context (`# Changelog

All notable changes to **Fuuz for VS Code**.

 pass-through) with
    no `validate` node — escalated when the saved transform declares an input schema.
  - **Query scoping**: an unfiltered query (no `where` / variable transform) is flagged on
    master/transactional models (cross-referenced against `DataModel` type + estimated record
    count), exempted for `setup` models; large models recommend a pagination cycle.
  - **Query page size**: `first: > 500` (and nested result sets) flagged as long-running.
  - `$integrate` in scripts → http (integration) node; hard-coded credentials; long inline
    scripts → saved script; error handling; node/flow naming; release-notes (devops) gaps.
- **Screen compliance** (new): **Check Screen Compliance** on a screen — flags > 5 action
  buttons, > 75 elements, oversized element configuration, inline transforms on table columns
  / form fields (move to table/form transforms), ambiguous names, and missing version notes.
  Folded into **Audit Entire Tenant** alongside models + flows.
- **System tools only**: all analysis reads platform `system_*` tools; the extension no longer
  depends on user-built `data_flow_*` flows (which can be unreliable/incomplete). The guided
  tool-builder prompt was updated to say the same.

## 0.33.0

- **Fix Claude /mcp auth errors from a shadowing project .mcp.json**: a project
  `.mcp.json` registers Fuuz servers with **env-var token refs** (safe to commit),
  but Claude Code gives project scope precedence over the embedded `~/.claude.json`
  servers — so if the `FUUZ_TOKEN_*` vars aren't exported, those token-less entries
  shadow the working ones and fail to authenticate.
  - On activation the extension now **detects** this and offers to remove the
    shadowing project entries (the embedded user-scoped servers keep working).
  - New command **Fix Claude MCP Conflicts (.mcp.json shadowing)**.
  - The extension's own access (resource tree, ERD, QA, etc.) and VS Code Copilot
    are unaffected either way — they use SecretStorage + in-memory registration,
    not `.mcp.json`.

## 0.32.0

- **Flow diagram compliance (Check Flow Compliance)**: analyzes a real deployed
  flow's nodes over MCP and flags: branch/collect payload mismatches, missing
  names/descriptions, scripts >100 lines (→ Saved Script), missing try/catch or
  error-response nodes, **delay** nodes (warning), `$integrate` in scripts (→ use
  an Integration node + Connection), **hard-coded credentials** (api key / token /
  password / passphrase — flagged as a risk), and hard-coded URLs / stray console
  logging. Broadcast nodes are surfaced. The node fetch discovers the
  `DataFlowElement` fields at runtime so it adapts to the tenant's schema.
- **Cross-flow checks (Check All Flows)**: finds the same query used across flows
  (→ Saved Query) and duplicated scripts (→ Saved Script).
- **Audit Entire Tenant**: runs model + flow compliance across the whole tenant
  and shows a summary — overall score, a per-artifact scorecard (worst first), and
  consolidated findings.

## 0.31.0

- **QA logs are bounded to the run**: log collection now uses the run window
  (start = plan time, end = result.json mtime or now) **capped to 3h**, instead of
  "createdAt → now" — so collecting days later no longer sweeps in unrelated logs.
- **Dropped deploy-log noise**: removed `DataFlowDeploymentLog` (deploy-time
  build logs like `addVersion`/version-validation) from QA collection; runtime
  flow activity is already captured via `ApplicationSpanEventLog`. QA logs now =
  span (runtime) + integration.
- **Cleaner result header**: the QA result view no longer renders an empty
  `( )` target when a run has no URL/environment.

## 0.30.0

- **Authority mode**: when starting a QA run you choose **Autonomous** (Claude
  proceeds with full authority once each persona is logged in — launched with
  per-action permission prompts bypassed) or **Manual** (supervised, confirms
  each step). Fixes the "prompts me too much" friction.
- **Security & RBAC probes**: every run now includes authorized front-end
  security objectives — forced browsing to unauthorized screens, client-only RBAC
  bypass, console/API probing, and (when destructive is enabled) XSS/injection —
  to surface RBAC leaks where the UI hides what the server still permits.
- **Artifacts stay with the run**: the brief now insists screenshots/GIFs and
  result.json are written under `.fuuz/qa/<tenant>/<run>/artifacts` (never the
  workspace root). Deleting a run already removes its entire directory — artifacts
  included.

## 0.29.0

- **Unified QA result view**: a new **Open QA Result** action on each run renders
  the agent's findings (per-persona step pass/fail, defects with severity + fixes,
  UI/UX grooming) merged with the Fuuz logs collected over MCP — in one webview,
  with clickable evidence (screenshots/GIFs).
- The QA brief now asks the agent to write a structured `result.json` (schema
  included) into the run directory, which the view ingests tolerantly.
- Fixed the brief's artifacts path to be tenant-scoped (`.fuuz/qa/<tenant>/<run>/`).

## 0.28.0

- **Simpler Connections panel**: connections are managed entirely by **API key**.
  Removed the "Add enterprise", "Add tenant", and "Edit environment & endpoints"
  controls — paste a key at the top and the enterprise/tenant/environment are
  detected automatically. Environment and endpoints are shown read-only (they
  shouldn't change). Pruned the now-unused message handlers and state.

## 0.27.0

- **QA Runs scoped to the active tenant**: runs are now stored under
  `.fuuz/qa/<tenant>/<run>/` and the **QA Runs** view shows only the active
  tenant's runs, refreshing when you switch tenants.
- **Delete a QA run**: a trash action on each run removes it and all its files
  (brief, plan, logs, artifacts) after confirmation (sent to the OS trash).

## 0.26.0

- **QA launches from the workspace root**: the Claude Code QA session now runs
  from your (already-trusted) workspace folder instead of the per-run directory,
  so Claude no longer prompts to "trust this folder" on every run. The brief,
  MCP config, and artifacts are referenced at `.fuuz/qa/<run>/`.

## 0.25.0

- **Fix QA launch command**: the `claude --mcp-config` flag is variadic, so the
  positional prompt was being swallowed as a config path ("MCP config file not
  found"). The prompt now precedes the flag, and `--strict-mcp-config` limits the
  QA session to exactly the Playwright + tenant Fuuz servers.
- Removed the deprecated `baseUrl`/unused `paths` from tsconfig.

## 0.24.0

- **QA runs use Claude Code, not Copilot**: **QA this Screen / QA this App** now
  generate the brief and launch a supervised **Claude Code** session directly (the
  headed-browser Playwright run) instead of handing off to VS Code Copilot chat.
- **Tenant-aware QA sessions**: the run targets the **active tenant's** environment
  (e.g. `https://build.mfgx.fuuz.app`) and the Claude Code session is wired with
  that tenant's **Fuuz MCP server**, so Claude can cross-reference schema, data, and
  logs while testing. The token is passed via the terminal environment
  (`${FUUZ_QA_TOKEN}`) and is never written to disk.

## 0.23.0

QA harness — run it in the browser.

- **Run QA in Browser**: from a QA run, launches a supervised Claude Code session
  wired to the **Playwright MCP** (headed browser, persistent profile) that
  executes the run's brief against the target app. The browser is headed so you
  log each persona in manually; Claude drives everything else and saves
  screenshots/GIFs + a report to the run's `artifacts/`. The Playwright MCP config
  is written to the run dir; the session runs in an integrated terminal so logins
  and progress stay visible.

## 0.22.0

QA harness — log correlation & runs view.

- **QA Runs view**: a new view in the Fuuz sidebar lists each run under
  `.fuuz/qa/<run>/` and its artifacts (brief, plan, collected logs); click to open.
- **Collect Fuuz Logs for Run**: pulls Fuuz-side logs over MCP (the developer's
  connection — the persona under test may lack log access) for the run's time
  window and writes `logs.json`. Sources: `ApplicationSpanEventLog` (activity/
  trace), `DataFlowDeploymentLog` (data-flow logs), `IntegrationRequestLog`
  (integration errors). Each source degrades independently; errors sort first.

## 0.21.0

Testing & QA tooling — first cut.

- **Schema Doctor (local compliance)**: check a data model, or a local artifact
  outline, against the platform's conventions and get an explainable 0–100 score
  with fix recommendations — **before** pushing to Fuuz.
  - **Check Schema Compliance** (data-model node) audits a deployed model over MCP.
  - **Scaffold Compliant Outline** writes a convention-correct starting skeleton
    for a data model, screen, flow, script, or query.
  - **Check Outline Compliance** (editor action on `*.model/query/flow/screen.jsonc`
    and `*.script.js`) scores a local outline you scaffolded or hand-authored.
  - Results open in a new **compliance report** webview (score gauge, findings
    with fixes, per-rule breakdown, re-check).
- **QA harness (preview)**: **QA this Screen** / **QA this App** generate a
  driver-agnostic **test brief** for an AI agent to drive the running app —
  per-persona manual login, click/fill/CRUD coverage, screenshots + GIFs, browser
  console + Fuuz log capture, and UI/UX grooming. Destructive steps are gated to
  test environments. The brief + plan are written to `.fuuz/qa/<run>/` and handed
  to the agent chat. (Headless Playwright driver + MCP-side log correlation land
  next.)

## 0.20.0

- **Design system, by default**: **Generate App Context File** now also writes
  `.fuuz/DESIGN_SYSTEM.md` — the canonical Fuuz UI design system (DM Sans,
  neutral-charcoal/white surfaces, violet `#5B30DF` accent, the shared status
  palette) plus a paste-ready theme helper that reads live tokens from
  `$appConfig.designSystem`. `AVAILABLE.md` points at it, so any widget an AI
  copilot builds through the MCP is themed like core Fuuz unless you ask for
  something unique.

## 0.19.0

- **Query a model from the ERD**: each entity in the ERD now has a **⌕** button
  in its header. Click it to run **Query Data Model** for that model — pick the
  fields, enter an optional JSON filter, and the matching records open in an
  editor tab. Same flow as the Resources tree, now reachable straight from the
  diagram.

## 0.18.0

Performance, reliability, and usability pass.

- **Safer Claude config writes**: `~/.claude.json` and the Claude Desktop config
  are now written **atomically** (temp file + rename) and only when their contents
  actually change. This stops per-startup churn and closes the corruption/lost-write
  window against Claude's own writes to those files. An unconfigured workspace no
  longer touches them at all.
- **Faster MCP calls**: on-demand calls (tree expansion, ERD field/relation loads,
  queries) reuse a pooled MCP session instead of a full handshake each time, with a
  one-shot retry when a reused session has gone stale.
- **Cancellable operations**: Execute Flow, Send Webhook, Query Data Model, the
  ERD builds, and Deploy now show a **Cancel** button that aborts the in-flight
  request.
- **Deploy version picker**: **Deploy Component Version** offers a quick-pick of the
  component's recent versions instead of requiring a hand-typed id (falls back to
  manual entry).
- **Lighter startup**: activation skips legacy migration, Claude auto-register, and
  the stale-cache refresh entirely when no connections are configured.
- **Config panel rebuilt in React**: the Connections panel is now a bundled React
  webview instead of a hand-written HTML string — same features, easier to evolve.
- **Robustness**: fixed a TRON parsing edge case where a value containing
  `Letter(` could spawn phantom records; sync failures now surface in the **Fuuz**
  output channel instead of being swallowed.
- **Internals**: the extension host is now bundled with esbuild (faster activation,
  smaller package); shared config-merge and abort logic extracted and unit-tested.

## 0.17.0

- **Flows grouped by type**: the **Flows** node now groups data flows by their
  type (e.g. **Edge**, **Webflow**, **Backend**) when the type is known, so a
  module's flows are easier to scan.
- **Web flows can't be executed from VS Code**: web flows run in the Fuuz web UI,
  so the **Execute** action is hidden for them (and blocked with an explanatory
  message if invoked another way). They're marked `web · run in Fuuz` with a
  globe icon.
- Flow types are resolved best-effort from `DataFlowType`; if a tenant's schema
  doesn't expose them, flows simply render ungrouped (as before).

## 0.16.0

- **Interactive ERDs (React Flow)**: the entity-relationship diagrams are now a
  draggable node graph instead of a static Mermaid image. **Drag** entities to
  arrange them, **click** a node to expand its `field : type` table (loaded
  lazily so big diagrams stay fast), **double-click** a node to **expand its
  related entities** into the graph, **click** an entity to highlight its
  relationships and dim the rest, and **search** to jump to a model. A minimap,
  zoom controls, and an **Auto-layout** button are built in.
- **Crow's-foot cardinality**: each relationship shows one/many markers at both
  ends, so it's clear which side is the "many".
- **No more duplicate links**: a foreign key and its object twin (`areaId` +
  `area`) and a key + its reverse collection now collapse to a **single** edge.
  Two models are only joined by multiple edges when there are genuinely distinct
  foreign keys (e.g. `shipFromAddressId` and `shipToAddressId`).
- **Persisted layouts**: your manual arrangement is saved per diagram (per
  tenant) and restored next time you open it.
- **Removed** the Mermaid renderer and **Export .mmd** action. The diagram is now
  rendered by a bundled React app (`media/erd/`); the extension host still ships
  with **no runtime dependencies**.

## 0.15.0

- **Auto-register with Claude**: the Fuuz MCP servers are now kept in sync with
  **Claude** automatically whenever a connection or its token changes — connect
  an API key and Claude can use it after a restart, no command or env-var setup
  needed. Controlled by the new `fuuz.claudeAutoRegister` setting
  (`userAndDesktop` by default; `user`, or `off`).
- **Tokens embedded for private scopes**: Claude Code **user** (`~/.claude.json`)
  and **Claude Desktop** entries now embed the live token directly (their config
  lives mode-600 in your home dir and is never committed — like every other MCP
  server). On **Replace API Key**, the embedded token is refreshed automatically.
- **Project scope stays env-ref**: the project `.mcp.json` is never written
  automatically and never embeds a token — it references `Bearer ${FUUZ_TOKEN_…}`
  so it remains safe to commit. The **Register MCP Server with Claude** command
  still offers it (with **Copy export commands**) for sharing with a team.

## 0.14.0

- **Register MCP Server with Claude**: new command that makes the Fuuz MCP
  servers reachable from **Claude** (Claude Code project `.mcp.json` and user
  `~/.claude.json`, and Claude Desktop). VS Code's native MCP registration is
  only visible to VS Code's own Copilot — Claude reads its own config — so the
  servers are now written there too. Only `fuuz-*` keys are managed; everything
  else in those files is preserved.
- The **token stays off disk**: Claude Code entries reference
  `Bearer ${FUUZ_TOKEN_…}`; Claude Desktop runs the bundled stdio proxy with
  `FUUZ_TOKEN_ENV` indirection so the proxy reads the secret from the
  environment at launch. The command can copy the matching `export …` lines to
  your clipboard.
- The stdio proxy now resolves its token from `FUUZ_TOKEN` **or** the env var
  named by `FUUZ_TOKEN_ENV`, for clients that don't expand `${VAR}`.

## 0.13.4

- **Discovery diagnostics**: when the MCP server returns errors (e.g. a key
  lacks query permissions), the failures are now **surfaced** — a "Couldn't load
  some resources" node in the Resources view lists each one, and every sync logs
  to the **Fuuz** output channel — instead of silently showing only tools.
- **Permission warning**: if the API User isn't authorized, a notification names
  the affected modules and explains the fix — grant a read/query policy (or
  policy group) to the API User in Fuuz, then **issue a new API key** (existing
  keys don't inherit newly-granted policies) and **Replace API Key**.
- Documented the per-tenant authorization requirement (README → Permissions).
- Discovery model queries are **serialized** (not concurrent) to avoid
  throttling on busy tenants.

## 0.13.3

- **Interactive ERDs**: pan (drag), zoom (scroll), and **Fit**, with **Export .mmd**.
- Mermaid is now **bundled** (renders offline; fixes the blank diagram caused by a
  blocked CDN import).
- **Pre-ship hardening**:
  - **Sync** now clears the ERD/field caches so re-syncing reloads everything.
  - **Deploy** is gated behind the `fuuz.enableDeploy` setting (off by default).
  - MCP sessions **retry with backoff** when the server throttles rapid calls.

## 0.13.0

- **ERD expansion**: module-level and application-level entity-relationship
  diagrams, inbound references on the per-model ERD, and **Export .mmd**.
- **Query Data Model**: read-only `system_query_model` runner (pick fields +
  JSON filter → results in a JSON view).
- **Deploy Component Version**: guarded `system_deploy_app_component_version`
  (explicit type + version + modal confirm; data-model deploys flagged as
  destructive/async).
- **Open in Fuuz**: opens the active tenant's app host.
- **Find Data Model**: quick-pick search that opens a model's ERD.
- **Last-synced** indicator on the Resources view + auto-refresh on startup when
  the cache is stale (>30 min).
- Repository metadata fixed; this changelog added.

## 0.12.0

- **Real tool gating** via a local stdio MCP proxy that filters `tools/list` and
  blocks disabled `tools/call`.
- Tool classification: System = `system_*`; Custom (Data Flows) = `data_flow_*`
  and tenant flows.

## 0.11.0

- Agent Tools enable/disable, **Create New Tool** (guided Copilot chat), and lazy
  data-model field loading.

## 0.10.x

- MCP-driven resource discovery: Application tree
  (moduleGroup → module → screens/flows/data models), System Data Models,
  Environment, and MCP Tools; per-data-model ERD.
- Connection health + re-auth (Replace API Key); unit tests for the pure helpers.

## 0.9.x

- API-key onboarding (JWT-derived tenant/enterprise/environment), SecretStorage
  tokens, native MCP server registration, `.vscode/mcp.json`, per-endpoint health
  probing, sidebar welcome, and the connection-management panel.

## 0.8.0

- Initial MCP connection UI, SecretStorage, and native MCP registration.
