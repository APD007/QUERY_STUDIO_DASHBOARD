import { useState } from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ResultColumn } from '@/modules/queries/engine';
import { downloadCsv, downloadExcel } from '@/lib/exportRows';
import { C, SEV } from '@/palette';

const PAGE_SIZE = 50;

interface OrderBy {
  field: string;
  dir: 'asc' | 'desc';
}

export default function ResultTable({
  columns, rows, name = 'query_result', maxHeight = 384, onSort, orderBy,
}: {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  name?: string;
  maxHeight?: number;
  onSort?: (label: string) => void;
  orderBy?: OrderBy | null;
}) {
  const [page, setPage] = useState(0);
  // A fresh query run produces a new rows array — jump back to page 1 rather than
  // stranding the user on a page number that may no longer exist. Adjusted during
  // render (React's recommended pattern) instead of an effect, to avoid an extra render pass.
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setPage(0);
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <span style={{ color: C.mut }} className="text-xs">
          {rows.length.toLocaleString()} rows
          {pageCount > 1 && ` · page ${clampedPage + 1} of ${pageCount}`}
        </span>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" disabled={!rows.length} onClick={() => downloadCsv(rows, columns, name)}>
            <Download size={13} /> CSV
          </Button>
          <Button variant="ghost" size="sm" disabled={!rows.length} onClick={() => downloadExcel(rows, columns, name)}>
            <Download size={13} /> Excel
          </Button>
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight, border: `1px solid ${C.line}`, borderRadius: 10 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr style={{ background: C.skyl }}>
              {columns.map(col => (
                <th
                  key={col.label}
                  onClick={onSort ? () => onSort(col.label) : undefined}
                  style={{ color: C.ink, cursor: onSort ? 'pointer' : undefined }}
                  className="text-left font-semibold px-3 py-2 select-none whitespace-nowrap"
                >
                  {col.label}
                  {orderBy?.field === col.label ? (orderBy.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={clampedPage * PAGE_SIZE + i} style={{ borderTop: `1px solid ${C.line}` }}>
                {columns.map(col => {
                  const isSev = col.label === 'severity';
                  const val = row[col.label];
                  return (
                    <td key={col.label} className="px-3 py-1.5 whitespace-nowrap">
                      {isSev ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span style={{
                            background: SEV[String(val)] || C.mut,
                            width: 8, height: 8, borderRadius: 99, display: 'inline-block',
                          }} />
                          {String(val ?? '')}
                        </span>
                      ) : (
                        <span style={{ color: C.text }}>{String(val ?? '')}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <Button variant="ghost" size="sm" disabled={clampedPage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            <ChevronLeft size={13} /> Prev
          </Button>
          <span style={{ color: C.mut }} className="text-xs">Page {clampedPage + 1} / {pageCount}</span>
          <Button variant="ghost" size="sm" disabled={clampedPage >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>
            Next <ChevronRight size={13} />
          </Button>
        </div>
      )}
    </div>
  );
}
