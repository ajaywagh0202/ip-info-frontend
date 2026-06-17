import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Cpu, Gauge, HardDrive, ShieldCheck } from 'lucide-react';
import axiosInstance from '../../utils/axiosInstance.js';
import { getAdminProfile } from '../../utils/adminAuth.js';
import LoadingSpinner from '../../components/LoadingSpinner.jsx';
import StatCard from '../../components/StatCard.jsx';
import FindingsBlock from '../../components/FindingsBlock.jsx';

const chartPalette = ['#FF6200', '#003580', '#4A90D9', '#FFA64D', '#7A9CC6', '#cccccc'];
const gradeColors = {
  A: '#4CAF50',
  B: '#8BC34A',
  C: '#FFC107',
  D: '#FF9800',
  F: '#F44336',
};

function toNumber(value, decimals = 0) {
  const numeric = Number(value || 0);
  return Number(numeric.toFixed(decimals));
}

function normalizeList(list, labelKey, fallbackLabel) {
  return Array.isArray(list)
    ? list.map((item) => ({
        ...item,
        [labelKey]: item?.[labelKey] || item?.name || item?.label || fallbackLabel,
        count: toNumber(item?.count ?? item?.total ?? item?.value),
      }))
    : [];
}

function NoData() {
  return <div className="chart-placeholder">No data available</div>;
}

function ChartCard({ title, children, hasData }) {
  return (
    <section className="analytics-chart-card">
      <h2>{title}</h2>
      <div className="analytics-chart-body">{hasData ? children : <NoData />}</div>
    </section>
  );
}

function pieLegendFormatter(value, entry) {
  const payload = entry?.payload;
  if (!payload) return value;
  const percent = payload.total ? ((payload.count / payload.total) * 100).toFixed(1) : '0.0';
  return `${value} (${percent}%)`;
}

function osLegendFormatter(value, entry) {
  const payload = entry?.payload;
  return payload ? `${value} (${payload.count})` : value;
}

export default function AnalyticsDashboard() {
  const profile = getAdminProfile();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosInstance.get('/api/admin/analytics/summary');
      setSummary(data?.data || data || {});
    } catch (err) {
      setError(err.friendlyMessage || 'Unable to load analytics dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const analytics = summary || {};
  const overview = analytics.overview_stats || {};

  const cpuData = useMemo(() => normalizeList(analytics.cpu_distribution, 'cpu_model', 'Unknown CPU'), [analytics.cpu_distribution]);
  const ramData = useMemo(() => {
    const rows = normalizeList(analytics.ram_distribution, 'ram_size', 'Unknown RAM');
    const total = rows.reduce((sum, item) => sum + item.count, 0);
    return rows.map((item) => ({ ...item, total }));
  }, [analytics.ram_distribution]);
  const osData = useMemo(() => {
    const rows = normalizeList(analytics.os_distribution, 'os', 'Unknown OS');
    const total = rows.reduce((sum, item) => sum + item.count, 0);
    return rows.map((item) => ({ ...item, total }));
  }, [analytics.os_distribution]);
  const gradeData = useMemo(() => normalizeList(analytics.security_grade_distribution, 'grade', '-'), [analytics.security_grade_distribution]);
  const totalOsDevices = osData.reduce((sum, item) => sum + item.count, 0);
  const findings = analytics.findings_summary || {};

  return (
    <section className="dashboard-page analytics-page">
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Analytics</p>
          <h1>Analytics Dashboard</h1>
          <p>{profile.user_type === 1 ? `Department: ${profile.dept_name || 'Department'}` : 'All Departments'}</p>
        </div>
      </div>

      {loading ? <LoadingSpinner label="Loading analytics" /> : null}

      {!loading && error ? (
        <div className="analytics-error">
          <div className="alert alert-error">{error}</div>
          <button className="primary-button" type="button" onClick={loadSummary}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="analytics-stat-grid">
            <StatCard icon={HardDrive} label="Total Devices" value={toNumber(overview.total_devices).toLocaleString('en-IN')} />
            <StatCard icon={ShieldCheck} label="Avg Security Score" value={toNumber(overview.avg_score, 1)} />
            <StatCard icon={Cpu} label="Avg CPU Usage" value={`${toNumber(overview.avg_cpu_usage, 1)}%`} />
            <StatCard icon={Gauge} label="Avg RAM Usage" value={`${toNumber(overview.avg_ram_usage, 1)}%`} />
          </div>

          <div className="analytics-chart-grid">
            <ChartCard title="CPU Model Distribution" hasData={cpuData.length > 0}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cpuData} layout="vertical" margin={{ top: 8, right: 34, left: 24, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="cpu_model" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#003580" radius={[0, 6, 6, 0]}>
                    <LabelList dataKey="count" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="RAM Size Distribution" hasData={ramData.length > 0}>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={ramData} dataKey="count" nameKey="ram_size" cx="50%" cy="46%" outerRadius={96}>
                    {ramData.map((entry, index) => (
                      <Cell key={entry.ram_size} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend formatter={pieLegendFormatter} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="analytics-chart-grid">
            <ChartCard title="OS Distribution" hasData={osData.length > 0}>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={osData} dataKey="count" nameKey="os" cx="50%" cy="48%" innerRadius={62} outerRadius={100}>
                    {osData.map((entry, index) => (
                      <Cell key={entry.os} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                    <LabelList dataKey="count" position="outside" />
                  </Pie>
                  <text className="donut-center-number" x="50%" y="47%" textAnchor="middle" dominantBaseline="middle">
                    {totalOsDevices}
                  </text>
                  <text className="donut-center-label" x="50%" y="55%" textAnchor="middle" dominantBaseline="middle">
                    devices
                  </text>
                  <Tooltip />
                  <Legend formatter={osLegendFormatter} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Security Grade Distribution" hasData={gradeData.length > 0}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={gradeData} margin={{ top: 22, right: 18, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="grade" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {gradeData.map((entry) => (
                      <Cell key={entry.grade} fill={gradeColors[entry.grade] || '#003580'} />
                    ))}
                    <LabelList dataKey="count" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <section className="analytics-findings-card">
            <h2>Security Findings Summary (All Devices)</h2>
            <div className="findings-grid">
              <FindingsBlock label="CRITICAL" value={toNumber(findings.total_critical)} tone="critical" />
              <FindingsBlock label="HIGH" value={toNumber(findings.total_high)} tone="high" />
              <FindingsBlock label="MEDIUM" value={toNumber(findings.total_medium)} tone="medium" />
              <FindingsBlock label="LOW" value={toNumber(findings.total_low)} tone="low" />
              <FindingsBlock label="INFO" value={toNumber(findings.total_info)} tone="info" />
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
