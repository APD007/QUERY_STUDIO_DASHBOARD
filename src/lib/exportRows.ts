import Papa from 'papaparse';
import type { ResultColumn } from '@/modules/queries/engine';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function orderedRows(rows: Record<string, unknown>[], columns: ResultColumn[]) {
  return rows.map(r => {
    const out: Record<string, unknown> = {};
    columns.forEach(c => { out[c.label] = r[c.label]; });
    return out;
  });
}

export function downloadCsv(rows: Record<string, unknown>[], columns: ResultColumn[], filename: string) {
  const csv = Papa.unparse(orderedRows(rows, columns));
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}

export async function downloadExcel(rows: Record<string, unknown>[], columns: ResultColumn[], filename: string) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(orderedRows(rows, columns));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
