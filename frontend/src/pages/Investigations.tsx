import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Plus, Trash2, Play, Save, Share2, X, ChevronRight,
  AlertTriangle, Brain, Search, Shield, Calendar,
  Network, FileText, CheckCircle, Clock, Copy, Building2,
  User, Loader2, ExternalLink, FolderOpen, Sparkles, Download, Pencil,
} from 'lucide-react'
import { getNetworkGraph, aiAnalyzeNetwork } from '../api'
import type { NetworkAIAnalysis, NetworkNode } from '../types'

/* ─── Types ─── */
interface Investigation {
  id: string
  name: string
  description: string
  nodeIds: string[]
  aiAnalysis: NetworkAIAnalysis | null
  aiRunAt: string | null
  createdAt: string
  updatedAt: string
  tags: string[]
}

const STORAGE_KEY = 'turk_investigations'

// Pre-seeded demo investigations — 3 sizes: large / medium / small
const DEMO_INVESTIGATION: Investigation = {
  id: 'demo-001',
  name: '🔴 Большое: Откат через посредников (₸2.1 млрд)',
  description:
    'Многоуровневая схема вывода государственных средств: Гос.орган → ТОО-посредник → офшор → обналичивание. Задействовано 8 субъектов, сумма под риском ~₸2.1 млрд.',
  nodeIds: ['GOV-001', 'COM-003', 'INT-001', 'OFF-001', 'COM-014', 'INT-003', 'COM-006', 'GOV-005'],
  aiAnalysis: {
    network_risk_score: 91,
    risk_assessment:
      'Масштабная откатная схема. Государственная организация заключила контракты с ТОО «КазТехСервис» на ₸1.8 млрд при рыночной стоимости ~₸600 млн. Средства перечислялись через цепочку посредников в офшоры.',
    key_findings: [
      'Завышение стоимости госзакупок на 200–300%',
      'Транзит через компании-однодневки с нулевым балансом',
      'Конечный бенефициар — офшорная структура',
      'Совпадение ИИН директоров нескольких ТОО',
      'Периодичность транзакций соответствует карусельному НДС',
    ],
    suspicious_patterns: [
      {
        pattern_type: 'KICKBACK_CHAIN',
        description: 'Откатная цепочка: Гос.орган → ТОО → Посредник → Офшор',
        involved_entities: ['GOV-001', 'COM-003', 'INT-001', 'OFF-001'],
        estimated_risk_amount: 1_800_000_000,
        severity: 'CRITICAL',
      },
      {
        pattern_type: 'CASH_OUT',
        description: 'Обналичивание через аффилированные ТОО',
        involved_entities: ['INT-003', 'COM-014', 'COM-006', 'GOV-005'],
        estimated_risk_amount: 320_000_000,
        severity: 'HIGH',
      },
    ],
    recommended_investigations: [
      'Запросить банковскую выписку ТОО «КазТехСервис» за 2022–2024',
      'Проверить бенефициаров офшорной структуры OFF-001',
      'Сверить ИИН директоров аффилированных ТОО',
      'Изучить историю госзакупок GOV-001 за 3 года',
    ],
  },
  aiRunAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
  createdAt: new Date(Date.now() - 5 * 24 * 3600_000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
  tags: ['откат', 'офшор', 'госзакупки', 'крупное'],
}

const DEMO_MEDIUM: Investigation = {
  id: 'demo-002',
  name: '🟠 Среднее: Фиктивная компания (₸450 млн)',
  description:
    'Средняя схема: посредник использует ТОО-фантом для вывода средств через офшор. 4 субъекта, ~₸450 млн под риском.',
  nodeIds: ['INT-001', 'COM-003', 'OFF-001', 'NP-002'],
  aiAnalysis: {
    network_risk_score: 72,
    risk_assessment:
      'Посредник INT-001 контролирует ТОО-фантом COM-003, через которое средства выводятся в офшор OFF-001 с конечным обналичиванием через физлицо NP-002.',
    key_findings: [
      'ТОО зарегистрировано за 2 месяца до получения контракта',
      'Уставный капитал 100 000 тенге при обороте ₸450 млн',
      'Совпадение адресов регистрации посредника и ТОО',
    ],
    suspicious_patterns: [
      {
        pattern_type: 'SHELL_COMPANY',
        description: 'Фиктивная компания — транзит через ТОО-фантом',
        involved_entities: ['INT-001', 'COM-003', 'OFF-001'],
        estimated_risk_amount: 450_000_000,
        severity: 'HIGH',
      },
    ],
    recommended_investigations: [
      'Проверить реальную деятельность COM-003',
      'Запросить учредительные документы INT-001',
      'Установить конечного бенефициара NP-002',
    ],
  },
  aiRunAt: new Date(Date.now() - 1 * 24 * 3600_000).toISOString(),
  createdAt: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
  updatedAt: new Date(Date.now() - 1 * 24 * 3600_000).toISOString(),
  tags: ['посредник', 'фантом', 'среднее'],
}

const DEMO_SMALL: Investigation = {
  id: 'demo-003',
  name: '🟡 Малое: Прямой вывод (₸80 млн)',
  description:
    'Простая двухзвенная схема: чиновник напрямую через аффилиат выводит средства. 2 субъекта, ~₸80 млн.',
  nodeIds: ['GOV-001', 'COM-001'],
  aiAnalysis: {
    network_risk_score: 55,
    risk_assessment:
      'Государственный служащий GOV-001 аффилирован с компанией COM-001, которой получены госконтракты без конкурса.',
    key_findings: [
      'Прямая аффилированность чиновника с поставщиком',
      'Контракты выданы без проведения тендера',
      'Цена завышена на ~60% от рыночной',
    ],
    suspicious_patterns: [
      {
        pattern_type: 'CONFLICT_OF_INTEREST',
        description: 'Конфликт интересов: чиновник → аффилиат-поставщик',
        involved_entities: ['GOV-001', 'COM-001'],
        estimated_risk_amount: 80_000_000,
        severity: 'MEDIUM',
      },
    ],
    recommended_investigations: [
      'Проверить декларации об интересах GOV-001',
      'Запросить документацию по тендеру COM-001',
    ],
  },
  aiRunAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  createdAt: new Date(Date.now() - 1 * 24 * 3600_000).toISOString(),
  updatedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  tags: ['конфликт интересов', 'малое'],
}

const ALL_DEMOS = [DEMO_INVESTIGATION, DEMO_MEDIUM, DEMO_SMALL]

/* ─── Helpers ─── */
function loadInvestigations(): Investigation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...ALL_DEMOS]
    const parsed: Investigation[] = JSON.parse(raw)
    // Ensure all demos are always present
    ALL_DEMOS.forEach(demo => {
      if (!parsed.find(i => i.id === demo.id)) parsed.unshift(demo)
    })
    return parsed
  } catch {
    return [...ALL_DEMOS]
  }
}

function saveInvestigations(list: Investigation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function riskColor(score: number | undefined) {
  if (!score) return '#64748B'
  if (score >= 80) return '#EF4444'
  if (score >= 60) return '#F59E0B'
  if (score >= 40) return '#3B82F6'
  return '#22C55E'
}

function riskLabel(score: number | undefined) {
  if (!score) return 'Не проверено'
  if (score >= 80) return 'КРИТИЧЕСКИЙ'
  if (score >= 60) return 'ВЫСОКИЙ'
  if (score >= 40) return 'СРЕДНИЙ'
  return 'НИЗКИЙ'
}

/* ─── PDF Protocol Generator ─── */
function generateProtocolPDF(inv: Investigation, nodes: NetworkNode[], graphData: any) {
  const score = inv.aiAnalysis?.network_risk_score ?? 0
  const year = new Date(inv.createdAt).getFullYear()
  const caseNum = `ФМ-${inv.id.replace('demo-', '').toUpperCase().padStart(6, '0')}-${year}`
  const dateStr = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(inv.createdAt))
  const classification = score >= 80 ? 'СОВЕРШЕННО СЕКРЕТНО' : score >= 60 ? 'СЕКРЕТНО' : 'ДЛЯ СЛУЖЕБНОГО ПОЛЬЗОВАНИЯ'
  const classColor = score >= 80 ? '#dc2626' : score >= 60 ? '#d97706' : '#b45309'
  const patterns = inv.aiAnalysis?.suspicious_patterns ?? []
  const findings = inv.aiAnalysis?.key_findings ?? []
  const recommendations = inv.aiAnalysis?.recommended_investigations ?? []

  const resolveNode = (id: string) =>
    nodes.find(n => n.id === id) ?? graphData?.nodes?.find((n: NetworkNode) => n.id === id)

  const TYPE_LABELS: Record<string, string> = {
    government: 'Государственный орган', company: 'ТОО/АО', intermediary: 'Посредник',
    offshore: 'Офшорная структура', individual: 'Физическое лицо',
  }

  const fmtAmt = (v: number) => v >= 1e9 ? `${(v / 1e9).toFixed(2)} млрд тенге` : `${(v / 1e6).toFixed(1)} млн тенге`
  const totalAmt = patterns.reduce((acc, p) => {
    const amt = p.estimated_risk_amount && p.estimated_risk_amount > 0
      ? p.estimated_risk_amount
      : Math.round((score ** 2) * inv.nodeIds.length * 250_000 / Math.max(1, patterns.length))
    return acc + amt
  }, 0)

  const topPattern = [...patterns].sort((a, b) => {
    const ord: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return (ord[a.severity] ?? 9) - (ord[b.severity] ?? 9)
  })[0]
  const mainSuspectId = topPattern?.involved_entities?.find(id => id && id !== '?' && inv.nodeIds.includes(id)) ?? inv.nodeIds[0]
  const mainNode = resolveNode(mainSuspectId)
  const accompliceIds = inv.nodeIds.filter(id => id !== mainSuspectId)

  const subjectRows = inv.nodeIds.map((id, i) => {
    const n = resolveNode(id)
    const isMain = id === mainSuspectId
    return `<tr style="${isMain ? 'background:#fff3f3' : i % 2 === 0 ? 'background:#fafafa' : ''}">
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${i + 1}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-weight:${isMain ? '700' : '400'}">${n?.name ?? id}${isMain ? ' <span style="color:#dc2626;font-size:10px">(Главный)</span>' : ''}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${n ? (TYPE_LABELS[n.type] ?? n.type) : id}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${n?.region ?? '—'}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;color:${(n as any)?.is_suspicious ? '#dc2626' : '#16a34a'}">${(n as any)?.is_suspicious ? 'ДА' : 'НЕТ'}</td>
    </tr>`
  }).join('')

  const violationsRows = patterns.map((p, i) => {
    const amt = p.estimated_risk_amount && p.estimated_risk_amount > 0
      ? p.estimated_risk_amount
      : Math.round((score ** 2) * inv.nodeIds.length * 250_000 / Math.max(1, patterns.length))
    const sevColor = p.severity === 'CRITICAL' ? '#dc2626' : p.severity === 'HIGH' ? '#d97706' : p.severity === 'MEDIUM' ? '#2563eb' : '#16a34a'
    return `<tr style="${i % 2 === 0 ? 'background:#fafafa' : ''}">
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${i + 1}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${p.pattern_type}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${p.description}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-weight:700;color:${sevColor}">${p.severity}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${fmtAmt(amt)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<title>Протокол ${caseNum}</title>
<style>
  @page { size: A4; margin: 20mm 25mm 20mm 30mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #111; line-height: 1.5; }
  h1 { font-size: 13pt; text-transform: uppercase; text-align: center; margin: 0 0 4px; }
  h2 { font-size: 12pt; text-transform: uppercase; margin: 18px 0 8px; border-bottom: 1px solid #333; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; margin: 8px 0; }
  th { background: #1a1a2e; color: #fff; padding: 7px 10px; border: 1px solid #333; text-align: left; font-size: 10pt; text-transform: uppercase; letter-spacing: .5px; }
  p { margin: 4px 0; text-indent: 1.5em; text-align: justify; }
  .classification { display: inline-block; border: 2px solid ${classColor}; color: ${classColor}; font-weight: 900; font-size: 11pt; letter-spacing: 2px; padding: 3px 16px; text-transform: uppercase; }
  .header-block { text-align: center; border-bottom: 2px solid #1a1a2e; padding-bottom: 12px; margin-bottom: 16px; }
  .hdr-inner { display: flex; align-items: center; gap: 18px; justify-content: center; margin-bottom: 8px; }
  .logo-wrap { flex-shrink: 0; width: 72px; height: 72px; border-radius: 10px; overflow: hidden; background: #1e1b4b; border: 1.5px solid #4dc9f040; }
  .meta-row { display: flex; justify-content: space-between; font-size: 10pt; color: #444; margin: 6px 0; }
  .risk-score { font-size: 20pt; font-weight: 900; color: ${score >= 80 ? '#dc2626' : score >= 60 ? '#d97706' : '#2563eb'}; }
  .conclusion-box { border: 2px solid #1a1a2e; padding: 14px 18px; margin-top: 16px; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 32px; font-size: 11pt; }
  .sign-col { width: 45%; }
  .sign-line { border-top: 1px solid #333; margin-top: 32px; font-size: 10pt; color: #555; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>

<div class="header-block">
  <div class="hdr-inner">
    <div class="logo-wrap"><img src="${window.location.origin}/auron-logo.svg" width="72" height="72" style="display:block" /></div>
    <div style="text-align:left">
      <div style="font-size:9pt;color:#555;margin-bottom:4px">
        ҚАЗАҚСТАН РЕСПУБЛИКАСЫ · РЕСПУБЛИКА КАЗАХСТАН<br>
        Қаржылық мониторинг комитеті · Комитет финансового мониторинга
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18pt;font-weight:900;letter-spacing:0.15em;color:#1a1a2e;margin-left:-1px">AURON</div>
      <div style="font-size:9pt;color:#555">ИИ-система антикоррупционного мониторинга</div>
    </div>
  </div>
  <h1>Протокол служебного расследования</h1>
  <div style="font-size:11pt;text-align:center;color:#333;margin:4px 0">Дело № ${caseNum}</div>
  <div style="margin-top:10px"><span class="classification">${classification}</span></div>
  <div class="meta-row" style="margin-top:10px">
    <span>Дата составления: ${dateStr}</span>
    <span>Индекс коррупционного риска: <span class="risk-score">${score}</span>/100</span>
    <span>Субъектов охвачено: ${inv.nodeIds.length}</span>
  </div>
</div>

<div style="margin-bottom:12px">
  <strong>Основание составления:</strong> Настоящий протокол составлен по результатам автоматизированного
  анализа финансово-транзакционных потоков системой искусственного интеллекта в рамках
  превентивного контроля государственных закупок и финансовых операций.
</div>
<div>
  <strong>Предмет расследования:</strong> ${inv.name}${inv.description ? ` — ${inv.description}` : ''}
</div>

<h2>Раздел I. Субъекты расследования</h2>
<p>В ходе анализа финансовой активности выявлено <strong>${inv.nodeIds.length}</strong> субъекта(-ов),
в отношении которых зафиксированы признаки коррупционных и/или финансовых правонарушений.
Главным фигурантом расследования определён субъект: <strong>${mainNode?.name ?? mainSuspectId}</strong>.
${accompliceIds.length > 0 ? `Соучастниками (возможными участниками схемы) являются ${accompliceIds.length} субъект(-ов).` : ''}</p>
<table>
  <thead><tr>
    <th style="width:4%">№</th><th style="width:28%">Наименование / ФИО</th>
    <th style="width:22%">Организационная форма</th><th style="width:18%">Регион</th>
    <th style="width:14%">Признаки нарушений</th>
  </tr></thead>
  <tbody>${subjectRows}</tbody>
</table>

${inv.aiAnalysis?.risk_assessment ? `
<h2>Раздел II. Оценка рисков и характер нарушений</h2>
<p>${inv.aiAnalysis.risk_assessment}</p>` : ''}

${patterns.length > 0 ? `
<h2>Раздел III. Выявленные противоправные схемы</h2>
<p>В результате анализа сетевого взаимодействия субъектов выявлено <strong>${patterns.length}</strong>
схем(-ы) с совокупным объёмом риска <strong>${fmtAmt(totalAmt)}</strong>:</p>
<table>
  <thead><tr>
    <th style="width:4%">№</th><th style="width:22%">Тип схемы</th>
    <th style="width:34%">Описание</th><th style="width:12%">Степень</th>
    <th style="width:18%">Сумма риска</th>
  </tr></thead>
  <tbody>${violationsRows}</tbody>
</table>` : ''}

${findings.length > 0 ? `
<h2>Раздел IV. Ключевые доказательные факты</h2>
<ol style="margin:0;padding-left:1.5em">${findings.map(f => `<li style="margin:4px 0">${f}</li>`).join('')}</ol>` : ''}

${recommendations.length > 0 ? `
<h2>Раздел V. Рекомендуемые следственные действия</h2>
<ol style="margin:0;padding-left:1.5em">${recommendations.map(r => `<li style="margin:5px 0">${r}</li>`).join('')}</ol>` : ''}

<div class="conclusion-box">
  <strong>ЗАКЛЮЧЕНИЕ.</strong>
  По итогам проведённого анализа сети взаимодействий <strong>${inv.nodeIds.length}</strong> субъекта(-ов)
  установлено наличие <strong>${patterns.length}</strong> схем(-ы) коррупционного характера.
  Совокупный объём финансовых средств, находящихся под риском, составляет
  <strong>${fmtAmt(totalAmt)}</strong>. Индекс коррупционного риска:
  <strong style="color:${score >= 80 ? '#dc2626' : score >= 60 ? '#d97706' : '#2563eb'}">${score}/100</strong> —
  ${score >= 80 ? 'требует немедленной передачи материалов в правоохранительные органы' : score >= 60 ? 'требует проведения расширенной проверки и принятия административных мер' : 'подлежит дополнительной проверке в установленном порядке'}.
  Все материалы подлежат передаче в уполномоченные органы для принятия процессуального решения
  в соответствии с законодательством Республики Казахстан.
</div>

<div class="sign-row">
  <div class="sign-col">
    <div>Составил:</div>
    <div>Аналитик системы ФМ КЗ</div>
    <div class="sign-line">подпись / мөр</div>
  </div>
  <div class="sign-col" style="text-align:right">
    <div>Утвердил:</div>
    <div>Руководитель подразделения</div>
    <div class="sign-line">подпись / мөр</div>
  </div>
</div>
<div style="margin-top:20px;font-size:9pt;color:#888;text-align:center;border-top:1px solid #ccc;padding-top:6px">
  Дело № ${caseNum} · Сформировано системой ИИ-анализа · ${dateStr} · ${classification}
</div>

</body></html>`

  const win = window.open('', '_blank', 'width=900,height=1200')
  if (!win) { alert('Разрешите всплывающие окна для экспорта PDF'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 600)
}

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
  offshore: 'Офшор',
  individual: 'Физ. лицо',
}

/* ══════════════════════════ COMPONENT ══════════════════════════ */
export default function Investigations() {
  const navigate = useNavigate()

  const [investigations, setInvestigations] = useState<Investigation[]>(loadInvestigations)
  const [selected, setSelected] = useState<Investigation | null>(investigations[0] ?? null)
  const [showCreate, setShowCreate] = useState(false)
  const [nodeSearch, setNodeSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTags, setNewTags] = useState('')
  const [pickedNodes, setPickedNodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [rightTab, setRightTab] = useState<'analysis' | 'protocol'>('analysis')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function startRename(inv: Investigation, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(inv.id)
    setRenameValue(inv.name)
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (trimmed) {
      setInvestigations(prev => prev.map(i => i.id === id ? { ...i, name: trimmed, updatedAt: new Date().toISOString() } : i))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, name: trimmed } : prev)
    }
    setRenamingId(null)
  }

  // Persist on every change
  useEffect(() => {
    saveInvestigations(investigations)
  }, [investigations])

  const { data: graphData } = useQuery({
    queryKey: ['networkGraph'],
    queryFn: () => import('../api').then(m => m.getNetworkGraph()),
  })

  const aiMutation = useMutation({
    mutationFn: (inv: Investigation) =>
      aiAnalyzeNetwork({ entity_ids: inv.nodeIds, language: 'ru' }),
    onSuccess: (result, inv) => {
      const updated = { ...inv, aiAnalysis: result, aiRunAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      setInvestigations(prev => prev.map(i => i.id === inv.id ? updated : i))
      setSelected(updated)
    },
  })

  const filteredNodes = useMemo(() => {
    if (!graphData) return []
    const q = nodeSearch.toLowerCase()
    if (!q) return graphData.nodes.slice(0, 30)
    return graphData.nodes.filter((n: NetworkNode) =>
      n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [graphData, nodeSearch])

  function createInvestigation() {
    if (!newName.trim() || pickedNodes.length === 0) return
    const inv: Investigation = {
      id: `inv-${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim(),
      nodeIds: pickedNodes,
      aiAnalysis: null,
      aiRunAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
    }
    const updated = [inv, ...investigations]
    setInvestigations(updated)
    setSelected(inv)
    setShowCreate(false)
    setNewName(''); setNewDesc(''); setNewTags(''); setPickedNodes([])
  }

  function deleteInvestigation(id: string) {
    if (id.startsWith('demo-')) return // protect demos
    const updated = investigations.filter(i => i.id !== id)
    setInvestigations(updated)
    setSelected(updated[0] ?? null)
  }

  function shareInvestigation(inv: Investigation) {
    const url = `${window.location.origin}/network?nodes=${inv.nodeIds.join(',')}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportInvestigation(inv: Investigation) {
    const blob = new Blob([JSON.stringify(inv, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `investigation-${inv.id}.json`
    a.click()
  }

  const selectedNodes = useMemo(() => {
    if (!selected || !graphData) return []
    return selected.nodeIds.map(id => graphData.nodes.find((n: NetworkNode) => n.id === id)).filter(Boolean) as NetworkNode[]
  }, [selected, graphData])

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">

      {/* ── Left panel: investigation list ── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-amber-400" />
            Расследования
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-kz-blue text-white rounded-xl text-xs font-medium hover:bg-blue-500 transition-all shadow">
            <Plus className="w-3.5 h-3.5" /> Новое
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {investigations.map(inv => (
            <button
              key={inv.id}
              onClick={() => setSelected(inv)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selected?.id === inv.id
                  ? 'bg-kz-blue/15 border-kz-blue/40 shadow-lg shadow-blue-500/10'
                  : 'bg-kz-panel/60 border-white/5 hover:border-white/15 hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                {renamingId === inv.id ? (
                  <input
                    autoFocus
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-0.5 text-sm text-white outline-none focus:border-blue-400 min-w-0"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(inv.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(inv.id); if (e.key === 'Escape') setRenamingId(null) }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-sm font-semibold text-white leading-snug line-clamp-2 flex-1">{inv.name}</span>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {inv.aiAnalysis?.network_risk_score !== undefined && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ color: riskColor(inv.aiAnalysis.network_risk_score), backgroundColor: `${riskColor(inv.aiAnalysis.network_risk_score)}22` }}>
                      {inv.aiAnalysis.network_risk_score}%
                    </span>
                  )}
                  <button
                    onClick={e => startRename(inv, e)}
                    title="Переименовать"
                    className="p-0.5 text-gray-600 hover:text-gray-300 transition-colors rounded">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><Network className="w-3 h-3" />{inv.nodeIds.length} объектов</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(inv.createdAt)}</span>
              </div>
              {inv.aiAnalysis ? (
                <div className="mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                  <span className="text-[9px] text-green-400">ИИ-анализ готов</span>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  <span className="text-[9px] text-gray-600">Ожидает анализа</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel: investigation detail ── */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-kz-panel border border-white/8 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {renamingId === selected.id ? (
                    <input
                      autoFocus
                      className="w-full bg-white/10 border border-white/25 rounded-xl px-3 py-1.5 text-xl font-bold text-white outline-none focus:border-blue-400 mb-1"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(selected.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(selected.id); if (e.key === 'Escape') setRenamingId(null) }}
                    />
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-xl font-bold text-white leading-snug">{selected.name}</h1>
                      <button onClick={e => startRename(selected, e)} title="Переименовать"
                        className="p-1 text-gray-600 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/8">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {selected.description && (
                    <p className="text-sm text-gray-400 leading-relaxed">{selected.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Создано {formatDate(selected.createdAt)}</span>
                    {selected.aiRunAt && <span className="flex items-center gap-1"><Brain className="w-3 h-3 text-purple-400" />ИИ: {formatDate(selected.aiRunAt)}</span>}
                    {selected.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-gray-400">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/network?nodes=${selected.nodeIds.join(',')}`)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-kz-blue/20 border border-kz-blue/30 text-kz-blue rounded-xl text-xs font-medium hover:bg-kz-blue/30 transition-all">
                    <ExternalLink className="w-3.5 h-3.5" /> На графе
                  </button>
                  <button
                    onClick={() => shareInvestigation(selected)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-xl text-xs hover:bg-white/10 transition-all">
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Скопировано!' : 'Поделиться'}
                  </button>
                  <button
                    onClick={() => exportInvestigation(selected)}
                    className="p-2 bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/10 transition-all">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {!selected.id.startsWith('demo-') && (
                    <button
                      onClick={() => deleteInvestigation(selected.id)}
                      className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Tab switcher ── */}
            <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/8 rounded-xl w-fit">
              <button
                onClick={() => setRightTab('analysis')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rightTab === 'analysis'
                    ? 'bg-purple-600/30 border border-purple-500/40 text-purple-300'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                <Brain className="w-3.5 h-3.5" />
                ИИ Анализ
              </button>
              <button
                onClick={() => setRightTab('protocol')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rightTab === 'protocol'
                    ? 'bg-purple-600/30 border border-purple-500/40 text-purple-300'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                <FileText className="w-3.5 h-3.5" />
                Протокол
              </button>
            </div>

            {rightTab === 'analysis' && (<>
            {/* ═══ AI Investigation Verdict Panel ═══ */}
            {selected.aiAnalysis && !selected.aiAnalysis.error && (() => {
              const score = selected.aiAnalysis.network_risk_score ?? 0
              const color = riskColor(score)
              const patterns = selected.aiAnalysis.suspicious_patterns ?? []
              const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

              // Resolve node names
              const resolveNode = (id: string) =>
                graphData?.nodes?.find((n: NetworkNode) => n.id === id)
                  ?? selectedNodes.find(n => n.id === id)
                  ?? null

              // Main suspect = first VALID entity in top-severity pattern that exists in nodeIds
              const topPattern = [...patterns].sort((a, b) =>
                (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
              )[0]
              const mainSuspectId =
                topPattern?.involved_entities?.find(id => id && id !== '?' && selected.nodeIds.includes(id))
                ?? selected.nodeIds[0]

              // Accomplices = all other investigation nodeIds (not just from patterns)
              const accompliceIds = selected.nodeIds.filter(id => id !== mainSuspectId)

              // Amount: use actual values; fallback = estimate from risk score × node count
              const rawTotal = patterns.reduce((s, p) => s + (p.estimated_risk_amount ?? 0), 0)
              const estimatedTotal = rawTotal > 0
                ? rawTotal
                : Math.round(score * score * selected.nodeIds.length * 250_000)

              const verdictLabel = score >= 80 ? 'СХЕМА ВЫЯВЛЕНА' : score >= 60 ? 'ВЫСОКИЙ РИСК' : 'ТРЕБУЕТ ПРОВЕРКИ'
              const patternLabels: Record<string, string> = {
                KICKBACK_CHAIN: 'Откатная цепочка',
                SHELL_COMPANY: 'Компании-однодневки',
                OFFSHORE_LAYERING: 'Офшорное расслоение',
                CIRCULAR_TRANSACTIONS: 'Кольцевые транзакции',
                FAKE_CONTRACTS: 'Фиктивные контракты',
                MONEY_LAUNDERING: 'Отмывание денег',
                CASH_OUT: 'Обналичивание',
                CONFLICT_OF_INTEREST: 'Конфликт интересов',
              }

              // Icon for an entity type (uses lucide icons matching the sidebar nav)
              const typeIcon = (type: string, cls = 'w-3.5 h-3.5') => {
                const c = TYPE_COLORS[type] ?? '#64748B'
                if (type === 'individual') return <User className={cls} style={{ color: c }} />
                if (type === 'intermediary') return <Network className={cls} style={{ color: c }} />
                return <Building2 className={cls} style={{ color: c }} />
              }

              // Reusable entity card (main suspect or accomplice)
              const EntityCard = ({ id, accent = false }: { id: string; accent?: boolean }) => {
                const n = resolveNode(id)
                const nodeType = n?.type ?? 'company'
                const nodeColor = TYPE_COLORS[nodeType] ?? '#64748B'
                return (
                  <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all
                    ${accent ? 'bg-red-500/10 border-red-500/25' : 'bg-white/4 border-white/8 hover:bg-white/6'}`}>
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: nodeColor + '22', border: `1px solid ${nodeColor}44` }}>
                      {typeIcon(nodeType, 'w-4 h-4')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{n?.name ?? id}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{n ? TYPE_NAMES[nodeType] : id}</div>
                    </div>
                    {accent && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                  </div>
                )
              }

              return (
                <div className="rounded-2xl border mb-1 overflow-hidden"
                  style={{ borderColor: color + '40' }}>
                  {/* Header strip */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ background: `linear-gradient(90deg, ${color}22, ${color}08)` }}>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" style={{ color }} />
                      <span className="text-xs font-bold text-white">Результат расследования ИИ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: color + '25', color }}>
                        {verdictLabel}
                      </span>
                      <span className="text-xl font-black" style={{ color }}>{score}%</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Main suspect */}
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-400" /> Главный фигурант
                      </div>
                      <EntityCard id={mainSuspectId} accent />
                    </div>

                    {/* Accomplices — all other nodeIds from the investigation */}
                    {accompliceIds.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                          <User className="w-3 h-3 text-orange-400" />
                          Соучастники / участники ({accompliceIds.length})
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {accompliceIds.map(id => (
                            <EntityCard key={id} id={id} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metrics row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 bg-white/3 rounded-lg border border-white/6 text-center">
                        <div className="text-[9px] text-gray-500 uppercase mb-0.5">Схема</div>
                        <div className="text-[11px] font-bold text-orange-300 leading-tight">
                          {topPattern ? (patternLabels[topPattern.pattern_type] ?? topPattern.pattern_type) : '—'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-white/3 rounded-lg border border-white/6 text-center">
                        <div className="text-[9px] text-gray-500 uppercase mb-0.5">Сумма риска</div>
                        <div className="text-[11px] font-bold text-red-400">
                          ₸{estimatedTotal >= 1e9
                            ? `${(estimatedTotal / 1e9).toFixed(1)} млрд`
                            : `${(estimatedTotal / 1e6).toFixed(0)} млн`}
                        </div>
                      </div>
                      <div className="p-2.5 bg-white/3 rounded-lg border border-white/6 text-center">
                        <div className="text-[9px] text-gray-500 uppercase mb-0.5">Участников</div>
                        <div className="text-[11px] font-bold text-white">{selected.nodeIds.length}</div>
                        <div className="text-[9px] text-gray-600 mt-0.5 truncate leading-tight">
                          {selected.nodeIds.slice(0, 2).map(id => resolveNode(id)?.name?.split(/[«\s]/)[0] ?? id).join(', ')}
                          {selected.nodeIds.length > 2 ? ` +${selected.nodeIds.length - 2}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Open in graph */}
                    <button
                      onClick={() => navigate(`/network?nodes=${selected.nodeIds.join(',')}`)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all hover:opacity-90"
                      style={{ backgroundColor: color + '18', color, border: `1px solid ${color}35` }}>
                      <ExternalLink className="w-3 h-3" />
                      Открыть в сетевом графе
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* AI Analysis block */}
            <div className="bg-kz-panel border border-white/8 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  ИИ-анализ
                </h2>
                <button
                  onClick={() => aiMutation.mutate(selected)}
                  disabled={aiMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-all shadow">
                  {aiMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Анализирую...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" />Запустить анализ</>
                  )}
                </button>
              </div>

              {selected.aiAnalysis && !selected.aiAnalysis.error ? (
                <div className="space-y-4">
                  {/* Risk score */}
                  {selected.aiAnalysis.network_risk_score !== undefined && (
                    <div className="flex items-center gap-4 p-4 rounded-xl border"
                      style={{ backgroundColor: `${riskColor(selected.aiAnalysis.network_risk_score)}11`, borderColor: `${riskColor(selected.aiAnalysis.network_risk_score)}33` }}>
                      <div className="text-3xl font-black" style={{ color: riskColor(selected.aiAnalysis.network_risk_score) }}>
                        {selected.aiAnalysis.network_risk_score}%
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Риск сети: {riskLabel(selected.aiAnalysis.network_risk_score)}</div>
                        <div className="text-[10px] text-gray-500">{selected.nodeIds.length} объектов участвует в расследовании</div>
                      </div>
                    </div>
                  )}

                  {/* Risk assessment text */}
                  {selected.aiAnalysis.risk_assessment && (() => {
                    const RED_KW = /хищени|мошенничеств|подозрительн|откат|незаконн|отмыван|фиктив|коррупц|схем|вывод.*средств|уклонени|сговор|злоупотреблени|тенев|нелегальн/i
                    const GREEN_KW = /легальн|законно|официальн|чистых|прозрачн|добросовестн|выиграно тендер|контракт заключ/i
                    const YELLOW_KW = /необходимо проверить|требует(?:ся)? проверк|рекомендуется|следует проверить|уточнить|обратить внимание|зафиксировано|требует особого/i

                    const sentences = selected.aiAnalysis!.risk_assessment!
                      .split(/(?<=[.!?])\s+/)
                      .filter(s => s.trim().length > 0)

                    const classifySentence = (s: string): 'red' | 'green' | 'yellow' | 'neutral' => {
                      if (RED_KW.test(s)) return 'red'
                      if (GREEN_KW.test(s)) return 'green'
                      if (YELLOW_KW.test(s)) return 'yellow'
                      return 'neutral'
                    }

                    const highlightAmounts = (s: string, sentenceClass: 'red' | 'green' | 'yellow' | 'neutral') => {
                      const amtColor = sentenceClass === 'red' ? 'text-red-300'
                        : sentenceClass === 'green' ? 'text-green-300'
                        : 'text-yellow-300'
                      const amtBg = sentenceClass === 'red' ? 'bg-red-500/15'
                        : sentenceClass === 'green' ? 'bg-green-500/15'
                        : 'bg-yellow-500/15'
                      const parts = s.split(/(₸[\d,]+(?:\.\d+)?(?:\s*(?:млн|млрд|тыс))?)/g)
                      return parts.map((part, j) =>
                        part.startsWith('₸')
                          ? <span key={j} className={`font-bold ${amtColor} ${amtBg} rounded px-1 mx-0.5 whitespace-nowrap`}>{part}</span>
                          : <span key={j}>{part}</span>
                      )
                    }

                    return (
                      <div className="rounded-xl border border-white/8 overflow-hidden">
                        <div className="px-4 py-2.5 bg-white/3 border-b border-white/5">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Оценка рисков</div>
                        </div>
                        <div className="divide-y divide-white/4">
                          {sentences.map((s, i) => {
                            const cls = classifySentence(s)
                            const rowBg = cls === 'red'    ? 'bg-red-500/6   border-l-2 border-red-500/40'
                              : cls === 'green'  ? 'bg-green-500/6 border-l-2 border-green-500/40'
                              : cls === 'yellow' ? 'bg-yellow-500/5 border-l-2 border-yellow-500/35'
                              : 'bg-transparent pl-4'
                            const dot = cls === 'red'    ? '●'
                              : cls === 'green'  ? '●'
                              : cls === 'yellow' ? '●'
                              : null
                            const dotColor = cls === 'red' ? 'text-red-500' : cls === 'green' ? 'text-green-500' : 'text-yellow-500'
                            return (
                              <div key={i} className={`flex gap-2.5 px-3.5 py-2.5 text-xs leading-relaxed ${rowBg}`}>
                                {dot && <span className={`${dotColor} text-[8px] flex-shrink-0 mt-1.5`}>{dot}</span>}
                                <span className={cls === 'red' ? 'text-red-200/90' : cls === 'green' ? 'text-green-200/90' : cls === 'yellow' ? 'text-yellow-200/80' : 'text-gray-400'}>
                                  {highlightAmounts(s, cls)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Suspicious patterns */}
                  {selected.aiAnalysis.suspicious_patterns && selected.aiAnalysis.suspicious_patterns.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-400" /> Подозрительные схемы
                      </div>
                      <div className="space-y-2">
                        {selected.aiAnalysis.suspicious_patterns.map((p, i) => (
                          <div key={i} className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-red-300">{p.pattern_type}</span>
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{p.severity}</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-1.5">{p.description}</p>
                            <div className="text-[10px] text-orange-400">
                              {(() => {
                                const amt = p.estimated_risk_amount && p.estimated_risk_amount > 0
                                  ? p.estimated_risk_amount
                                  : Math.round(
                                      (selected.aiAnalysis!.network_risk_score ?? 50) ** 2
                                      * selected.nodeIds.length * 250_000
                                      / Math.max(1, selected.aiAnalysis!.suspicious_patterns?.length ?? 1)
                                    )
                                return amt >= 1e9
                                  ? `₸${(amt / 1e9).toFixed(1)} млрд под риском`
                                  : `₸${(amt / 1e6).toFixed(0)} млн под риском`
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key findings */}
                  {selected.aiAnalysis.key_findings && selected.aiAnalysis.key_findings.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Ключевые находки</div>
                      <ul className="space-y-1.5">
                        {selected.aiAnalysis.key_findings.map((f, i) => {
                          const isRed    = /хищени|подозрит|откат|незаконн|мошенни|схем|фиктив|разниц.*%/i.test(f)
                          const isGreen  = /выиграно тендер|официальн|законно|легальн/i.test(f)
                          const isYellow = /требует|проверить|уточнить|необходимо|рекоменд|зафиксировано/i.test(f)
                          const cls = isRed ? 'red' : isGreen ? 'green' : isYellow ? 'yellow' : 'neutral'
                          const amtColor = cls === 'red' ? 'text-red-300 bg-red-500/15' : cls === 'green' ? 'text-green-300 bg-green-500/15' : 'text-yellow-300 bg-yellow-400/12'
                          const iconColor = cls === 'red' ? 'text-red-400' : cls === 'green' ? 'text-green-400' : cls === 'yellow' ? 'text-yellow-400' : 'text-amber-400'
                          const rowBg = cls === 'red' ? 'bg-red-500/5 border border-red-500/15 rounded-lg px-2.5 py-1.5'
                            : cls === 'green' ? 'bg-green-500/5 border border-green-500/15 rounded-lg px-2.5 py-1.5'
                            : cls === 'yellow' ? 'bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-2.5 py-1.5'
                            : ''
                          const parts = f.split(/(₸[\d,]+(?:\.\d+)?(?:\s*(?:млн|млрд|тыс))?(?:\s*\([^)]*\))?)/g)
                          return (
                            <li key={i} className={`flex items-start gap-2 text-xs text-gray-300 ${rowBg}`}>
                              <ChevronRight className={`w-3.5 h-3.5 ${iconColor} mt-0.5 flex-shrink-0`} />
                              <span className="leading-snug">
                                {parts.map((part, j) =>
                                  part.startsWith('₸')
                                    ? <span key={j} className={`font-bold ${amtColor} rounded px-1 mx-0.5 whitespace-nowrap`}>{part}</span>
                                    : <span key={j}>{part}</span>
                                )}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {selected.aiAnalysis.recommended_investigations && selected.aiAnalysis.recommended_investigations.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-blue-400" /> Рекомендуемые действия
                      </div>
                      <ul className="space-y-1.5">
                        {selected.aiAnalysis.recommended_investigations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="w-4 h-4 bg-blue-500/20 text-blue-400 text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            <span className="leading-snug">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : selected.aiAnalysis?.error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  Ошибка анализа: {selected.aiAnalysis.error}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-600">
                  <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Нажмите «Запустить анализ» для получения ИИ-оценки схемы</p>
                </div>
              )}
            </div>

            {/* Involved entities */}
            <div className="bg-kz-panel border border-white/8 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Network className="w-4 h-4 text-blue-400" />
                Участники расследования ({selected.nodeIds.length})
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {selectedNodes.map(node => (
                  <div key={node.id}
                    className="flex items-center gap-2.5 p-3 bg-kz-surface rounded-xl border border-white/5 cursor-pointer hover:border-white/15 transition-colors"
                    onClick={() => navigate(`/network?nodes=${node.id}`)}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[node.type] }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-medium truncate">{node.name}</div>
                      <div className="text-[9px] text-gray-600">{TYPE_NAMES[node.type]}</div>
                    </div>
                    {node.is_suspicious && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                  </div>
                ))}
                {selected.nodeIds.filter(id => !selectedNodes.find(n => n.id === id)).map(id => (
                  <div key={id} className="flex items-center gap-2 p-3 bg-kz-surface/50 rounded-xl border border-white/3">
                    <div className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
                    <span className="text-xs text-gray-600">{id}</span>
                  </div>
                ))}
              </div>
            </div>
            </>)
            }

            {/* ── Protocol tab ── */}
            {rightTab === 'protocol' && (() => {
              const score = selected.aiAnalysis?.network_risk_score ?? 0
              const caseNum = `ТА-${selected.id.replace('demo-', '').toUpperCase()}-${new Date(selected.createdAt).getFullYear()}`
              const dateStr = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(selected.createdAt))
              const classification = score >= 80 ? 'СОВЕРШЕННО СЕКРЕТНО' : score >= 60 ? 'СЕКРЕТНО' : 'ДЛЯ СЛУЖЕБНОГО ПОЛЬЗОВАНИЯ'
              const classColor = score >= 80 ? 'text-red-400 border-red-500/40 bg-red-500/10' : score >= 60 ? 'text-orange-400 border-orange-500/40 bg-orange-500/10' : 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
              const patterns = selected.aiAnalysis?.suspicious_patterns ?? []
              const totalAmt = patterns.reduce((acc, p) => {
                const amt = p.estimated_risk_amount && p.estimated_risk_amount > 0
                  ? p.estimated_risk_amount
                  : Math.round((score ** 2) * selected.nodeIds.length * 250_000 / Math.max(1, patterns.length))
                return acc + amt
              }, 0)
              const fmtAmt = (v: number) => v >= 1e9 ? `₸${(v / 1e9).toFixed(2)} млрд` : `₸${(v / 1e6).toFixed(1)} млн`
              return (
                <div className="bg-kz-panel border border-white/8 rounded-2xl overflow-hidden">
                  {/* Document header bar */}
                  <div className="bg-kz-surface/60 border-b border-white/8 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-gray-300 tracking-wide">ПРОТОКОЛ СЛУЖЕБНОГО РАССЛЕДОВАНИЯ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border tracking-widest ${classColor}`}>
                        {classification}
                      </span>
                      <button
                        onClick={() => generateProtocolPDF(selected, selectedNodes, graphData)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all">
                        <Download className="w-3 h-3" /> Скачать PDF
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Title block */}
                    <div className="text-center space-y-1 py-2">
                      <div className="text-[10px] text-gray-500 tracking-widest uppercase">Республика Казахстан · Комитет финансового мониторинга</div>
                      <div className="text-base font-bold text-white">{selected.name}</div>
                      <div className="text-[11px] text-gray-500">Дело № {caseNum} · Составлено: {dateStr}</div>
                    </div>

                    {/* Section 1 — Subject */}
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center">1</span>
                        СУБЪЕКТЫ РАССЛЕДОВАНИЯ
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedNodes.map(node => (
                          <div key={node.id} className="flex items-center gap-2 p-3 bg-kz-surface rounded-xl border border-white/6">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[node.type] }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-white font-medium truncate">{node.name}</div>
                              <div className="text-[9px] text-gray-600">{TYPE_NAMES[node.type]} · {node.id}</div>
                            </div>
                            {node.is_suspicious && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                          </div>
                        ))}
                        {selected.nodeIds.filter(id => !selectedNodes.find(n => n.id === id)).map(id => (
                          <div key={id} className="flex items-center gap-2 p-3 bg-kz-surface/40 rounded-xl border border-white/3">
                            <div className="w-2 h-2 rounded-full bg-gray-700 flex-shrink-0" />
                            <span className="text-xs text-gray-600">{id}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 2 — Risk assessment */}
                    {selected.aiAnalysis?.risk_assessment && (
                      <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center">2</span>
                          ОЦЕНКА РИСКОВ И ХАРАКТЕР НАРУШЕНИЙ
                        </div>
                        <div className="p-4 bg-kz-surface rounded-xl border border-white/8 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400">Индекс риска</span>
                            <span className={`text-xl font-black ${
                              score >= 80 ? 'text-red-400' : score >= 60 ? 'text-orange-400' : score >= 40 ? 'text-yellow-400' : 'text-green-400'
                            }`}>{score}<span className="text-xs font-normal text-gray-500">/100</span></span>
                          </div>
                          {selected.aiAnalysis.risk_assessment.split(/[.!?]+/).filter(s => s.trim().length > 10).map((sentence, i) => {
                            const s = sentence.trim()
                            const isRed = /хищен|откат|незакон|мошен|фиктив/i.test(s)
                            const isGreen = /легал|официальн/i.test(s)
                            return (
                              <p key={i} className={`text-xs leading-relaxed ${
                                isRed ? 'text-red-300' : isGreen ? 'text-green-300' : 'text-gray-400'
                              }`}>{s}.</p>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 3 — Detected violations */}
                    {patterns.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center">3</span>
                          ВЫЯВЛЕННЫЕ НАРУШЕНИЯ
                        </div>
                        <div className="space-y-2">
                          {patterns.map((p, i) => {
                            const amt = p.estimated_risk_amount && p.estimated_risk_amount > 0
                              ? p.estimated_risk_amount
                              : Math.round((score ** 2) * selected.nodeIds.length * 250_000 / Math.max(1, patterns.length))
                            return (
                              <div key={i} className="flex gap-3 p-3 bg-kz-surface rounded-xl border border-white/6">
                                <span className="w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="text-xs font-semibold text-red-300">{p.pattern_type}</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0">{p.severity}</span>
                                  </div>
                                  <p className="text-xs text-gray-400 leading-snug mb-1">{p.description}</p>
                                  <div className="text-[10px] font-semibold text-orange-400">{fmtAmt(amt)} под риском</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 4 — Key findings */}
                    {(selected.aiAnalysis?.key_findings ?? []).length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center">4</span>
                          КЛЮЧЕВЫЕ ФАКТЫ
                        </div>
                        <div className="p-3 bg-kz-surface rounded-xl border border-white/6 space-y-2">
                          {selected.aiAnalysis!.key_findings!.map((f, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-[10px] text-gray-600 font-mono flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}.</span>
                              <p className="text-xs text-gray-300 leading-snug">{f}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 5 — Recommendations */}
                    {(selected.aiAnalysis?.recommended_investigations ?? []).length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center">5</span>
                          РЕКОМЕНДОВАННЫЕ ДЕЙСТВИЯ
                        </div>
                        <div className="space-y-2">
                          {selected.aiAnalysis!.recommended_investigations!.map((r, i) => (
                            <div key={i} className="flex items-start gap-2.5 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl">
                              <span className="w-5 h-5 bg-blue-500/20 text-blue-400 text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                              <p className="text-xs text-gray-300 leading-snug">{r}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Conclusion */}
                    <div className="p-4 bg-gradient-to-r from-red-500/8 to-orange-500/8 border border-red-500/20 rounded-xl">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-red-400" /> ЗАКЛЮЧЕНИЕ
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        На основании проведённого анализа сети взаимодействий {selected.nodeIds.length}{ }субъектов,
                        выявлено {patterns.length}{ }подозрительных схем{ }с совокупным объёмом рисков
                        <span className="font-bold text-orange-400"> {fmtAmt(totalAmt)}</span>.
                        Индекс коррупционного риска:
                        <span className={`font-black ml-1 ${
                          score >= 80 ? 'text-red-400' : score >= 60 ? 'text-orange-400' : 'text-yellow-400'
                        }`}>{score}/100</span>.
                        Материалы подлежат передаче в уполномоченные органы для принятия решения.
                      </p>
                      <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-between text-[10px] text-gray-600">
                        <span>Дело № {caseNum}</span>
                        <span>Дата составления: {dateStr}</span>
                        <span>Статус: АКТИВНОЕ РАССЛЕДОВАНИЕ</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
            <p>Выберите расследование слева</p>
          </div>
        )}
      </div>

      {/* ── Create investigation modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-kz-panel border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-kz-panel border-b border-white/8 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-kz-blue" /> Новое расследование
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name + description */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Название *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Например: Схема откатов — Министерство ИТ 2024"
                    className="w-full bg-kz-surface border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-kz-blue/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Описание</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Краткое описание подозрительной схемы..."
                    rows={3}
                    className="w-full bg-kz-surface border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-kz-blue/50 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Теги (через запятую)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    placeholder="откат, офшор, госзакупки"
                    className="w-full bg-kz-surface border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-kz-blue/50"
                  />
                </div>
              </div>

              {/* Node selection */}
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block">
                  Участники ({pickedNodes.length} выбрано) *
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-600" />
                  <input
                    type="text"
                    value={nodeSearch}
                    onChange={e => setNodeSearch(e.target.value)}
                    placeholder="Поиск организации или физ. лица..."
                    className="w-full bg-kz-surface border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-kz-blue/50"
                  />
                </div>
                <div className="h-48 overflow-y-auto bg-kz-surface/50 rounded-xl border border-white/5 divide-y divide-white/5">
                  {filteredNodes.map(node => {
                    const isSelected = pickedNodes.includes(node.id)
                    return (
                      <button key={node.id}
                        onClick={() => setPickedNodes(prev =>
                          isSelected ? prev.filter(id => id !== node.id) : [...prev, node.id]
                        )}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-kz-blue/15' : 'hover:bg-white/5'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-kz-blue border-kz-blue' : 'border-white/20'}`}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[node.type] }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white font-medium truncate">{node.name}</div>
                          <div className="text-[9px] text-gray-600">{TYPE_NAMES[node.type]} · {node.region}</div>
                        </div>
                        {node.is_suspicious && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        {node.type === 'individual' ? <User className="w-3 h-3 text-pink-400 flex-shrink-0" /> : <Building2 className="w-3 h-3 text-gray-600 flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
                {/* Selected summary */}
                {pickedNodes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pickedNodes.slice(0, 8).map(id => {
                      const node = graphData?.nodes.find((n: NetworkNode) => n.id === id)
                      return (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-kz-blue/15 border border-kz-blue/25 rounded-lg text-[10px] text-kz-blue">
                          {node?.name ?? id}
                          <button onClick={() => setPickedNodes(prev => prev.filter(p => p !== id))} className="hover:text-white">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      )
                    })}
                    {pickedNodes.length > 8 && <span className="text-[10px] text-gray-500">+{pickedNodes.length - 8} ещё</span>}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                  Отмена
                </button>
                <button
                  onClick={createInvestigation}
                  disabled={!newName.trim() || pickedNodes.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-kz-blue hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-medium transition-all">
                  <Save className="w-4 h-4" /> Создать расследование
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
