/**
 * Build a driver-agnostic QA *plan* from a scope + personas + target, and render
 * it as a Claude-ready markdown *brief*. The plan lists objectives (Claude
 * explores to satisfy them — it is not a brittle literal script); destructive
 * objectives are included only when the target is a test env and the developer
 * opted in. Pure; timestamps/ids are passed in so it stays deterministic.
 */
import { PlanStep, QaPlan, RunScope, QaTarget, Persona, RunAuthority } from './runTypes';

interface PlanInput {
  runId: string;
  createdAt: string;
  scope: RunScope;
  target: QaTarget;
  personas: Persona[];
  destructiveAllowed: boolean;
  authority: RunAuthority;
  /** Run directory relative to the workspace root, e.g. `.fuuz/qa/<tenant>/<runId>`. */
  runDir: string;
}

/**
 * Security & RBAC probe objectives — authorized testing of the developer's own
 * app to surface front-end access gaps. Even when a persona can't *navigate* to
 * a screen, these check whether the data/actions are actually protected
 * server-side (vs hidden only in the client) and whether inputs are sanitized.
 */
function securityObjectives(): PlanStep[] {
  return [
    { id: 'sec-forced-browse', title: 'Forced browsing', detail: 'Directly navigate to URLs/routes for screens this persona should NOT see. Confirm access is denied and no data leaks (a blank page that still loads data is a leak).' },
    { id: 'sec-client-rbac', title: 'Client-only RBAC', detail: 'Find actions hidden/disabled for this role (delete, approve, admin). Try to invoke them anyway via the UI and the underlying request. If the server allows it, that is an RBAC leak — record it.' },
    { id: 'sec-console-probe', title: 'Console / API probe', detail: 'In the browser console, call the app’s data APIs and try to read/mutate records the persona should not access. Note anything the server returns that the UI hid.', destructive: true },
    { id: 'sec-xss', title: 'XSS / input sanitization', detail: 'Enter payloads like `<img src=x onerror=alert(1)>` and `">` + script into text fields and filters. Verify they are escaped/sanitized and never execute.', destructive: true },
    { id: 'sec-injection', title: 'Injection in filters/inputs', detail: 'Submit SQL/NoSQL/template-style payloads in inputs and query filters. Verify they are rejected/parameterized, not interpreted.', destructive: true },
  ];
}

function baseSteps(scope: RunScope): PlanStep[] {
  const subject = scope.kind === 'app' ? `the "${scope.name}" application` : `the "${scope.name}" screen`;
  const steps: PlanStep[] = [
    { id: 'land', title: 'Verify landing', detail: `After the developer logs the persona in, confirm you land in ${subject} with no errors. Screenshot the initial state.` },
    { id: 'inventory', title: 'Inventory interactive elements', detail: 'Enumerate every actionable element (buttons, links, tabs, menus, filters, form fields) and what each is for.' },
    { id: 'read', title: 'Read / list data', detail: 'Confirm data renders correctly. Exercise empty, loading, and error states where reachable. Screenshot each.' },
    { id: 'navigate', title: 'Traverse navigation', detail: 'Visit every reachable screen/route from here. Record a GIF of the full walkthrough.' },
    { id: 'forms-valid', title: 'Forms — valid input', detail: 'Fill each form with representative valid data; verify inline behavior. Screenshot before/after.' },
    { id: 'forms-invalid', title: 'Forms — validation', detail: 'Submit invalid/empty/boundary input; verify clear, correct validation messaging.' },
    { id: 'create', title: 'Create a record', detail: 'Create a new record through the UI and confirm it persists and appears in lists.', destructive: true },
    { id: 'update', title: 'Update a record', detail: 'Edit a (test) record, save, and confirm the change persists.', destructive: true },
    { id: 'delete', title: 'Delete a record', detail: 'Delete a record you created in this run and confirm removal + any confirmation prompts.', destructive: true },
    { id: 'authz', title: 'Authorization for the persona', detail: 'Confirm the persona can do what its role allows and is blocked from what it should not — note any leaks.' },
    { id: 'console', title: 'Capture browser errors', detail: 'Throughout, capture Chrome console errors and failed network requests; attach to the relevant step.' },
    { id: 'ux', title: 'UI/UX grooming', detail: 'Assess affordance, action placement, navigation depth, data nesting/labels, consistency, and responsiveness. Give concrete, specific recommendations.' },
  ];
  return steps;
}

export function buildQaPlan(input: PlanInput): QaPlan {
  const keep = (s: PlanStep) => input.destructiveAllowed || !s.destructive;
  return {
    runId: input.runId,
    createdAt: input.createdAt,
    scope: input.scope,
    target: input.target,
    personas: input.personas,
    destructiveAllowed: input.destructiveAllowed,
    authority: input.authority,
    steps: baseSteps(input.scope).filter(keep),
    securitySteps: securityObjectives().filter(keep),
    runDir: input.runDir,
  };
}

function personaBlock(p: Persona, i: number): string {
  const bits = [`### Persona ${i + 1}: ${p.name}`];
  if (p.role) bits.push(`- Role: ${p.role}`);
  if (p.notes) bits.push(`- Notes: ${p.notes}`);
  return bits.join('\n');
}

/** Render the plan as a markdown brief to hand to Claude (Chrome or Code). */
export function planToBrief(plan: QaPlan): string {
  const L: string[] = [];
  L.push(`# QA Run — ${plan.scope.name}  (${plan.scope.kind})`);
  L.push('');
  L.push(`You are QA-testing a Fuuz ${plan.scope.kind}. Drive the running app in the browser and produce a thorough, evidence-backed report.`);
  L.push('');
  L.push(`## Target`);
  L.push(`- URL: ${plan.target.url || '(set the app URL)'}`);
  L.push(`- Environment: \`${plan.target.envSlug}\` ${plan.target.isTestEnv ? '(test environment ✓)' : '⚠️ does NOT look like a test environment'}`);
  if (plan.scope.model) L.push(`- Primary data model: \`${plan.scope.model}\``);
  if (plan.scope.screens?.length) L.push(`- Screens in scope: ${plan.scope.screens.join(', ')}`);
  L.push('');
  L.push(`## Safety`);
  if (plan.destructiveAllowed) {
    L.push(`- Destructive steps (create/update/delete) are **enabled** for this test environment. Only act on records you create during the run; never touch pre-existing production-like data.`);
  } else {
    L.push(`- Destructive steps are **disabled** — navigate, read, and fill forms but **do not** submit creates/updates/deletes.`);
  }
  L.push('');
  L.push(`## Authority`);
  if (plan.authority === 'autonomous') {
    L.push(`- **Autonomous — full authority.** Once the persona is logged in, act with **COMPLETE AUTHORITY** for that persona: click, fill, navigate, and (where enabled) create/update/delete **without asking for confirmation**. Do everything the checklist requires end-to-end. The **only** time you pause is the one-time login for each persona.`);
  } else {
    L.push(`- **Manual — supervised.** Confirm with me before each major step, and especially before any destructive action.`);
  }
  L.push('');
  L.push(`## Personas (test one at a time)`);
  L.push(`The developer logs each persona in manually in the browser (you do not have credentials). For each persona: ask me to log in, then run the full checklist + security probes as that persona, then stop for the next login.`);
  L.push('');
  plan.personas.forEach((p, i) => { L.push(personaBlock(p, i)); L.push(''); });
  L.push(`## Functional checklist (per persona)`);
  for (const s of plan.steps) {
    L.push(`- [ ] **${s.title}**${s.destructive ? ' _(destructive)_' : ''} — ${s.detail}`);
  }
  L.push('');
  if (plan.securitySteps.length) {
    L.push(`## Security & RBAC probes (per persona)`);
    L.push(`Authorized testing of this app to surface front-end access gaps. The goal is to find places where the UI *hides* something the server still permits — those are RBAC leaks to fix in the build. Record each as a defect with severity when the server allows what the role should not.`);
    for (const s of plan.securitySteps) {
      L.push(`- [ ] **${s.title}**${s.destructive ? ' _(submits payloads)_' : ''} — ${s.detail}`);
    }
    L.push('');
  }
  L.push(`## Capture`);
  L.push(`- Save ALL screenshots and walkthrough GIFs under \`${plan.runDir}/artifacts/\` — **never** the workspace root. The browser is already configured to write there; pass paths under \`${plan.runDir}/artifacts/\` for any file you save.`);
  L.push(`- Record Chrome console errors and failed network requests as you go.`);
  L.push(`- Fuuz-side logs (developer console, data-flow logs, span/trace logs, integration logs) are collected separately by the extension over MCP using the developer's connection and correlated to this run — note the run start/end times.`);
  L.push('');
  L.push(`## Report back (write \`${plan.runDir}/result.json\`)`);
  L.push(`When finished, write your results as JSON to \`${plan.runDir}/result.json\` in this exact shape so the extension can render them:`);
  L.push('```json');
  L.push(`{`);
  L.push(`  "summary": "one-paragraph overall assessment",`);
  L.push(`  "personas": [`);
  L.push(`    { "name": "Operator", "steps": [`);
  L.push(`      { "title": "Verify landing", "status": "pass|fail|skip|blocked", "notes": "...", "evidence": "artifacts/landing.png" }`);
  L.push(`    ] }`);
  L.push(`  ],`);
  L.push(`  "defects": [`);
  L.push(`    { "severity": "high|medium|low", "title": "...", "detail": "...", "fix": "...", "evidence": "artifacts/bug.png" }`);
  L.push(`  ],`);
  L.push(`  "uxNotes": [`);
  L.push(`    { "area": "navigation", "note": "...", "recommendation": "..." }`);
  L.push(`  ]`);
  L.push(`}`);
  L.push('```');
  L.push(`Evidence paths are relative to the run directory (e.g. \`artifacts/landing.png\`).`);
  L.push('');
  L.push(`_Run id: ${plan.runId} · generated ${plan.createdAt}_`);
  return L.join('\n');
}
