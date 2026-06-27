/**
 * Adapt `DataFlowElement` records (a flow's nodes, read over MCP) into the
 * analyzer's {@link FlowGraph}. The exact field names vary, so the command
 * discovers the model's fields at runtime and passes the ones that exist; this
 * module is the pure mapping (testable) plus the field-selection + type
 * normalization helpers.
 */
import { FlowGraph, FlowNode, FlowNodeType } from './flowTypes';

type Rec = Record<string, string>;

/** Candidate field names per concept (first that exists wins). */
export const FLOW_FIELD_CANDIDATES = {
  name: ['name', 'label', 'title'],
  description: ['description', 'desc', 'notes'],
  typeLabel: ['dataFlowElementType', 'elementType', 'nodeType', 'type', 'kind'],
  typeId: ['dataFlowElementTypeId', 'elementTypeId'],
  script: ['script', 'code', 'body', 'scriptBody', 'source'],
  branchCount: ['branchCount', 'branches'],
  collectCount: ['collectCount', 'payloads', 'payloadCount'],
  query: ['query', 'queryModel', 'savedQueryId'],
  flowFk: ['dataFlowId', 'dataFlowVersionId'],
} as const;

const first = (rec: Rec, names: readonly string[]): string | undefined => {
  for (const n of names) if (rec[n] != null && rec[n] !== '') return rec[n];
  return undefined;
};
const firstExisting = (available: Set<string>, names: readonly string[]): string | undefined =>
  names.find(n => available.has(n));

/** The DataFlowElement fields to request, given what the model actually exposes. */
export function chooseFlowFields(available: string[]): string[] {
  const set = new Set(available);
  const wanted = new Set<string>(['id']);
  for (const names of Object.values(FLOW_FIELD_CANDIDATES)) {
    const f = firstExisting(set, names);
    if (f) wanted.add(f);
  }
  return [...wanted];
}

/** The foreign-key field linking an element to its flow (for the `where` filter). */
export function flowFkField(available: string[]): string | undefined {
  return firstExisting(new Set(available), FLOW_FIELD_CANDIDATES.flowFk);
}

/** Normalize a raw node-type label to a {@link FlowNodeType}. */
export function normalizeNodeType(raw: string | undefined): FlowNodeType {
  const s = (raw ?? '').toLowerCase();
  if (/broadcast/.test(s)) return 'broadcast';
  if (/collect/.test(s)) return 'collect';
  if (/branch|split|switch|condition|decision/.test(s)) return 'branch';
  if (/delay|wait|sleep/.test(s)) return 'delay';
  if (/integrat/.test(s)) return 'integration';
  if (/error|catch|fault|exception/.test(s)) return 'errorResponse';
  if (/script|code|function|transform/.test(s)) return 'script';
  if (/quer|read|fetch|select|lookup/.test(s)) return 'query';
  if (/start|trigger|input|begin|entry/.test(s)) return 'start';
  if (/output|response|return|end|result|publish/.test(s)) return 'output';
  return 'other';
}

const toNum = (v: string | undefined): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Map element rows to a FlowGraph. `typeLabels` resolves a `*TypeId` to a
 * human label when the element only carries the FK.
 */
export function adaptFlowElements(
  flowName: string,
  flowType: string | undefined,
  rows: Rec[],
  available: string[],
  typeLabels?: Map<string, string>
): FlowGraph {
  const set = new Set(available);
  const fName = firstExisting(set, FLOW_FIELD_CANDIDATES.name);
  const fDesc = firstExisting(set, FLOW_FIELD_CANDIDATES.description);
  const fTypeLabel = firstExisting(set, FLOW_FIELD_CANDIDATES.typeLabel);
  const fTypeId = firstExisting(set, FLOW_FIELD_CANDIDATES.typeId);
  const fScript = firstExisting(set, FLOW_FIELD_CANDIDATES.script);
  const fQuery = firstExisting(set, FLOW_FIELD_CANDIDATES.query);
  const fBranch = firstExisting(set, FLOW_FIELD_CANDIDATES.branchCount);
  const fCollect = firstExisting(set, FLOW_FIELD_CANDIDATES.collectCount);

  const nodes: FlowNode[] = rows.map((r, i) => {
    const rawType =
      (fTypeLabel && r[fTypeLabel]) ||
      (fTypeId && typeLabels?.get(r[fTypeId])) ||
      (fTypeId && r[fTypeId]) ||
      '';
    return {
      id: r.id || `el-${i}`,
      name: fName ? first(r, [fName]) : undefined,
      description: fDesc ? first(r, [fDesc]) : undefined,
      type: normalizeNodeType(rawType),
      rawType: rawType || undefined,
      script: fScript ? first(r, [fScript]) : undefined,
      query: fQuery ? first(r, [fQuery]) : undefined,
      branchCount: fBranch ? toNum(r[fBranch]) : undefined,
      collectCount: fCollect ? toNum(r[fCollect]) : undefined,
    };
  });
  return { name: flowName, type: flowType, nodes };
}
