import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Calendar, MapPin, Building2, Trophy,
  Clock, DollarSign, Users, AlertTriangle, ChevronDown,
} from 'lucide-react'
import { getTenderDetail } from '../api'
import RiskGauge from '../components/RiskGauge'
import RiskBadge from '../components/RiskBadge'

export default function TenderDetail() {
  const { tenderId } = useParams<{ tenderId: string }>()
  const { t } = useTranslation()

  const { data: tender, isLoading, error } = useQuery({
    queryKey: ['tender', tenderId],
    queryFn: () => getTenderDetail(tenderId!),
    enabled: !!tenderId,
  })

  const [expandedFlags, setExpandedFlags] = useState<Set<number>>(new Set())

  const toggleFlag = (i: number) => {
    setExpandedFlags(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-kz-blue border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !tender) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-400">{t('common.error')}</p>
        <Link to="/tenders" className="text-kz-blue hover:underline mt-4 inline-block">
          {t('common.back')}
        </Link>
      </div>
    )
  }

  const formatDate = (d?: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString()
  }

  const formatAmount = (val?: number) => {
    if (!val) return '-'
    return `₸${val.toLocaleString()}`
  }

  // Build highlighted full text
  const getHighlightedText = () => {
    let text = tender.full_text || tender.description || ''
    if (!tender.flags?.length) return text

    const keywords: string[] = []
    tender.flags.forEach((f) => {
      if (f.evidence) {
        f.evidence.split(/[,:]/).forEach((s) => {
          const trimmed = s.trim()
          if (trimmed.length > 3) keywords.push(trimmed)
        })
      }
    })

    keywords.forEach((kw) => {
      const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      text = text.replace(regex, '|||$1|||')
    })

    return text
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link
        to="/tenders"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('common.back')}
      </Link>

      {/* Title */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-mono mb-1">{tender.tender_id}</p>
          <h1 className="text-xl font-bold text-white">{tender.title}</h1>
        </div>
        <RiskBadge level={tender.risk_level} size="lg" label={t(`risk.${tender.risk_level}`)} />
      </div>

      {/* Main info + Risk gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tender Info */}
        <div className="lg:col-span-2 card space-y-4">
          <h3 className="font-semibold text-lg">{t('detail.tenderDetails')}</h3>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-400">{t('tenders.customer')}</p>
                <p className="text-white">{tender.customer_name || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-400">{t('detail.winner')}</p>
                <p className="text-white">{tender.winner_name || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-400">{t('tenders.amount')}</p>
                <p className="text-white">{formatAmount(tender.amount)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-400">{t('tenders.region')}</p>
                <p className="text-white">{tender.region || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-400">{t('detail.deliveryTime')}</p>
                <p className="text-white">
                  {tender.delivery_days ? `${tender.delivery_days} ${t('detail.days')}` : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-400">{t('tenders.participants')}</p>
                <p className={tender.participant_count === 1 ? 'text-red-400 font-bold' : 'text-white'}>
                  {tender.participant_count}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-400">{t('detail.publishedOn')}</p>
                <p className="text-white">{formatDate(tender.publication_date)}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-400">{t('detail.category')}</p>
              <p className="text-white">{tender.category || tender.oked_code || '-'}</p>
            </div>
          </div>
        </div>

        {/* Risk Gauge */}
        <div className="card flex flex-col items-center justify-center">
          <RiskGauge score={tender.risk_score} size={180} />
          <p className="text-sm text-gray-400 mt-2">
            {t('analyze.confidence')}: {((tender.confidence || 0) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Recommendation */}
      {tender.recommendation && (
        <div className="card bg-gradient-to-r from-red-900/20 to-transparent border-l-4 border-red-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-300 mb-1">{t('analyze.recommendation')}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{tender.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Flags */}
      {tender.flags && tender.flags.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">
            {t('detail.flags')} ({tender.flags.length})
          </h3>
          <div className="space-y-3">
            {tender.flags.map((flag, i) => (
              <div key={i} className={`rounded-lg border overflow-hidden ${flag.severity === 'critical' ? 'border-red-500/30' :
                  flag.severity === 'high' ? 'border-orange-500/30' :
                    'border-yellow-500/20'
                }`}>
                {/* Clickable header */}
                <button
                  onClick={() => toggleFlag(i)}
                  className={`w-full flex items-center justify-between p-3 text-left transition-colors ${flag.severity === 'critical' ? 'bg-red-900/20 hover:bg-red-900/30' :
                      flag.severity === 'high' ? 'bg-orange-900/20 hover:bg-orange-900/30' :
                        'bg-yellow-900/10 hover:bg-yellow-900/20'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${flag.severity === 'critical' ? 'text-red-400' :
                        flag.severity === 'high' ? 'text-orange-400' : 'text-yellow-400'
                      }`} />
                    <span className="text-sm font-semibold text-white">
                      {t(`flags.${flag.flag_type}`) || flag.flag_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${flag.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                        flag.severity === 'high' ? 'bg-orange-500/20 text-orange-300' :
                          'bg-yellow-500/20 text-yellow-300'
                      }`}>+{flag.score_contribution} pts</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedFlags.has(i) ? 'rotate-180' : ''
                    }`} />
                </button>

                {/* Expandable content */}
                {expandedFlags.has(i) && (
                  <div className="p-3 bg-kz-surface/50 border-t border-white/5">
                    <p className="text-sm text-gray-300 mb-2">{flag.description}</p>
                    {flag.evidence && (
                      <div className="mt-2 p-2 bg-kz-surface rounded border border-white/5">
                        <span className="text-xs text-gray-500 font-medium">{t('analyze.evidence')}: </span>
                        <span className="text-xs text-kz-blue font-mono">{flag.evidence}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Document Text */}
      {(tender.full_text || tender.description) && (
        <div className="card">
          <h3 className="font-semibold mb-2">{t('detail.documentText')}</h3>
          <p className="text-xs text-gray-500 mb-3">{t('detail.suspiciousText')}</p>
          <div className="bg-kz-surface rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {getHighlightedText()
              .split('|||')
              .map((part, i) =>
                i % 2 === 1 ? (
                  <span key={i} className="highlight-suspicious">
                    {part}
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
          </div>
        </div>
      )}
    </div>
  )
}
