# Fuuz Copilot — Request Intents & Agent Routing

Every user message is classified into ONE intent by `src/copilot/intentRouter.ts`
(`classifyIntent`), which decides **which agents run**. This keeps a data question
off the full build crew and sends a repair to the Builder instead of the chat
router. Classification is deterministic; the LLM router is a fallback that can
still escalate an under-classified question to a build via `[[BUILD]]`.

## Intents, triggers, and who runs

| Intent | Example phrasings | Trigger words | Agents that run |
|--------|-------------------|---------------|-----------------|
| **build** | "build a flow…", "create the FormulaHeader model", "scaffold a screen" | build, create, add, make, generate, implement, scaffold, set up, new (+ artifact) | Architect → Executor → Reviewer |
| **modify** | "rename the OEE flow", "change the module", "add a field to WorkOrder" | update, modify, change, rename, delete, remove, configure, wire up, adjust, refactor, extend | Executor → Reviewer (lean; surgical) |
| **fix** | "find the OEE flow and fix it", "the type is wrong", "can not be 'diagram'", "it's broken" | fix, correct, repair, patch, debug, retype **and statements**: wrong, incorrect, broken, invalid, fails, should (not) be, can not be | Executor → Reviewer (surgical fix loop) |
| **deploy** | "deploy the OEE flow", "publish version 1.0.0" | deploy, publish, release, activate, promote, go live | Executor (deploy tool) → Reviewer |
| **data** | "what's my OEE", "how many open work orders", "show me scrap by line" | metric words (oee, availability, scrap, yield, count, how many, total, average, trend…) or "what's my/our/the …" | Answerer only (read tools: query the tenant, run existing flow) — **no build crew** |
| **inspect** | "list the flows", "what fields does WorkOrder have", "find the OEE flow" | list/find/search/show/what + artifact noun (flow, model, screen, field, schema) | Answerer only (fuuz_list_resources / fuuz_list_model_fields) |
| **howto** | "how do I create a data flow?", "what is a saved transform?" | how do/to/can, what is/are, explain, difference (+ platform concept) | Answerer only (knowledge from skills) |
| **chat** | "thanks", "hello", "calculate oee is the one" | anything else / short clarifications | Answerer only |

`BUILD_INTENTS = {build, modify, fix, deploy}` → the build pipeline.
`ANSWER_INTENTS = {data, inspect, howto, chat}` → the light read agent.

## Why this was needed

The trace showed "find the oee data flow we created and fix it" produced **zero
build activity** — the old router only treated `build/create/update/…` as build
verbs, so "fix"/"find" fell through to the chat answerer, which changed nothing
and left no trace. Now:

1. Repair phrasing (verbs *and* statements like "the type is wrong") routes to the
   Builder.
2. Data questions ("what's my OEE") are answered with real numbers by a single
   read agent — not the whole crew.
3. The router path is now traced (`[copilot] intent=… → …` and
   `[copilot router] decision=…`), so a chat-routed turn is never invisible in
   `.fuuz/copilot/trace.log`.

## Precedence (first match wins)

deploy → fix → build → modify → data → howto(explicit) → inspect → howto(fallback)
→ chat. Repair beats build/questions so "why is X broken, fix it" reaches the
Builder; data beats howto so "what's my OEE" is answered with data, not a lecture.

## Tuning

Edit the regexes in `intentRouter.ts` and the cases in
`src/test/intentRouter.test.ts`. Add domain metric words to `METRIC`, platform
nouns to `PLATFORM_CONCEPT`, artifact nouns to `ARTIFACT`.
