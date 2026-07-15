interface DataTableProps {
  columns: string[];
  rows: any[][];
  maxRows?: number;
}

export function DataTable({ columns, rows, maxRows = 50 }: DataTableProps) {
  const display = rows.slice(0, maxRows);
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-400">
          <tr>
            {columns.map(c => (
              <th key={c} className="px-3 py-2 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {display.map((r, i) => (
            <tr key={i} className="text-zinc-200 hover:bg-zinc-900/30">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-2 font-mono text-xs">
                  {typeof cell === 'number' ? cell.toLocaleString() : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="border-t border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-500">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
