/**
 * VoiceChatPage — Голосовой ИИ-ассистент AURON
 * Audio: PCM16 @ 16kHz → Gemini → PCM16 @ 24kHz
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Mic, MicOff, Square, Volume2, VolumeX,
  Loader2, Bot, User2, AlertCircle,
  Sparkles, Trash2, ExternalLink,
  History, Plus, MessageSquare, ChevronLeft,
} from 'lucide-react'
import type { NetworkNode } from '../types'
// aiAnalyzeNetwork is triggered manually by the user in the Investigations page

/* ─── Constants ──────────────────────────────────────── */
const GEMINI_LIVE_KEY = 'AIzaSyAERXVvZR2WEPH6pbLaufX0e_Q6GbxyZeY'
const GEMINI_LIVE_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025'
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_LIVE_KEY}`

const SAMPLE_RATE_IN = 16000
const SAMPLE_RATE_OUT = 24000
const VOICE_STORAGE_KEY = 'turk_voice_history'
const INV_STORAGE_KEY = 'turk_investigations'
const CONV_STORAGE_KEY = 'auron_voice_conversations'
const MAX_HISTORY = 200

const TYPE_NAMES: Record<string, string> = {
  government: 'Гос. орган', company: 'Компания',
  intermediary: 'Посредник', offshore: 'Офшор', individual: 'Физ. лицо',
}

/* ─── AudioWorklet ───────────────────────────────────── */
const WORKLET_CODE = `
class PCMCapture extends AudioWorkletProcessor {
  constructor() { super(); this._buf = []; this._size = 2048; }
  process(inputs) {
    const ch = inputs[0]?.[0]; if (!ch) return true;
    for (let i = 0; i < ch.length; i++) this._buf.push(ch[i]);
    while (this._buf.length >= this._size) {
      const chunk = this._buf.splice(0, this._size);
      const i16 = new Int16Array(this._size);
      for (let i = 0; i < this._size; i++)
        i16[i] = Math.max(-32768, Math.min(32767, Math.round(chunk[i] * 32767)));
      this.port.postMessage(i16.buffer, [i16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PCMCapture);
`

/* ─── Helpers ────────────────────────────────────────── */
function toBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf); let s = ''
  for (let i = 0; i < b.byteLength; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}
function b64ToI16(b64: string): Int16Array {
  const bin = atob(b64); const buf = new ArrayBuffer(bin.length)
  const u8 = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return new Int16Array(buf)
}
function i16ToF32(i16: Int16Array): Float32Array {
  const f = new Float32Array(i16.length)
  for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32768
  return f
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
function loadHistory(): ChatLine[] {
  try { const r = localStorage.getItem(VOICE_STORAGE_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
}
function saveHistory(lines: ChatLine[]) {
  try { localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(lines.slice(-MAX_HISTORY))) } catch {}
}
/** Strip markdown formatting and voice commands for clean display */
function cleanText(text: string): string {
  return text
    .replace(/СОЗДАТЬ_РАССЛЕДОВАНИЕ:[^\n]*/g, '')
    .replace(/ОТКРЫТЬ_ГРАФ|ОТКРЫТЬ_РАССЛЕДОВАНИЯ|ОТКРЫТЬ_КАРТУ|ОТКРЫТЬ_СВОДКУ/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

/* ─── Types ──────────────────────────────────────────── */
type Status = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'
interface ChatLine { role: 'user' | 'assistant' | 'system'; text: string; ts: number; _live?: boolean; link?: string; linkLabel?: string }
interface Suspect { id: string; name: string; type: string; riskScore: number }
interface Conversation { id: string; title: string; startedAt: number; messages: ChatLine[] }

/* ─── Conversation storage ───────────────────────────── */
function loadConversations(): Conversation[] {
  try { const r = localStorage.getItem(CONV_STORAGE_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
}
function saveConversations(convs: Conversation[]) {
  try { localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(convs.slice(0, 60))) } catch {}
}
function autoTitle(messages: ChatLine[]): string {
  const first = messages.find(m => m.role === 'user')
  if (first) {
    const t = cleanText(first.text).replace(/[\n\r]+/g, ' ')
    return t.slice(0, 52) + (t.length > 52 ? '…' : '')
  }
  return 'Сессия ' + new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtDate(ts: number) {
  const d = new Date(ts), now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Сегодня'
  const yest = new Date(now); yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

/* ══════════════════ COMPONENT ═══════════════════════════ */
export default function VoiceChatPage() {
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [history, setHistory] = useState<ChatLine[]>(loadHistory)
  const [liveUser, setLiveUser] = useState('')
  const [liveBot, setLiveBot] = useState('')
  const [level, setLevel] = useState(0)
  const [suspects, setSuspects] = useState<Suspect[]>([])
  const [cmdNote, setCmdNote] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const [viewingConv, setViewingConv] = useState<Conversation | null>(null)
  const [wavePhase, setWavePhase] = useState(0)
  const waveAnimRef = useRef<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const capCtxRef = useRef<AudioContext | null>(null)
  const playCtxRef = useRef<AudioContext | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nextPlayRef = useRef(0)
  const loopRef = useRef(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const luRef = useRef(''); const lbRef = useRef('')
  const isMutedRef = useRef(false)
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  const { data: graphData } = useQuery({
    queryKey: ['networkGraph'],
    queryFn: () => import('../api').then(m => m.getNetworkGraph()),
  })

  useEffect(() => {
    if (!graphData?.nodes) return
    const top = (graphData.nodes as NetworkNode[])
      .filter((n: any) => n.is_suspicious)
      .sort((a: any, b: any) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
      .slice(0, 8)
      .map((n: any) => ({ id: n.id, name: n.name, type: n.entity_type ?? n.type, riskScore: n.risk_score ?? 0 }))
    setSuspects(top)
  }, [graphData])

  useEffect(() => { saveHistory(history) }, [history])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history, liveUser, liveBot])
  useEffect(() => () => { stopAll(false) }, [])

  useEffect(() => {
    if (status === 'speaking') {
      const tick = () => {
        setWavePhase(p => p + 0.12)
        waveAnimRef.current = requestAnimationFrame(tick)
      }
      waveAnimRef.current = requestAnimationFrame(tick)
    } else {
      if (waveAnimRef.current) { cancelAnimationFrame(waveAnimRef.current); waveAnimRef.current = null }
    }
    return () => { if (waveAnimRef.current) { cancelAnimationFrame(waveAnimRef.current); waveAnimRef.current = null } }
  }, [status])

  const systemPrompt = useMemo(() => {
    const ctx = suspects.length > 0
      ? '\n\nПодозреваемые в базе:\n' + suspects.map(s =>
          `- ${s.name} (${TYPE_NAMES[s.type] ?? s.type}, ID: ${s.id}, риск: ${s.riskScore}%)`
        ).join('\n')
      : ''
    return `Ты — голосовой ИИ-ассистент антикоррупционной системы AURON для Казахстана.
Ты помогаешь следователям анализировать финансовые схемы: откаты, офшоры, обналичивание, фиктивные тендеры госзакупок.

КРИТИЧЕСКИЕ ПРАВИЛА ЯЗЫКА:
- ВСЕГДА отвечай на том языке, на котором говорит пользователь.
- Если пользователь говорит на русском — отвечать ТОЛЬКО на русском.
- Если пользователь говорит на казахском — отвечать ТОЛЬКО на казахском.
- НИКОГДА не отвечай на английском языке.
- Отвечай КРАТКО и по делу — максимум 2-3 предложения.
- НЕ используй markdown: без **, без *, без #, без нумерованных списков в начале.
- Не добавляй вводных фраз типа «Конечно», «Разумеется», «Хорошо».
- НЕ показывай своё мышление или рассуждение — только финальный ответ.

СОЗДАНИЕ РАССЛЕДОВАНИЯ — СТРОГИЙ ПОРЯДОК:
1. Если пользователь просит создать расследование — СНАЧАЛА спроси: «Назовите название расследования и минимум 2 субъекта для включения (имена компаний или лиц из базы)».
2. Дождись ответа пользователя с названием и субъектами.
3. Только после получения обоих данных — вставь команду в точном формате:
   СОЗДАТЬ_РАССЛЕДОВАНИЕ:<название>|<субъект1>,<субъект2>
   Например: СОЗДАТЬ_РАССЛЕДОВАНИЕ:Дело Акимата 2024|Ромашка ТОО,Иванов А.А.
4. Субъекты пиши через запятую — минимум 2. Бери имена из списка подозреваемых если они совпадают.

КОМАНДЫ НАВИГАЦИИ (вставляй точно как написано):
- Когда просят граф/сеть/схему — вставь: ОТКРЫТЬ_ГРАФ
- Когда просят список расследований — вставь: ОТКРЫТЬ_РАССЛЕДОВАНИЯ
- Когда просят карту/геокарту — вставь: ОТКРЫТЬ_КАРТУ
- Когда просят сводку/дашборд — вставь: ОТКРЫТЬ_СВОДКУ${ctx}`
  }, [suspects])

  /* ── Play PCM ── */
  const play = useCallback((f32: Float32Array) => {
    const ctx = playCtxRef.current; if (!ctx) return
    try {
      const buf = ctx.createBuffer(1, f32.length, SAMPLE_RATE_OUT)
      buf.copyToChannel(f32 as unknown as Float32Array<ArrayBuffer>, 0)
      const src = ctx.createBufferSource(); src.buffer = buf
      src.connect(ctx.destination)
      const t = Math.max(ctx.currentTime, nextPlayRef.current)
      src.start(t); nextPlayRef.current = t + buf.duration
    } catch {}
  }, [])

  /* ── Execute voice commands ── */
  const execCmd = useCallback((text: string) => {
    // Format: СОЗДАТЬ_РАССЛЕДОВАНИЕ:<название>|<субъект1>,<субъект2>,...
    const m = text.match(/СОЗДАТЬ_РАССЛЕДОВАНИЕ:([^|\n]+)\|([^\n]+)/)
    if (m) {
      const name = m[1].trim()
      const subjectNames = m[2].split(',').map(s => s.trim()).filter(Boolean)
      // Try to match subject names to known suspects by name (case-insensitive partial)
      const matchedIds = subjectNames
        .map(sn => suspects.find(s => s.name.toLowerCase().includes(sn.toLowerCase()) || sn.toLowerCase().includes(s.name.toLowerCase())))
        .filter((s): s is Suspect => !!s)
        .map(s => s.id)
      // Dedupe: prefer matched suspects, fill remaining from top suspects list if needed
      const fallbackIds = suspects.slice(0, 6).map(s => s.id)
      const nodeIds = [...new Set([...matchedIds, ...fallbackIds])].slice(0, 6)
      const resolvedNames = subjectNames.length > 0 ? subjectNames.join(', ') : suspects.slice(0, 3).map(s => s.name).join(', ')
      const invId = `voice-${Date.now()}`
      const inv: any = {
        id: invId, name: `🎤 ${name}`,
        description: `Создано голосовым ассистентом. Субъекты: ${resolvedNames}`,
        nodeIds,
        aiAnalysis: null, aiRunAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        tags: ['голос', 'авто'],
      }
      try {
        const raw = localStorage.getItem(INV_STORAGE_KEY)
        const list = raw ? JSON.parse(raw) : []
        list.unshift(inv)
        localStorage.setItem(INV_STORAGE_KEY, JSON.stringify(list))
        setCmdNote(`✅ Расследование «${name}» создано (${nodeIds.length} субъектов) — нажмите «Расследовать» для анализа`)
        setTimeout(() => setCmdNote(null), 7000)
        setHistory(prev => [...prev, {
          role: 'system',
          text: `Расследование «${name}» создано. Субъекты: ${resolvedNames}. Откройте его и нажмите «Расследовать» для запуска ИИ-анализа.`,
          ts: Date.now(),
          link: '/investigations',
          linkLabel: 'Открыть расследования →',
        }])
      } catch {}
    }
    if (text.includes('ОТКРЫТЬ_ГРАФ')) setTimeout(() => navigate('/network'), 600)
    if (text.includes('ОТКРЫТЬ_РАССЛЕДОВАНИЯ')) setTimeout(() => navigate('/investigations'), 600)
    if (text.includes('ОТКРЫТЬ_КАРТУ')) setTimeout(() => navigate('/map'), 600)
    if (text.includes('ОТКРЫТЬ_СВОДКУ')) setTimeout(() => navigate('/'), 600)
  }, [suspects, navigate])

  /* ── WS handler ── */
  const onMsg = useCallback((raw: string) => {
    let msg: any; try { msg = JSON.parse(raw) } catch { return }
    if (msg.setupComplete !== undefined) { setStatus('listening'); return }
    const sc = msg.serverContent; if (!sc) return

    if (sc.inputTranscription?.text) {
      luRef.current += sc.inputTranscription.text; setLiveUser(luRef.current)
    }
    if (sc.outputTranscription?.text) {
      lbRef.current += sc.outputTranscription.text; setLiveBot(lbRef.current)
    }
    if (sc.modelTurn?.parts) {
      for (const p of sc.modelTurn.parts) {
        if (p.text) { lbRef.current += p.text; setLiveBot(lbRef.current) }
        if (p.inlineData?.data && !isMutedRef.current) {
          play(i16ToF32(b64ToI16(p.inlineData.data))); setStatus('speaking')
        }
      }
    }
    if (sc.turnComplete) {
      const u = luRef.current.trim(); const b = lbRef.current.trim(); const now = Date.now()
      const lines: ChatLine[] = [
        ...(u ? [{ role: 'user' as const, text: u, ts: now }] : []),
        ...(b ? [{ role: 'assistant' as const, text: b, ts: now + 1 }] : []),
      ]
      if (lines.length) setHistory(prev => [...prev, ...lines])
      if (b) execCmd(b)
      luRef.current = ''; lbRef.current = ''; setLiveUser(''); setLiveBot('')
      setStatus('listening')
    }
    if (sc.interrupted) setStatus('listening')
  }, [play, execCmd])

  const onMsgRef = useRef(onMsg)
  useEffect(() => { onMsgRef.current = onMsg }, [onMsg])

  /* ── Stop ── */
  const stopAll = useCallback((flush = true) => {
    loopRef.current = false
    wsRef.current?.close(1000, 'stopped'); wsRef.current = null
    workletRef.current?.disconnect(); workletRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    capCtxRef.current?.close(); capCtxRef.current = null
    playCtxRef.current?.close(); playCtxRef.current = null
    setLevel(0); setStatus('idle')
    if (flush) {
      const u = luRef.current.trim(); const b = lbRef.current.trim(); const now = Date.now()
      const leftovers: ChatLine[] = [
        ...(u ? [{ role: 'user' as const, text: u, ts: now }] : []),
        ...(b ? [{ role: 'assistant' as const, text: b, ts: now + 1 }] : []),
      ]
      if (leftovers.length) setHistory(prev => [...prev, ...leftovers])
    }
    luRef.current = ''; lbRef.current = ''; setLiveUser(''); setLiveBot('')
  }, [])

  /* ── New chat ── */
  const newChat = useCallback(() => {
    if (status !== 'idle' && status !== 'error') stopAll(true)
    setHistory(prev => {
      if (prev.length > 0) {
        const conv: Conversation = { id: String(Date.now()), title: autoTitle(prev), startedAt: prev[0].ts, messages: prev }
        setConversations(c => { const next = [conv, ...c.slice(0, 59)]; saveConversations(next); return next })
      }
      localStorage.removeItem(VOICE_STORAGE_KEY)
      return []
    })
    setViewingConv(null)
  }, [status, stopAll])

  /* ── Start session ── */
  const startSession = useCallback(async () => {
    if (status !== 'idle' && status !== 'error') return
    setError(null); setStatus('connecting')
    try {
      const capCtx = new AudioContext({ sampleRate: SAMPLE_RATE_IN })
      capCtxRef.current = capCtx
      const pCtx = new AudioContext({ sampleRate: SAMPLE_RATE_OUT })
      playCtxRef.current = pCtx; nextPlayRef.current = 0

      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
      const bUrl = URL.createObjectURL(blob)
      await capCtx.audioWorklet.addModule(bUrl)
      URL.revokeObjectURL(bUrl)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SAMPLE_RATE_IN, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      const src = capCtx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(capCtx, 'pcm-capture')
      workletRef.current = worklet
      src.connect(worklet)

      const an = capCtx.createAnalyser(); an.fftSize = 256; src.connect(an)
      const vb = new Float32Array(an.fftSize); loopRef.current = true
      const viz = () => {
        if (!loopRef.current) return
        an.getFloatTimeDomainData(vb)
        let rms = 0; for (let i = 0; i < vb.length; i++) rms += vb[i] * vb[i]
        setLevel(Math.min(1, Math.sqrt(rms / vb.length) * 12))
        requestAnimationFrame(viz)
      }; viz()

      const ws = new WebSocket(WS_URL); wsRef.current = ws
      ws.onopen = () => ws.send(JSON.stringify({
        setup: {
          model: GEMINI_LIVE_MODEL,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
          },
          systemInstruction: { parts: [{ text: systemPrompt }] },
        },
      }))
      ws.onmessage = async (ev) => {
        const raw = ev.data instanceof Blob ? await ev.data.text() : ev.data
        onMsgRef.current(raw)
      }
      ws.onerror = () => { setError('Ошибка WebSocket. Проверьте интернет-соединение.'); setStatus('error') }
      ws.onclose = (ev) => {
        if (ev.code !== 1000 && ev.code !== 1001)
          setError(`Соединение закрыто (${ev.code}): ${ev.reason || 'нет причины'}`)
      }
      worklet.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
        if (ws.readyState !== WebSocket.OPEN) return
        ws.send(JSON.stringify({ realtimeInput: { audio: { data: toBase64(ev.data), mimeType: 'audio/pcm;rate=16000' } } }))
      }
    } catch (e: any) {
      const m = e?.message ?? String(e)
      setError(m.includes('Permission') || m.includes('NotAllowed')
        ? 'Нет доступа к микрофону. Разрешите доступ в браузере.'
        : m)
      setStatus('error'); stopAll(false)
    }
  }, [status, systemPrompt, stopAll])

  const isActive = status !== 'idle' && status !== 'error'
  const bars = 20

  const statusCfg: Record<Status, { label: string; cls: string }> = {
    idle:       { label: 'Нажмите ● для начала', cls: 'text-gray-500' },
    connecting: { label: 'Подключение...',        cls: 'text-yellow-400' },
    listening:  { label: 'Слушаю...',             cls: 'text-blue-400' },
    speaking:   { label: 'ИИ отвечает...',         cls: 'text-purple-400' },
    error:      { label: 'Ошибка',                cls: 'text-red-400' },
  }

  const displayMessages: ChatLine[] = viewingConv ? viewingConv.messages : [
    ...history,
    ...((isActive && liveUser) ? [{ role: 'user' as const, text: liveUser, ts: Date.now(), _live: true }] : []),
    ...((isActive && liveBot)  ? [{ role: 'assistant' as const, text: liveBot, ts: Date.now(), _live: true }] : []),
  ]

  return (
    <div className="flex h-full overflow-hidden">

      {/* ═══ SIDEBAR ══════════════════════════════════════ */}
      <div className={`flex-shrink-0 flex flex-col overflow-hidden border-r border-white/8 transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-0'}`}>
        {sidebarOpen && (
          <>
            <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">История</span>
              <button onClick={newChat}
                className="flex items-center gap-1 text-[10px] bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/25 rounded-lg px-2 py-1 transition-colors">
                <Plus className="w-3 h-3" /> Новый
              </button>
            </div>

            {history.length > 0 && (
              <button onClick={() => setViewingConv(null)}
                className={`mx-2 mb-1 text-left px-2.5 py-2 rounded-xl flex items-start gap-2 transition-colors ${viewingConv === null ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-white/5'}`}>
                <MessageSquare className="w-3 h-3 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-white truncate">{autoTitle(history) || 'Текущий диалог'}</div>
                  <div className="text-[9px] text-indigo-400 mt-0.5">Текущий</div>
                </div>
              </button>
            )}

            {conversations.length > 0 && <div className="mx-3 my-1 border-t border-white/6" />}

            <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-3 scrollbar-thin scrollbar-thumb-white/10">
              {conversations.map(conv => (
                <button key={conv.id} onClick={() => setViewingConv(conv)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl flex items-start gap-2 transition-colors ${viewingConv?.id === conv.id ? 'bg-white/8 border border-white/12' : 'hover:bg-white/5'}`}>
                  <MessageSquare className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-gray-300 truncate leading-snug">{conv.title}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5">{fmtDate(conv.startedAt)} · {conv.messages.length} сообщ.</div>
                  </div>
                </button>
              ))}
              {conversations.length === 0 && history.length === 0 && (
                <div className="text-[10px] text-gray-700 text-center py-6">Нет сохранённых диалогов</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ═══ MAIN ═════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 px-4 py-4">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(o => !o)} title="История диалогов"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${sidebarOpen ? 'bg-indigo-600/25 text-indigo-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/6'}`}>
              <History className="w-3.5 h-3.5" />
            </button>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow: '0 0 18px #7c3aed40' }}>
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </div>
            <div>
              {viewingConv ? (
                <button onClick={() => setViewingConv(null)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="max-w-[180px] truncate">{viewingConv.title}</span>
                </button>
              ) : (
                <>
                  <div className="text-sm font-bold text-white">Голосовой ИИ</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      status === 'listening' ? 'bg-blue-400 animate-pulse'
                      : status === 'speaking' ? 'bg-purple-400 animate-pulse'
                      : status === 'connecting' ? 'bg-yellow-400 animate-pulse'
                      : status === 'error' ? 'bg-red-500'
                      : 'bg-gray-600'}`} />
                    <span className={`text-[10px] ${statusCfg[status].cls}`}>
                      {status === 'connecting' && <Loader2 className="w-2.5 h-2.5 inline mr-0.5 animate-spin" />}
                      {statusCfg[status].label}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewingConv ? (
              <button onClick={() => {
                if (!confirm('Удалить этот диалог?')) return
                setConversations(c => { const next = c.filter(x => x.id !== viewingConv.id); saveConversations(next); return next })
                setViewingConv(null)
              }} className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-400 transition-colors">
                <Trash2 className="w-3 h-3" /> Удалить
              </button>
            ) : (
              <>
                {history.length > 0 && (
                  <button onClick={newChat} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                    <Plus className="w-3 h-3" /> Новый
                  </button>
                )}
                {history.length > 0 && (
                  <button onClick={() => { setHistory([]); localStorage.removeItem(VOICE_STORAGE_KEY) }}
                    className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
                    <Trash2 className="w-3 h-3" /> Очистить
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex-shrink-0">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Command feedback */}
        {cmdNote && (
          <div className="p-2.5 mb-3 bg-green-500/10 border border-green-500/25 rounded-xl text-xs text-green-400 font-medium flex-shrink-0">
            {cmdNote}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-2 scrollbar-thin scrollbar-thumb-white/10">

          {viewingConv && (
            <div className="text-center py-1.5 text-[10px] text-gray-700">
              — {new Date(viewingConv.startedAt).toLocaleString('ru-RU')} —
            </div>
          )}

          {displayMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 select-none">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg,#7c3aed18,#3b82f618)', border: '1px solid #7c3aed22' }}>
                <svg className="w-7 h-7 text-purple-500/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">Нажмите микрофон и начните разговор</p>
              <p className="text-xs text-gray-700 mt-1">Поддерживает русский и казахский</p>
            </div>
          )}

          {displayMessages.map((line, i) => {
            const displayText = cleanText(line.text)
            if (!displayText && line.role !== 'system') return null
            return (
              <div key={i} className={`flex gap-2.5 ${line.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center ${
                  line.role === 'user' ? 'bg-blue-500/20'
                  : line.role === 'system' ? 'bg-green-500/10'
                  : 'bg-gradient-to-br from-purple-600/30 to-blue-600/30'
                }`}>
                  {line.role === 'user' ? <User2 className="w-3.5 h-3.5 text-blue-400" />
                    : line.role === 'system' ? <Sparkles className="w-3.5 h-3.5 text-green-400" />
                    : <Bot className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <div className={`max-w-[78%] flex flex-col gap-1 ${line.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    line.role === 'user'
                      ? 'bg-blue-600/20 border border-blue-500/20 text-gray-200 rounded-tr-sm'
                      : line.role === 'system'
                      ? 'bg-green-500/10 border border-green-500/20 text-green-300 rounded-tl-sm'
                      : 'bg-white/6 border border-white/10 text-gray-100 rounded-tl-sm'
                  } ${line._live ? 'opacity-60' : ''}`}>
                    {displayText || line.text}
                    {line._live && <span className="inline-block w-1 h-3.5 ml-0.5 bg-current opacity-70 animate-pulse rounded-full" />}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[9px] text-gray-700">{fmtTime(line.ts)}</span>
                    {line.link && (
                      <button onClick={() => navigate(line.link!)}
                        className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 transition-colors">
                        <ExternalLink className="w-2.5 h-2.5" /> {line.linkLabel ?? line.link}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* Bottom voice bar */}
        {!viewingConv && (
          <div className="flex-shrink-0 mt-3 bg-white/4 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-[2px] h-7 flex-1">
              {Array.from({ length: bars }).map((_, i) => {
                const cx = bars / 2; const d = 1 - Math.abs(i - cx) / cx
                let lv: number
                if (!isActive) {
                  lv = 0.05
                } else if (status === 'listening') {
                  lv = Math.max(0.08, 0.1 + level * d * 1.2)
                } else if (status === 'speaking') {
                  lv = Math.max(0.1, 0.28 + Math.sin(wavePhase + i * 0.65) * 0.28 * d)
                } else {
                  lv = Math.max(0.08, 0.15 + 0.15 * d)
                }
                return (
                  <div key={i} className="flex-1 rounded-full"
                    style={{
                      height: `${Math.min(100, lv * 100)}%`,
                      backgroundColor: status === 'speaking' ? `rgba(168,85,247,${0.35 + d * 0.55})`
                        : status === 'listening' ? `rgba(96,165,250,${0.3 + lv * 0.6})`
                        : 'rgba(255,255,255,0.07)',
                      transition: status === 'listening' ? 'height 60ms' : 'none',
                    }} />
                )
              })}
            </div>
            <button onClick={() => setIsMuted(m => !m)}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all flex-shrink-0">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {!isActive
              ? <button onClick={startSession}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0 hover:scale-105 active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow: '0 0 24px #7c3aed50' }}>
                  <Mic className="w-5 h-5" />
                </button>
              : <button onClick={() => stopAll(true)}
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 shadow-lg shadow-red-600/30 flex items-center justify-center text-white flex-shrink-0 hover:scale-105 active:scale-95 transition-transform">
                  <Square className="w-5 h-5" />
                </button>
            }
            <button onClick={() => {
                const tracks = streamRef.current?.getAudioTracks() ?? []
                const next = !micOn; tracks.forEach(t => { t.enabled = next }); setMicOn(next)
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all flex-shrink-0 ${
                micOn ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
