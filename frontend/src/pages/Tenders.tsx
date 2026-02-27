import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Search, ChevronLeft, ChevronRight, Filter,
  AlertTriangle, ArrowUpDown,
} from 'lucide-react'
import { getTenders } from '../api'
import RiskBadge from '../components/RiskBadge'

function formatAmount(val?: number): string {
  if (!val) return '-'
  if (val >= 1e9) return `₸${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `₸${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `₸${(val / 1e3).toFixed(0)}K`
  return `₸${val.toFixed(0)}`
}

export default function Tenders() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [sortBy, setSortBy] = useState('risk_score')
  const [sortOrder, setSortOrder] = useState('desc')

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenders', page, search, riskFilter, sortBy, sortOrder],
    queryFn: () =>
      getTenders({
        page,
        page_size: 20,
        search: search || undefined,
        risk_level: riskFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      }),
  })

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('tenders.title')}</h1>
        <p className="text-gray-400 text-sm mt-1">{t('tenders.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              className="input-field w-full pl-10"
              placeholder={t('tenders.search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          {/* Risk Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              className="input-field"
              value={riskFilter}
              onChange={(e) => { setRiskFilter(e.target.value); setPage(1) }}
            >
              <option value="">{t('tenders.all')}</option>
              <option value="LOW">{t('risk.LOW')}</option>
              <option value="MEDIUM">{t('risk.MEDIUM')}</option>
              <option value="HIGH">{t('risk.HIGH')}</option>
              <option value="CRITICAL">{t('risk.CRITICAL')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-kz-blue border-t-transparent rounded-full" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card border-red-500/50 bg-red-500/10 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-400">{t('common.error')}</p>
        </div>
      )}

      {/* Table */}
      {data && (
        <>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kz-border text-gray-400 text-left">
                  <th className="py-3 px-4">{t('tenders.tenderId')}</th>
                  <th className="py-3 px-4">{t('tenders.tenderTitle')}</th>
                  <th className="py-3 px-4">{t('tenders.customer')}</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-white"
                    onClick={() => toggleSort('amount')}
                  >
                    <span className="flex items-center gap-1">
                      {t('tenders.amount')}
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-3 px-4">{t('tenders.region')}</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-white"
                    onClick={() => toggleSort('risk_score')}
                  >
                    <span className="flex items-center gap-1">
                      {t('tenders.riskScore')}
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-3 px-4">{t('tenders.participants')}</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((tender) => (
                  <tr
                    key={tender.tender_id}
                    className="border-b border-kz-border/50 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs text-gray-400">
                      {tender.tender_id}
                    </td>
                    <td className="py-3 px-4 text-white max-w-[250px] truncate">
                      {tender.title}
                    </td>
                    <td className="py-3 px-4 text-gray-300 max-w-[200px] truncate">
                      {tender.customer_name}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {formatAmount(tender.amount)}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {tender.region}
                    </td>
                    <td className="py-3 px-4">
                      <RiskBadge
                        level={tender.risk_level}
                        label={`${tender.risk_score}`}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={
                          tender.participant_count === 1
                            ? 'text-red-400 font-bold'
                            : 'text-gray-400'
                        }
                      >
                        {tender.participant_count}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/tenders/${tender.tender_id}`}
                        className="text-kz-blue hover:underline text-xs"
                      >
                        {t('tenders.viewDetails')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {data.total} {t('tenders.title').toLowerCase()} — {t('tenders.filterRisk')}: {page}/{data.total_pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="btn-secondary flex items-center gap-1 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('common.previous')}
              </button>
              <span className="text-sm text-gray-400 px-3">
                {page} / {data.total_pages}
              </span>
              <button
                onClick={() => setPage(Math.min(data.total_pages, page + 1))}
                disabled={page >= data.total_pages}
                className="btn-secondary flex items-center gap-1 disabled:opacity-30"
              >
                {t('common.next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
