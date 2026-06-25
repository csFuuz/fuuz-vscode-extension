/**
 * Message contract for the QA report webview. Pure types shared by the panel
 * host ([qa/reportPanel.ts]) and the React app ([webview/report/index.tsx]).
 * Reuses the vscode-free {@link ComplianceReport} from the compliance engine,
 * and is shaped to also carry browser-QA run results later (Pillar 2).
 */
import type { ComplianceReport } from '../../qa/complianceTypes';

/** Extension → webview. */
export type ReportOutbound = { type: 'report'; report: ComplianceReport };

/** Webview → extension. */
export type ReportInbound =
  | { type: 'ready' }
  | { type: 'recheck' };
