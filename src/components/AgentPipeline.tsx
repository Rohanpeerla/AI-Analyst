import { CheckCircle2, Circle, Loader2, AlertCircle, Database, Code2, BarChart3, Lightbulb, ListChecks, MessageSquare, Sparkles } from 'lucide-react';
import type { AgentStep } from '../lib/analyst';

interface Props {
  steps: AgentStep[];
}

const ICONS: Record<string, any> = {
  understand: MessageSquare,
  plan: ListChecks,
  query: Database,
  code: Code2,
  chart: BarChart3,
  interpret: Lightbulb,
  answer: Sparkles,
};

export function AgentPipeline({ steps }: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <Sparkles className="h-3.5 w-3.5" />
        Agent pipeline
      </div>
      <ol className="space-y-2">
        {steps.map((step, i) => {
          const Icon = ICONS[step.id] || Circle;
          return (
            <li key={step.id} className="flex items-start gap-3 animate-slide-in" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {step.status === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {step.status === 'active' && <Loader2 className="h-4 w-4 animate-spin text-violet-400" />}
                {step.status === 'pending' && <Circle className="h-4 w-4 text-zinc-700" />}
                {step.status === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-zinc-500" />
                  <span className={`text-sm ${step.status === 'active' ? 'text-violet-200' : step.status === 'done' ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {step.label}
                  </span>
                </div>
                {step.detail && (
                  <div className="mt-0.5 ml-5.5 text-xs text-zinc-500">{step.detail}</div>
                )}
                {step.output && (
                  <div className="mt-0.5 text-xs text-emerald-400/70">→ {step.output}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
