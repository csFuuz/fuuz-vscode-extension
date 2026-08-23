# Flow runtime rules — found the hard way

Authoring a flow correctly is not the hard part. The hard part is that a wrong
flow usually **runs**, reports success, and does nothing — so the symptom is a
blank field or a zero count, days later, rather than an error.

Everything here was established by a failed run on a live tenant. When copying a
node shape, **copy it field-for-field from a flow that works in that tenant**; the
node-type docs describe patterns, not the exact `data` shapes.

## Scope: the payload is gone after the first node

**Each node's `$` is the previous node's output.** After an `http` or
`integrateV2` node, `$` is the API response — the request payload is out of scope.

A gate written as `$.mode = "apply"` after an http node therefore evaluates
against the API response, is always false, and makes **every run a silent dry run
that reports success and writes nothing.**

Stash what you need up front and read it from context:

```jsonata
mergeContext:  { "input": $merge([{ /* defaults */ }, $]) }
downstream:    $state.context.input.mode
```

For a request-triggered flow, **the request body IS the JSONata context root** —
`$` and `$$` both give it. There is no `value` key (that is the `dataChange`
shape, which is where the habit comes from), and `$state` has no `context` key
until something writes one.

## Context: `setContext` replaces, `mergeContext` merges

The first `setContext` legitimately establishes context. Any *later* one whose
transform does not carry the old context forward **deletes everything set before
it** — and downstream `$state.context.foo` then evaluates to **null rather than
erroring**, so the flow keeps running and the loss shows up as blank output.

Write every later setter as `$merge([$state.context, { "newKey": … }])`.

## Metadata: the path depends on the flow type

| what | path |
| --- | --- |
| flow/tenant metadata (tenantId, flowId, versionId, logLevelId, …) | **`$state.metadata`** |
| authenticated identity | **`$state.claims`** → `{ userId, tenantId }` |
| bare `$metadata` | **web flows only** — not System, not embedded/Screen |

**The wrong form does not error.** `$metadata.tenantId` in an embedded flow
evaluates to nothing, the enclosing JSONata object constructor simply drops the
key, and the flow reports success — the symptom is `"attested": {}` in an output
that otherwise looks fine. Worth a lint rule: in System and Screen flows, any
`$metadata.` not preceded by `$state.` is wrong.

Prefer `$state.claims.userId` over a user id in the payload: a caller can assert
any id it likes; claims cannot be forged. (Screen *button* pre-transforms are a
third context again — there `$metadata.user.id` resolves but `$metadata.tenantId`
does not.)

## Query nodes build their own variables

A `query` node's GraphQL variables come from **its own `variablesTransform`**
(JSONata with `$state` bound), **not** from the incoming payload. A preceding
transform node that "produces the variables" is ignored unless the query reads
them.

Left as `"{}"`, every variable arrives null; a non-null argument like
`$first: Int!` then fails GraphQL validation; an enclosing `tryCatch` swallows it;
and the screen renders blank. That chain has masqueraded as a renderer bug more
than once.

## Node types and shapes

- **The node type is `mutate`, not `mutation`.** An invalid node type does **not**
  fail the deploy: create and deploy both succeed, `active: true`,
  `deployed: true`, the stored `flow` looks right — and then `executeFlow` answers
  `500 NotFoundError "No active deployed flow with ID <id> found"` in ~0.2 s, which
  reads like a propagation problem and is actually an invalid graph. Diagnose by
  running a known-good minimal flow: if that returns 200, the graph is yours to
  fix.
- **A `response` node takes `responseTransform`, not `transform`.**
- **Gate a write by emptying the payload**, not by branching:
  `$state.context.input.mode = "apply" ? …rows : []` — one path, no unreachable
  branch. Works for `mutate`; **not** for a connector node, whose `inputSchema`
  sets `minItems: 1`.
- **`flow.id` must equal the DataFlowVersion's own id.** Sequence:
  `createDataFlowVersion` → `updateDataFlowVersion` with `flow.id = versionId` →
  `deployDataFlowVersion`. With a slug there, every `executeFlow` **hangs to the
  300 s gateway timeout** with no error. Assert it before calling, so a hang is
  never misread as a logic bug.
- **The `DateTime` scalar rejects a compact offset.** `"…T13:21:25.938-0400"`
  fails with *"DateTime cannot represent an invalid date-time-string"*. Normalise:
  `$type($s) = "string" ? $fromMillis($toMillis($s)) : null`. Guard with `$type`,
  not `$exists` — `$exists(null)` is true.
- Every `mutexLock` needs a matching `mutexUnlock`.

## Flow type and invocation are a matched pair

Mismatch them and you get a spinner with no error:

| flow type | invoked by | outcome |
| --- | --- | --- |
| `Integration` / `System` | action step `{type:'flow'}`, or a transform with `remote: true` | works over `/orchestration/executeFlow` |
| `Screen` (web flow) | **`FlowButton` only** | works in the browser's web environment |
| `Screen` reached from an action step | — | **504 at ~300 s** |

- **`remote: false` does not mean "runs in the web environment."** It means the
  transform is evaluated client-side, and the client-side `$executeFlow` still
  posts to `/orchestration/executeFlow`, which only knows Integration flows.
  Rule of thumb: `remote: true` for system/integration flows, `remote: false` only
  for web flows.
- **A web flow must be registered on the screen that invokes it** —
  `ROOT.props.screenDataFlowIds: ["<flowId>"]` on the Screen element (the
  designer's "additional flows"). Missing it gives `500 No active deployed flow
  with ID <id>`: the same message as a genuinely absent flow. Not
  `pageLoadDataFlowIds`, not `flowsDelay`.
- **A FlowButton has no action steps**, so confirmation, toast and table-refresh
  must move *into* the flow as `confirm`, `snackbar` and `searchTable` nodes.
- **A Screen flow's definition is fetched when the SCREEN LOADS**, not when the
  button is pressed. Deploying a new version does not affect an already-open tab —
  it keeps executing the definition it fetched at page load, silently. **Reload
  the screen after deploying a web flow before concluding anything.**
- A flow-node `setContext` writes **flow** context, not screen context. A web flow
  cannot hand its result back to the screen that way; carry cross-boundary state on
  a data model and read it from a Table or Form.

## Turn logging on before you need it

Designer test-runs show logs live and **do not reliably persist**. Deployed
executions with logging enabled persist to `DataFlowDeploymentLog`, which is
queryable — that is the debug channel:

- Flow header `logLevelId: "Debug"` (values are capitalised: `Info`, `Debug`,
  `Warn`, `Error`, `Trace`, `Fatal`).
- On **every** node:
  `logging: { executionStarted: true, executionSucceeded: true, executionFailed: true, enableTraceLogging: true }`.
- `log` nodes at key points persist too.

**UI-triggered runs write no rows at all** — debug a FlowButton with the browser's
network panel instead (`/integration/connection` calls followed by `/application`
mutations is a healthy run).

And measure before believing: a hung `executeFlow` is not slow work, it is *no*
work. Check the data it should have written.

## Deploying iteratively

- **Always deploy with `forceStopPreviousVersions: true`.** Without it every prior
  version keeps running as a competing consumer — flaky, hung, half-executed runs.
- The `deployed` flag is **sticky**: it stays `true` after a version is stopped, so
  it never tells you what is currently running.
- The flow request topic is scoped to the deployed **version** id. A flow exposed
  as an MCP tool binds to the version current *at reconnect*; redeploy and the tool
  keeps publishing to the old version's topic, so calls hang with zero execution
  logs. **Reconnect after redeploying a tool-exposed flow.** Get the flow right,
  deploy once, reconnect once, then run.

## Schedules

```
DataFlowSchedule { name, active, dataFlowId, inputSchema }
  └ DataFlowScheduleFrequency { scheduleTypeId: 'cron',
                                config: { cronString, timezone },
                                payload: <the flow's request payload> }
```

- **`inputSchema` is required** on the schedule — a JSON Schema for the payload,
  which is also the form a human edits.
- **The payload must carry the mode.** A flow that defaults to a dry run will run
  on schedule and write nothing.
- `valid` is computed **asynchronously**: `false` / `status: null` right after
  create, then `true` seconds later.
- To prove a schedule fires without waiting for its real time: add a temporary
  `* * * * *` frequency with a harmless payload, poll `lastExecution` (~45 s), then
  delete it.

## Topics: the two ends take different identifiers

| node | property | value |
| --- | --- | --- |
| `publish` | `topicId` | the Topic's **id** (a per-tenant cuid) |
| `topic` (source) | `topicName` | the Topic's **`fullyQualifiedName`** |

Putting the plain name in `topicName` subscribes to **nothing**, silently. The FQN
pattern is `mfgx.tenant.<tenantId>.topic.<name>` (the prefix is `mfgx` even in a
non-MFGx enterprise) — but it is derived, so resolve the live value rather than
composing it. Both values are tenant-scoped, so neither belongs hardcoded in a
portable app. The legacy `subscribe` node is deprecated; use `topic`.

## Exposing a flow as an MCP tool

The switch is not in the designer (`File > Edit Properties` carries only
id/name/description/module/logLevel). It is on the flow's admin form —
`/system/orchestration/dataFlows/<id>` → Details → **MCP Tool Configuration**.

**`inputSchema` is load-bearing, and that form will not save it** — it writes
`null` over an existing one. With it null the tool registers, is callable, and
every call returns *"Request failed with status code 500"*, which reads as a broken
flow. Set it over the API:
`updateDataFlow(payload:[{ where:{id}, update:{ mcpToolConfiguration:{…} } }])`.

The flow's `description` is what an agent reads to decide whether to call it, and
the auto-generated API documentation only appears once the flow is **deployed**.

## Pushing a large flow

Flow and screen mutations replace the whole definition atomically, inline in one
tool-call argument — which is model *output*. A large flow (≈200 KB) exceeds a
single turn's output budget: the call truncates mid-emit and **corrupts the
draft**. A subagent hits the same wall.

Push it from a file instead, with a small script that does the MCP handshake
(`initialize` → capture `Mcp-Session-Id` → `notifications/initialized` →
`tools/call`) so the payload never passes through the model. Execution of heavy
flows can still drop the connection while completing server-side — verify by
querying the records it should have written, not by trusting the response.
