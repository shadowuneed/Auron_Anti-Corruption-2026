import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Search, User, AlertTriangle, ArrowRight, ArrowLeft,
  X, Network, RefreshCw, ChevronRight, Shield, ArrowUpDown,
  Plus, CheckCircle,
} from 'lucide-react'
import { getNetworkGraph, getEntityDetail } from '../api'
import type { EntityDetail } from '../types'
import { useNavigate } from 'react-router-dom'

function fmt(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B ₸'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M ₸'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K ₸'
  return n.toFixed(0) + ' ₸'
}

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  director: { label: 'Директор', color: '#EC4899' },
  founder: { label: 'Учредитель', color: '#06B6D4' },
  relative: { label: 'Родственник', color: '#F97316' },
}

export default function PersonsDB() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'risk' | 'name' | 'txcount'>('risk')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [addedToInv, setAddedToInv] = useState<string | null>(null)

  const { data: graphData, isLoading } = useQuery({
    queryKey: ['networkGraph'],
    queryFn: () => getNetworkGraph(),
  })

  const detailMutation = useMutation({
    mutationFn: (id: string) => getEntityDetail(id),
    onSuccess: (data) => { setSelectedEntity(data); setShowDetail(true) },
  })

  // Only individual type entities
  const persons = useMemo(() => {
    if (!graphData) return []
    return graphData.nodes.filter(n => (n.type as string) === 'individual')
  }, [graphData])

  // For each person, find their connections (director/founder/relative edges)
  const personConnections = useMemo(() => {
    if (!graphData) return new Map<string, string[]>()
    const map = new Map<string, string[]>()
    const relTypes = new Set(['director', 'founder', 'relative'])
    graphData.edges.forEach(e => {
      const srcId = typeof e.source === 'object' ? (e.source as any).id : e.source
      const tgtId = typeof e.target === 'object' ? (e.target as any).id : e.target
      if (relTypes.has(e.flow_type)) {
        if (persons.some(p => p.id === srcId)) {
          const conn = map.get(srcId) || []
          conn.push(tgtId)
          map.set(srcId, conn)
        }
        if (persons.some(p => p.id === tgtId)) {
          const conn = map.get(tgtId) || []
          conn.push(srcId)
          map.set(tgtId, conn)
        }
      }
    })
    return map
  }, [graphData, persons])

  const nodeMap = useMemo(() => {
    if (!graphData) return new Map()
    return new Map(graphData.nodes.map(n => [n.id, n]))
  }, [graphData])

  const filtered = useMemo(() => {
    let list = persons
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.ceo_iin || '').includes(q) ||
        p.region.toLowerCase().includes(q) ||
        (p.suspicion_summary || '').toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      if (sortBy === 'txcount') return sortDir === 'asc' ? a.transaction_count - b.transaction_count : b.transaction_count - a.transaction_count
      return sortDir === 'asc' ? a.risk_score - b.risk_score : b.risk_score - a.risk_score
    })
    return list
  }, [persons, search, sortBy, sortDir])

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
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">База физических лиц</h1>
            <p className="text-sm text-gray-400">
              Реестр аффилированных лиц — {persons.length} записей
            </p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Всего', val: persons.length, color: 'text-white' },
          { label: 'Подозрительных', val: persons.filter(p => p.is_suspicious).length, color: 'text-red-400' },
          { label: 'Директоров', val: graphData?.edges.filter(e => e.flow_type === 'director').length || 0, color: 'text-pink-400' },
          { label: 'Учредителей', val: graphData?.edges.filter(e => e.flow_type === 'founder').length || 0, color: 'text-cyan-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-kz-panel border border-white/5 rounded-2xl p-4">
            <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Search + Sort */}
      <div className="bg-kz-panel border border-white/5 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по ФИО, ИИН, подозрению..."
              className="w-full pl-9 pr-4 py-2.5 bg-kz-surface border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-all" />
          </div>
          <div className="text-[10px] text-gray-500">{filtered.length} записей</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-kz-panel border border-white/5 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] text-gray-500 uppercase font-bold">
          <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-white text-left">
            ФИО <ArrowUpDown className="w-3 h-3" />
          </button>
          <span>Роль / Связанные</span>
          <button onClick={() => toggleSort('risk')} className="flex items-center gap-1 hover:text-white">
            Риск <ArrowUpDown className="w-3 h-3" />
          </button>
          <span>ИИН</span>
          <span>Действия</span>
        </div>

        <div className="divide-y divide-white/[0.03]">
          {filtered.map(person => {
            const connections = personConnections.get(person.id) || []
            // Try to detect role from suspicion_summary
            const suspText = (person.suspicion_summary || '').toLowerCase()
            const roleKey = suspText.includes('директор') ? 'director'
              : suspText.includes('учредитель') ? 'founder'
              : suspText.includes('родственн') ? 'relative'
              : null
            const role = roleKey ? ROLE_MAP[roleKey] : null

            return (
              <div key={person.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer border-l-2 border-l-pink-500/30"
                onClick={() => detailMutation.mutate(person.id)}>
                {/* Name */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-pink-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white truncate">{person.name}</div>
                      {person.suspicion_summary && (
                        <div className="text-[9px] text-red-300 mt-0.5 truncate flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />{person.suspicion_summary}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Role + connections */}
                <div>
                  {role && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium mb-1"
                      style={{ color: role.color, borderColor: role.color + '40', backgroundColor: role.color + '15' }}>
                      {role.label}
                    </span>
                  )}
                  {connections.length > 0 && (
                    <div className="text-[9px] text-gray-500">
                      {connections.slice(0, 2).map(cid => {
                        const cn = nodeMap.get(cid)
                        return cn ? <div key={cid} className="truncate">{cn.name}</div> : null
                      })}
                      {connections.length > 2 && <div className="text-gray-600">+{connections.length - 2}</div>}
                    </div>
                  )}
                </div>
                {/* Risk */}
                <div className="flex items-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    person.risk_score > 70 ? 'text-red-400 bg-red-500/10 border-red-500/30'
                    : person.risk_score > 40 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                    : 'text-green-400 bg-green-500/10 border-green-500/30'
                  }`}>{person.risk_score.toFixed(0)}%</span>
                </div>
                {/* IIN */}
                <div className="text-xs text-gray-500 font-mono">
                  {(person as any).ceo_iin || '—'}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button onClick={e => { e.stopPropagation(); navigate(`/network?nodes=${person.id}`) }}
                    title="Граф"
                    className="p-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 transition-colors">
                    <Network className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); detailMutation.mutate(person.id) }}
                    title="Детали"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-20 text-center text-gray-500">Записи не найдены</div>
          )}
        </div>
      </div>

      {/* ─── Person Detail Modal ─── */}
      {showDetail && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDetail(false)}>
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#0d1b2e] border border-white/10 rounded-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center">
                    <User className="w-7 h-7 text-pink-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedEntity.entity.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2.5 py-0.5 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-400 font-medium">
                        Физическое лицо
                      </span>
                      {selectedEntity.entity.is_suspicious && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Подозрение
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-white bg-white/5 p-1.5 rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Риск</div>
                  <div className={`text-2xl font-bold ${selectedEntity.entity.risk_score > 60 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {selectedEntity.entity.risk_score.toFixed(0)}
                  </div>
                </div>
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Транзакций</div>
                  <div className="text-2xl font-bold text-white">{selectedEntity.entity.transaction_count}</div>
                </div>
                <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Регион</div>
                  <div className="text-xs font-bold text-white mt-1">{selectedEntity.entity.region}</div>
                </div>
              </div>

              {/* Personal info */}
              <div className="bg-kz-surface rounded-2xl p-4 border border-white/5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-pink-400" />
                  <span className="text-xs font-bold text-gray-400 uppercase">Идентификация</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {(selectedEntity.entity as any).ceo_iin && (
                    <div>
                      <span className="text-gray-500">ИИН</span>
                      <div className="text-gray-200 font-mono mt-0.5">{(selectedEntity.entity as any).ceo_iin}</div>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Регион</span>
                    <div className="text-gray-200 mt-0.5">{selectedEntity.entity.region}</div>
                  </div>
                </div>
              </div>

              {/* Alert */}
              {(selectedEntity.entity as any).suspicion_summary && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-red-400 mb-1">Аффилированность</div>
                    <div className="text-xs text-red-300 leading-relaxed">{(selectedEntity.entity as any).suspicion_summary}</div>
                  </div>
                </div>
              )}

              {/* Connections */}
              {selectedEntity.connected_entities.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3">
                    Аффилированные организации ({selectedEntity.connected_entities.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedEntity.connected_entities.map((ce: any) => (
                      <button key={ce.id} onClick={() => detailMutation.mutate(ce.id)}
                        className="w-full text-left flex items-center gap-2 p-3 bg-kz-surface border border-white/5 rounded-xl hover:bg-white/5 transition-colors">
                        <div className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: { government:'#3B82F6',company:'#22C55E',intermediary:'#F59E0B',offshore:'#EF4444' }[ce.type as string] || '#6B7280' }} />
                        <span className="text-xs text-gray-300 flex-1 truncate">{ce.name}</span>
                        <span className={`text-[9px] font-bold ${ce.risk_score > 60 ? 'text-red-400' : 'text-gray-500'}`}>
                          {ce.risk_score?.toFixed(0)}%
                        </span>
                        {ce.is_suspicious && <AlertTriangle className="w-3 h-3 text-red-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Flows */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />Исх. ({selectedEntity.outgoing_flows.length})
                  </h3>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedEntity.outgoing_flows.slice(0, 8).map(f => (
                      <div key={f.id} className="p-2 bg-kz-panel/50 rounded-lg border border-white/5 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-gray-300 truncate flex-1">{f.target_name}</span>
                          <span className="text-white ml-2 font-mono">{fmt(f.amount)}</span>
                        </div>
                        <div className="text-gray-600 mt-0.5">{f.flow_type}</div>
                      </div>
                    ))}
                    {selectedEntity.outgoing_flows.length === 0 && <div className="text-gray-600 text-center py-2">Нет</div>}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" />Вх. ({selectedEntity.incoming_flows.length})
                  </h3>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedEntity.incoming_flows.slice(0, 8).map(f => (
                      <div key={f.id} className="p-2 bg-kz-panel/50 rounded-lg border border-white/5 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-gray-300 truncate flex-1">{f.source_name}</span>
                          <span className="text-white ml-2 font-mono">{fmt(f.amount)}</span>
                        </div>
                        <div className="text-gray-600 mt-0.5">{f.flow_type}</div>
                      </div>
                    ))}
                    {selectedEntity.incoming_flows.length === 0 && <div className="text-gray-600 text-center py-2">Нет</div>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {/* Add to investigation */}
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
                                    : 'border-pink-500/30 bg-pink-500/5 text-pink-400 hover:bg-pink-500/10'
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
                  <button onClick={() => { setShowDetail(false); navigate(`/network?nodes=${selectedEntity.entity.id}`) }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-500/20 border border-pink-500/30 rounded-xl text-pink-300 text-sm font-medium hover:bg-pink-500/30 transition-all">
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

      {detailMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-3 bg-kz-panel border border-white/10 rounded-2xl p-4">
            <RefreshCw className="w-5 h-5 text-pink-400 animate-spin" />
            <span className="text-sm text-gray-300">Загрузка данных...</span>
          </div>
        </div>
      )}
    </div>
  )
}
