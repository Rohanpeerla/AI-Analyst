import { useRef, useState, useCallback } from 'react';
import { Database, Upload, FileSpreadsheet, Plus, Check, FileUp, AlertCircle, X } from 'lucide-react';
import * as Papa from 'papaparse';
import type { Dataset } from '../lib/sampleData';

interface Props {
  active: Dataset;
  datasets: Dataset[];
  onSelect: (d: Dataset) => void;
  onUpload: (d: Dataset) => void;
}

export function DatasetPanel({ active, datasets, onSelect, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const parseCSV = (text: string, filename: string) => {
    setUploadStatus('parsing');
    
    try {
      const parsed = Papa.parse(text, { 
        header: true, 
        dynamicTyping: true, 
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      });
        
        if (parsed.errors.length > 0 && parsed.errors[0].code !== 'TooFewFields') {
          console.warn('CSV parse warnings:', parsed.errors);
        }
        
        const rows = parsed.data as Record<string, any>[];
        
        if (rows.length === 0) {
          setUploadStatus('error');
          setErrorMsg('File appears to be empty');
          return;
        }
        
        const cols = Object.keys(rows[0]).filter(c => c !== '');
        
        if (cols.length === 0) {
          setUploadStatus('error');
          setErrorMsg('No valid columns found');
          return;
        }
        
        // Detect schema with better type inference
        const schema = cols.map(c => {
          let numCount = 0, dateCount = 0, boolCount = 0, total = 0;
          for (const r of rows.slice(0, 100)) {
            const v = r[c];
            if (v === null || v === undefined || v === '') continue;
            total++;
            
            if (typeof v === 'boolean') boolCount++;
            else if (typeof v === 'number') numCount++;
            else if (typeof v === 'string') {
              if (/^\d{4}-\d{2}-\d{2}/.test(v)) dateCount++;
              else if (!isNaN(Number(v.replace(/[$,%]/g, '').trim()))) numCount++;
            }
          }
          
          let type: 'number' | 'string' | 'date' = 'string';
          if (total > 0) {
            if (dateCount / total > 0.5) type = 'date';
            else if (numCount / total > 0.6) type = 'number';
          }
          return { name: c, type };
        });
        
        const newDataset: Dataset = {
          id: 'uploaded-' + Date.now(),
          name: filename.replace(/\.csv$/i, ''),
          description: `${rows.length.toLocaleString()} rows · ${cols.length} columns`,
          rows,
          schema,
        };
        
        onUpload(newDataset);
        setUploadStatus('idle');
      } catch (err: any) {
        setUploadStatus('error');
        setErrorMsg(err.message || 'Failed to parse file');
      }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      setUploadStatus('error');
      setErrorMsg('Please upload a CSV file');
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      parseCSV(String(reader.result), file.name);
      e.target.value = '';
    };
    reader.onerror = () => {
      setUploadStatus('error');
      setErrorMsg('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      setUploadStatus('error');
      setErrorMsg('Please upload a CSV file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      parseCSV(String(reader.result), file.name);
    };
    reader.onerror = () => {
      setUploadStatus('error');
      setErrorMsg('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const clearError = () => {
    setUploadStatus('idle');
    setErrorMsg('');
  };

  const uploadedDatasets = datasets.filter(d => d.id.startsWith('uploaded-'));
  const sampleDatasets = datasets.filter(d => !d.id.startsWith('uploaded-'));

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Upload Area */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <FileUp className="h-3.5 w-3.5" />
          Upload Data
        </div>
        
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        
        <button
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`group relative flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 transition-all ${
            isDragging 
              ? 'border-violet-500 bg-violet-500/10' 
              : uploadStatus === 'parsing'
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-zinc-700 bg-zinc-900/20 hover:border-violet-500/50 hover:bg-violet-500/5'
          }`}
        >
          {uploadStatus === 'parsing' ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
              <span className="text-sm text-amber-300">Parsing your file...</span>
            </>
          ) : (
            <>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                isDragging ? 'bg-violet-500/20' : 'bg-zinc-800 group-hover:bg-violet-500/20'
              }`}>
                <Upload className={`h-5 w-5 transition-colors ${
                  isDragging ? 'text-violet-400' : 'text-zinc-500 group-hover:text-violet-400'
                }`} />
              </div>
              <div className="text-center">
                <span className={`block text-sm font-medium transition-colors ${
                  isDragging ? 'text-violet-300' : 'text-zinc-300 group-hover:text-violet-300'
                }`}>
                  {isDragging ? 'Drop your CSV here' : 'Click or drag CSV file'}
                </span>
                <span className="mt-1 block text-[10px] text-zinc-500">
                  Supports .csv files up to 10MB
                </span>
              </div>
            </>
          )}
        </button>
        
        {uploadStatus === 'error' && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="flex-1 text-xs text-red-300">{errorMsg}</span>
            <button onClick={clearError} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Uploaded Files Section */}
      {uploadedDatasets.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <Database className="h-3.5 w-3.5" />
            Your Files
          </div>
          <div className="space-y-1">
            {uploadedDatasets.map(d => (
              <DatasetButton key={d.id} d={d} active={active} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {/* Sample Datasets */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <Database className="h-3.5 w-3.5" />
          Sample Datasets
        </div>
        <div className="space-y-1">
          {sampleDatasets.map(d => (
            <DatasetButton key={d.id} d={d} active={active} onSelect={onSelect} />
          ))}
        </div>
      </div>

      {/* Schema Info */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Active: {active.name}
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {active.schema.slice(0, 15).map(s => (
            <div key={s.name} className="flex items-center justify-between text-xs">
              <span className="font-mono text-zinc-300 truncate mr-2" title={s.name}>{s.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] flex-shrink-0 ${
                s.type === 'number' ? 'bg-blue-500/10 text-blue-300' :
                s.type === 'date' ? 'bg-emerald-500/10 text-emerald-300' :
                'bg-zinc-700/40 text-zinc-400'
              }`}>{s.type}</span>
            </div>
          ))}
          {active.schema.length > 15 && (
            <div className="text-[10px] text-zinc-600 text-center py-1">
              +{active.schema.length - 15} more columns
            </div>
          )}
        </div>
      </div>

      {/* Connection Demo */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Connect Database</div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Plus className="h-3 w-3" />
          PostgreSQL, MySQL, BigQuery
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300">demo</span>
        </div>
      </div>
    </div>
  );
}

function DatasetButton({ d, active, onSelect }: { d: Dataset; active: Dataset; onSelect: (d: Dataset) => void }) {
  return (
    <button
      onClick={() => onSelect(d)}
      className={`group w-full rounded-lg border px-3 py-2 text-left transition-all ${
        active.id === d.id
          ? 'border-violet-500/40 bg-violet-500/10'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className={`h-3.5 w-3.5 flex-shrink-0 ${active.id === d.id ? 'text-violet-400' : 'text-zinc-500'}`} />
          <span className={`truncate text-sm font-medium ${active.id === d.id ? 'text-violet-100' : 'text-zinc-200'}`}>
            {d.name}
          </span>
        </div>
        {active.id === d.id && <Check className="h-3 w-3 text-violet-400 flex-shrink-0" />}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-zinc-500">{d.description}</div>
    </button>
  );
}
