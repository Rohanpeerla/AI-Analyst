import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  code: string;
  language: 'sql' | 'python' | 'text';
  title?: string;
}

export function CodeBlock({ code, language, title }: Props) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            language === 'sql' ? 'bg-blue-500/20 text-blue-300' :
            language === 'python' ? 'bg-yellow-500/20 text-yellow-300' :
            'bg-zinc-700/50 text-zinc-400'
          }`}>
            {language}
          </span>
          {title && <span className="text-zinc-400">{title}</span>}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded p-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-zinc-300">{code}</code>
      </pre>
    </div>
  );
}
