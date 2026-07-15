import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface ChartProps {
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'none';
  data: any[];
  xKey: string | null;
  series: { key: string; label?: string; color?: string }[];
}

const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#22d3ee', '#fb923c', '#a3e635'];

export function ChartView({ type, data, xKey, series }: ChartProps) {
  if (type === 'none' || data.length === 0 || !xKey) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-zinc-500">
        No chart generated for this question
      </div>
    );
  }

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
      <XAxis dataKey={xKey} stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
      <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
      <Tooltip
        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
        labelStyle={{ color: '#a1a1aa' }}
        itemStyle={{ color: '#e4e4e7' }}
      />
      <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
    </>
  );

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey={series[0].key} nameKey={xKey} cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey={xKey} stroke="#71717a" fontSize={11} name={xKey} />
          <YAxis dataKey={series[0].key} stroke="#71717a" fontSize={11} name={series[0].key} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
          <Scatter data={data} fill={COLORS[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          {common}
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color || COLORS[i]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          {common}
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color || COLORS[i]} fill={s.color || COLORS[i]} fillOpacity={0.3} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        {common}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color || COLORS[i]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
