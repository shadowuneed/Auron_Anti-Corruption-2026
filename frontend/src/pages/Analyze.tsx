import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import {
  Search, AlertTriangle, CheckCircle, Clock,
  ChevronDown, ChevronUp, FileText, Loader2,
} from 'lucide-react'
import { analyzeTender } from '../api'
import RiskGauge from '../components/RiskGauge'
import RiskBadge from '../components/RiskBadge'
import type { AnalysisResult } from '../types'

export default function Analyze() {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [tenderId, setTenderId] = useState('')
  const [amount, setAmount] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('')
  const [region, setRegion] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [expandedFlags, setExpandedFlags] = useState<Set<number>>(new Set())

  const mutation = useMutation({
    mutationFn: analyzeTender,
    onSuccess: (data) => setResult(data),
  })

  const handleAnalyze = () => {
    if (!text && !tenderId) return
    mutation.mutate({
      text: text || undefined,
      tender_id: tenderId || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      delivery_days: deliveryDays ? parseInt(deliveryDays) : undefined,
      region: region || undefined,
      customer_name: customerName || undefined,
    })
  }

  const toggleFlag = (index: number) => {
    const next = new Set(expandedFlags)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpandedFlags(next)
  }

  const getSeverityIcon = (severity: string) => {
    if (severity === 'high') return <AlertTriangle className="w-4 h-4 text-red-500" />
    if (severity === 'medium') return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  const highlightSuspicious = (fullText: string, flags: AnalysisResult['triggered_flags']) => {
    if (!fullText || !flags.length) return fullText

    let highlighted = fullText
    flags.forEach((flag) => {
      if (flag.evidence) {
        const keywords = flag.evidence.split(/[,:]/).map(s => s.trim()).filter(s => s.length > 3)
        keywords.forEach((kw) => {
          const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
          highlighted = highlighted.replace(regex, '%%%HIGHLIGHT_START%%%$1%%%HIGHLIGHT_END%%%')
        })
      }
    })

    return highlighted
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('analyze.title')}</h1>
        <p className="text-gray-400 text-sm mt-1">{t('analyze.subtitle')}</p>
      </div>

      {/* Input Section */}
      <div className="card space-y-4">
        {/* Tender ID */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            {t('tenders.tenderId')}
          </label>
          <input
            type="text"
            className="input-field w-full"
            placeholder={t('analyze.tenderIdPlaceholder')}
            value={tenderId}
            onChange={(e) => setTenderId(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 text-gray-500 text-sm">
          <div className="flex-1 h-px bg-kz-border" />
          <span>OR</span>
          <div className="flex-1 h-px bg-kz-border" />
        </div>

        {/* Tender Text */}
        <div>
          <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('detail.documentText')}
          </label>
          <textarea
            className="input-field w-full h-48 resize-y font-mono text-sm"
            placeholder={t('analyze.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* Additional params */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('analyze.amount')}
            </label>
            <input
              type="number"
              className="input-field w-full"
              placeholder="15000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('analyze.deliveryDays')}
            </label>
            <input
              type="number"
              className="input-field w-full"
              placeholder="30"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('analyze.region')}
            </label>
            <input
              type="text"
              className="input-field w-full"
              placeholder="Алматы"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('analyze.customerName')}
            </label>
            <input
              type="text"
              className="input-field w-full"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={mutation.isPending || (!text && !tenderId)}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('analyze.analyzing')}
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              {t('analyze.analyzeBtn')}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {mutation.isError && (
        <div className="card border-red-500/50 bg-red-500/10">
          <p className="text-red-400">{t('common.error')}: {(mutation.error as any)?.message}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in">
          {/* Risk Score */}
          <div className="card flex flex-col md:flex-row items-center gap-8">
            <RiskGauge score={result.risk_score} size={220} />

            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">{t('analyze.riskLevel')}</p>
                  <RiskBadge level={result.risk_level} size="lg" label={t(`risk.${result.risk_level}`)} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">{t('analyze.confidence')}</p>
                  <p className="text-xl font-semibold text-white">
                    {(result.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">{t('analyze.processingTime')}</p>
                  <p className="text-white flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    {result.processing_time_ms}ms
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">{t('analyze.riskScore')}</p>
                  <p className="text-xl font-semibold text-white">
                    {result.risk_score}/100
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-2">{t('analyze.recommendation')}</h3>
            <p className="text-gray-300 leading-relaxed">{result.recommendation}</p>
          </div>

          {/* Triggered Flags */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">
              {t('analyze.triggeredFlags')} ({result.triggered_flags.length})
            </h3>
            {result.triggered_flags.length === 0 ? (
              <p className="text-gray-500">{t('analyze.noFlags')}</p>
            ) : (
              <div className="space-y-2">
                {result.triggered_flags.map((flag, i) => (
                  <div
                    key={i}
                    className="border border-kz-border rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleFlag(i)}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getSeverityIcon(flag.severity)}
                        <span className="text-xs px-2 py-0.5 rounded bg-kz-surface text-gray-400 font-mono">
                          {flag.flag_type}
                        </span>
                        <span className="text-sm text-gray-300">
                          {flag.description.substring(0, 80)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          +{flag.score_contribution}
                        </span>
                        {expandedFlags.has(i) ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    </button>
                    {expandedFlags.has(i) && (
                      <div className="px-4 pb-4 space-y-2 border-t border-kz-border/50 pt-3">
                        <p className="text-sm text-gray-300">{flag.description}</p>
                        {flag.evidence && (
                          <div className="bg-kz-surface rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1">
                              {t('analyze.evidence')}:
                            </p>
                            <p className="text-sm text-red-300 font-mono">
                              {flag.evidence}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Highlighted Text */}
          {text && result.triggered_flags.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">{t('detail.documentText')}</h3>
              <p className="text-xs text-gray-500 mb-4">{t('detail.suspiciousText')}</p>
              <div className="bg-kz-surface rounded-lg p-4 text-sm leading-relaxed">
                {highlightSuspicious(text, result.triggered_flags)
                  .split('%%%HIGHLIGHT_START%%%')
                  .map((part, i) => {
                    if (part.includes('%%%HIGHLIGHT_END%%%')) {
                      const [highlighted, rest] = part.split('%%%HIGHLIGHT_END%%%')
                      return (
                        <span key={i}>
                          <span className="highlight-suspicious">{highlighted}</span>
                          {rest}
                        </span>
                      )
                    }
                    return <span key={i}>{part}</span>
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
