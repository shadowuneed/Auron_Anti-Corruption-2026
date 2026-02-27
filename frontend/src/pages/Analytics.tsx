import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { getDashboardStats } from '../api'

const COLORS = ['#00AFCA', '#FFD700', '#EF4444', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4']

const RISK_COLORS: Record<string, string> = {
  LOW: '#22C55E',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  CRITICAL: '#DC2626',
}

export default function Analytics() {
  const { t } = useTranslation()
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-kz-blue border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-400">{t('common.error')}</p>
      </div>
    )
  }

  const pieData = Object.entries(stats.risk_distribution).map(([key, value]) => ({
    name: t(`risk.${key}`),
    value,
    color: RISK_COLORS[key],
  }))

  const tooltipStyle = {
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#fff',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('analytics.title')}</h1>
        <p className="text-gray-400 text-sm mt-1">{t('analytics.subtitle')}</p>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Trend */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">{t('analytics.trendAnalysis')}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthly_trends}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00AFCA" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00AFCA" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="avg_score"
                  stroke="#00AFCA"
                  fill="url(#colorScore)"
                  strokeWidth={2}
                  name="Avg Risk Score"
                />
                <Area
                  type="monotone"
                  dataKey="high_risk"
                  stroke="#EF4444"
                  fill="url(#colorHigh)"
                  strokeWidth={2}
                  name="High Risk Count"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution (larger) */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">{t('dashboard.riskDistribution')}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  dataKey="value"
                  paddingAngle={4}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk by Region */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">{t('analytics.riskByRegion')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.top_risky_regions} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94A3B8" fontSize={12} />
                <YAxis
                  dataKey="region"
                  type="category"
                  width={140}
                  stroke="#94A3B8"
                  fontSize={10}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="avg_score" radius={[0, 4, 4, 0]} name="Avg Risk Score">
                  {stats.top_risky_regions.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.avg_score >= 50
                          ? '#EF4444'
                          : entry.avg_score >= 25
                          ? '#F59E0B'
                          : '#22C55E'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Flag Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">{t('analytics.flagDistribution')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.common_flags}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="flag_type"
                  stroke="#94A3B8"
                  fontSize={10}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                  {stats.common_flags.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3 — Tenders per month */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{t('analytics.competitionLevel')}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.monthly_trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#FFD700"
                strokeWidth={2}
                dot={{ fill: '#FFD700', r: 4 }}
                name="Total Tenders"
              />
              <Line
                type="monotone"
                dataKey="high_risk"
                stroke="#EF4444"
                strokeWidth={2}
                dot={{ fill: '#EF4444', r: 4 }}
                name="Flagged"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Repeat Winners Table */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{t('analytics.repeatWinners')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kz-border text-gray-400 text-left">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">{t('tenders.customer')}</th>
                <th className="py-3 px-4 text-center">{t('dashboard.totalTenders')}</th>
                <th className="py-3 px-4 text-center">{t('dashboard.avgRiskScore')}</th>
                <th className="py-3 px-4 text-right">{t('tenders.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_risky_customers.map((c, i) => (
                <tr
                  key={i}
                  className="border-b border-kz-border/50 hover:bg-white/5"
                >
                  <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                  <td className="py-3 px-4 text-white">{c.name}</td>
                  <td className="py-3 px-4 text-center">{c.count}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={
                        c.avg_score >= 50
                          ? 'text-red-400'
                          : c.avg_score >= 25
                          ? 'text-yellow-400'
                          : 'text-green-400'
                      }
                    >
                      {c.avg_score}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">
                    ₸{(c.total_amount / 1e6).toFixed(1)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
