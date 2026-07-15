import { useState } from 'react';
import { Table2, Eye, EyeOff, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Dataset } from '../lib/sampleData';

interface Props {
  dataset: Dataset;
  onClose?: () => void;
}

export function DataPreview({ dataset, onClose }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  
  const previewRows = showAll ? dataset.rows : dataset.rows.slice(0, 5);
  const columns = dataset.schema.map(s => s.name);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-200">Data Preview</span>
          <span className="text-[10px] text-zinc-500">
            {dataset.rows.length.toLocaleString()} rows × {dataset.schema.length} columns
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400">
                <tr>
                  {columns.map(c => (
                    <th key={c} className="px-3 py-2 font-medium border-b border-zinc-800 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[120px]" title={c}>{c}</span>
                        <span className={`text-[9px] px-1 rounded ${
                          dataset.schema.find(s => s.name === c)?.type === 'number' 
                            ? 'bg-blue-500/10 text-blue-400' 
                            : dataset.schema.find(s => s.name === c)?.type === 'date'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-zinc-700/30 text-zinc-500'
                        }`}>
                          {dataset.schema.find(s => s.name === c)?.type?.slice(0, 3)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {previewRows.map((row, i) => (
                  <tr key={i} className="text-zinc-300 hover:bg-zinc-900/30">
                    {columns.map((col, j) => (
                      <td key={j} className="px-3 py-2 font-mono whitespace-nowrap max-w-[150px] truncate">
                        {formatValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {dataset.rows.length > 5 && (
            <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <span className="text-[10px] text-zinc-500">
                Showing {previewRows.length} of {dataset.rows.length.toLocaleString()} rows
              </span>
              <button
                onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300"
              >
                {showAll ? (
                  <><EyeOff className="h-3 w-3" /> Show less</>
                ) : (
                  <><Eye className="h-3 w-3" /> Show all ({dataset.rows.length})</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(1) + 'K';
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(2);
  }
  if (typeof val === 'string' && val.length > 50) return val.slice(0, 47) + '...';
  return String(val);
}
