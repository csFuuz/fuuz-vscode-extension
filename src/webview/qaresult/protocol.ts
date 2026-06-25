/**
 * Message contract for the QA result view. Pure types shared by the panel host
 * ([qa/qaResultPanel.ts]) and the React app ([webview/qaresult/index.tsx]).
 * Merges the agent's structured result with the Fuuz logs collected over MCP.
 */
import type { QaResult } from '../../qa/resultTypes';
import type { CollectedLog } from '../../qa/logCollector';

export interface QaResultPayload {
  runId: string;
  scopeName: string;
  target: { url: string; envSlug: string };
  /** Whether the agent has written result.json yet. */
  hasResult: boolean;
  /** Normalized result (empty arrays when not yet available). */
  result: QaResult;
  /** Fuuz-side logs for the run window (empty if not collected). */
  logs: CollectedLog[];
  hasLogs: boolean;
}

/** Extension → webview. */
export type QaResultOutbound = { type: 'data'; payload: QaResultPayload };

/** Webview → extension. */
export type QaResultInbound =
  | { type: 'ready' }
  | { type: 'openFile'; path: string };
