import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ErdField, ErdService } from '../../util/erdTypes';

export interface EntityData {
  label: string;
  service: ErdService;
  focal?: boolean;
  fields?: ErdField[]; // undefined = not loaded yet
  expanded: boolean;
  loading?: boolean;
  busy?: boolean;
  neighborsLoaded?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  relationCount: number;
  onToggle: (name: string) => void;
  onQuery: (name: string, service: ErdService) => void;
  [key: string]: unknown;
}

function EntityNodeImpl({ data }: NodeProps) {
  const d = data as EntityData;
  const cls = [
    'entity',
    d.focal ? 'focal' : '',
    d.dimmed ? 'dimmed' : '',
    d.highlighted ? 'highlighted' : '',
  ].filter(Boolean).join(' ');

  const fields = d.fields;
  return (
    <div className={cls}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div
        className="entity-header"
        onClick={() => d.onToggle(d.label)}
        title="Click to expand fields · double-click to add related entities"
      >
        <span className={`chev ${d.expanded ? 'open' : ''}`}>▸</span>
        <span className="entity-name">{d.label}</span>
        {d.service === 'system' && <span className="badge">system</span>}
        {d.busy && <span className="spinner" title="Loading related entities…">◐</span>}
        {!d.busy && d.neighborsLoaded && <span className="rel-count expanded-mark" title="Related entities added">✓</span>}
        {d.relationCount > 0 && <span className="rel-count" title={`${d.relationCount} relationship(s)`}>{d.relationCount}</span>}
        <button
          className="entity-query"
          title={`Query ${d.label} records…`}
          onClick={e => { e.stopPropagation(); d.onQuery(d.label, d.service); }}
        >⌕</button>
      </div>
      {d.expanded && (
        <div className="entity-body">
          {d.loading && <div className="muted">loading fields…</div>}
          {!d.loading && fields && fields.length === 0 && <div className="muted">no scalar fields</div>}
          {!d.loading && fields && fields.map(f => (
            <div className="field" key={f.name}>
              <span className="field-name">{f.name}</span>
              <span className="field-type">{f.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const EntityNode = memo(EntityNodeImpl);
