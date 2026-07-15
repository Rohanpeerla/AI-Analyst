import type { Dataset } from './sampleData';

// ============================================================
// Types
// ============================================================
export type StepStatus = 'pending' | 'active' | 'done' | 'error';

export interface AgentStep {
  id: string;
  label: string;
  detail?: string;
  status: StepStatus;
  output?: string;
}

export interface AnalysisResult {
  question: string;
  plan: string;
  sql: string;
  python: string;
  tableOutput: { columns: string[]; rows: any[][] } | null;
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'none';
  chartData: any[];
  chartXKey: string | null;
  chartSeries: { key: string; label?: string; color?: string }[];
  interpretation: string;
  metrics: { label: string; value: string }[];
}

export interface ProgressUpdate {
  steps: AgentStep[];
  partialResult?: Partial<AnalysisResult>;
}

// ============================================================
// Utility: detect column type from sample values
// ============================================================
function inferType(values: any[]): 'number' | 'string' | 'date' {
  let numCount = 0;
  let dateCount = 0;
  let total = 0;
  for (const v of values.slice(0, 50)) {
    if (v === null || v === undefined || v === '') continue;
    total++;
    if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) numCount++;
    if (typeof v === 'string' && !isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}/.test(v)) dateCount++;
  }
  if (total === 0) return 'string';
  if (dateCount / total > 0.7) return 'date';
  if (numCount / total > 0.7) return 'number';
  return 'string';
}

function fmtNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

// ============================================================
// "Tool": Query database (SQL-like filter/aggregate on rows)
// ============================================================
function runSQL(rows: Record<string, any>[], query: string): { columns: string[]; rows: any[][] } {
  // SQL-like interpreter supporting special characters in column names
  
  if (rows.length === 0) return { columns: ['info'], rows: [['No data available']] };
  
  const availableCols = Object.keys(rows[0]);

  // Helper to find actual column name (case insensitive, handles special chars)
  const findColName = (name: string): string | undefined => {
    const lower = name.toLowerCase().trim();
    // Try exact match first
    const exact = availableCols.find(c => c.toLowerCase() === lower);
    if (exact) return exact;
    // Try matching without backticks
    const cleaned = lower.replace(/`/g, '');
    return availableCols.find(c => c.toLowerCase() === cleaned);
  };

  const selectMatch = query.match(/SELECT\s+([\s\S]+?)\s+FROM\s+\w+/i);
  if (!selectMatch) return { columns: ['error'], rows: [['Invalid query']] };

  const colsPart = selectMatch[1].trim();
  const whereMatch = query.match(/WHERE\s+([\s\S]+?)(?:\s+GROUP BY|\s+ORDER BY|\s+LIMIT|$)/i);
  const groupMatch = query.match(/GROUP BY\s+([\s\S]+?)(?:\s+ORDER BY|\s+LIMIT|$)/i);
  const orderMatch = query.match(/ORDER BY\s+([\s\S]+?)(?:\s+LIMIT|$)/i);
  const limitMatch = query.match(/LIMIT\s+(\d+)/i);

  // Filter rows
  let filtered = rows;
  if (whereMatch) {
    const cond = whereMatch[1].trim();
    filtered = filtered.filter(r => {
      // support: col op value (AND/OR)
      const parts = cond.split(/\s+AND\s+|\s+OR\s+/i);
      const ops = cond.match(/\s+(AND|OR)\s+/gi) || [];
      const results = parts.map(p => {
        const m = p.match(/(\w+)\s*(=|!=|>=|<=|>|<|LIKE)\s*('([^']*)'|([\d.]+))/i);
        if (!m) return true;
        const col = m[1];
        const op = m[2].toUpperCase();
        const val = m[4] !== undefined ? m[4] : Number(m[5]);
        const cell = r[col];
        switch (op) {
          case '=': return String(cell) === String(val);
          case '!=': return String(cell) !== String(val);
          case '>': return Number(cell) > Number(val);
          case '<': return Number(cell) < Number(val);
          case '>=': return Number(cell) >= Number(val);
          case '<=': return Number(cell) <= Number(val);
          case 'LIKE': return String(cell).toLowerCase().includes(String(val).toLowerCase().replace(/%/g, ''));
          default: return true;
        }
      });
      let res = results[0];
      for (let i = 0; i < ops.length; i++) {
        if (ops[i].toUpperCase() === 'AND') res = res && results[i + 1];
        else res = res || results[i + 1];
      }
      return res;
    });
  }

  // Parse select columns
  const selectCols = colsPart.split(',').map(s => s.trim());

  if (groupMatch) {
    const groupColRaw = groupMatch[1].trim();
    const groupCol = findColName(groupColRaw) || groupColRaw;
    const groups = new Map<string, any[]>();
    for (const r of filtered) {
      const k = String(r[groupCol] ?? 'null');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }

    const resultRows: any[][] = [];
    const aggCols: { name: string; fn: string; col: string; actualCol: string }[] = [];

    const finalCols: string[] = [groupCol];
    for (const sc of selectCols) {
      // Match aggregate functions with any content inside parens (handles special chars like /)
      const aggM = sc.match(/(SUM|AVG|COUNT|MIN|MAX)\s*\(\s*([^)]+?)\s*\)/i);
      if (aggM) {
        const fn = aggM[1].toUpperCase();
        const colRaw = aggM[2].trim();
        // Find actual column name (handle backticks if present)
        const col = colRaw.replace(/`/g, '');
        const actualCol = findColName(col) || col;
        aggCols.push({ name: sc, fn, col, actualCol });
        finalCols.push(sc);
      } else if (sc.toUpperCase() !== groupCol.toUpperCase()) {
        finalCols.push(sc);
      }
    }
    void finalCols;

    for (const [k, items] of groups) {
      const row: any[] = [k];
      for (const a of aggCols) {
        if (a.fn === 'COUNT') {
          row.push(a.col === '*' ? items.length : items.filter(x => x[a.actualCol] != null).length);
        } else {
          const nums = items.map(x => Number(x[a.actualCol])).filter(n => !isNaN(n));
          if (nums.length === 0) { row.push(0); continue; }
          if (a.fn === 'SUM') row.push(nums.reduce((s, n) => s + n, 0));
          if (a.fn === 'AVG') row.push(nums.reduce((s, n) => s + n, 0) / nums.length);
          if (a.fn === 'MIN') row.push(Math.min(...nums));
          if (a.fn === 'MAX') row.push(Math.max(...nums));
        }
      }
      resultRows.push(row);
    }

    if (orderMatch) {
      const m = orderMatch[1].trim().match(/(\w+)(?:\s+(ASC|DESC))?/i);
      if (m) {
        const col = m[1];
        const dir = (m[2] || 'ASC').toUpperCase();
        const idx = finalCols.indexOf(col);
        if (idx >= 0) {
          resultRows.sort((a, b) => {
            const av = a[idx], bv = b[idx];
            if (typeof av === 'number' && typeof bv === 'number') return dir === 'ASC' ? av - bv : bv - av;
            return dir === 'ASC' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
          });
        }
      }
    }

    let out = resultRows;
    if (limitMatch) out = out.slice(0, Number(limitMatch[1]));

    return { columns: finalCols, rows: out };
  } else {
    // Simple projection
    const resultRows = filtered.map(r => selectCols.map(c => r[c]));

    let out = resultRows;
    if (orderMatch) {
      const m = orderMatch[1].trim().match(/(\w+)(?:\s+(ASC|DESC))?/i);
      if (m) {
        const col = m[1];
        const idx = selectCols.indexOf(col);
        if (idx >= 0) {
          out = [...out].sort((a, b) => {
            const av = a[idx], bv = b[idx];
            if (typeof av === 'number' && typeof bv === 'number') return orderMatch[1].toUpperCase().includes('DESC') ? bv - av : av - bv;
            return String(av).localeCompare(String(bv));
          });
        }
      }
    }
    if (limitMatch) out = out.slice(0, Number(limitMatch[1]));

    return { columns: selectCols, rows: out };
  }
}

// ============================================================
// "Tool": Run Python analysis (we use sandboxed JS to mimic stats)
// ============================================================
function runPython(rows: Record<string, any>[], code: string): { metrics: { label: string; value: string }[]; insights: string[] } {
  const metrics: { label: string; value: string }[] = [];
  const insights: string[] = [];

  // Try to extract statistical operations from the python code and execute them in JS
  // This is a demonstration of "running code" - real systems would sandbox-execute Python.

  // Find all numeric columns
  const numericCols: string[] = [];
  for (const key of Object.keys(rows[0] || {})) {
    if (rows.every(r => r[key] === null || r[key] === undefined || !isNaN(Number(r[key])))) {
      numericCols.push(key);
    }
  }

  // Pattern: df['col'].mean() / .sum() / .std() / .min() / .max() / .median()
  const colMethodRegex = /df\[['"](\w+)['"]\]\.(\w+)\(\)/g;
  let m;
  const seen = new Set<string>();
  while ((m = colMethodRegex.exec(code)) !== null) {
    const col = m[1];
    const method = m[2];
    if (seen.has(col + method)) continue;
    seen.add(col + method);
    if (!numericCols.includes(col)) continue;
    const vals = rows.map(r => Number(r[col])).filter(n => !isNaN(n));
    if (vals.length === 0) continue;
    let val: number | null = null;
    if (method === 'mean') val = vals.reduce((s, n) => s + n, 0) / vals.length;
    if (method === 'sum') val = vals.reduce((s, n) => s + n, 0);
    if (method === 'min') val = Math.min(...vals);
    if (method === 'max') val = Math.max(...vals);
    if (method === 'median') {
      const s = [...vals].sort((a, b) => a - b);
      val = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    }
    if (method === 'std') {
      const mean = vals.reduce((s, n) => s + n, 0) / vals.length;
      val = Math.sqrt(vals.reduce((s, n) => s + (n - mean) ** 2, 0) / vals.length);
    }
    if (val !== null) {
      metrics.push({ label: `${method}(${col})`, value: fmtNumber(val) });
    }
  }

  // Pattern: df.corr()['a']['b']
  const corrMatch = code.match(/df\.corr\(\)\[['"](\w+)['"]\]\[['"](\w+)['"]\]/);
  if (corrMatch) {
    const [a, b] = [corrMatch[1], corrMatch[2]];
    const av = rows.map(r => Number(r[a])).filter(n => !isNaN(n));
    const bv = rows.map(r => Number(r[b])).filter(n => !isNaN(n));
    const n = Math.min(av.length, bv.length);
    if (n > 1) {
      const ma = av.slice(0, n).reduce((s, x) => s + x, 0) / n;
      const mb = bv.slice(0, n).reduce((s, x) => s + x, 0) / n;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < n; i++) {
        num += (av[i] - ma) * (bv[i] - mb);
        da += (av[i] - ma) ** 2;
        db += (bv[i] - mb) ** 2;
      }
      const r = num / Math.sqrt(da * db || 1);
      metrics.push({ label: `corr(${a}, ${b})`, value: r.toFixed(3) });
      if (Math.abs(r) > 0.5) insights.push(`Strong ${r > 0 ? 'positive' : 'negative'} correlation between ${a} and ${b}`);
    }
  }

  return { metrics, insights };
}

// ============================================================
// Question understanding (the "LLM" part - rule-based planner)
// ============================================================
interface Plan {
  intent: 'aggregate' | 'trend' | 'distribution' | 'compare' | 'rank' | 'correlation' | 'filter' | 'count';
  groupBy?: string;
  measure?: string;
  agg: 'sum' | 'avg' | 'count' | 'min' | 'max';
  filter?: { col: string; op: string; val: string | number };
  xKey?: string;
  yKey?: string;
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'none';
  confidence: number;
}

function detectColumns(ds: Dataset) {
  const numeric: string[] = [];
  const categorical: string[] = [];
  const date: string[] = [];
  for (const s of ds.schema) {
    if (s.type === 'number') numeric.push(s.name);
    else if (s.type === 'date') date.push(s.name);
    else categorical.push(s.name);
  }
  // Re-check from data
  if (ds.rows.length > 0) {
    for (const key of Object.keys(ds.rows[0])) {
      const t = inferType(ds.rows.slice(0, 100).map(r => r[key]));
      if (t === 'number' && !numeric.includes(key)) numeric.push(key);
      if (t === 'date' && !date.includes(key)) date.push(key);
      if (t === 'string' && !categorical.includes(key)) categorical.push(key);
    }
  }
  return { numeric, categorical, date };
}

function findCol(tokens: string[], cols: string[]): string | undefined {
  if (cols.length === 0) return undefined;
  const lower = tokens.map(t => t.toLowerCase());
  
  // First try exact match
  for (const c of cols) {
    const cLower = c.toLowerCase();
    if (lower.includes(cLower)) return c;
  }
  
  // Then try partial match (token in col name or col name in token)
  for (const c of cols) {
    const cLower = c.toLowerCase();
    for (const t of lower) {
      if (cLower.includes(t) || t.includes(cLower)) return c;
    }
  }
  
  return undefined;
}

function plan(question: string, ds: Dataset): Plan {
  const q = question.toLowerCase();
  const { numeric, categorical, date } = detectColumns(ds);

  // If we have no columns detected, we can't do much
  if (numeric.length === 0 && categorical.length === 0 && date.length === 0) {
    return {
      intent: 'aggregate',
      groupBy: 'unknown',
      measure: 'unknown',
      agg: 'count',
      chartType: 'none',
      confidence: 0,
    };
  }

  // Try to find mentioned columns
  const tokens = q.split(/[\s,?.!]+/).filter(t => t.length > 2);
  let measure = findCol(tokens, numeric);
  let dimension = findCol(tokens, categorical) || findCol(tokens, date);

  // Smart defaults based on question patterns
  if (!measure) {
    // Look for common patterns
    if (/\b(total|sum|revenue|sales|amount|value)\b/.test(q)) {
      // Pick the largest numeric column (likely the main metric)
      measure = numeric[0];
    } else if (/\b(price|cost)\b/.test(q)) {
      measure = numeric.find(c => /price|cost|amount/i.test(c)) || numeric[0];
    } else if (/\b(quantity|count|units|number)\b/.test(q)) {
      measure = numeric.find(c => /quant|count|unit|num/i.test(c)) || numeric[0];
    } else {
      measure = numeric[0];
    }
  }

  if (!dimension) {
    if (/\b(by|per|for each|group|category|type)\b/.test(q)) {
      dimension = categorical[0] || date[0];
    } else if (/\b(time|date|month|year|day|when)\b/.test(q)) {
      dimension = date[0] || categorical[0];
    } else {
      dimension = categorical[0] || date[0] || numeric[1]; // fallback to second numeric for correlation
    }
  }

  // Detect aggregation
  let agg: Plan['agg'] = 'sum';
  if (/\b(avg|average|mean)\b/.test(q)) agg = 'avg';
  else if (/\b(count|how many|number of|records)\b/.test(q)) agg = 'count';
  else if (/\b(min|minimum|lowest|smallest)\b/.test(q)) agg = 'min';
  else if (/\b(max|maximum|highest|largest|top)\b/.test(q)) agg = 'max';
  else if (/\b(total|sum)\b/.test(q)) agg = 'sum';
  // Default for correlation is avg
  else if (/\b(correlation|relationship)\b/.test(q)) agg = 'avg';

  // Detect intent
  let intent: Plan['intent'] = 'aggregate';
  let chartType: Plan['chartType'] = 'bar';
  
  if (/\b(over time|trend|monthly|daily|weekly|yearly|growth|evolution|time series)\b/.test(q)) {
    intent = 'trend';
    chartType = 'line';
  } else if (/\b(distribution|spread|histogram|breakdown|range)\b/.test(q)) {
    intent = 'distribution';
    chartType = 'bar';
  } else if (/\b(correlation|relationship|vs|versus|against|compare.*with|correlate)\b/.test(q)) {
    intent = 'correlation';
    chartType = 'scatter';
  } else if (/\b(compare|comparison)\b/.test(q)) {
    intent = 'compare';
    chartType = 'bar';
  } else if (/\b(top|best|highest|largest|biggest|most|rank|ranking|leading)\b/.test(q)) {
    intent = 'rank';
    chartType = 'bar';
  } else if (/\b(percentage|rate|ratio|share|proportion|pie)\b/.test(q)) {
    intent = 'aggregate';
    chartType = 'pie';
  }

  // Group by default = first categorical, x = first date if trend
  const groupBy = intent === 'trend' ? (date[0] || categorical[0] || measure) : dimension || categorical[0] || date[0];
  const xKey = intent === 'trend' ? (date[0] || groupBy) : groupBy;

  // For correlation, we need two numeric columns
  let finalMeasure = measure;
  let finalGroupBy = groupBy;
  if (intent === 'correlation' && numeric.length >= 2) {
    finalMeasure = measure || numeric[0];
    finalGroupBy = (dimension && numeric.includes(dimension)) ? dimension : numeric[1] || numeric[0];
  }

  return {
    intent,
    groupBy: finalGroupBy,
    measure: finalMeasure,
    agg,
    xKey,
    yKey: finalMeasure,
    chartType,
    confidence: 0.7,
  };
}

// Helper to quote column names with special characters
function quoteCol(name: string): string {
  // If column name has special characters, wrap in backticks
  if (/[^a-zA-Z0-9_]/.test(name)) {
    return '`' + name + '`';
  }
  return name;
}

// ============================================================
// Build SQL & Python from a plan
// ============================================================
function buildSQL(plan: Plan, _ds: Dataset): string {
  const t = `dataset`;
  const groupCol = quoteCol(plan.groupBy || 'unknown');
  const measureCol = quoteCol(plan.measure || 'unknown');
  const xKeyCol = quoteCol(plan.xKey || plan.groupBy || 'unknown');
  
  if (plan.intent === 'trend') {
    return `SELECT DATE_TRUNC('month', ${xKeyCol}) AS period, ${plan.agg.toUpperCase()}(${measureCol}) AS value\nFROM ${t}\nGROUP BY period\nORDER BY period`;
  }
  if (plan.intent === 'rank' || plan.intent === 'aggregate' || plan.intent === 'distribution' || plan.intent === 'compare') {
    return `SELECT ${groupCol}, ${plan.agg.toUpperCase()}(${measureCol}) AS value\nFROM ${t}\nGROUP BY ${groupCol}\nORDER BY value DESC\nLIMIT 12`;
  }
  if (plan.intent === 'correlation') {
    return `SELECT ${measureCol}, ${groupCol} AS x_var\nFROM ${t}\nLIMIT 500`;
  }
  if (plan.intent === 'count') {
    return `SELECT ${groupCol}, COUNT(*) AS n\nFROM ${t}\nGROUP BY ${groupCol}\nORDER BY n DESC`;
  }
  return `SELECT ${groupCol}, ${plan.agg.toUpperCase()}(${measureCol}) AS value\nFROM ${t}\nGROUP BY ${groupCol}\nORDER BY value DESC`;
}

// Helper for Python column access (uses brackets for special chars)
function pyCol(name: string): string {
  if (/[^a-zA-Z0-9_]/.test(name)) {
    return `["${name}"]`;
  }
  return `["${name}"]`;
}

function buildPython(plan: Plan, ds: Dataset): string {
  const measure = plan.measure || 'value';
  const groupBy = plan.groupBy || 'group';
  const xKey = plan.xKey || groupBy;
  
  const lines: string[] = [];
  lines.push(`import pandas as pd`);
  lines.push(`df = pd.read_csv('${ds.name.toLowerCase().replace(/\s+/g, '_')}.csv')`);
  lines.push(`# Summary statistics`);
  if (plan.intent === 'correlation') {
    lines.push(`correlation = df${pyCol(measure)}.corr(df${pyCol(groupBy)})`);
    lines.push(`print(f"Correlation: {correlation:.3f}")`);
  } else if (plan.intent === 'trend') {
    lines.push(`df${pyCol(xKey)} = pd.to_datetime(df${pyCol(xKey)})`);
    lines.push(`monthly = df.groupby(df${pyCol(xKey)}.dt.to_period('M'))${pyCol(measure)}.${plan.agg === 'avg' ? 'mean' : plan.agg}()`);
    lines.push(`print(monthly.head())`);
  } else {
    lines.push(`result = df.groupby(${pyCol(groupBy).slice(1, -1)})${pyCol(measure)}.${plan.agg === 'avg' ? 'mean' : plan.agg}().sort_values(ascending=False).head(12)`);
    lines.push(`print(result)`);
  }
  lines.push(`print(df${pyCol(measure)}.mean(), df${pyCol(measure)}.std())`);
  return lines.join('\n');
}

// ============================================================
// Build chart data from SQL output
// ============================================================
function buildChartData(
  tableOutput: { columns: string[]; rows: any[][] } | null,
  plan: Plan
): { data: any[]; xKey: string | null; series: { key: string; label?: string; color?: string }[]; chartType: Plan['chartType'] } {
  if (!tableOutput || tableOutput.rows.length === 0) {
    return { data: [], xKey: null, series: [], chartType: 'none' };
  }
  const cols = tableOutput.columns;
  const firstCol = cols[0];
  const measureCol = cols[1] || cols[0];

  const data = tableOutput.rows.map(r => {
    const obj: any = { [firstCol]: r[0] };
    obj[measureCol] = typeof r[1] === 'number' ? r[1] : Number(r[1]);
    return obj;
  });

  return {
    data,
    xKey: firstCol,
    series: [{ key: measureCol, label: measureCol }],
    chartType: plan.chartType,
  };
}

// ============================================================
// Interpretation engine
// ============================================================
function interpret(
  _question: string,
  plan: Plan,
  tableOutput: { columns: string[]; rows: any[][] } | null,
  metrics: { label: string; value: string }[]
): string {
  if (!tableOutput || tableOutput.rows.length === 0) {
    return `I couldn't find any matching data for that question. Try a different dataset or rephrase.`;
  }

  const sorted = [...tableOutput.rows].sort((a, b) => Number(b[1]) - Number(a[1]));
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const total = tableOutput.rows.reduce((s, r) => s + Number(r[1] || 0), 0);

  const topVal = Number(top[1]) || 0;
  const bottomVal = Number(bottom[1]) || 0;
  const topName = String(top[0]);
  const bottomName = String(bottom[0]);
  
  // Get a clean measure name for display
  const measureName = plan.measure ? plan.measure.replace(/[_/]/g, ' ') : 'value';
  const groupName = plan.groupBy ? plan.groupBy.replace(/[_/]/g, ' ') : 'group';

  const lines: string[] = [];
  
  if (plan.intent === 'correlation') {
    lines.push(`Analysis shows the relationship between **${measureName}** and **${groupName}**.`);
  } else if (plan.intent === 'trend') {
    lines.push(`Trend analysis of **${measureName}** over time.`);
  } else {
    lines.push(`**${topName}** has the highest **${measureName}** at **${fmtNumber(topVal)}**, while **${bottomName}** has the lowest at **${fmtNumber(bottomVal)}**.`);
  }

  if (tableOutput.rows.length > 1 && total > 0 && plan.intent !== 'correlation') {
    const topShare = (topVal / total * 100).toFixed(1);
    lines.push(`The top result represents **${topShare}%** of the total across all ${tableOutput.rows.length} groups.`);
  }

  if (plan.intent === 'trend' && tableOutput.rows.length > 2) {
    const first = Number(tableOutput.rows[0][1]);
    const last = Number(tableOutput.rows[tableOutput.rows.length - 1][1]);
    if (first > 0) {
      const change = ((last - first) / first * 100).toFixed(1);
      const dir = last >= first ? 'increased' : 'decreased';
      lines.push(`Overall, the value has **${dir} by ${Math.abs(Number(change))}%** from ${fmtNumber(first)} to ${fmtNumber(last)}.`);
    }
  }

  if (metrics.length > 0) {
    const m = metrics[0];
    lines.push(`Statistical summary: ${m.label.replace(/[_/]/g, ' ')} = **${m.value}**.`);
  }

  lines.push(`\n*Analysis based on ${tableOutput.rows.length} groups from your dataset.*`);

  return lines.join(' ');
}

// ============================================================
// Main orchestrator (the "AI agent")
// ============================================================
export async function runAnalysis(
  question: string,
  ds: Dataset,
  onProgress: (u: ProgressUpdate) => void
): Promise<AnalysisResult> {
  const steps: AgentStep[] = [
    { id: 'understand', label: 'Understanding question', status: 'active' },
    { id: 'plan', label: 'Planning analysis steps', status: 'pending' },
    { id: 'query', label: 'Querying dataset', status: 'pending' },
    { id: 'code', label: 'Running Python analysis', status: 'pending' },
    { id: 'chart', label: 'Generating visualization', status: 'pending' },
    { id: 'interpret', label: 'Interpreting results', status: 'pending' },
    { id: 'answer', label: 'Composing final answer', status: 'pending' },
  ];

  const update = (u: Partial<ProgressUpdate>) => onProgress({ steps, ...u });

  // Step 1: Understand
  await sleep(450);
  steps[0] = { ...steps[0], status: 'done', detail: `Detected intent: ${question.toLowerCase().includes('trend') ? 'trend' : 'aggregate'}` };
  steps[1] = { ...steps[1], status: 'active' };
  update({});

  // Step 2: Plan
  await sleep(550);
  const p = plan(question, ds);
  steps[1] = {
    ...steps[1],
    status: 'done',
    detail: `Group by "${p.groupBy}", ${p.agg} of "${p.measure}"`,
  };
  steps[2] = { ...steps[2], status: 'active' };
  update({});

  // Step 3: Query
  await sleep(650);
  const sql = buildSQL(p, ds);
  const tableOutput = runSQL(ds.rows, sql);
  steps[2] = {
    ...steps[2],
    status: 'done',
    output: `${tableOutput.rows.length} rows × ${tableOutput.columns.length} columns`,
  };
  steps[3] = { ...steps[3], status: 'active' };
  update({});

  // Step 4: Code
  await sleep(700);
  const python = buildPython(p, ds);
  const { metrics, insights } = runPython(ds.rows, python);
  steps[3] = {
    ...steps[3],
    status: 'done',
    output: `${metrics.length} statistics computed`,
  };
  steps[4] = { ...steps[4], status: 'active' };
  update({});

  // Step 5: Chart
  await sleep(500);
  const chart = buildChartData(tableOutput, p);
  steps[4] = {
    ...steps[4],
    status: 'done',
    output: `${p.chartType} chart with ${chart.data.length} data points`,
  };
  steps[5] = { ...steps[5], status: 'active' };
  update({});

  // Step 6: Interpret
  await sleep(700);
  const interpretation = interpret(question, p, tableOutput, metrics);
  steps[5] = {
    ...steps[5],
    status: 'done',
    output: `Found ${insights.length} insight(s)`,
  };
  steps[6] = { ...steps[6], status: 'active' };
  update({});

  // Step 7: Final answer
  await sleep(400);
  steps[6] = { ...steps[6], status: 'done' };
  update({});

  return {
    question,
    plan: `Group by "${p.groupBy}" and compute ${p.agg} of "${p.measure}"`,
    sql,
    python,
    tableOutput,
    chartType: chart.chartType,
    chartData: chart.data,
    chartXKey: chart.xKey,
    chartSeries: chart.series,
    interpretation,
    metrics,
  };
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}
