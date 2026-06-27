/**
 * Collect Fuuz-side logs for a QA run window over MCP (the developer's
 * connection — the persona under test may lack log access). Correlation is by
 * time window, since the browser session's trace ids aren't known extension-side.
 *
 * The shapers are pure; `collectFuuzLogs` takes an injected `query` fn so it is
 * testable without VS Code/MCP. The caller wires `query` to
 * `TenantDataService.queryModel`.
 */
import { Severity } from './complianceTypes';
import { FindingSource } from './runTypes';

export interface LogWindow {
  startIso: string;
  endIso: string;
}

export interface CollectedLog {
  source: FindingSource;
  severity: Severity;
  message: string;
  at?: string;
  /** Where it came from — node name, screen, connection, etc. */
  where?: string;
}

/** A record query, injected so the collector stays testable. */
export type LogQueryFn = (modelName: string, fields: string[], where: string) => Promise<Record<string, string>[]>;

type Rec = Record<string, string>;
const has = (s: string | undefined, re: RegExp) => !!s && re.test(s);
const ERR = /error|fail|exception|denied|invalid/i;
const WARN = /warn|deprecat|retry|slow/i;

/** Heuristic severity from a log message (data-flow logs carry no explicit level here). */
function severityFromText(...parts: (string | undefined)[]): Severity {
  const t = parts.filter(Boolean).join(' ');
  if (has(t, ERR)) return 'error';
  if (has(t, WARN)) return 'warn';
  return 'info';
}

export function shapeSpanLogs(rows: Rec[]): CollectedLog[] {
  return rows.map(r => ({
    source: 'fuuz-spanlog' as FindingSource,
    severity: severityFromText(r.eventType, r.topic),
    message: [r.eventType, r.topic].filter(Boolean).join(' · ') || 'span event',
    at: r.createdAt,
    where: r.url || undefined,
  }));
}

export function shapeIntegrationLogs(rows: Rec[]): CollectedLog[] {
  return rows.map(r => ({
    source: 'integration-log' as FindingSource,
    severity: r.error ? 'error' : 'info',
    message: r.error || `${r.connectionName || 'integration'} ${r.responseTime ? `(${r.responseTime}ms)` : ''}`.trim(),
    at: r.requestTimestamp,
    where: r.requestName || r.connectionName || undefined,
  }));
}

interface SourceDef {
  model: string;
  tsField: string;
  fields: string[];
  shape: (rows: Rec[]) => CollectedLog[];
}

// Runtime sources only. (DataFlowDeploymentLog is *deploy-time* build noise —
// addVersion / version-validation — unrelated to a browser QA run; runtime flow
// activity already shows up in ApplicationSpanEventLog via dataFlowId spans.)
export const LOG_SOURCES: SourceDef[] = [
  { model: 'ApplicationSpanEventLog', tsField: 'createdAt', fields: ['id', 'eventType', 'topic', 'url', 'executionTime', 'createdAt'], shape: shapeSpanLogs },
  { model: 'IntegrationRequestLog', tsField: 'requestTimestamp', fields: ['id', 'error', 'connectionName', 'requestName', 'responseTime', 'requestTimestamp'], shape: shapeIntegrationLogs },
];

/**
 * Pull and shape logs from every source for the window. Each source degrades
 * independently — if a query fails (e.g. the timestamp field isn't filterable
 * for that tenant), that source is skipped and noted, not fatal.
 */
export async function collectFuuzLogs(
  query: LogQueryFn,
  window: LogWindow,
  onSkip?: (model: string, err: unknown) => void
): Promise<CollectedLog[]> {
  const out: CollectedLog[] = [];
  for (const src of LOG_SOURCES) {
    const where = JSON.stringify({ [src.tsField]: { _gte: window.startIso, _lte: window.endIso } });
    try {
      const rows = await query(src.model, src.fields, where);
      out.push(...src.shape(rows));
    } catch (err) {
      onSkip?.(src.model, err);
    }
  }
  // Surface errors first, then warnings, then info; newest within a level last.
  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
