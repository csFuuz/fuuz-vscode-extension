import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ComplianceReport, Finding, Severity } from '../../qa/complianceTypes';
import type { ReportInbound, ReportOutbound } from './protocol';
import './styles.css';

declare function acquireVsCodeApi(): { postMessage(msg: ReportInbound): void };
const vscode = acquireVsCodeApi();
const post = (m: ReportInbound) => vscode.postMessage(m);

const SEV_ICON: Record<Severity, string> = { error: '🔴', warn: '🟡', info: '🔵' };
const SEV_CLASS: Record<Severity, string> = { error: 'sev-error', warn: 'sev-warn', info: 'sev-info' };

function Gauge({ score }: { score: number }) {
  const r = 36, c = 2 * Math.PI * r;
  const cls = score >= 90 ? 'arc-good' : score >= 80 ? 'arc-ok' : 'arc-bad';
  const dash = `${(score / 100) * c} ${c}`;
  return (
    <div className="gauge">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle className="track" cx="42" cy="42" r={r} fill="none" strokeWidth="8" />
        <circle className={cls} cx="42" cy="42" r={r} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={dash} />
      </svg>
      <div className="num">{score}%</div>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  return (
    <div className="finding">
      <span className={`sev ${SEV_CLASS[f.severity]}`}>{SEV_ICON[f.severity]}</span>
      <div className="body">
        <div className="msg">
          {f.message}
          {f.where && <span className="where">{f.where}</span>}
        </div>
        {f.fix && <div className="fix">Fix: {f.fix}</div>}
      </div>
    </div>
  );
}

function verdict(score: number): string {
  if (score >= 100) return 'Fully compliant';
  if (score >= 90) return 'Compliant — minor notes';
  if (score >= 80) return 'Mostly compliant';
  return 'Needs work';
}

function App() {
  const [report, setReport] = useState<ComplianceReport | null>(null);

  useEffect(() => {
    const onMsg = (ev: MessageEvent<ReportOutbound>) => {
      if (ev.data.type === 'report') setReport(ev.data.report);
    };
    window.addEventListener('message', onMsg);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!report) return <div className="muted" style={{ padding: 24 }}>Loading report…</div>;

  const counts = { error: 0, warn: 0, info: 0 } as Record<Severity, number>;
  for (const f of report.findings) counts[f.severity]++;

  return (
    <>
      <header>
        <Gauge score={report.score} />
        <div style={{ flex: 1 }}>
          <h1>{report.name} — {verdict(report.score)}</h1>
          <div className="sub">{report.passed}/{report.checks} checks passed · kind: {report.kind}</div>
          <div className="counts">
            <span className="count sev-error"><b>{counts.error}</b> errors</span>
            <span className="count sev-warn"><b>{counts.warn}</b> warnings</span>
            <span className="count sev-info"><b>{counts.info}</b> info</span>
          </div>
        </div>
        <button onClick={() => post({ type: 'recheck' })}>Re-check</button>
      </header>

      <h2>Findings</h2>
      {report.findings.length === 0
        ? <div className="empty">✅ Every check passed.</div>
        : report.findings.map((f, i) => <FindingRow key={i} f={f} />)}

      <h2>Rules</h2>
      <table className="rules">
        <thead><tr><th>Rule</th><th className="num">Checks</th><th className="num">Passed</th></tr></thead>
        <tbody>
          {report.rules.map(r => (
            <tr key={r.ruleId} className={r.passed < r.checks ? 'rule-fail' : ''}>
              <td>{r.title}</td>
              <td className="num">{r.checks}</td>
              <td className="num">{r.passed}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="footer">Fuuz Schema Doctor — a local check of platform conventions before you push to Fuuz.</div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
