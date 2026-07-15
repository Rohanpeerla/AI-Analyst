export interface Dataset {
  id: string;
  name: string;
  description: string;
  rows: Record<string, any>[];
  schema: { name: string; type: 'number' | 'string' | 'date' }[];
}

const SALES_DATA = (() => {
  const regions = ['North', 'South', 'East', 'West'];
  const products = ['Pro Plan', 'Team Plan', 'Enterprise', 'Starter', 'Free Trial'];
  const reps = ['Alice Chen', 'Marcus Johnson', 'Priya Patel', 'Diego Hernandez', 'Yuki Tanaka', 'Emma Wilson', 'Omar Hassan', 'Sofia Rossi'];
  const rows: Record<string, any>[] = [];
  const start = new Date('2024-01-01');
  for (let i = 0; i < 220; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 3);
    const product = products[Math.floor(Math.random() * products.length)];
    const baseAmount = product === 'Enterprise' ? 12000 : product === 'Team Plan' ? 2400 : product === 'Pro Plan' ? 890 : product === 'Starter' ? 290 : 0;
    const seasonal = 1 + 0.25 * Math.sin((i / 30) * Math.PI);
    const noise = 0.7 + Math.random() * 0.6;
    const amount = Math.round(baseAmount * seasonal * noise);
    rows.push({
      date: d.toISOString().slice(0, 10),
      region: regions[Math.floor(Math.random() * regions.length)],
      product,
      rep: reps[Math.floor(Math.random() * reps.length)],
      amount,
      units: Math.max(1, Math.round(amount / (baseAmount || 1) * (1 + Math.random()))),
      closed: Math.random() > 0.18,
    });
  }
  return rows;
})();

const SALES_SCHEMA = [
  { name: 'date', type: 'date' as const },
  { name: 'region', type: 'string' as const },
  { name: 'product', type: 'string' as const },
  { name: 'rep', type: 'string' as const },
  { name: 'amount', type: 'number' as const },
  { name: 'units', type: 'number' as const },
  { name: 'closed', type: 'number' as const },
];

const MARKETING_DATA = (() => {
  const channels = ['Google Ads', 'Facebook', 'LinkedIn', 'Email', 'Organic', 'Referral'];
  const rows: Record<string, any>[] = [];
  const start = new Date('2024-01-01');
  for (let i = 0; i < 180; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 2);
    const channel = channels[Math.floor(Math.random() * channels.length)];
    const spend = Math.round(500 + Math.random() * 4500);
    const impressions = Math.round(spend * (40 + Math.random() * 80));
    const clicks = Math.round(impressions * (0.01 + Math.random() * 0.04));
    const conversions = Math.round(clicks * (0.02 + Math.random() * 0.08));
    rows.push({
      date: d.toISOString().slice(0, 10),
      channel,
      campaign: `${channel.split(' ')[0]}-${['Brand', 'Retarget', 'Lookalike', 'Promo', 'Launch'][Math.floor(Math.random() * 5)]}`,
      spend,
      impressions,
      clicks,
      conversions,
    });
  }
  return rows;
})();

const MARKETING_SCHEMA = [
  { name: 'date', type: 'date' as const },
  { name: 'channel', type: 'string' as const },
  { name: 'campaign', type: 'string' as const },
  { name: 'spend', type: 'number' as const },
  { name: 'impressions', type: 'number' as const },
  { name: 'clicks', type: 'number' as const },
  { name: 'conversions', type: 'number' as const },
];

const HR_DATA = (() => {
  const departments = ['Engineering', 'Sales', 'Marketing', 'Operations', 'Finance', 'HR'];
  const rows: Record<string, any>[] = [];
  for (let i = 0; i < 90; i++) {
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const baseSalary = dept === 'Engineering' ? 120000 : dept === 'Sales' ? 85000 : dept === 'Finance' ? 95000 : 65000;
    const salary = Math.round(baseSalary * (0.85 + Math.random() * 0.5));
    rows.push({
      employee_id: `E${1000 + i}`,
      department: dept,
      tenure_months: Math.floor(2 + Math.random() * 90),
      salary,
      performance_score: +(2 + Math.random() * 3).toFixed(2),
      satisfaction: +(1 + Math.random() * 5).toFixed(1),
      remote: Math.random() > 0.4,
    });
  }
  return rows;
})();

const HR_SCHEMA = [
  { name: 'employee_id', type: 'string' as const },
  { name: 'department', type: 'string' as const },
  { name: 'tenure_months', type: 'number' as const },
  { name: 'salary', type: 'number' as const },
  { name: 'performance_score', type: 'number' as const },
  { name: 'satisfaction', type: 'number' as const },
  { name: 'remote', type: 'number' as const },
];

export const SAMPLE_DATASETS: Dataset[] = [
  {
    id: 'sales',
    name: 'Sales Pipeline',
    description: '220 deals across regions, products, and reps',
    rows: SALES_DATA,
    schema: SALES_SCHEMA,
  },
  {
    id: 'marketing',
    name: 'Marketing Campaigns',
    description: '180 days of channel performance metrics',
    rows: MARKETING_DATA,
    schema: MARKETING_SCHEMA,
  },
  {
    id: 'hr',
    name: 'HR & Compensation',
    description: '90 employees with salary, performance, satisfaction',
    rows: HR_DATA,
    schema: HR_SCHEMA,
  },
];

export const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  sales: [
    'What is the total revenue by region?',
    'Show me the top 5 reps by amount sold',
    'What is the monthly revenue trend?',
    'Compare average deal size by product',
    'What percentage of deals are closing?',
  ],
  marketing: [
    'Which channel has the best ROI?',
    'Show me the conversion rate by channel',
    'What is the cost per click trend over time?',
    'Compare spend vs conversions by campaign',
  ],
  hr: [
    'What is the average salary by department?',
    'Show satisfaction vs performance correlation',
    'What is the salary distribution?',
    'Compare remote vs in-office satisfaction',
  ],
};
