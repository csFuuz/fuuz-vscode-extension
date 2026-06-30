import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ConfigInbound,
  ConfigOutbound,
  EnterpriseView,
  ImportResultView,
  PanelState,
  ProbeView,
  ProviderView,
  TenantView,
} from './protocol';
import './styles.css';

declare function acquireVsCodeApi(): { postMessage(msg: ConfigInbound): void };
const vscode = acquireVsCodeApi();
const post = (m: ConfigInbound) => vscode.postMessage(m);

type ProbeStatus = Record<string, { probes: ProbeView[]; message?: string }>;

function ProbeBadges({ probes }: { probes: ProbeView[] }) {
  return (
    <span className="probes">
      {probes.map((p, i) => {
        const ok = p.state === 'available';
        const title = `${p.url}\n→ ${p.detail || p.state}${p.status ? ` (HTTP ${p.status})` : ''}`;
        return (
          <span key={i} className={`ep ${ok ? 'ok' : 'fail'}`} title={title}>
            {p.label} {ok ? '✓' : '✗'}
          </span>
        );
      })}
    </span>
  );
}

function AddByKeyCard({ result }: { result: ImportResultView | { error: string } | null }) {
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Clear the field once an import succeeds.
  useEffect(() => {
    if (result && 'tenantName' in result) {
      setToken('');
      setSubmitting(false);
    } else if (result && 'error' in result) {
      setSubmitting(false);
    }
  }, [result]);

  const submit = () => {
    const t = token.trim();
    if (!t) return;
    setSubmitting(true);
    post({ type: 'addByToken', token: t });
  };

  return (
    <div className="card">
      <h2>Add a connection</h2>
      <div className="muted">
        Paste an API key — the tenant, enterprise and environment are detected from it, and every endpoint is tested.
      </div>
      <label>API key</label>
      <input
        type="password"
        placeholder="eyJhbGciOi…"
        value={token}
        onChange={e => setToken(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
      />
      <div className="form-actions">
        <button onClick={submit} disabled={submitting}>{submitting ? 'Validating…' : 'Add & test'}</button>
      </div>
      {result && 'tenantName' in result && (
        <div>
          <div className="ok">Added {result.enterpriseName} › {result.tenantName}</div>
          <ProbeBadges probes={result.probes} />
        </div>
      )}
      {result && 'error' in result && <div className="fail">{result.error}</div>}
    </div>
  );
}

function TenantRow({ enterprise, tenant, status }: { enterprise: EnterpriseView; tenant: TenantView; status?: { probes: ProbeView[]; message?: string } }) {
  const ds = { enterpriseId: enterprise.id, tenantId: tenant.id };
  return (
    <div className={`tenant${tenant.disabled ? ' off' : ''}`}>
      <span className="name">{tenant.name}</span>
      {tenant.active && !tenant.disabled && <span className="badge active">active</span>}
      {tenant.disabled && <span className="badge">disabled</span>}
      <span className="badge">{tenant.hasToken ? 'token set' : 'no token'}</span>
      {status && (status.message
        ? <span className="status fail">{status.message}</span>
        : <ProbeBadges probes={status.probes} />)}
      <span className="spacer" />
      {!tenant.active && !tenant.disabled && (
        <button className="secondary" onClick={() => post({ type: 'setActive', ...ds })}>Set active</button>
      )}
      <button className="secondary" onClick={() => post({ type: 'test', ...ds })}>Test</button>
      <button className="secondary" onClick={() => post({ type: 'replaceKey', ...ds })}>Replace key</button>
      <button className="secondary" onClick={() => post({ type: 'setDisabled', ...ds, disabled: !tenant.disabled })}>
        {tenant.disabled ? 'Enable' : 'Disable'}
      </button>
      <button className="danger" title="Remove tenant" onClick={() => post({ type: 'removeTenant', ...ds })}>✕</button>
    </div>
  );
}

function EnterpriseCard({ enterprise, probeStatus }: { enterprise: EnterpriseView; probeStatus: ProbeStatus }) {
  const ep = enterprise.endpoints;
  return (
    <div className="card">
      <div className="ent-head">
        <div>
          <h2>{enterprise.name}</h2>
          <div className="muted">{enterprise.environment ? `env: ${enterprise.environment}` : 'no environment set'}</div>
        </div>
        <button className="danger" onClick={() => post({ type: 'removeEnterprise', id: enterprise.id })}>Remove</button>
      </div>

      <table className="endpoints">
        <tbody>
          <tr><td>MCP</td><td>{ep.mcp}</td></tr>
          <tr><td>Flow execution</td><td>{ep.flowExecution}</td></tr>
          <tr><td>Webhook</td><td>{ep.webhook}<span className="muted">{'{topic}'}</span></td></tr>
        </tbody>
      </table>

      <div className="tenants">
        {enterprise.tenants.length === 0
          ? <div className="muted" style={{ padding: '8px 0' }}>No tenants yet.</div>
          : enterprise.tenants.map(t => (
              <TenantRow key={t.id} enterprise={enterprise} tenant={t} status={probeStatus[t.id]} />
            ))}
      </div>
    </div>
  );
}

function ProvidersCard({ providers }: { providers: ProviderView[] }) {
  return (
    <div className="card">
      <div className="ent-head">
        <div>
          <h2>AI providers</h2>
          <div className="muted">
            Which AI hosts the Fuuz MCP servers are wired into. Enable any number — each is independent.
          </div>
        </div>
      </div>
      {providers.map(p => (
        <div key={p.id} className={`tenant${p.enabled ? '' : ' off'}`}>
          <span className="name">{p.label}</span>
          {p.enabled && <span className="badge active">enabled</span>}
          {p.usesOAuth && (
            <span className={`badge${p.signedIn ? ' active' : ''}`}>
              {p.signedIn ? `signed in${p.account ? `: ${p.account}` : ''}` : 'not signed in'}
            </span>
          )}
          <span className="muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.description}
          </span>
          {p.usesOAuth && (p.signedIn
            ? <button className="secondary" onClick={() => post({ type: 'signOutProvider', id: p.id })}>Sign out</button>
            : <button className="secondary" onClick={() => post({ type: 'signInProvider', id: p.id })}>Sign in</button>
          )}
          <button className="secondary" onClick={() => post({ type: 'setProviderEnabled', id: p.id, enabled: !p.enabled })}>
            {p.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      ))}
    </div>
  );
}

function AgentToolsCard({ at }: { at: NonNullable<PanelState['activeTools']> }) {
  return (
    <div className="card">
      <div className="ent-head">
        <div>
          <h2>Agent Tools — {at.tenantName}</h2>
          <div className="muted">Tools the MCP server exposes to agents. Disable any you don't want agents to use.</div>
        </div>
        <button onClick={() => post({ type: 'createTool' })}>+ Create New Tool</button>
      </div>
      <div className="muted" style={{ margin: '6px 0' }}>
        Disabling re-registers this connection through a local <b>gating proxy</b> that hides the tool from{' '}
        <code>tools/list</code> and blocks calls to it — enforced, not just advisory. (Reload the MCP server / window to apply.)
      </div>
      {at.items.length === 0
        ? <div className="muted">No tools — sync the tenant first.</div>
        : at.items.map(t => (
            <div key={t.name} className={`tenant${t.enabled ? '' : ' off'}`}>
              <span className="name">{t.name}</span>
              <span className={t.kind === 'dataflow' ? 'badge active' : 'badge'}>{t.kind === 'dataflow' ? 'custom' : 'system'}</span>
              <span className="muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.description || ''}
              </span>
              <button
                className="secondary"
                onClick={() => post({ type: 'setToolEnabled', enterpriseId: at.enterpriseId, tenantId: at.tenantId, name: t.name, enabled: !t.enabled })}
              >{t.enabled ? 'Disable' : 'Enable'}</button>
            </div>
          ))}
    </div>
  );
}

function App() {
  const [state, setState] = useState<PanelState>({ enterprises: [], providers: [] });
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>({});
  const [importResult, setImportResult] = useState<ImportResultView | { error: string } | null>(null);
  const logo = document.getElementById('root')?.dataset.logo;

  useEffect(() => {
    const onMsg = (ev: MessageEvent<ConfigOutbound>) => {
      const m = ev.data;
      if (m.type === 'state') {
        setState(m.state);
      } else if (m.type === 'probeResult') {
        setProbeStatus(prev => ({ ...prev, [m.tenantId]: { probes: m.probes || [], message: m.message } }));
      } else if (m.type === 'importResult') {
        if (m.ok && m.result) {
          setImportResult(m.result);
          setProbeStatus(prev => ({ ...prev, [m.result!.tenantId]: { probes: m.result!.probes } }));
        } else {
          setImportResult({ error: m.message || 'Import failed' });
        }
      }
    };
    window.addEventListener('message', onMsg);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <>
      <header>
        {logo && <img src={logo} alt="Fuuz" />}
        <div>
          <h1>Connections</h1>
          <div className="sub">Add a connection by API key. Tokens are stored securely and registered as MCP servers for your AI copilot.</div>
        </div>
      </header>
      <AddByKeyCard result={importResult} />
      {state.providers?.length ? <ProvidersCard providers={state.providers} /> : null}
      {state.enterprises.map(e => (
        <EnterpriseCard key={e.id} enterprise={e} probeStatus={probeStatus} />
      ))}
      {state.activeTools && <AgentToolsCard at={state.activeTools} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
