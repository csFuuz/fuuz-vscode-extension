# Verifying, and reporting honestly

The browser tells you what rendered. It does not tell you what persisted. Those
are different claims, and only one of them is what "it works" usually means.

## Read the record back

After any save or deploy, query the artefact over the Fuuz MCP and assert on the
field you changed:

| you changed | read back | assert |
| --- | --- | --- |
| a data model | `DataModelVersion.modelDefinition` | the field exists, with the type/`metadata.mfgx.idField` you set |
| a relation | the **child** model's definition | the FK exists and is `ID`/`ID!` — never `String` |
| a flow | `DataFlowVersion.flow` | the node is present, and `flow.id === <versionId>` |
| a screen | `ScreenVersion.design` | the element is in the node map, with its `dataPath` and `label` |
| a deploy | introspect the deployed type | **every** expected field name is present |

Two specific traps worth asserting for by name:

- **`flow.id` must equal the version id.** A designer save gets this right;
  hand-authored flows must `create → update with flow.id = versionId → deploy`.
  Wrong, and every `executeFlow` hangs to the 300 s gateway timeout with no
  error — which reads as a logic bug and is not one. Assert it *before* calling,
  so a hang is never misdiagnosed.
- **Reverse collections drop silently.** Introspect for them; their absence is
  not reported anywhere else.

## Then run it

A deployed screen that renders is still only half the claim. Drive the thing the
user will drive:

1. Open `/system/configuration/screens/<versionId>/run` (twice — a cold load
   redirects to the app route and only sticks on the second navigation).
2. Assert the shell rendered and it is not a login form.
3. Read the row count / field values from the DOM, not from the query you *think*
   is behind them.
4. Do the action — save the form, submit, filter — and read the record back.
5. Collect the browser console. A GraphQL error returns **HTTP 200** with
   `errors[]` in the body, so a green network tab proves nothing.

## The Dev Console MCP, when there is one

`apps/dev-console` exposes the running screen's own diagnostics as tools — the
classified execution log, the state tree, the write chain behind any value, and a
JSONata evaluator bound to the **live** context. When those tools are available,
prefer them over re-deriving meaning from raw console lines:

| tool | answers |
| --- | --- |
| `fuuz_screen_status` | is anything actually captured, and from where |
| `fuuz_screen_issues` | ranked problems, each with the trace that evidences it |
| `fuuz_screen_trace` | which writes produced this value |
| `fuuz_screen_state` | the state tree, or one subtree |
| `fuuz_screen_eval` | JSONata against the state the screen is holding right now |

Two things it cannot see, and must be said rather than assumed:

- **A result-cache hit returns before the logging call**, so an unchanged
  transform logs nothing. Anything counting re-runs undercounts. Reload for a
  cold evaluation.
- **A designer run leaves no server record.** The data never exists outside the
  tab, so client capture is the only capture — if you did not have it open, it is
  gone.

## Screenshots

Take them at decision points, not continuously: the rendered screen, the state
that proves the action, the error if there is one.

```bash
node .fuuz/ui/fuuz-ui.cjs shot '<url>' .fuuz/ui/shots/asset-intake-loaded.png
```

Name them for what they show. Keep them out of the repo root — `.fuuz/ui/shots/`
is gitignored. Attach them to the report, and **say what each one demonstrates**;
an unlabelled screenshot is decoration. And check them for tokens and customer
data before they leave the machine.

## Report

Three sentences, in this order:

1. **What you verified, and how** — "the table renders 12 rows; asserted against
   `AssetNode` returning 12".
2. **What you did not** — "did not test Save, or any role other than admin".
3. **What is wrong, if anything** — with the evidence, not the impression.

Never write "validated" for something you only saw render. If the session expired
mid-run, that is the whole report: say the session died, say which steps
completed, and do not present the empty reads as findings. Every convincing wrong
answer in this workflow's history came from a probe that kept going after the
login form appeared.
