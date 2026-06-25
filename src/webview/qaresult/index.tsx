import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { resultTotals } from '../../qa/resultTypes';
import type { QaResultInbound, QaResultOutbound, QaResultPayload } from './protocol';
import './styles.css';

declare function acquireVsCodeApi(): { postMessage(msg: QaResultInbound): void };
const vscode = acquireVsCodeApi();
const post = (m: QaResultInbound) => vscode.postMessage(m);

function Evidence({ path }: { path?: string }) {
  if (!path) return null;
  return <a className="link" onClick={() => post({ type: 'openFile', path })}>{path}</a>;
}

function App() {
  const [p, setP] = useState<QaResultPayload | null>(null);
  useEffect(() => {
    const onMsg = (ev: MessageEvent<QaResultOutbound>) => {
      if (ev.data.type === 'data') setP(ev.data.payload);
    };
    window.addEventListener('message', onMsg);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!p) return <div className="muted" style={{ padding: 24 }}>Loading…</div>;

  const t = resultTotals(p.result);
  return (
    <>
      <header>
        <h1>QA Result — {p.scopeName}</h1>
        <div className="sub">{p.runId} · {p.target.url} (<span>{p.target.envSlug}</span>)</div>
        {p.hasResult && (
          <div className="banner">
            <span className="stat"><b>{t.steps}</b> steps</span>
            <span className="stat ok"><b>{t.passed}</b> passed</span>
            <span className="stat bad"><b>{t.failed}</b> failed</span>
            <span className="stat"><b>{t.defects}</b> defects</span>
          </div>
        )}
      </header>

      {!p.hasResult && (
        <div className="empty">
          No <code>result.json</code> yet — run the brief with <b>Run QA in Browser</b>; the agent writes results when it finishes.
          {p.hasLogs ? ' Showing the Fuuz logs collected so far below.' : ''}
        </div>
      )}

      {p.result.summary && <p className="summary">{p.result.summary}</p>}

      {p.result.personas.map((persona, i) => (
        <section key={i}>
          <h3>{persona.name}</h3>
          {persona.steps.length === 0 ? <div className="muted">No steps recorded.</div> : persona.steps.map((s, j) => (
            <div className="row" key={j}>
              <span className={`badge b-${s.status}`}>{s.status}</span>
              <div className="main">
                <div>{s.title}</div>
                {s.notes && <div className="detail">{s.notes}</div>}
                {s.evidence && <div className="detail"><Evidence path={s.evidence} /></div>}
              </div>
            </div>
          ))}
        </section>
      ))}

      {p.result.defects.length > 0 && (
        <>
          <h2>Defects</h2>
          {p.result.defects.map((d, i) => (
            <div className="row" key={i}>
              <span className={`sev-${d.severity}`}>{d.severity.toUpperCase()}</span>
              <div className="main">
                <div><b>{d.title}</b></div>
                {d.detail && <div className="detail">{d.detail}</div>}
                {d.fix && <div className="fix"><b>Fix:</b> {d.fix}</div>}
                {d.evidence && <div className="detail"><Evidence path={d.evidence} /></div>}
              </div>
            </div>
          ))}
        </>
      )}

      {p.result.uxNotes.length > 0 && (
        <>
          <h2>UI/UX Grooming</h2>
          {p.result.uxNotes.map((n, i) => (
            <div className="row" key={i}>
              <div className="main">
                <div>{n.area ? <b>{n.area}: </b> : null}{n.note}</div>
                {n.recommendation && <div className="fix"><b>Recommend:</b> {n.recommendation}</div>}
              </div>
            </div>
          ))}
        </>
      )}

      <h2>Fuuz logs ({p.logs.length})</h2>
      {p.logs.length === 0
        ? <div className="empty">No Fuuz logs collected. Use <b>Collect Fuuz Logs for Run</b>.</div>
        : p.logs.map((l, i) => (
            <div className="row" key={i}>
              <span className={`log-src s-${l.severity}`}>{l.source}</span>
              <div className="main">
                <div className={`s-${l.severity}`}>{l.message}</div>
                {(l.where || l.at) && <div className="where">{[l.where, l.at].filter(Boolean).join(' · ')}</div>}
              </div>
            </div>
          ))}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
