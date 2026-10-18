import type { Issue } from '@/lib/types';
import { CATEGORY_LABEL, SEVERITY_LABEL } from '@/lib/types';

export default function Issues({ issues, limit }: { issues: Issue[]; limit?: number }) {
  const list = limit ? issues.slice(0, limit) : issues;
  if (!list.length) return <p className="muted">Aucun problème détecté. Bravo !</p>;
  return (
    <div>
      {list.map((i) => (
        <details key={i.id} className="issue">
          <summary>
            <span className={`chip ${i.severity}`}>{SEVERITY_LABEL[i.severity]}</span>
            <span style={{ fontWeight: 600, flex: 1 }}>{i.title}</span>
            <span className="muted" style={{ fontSize: 13 }}>{i.total > 1 ? `${i.affected.length}/${i.total} pages` : ''}</span>
          </summary>
          <div className="body">
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{CATEGORY_LABEL[i.category]}</div>
            <p style={{ margin: 0 }}><strong>Comment corriger :</strong> {i.advice}</p>
            {i.affected.length > 0 && i.total > 1 && (
              <ul className="urls mono">{i.affected.map((u) => <li key={u}>{u}</li>)}</ul>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
