/**
 * Build a driver-agnostic QA *plan* from a scope + personas + target, and render
 * it as a Claude-ready markdown *brief*. The plan lists objectives (Claude
 * explores to satisfy them — it is not a brittle literal script); destructive
 * objectives are included only when the target is a test env and the developer
 * opted in. Pure; timestamps/ids are passed in so it stays deterministic.
 */
import { PlanStep, QaPlan, RunScope, QaTarget, Persona } from './runTypes';

interface PlanInput {
  runId: string;
  createdAt: string;
  scope: RunScope;
  target: QaTarget;
  personas: Persona[];
  destructiveAllowed: boolean;
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
  const steps = baseSteps(input.scope).filter(s => input.destructiveAllowed || !s.destructive);
  return {
    runId: input.runId,
    createdAt: input.createdAt,
    scope: input.scope,
    target: input.target,
    personas: input.personas,
    destructiveAllowed: input.destructiveAllowed,
    steps,
    artifactsDir: `.fuuz/qa/${input.runId}`,
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
  L.push(`## Personas (test one at a time)`);
  L.push(`The developer will log each persona in manually in the browser, then tell you to proceed. For each persona below, run the full checklist, then stop and wait for the next login.`);
  L.push('');
  plan.personas.forEach((p, i) => { L.push(personaBlock(p, i)); L.push(''); });
  L.push(`## Checklist (per persona)`);
  for (const s of plan.steps) {
    L.push(`- [ ] **${s.title}**${s.destructive ? ' _(destructive)_' : ''} — ${s.detail}`);
  }
  L.push('');
  L.push(`## Capture`);
  L.push(`- Save screenshots and walkthrough GIFs under \`${plan.artifactsDir}/\` (per persona).`);
  L.push(`- Record Chrome console errors and failed network requests as you go.`);
  L.push(`- Fuuz-side logs (developer console, data-flow logs, span/trace logs, integration logs) are collected separately by the extension over MCP using the developer's connection and correlated to this run — note the run start/end times.`);
  L.push('');
  L.push(`## Report back (structured)`);
  L.push(`For each persona and step: pass/fail, evidence (screenshot/GIF path), and any errors. Then: a prioritized list of defects with fix recommendations, and UI/UX grooming notes with concrete, specific suggestions.`);
  L.push('');
  L.push(`_Run id: ${plan.runId} · generated ${plan.createdAt}_`);
  return L.join('\n');
}
