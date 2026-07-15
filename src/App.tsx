import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Database, Zap, Code2, BarChart3, ChevronRight, Trash2, FileUp, FileSpreadsheet } from 'lucide-react';
import { DatasetPanel } from './components/DatasetPanel';
import { ChatMessage } from './components/ChatMessage';
import { DataPreview } from './components/DataPreview';
import { SAMPLE_DATASETS, SUGGESTED_QUESTIONS, type Dataset } from './lib/sampleData';
import { runAnalysis, type AnalysisResult, type AgentStep } from './lib/analyst';

interface ChatTurn {
  id: string;
  question: string;
  steps?: AgentStep[];
  result?: AnalysisResult;
  isRunning: boolean;
  isFinal: boolean;
}

export default function App() {
  const [datasets, setDatasets] = useState<Dataset[]>(SAMPLE_DATASETS);
  const [active, setActive] = useState<Dataset>(SAMPLE_DATASETS[0]);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, active]);

  // Auto-show preview when switching to uploaded dataset
  useEffect(() => {
    if (active.id.startsWith('uploaded-')) {
      setShowPreview(true);
    }
  }, [active.id]);

  // Better scroll handling
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ 
        top: scrollRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [turns.length]);

  const ask = async (question: string) => {
    if (!question.trim() || turns.some(t => t.isRunning)) return;
    const id = 'turn-' + Date.now();
    const newTurn: ChatTurn = { id, question, isRunning: true, isFinal: false };
    setTurns(prev => [...prev, newTurn]);
    setInput('');

    try {
      const result = await runAnalysis(question, active, (update) => {
        setTurns(prev => prev.map(t => t.id === id ? { ...t, steps: update.steps } : t));
      });
      setTurns(prev => prev.map(t => t.id === id ? { ...t, result, isRunning: false, isFinal: true } : t));
    } catch (err: any) {
      setTurns(prev => prev.map(t => t.id === id ? { ...t, isRunning: false, isFinal: true } : t));
    }
  };

  const handleUpload = (d: Dataset) => {
    setDatasets(prev => [d, ...prev]);
    setActive(d);
    setTurns([]); // Clear previous chat when uploading new data
    setShowPreview(true);
  };

  const suggestions = SUGGESTED_QUESTIONS[active.id] || 
    // Generate generic suggestions based on schema
    generateGenericSuggestions(active);

  const isUploaded = active.id.startsWith('uploaded-');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Left sidebar */}
      <aside className="hidden w-80 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Insight</div>
            <div className="text-[10px] text-zinc-500">AI Data Analyst</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <DatasetPanel 
            active={active} 
            datasets={datasets} 
            onSelect={(d) => { setActive(d); setTurns([]); }} 
            onUpload={handleUpload} 
          />
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col overflow-hidden bg-grid">
        <header className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/80 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-violet-500/30 md:hidden">
              <Sparkles className="h-4 w-4 text-violet-300" />
            </div>
            <div className="flex items-center gap-2">
              {isUploaded ? (
                <FileUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-violet-400" />
              )}
              <div>
                <h1 className="text-sm font-semibold text-zinc-100">{active.name}</h1>
                <p className="text-[11px] text-zinc-500">{active.description}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {turns.length > 0 && (
              <button
                onClick={() => setTurns([])}
                className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        </header>

        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto overscroll-y-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {turns.length === 0 ? (
            <EmptyState 
              active={active} 
              suggestions={suggestions} 
              onAsk={ask} 
              isUploaded={isUploaded}
              onUploadClick={() => document.querySelector<HTMLButtonElement>('input[type="file"]')?.parentElement?.querySelector('button')?.click()}
            />
          ) : (
            <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6 pb-24">
              {turns.map(turn => (
                <div key={turn.id} className="space-y-4">
                  <ChatMessage role="user" content={turn.question} />
                  <ChatMessage
                    role="assistant"
                    steps={turn.steps}
                    result={turn.result}
                    isRunning={turn.isRunning}
                    isFinal={turn.isFinal}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Preview - shown for new uploads */}
        {turns.length === 0 && showPreview && (
          <div className="border-t border-zinc-800/60 bg-zinc-950/80 px-4 py-3 backdrop-blur md:px-6">
            <div className="mx-auto max-w-4xl">
              <DataPreview 
                dataset={active} 
                onClose={() => setShowPreview(false)} 
              />
            </div>
          </div>
        )}

        <div className="border-t border-zinc-800/60 bg-zinc-950/80 px-4 py-3 backdrop-blur md:px-6">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="mx-auto flex max-w-4xl items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${active.name}... (e.g., "What are the total sales by region?")`}
                disabled={turns.some(t => t.isRunning)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 pr-12 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-500/50 focus:bg-zinc-900 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || turns.some(t => t.isRunning)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mx-auto mt-2 max-w-4xl text-center text-[10px] text-zinc-600">
            {isUploaded 
              ? `Analyzing your uploaded data: ${active.rows.length.toLocaleString()} rows available`
              : 'Try asking about trends, comparisons, totals, or correlations'}
          </div>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ 
  active, 
  suggestions, 
  onAsk, 
  isUploaded,
  onUploadClick 
}: { 
  active: Dataset; 
  suggestions: string[]; 
  onAsk: (q: string) => void;
  isUploaded: boolean;
  onUploadClick: () => void;
}) {
  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center px-4 py-8">
      {isUploaded ? (
        // Uploaded file welcome state
        <>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/20">
            <FileUp className="h-7 w-7 text-white" />
          </div>
          <h2 className="mb-1 text-xl font-semibold tracking-tight text-white">File uploaded successfully!</h2>
          <p className="mb-6 max-w-md text-center text-sm text-zinc-400">
            Your <span className="text-emerald-400 font-medium">{active.name}</span> dataset is ready with{' '}
            <span className="text-zinc-200">{active.rows.length.toLocaleString()} rows</span> and{' '}
            <span className="text-zinc-200">{active.schema.length} columns</span>
          </p>
          <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <p className="text-xs text-emerald-300/80 text-center">
              Ask any question about your data below. I can analyze trends, calculate statistics, find patterns, and create charts.
            </p>
          </div>
        </>
      ) : (
        // Default welcome state
        <>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-xl shadow-violet-500/20">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="mb-1 text-xl font-semibold tracking-tight text-white">Ask anything about your data</h2>
          <p className="mb-6 text-sm text-zinc-400">
            Currently analyzing <span className="font-medium text-violet-300">{active.name}</span>
          </p>
        </>
      )}

      {/* Capabilities */}
      <div className="mb-6 grid w-full max-w-2xl grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { icon: ListChecksIcon, label: 'Plans analysis', desc: 'Understands intent' },
          { icon: Database, label: 'Queries data', desc: 'Writes SQL' },
          { icon: Code2, label: 'Runs code', desc: 'Python stats' },
          { icon: BarChart3, label: 'Charts results', desc: 'Auto-picks type' },
        ].map((f, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <f.icon className="mb-2 h-4 w-4 text-violet-400" />
            <div className="text-xs font-medium text-zinc-200">{f.label}</div>
            <div className="text-[10px] text-zinc-500">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="w-full max-w-2xl">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <Zap className="h-3 w-3" />
            Try a question
          </div>
          {!isUploaded && (
            <button
              onClick={onUploadClick}
              className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              <FileUp className="h-3 w-3" />
              Or upload your own CSV
            </button>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {suggestions.map((q, i) => (
            <button
              key={i}
              onClick={() => onAsk(q)}
              className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2.5 text-left text-sm text-zinc-300 transition-all hover:border-violet-500/40 hover:bg-violet-500/5 hover:text-zinc-100"
            >
              <span className="truncate mr-2">{q}</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function generateGenericSuggestions(dataset: Dataset): string[] {
  const numericCols = dataset.schema.filter(s => s.type === 'number').map(s => s.name);
  const categoricalCols = dataset.schema.filter(s => s.type === 'string').map(s => s.name);
  
  const suggestions: string[] = [];
  
  if (numericCols.length > 0 && categoricalCols.length > 0) {
    suggestions.push(`What is the total ${numericCols[0]} by ${categoricalCols[0]}?`);
    suggestions.push(`Show me the average ${numericCols[0]} for each ${categoricalCols[0]}`);
  }
  
  if (numericCols.length > 1) {
    suggestions.push(`What is the correlation between ${numericCols[0]} and ${numericCols[1]}?`);
  }
  
  if (categoricalCols.length > 0) {
    suggestions.push(`How many records for each ${categoricalCols[0]}?`);
  }
  
  if (numericCols.length > 0) {
    suggestions.push(`What are the minimum and maximum ${numericCols[0]} values?`);
    suggestions.push(`Show me the distribution of ${numericCols[0]}`);
  }
  
  return suggestions.slice(0, 4);
}

function ListChecksIcon(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  );
}
