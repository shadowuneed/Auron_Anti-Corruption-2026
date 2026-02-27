import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Search, Building2, AlertTriangle, ArrowRight, ArrowLeft,
  TrendingDown, User, X, Filter, ArrowUpDown, Network,
  Globe, RefreshCw, ChevronRight, BarChart2, Plus, CheckCircle,
} from 'lucide-react'
import { getNetworkGraph, getEntityDetail } from '../api'
import type { NetworkNode, EntityDetail } from '../types'
import { useNavigate } from 'react-router-dom'

const TYPE_COLORS: Record<string, string> = {
  government: '#3B82F6',
  company: '#22C55E',
  intermediary: '#F59E0B',
  offshore: '#EF4444',
  individual: '#EC4899',
}
const TYPE_NAMES: Record<string, string> = {
  government: 'Гос. орган',
  company: 'Компания',
  intermediary: 'Посредник',
  offshore: 'Оффшор',
  individual: 'Физ. лицо',
}

function fmt(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B ₸'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M ₸'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K ₸'
  return n.toFixed(0) + ' ₸'
}

function RiskBadge({ score }: { score: number }) {
  const color = score > 70 ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : score > 40 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    : 'text-green-400 bg-green-500/10 border-green-500/30'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {score.toFixed(0)}%
    </span>
  )
}

export default function EntitiesDB() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'risk' | 'name' | 'inflow' | 'outflow' | 'txcount'>('risk')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [addedToInv, setAddedToInv] = useState<string | null>(null) // investigation id just added to

  const { data: graphData, isLoading } = useQuery({
    queryKey: ['networkGraph'],
    queryFn: () => getNetworkGraph(),
  })

  const detailMutation = useMutation({
    mutationFn: (id: string) => getEntityDetail(id),
    onSuccess: (data) => { setSelectedEntity(data); setShowDetail(true) },
  })

  // Only show non-individual entities on this page
  const entities = useMemo(() => {
    if (!graphData) return []
    return graphData.nodes.filter(n => n.type !== 'individual')
  }, [graphData])

  const regions = useMemo(() => {
    const set = new Set(entities.map(e => e.region).filter(Boolean))
    return ['all', ...Array.from(set).sort()]
  }, [entities])

  const filtered = useMemo(() => {
    let list = entities
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter)
    if (regionFilter !== 'all') list = list.filter(e => e.region === regionFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.bin_number || '').includes(q) ||
        (e.ceo_name || '').toLowerCase().includes(q) ||
        e.region.toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      let va = 0, vb = 0
      if (sortBy === 'risk') { va = a.risk_score; vb = b.risk_score }
      else if (sortBy === 'inflow') { va = a.total_inflow; vb = b.total_inflow }
      else if (sortBy === 'outflow') { va = a.total_outflow; vb = b.total_outflow }
      else if (sortBy === 'txcount') { va = a.transaction_count; vb = b.transaction_count }
      else return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return list
  }, [entities, typeFilter, regionFilter, search, sortBy, sortDir])

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(field); setSortDir('desc') }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <RefreshCw className="w-8 h-8 text-kz-blue animate-spin" />
    </div>
  )

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">База организаций и компаний</h1>
            <p className="text-sm text-gray-400">Реестр субъектов финансовой системы — {entities.length} записей</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Всего', val: entities.length, color: 'text-white', icon: Building2 },
          { label: 'Гос. органы', val: entities.filter(e => e.type === 'government').length, color: 'text-blue-400', icon: Globe },
          { label: 'Компании', val: entities.filter(e => e.type === 'company').length, color: 'text-green-400', icon: Building2 },
          { label: 'Посредники', val: entities.filter(e => e.type === 'intermediary').length, color: 'text-amber-400', icon: Network },
          { label: 'Оффшоры', val: entities.filter(e => e.type === 'offshore').length, color: 'text-red-400', icon: AlertTriangle },
        ].map(({ label, val, color, icon: Icon }) => (
          <div key={label} className="bg-kz-panel border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[10px] text-gray-500 uppercase font-bold">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="bg-kz-panel border border-white/5 rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию, БИН, ФИО руководителя..."
              className="w-full pl-9 pr-4 py-2.5 bg-kz-surface border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-kz-blue/50 transition-all"
            />
          </div>
          {/* Type filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex bg-kz-surface rounded-xl p-0.5 border border-white/10">
              {(['all', 'government', 'company', 'intermediary', 'offshore'] as const).map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all
                    ${typeFilter === t ? 'bg-kz-blue text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                  {t === 'all' ? 'Все типы' : TYPE_NAMES[t]}
                </button>
              ))}
            </div>
          </div>
          {/* Region filter */}
          <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
            className="bg-kz-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-kz-blue/50">
            {regions.map(r => <option key={r} value={r}>{r === 'all' ? 'Все регионы' : r}</option>)}
          </select>
          <div className="ml-auto text-[10px] text-gray-500">
            {filtered.length} из {entities.length} записей
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-kz-panel border border-white/5 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] text-gray-500 uppercase font-bold">
          <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-white text-left">
            Название <ArrowUpDown className="w-3 h-3" />
          </button>
          <span>Тип / Регион</span>
          <button onClick={() => toggleSort('risk')} className="flex items-center gap-1 hover:text-white">
            Риск <ArrowUpDown className="w-3 h-3" />
          </button>
          <button onClick={() => toggleSort('inflow')} className="flex items-center gap-1 hover:text-white">
            Приток <ArrowUpDown className="w-3 h-3" />
          </button>
          <button onClick={() => toggleSort('outflow')} className="flex items-center gap-1 hover:text-white">
            Отток <ArrowUpDown className="w-3 h-3" />
          </button>
          <button onClick={() => toggleSort('txcount')} className="flex items-center gap-1 hover:text-white">
            Транз. <ArrowUpDown className="w-3 h-3" />
          </button>
          <span>Действия</span>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-white/[0.03]">
          {filtered.map(entity => (
            <div key={entity.id}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer
                ${entity.is_suspicious ? 'border-l-2 border-l-red-500/40' : ''}`}
              onClick={() => detailMutation.mutate(entity.id)}>
              {/* Name */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[entity.type] }} />
                  <span className="text-sm font-medium text-white truncate">{entity.name}</span>
                  {entity.is_suspicious && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                </div>
                {entity.ceo_name && (
                  <div className="text-[10px] text-gray-500 mt-0.5 ml-4 truncate">
                    CEO: {entity.ceo_name}
                  </div>
                )}
                {entity.bin_number && (
                  <div className="text-[9px] text-gray-600 font-mono ml-4">БИН: {entity.bin_number}</div>
                )}
              </div>
              {/* Type + Region */}
              <div>
                <div className="text-[10px] font-medium" style={{ color: TYPE_COLORS[entity.type] }}>
                  {TYPE_NAMES[entity.type]}
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5">{entity.region}</div>
                {entity.founded_year && entity.founded_year > 0 && (
                  <div className="text-[9px] text-gray-600">осн. {entity.founded_year}</div>
                )}
              </div>
              {/* Risk */}
              <div className="flex items-center"><RiskBadge score={entity.risk_score} /></div>
              {/* Inflow */}
              <div className="text-xs text-blue-300 font-mono">{entity.total_inflow > 0 ? fmt(entity.total_inflow) : '—'}</div>
              {/* Outflow */}
              <div className="text-xs text-red-300 font-mono">{entity.total_outflow > 0 ? fmt(entity.total_outflow) : '—'}</div>
              {/* Tx count */}
              <div className="text-xs text-gray-400">{entity.transaction_count}</div>
              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/network?nodes=${entity.id}`) }}
                  title="Показать на графе"
                  className="p-1.5 rounded-lg bg-kz-blue/10 hover:bg-kz-blue/20 text-kz-blue transition-colors">
                  <Network className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); detailMutation.mutate(entity.id) }}
                  title="Детали"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-20 text-center text-gray-500">
              Записи не найдены. Попробуйте изменить фильтры.
            </div>
          )}
        </div>
      </div>

      {/* ─── Entity Detail Panel ─── */}
      {showDetail && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDetail(false)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0d1b2e] border border-white/10 rounded-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {/* Modal header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: TYPE_COLORS[selectedEntity.entity.type] + '20' }}>
                    <Building2 className="w-7 h-7" style={{ color: TYPE_COLORS[selectedEntity.entity.type] }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white leading-tight">{selectedEntity.entity.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2.5 py-0.5 rounded-full border font-medium"
                        style={{
                          color: TYPE_COLORS[selectedEntity.entity.type],
                          borderColor: TYPE_COLORS[selectedEntity.entity.type] + '40',
                          backgroundColor: TYPE_COLORS[selectedEntity.entity.type] + '10',
                        }}>
                        {TYPE_NAMES[selectedEntity.entity.type]}
                      </span>
                      <span className="text-xs text-gray-500">{selectedEntity.entity.region} · {selectedEntity.entity.country}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDetail(false)}
                  className="text-gray-400 hover:text-white bg-white/5 p-1.5 rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Риск-балл</div>
                  <div className={`text-2xl font-bold ${
                    selectedEntity.entity.risk_score > 60 ? 'text-red-400' : selectedEntity.entity.risk_score > 30 ? 'text-yellow-400' : 'text-green-400'
                  }`}>{selectedEntity.entity.risk_score.toFixed(0)}</div>
                </div>
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Транзакций</div>
                  <div className="text-2xl font-bold text-white">{selectedEntity.entity.transaction_count}</div>
                </div>
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Приток</div>
                  <div className="text-sm font-bold text-blue-400">{fmt(selectedEntity.entity.total_inflow)}</div>
                </div>
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Отток</div>
                  <div className="text-sm font-bold text-red-400">{fmt(selectedEntity.entity.total_outflow)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Company details */}
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase">Реквизиты</span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    {(selectedEntity.entity as any).bin_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">БИН</span>
                        <span className="text-gray-200 font-mono">{(selectedEntity.entity as any).bin_number}</span>
                      </div>
                    )}
                    {(selectedEntity.entity as any).founded_year > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Год основания</span>
                        <span className="text-gray-200">{(selectedEntity.entity as any).founded_year}</span>
                      </div>
                    )}
                    {(selectedEntity.entity as any).employee_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Сотрудников</span>
                        <span className="text-gray-200">{(selectedEntity.entity as any).employee_count}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Страна</span>
                      <span className="text-gray-200">{selectedEntity.entity.country}</span>
                    </div>
                  </div>
                </div>
                {/* CEO */}
                {(selectedEntity.entity as any).ceo_name && (
                  <div className="bg-kz-surface rounded-2xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-gray-400 uppercase">Руководитель / CEO</span>
                    </div>
                    <div className="text-sm font-bold text-white mb-2">{(selectedEntity.entity as any).ceo_name}</div>
                    {(selectedEntity.entity as any).ceo_iin && (
                      <div className="text-[10px] text-gray-500 font-mono">ИИН: {(selectedEntity.entity as any).ceo_iin}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Tender audit */}
              {(selectedEntity.entity as any).tender_won_amount > 0 && (
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase">Аудит тендеров и контрактов</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 mb-1">Выиграно тендеров</div>
                      <div className="text-xl font-bold text-blue-400">{fmt((selectedEntity.entity as any).tender_won_amount)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 mb-1">Факт. расходы</div>
                      <div className="text-xl font-bold text-red-400">{fmt((selectedEntity.entity as any).actual_spent_amount)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 mb-1">Разница</div>
                      {(() => {
                        const won = (selectedEntity.entity as any).tender_won_amount || 0
                        const spent = (selectedEntity.entity as any).actual_spent_amount || 0
                        const diff = won - spent
                        const pct = won > 0 ? ((diff / won) * 100).toFixed(0) : '0'
                        return <div className="text-xl font-bold text-rose-400">
                          {diff > 0 ? `+${fmt(diff)}` : fmt(diff)} ({pct}%)
                        </div>
                      })()}
                    </div>
                  </div>
                  {/* Visual bar */}
                  {(() => {
                    const won = (selectedEntity.entity as any).tender_won_amount || 0
                    const spent = (selectedEntity.entity as any).actual_spent_amount || 0
                    const pct = won > 0 ? Math.min(100, (spent / won) * 100) : 0
                    return (
                      <div>
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                          <span>Использовано бюджета</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: pct < 30 ? '#EF4444' : '#22C55E' }}/>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Suspicion alert */}
              {(selectedEntity.entity as any).suspicion_summary && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-red-400 mb-1">Подозрение к расследованию</div>
                    <div className="text-xs text-red-300 leading-relaxed">{(selectedEntity.entity as any).suspicion_summary}</div>
                  </div>
                </div>
              )}

              {/* Flows summary */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                    <ArrowRight className="w-3 h-3" />Исходящие ({selectedEntity.outgoing_flows.length})
                  </h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedEntity.outgoing_flows.slice(0, 10).map(f => (
                      <div key={f.id} className={`p-2.5 rounded-xl border text-[10px] ${f.is_suspicious ? 'bg-red-500/5 border-red-500/20' : 'bg-kz-panel/50 border-white/5'}`}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-gray-300 truncate flex-1">{f.target_name}</span>
                          <span className="font-bold text-white ml-2">{fmt(f.amount)}</span>
                        </div>
                        <div className="text-gray-600">{f.flow_type}{f.flow_date ? ` · ${new Date(f.flow_date).toLocaleDateString('ru-RU')}` : ''}</div>
                      </div>
                    ))}
                    {selectedEntity.outgoing_flows.length === 0 && <div className="text-gray-600 text-center py-3">Нет</div>}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                    <ArrowLeft className="w-3 h-3" />Входящие ({selectedEntity.incoming_flows.length})
                  </h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedEntity.incoming_flows.slice(0, 10).map(f => (
                      <div key={f.id} className={`p-2.5 rounded-xl border text-[10px] ${f.is_suspicious ? 'bg-red-500/5 border-red-500/20' : 'bg-kz-panel/50 border-white/5'}`}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-gray-300 truncate flex-1">{f.source_name}</span>
                          <span className="font-bold text-white ml-2">{fmt(f.amount)}</span>
                        </div>
                        <div className="text-gray-600">{f.flow_type}{f.flow_date ? ` · ${new Date(f.flow_date).toLocaleDateString('ru-RU')}` : ''}</div>
                      </div>
                    ))}
                    {selectedEntity.incoming_flows.length === 0 && <div className="text-gray-600 text-center py-3">Нет</div>}
                  </div>
                </div>
              </div>

              {/* Connected entities */}
              {selectedEntity.connected_entities.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                    <Network className="w-3 h-3" />Связанные субъекты ({selectedEntity.connected_entities.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntity.connected_entities.map((ce: any) => (
                      <button key={ce.id} onClick={() => detailMutation.mutate(ce.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-kz-surface border border-white/10 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[ce.type] || '#6B7280' }} />
                        {ce.name}
                        <span className={`text-[9px] ${ce.risk_score > 60 ? 'text-red-400' : 'text-gray-500'}`}>{ce.risk_score?.toFixed(0)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-2">
                {/* Add to investigation quick-picker */}
                {(() => {
                  const STORAGE_KEY = 'turk_investigations'
                  let invs: { id: string; name: string; nodeIds: string[] }[] = []
                  try { invs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch {}
                  const entityId = selectedEntity.entity.id
                  return (
                    <div className="border border-white/5 rounded-2xl p-3 bg-kz-surface">
                      <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1.5">
                        <Plus className="w-3 h-3" /> Добавить в расследование
                      </div>
                      {invs.length === 0 ? (
                        <p className="text-[11px] text-gray-600">Нет расследований. Создайте на странице «Расследования».</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {invs.map(inv => {
                            const alreadyIn = inv.nodeIds.includes(entityId)
                            const justAdded = addedToInv === inv.id
                            return (
                              <button
                                key={inv.id}
                                disabled={alreadyIn}
                                onClick={() => {
                                  const updated = invs.map(i =>
                                    i.id === inv.id
                                      ? { ...i, nodeIds: [...new Set([...i.nodeIds, entityId])] }
                                      : i
                                  )
                                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
                                  setAddedToInv(inv.id)
                                  setTimeout(() => setAddedToInv(null), 2000)
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-all ${
                                  alreadyIn
                                    ? 'opacity-40 cursor-default border-white/5 text-gray-500'
                                    : justAdded
                                    ? 'border-green-500/40 bg-green-500/10 text-green-400'
                                    : 'border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10'
                                }`}>
                                {justAdded ? <CheckCircle className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                                {inv.name.length > 28 ? inv.name.slice(0, 26) + '…' : inv.name}
                                {alreadyIn && ' ✓'}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDetail(false); navigate(`/network?nodes=${selectedEntity.entity.id}`) }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-kz-blue/20 border border-kz-blue/30 rounded-xl text-kz-blue text-sm font-medium hover:bg-kz-blue/30 transition-all">
                    <Network className="w-4 h-4" /> Открыть в расследовании
                  </button>
                  <button onClick={() => setShowDetail(false)}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-sm hover:text-white hover:bg-white/10 transition-all">
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for detail */}
      {detailMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-3 bg-kz-panel border border-white/10 rounded-2xl p-4">
            <RefreshCw className="w-5 h-5 text-kz-blue animate-spin" />
            <span className="text-sm text-gray-300">Загрузка данных...</span>
          </div>
        </div>
      )}
      {/* Suppress unused import warning */}
      <span className="hidden"><BarChart2 /></span>
    </div>
  )
}
