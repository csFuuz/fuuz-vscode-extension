import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react';
import { EntityNode, type EntityData } from './EntityNode';
import { layout, COLLAPSED_W, COLLAPSED_H } from './layout';
import type { ErdGraph, ErdInbound, ErdOutbound, ErdField, ErdService } from '../../util/erdTypes';
import './styles.css';

declare function acquireVsCodeApi(): {
  postMessage(msg: ErdOutbound): void;
  getState(): any;
  setState(state: any): void;
};
const vscode = acquireVsCodeApi();
const post = (m: ErdOutbound) => vscode.postMessage(m);

const nodeTypes = { entity: EntityNode };
type Pos = Record<string, { x: number; y: number }>;

function Erd() {
  const [title, setTitle] = useState('ERD');
  const [graph, setGraph] = useState<ErdGraph>({ nodes: [], edges: [] });
  const graphRef = useRef(graph);
  graphRef.current = graph; // always read the latest graph during merges
  const [positions, setPositions] = useState<Pos>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [neighborsLoaded, setNeighborsLoaded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const rf = useReactFlow();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seeded = useRef(false);

  const toggle = useCallback((name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        // Lazy-load fields the first time a node is expanded.
        setGraph(g => {
          const node = g.nodes.find(n => n.name === name);
          if (node && node.fields === undefined) {
            setLoading(l => new Set(l).add(name));
            post({ type: 'expandNode', name, service: node.service });
          }
          return g;
        });
      }
      return next;
    });
  }, []);

  const onQuery = useCallback((name: string, service: ErdService) => {
    post({ type: 'queryModel', name, service });
  }, []);

  // --- inbound messages from the extension ---
  useEffect(() => {
    const onMsg = (ev: MessageEvent<ErdInbound>) => {
      const msg = ev.data;
      if (msg.type === 'init') {
        setTitle(msg.title);
        setGraph(msg.graph);
        setPositions(msg.positions || {});
        // Pre-expand the focal model so a single-model ERD shows fields at once.
        setExpanded(new Set(msg.graph.nodes.filter(n => n.focal).map(n => n.name)));
        seeded.current = false;
      } else if (msg.type === 'nodeFields') {
        setLoading(l => { const n = new Set(l); n.delete(msg.name); return n; });
        setGraph(g => ({
          ...g,
          nodes: g.nodes.map(n => (n.name === msg.name ? { ...n, fields: msg.fields } : n)),
        }));
      } else if (msg.type === 'addGraph') {
        setBusy(b => { const n = new Set(b); n.delete(msg.source); return n; });
        setNeighborsLoaded(s => new Set(s).add(msg.source));
        mergeGraph(msg.source, msg.graph);
      }
    };
    window.addEventListener('message', onMsg);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Double-click a node → ask the extension for its neighbors and grow the graph.
  const onNodeDoubleClick = useCallback((_e: unknown, node: Node) => {
    if (neighborsLoaded.has(node.id) || busy.has(node.id)) return;
    const n = graphRef.current.nodes.find(x => x.name === node.id);
    if (!n) return;
    setBusy(b => new Set(b).add(node.id));
    post({ type: 'expandNeighbors', name: node.id, service: n.service });
  }, [neighborsLoaded, busy]);

  // Merge a freshly-fetched neighbor graph in, placing new nodes around the source.
  const mergeGraph = useCallback((source: string, incoming: ErdGraph) => {
    const g = graphRef.current;
    const names = new Set(g.nodes.map(n => n.name));
    const merged = g.nodes.map(n => {
      const inc = incoming.nodes.find(i => i.name === n.name);
      return inc && inc.fields && n.fields === undefined ? { ...n, fields: inc.fields } : n;
    });
    const fresh: string[] = [];
    for (const inc of incoming.nodes) {
      if (!names.has(inc.name)) {
        merged.push({ name: inc.name, service: inc.service, fields: inc.fields });
        fresh.push(inc.name);
      }
    }
    const key = (e: { from: string; to: string; label: string }) => `${e.from}|${e.to}|${e.label}`;
    const seen = new Set(g.edges.map(key));
    const edges = [...g.edges];
    for (const e of incoming.edges) if (!seen.has(key(e))) { seen.add(key(e)); edges.push(e); }
    setGraph({ nodes: merged, edges });
    setExpanded(prev => new Set(prev).add(source));
    if (fresh.length) {
      setPositions(prev => {
        const base = prev[source] || { x: 0, y: 0 };
        const next = { ...prev };
        fresh.forEach((nm, i) => {
          if (next[nm]) return;
          const ang = (i / fresh.length) * Math.PI * 2 - Math.PI / 2;
          next[nm] = { x: base.x + Math.cos(ang) * 360, y: base.y + Math.sin(ang) * 240 };
        });
        return next;
      });
    }
  }, []);

  const relationCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of graph.edges) {
      m.set(e.from, (m.get(e.from) || 0) + 1);
      m.set(e.to, (m.get(e.to) || 0) + 1);
    }
    return m;
  }, [graph.edges]);

  // Connected set for highlight/dim when a node is selected.
  const connected = useMemo(() => {
    if (!selected) return null;
    const set = new Set<string>([selected]);
    for (const e of graph.edges) {
      if (e.from === selected) set.add(e.to);
      if (e.to === selected) set.add(e.from);
    }
    return set;
  }, [selected, graph.edges]);

  const nodes: Node[] = useMemo(() => {
    return graph.nodes.map(n => {
      const data: EntityData = {
        label: n.name,
        service: n.service,
        focal: n.focal,
        fields: n.fields,
        expanded: expanded.has(n.name),
        loading: loading.has(n.name),
        busy: busy.has(n.name),
        neighborsLoaded: neighborsLoaded.has(n.name),
        relationCount: relationCounts.get(n.name) || 0,
        dimmed: connected ? !connected.has(n.name) : false,
        highlighted: selected === n.name,
        onToggle: toggle,
        onQuery,
      };
      return {
        id: n.name,
        type: 'entity',
        position: positions[n.name] || { x: 0, y: 0 },
        data: data as unknown as Record<string, unknown>,
      };
    });
  }, [graph.nodes, expanded, loading, busy, neighborsLoaded, positions, relationCounts, connected, selected, toggle]);

  const edges: Edge[] = useMemo(() => {
    return graph.edges.map((e, i) => {
      const onSel = selected != null && (e.from === selected || e.to === selected);
      return {
        id: `e${i}:${e.from}->${e.to}:${e.label}`,
        source: e.from,
        target: e.to,
        label: e.label,
        // Crow's-foot at each end: many → crow, one → bar.
        markerStart: e.fromMany ? 'url(#fuuz-many)' : 'url(#fuuz-one)',
        markerEnd: e.toMany ? 'url(#fuuz-many)' : 'url(#fuuz-one)',
        animated: onSel,
        style: {
          stroke: onSel ? 'var(--vscode-focusBorder)' : 'var(--vscode-editorIndentGuide-activeBackground, #888)',
          strokeWidth: onSel ? 2 : 1,
          opacity: connected && !onSel ? 0.2 : 1,
        },
      };
    });
  }, [graph.edges, selected, connected]);

  // Seed positions with a dagre layout once the graph (and any saved positions) arrives.
  useEffect(() => {
    if (seeded.current || graph.nodes.length === 0) return;
    const missing = graph.nodes.some(n => !positions[n.name]);
    if (!missing) { seeded.current = true; return; }
    const seededNodes = layout(nodes, edges);
    const next: Pos = { ...positions };
    for (const n of seededNodes) if (!positions[n.id]) next[n.id] = n.position;
    seeded.current = true;
    setPositions(next);
    requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes]);

  const persist = useCallback((next: Pos) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => post({ type: 'saveLayout', positions: next }), 400);
  }, []);

  const onNodeDragStop = useCallback((_e: unknown, node: Node) => {
    setPositions(prev => {
      const next = { ...prev, [node.id]: node.position };
      persist(next);
      return next;
    });
  }, [persist]);

  const relayout = useCallback(() => {
    const next: Pos = {};
    for (const n of layout(nodes, edges)) next[n.id] = n.position;
    setPositions(next);
    persist(next);
    requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 300 }));
  }, [nodes, edges, persist, rf]);

  const runSearch = useCallback((q: string) => {
    const term = q.trim().toLowerCase();
    if (!term) { setSelected(null); return; }
    const hit = graph.nodes.find(n => n.name.toLowerCase().includes(term));
    if (hit) {
      setSelected(hit.name);
      const p = positions[hit.name];
      if (p) rf.setCenter(p.x + COLLAPSED_W / 2, p.y + COLLAPSED_H / 2, { zoom: 1.2, duration: 400 });
    }
  }, [graph.nodes, positions, rf]);

  const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="app">
      <div className="toolbar">
        <h1>{title}</h1>
        <span className="hint">click = fields · double-click = expand related</span>
        <span className="spacer" />
        <input
          placeholder="Find entity…"
          value={search}
          onChange={e => { setSearch(e.target.value); runSearch(e.target.value); }}
        />
        <button onClick={() => rf.fitView({ padding: 0.2, duration: 300 })}>Fit</button>
        <button onClick={relayout} title="Re-run automatic layout">Auto-layout</button>
        {selected && <button onClick={() => { setSelected(null); setSearch(''); }}>Clear</button>}
      </div>
      <div className="flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={isDark ? 'dark' : 'light'}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_e, n) => setSelected(prev => (prev === n.id ? null : n.id))}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={() => setSelected(null)}
          minZoom={0.05}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
        <CrowsFootDefs />
      </div>
    </div>
  );
}

/**
 * SVG <defs> for crow's-foot relationship markers, referenced by edges via
 * `url(#fuuz-one)` / `url(#fuuz-many)`. `context-stroke` makes each marker
 * inherit its edge's colour (incl. the highlight colour when selected).
 */
function CrowsFootDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        {/* "one": a single bar across the line, near the entity */}
        <marker id="fuuz-one" markerWidth="20" markerHeight="20" refX="16" refY="10"
          orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M12,3 L12,17" stroke="context-stroke" strokeWidth="1.5" fill="none" />
        </marker>
        {/* "many": crow's foot fanning out toward the line */}
        <marker id="fuuz-many" markerWidth="24" markerHeight="22" refX="20" refY="11"
          orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M20,11 L4,3 M20,11 L4,11 M20,11 L4,19" stroke="context-stroke" strokeWidth="1.5" fill="none" />
        </marker>
      </defs>
    </svg>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <Erd />
    </ReactFlowProvider>
  </StrictMode>
);
