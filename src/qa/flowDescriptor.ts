/**
 * Adapt decoded `DataFlowElement` records into the analyzer's {@link FlowGraph}.
 * `DataFlowElement` is a stable platform (system) model, so the field set is
 * known: `id, name, type, description, configuration`. The `type` string maps to
 * a {@link FlowNodeKind} and the type-specific `configuration` object yields the
 * per-node details the rules need. Pure + testable.
 */
import { FlowGraph, FlowNode, FlowNodeKind, FlowVersionInfo } from './flowTypes';

/** The DataFlowElement fields to request over MCP. */
export const FLOW_ELEMENT_FIELDS = ['id', 'name', 'type', 'description', 'configuration'];

const KIND_BY_TYPE: Record<string, FlowNodeKind> = {
  request: 'entry', schedule: 'entry', when: 'entry', dataChanges: 'entry',
  fork: 'fork', collect: 'collect', ifElse: 'ifElse', switch: 'switch',
  javascriptTransform: 'inlineScript', transform: 'jsonata', savedTransformV2: 'savedTransform',
  query: 'query', mutate: 'mutate', http: 'http',
  tryCatch: 'tryCatch', throwError: 'throwError', response: 'response',
  executeFlow: 'executeFlow', validate: 'validate', log: 'log',
};

const asObj = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {});
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** Map one decoded DataFlowElement row to a FlowNode. */
export function adaptFlowElement(row: Record<string, any>, i: number): FlowNode {
  const rawType = String(row.type ?? '').trim();
  const kind = KIND_BY_TYPE[rawType] ?? 'other';
  const cfg = asObj(row.configuration);

  const node: FlowNode = {
    id: String(row.id ?? `el-${i}`),
    name: str(row.name),
    description: str(row.description),
    rawType,
    kind,
    config: cfg,
  };

  switch (kind) {
    case 'entry':
      node.entryType = rawType;
      break;
    case 'fork':
      node.branchCount = arr(cfg.branches).length || undefined;
      break;
    case 'switch':
      node.branchCount = arr(cfg.branches).length || undefined;
      break;
    case 'collect': {
      const n = Number(cfg.batchCount);
      node.collectBatchCount = Number.isFinite(n) ? n : undefined;
      break;
    }
    case 'inlineScript':
    case 'jsonata':
      node.script = str(cfg.transform) ?? str(cfg.script);
      break;
    case 'savedTransform': {
      const ref = asObj(cfg.transformId);
      node.savedRef = { id: str(ref.id), name: str(ref.name) ?? str(ref.label), language: str(ref.scriptLanguageId) ?? str(cfg.transformScriptLanguage) };
      node.requestTransform = str(cfg.requestTransform);
      break;
    }
    case 'query':
      node.query = str(cfg.query);
      node.variablesTransform = str(cfg.variablesTransform);
      node.queryApi = str(cfg.api);
      break;
    case 'http':
      node.connectionName = str(cfg.connectionName);
      break;
  }
  return node;
}

/** Map all of a flow's element rows + metadata into a FlowGraph. */
export function adaptFlow(
  meta: { id: string; name: string; type?: string; versions?: FlowVersionInfo[] },
  rows: Record<string, any>[]
): FlowGraph {
  return {
    id: meta.id,
    name: meta.name,
    type: meta.type,
    versions: meta.versions,
    nodes: rows.map(adaptFlowElement),
  };
}
