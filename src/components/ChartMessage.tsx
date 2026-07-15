import { User, Sparkles, Database, Code2, BarChart3, Table2 } from 'lucide-react';
import { ChartView } from './ChartView';
import { DataTable } from './DataTable';
import { CodeBlock } from './CodeBlock';
import type { AnalysisResult, AgentStep } from '../lib/analyst';
import { AgentPipeline } from './AgentPipeline';

interface MessageProps {
  role: 'user' | 'assistant';
  content?: string;
  steps?: AgentStep[];
  result?: AnalysisResult;
  isRunning?: boolean;
  isFinal?: boolean;
}

export function ChatMessage({ role, content, steps, result, isRunning, isFinal }: MessageProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="flex max-w-2xl items-start gap-2">
          <div className="rounded-2xl rounded-tr-md bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-2.5 text-sm text-white shadow-lg shadow-violet-500/20">
            {content}
          </div>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800">
            <User className="h-4 w-4 text-zinc-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="flex max-w-4xl items-start gap-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-violet-500/30">
          <Sparkles className="h-4 w-4 text-violet-300" />
        </div>
        <div className="flex-1 space-y-3">
          {isRunning && steps && (
            <AgentPipeline steps={steps} />
          )}
          {result && isFinal && (
            <div className="space-y-4">
              {/* Metrics */}
              {result.metrics.length > 0 && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {result.metrics.slice(0, 4).map((m, i) => (
                    <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{m.label}</div>
                      <div className="mt-1 font-mono text-lg text-zinc-100">{m.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Answer */}
              <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 p-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                  <Sparkles className="h-3 w-3" />
                  Answer
                </div>
                <div className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
                  {formatMarkdown(result.interpretation)}
                </div>
              </div>

              {/* Visualization */}
              {result.chartType !== 'none' && result.chartData.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <BarChart3 className="h-3 w-3" />
                    Visualization
                  </div>
                  <ChartView type={result.chartType} data={result.chartData} xKey={result.chartXKey} series={result.chartSeries} />
                </div>
              )}

              {/* Table */}
              {result.tableOutput && result.tableOutput.rows.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <Table2 className="h-3 w-3" />
                    Data ({result.tableOutput.rows.length} rows)
                  </div>
                  <DataTable columns={result.tableOutput.columns} rows={result.tableOutput.rows} />
                </div>
              )}

              {/* Code */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                    <Database className="h-3 w-3" />
                    Generated SQL
                  </div>
                  <CodeBlock code={result.sql} language="sql" />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-300">
                    <Code2 className="h-3 w-3" />
                    Generated Python
                  </div>
                  <CodeBlock code={result.python} language="python" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMarkdown(text: string) {
  // Simple markdown: **bold** support
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}
