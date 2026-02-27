import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  FileText, AlertTriangle, TrendingUp,
  DollarSign, Activity,
  Network, Globe, Brain, Search, ArrowRight,
  Zap, Shield, Eye, Sparkles, ShieldAlert,
  FolderOpen, ChevronRight, CheckCircle,
} from 'lucide-react'
import { getDashboardStats, getNetworkStats, getSuspiciousSchemes } from '../api'
import type { SuspiciousSchemesResponse } from '../types'
import RiskBadge from '../components/RiskBadge'

const RISK_COLORS: Record<string, string> = {
  LOW: '#22C55E',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  CRITICAL: '#DC2626',
}

const TYPE_COLORS: Record<string, string> = {
  government: '#3B82F6',
  company: '#22C55E',
  intermediary: '#F59E0B',
  offshore: '#EF4444',
}

function formatAmount(val: number): string {
  if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`
  return val.toFixed(0)
}

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Recent investigations from localStorage
  const [recentInvs, setRecentInvs] = useState<any[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('turk_investigations')
      if (raw) setRecentInvs(JSON.parse(raw).slice(0, 3))
    } catch { /* ignore */ }
  }, [])

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
  })

  const { data: netStats } = useQuery({
    queryKey: ['networkStats'],
    queryFn: getNetworkStats,
  })

  const { data: schemes } = useQuery<SuspiciousSchemesResponse>({
    queryKey: ['suspiciousSchemes'],
    queryFn: getSuspiciousSchemes,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-kz-blue border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-400">{t('common.loading')}</span>
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

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-kz-navy via-kz-panel to-kz-navy border border-kz-border p-8">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, #00AFCA 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-kz-blue/20 rounded-xl flex items-center justify-center border border-kz-blue/30">
                <Shield className="w-7 h-7 text-kz-blue" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
                <p className="text-gray-400 text-sm">{t('app.description')}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/network')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-all text-sm"
            >
              <Network className="w-4 h-4" />
              Network Graph
            </button>
            <button
              onClick={() => navigate('/map')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 transition-all text-sm"
            >
              <Globe className="w-4 h-4" />
              Money Flow Map
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ACTIVE INVESTIGATIONS (Pinned to Top) ═══ */}
      <div className={`card border-2 ${recentInvs.length > 0 ? 'border-kz-blue/40 bg-gradient-to-br from-kz-blue/5 via-kz-panel to-kz-navy shadow-lg shadow-kz-blue/10' : 'border-dashed border-white/10'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-kz-blue" />
            <span className="text-white">{t('nav.investigations', 'Расследования')}</span>
            {recentInvs.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-kz-blue/20 text-kz-blue border border-kz-blue/30 font-semibold">
                {recentInvs.length} активных
              </span>
            )}
          </h3>
          <button onClick={() => navigate('/investigations')}
            className="flex items-center gap-1.5 text-xs text-kz-blue hover:text-white border border-kz-blue/30 hover:border-kz-blue px-3 py-1.5 rounded-lg transition-all">
            Все расследования <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentInvs.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-16 h-16 rounded-full bg-kz-surface border border-white/10 flex items-center justify-center mx-auto">
              <FolderOpen className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 text-sm">Расследования не созданы</p>
            <button onClick={() => navigate('/investigations')}
              className="px-6 py-2.5 bg-kz-blue/20 border border-kz-blue/40 text-kz-blue rounded-xl text-sm font-semibold hover:bg-kz-blue/30 transition-all">
              + Создать первое расследование
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentInvs.map((inv: any) => (
              <button key={inv.id}
                onClick={() => navigate('/investigations')}
                className="flex flex-col gap-3 p-4 bg-kz-surface rounded-xl border border-white/5 hover:border-kz-blue/30 hover:bg-kz-blue/5 transition-all text-left group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate mb-1">{inv.name}</div>
                    <div className="text-[11px] text-gray-500">{inv.nodeIds?.length ?? 0} объектов</div>
                  </div>
                  {inv.aiAnalysis ? (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ml-2"
                      style={{
                        backgroundColor: `${inv.aiAnalysis.network_risk_score >= 80 ? '#EF4444' : inv.aiAnalysis.network_risk_score >= 60 ? '#F59E0B' : '#22C55E'}22`,
                        color: inv.aiAnalysis.network_risk_score >= 80 ? '#EF4444' : inv.aiAnalysis.network_risk_score >= 60 ? '#F59E0B' : '#22C55E'
                      }}>
                      {inv.aiAnalysis.network_risk_score ?? '?'}%
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 ml-2">
                      <Brain className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
                {inv.aiAnalysis?.key_findings?.[0] && (
                  <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed border-t border-white/5 pt-2">
                    {inv.aiAnalysis.key_findings[0]}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.aiAnalysis ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                    {inv.aiAnalysis ? 'ИИ-анализ готов' : 'Ожидает анализа'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-kz-blue transition-colors" />
                </div>
              </button>
            ))}
            {recentInvs.length < 3 && (
              <button onClick={() => navigate('/investigations')}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-kz-surface/50 rounded-xl border border-dashed border-white/10 hover:border-kz-blue/30 hover:bg-kz-blue/5 transition-all text-gray-600 hover:text-kz-blue">
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center text-xl font-bold">+</div>
                <span className="text-xs font-medium">Новое расследование</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Executive Summary Widget */}
      <div className="card border-purple-500/30 bg-gradient-to-r from-purple-900/10 via-kz-surface to-purple-900/10 shadow-lg shadow-purple-500/5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/40 flex-shrink-0 mt-1">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              AI Executive Risk Summary <span className="text-[10px] uppercase bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">Auto-Generated</span>
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">
              The system has detected <span className="text-red-400 font-bold">{schemes?.summary.scheme_count || 0} coordinated suspicious schemes</span> across the network. A total of <span className="text-yellow-400 font-bold">₸{formatAmount(stats.total_value_at_risk)}</span> is currently at risk. High concentration of risk is observed in offshore money flows, single-bidder tenders, and rapid sequential withdrawals after large government payouts.
            </p>
            <button onClick={() => navigate('/analyze')} className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1">
              Ask AI to analyze specific regions <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 🔴 Suspicious Schemes Section (MOVED TO TOP) */}
      {schemes && schemes.schemes.length > 0 && (
        <div className="card border-red-500/30 bg-gradient-to-br from-red-950/20 via-kz-navy to-red-950/20 shadow-xl shadow-red-500/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-400" />
              <span className="text-white">{t('dashboard.suspiciousSchemes', 'Active Suspicious Transfer Schemes')}</span>
              <span className="text-xs px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full border border-red-500/30 ml-2 animate-pulse">
                {schemes.summary.scheme_count} detected
              </span>
            </h3>
            <div className="flex gap-3 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold shadow-inner">
                ₸{formatAmount(schemes.summary.total_suspicious_amount)} AT RISK
              </span>
              <span className="px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold shadow-inner">
                ~{schemes.summary.avg_discrepancy_percent.toFixed(1)}% AVG DISCREPANCY
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schemes.schemes.slice(0, 6).map((scheme, idx) => (
              <div key={idx} className="bg-kz-surface/80 rounded-xl p-5 border border-red-500/10 hover:border-red-500/30 hover:bg-kz-surface transition-all shadow-lg group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${scheme.source_type === 'government' ? 'bg-blue-500 text-blue-500' :
                      scheme.source_type === 'company' ? 'bg-green-500 text-green-500' :
                        scheme.source_type === 'intermediary' ? 'bg-yellow-500 text-yellow-500' : 'bg-red-500 text-red-500'
                      }`} />
                    <span className="text-base font-bold text-white truncate max-w-[200px]">{scheme.source_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      Risk {scheme.max_risk_score.toFixed(0)}%
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/map?nodes=${scheme.source_id},${scheme.targets.map(t => t.entity_id).join(',')}`);
                      }}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded text-[10px] uppercase font-bold tracking-wide flex items-center gap-1.5 transition-all shadow-lg group-hover:scale-105"
                      title={t('dashboard.investigate', 'Расследовать')}
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span className="">{t('dashboard.investigate', 'INVESTIGATE')}</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-400 mb-4 bg-black/20 p-2 rounded-lg border border-white/5 inline-block">
                  <span className="text-white font-bold">₸{formatAmount(scheme.total_suspicious_amount)}</span> diverted across <span className="text-white font-bold">{scheme.flow_count}</span> flows
                </div>

                {/* Target chain */}
                <div className="space-y-2 mb-3 bg-kz-panel/50 p-3 rounded-lg border border-white/5">
                  <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Money Trail</div>
                  {scheme.targets.slice(0, 3).map((tgt, ti) => (
                    <div key={ti} className="flex items-center gap-2 text-xs">
                      <ArrowRight className="w-3.5 h-3.5 text-red-400/50" />
                      <span className="text-gray-300 truncate max-w-[150px] font-medium">{tgt.name}</span>
                      <span className="text-gray-500 ml-auto text-[10px] uppercase bg-white/5 px-1.5 py-0.5 rounded">{tgt.flow_type}</span>
                      <span className="text-red-400 font-bold pl-2 border-l border-white/10">₸{formatAmount(tgt.amount)}</span>
                    </div>
                  ))}
                </div>

                {/* Document discrepancies */}
                {scheme.documents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-2">Contract Discrepancies</div>
                    {scheme.documents.slice(0, 2).map((doc, di) => (
                      <div key={di} className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="text-gray-400 truncate max-w-[120px] font-medium">{doc.doc_id}</span>
                        <div className="flex items-center gap-2 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                          <span className="text-blue-400">₸{formatAmount(doc.contract_amount)}</span>
                          <span className="text-gray-600">→</span>
                          <span className={doc.discrepancy_percent > 5 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                            ₸{formatAmount(doc.actual_paid)}
                          </span>
                          {doc.discrepancy_percent > 3 && (
                            <span className="text-red-400 text-[10px] font-bold bg-red-500/10 px-1 rounded">+{doc.discrepancy_percent.toFixed(1)}%</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card group hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => navigate('/tenders')}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{stats.total_tenders.toLocaleString()}</div>
          <div className="text-xs text-gray-400">{t('dashboard.totalTenders')}</div>
        </div>

        <div className="card group hover:border-red-500/50 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-red-400 font-medium">ALERT</span>
            </span>
          </div>
          <div className="text-2xl font-bold text-red-400 mb-1">{stats.high_risk_count + stats.critical_count}</div>
          <div className="text-xs text-gray-400">{t('dashboard.highRisk')}</div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <Zap className="w-4 h-4 text-yellow-500/50" />
          </div>
          <div className="text-2xl font-bold text-yellow-400 mb-1">₸{formatAmount(stats.total_value_at_risk)}</div>
          <div className="text-xs text-gray-400">{t('dashboard.valueAtRisk')}</div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-400 mb-1">{stats.avg_risk_score}%</div>
          <div className="text-xs text-gray-400">{t('dashboard.avgRiskScore')}</div>
        </div>
      </div>

      {/* Network Stats Row */}
      {netStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-kz-panel to-kz-navy border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Network className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Network Entities</span>
            </div>
            <div className="text-xl font-bold text-white">{netStats.total_entities}</div>
          </div>

          <div className="card bg-gradient-to-br from-kz-panel to-kz-navy border-cyan-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-400">Money Flows</span>
            </div>
            <div className="text-xl font-bold text-white">{netStats.total_flows}</div>
          </div>

          <div className="card bg-gradient-to-br from-kz-panel to-kz-navy border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span className="text-xs text-gray-400">Suspicious</span>
            </div>
            <div className="text-xl font-bold text-red-400">{netStats.suspicious_entities + netStats.suspicious_flows}</div>
          </div>

          <div className="card bg-gradient-to-br from-kz-panel to-kz-navy border-orange-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-gray-400">At Risk Amount</span>
            </div>
            <div className="text-xl font-bold text-orange-400">₸{formatAmount(netStats.suspicious_flow_amount)}</div>
          </div>
        </div>
      )}

      {/* Customers Table */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{t('dashboard.topRiskyCustomers')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kz-border text-gray-400">
                <th className="text-left py-3 px-4">#</th>
                <th className="text-left py-3 px-4">{t('tenders.customer')}</th>
                <th className="text-center py-3 px-4">{t('dashboard.totalTenders')}</th>
                <th className="text-center py-3 px-4">{t('dashboard.avgRiskScore')}</th>
                <th className="text-right py-3 px-4">{t('tenders.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_risky_customers.map((c, i) => (
                <tr key={c.tin} className="border-b border-kz-border/50 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                  <td className="py-3 px-4 text-white font-medium">{c.name}</td>
                  <td className="py-3 px-4 text-center">{c.count}</td>
                  <td className="py-3 px-4 text-center">
                    <RiskBadge level={c.avg_score >= 75 ? 'CRITICAL' : c.avg_score >= 50 ? 'HIGH' : c.avg_score >= 25 ? 'MEDIUM' : 'LOW'} label={`${c.avg_score}`} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">₸{formatAmount(c.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
