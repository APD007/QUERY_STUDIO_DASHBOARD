import type { Query } from '@/types/expr';
import { buildDisplaySql } from '@/lib/sqlGenerator';
import { C } from '@/palette';

const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'AND', 'OR', 'NOT'];

function highlightLine(line: string, idx: number) {
  for (const kw of KEYWORDS) {
    if (line.startsWith(kw + ' ') || line === kw) {
      return (
        <span key={idx}>
          <span style={{ color: '#6FD0F2' }}>{kw}</span>
          {line.slice(kw.length)}
          {'\n'}
        </span>
      );
    }
  }
  return <span key={idx}>{line}{'\n'}</span>;
}

function kpiCommentLine(query: Query): string | null {
  const { kpi } = query;
  const parts = [
    kpi.name && `KPI: ${kpi.name}`,
    kpi.group && `Group: ${kpi.group}`,
    kpi.domain && `Domain: ${kpi.domain}`,
    kpi.vendor && `Vendor: ${kpi.vendor}`,
    kpi.technology && `Tech: ${kpi.technology}`,
    kpi.nodeType && `Node: ${kpi.nodeType}`,
    kpi.kpiType && `Type: ${kpi.kpiType}`,
  ].filter(Boolean);
  return parts.length ? `-- ${parts.join('  ·  ')}` : null;
}

export default function SqlPreview({ query }: { query: Query }) {
  const sql = buildDisplaySql(query);
  const comment = kpiCommentLine(query);

  return (
    <div style={{ background: C.ink, borderRadius: 12 }} className="p-4 font-mono text-sm leading-relaxed overflow-x-auto">
      <div className="text-white whitespace-pre-wrap">
        {comment && (
          <>
            <span style={{ color: '#7FA8C4' }}>{comment}</span>
            {'\n'}
          </>
        )}
        {sql.split('\n').map((line, i) => highlightLine(line, i))}
      </div>
    </div>
  );
}
