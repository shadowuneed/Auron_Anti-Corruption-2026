import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getNetworkGraph, getMapFlows, getEntityDetail, aiAnalyzeNetwork } from '../api'
import type { NetworkNode, NetworkEdge, EntityDetail, NetworkAIAnalysis, GeoFlow } from '../types'
import {
  Brain, X, AlertTriangle, ArrowRight, ArrowLeft, Search,
  ZoomIn, ZoomOut, Maximize2, Loader2, Map as MapIcon, Network,
  Plus, User, Building2, Plane, ShoppingBag,
  ChevronRight, Waypoints, FileText,
  Eye, TrendingDown, BarChart3, EyeOff, Expand, Shrink,
  CreditCard, Banknote, MapPin, Trash2
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

/* ───────── Constants ───────── */
const TYPE_COLORS: Record<string, string> = {
  government: '#3B82F6',
  company: '#22C55E',
  intermediary: '#F59E0B',
  offshore: '#EF4444',
  individual: '#EC4899',
}

const TYPE_LABELS: Record<string, string> = {
  government: 'GOV',
  company: 'COM',
  intermediary: 'INT',
  offshore: 'OFF',
  individual: 'NP',
}

const TYPE_NAMES: Record<string, string> = {
  government: 'Гос. орган',
  company: 'Компания',
  intermediary: 'Посредник',
  offshore: 'Оффшор',
  individual: 'Физ. лицо',
}

const RELATION_EDGE_COLORS: Record<string, string> = {
  director: '#EC4899',
  founder: '#06B6D4',
  relative: '#F97316',
}

function formatAmount(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toFixed(0)
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ── Semantic entity icon renderer ── */
/* s = scale: 1 for graph nodes, 0.55 for map/globe pins */
function drawEntityIcon(g: any, type: string, s: number) {
  switch (type) {
    case 'individual': {
      // Head circle + body shoulders (person silhouette)
      g.append('circle').attr('r', 4.5 * s).attr('cy', -5.5 * s)
        .attr('fill', '#fff').attr('fill-opacity', 0.9).attr('pointer-events', 'none')
      g.append('path')
        .attr('d', `M${-7 * s},${1.5 * s} C${-8 * s},${11 * s} ${-4 * s},${13 * s} 0,${13 * s} C${4 * s},${13 * s} ${8 * s},${11 * s} ${7 * s},${1.5 * s} C${5 * s},${-2 * s} ${-5 * s},${-2 * s} ${-7 * s},${1.5 * s} Z`)
        .attr('fill', '#fff').attr('fill-opacity', 0.9).attr('pointer-events', 'none')
      break
    }
    case 'government': {
      // Pediment triangle + 4 columns + base (capitol building)
      g.append('path').attr('d', `M0,${-11 * s} L${-9 * s},${-5 * s} L${9 * s},${-5 * s} Z`)
        .attr('fill', '#fff').attr('fill-opacity', 0.9).attr('pointer-events', 'none')
      ;[-5.5, -1.5, 2.5, 6.5].forEach((xc: number) => {
        g.append('rect').attr('x', (xc - 1.5) * s).attr('y', -5 * s)
          .attr('width', 3 * s).attr('height', 13 * s)
          .attr('fill', '#fff').attr('fill-opacity', 0.9).attr('pointer-events', 'none')
      })
      g.append('rect').attr('x', -10 * s).attr('y', 8 * s)
        .attr('width', 20 * s).attr('height', 3 * s)
        .attr('fill', '#fff').attr('fill-opacity', 0.9).attr('pointer-events', 'none')
      break
    }
    case 'company': {
      // Skyscraper body + window grid
      g.append('rect').attr('x', -6.5 * s).attr('y', -11 * s)
        .attr('width', 13 * s).attr('height', 20 * s).attr('rx', 0.8 * s)
        .attr('fill', '#fff').attr('fill-opacity', 0.9).attr('pointer-events', 'none')
      ;[[-3, -8], [0.5, -8], [3.5, -8], [-3, -4], [0.5, -4], [3.5, -4], [-3, -0.5], [0.5, -0.5], [3.5, -0.5]].forEach(([wx, wy]) => {
        g.append('rect').attr('x', wx * s).attr('y', wy * s)
          .attr('width', 2.2 * s).attr('height', 2.2 * s).attr('rx', 0.3 * s)
          .attr('fill', '#22C55E').attr('fill-opacity', 0.65).attr('pointer-events', 'none')
      })
      break
    }
    case 'intermediary': {
      // Double exchange arrows (↔)
      g.append('path')
        .attr('d', `M${-9 * s},${-7 * s} L${2 * s},${-7 * s} L${2 * s},${-10 * s} L${9 * s},${-3 * s} L${2 * s},${4 * s} L${2 * s},${1 * s} L${-9 * s},${1 * s} Z`)
        .attr('fill', '#fff').attr('fill-opacity', 0.9).attr('pointer-events', 'none')
      g.append('path')
        .attr('d', `M${9 * s},${7 * s} L${-2 * s},${7 * s} L${-2 * s},${10 * s} L${-9 * s},${3 * s} L${-2 * s},${-4 * s} L${-2 * s},${-1 * s} L${9 * s},${-1 * s} Z`)
        .attr('fill', '#fff').attr('fill-opacity', 0.45).attr('pointer-events', 'none')
      break
    }
    case 'offshore': {
      // Anchor: circle + bar + crossbar + curved arms
      g.append('circle').attr('r', 3.5 * s).attr('cy', -9 * s)
        .attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 2.2 * s)
        .attr('stroke-opacity', 0.9).attr('pointer-events', 'none')
      g.append('line').attr('y1', -5.5 * s).attr('y2', 9 * s)
        .attr('stroke', '#fff').attr('stroke-width', 2.2 * s).attr('stroke-opacity', 0.9).attr('pointer-events', 'none')
      g.append('line').attr('x1', -5 * s).attr('x2', 5 * s).attr('y1', -2 * s).attr('y2', -2 * s)
        .attr('stroke', '#fff').attr('stroke-width', 2.2 * s).attr('stroke-opacity', 0.9).attr('pointer-events', 'none')
      g.append('path').attr('d', `M${-8 * s},${5 * s} Q${-10 * s},${13 * s} 0,${13 * s} Q${10 * s},${13 * s} ${8 * s},${5 * s}`)
        .attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 2.2 * s)
        .attr('stroke-opacity', 0.9).attr('pointer-events', 'none')
      break
    }
    default:
      g.append('circle').attr('r', 4.5 * s)
        .attr('fill', '#fff').attr('fill-opacity', 0.6).attr('pointer-events', 'none')
  }
}

type ViewMode = 'graph' | 'map' | 'globe' | 'summary'
type EdgeStyle = 'curved' | 'straight'

/* ═══════════════════════════════════════════════════════════════
   Investigation Tool — NetworkGraph page (full rewrite)
   ═══════════════════════════════════════════════════════════════ */
export default function InvestigationTool() {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkEdge> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const globeTimerRef = useRef<d3.Timer | null>(null)

  /* ── View state ── */
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [isZoomedToKZ, setIsZoomedToKZ] = useState(false)
  const pinnedNodesRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('curved')

  /* ── Selection state ── */
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [selectedFlow, setSelectedFlow] = useState<NetworkEdge | GeoFlow | null>(null)
  const [showFlowPanel, setShowFlowPanel] = useState(false)
  const [aiResult, setAiResult] = useState<NetworkAIAnalysis | null>(null)
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number; name: string } | null>(null)
  const [aiHighlightedPaths, setAiHighlightedPaths] = useState<string[][]>([])
  const [canvasSearchQuery, setCanvasSearchQuery] = useState('')
  const [summaryTab, setSummaryTab] = useState<'all' | 'flights' | 'cashout' | 'transfers'>('all')
  const [nodeNotes, setNodeNotes] = useState<Record<string, string>>({})
  const [noteDialog, setNoteDialog] = useState<{ nodeId: string; name: string } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [showLegend, setShowLegend] = useState(false)
  const [removedNodes, setRemovedNodes] = useState<Set<string>>(new Set())
  const [filterToHighlighted, setFilterToHighlighted] = useState(false)


  /* ── Resize listener ── */
  useEffect(() => {
    const handler = () => setDimensions({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* ── URL param: auto-select nodes from dashboard ── */
  useEffect(() => {
    const nodesParam = searchParams.get('nodes')
    if (nodesParam) {
      setSelectedNodeIds(nodesParam.split(','))
      setViewMode('map')
    }
  }, [searchParams])

  /* ── Data queries ── */
  const { data: graphData, isLoading: isGraphLoading } = useQuery({
    queryKey: ['networkGraph'],
    queryFn: () => getNetworkGraph(),
  })

  const { data: mapData, isLoading: isMapLoading } = useQuery({
    queryKey: ['mapFlows'],
    queryFn: getMapFlows,
  })

  const { data: worldData } = useQuery({
    queryKey: ['worldMapData'],
    queryFn: async () => {
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
      return res.json()
    },
    staleTime: Infinity,
  })

  const { data: kzData } = useQuery({
    queryKey: ['kzMapData'],
    queryFn: async () => {
      const sources = [
        'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson',
      ]
      for (const url of sources) {
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const data = await res.json()
          const kzFeatures = data.features?.filter(
            (f: any) => f.properties?.admin === 'Kazakhstan' || f.properties?.iso_a2 === 'KZ' || f.properties?.adm0_a3 === 'KAZ'
          )
          if (kzFeatures && kzFeatures.length > 0) {
            return { type: 'FeatureCollection', features: kzFeatures } as any
          }
        } catch { continue }
      }
      const local = await fetch('/data/kz-regions.json')
      return local.json()
    },
    staleTime: Infinity,
  })

  /* ── Mutations ── */
  const entityDetailQuery = useMutation({
    mutationFn: (entityId: string) => getEntityDetail(entityId),
    onSuccess: (data) => {
      setSelectedEntity(data)
      setShowPanel(true)
      setShowFlowPanel(false)
    },
  })

  const aiMutation = useMutation({
    mutationFn: () => aiAnalyzeNetwork({ entity_ids: selectedNodeIds, language: i18n.language }),
    onSuccess: (data) => {
      setAiResult(data)
      // Extract involved entity IDs — Gemini may return names, so resolve to IDs
      if (data.suspicious_patterns && data.suspicious_patterns.length > 0) {
        const nameToId = new Map<string, string>()
        graphData?.nodes.forEach(n => {
          nameToId.set(n.name, n.id)
          nameToId.set(n.name.toLowerCase(), n.id)
          // Also map partial names for fuzzy matching
          n.name.split(' ').forEach(word => {
            if (word.length > 4 && !nameToId.has(word)) {
              nameToId.set(word, n.id)
              nameToId.set(word.toLowerCase(), n.id)
            }
          })
        })
        const paths = data.suspicious_patterns
          .filter((p: any) => p.involved_entities && p.involved_entities.length > 0)
          .map((p: any) => (p.involved_entities as string[]).map((nameOrId: string) => {
            // Prefer direct ID match, then name match
            if (graphData?.nodes.some(n => n.id === nameOrId)) return nameOrId
            return nameToId.get(nameOrId) ?? nameToId.get(nameOrId.toLowerCase()) ?? nameOrId
          }))
        // If none of the resolved IDs actually match graph nodes, fallback to selectedNodeIds
        const allResolved = new Set(paths.flat())
        const anyMatched = graphData?.nodes.some(n => allResolved.has(n.id))
        if (!anyMatched) {
          setAiHighlightedPaths([selectedNodeIds])
        } else {
          setAiHighlightedPaths(paths)
        }
      } else {
        // No patterns but analysis ran — highlight all selected nodes
        if (selectedNodeIds.length > 0) setAiHighlightedPaths([selectedNodeIds])
        else setAiHighlightedPaths([])
      }
    },
  })

  /* ── Helpers ── */
  const handleNodeClick = useCallback((entityId: string) => {
    entityDetailQuery.mutate(entityId)
  }, [])

  const toggleNodeSelection = (id: string) => {
    setSelectedNodeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  /* ── Filtered graph/map based on selection ── */
  const filteredGraph = useMemo(() => {
    if (!graphData) return null
    if (selectedNodeIds.length === 0) return null

    const connectedNodeIds = new Set<string>(selectedNodeIds)
    graphData.edges.forEach(e => {
      const sourceId = typeof e.source === 'object' ? (e.source as any).id : e.source
      const targetId = typeof e.target === 'object' ? (e.target as any).id : e.target
      if (selectedNodeIds.includes(sourceId) || selectedNodeIds.includes(targetId)) {
        connectedNodeIds.add(sourceId)
        connectedNodeIds.add(targetId)
      }
    })

    const hlIds = (filterToHighlighted && aiHighlightedPaths.length > 0)
      ? new Set(aiHighlightedPaths.flat()) : null

    const finalNodes = graphData.nodes
      .filter(n => connectedNodeIds.has(n.id) && !removedNodes.has(n.id) && (!hlIds || hlIds.has(n.id)))
    const finalEdges = graphData.edges.filter(e => {
      const sourceId = typeof e.source === 'object' ? (e.source as any).id : e.source
      const targetId = typeof e.target === 'object' ? (e.target as any).id : e.target
      return connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId) &&
        !removedNodes.has(sourceId) && !removedNodes.has(targetId) &&
        (!hlIds || (hlIds.has(sourceId) && hlIds.has(targetId)))
    })

    return { nodes: finalNodes, edges: finalEdges }
  }, [graphData, selectedNodeIds, removedNodes, filterToHighlighted, aiHighlightedPaths])

  const filteredMap = useMemo(() => {
    if (!mapData) return null
    if (selectedNodeIds.length === 0) return { locations: [], flows: [] }

    const connectedNodeIds = new Set<string>(selectedNodeIds)
    const relevantFlows = mapData.flows.filter(f => {
      if (selectedNodeIds.includes(f.source.id) || selectedNodeIds.includes(f.target.id)) {
        connectedNodeIds.add(f.source.id)
        connectedNodeIds.add(f.target.id)
        return true
      }
      return false
    })

    const finalLocations = mapData.locations.filter(l => connectedNodeIds.has(l.id))
    return { locations: finalLocations, flows: relevantFlows }
  }, [mapData, selectedNodeIds])

  /* ── Search results ── */
  const searchResults = useMemo(() => {
    if (!graphData || !searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return graphData.nodes
      .filter(n => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
      .slice(0, 10)
  }, [graphData, searchQuery])

  /* ═══════════════════════════════════════════════════════════
     D3 RENDER — Main effect
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    const defs = svg.append('defs')

    /* ── Filters ── */
    const glowFilter = defs.append('filter').attr('id', 'glow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
    const merge = glowFilter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    /* ── Background ── */
    const bgGrad = defs.append('radialGradient').attr('id', 'bg-gradient')
      .attr('cx', '50%').attr('cy', '50%').attr('r', '70%')
    bgGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0F172A')
    bgGrad.append('stop').attr('offset', '100%').attr('stop-color', '#020617')
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'url(#bg-gradient)')

    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => g.attr('transform', event.transform))
    zoomRef.current = zoom

    /* ─────────── GRAPH VIEW ─────────── */
    if (viewMode === 'graph') {
      svg.call(zoom)

      if (selectedNodeIds.length === 0) {
        // Empty state
        g.append('text').attr('x', width / 2).attr('y', height / 2 - 20)
          .attr('text-anchor', 'middle').attr('fill', '#475569')
          .attr('font-size', '18px').attr('font-weight', '600')
          .text('Инструмент расследования')
        g.append('text').attr('x', width / 2).attr('y', height / 2 + 10)
          .attr('text-anchor', 'middle').attr('fill', '#334155').attr('font-size', '14px')
          .text('Найдите и выберите организации для начала анализа')
        return
      }

      if (!filteredGraph) return
      svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8))

      /* ── Arrow markers ── */
      const markers = [
        { id: 'arrow', color: '#475569' },
        { id: 'arrow-suspicious', color: '#EF4444' },
        { id: 'arrow-flight', color: '#A855F7' },
        { id: 'arrow-purchase', color: '#F59E0B' },
        { id: 'arrow-cashout', color: '#F43F5E' },
      ]
      markers.forEach(m => {
        defs.append('marker').attr('id', m.id)
          .attr('viewBox', '0 -5 10 10').attr('refX', 28).attr('refY', 0)
          .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
          .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', m.color)
      })

      /* ── Prepare data ── */
      const nodes: NetworkNode[] = filteredGraph.nodes.map(n => {
        const pinned = pinnedNodesRef.current.get(n.id)
        return { ...n, fx: pinned?.x ?? undefined, fy: pinned?.y ?? undefined } as any
      })
      const allEdges = filteredGraph.edges.map(e => ({ ...e }))

      // ── Separate self-loops (source_id === target_id) and flights from regular edges ──
      // Flights are always rendered as self-loops on the source node in graph view
      const selfLoopEdges = allEdges.filter((e: any) => {
        const sid = typeof e.source === 'object' ? e.source.id : e.source
        const tid = typeof e.target === 'object' ? e.target.id : e.target
        return sid === tid || e.flow_type === 'flight'
      })
      const edges = allEdges.filter((e: any) => {
        const sid = typeof e.source === 'object' ? e.source.id : e.source
        const tid = typeof e.target === 'object' ? e.target.id : e.target
        return sid !== tid && e.flow_type !== 'flight'
      })
      // Resolve self-loop node references for positioning
      // For flights: anchor loop to the SOURCE node (the traveler/entity that flew)
      selfLoopEdges.forEach((e: any) => {
        const nid = typeof e.source === 'object' ? e.source.id : e.source
        e._node = nodes.find((n: any) => n.id === nid)
      })

      /* ── Simulation (tuned to avoid magnet behavior) ── */
      const simulation = d3.forceSimulation<NetworkNode>(nodes)
        .force('link', d3.forceLink<NetworkNode, NetworkEdge>(edges)
          .id(d => d.id).distance(220).strength(0.35))
        .force('charge', d3.forceManyBody().strength(-1400))
        .force('center', d3.forceCenter(0, 0).strength(0.03))
        .force('collision', d3.forceCollide().radius(65).strength(0.9))
        .force('x', d3.forceX(0).strength(0.02))
        .force('y', d3.forceY(0).strength(0.02))
        .alphaDecay(0.12)
        .velocityDecay(0.65)
        .alpha(0.4)
      simulationRef.current = simulation

      /* ── Pre-compute AI-highlighted edge set (source/target resolved after forceLink init) ── */
      const aiHighlightEdgeIds = new Set<string>(aiHighlightedPaths.flat())
      const highlightedEdgeKeys = new Set<string>()
      if (aiHighlightedPaths.length > 0) {
        edges.forEach((e: any) => {
          const sid = typeof e.source === 'object' ? (e.source as any).id : String(e.source)
          const tid = typeof e.target === 'object' ? (e.target as any).id : String(e.target)
          if (aiHighlightEdgeIds.has(sid) && aiHighlightEdgeIds.has(tid)) {
            highlightedEdgeKeys.add(sid + '|' + tid)
            highlightedEdgeKeys.add(tid + '|' + sid)
          }
        })
      }
      const isEdgeHighlighted = (d: any) => {
        const sid = typeof d.source === 'object' ? (d.source as any).id : String(d.source)
        const tid = typeof d.target === 'object' ? (d.target as any).id : String(d.target)
        return highlightedEdgeKeys.has(sid + '|' + tid)
      }

      /* ── Edge rendering helpers ── */
      function edgeColor(d: any) {
        if (d.flow_type === 'cash_out') return '#F43F5E'
        if (d.flow_type === 'flight') return '#A855F7'
        if (d.flow_type === 'purchase') return '#F59E0B'
        if (d.flow_type === 'director') return '#EC4899'
        if (d.flow_type === 'founder') return '#06B6D4'
        if (d.flow_type === 'relative') return '#F97316'
        return d.is_suspicious ? '#EF4444' : '#3B82F6'
      }
      function edgeWidth(d: any) {
        if (['director','founder','relative'].includes(d.flow_type)) return 2
        return Math.max(1.5, Math.min(4, d.amount / 30_000_000))
      }
      function edgeDash(d: any) {
        if (['director','founder','relative'].includes(d.flow_type)) return '5,3'
        if (d.flow_type === 'flight') return '8,3'
        return 'none'
      }
      function edgeMarker(d: any) {
        if (['director','founder','relative'].includes(d.flow_type)) return 'url(#arrow)'
        if (d.flow_type === 'cash_out') return 'url(#arrow-cashout)'
        if (d.flow_type === 'flight') return 'url(#arrow-flight)'
        if (d.flow_type === 'purchase') return 'url(#arrow-purchase)'
        return d.is_suspicious ? 'url(#arrow-suspicious)' : 'url(#arrow)'
      }

      /* ── Edges (regular, non-self-loop) ── */
      // Track parallel edges for offset arcs
      const edgeParallelIdx = new Map<any, number>()
      const pairCount = new Map<string, number>()
      edges.forEach((e: any) => {
        const sid = typeof e.source === 'object' ? e.source.id : e.source
        const tid = typeof e.target === 'object' ? e.target.id : e.target
        const key = [sid, tid].sort().join('|')
        const cnt = pairCount.get(key) ?? 0
        edgeParallelIdx.set(e, cnt)
        pairCount.set(key, cnt + 1)
      })

      const edgeGroup = g.append('g').attr('class', 'edges')
      const link = edgeGroup.selectAll(edgeStyle === 'straight' ? 'line' : 'path')
        .data(edges)
        .join(edgeStyle === 'straight' ? 'line' : 'path')
        .attr('fill', 'none')
        .attr('stroke', (d: any) => {
          if (isEdgeHighlighted(d)) return '#ffffff'
          return edgeColor(d)
        })
        .attr('stroke-dasharray', edgeDash)
        .attr('stroke-width', (d: any) => {
          if (isEdgeHighlighted(d)) return Math.max(3.5, edgeWidth(d) + 2)
          return edgeWidth(d)
        })
        .attr('stroke-opacity', (d: any) => {
          const sid = typeof d.source === 'object' ? (d.source as any).id : String(d.source)
          const tid = typeof d.target === 'object' ? (d.target as any).id : String(d.target)
          if (collapsedNodes.has(sid) || collapsedNodes.has(tid)) return 0
          if (aiHighlightedPaths.length > 0) {
            if (isEdgeHighlighted(d)) return 1.0
            return 0.04
          }
          return d.is_suspicious ? 0.65 : 0.2
        })
        .style('filter', (d: any) => {
          if (isEdgeHighlighted(d)) return 'drop-shadow(0 0 8px rgba(255,255,255,0.95))'
          return 'none'
        })
        .attr('pointer-events', (d: any) => {
          const sid = typeof d.source === 'object' ? d.source.id : d.source
          const tid = typeof d.target === 'object' ? d.target.id : d.target
          return collapsedNodes.has(sid) || collapsedNodes.has(tid) ? 'none' : 'all'
        })
        .attr('marker-end', edgeMarker)
        .style('cursor', 'pointer')

      link.on('mouseover', function (_e: any, d: any) {
          d3.select(this).attr('stroke-opacity', 1)
            .attr('stroke-width', String(Math.max(3, Math.min(6, d.amount / 20_000_000))))
        })
        .on('mouseout', function (_e: any, d: any) {
          d3.select(this).attr('stroke-opacity', d.is_suspicious ? 0.75 : 0.35)
            .attr('stroke-width', String(edgeWidth(d)))
        })
        .on('click', (_event: MouseEvent, d: any) => {
          setSelectedFlow(d)
          setShowFlowPanel(true)
          setShowPanel(false)
        })

      /* ── Edge labels ── */
      const edgeLabelGroup = g.append('g').attr('class', 'edge-labels')
      const edgeLabels = edgeLabelGroup.selectAll('text')
        // Only show labels for significant edges to reduce clutter
        .data(edges.filter((d: any) => d.amount > 30_000_000 || d.is_suspicious))
        .join('text')
        .attr('font-size', '9px')
        .attr('fill', (d: any) => d.is_suspicious ? '#FCA5A5' : '#94A3B8')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .text((d: any) => `₸${formatAmount(d.amount)}`)

      /* ── Self-loop edges (cash_out, flight self-loops) ── */
      // Self-loop arcs (петля — loop above the node) — differentiate multiple loops
      // Count self-loops per node
      const selfLoopsByNode = new Map<string, any[]>()
      selfLoopEdges.forEach((e: any) => {
        const nid = typeof e.source === 'object' ? e.source.id : e.source
        if (!selfLoopsByNode.has(nid)) selfLoopsByNode.set(nid, [])
        selfLoopsByNode.get(nid)!.push(e)
      })
      // Assign index within the node's loops
      selfLoopEdges.forEach((e: any) => {
        const nid = typeof e.source === 'object' ? e.source.id : e.source
        e._loopIdx = selfLoopsByNode.get(nid)!.indexOf(e)
      })

      const selfLoopGroup = g.append('g').attr('class', 'self-loops')
      const selfLoop = selfLoopGroup.selectAll('.self-loop')
        .data(selfLoopEdges)
        .join('path')
        .attr('class', 'self-loop')
        .attr('fill', 'none')
        .attr('stroke', (d: any) => {
          if (aiHighlightedPaths.length > 0) {
            const nid = typeof d.source === 'object' ? (d.source as any).id : String(d.source)
            if (aiHighlightEdgeIds.has(nid)) return '#ffffff'
          }
          return edgeColor(d)
        })
        .attr('stroke-width', (d: any) => {
          if (aiHighlightedPaths.length > 0) {
            const nid = typeof d.source === 'object' ? (d.source as any).id : String(d.source)
            if (aiHighlightEdgeIds.has(nid)) return Math.max(3, edgeWidth(d) + 1.5)
          }
          return Math.max(2, edgeWidth(d))
        })
        .attr('stroke-opacity', (d: any) => {
          if (aiHighlightedPaths.length > 0) {
            const nid = typeof d.source === 'object' ? (d.source as any).id : String(d.source)
            if (aiHighlightEdgeIds.has(nid)) return 0.9
            return 0.04
          }
          return 0.7
        })
        .style('filter', (d: any) => {
          if (aiHighlightedPaths.length > 0) {
            const nid = typeof d.source === 'object' ? (d.source as any).id : String(d.source)
            if (aiHighlightEdgeIds.has(nid)) return 'drop-shadow(0 0 8px rgba(255,255,255,0.9))'
          }
          return 'none'
        })
        .attr('stroke-dasharray', (d: any) =>
          d.flow_type === 'flight' ? '6,3' : d.flow_type === 'cash_out' ? '3,2,8,2' : '5,3')
        .style('cursor', 'pointer')
        .attr('visibility', (d: any) => collapsedNodes.has(d._node?.id || '') ? 'hidden' : 'visible')
        .on('mouseover', function () {
          d3.select(this).attr('stroke-opacity', 1).attr('stroke-width', 4)
        })
        .on('mouseout', function (_e: any, d: any) {
          d3.select(this).attr('stroke-opacity', 0.7).attr('stroke-width', Math.max(2, edgeWidth(d)))
        })
        .on('click', (_event: MouseEvent, d: any) => {
          setSelectedFlow(d)
          setShowFlowPanel(true)
          setShowPanel(false)
        })

      // ✈ icon on flight self-loops
      const flightIcons = selfLoopGroup.selectAll('.flight-icon')
        .data(selfLoopEdges.filter((d: any) => d.flow_type === 'flight'))
        .join('text')
        .attr('class', 'flight-icon')
        .attr('font-size', '16px')
        .attr('text-anchor', 'middle')
        .attr('fill', '#A855F7')
        .attr('pointer-events', 'none')
        .style('filter', 'drop-shadow(0 0 4px rgba(168,85,247,0.6))')
        .text('✈')

      // 💸 icon on cash-out self-loops
      const cashoutIcons = selfLoopGroup.selectAll('.cashout-icon')
        .data(selfLoopEdges.filter((d: any) => d.flow_type === 'cash_out'))
        .join('text')
        .attr('class', 'cashout-icon')
        .attr('font-size', '14px')
        .attr('text-anchor', 'middle')
        .attr('fill', '#F43F5E')
        .attr('pointer-events', 'none')
        .style('filter', 'drop-shadow(0 0 4px rgba(244,63,94,0.6))')
        .text('💸')

      // Self-loop amount labels
      const selfLoopLabels = selfLoopGroup.selectAll('.sl-label')
        .data(selfLoopEdges)
        .join('text')
        .attr('class', 'sl-label')
        .attr('font-size', '8px')
        .attr('fill', (d: any) => d.flow_type === 'cash_out' ? '#FDA4AF' : '#C4B5FD')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .text((d: any) => `₸${formatAmount(d.amount)}`)

      /* ── Nodes ── */
      const nodeGroup = g.append('g').attr('class', 'nodes')
      const node = nodeGroup.selectAll('g')
        .data(nodes)
        .join('g')
        .attr('cursor', 'pointer')
        .call(d3.drag<any, NetworkNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.2).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            if (d.fx !== undefined && d.fy !== undefined) {
              pinnedNodesRef.current.set(d.id, { x: d.fx!, y: d.fy! })
            }
          })
        )

      // Selected ring — golden glow for actively selected nodes
      node.filter((d: any) => selectedNodeIds.includes(d.id))
        .append('circle').attr('r', 27)
        .attr('fill', 'none').attr('stroke', '#F59E0B').attr('stroke-width', 2.5)
        .attr('stroke-opacity', 0.95)
        .style('filter', 'drop-shadow(0 0 7px rgba(245,158,11,0.85))')

      // AI highlight ring (white glow ring for nodes in suspicious patterns)
      const aiHighlightedIds = new Set<string>(aiHighlightedPaths.flat())
      node.filter((d: any) => aiHighlightedIds.has(d.id))
        .append('circle').attr('r', 36)
        .attr('fill', 'none').attr('stroke', '#ffffff').attr('stroke-width', 3.5)
        .attr('stroke-dasharray', '3,2').attr('stroke-opacity', 0.95)
        .style('filter', 'drop-shadow(0 0 14px rgba(255,255,255,0.9))')

      // White brightness overlay — makes highlighted nodes appear lit-up/white
      node.filter((d: any) => aiHighlightedIds.has(d.id))
        .append('circle')
        .attr('r', (d: any) => 16 + Math.min(4, d.transaction_count / 8))
        .attr('fill', '#ffffff')
        .attr('fill-opacity', 0.22)
        .attr('pointer-events', 'none')

      // Second outer pulsing ring for extra visibility
      node.filter((d: any) => aiHighlightedIds.has(d.id))
        .append('circle').attr('r', 29)
        .attr('fill', 'none').attr('stroke', '#ffffff').attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.35).attr('pointer-events', 'none')

      // Dim/brighten nodes based on AI highlight state
      if (aiHighlightedPaths.length > 0) {
        node.attr('opacity', (d: any) => aiHighlightedIds.has(d.id) ? 1 : 0.15)
      } else {
        node.attr('opacity', 1)
      }

      // Canvas in-graph search highlight ring (amber)
      if (canvasSearchQuery.trim()) {
        const q = canvasSearchQuery.toLowerCase()
        node.filter((d: any) =>
          d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
        )
          .append('circle').attr('r', 40)
          .attr('fill', '#F59E0B').attr('fill-opacity', 0.08)
          .attr('stroke', '#F59E0B').attr('stroke-width', 2.5)
          .attr('stroke-dasharray', '6,3').attr('stroke-opacity', 0.95)
          .style('filter', 'drop-shadow(0 0 8px rgba(245,158,11,0.7))')
      }

      // Outer ring
      node.append('circle')
        .attr('r', (d: any) => d.is_suspicious ? 24 : 20)
        .attr('fill', 'none')
        .attr('stroke', (d: any) => d.is_suspicious ? '#EF4444' : TYPE_COLORS[d.type] || '#64748B')
        .attr('stroke-width', 1.5).attr('stroke-opacity', 0.4)

      // Collapsed overlay
      node.filter((d: any) => collapsedNodes.has(d.id))
        .append('circle')
        .attr('r', 22)
        .attr('fill', '#0F1729').attr('fill-opacity', 0.7)
        .attr('stroke', '#475569').attr('stroke-width', 2).attr('stroke-dasharray', '4,2')

      // Main circle
      node.append('circle').attr('class', 'mc')
        .attr('r', (d: any) => 16 + Math.min(4, d.transaction_count / 8))
        .attr('fill', (d: any) => collapsedNodes.has(d.id) ? '#1E293B' : TYPE_COLORS[d.type] || '#64748B')
        .attr('fill-opacity', (d: any) => collapsedNodes.has(d.id) ? 0.5 : 0.9)
        .attr('stroke', (d: any) => d.is_suspicious ? '#FCA5A5' : '#fff')
        .attr('stroke-width', (d: any) => d.is_suspicious ? 2 : 1)

      // ── Semantic icon inside each node (person / building / skyscraper / anchor / arrows) ──
      node.each(function(d: any) {
        drawEntityIcon(d3.select(this) as any, d.type, 1)
      })

      // Name below
      node.append('text')
        .attr('font-size', '10px').attr('fill', '#E2E8F0')
        .attr('text-anchor', 'middle').attr('dy', 34)
        .text((d: any) => d.name.length > 22 ? d.name.substring(0, 20) + '...' : d.name)

      // CEO name below node name
      node.filter((d: any) => !!d.ceo_name)
        .append('text')
        .attr('font-size', '8px').attr('fill', '#94A3B8')
        .attr('text-anchor', 'middle').attr('dy', 45)
        .text((d: any) => {
          const parts = (d.ceo_name as string).split(' ')
          return parts.slice(0, 2).join(' ')
        })

      // Warning icon for suspicious
      node.filter((d: any) => d.suspicion_summary)
        .append('text')
        .attr('font-size', '12px').attr('text-anchor', 'middle')
        .attr('dy', -28).attr('fill', '#FBBF24').text('⚠')

      // Collapsed indicator
      node.filter((d: any) => collapsedNodes.has(d.id))
        .append('text')
        .attr('font-size', '11px').attr('text-anchor', 'middle')
        .attr('dy', -26).attr('fill', '#94A3B8').text('−')

      // Interactions
      node.on('mouseover', function (_e, d: any) {
        d3.select(this).select('.mc').transition().duration(150)
          .attr('r', 20 + Math.min(4, d.transaction_count / 8))
        setHoveredNode(d)
      })
      node.on('mouseout', function (_e, d: any) {
        d3.select(this).select('.mc').transition().duration(150)
          .attr('r', 16 + Math.min(4, d.transaction_count / 8))
        setHoveredNode(null)
      })
      node.on('click', (event: MouseEvent, d: any) => {
        event.stopPropagation()
        const rect = containerRef.current!.getBoundingClientRect()
        setContextMenu({ nodeId: d.id, x: event.clientX - rect.left, y: event.clientY - rect.top, name: d.name })
      })

      /* ── Tick ── */
      simulation.on('tick', () => {
        // Regular edges
        if (edgeStyle === 'straight') {
          link
            .attr('x1', (d: any) => d.source.x)
            .attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => d.target.x)
            .attr('y2', (d: any) => d.target.y)
        } else {
          link.attr('d', (d: any) => {
            const sx = d.source.x, sy = d.source.y
            const tx = d.target.x, ty = d.target.y
            const dx = tx - sx, dy = ty - sy
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const idx = edgeParallelIdx.get(d) ?? 0
            const sid = typeof d.source === 'object' ? d.source.id : d.source
            const tid = typeof d.target === 'object' ? d.target.id : d.target
            const key = [sid, tid].sort().join('|')
            const total = pairCount.get(key) ?? 1
            // Perpendicular offset — single edge gets base curve, multiples fan out
            const baseOffset = total === 1 ? 45 : 0
            const offset = baseOffset + (idx - (total - 1) / 2) * 60
            // Perpendicular unit vector (rotate 90°)
            const nx = -dy / dist, ny = dx / dist
            // Quadratic bezier control point
            const mx = (sx + tx) / 2 + nx * offset
            const my = (sy + ty) / 2 + ny * offset
            return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`
          })
        }

        // Self-loop arcs (петля — loop above the node)
        selfLoop.attr('d', (d: any) => {
          const n = d._node
          if (!n || n.x == null) return ''
          const x = n.x, y = n.y
          const nr = 20 // node radius
          const loopIdx = d._loopIdx ?? 0
          // Stagger loops: different sizes and angles
          const lr = 22 + loopIdx * 14
          const angles = [0, 45, -45, 90, -90]
          const angleRad = (angles[loopIdx % angles.length] || 0) * Math.PI / 180
          const offX = Math.sin(angleRad) * nr
          const offY = -Math.cos(angleRad) * nr
          const fx = x + offX, fy = y + offY
          return `M ${fx - (nr * 0.5)},${fy}
                  C ${fx - lr * 1.7},${fy - lr * 2.2},
                    ${fx + lr * 1.7},${fy - lr * 2.2},
                    ${fx + (nr * 0.5)},${fy}`
        })

        // Position self-loop icons at the top of the loop
        flightIcons
          .attr('x', (d: any) => {
            const n = d._node; const loopIdx = d._loopIdx ?? 0
            const angles = [0,45,-45,90,-90]; const a = (angles[loopIdx % 5] || 0)*Math.PI/180
            return (n?.x ?? 0) + Math.sin(a) * 20
          })
          .attr('y', (d: any) => {
            const n = d._node; const loopIdx = d._loopIdx ?? 0
            const lr = 22 + loopIdx * 14; const angles = [0,45,-45,90,-90]
            const a = (angles[loopIdx % 5] || 0)*Math.PI/180
            return (n?.y ?? 0) - Math.cos(a) * 20 - lr * 2.5
          })
        cashoutIcons
          .attr('x', (d: any) => {
            const n = d._node; const loopIdx = d._loopIdx ?? 0
            const angles = [0,45,-45,90,-90]; const a = (angles[loopIdx % 5] || 0)*Math.PI/180
            return (n?.x ?? 0) + Math.sin(a) * 20
          })
          .attr('y', (d: any) => {
            const n = d._node; const loopIdx = d._loopIdx ?? 0
            const lr = 22 + loopIdx * 14; const angles = [0,45,-45,90,-90]
            const a = (angles[loopIdx % 5] || 0)*Math.PI/180
            return (n?.y ?? 0) - Math.cos(a) * 20 - lr * 2.5
          })
        selfLoopLabels
          .attr('x', (d: any) => {
            const n = d._node; const loopIdx = d._loopIdx ?? 0
            const angles = [0,45,-45,90,-90]; const a = (angles[loopIdx % 5] || 0)*Math.PI/180
            return (n?.x ?? 0) + Math.sin(a) * 20
          })
          .attr('y', (d: any) => {
            const n = d._node; const loopIdx = d._loopIdx ?? 0
            const lr = 22 + loopIdx * 14; const angles = [0,45,-45,90,-90]
            const a = (angles[loopIdx % 5] || 0)*Math.PI/180
            return (n?.y ?? 0) - Math.cos(a) * 20 - lr * 2.5 - 14
          })

        node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
        edgeLabels
          .attr('x', (d: any) => {
            const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y
            const dx = tx - sx, dy = ty - sy, dist = Math.sqrt(dx*dx+dy*dy) || 1
            const idx = edgeParallelIdx.get(d) ?? 0
            const sid = typeof d.source === 'object' ? d.source.id : d.source
            const tid = typeof d.target === 'object' ? d.target.id : d.target
            const total = pairCount.get([sid,tid].sort().join('|')) ?? 1
            const offset = (total === 1 ? 45 : 0) + (idx - (total-1)/2) * 60
            return (sx+tx)/2 + (-dy/dist) * offset * 0.5
          })
          .attr('y', (d: any) => {
            const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y
            const dx = tx - sx, dy = ty - sy, dist = Math.sqrt(dx*dx+dy*dy) || 1
            const idx = edgeParallelIdx.get(d) ?? 0
            const sid = typeof d.source === 'object' ? d.source.id : d.source
            const tid = typeof d.target === 'object' ? d.target.id : d.target
            const total = pairCount.get([sid,tid].sort().join('|')) ?? 1
            const offset = (total === 1 ? 45 : 0) + (idx - (total-1)/2) * 60
            return (sy+ty)/2 + (dx/dist) * offset * 0.5 - 4
          })
      })

      return () => { simulation.stop() }
    }

    /* ─────────── MAP VIEW (flat world + KZ zoom) ─────────── */
    if (viewMode === 'map' && filteredMap) {
      let projection: d3.GeoProjection

      if (isZoomedToKZ) {
        // Zoomed into Kazakhstan
        svg.call(zoom)
        const kzScale = Math.min((width - 60) * 1.4, (height - 60) * 2.3)
        projection = d3.geoMercator()
          .center([66.9, 48.0])
          .scale(kzScale)
          .translate([width / 2, height / 2])
      } else {
        // World flat — centered on Central Asia (Kazakhstan region), allow zoom & pan
        projection = d3.geoNaturalEarth1()
          .scale(width / 5.2)
          .rotate([-62, 0])
          .translate([width / 2, height / 2])
        svg.call(zoom)
      }

      const path = d3.geoPath(projection)

      // Ocean / background
      g.append('rect').attr('width', width).attr('height', height).attr('fill', '#020c18')

      // Countries
      if (worldData) {
        const countries = topojson.feature(worldData, worldData.objects.countries)
        g.selectAll('.country')
          .data((countries as any).features)
          .enter().append('path')
          .attr('class', 'country')
          .attr('d', path as any)
          .attr('fill', '#0d1f33')
          .attr('stroke', '#1E3A5F').attr('stroke-width', 0.5)
          .attr('opacity', 0.9)
          .style('cursor', !isZoomedToKZ ? 'pointer' : 'default')
          .on('mouseover', function () { d3.select(this).attr('fill', '#1C314C') })
          .on('mouseout', function () { d3.select(this).attr('fill', '#0d1f33') })
          .on('click', function (_e: any, d: any) {
            // Click on Kazakhstan (ISO numeric 398) → animated zoom
            const id = d.id || d.properties?.iso_n3 || ''
            if (id === '398' || d.properties?.name === 'Kazakhstan') {
              setIsZoomedToKZ(true)
            }
          })
      }

      // Kazakhstan regions overlay (always render)
      if (kzData) {
        let kzFeatures: any[] = []
        if (kzData.type === 'FeatureCollection' && kzData.features) {
          kzFeatures = kzData.features
        } else if (kzData.objects?.default) {
          const d = topojson.feature(kzData, kzData.objects.default) as any
          kzFeatures = d.features || []
        }
        if (kzFeatures.length > 0) {
          g.selectAll('.kz-region')
            .data(kzFeatures)
            .enter().append('path')
            .attr('class', 'kz-region')
            .attr('d', path as any)
            .attr('fill', isZoomedToKZ ? '#0d2136' : '#0d2a40')
            .attr('stroke', '#00AFCA')
            .attr('stroke-width', isZoomedToKZ ? 1.5 : 0.6)
            .attr('opacity', 0.9)
            .style('cursor', isZoomedToKZ ? 'default' : 'pointer')
            .on('mouseover', function (_e: any, d: any) {
              d3.select(this).attr('fill', 'rgba(0,175,202,0.25)')
              if (isZoomedToKZ) {
                const c = path.centroid(d)
                if (c && !isNaN(c[0])) {
                  g.append('text').attr('class', 'kz-tip')
                    .attr('x', c[0]).attr('y', c[1])
                    .attr('text-anchor', 'middle').attr('fill', '#fff')
                    .attr('font-size', '11px').attr('font-weight', '600')
                    .attr('pointer-events', 'none')
                    .text(d.properties?.name || d.properties?.NAME_1 || '')
                }
              }
            })
            .on('mouseout', function () {
              d3.select(this).attr('fill', isZoomedToKZ ? '#0d2136' : '#0d2a40')
              g.selectAll('.kz-tip').remove()
            })
            .on('click', function () {
              if (!isZoomedToKZ) setIsZoomedToKZ(true)
            })
        }
      }

      /* ── Draw flows ── */
      const RELATION_TYPES = ['director', 'founder', 'relative']
      const mapFlows = filteredMap.flows.filter(f => !RELATION_TYPES.includes(f.flow_type || ''))
      const flowGroup = g.append('g').attr('class', 'flows')
      mapFlows.forEach((flow, i) => {
        const src = projection([flow.source.lng, flow.source.lat])
        const tgt = projection([flow.target.lng, flow.target.lat])
        if (!src || !tgt) return

        let flowColor = flow.is_suspicious ? '#EF4444' : '#3B82F6'
        if (flow.flow_type === 'flight') flowColor = '#A855F7'
        if (flow.flow_type === 'purchase') flowColor = '#F59E0B'
        if (flow.flow_type === 'cash_out') flowColor = '#F43F5E'

        const strokeW = Math.max(1.2, Math.min(3.5, flow.amount / 5e7))

        // Always draw arcs on the map for clarity
        const midX = (src[0] + tgt[0]) / 2
        const dist = Math.sqrt((tgt[0] - src[0]) ** 2 + (tgt[1] - src[1]) ** 2)
        const midY = Math.min(src[1], tgt[1]) - dist * 0.2 - 20
        const arcPath = `M ${src[0]},${src[1]} Q ${midX},${midY} ${tgt[0]},${tgt[1]}`
        const arcId = `arc-${i}`

        flowGroup.append('path')
          .attr('id', arcId).attr('d', arcPath)
          .attr('fill', 'none').attr('stroke', flowColor)
          .attr('stroke-width', strokeW).attr('opacity', 0.55)
          .style('cursor', 'pointer')
          .on('mouseover', function (event: MouseEvent) {
            d3.select(this).attr('opacity', 1).attr('stroke-width', String(strokeW + 1.5))
            // Get cursor pos relative to SVG container using current transform
            const svgNode = svgRef.current!
            const svgRect = svgNode.getBoundingClientRect()
            // Get current zoom transform
            const transform = d3.zoomTransform(svgNode)
            // Convert screen coords to SVG coords
            const mx = (event.clientX - svgRect.left - transform.x) / transform.k
            const my = (event.clientY - svgRect.top - transform.y) / transform.k
            // Show rich tooltip near cursor in SVG space
            const tipId = `tip-${i}`
            const tip = flowGroup.append('g').attr('id', tipId).attr('class', 'flow-tip')
            const tx = mx + 12
            const ty = my - 60
            const bg = tip.append('rect').attr('rx', 8).attr('ry', 8)
              .attr('fill', '#111827').attr('stroke', flowColor).attr('stroke-width', 1.5)
              .attr('opacity', 0.97)
            const lines: string[] = []
            if (flow.flow_type === 'flight') {
              lines.push(`✈️  Перелёт`)
              lines.push(`От: ${flow.source.name}`)
              lines.push(`До: ${flow.target.name}`)
              if (flow.source.country !== flow.target.country) lines.push(`${flow.source.country} → ${flow.target.country}`)
            } else if (flow.flow_type === 'purchase') {
              lines.push(`🛒  Покупка`)
              lines.push(`Кем: ${flow.source.name}`)
              lines.push(`Где: ${flow.target.name} (${flow.target.country || '?'})`)
            } else if (flow.flow_type === 'cash_out') {
              lines.push(`💸  Обналичивание`)
              lines.push(`Источник: ${flow.source.name}`)
            } else {
              lines.push(`💰  Перевод`)
              lines.push(`${flow.source.name} → ${flow.target.name}`)
            }
            lines.push(`Сумма: ₸${formatAmount(flow.amount)}`)
            if (flow.flow_date) lines.push(`Дата: ${formatDate(flow.flow_date)}`)
            if (flow.description) lines.push(flow.description.substring(0, 55))
            let maxLen = 0
            lines.forEach((line, li) => {
              tip.append('text').attr('x', tx + 10).attr('y', ty + 18 + li * 16)
                .attr('fill', li === 0 ? flowColor : '#E2E8F0')
                .attr('font-size', li === 0 ? '12px' : '10.5px')
                .attr('font-weight', li === 0 ? '700' : '400')
                .text(line)
              maxLen = Math.max(maxLen, line.length)
            })
            bg.attr('x', tx).attr('y', ty + 4)
              .attr('width', maxLen * 6.2 + 18).attr('height', lines.length * 16 + 14)
          })
          .on('mouseout', function () {
            d3.select(this).attr('opacity', 0.55).attr('stroke-width', String(strokeW))
            flowGroup.selectAll('.flow-tip').remove()
          })
          .on('click', () => {
            setSelectedFlow(flow); setShowFlowPanel(true); setShowPanel(false)
          })

        // For flights: animated airplane icon along the arc
        if (flow.flow_type === 'flight') {
          const airplane = flowGroup.append('text')
            .attr('font-size', '13px')
            .attr('fill', '#C4B5FD')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .style('filter', 'drop-shadow(0 0 4px rgba(168,85,247,0.7))')
            .text('✈')
          const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion')
          // Slow — one pass every 10-16 seconds
          anim.setAttribute('dur', `${10 + (i % 4) * 1.5}s`)
          anim.setAttribute('repeatCount', 'indefinite')
          anim.setAttribute('rotate', 'auto')
          anim.setAttribute('begin', `${(i * 1.2) % 8}s`)
          const mp = document.createElementNS('http://www.w3.org/2000/svg', 'mpath')
          mp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${arcId}`)
          anim.appendChild(mp)
          airplane.node()?.appendChild(anim)
        } else {
          // For transfers: animated dot along the arc — slow glide
          const particle = flowGroup.append('circle')
            .attr('r', 2).attr('fill', flowColor).attr('opacity', 0.75)
            .style('filter', `drop-shadow(0 0 2px ${flowColor})`)
          const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion')
          // Slow — one pass every 8-14 seconds, staggered
          anim.setAttribute('dur', `${8 + (i % 6) * 1.0}s`)
          anim.setAttribute('repeatCount', 'indefinite')
          anim.setAttribute('begin', `${(i * 0.8) % 6}s`)
          const mp = document.createElementNS('http://www.w3.org/2000/svg', 'mpath')
          mp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${arcId}`)
          anim.appendChild(mp)
          particle.node()?.appendChild(anim)
        }
      })

      /* ── Draw locations with d3.symbol shapes (same as graph) ── */
      const MAP_SYMBOL_TYPES: Record<string, d3.SymbolType> = {
        government: d3.symbolSquare,
        company:    d3.symbolDiamond,
        intermediary: d3.symbolTriangle,
        offshore:   d3.symbolStar,
        individual: d3.symbolWye,
      }
      const locGroup = g.append('g').attr('class', 'locs')
      filteredMap.locations.forEach(loc => {
        const pos = projection([loc.lng, loc.lat])
        if (!pos) return
        const color = TYPE_COLORS[loc.type] || '#6B7280'
        const r = loc.is_suspicious ? 8 : 6
        const isSelected = selectedNodeIds.includes(loc.id)

        if (isSelected) {
          locGroup.append('circle')
            .attr('cx', pos[0]).attr('cy', pos[1]).attr('r', r + 8)
            .attr('fill', 'none').attr('stroke', '#F59E0B')
            .attr('stroke-width', 2).attr('stroke-dasharray', '4,2')
            .style('filter', 'drop-shadow(0 0 6px rgba(245,158,11,0.7))')
        }
        const locG = locGroup.append('g')
          .attr('transform', `translate(${pos[0]},${pos[1]})`)
          .style('cursor', 'pointer')
          .on('click', () => handleNodeClick(loc.id))

        // Outer glow for suspicious
        if (loc.is_suspicious) {
          locG.append('circle').attr('r', r + 3)
            .attr('fill', 'none').attr('stroke', '#EF4444').attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.5).style('filter', 'drop-shadow(0 0 4px rgba(239,68,68,0.5))')
        }

        // Background circle
        locG.append('circle').attr('r', r)
          .attr('fill', color).attr('fill-opacity', loc.is_suspicious ? 0.95 : 0.85)
          .attr('stroke', '#0F172A').attr('stroke-width', 1)

        // Semantic icon (same set as graph view but smaller scale)
        drawEntityIcon(locG as any, loc.type, 0.52)

        if (isSelected || isZoomedToKZ) {
          locGroup.append('text')
            .attr('x', pos[0] + r + 5).attr('y', pos[1] + 3.5)
            .attr('fill', '#CBD5E1').attr('font-size', '9px').attr('pointer-events', 'none')
            .text(loc.name.length > 18 ? loc.name.slice(0, 16) + '..' : loc.name)
        }
      })
    }

    /* ─────────── GLOBE VIEW (rotatable 3D orthographic) ─────────── */
    if (viewMode === 'globe') {
      if (globeTimerRef.current) { globeTimerRef.current.stop(); globeTimerRef.current = null }

      const rotation: [number, number] = [-62, -20] // [λ, φ]
      const projection = d3.geoOrthographic()
        .scale(Math.min(width, height) / 2.2)
        .translate([width / 2, height / 2])
        .clipAngle(90)
        .rotate(rotation)
      const path = d3.geoPath(projection)

      // Ocean sphere
      g.append('circle').attr('class', 'ocean')
        .attr('cx', width / 2).attr('cy', height / 2)
        .attr('r', Math.min(width, height) / 2.2)
        .attr('fill', '#020c18')
        .style('filter', 'drop-shadow(0 0 30px rgba(0,100,200,0.3))')

      const countriesGroup = g.append('g').attr('class', 'globe-countries')
      const flowsGroup = g.append('g').attr('class', 'globe-flows')
      const locsGroup = g.append('g').attr('class', 'globe-locs')
      const graticule = d3.geoGraticule()()

      // Graticule (grid lines)
      g.insert('path', '.globe-countries')
        .datum(graticule)
        .attr('class', 'grat')
        .attr('fill', 'none')
        .attr('stroke', '#0d2040')
        .attr('stroke-width', 0.4)
        .attr('d', path as any)

      if (worldData) {
        const countries = topojson.feature(worldData, worldData.objects.countries)
        countriesGroup.selectAll('.gc')
          .data((countries as any).features)
          .enter().append('path')
          .attr('class', 'gc')
          .attr('d', path as any)
          .attr('fill', (d: any) => {
            const id = d.id || d.properties?.iso_n3 || ''
            return id === '398' ? '#0d2a40' : '#0d1f33'
          })
          .attr('stroke', '#1E3A5F').attr('stroke-width', 0.4)
      }

      // Draw flows if entities are selected
      if (filteredMap) {
        filteredMap.flows.filter(f => !['director','founder','relative'].includes(f.flow_type || '')).forEach((flow, i) => {
          const srcCoords: [number, number] = [flow.source.lng, flow.source.lat]
          const tgtCoords: [number, number] = [flow.target.lng, flow.target.lat]
          const arcFeat: any = {
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: [srcCoords, tgtCoords] }
          }
          let flowColor = flow.is_suspicious ? '#EF4444' : '#3B82F6'
          if (flow.flow_type === 'flight') flowColor = '#A855F7'
          if (flow.flow_type === 'cash_out') flowColor = '#F43F5E'
          if (flow.flow_type === 'purchase') flowColor = '#F59E0B'
          flowsGroup.append('path')
            .datum(arcFeat)
            .attr('d', path as any)
            .attr('fill', 'none')
            .attr('stroke', flowColor)
            .attr('stroke-width', Math.max(1.2, Math.min(3.5, flow.amount / 5e7)))
            .attr('opacity', 0.6)
            .style('cursor', 'pointer')
            .on('click', () => { setSelectedFlow(flow); setShowFlowPanel(true); setShowPanel(false) })
            void i
        })
        filteredMap.locations.forEach(loc => {
          const proj = projection([loc.lng, loc.lat])
          if (!proj) return
          const color = TYPE_COLORS[loc.type] || '#6B7280'
          const r = loc.is_suspicious ? 7 : 5
          const locG = locsGroup.append('g').datum(loc)
            .attr('transform', `translate(${proj[0]},${proj[1]})`)
            .style('cursor', 'pointer')
            .on('click', () => handleNodeClick(loc.id))
          // Background circle
          locG.append('circle').attr('r', r)
            .attr('fill', color).attr('fill-opacity', loc.is_suspicious ? 0.95 : 0.8)
            .attr('stroke', '#fff').attr('stroke-width', 0.7)
          // Semantic icon inside the circle — same icon set as graph
          drawEntityIcon(locG as any, loc.type, 0.43)
          locG.append('text').attr('x', r + 4).attr('y', 3)
            .attr('fill', '#CBD5E1').attr('font-size', '9px').attr('pointer-events', 'none')
            .text(loc.name.length > 16 ? loc.name.slice(0, 14) + '..' : loc.name)
        })
      }

      // Drag to rotate — filtered so clicks on flows/locations still fire
      let startRotate: [number, number] = [-62, -20]
      let startMouse: [number, number] = [0, 0]
      let isDragging = false
      const dragBehavior = d3.drag<SVGSVGElement, unknown>()
        .filter((event: any) => {
          // Only start drag on ocean/background — not on actual elements
          const tag = event.target?.tagName?.toLowerCase()
          return tag === 'svg' || tag === 'circle' && event.target?.classList?.contains('ocean') || tag !== 'path' && tag !== 'text'
        })
        .on('start', (event) => {
          if (globeTimerRef.current) { globeTimerRef.current.stop(); globeTimerRef.current = null }
          startRotate = [...(projection.rotate() as unknown as [number, number])]
          startMouse = [event.x, event.y]
          isDragging = false
          svg.style('cursor', 'grabbing')
        })
        .on('drag', (event) => {
          isDragging = true
          const scale = 0.3
          const newRot: [number, number] = [
            startRotate[0] + (event.x - startMouse[0]) * scale,
            startRotate[1] - (event.y - startMouse[1]) * scale,
          ]
          projection.rotate(newRot)
          g.selectAll('.globe-countries path').attr('d', path as any)
          g.selectAll('.globe-flows path').attr('d', path as any)
          g.selectAll('path.grat').attr('d', path as any)
          // Reposition location markers using bound datum
          locsGroup.selectAll<SVGGElement, { lng: number; lat: number; name: string }>('g').each(function(d) {
            if (!d || d.lng === undefined) return
            const p2 = projection([d.lng, d.lat])
            if (!p2) return
            d3.select(this).attr('transform', `translate(${p2[0]},${p2[1]})`)
          })
        })
        .on('end', () => {
          svg.style('cursor', (isDragging ? 'grab' : null) as any)
          isDragging = false
        })

      // Remove any graph-mode zoom so drag works correctly
      svg.on('.zoom', null)
      svg.call(dragBehavior as any)
      svg.style('cursor', 'grab')

      // Scroll wheel to zoom projection scale
      const currentGlobeScale = { val: Math.min(width, height) / 2.2 }
      const wheelHandler = (event: WheelEvent) => {
        event.preventDefault()
        const factor = event.deltaY < 0 ? 1.12 : 0.88
        currentGlobeScale.val = Math.max(80, Math.min(1200, currentGlobeScale.val * factor))
        projection.scale(currentGlobeScale.val).translate([width / 2, height / 2])
        // Resize ocean circle
        g.select('circle.ocean').attr('r', currentGlobeScale.val)
        g.selectAll('.globe-countries path').attr('d', path as any)
        g.selectAll('.globe-flows path').attr('d', path as any)
        g.selectAll('path.grat').attr('d', path as any)
        // Reposition location markers
        locsGroup.selectAll<SVGGElement, { lng: number; lat: number; name: string }>('g').each(function(d) {
          if (!d || d.lng === undefined) return
          const p2 = projection([d.lng, d.lat])
          if (!p2) return
          d3.select(this).attr('transform', `translate(${p2[0]},${p2[1]})`)
        })
      }
      svgRef.current?.addEventListener('wheel', wheelHandler, { passive: false })

      // No auto-rotation — globe is static until dragged
      return () => {
        if (globeTimerRef.current) { globeTimerRef.current.stop(); globeTimerRef.current = null }
        svgRef.current?.removeEventListener('wheel', wheelHandler)
      }
    }
  }, [
    filteredGraph, filteredMap, viewMode, isZoomedToKZ,
    dimensions, selectedNodeIds, handleNodeClick,
    worldData, kzData, edgeStyle, collapsedNodes, aiHighlightedPaths, canvasSearchQuery, removedNodes,
  ])

  /* ═══════════════════════════════════════════════════════════
     R E N D E R
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="h-[calc(100vh-48px)] flex flex-col bg-kz-surface rounded-2xl border border-kz-border overflow-hidden shadow-2xl">
      {/* ═══ Toolbar ═══ */}
      <div className="flex-none flex flex-col gap-3 p-4 bg-kz-panel/80 backdrop-blur border-b border-white/5 z-20">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Eye className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Инструмент расследования</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle: graph / map / globe / summary */}
            <div className="flex bg-kz-surface rounded-lg p-0.5 border border-white/5">
              <button onClick={() => setViewMode('graph')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5
                  ${viewMode === 'graph' ? 'bg-kz-blue text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                <Network className="w-3.5 h-3.5" /> Граф
              </button>
              <button onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5
                  ${viewMode === 'map' ? 'bg-kz-blue text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                <MapIcon className="w-3.5 h-3.5" /> Карта
              </button>
              <button onClick={() => setViewMode('globe')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5
                  ${viewMode === 'globe' ? 'bg-kz-blue text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                🌐 Глобус
              </button>
              <button onClick={() => setViewMode('summary')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5
                  ${viewMode === 'summary' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                <BarChart3 className="w-3.5 h-3.5" /> Сводка
              </button>
            </div>

            {/* Edge style: straight / curved */}
            <div className="flex bg-kz-surface rounded-lg p-0.5 border border-white/5">
              <button onClick={() => setEdgeStyle('straight')}
                className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all
                  ${edgeStyle === 'straight' ? 'bg-kz-border text-white' : 'text-gray-500 hover:text-white'}`}
                title="Прямые линии">
                <Waypoints className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEdgeStyle('curved')}
                className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all
                  ${edgeStyle === 'curved' ? 'bg-kz-border text-white' : 'text-gray-500 hover:text-white'}`}
                title="Кривые линии">
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Map-specific controls */}
            {viewMode === 'map' && (
              <>
                {isZoomedToKZ && (
                  <button onClick={() => setIsZoomedToKZ(false)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                    <ArrowLeft className="w-3 h-3" /> Мир
                  </button>
                )}
              </>
            )}

            {/* AI Analysis (requires 2+ selected) */}
            <button onClick={() => aiMutation.mutate()}
              disabled={aiMutation.isPending || selectedNodeIds.length < 2}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20">
              {aiMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Brain className="w-3.5 h-3.5" />}
              ИИ Анализ
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="flex items-start gap-4">
          <div className="relative w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по организации, ФИО, БИН..."
              className="w-full pl-9 pr-4 py-2.5 bg-kz-surface border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-kz-blue/50 focus:ring-1 focus:ring-kz-blue/50 transition-all" />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-2 bg-kz-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                {searchResults.map(node => (
                  <button key={node.id}
                    onClick={() => { toggleNodeSelection(node.id); setSearchQuery('') }}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between group transition-colors border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[node.type] }} />
                      <div>
                        <div className="text-sm text-white font-medium">{node.name}</div>
                        <div className="text-[10px] text-gray-500">{TYPE_NAMES[node.type]} • {node.region}</div>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-gray-500 group-hover:text-kz-blue transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected entity chips */}
          <div className="flex-1 flex flex-wrap gap-2">
            {selectedNodeIds.map(id => {
              const node = graphData?.nodes.find(n => n.id === id)
              if (!node) return null
              return (
                <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-kz-blue/10 border border-kz-blue/20 rounded-lg">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[node.type] }} />
                  <span className="text-xs text-white font-medium">{node.name}</span>
                  <button onClick={() => toggleNodeSelection(id)} className="text-gray-400 hover:text-white ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
            {selectedNodeIds.length > 0 && (
              <button onClick={() => setSelectedNodeIds([])}
                className="text-[10px] text-gray-500 hover:text-white px-2 py-1.5">
                Очистить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Main Canvas OR Summary View ═══ */}
      {viewMode === 'summary' ? (
        /* ─────────── SUMMARY VIEW — simplified investigation ─────────── */
        <div className="flex-1 overflow-y-auto p-4 bg-kz-surface">
          {/* Tabs */}
          <div className="flex items-center gap-2 mb-4">
            {([['all','Все операции','⚡'],['flights','Полёты ✈','✈'],['cashout','Обналичка 💸','💸'],['transfers','Переводы 💰','💰']] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setSummaryTab(tab as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  summaryTab === tab
                    ? 'bg-kz-blue text-white shadow'
                    : 'bg-kz-panel border border-white/10 text-gray-400 hover:text-white'
                }`}>{label}</button>
            ))}
            <span className="ml-auto text-[10px] text-gray-500">
              {graphData ? `${graphData.edges.length} операций · ${graphData.nodes.length} субъектов` : 'Загрузка...'}
            </span>
          </div>
          {/* Flow cards */}
          {graphData && (() => {
            const allEdges = graphData.edges
            const filtered = allEdges.filter(e => {
              if (summaryTab === 'flights') return e.flow_type === 'flight'
              if (summaryTab === 'cashout') return e.flow_type === 'cash_out'
              if (summaryTab === 'transfers') return !['flight','cash_out','director','founder','relative'].includes(e.flow_type)
              return !['director','founder','relative'].includes(e.flow_type)
            }).sort((a, b) => (b.is_suspicious ? 1 : 0) - (a.is_suspicious ? 1 : 0))
            const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]))
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.slice(0, 120).map(edge => {
                  const srcId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source
                  const tgtId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target
                  const srcNode = nodeMap.get(srcId)
                  const tgtNode = nodeMap.get(tgtId)
                  const isSelf = srcId === tgtId
                  const typeColors: Record<string, string> = {
                    flight: 'border-purple-500/30 bg-purple-500/5',
                    cash_out: 'border-rose-500/30 bg-rose-500/5',
                    purchase: 'border-amber-500/30 bg-amber-500/5',
                    contract_payment: 'border-blue-500/20 bg-blue-500/5',
                    subcontract: 'border-orange-500/20 bg-orange-500/5',
                  }
                  const typeIcons: Record<string, string> = {
                    flight: '✈', cash_out: '💸', purchase: '🛒',
                    contract_payment: '📄', subcontract: '🔗',
                    consulting_fee: '💼', investment: '📈', loan: '🏦',
                    commission: '💱', unknown: '❓',
                  }
                  const colorCls = typeColors[edge.flow_type] || 'border-white/10 bg-white/[0.02]'
                  const icon = typeIcons[edge.flow_type] || '💰'
                  return (
                    <div key={edge.id}
                      onClick={() => { setSelectedFlow(edge); setShowFlowPanel(true) }}
                      className={`relative p-4 rounded-2xl border cursor-pointer hover:bg-white/5 transition-all ${colorCls}
                        ${edge.is_suspicious ? 'ring-1 ring-red-500/30' : ''}`}>
                      {edge.is_suspicious && (
                        <div className="absolute top-2 right-2 text-red-400 text-[10px] font-bold">⚠</div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{icon}</span>
                        <div className="text-sm font-bold text-white">₸{formatAmount(edge.amount)}</div>
                        {edge.flow_date && (
                          <div className="ml-auto text-[9px] text-gray-500">{formatDate(edge.flow_date)}</div>
                        )}
                      </div>
                      {isSelf ? (
                        <div className="text-xs text-gray-400 truncate">
                          <span style={{ color: TYPE_COLORS[srcNode?.type || ''] || '#94A3B8' }}>
                            {srcNode?.name || srcId}
                          </span>
                          {edge.flow_type === 'flight' && <span className="ml-1 text-purple-400">(перелёт)</span>}
                          {edge.flow_type === 'cash_out' && <span className="ml-1 text-rose-400">(обнал)</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="truncate max-w-[110px]" style={{ color: TYPE_COLORS[srcNode?.type || ''] || '#94A3B8' }}>
                            {srcNode?.name || srcId}
                          </span>
                          <span className="text-gray-600 flex-shrink-0">→</span>
                          <span className="truncate max-w-[110px]" style={{ color: TYPE_COLORS[tgtNode?.type || ''] || '#94A3B8' }}>
                            {tgtNode?.name || tgtId}
                          </span>
                        </div>
                      )}
                      {edge.description && (
                        <div className="text-[9px] text-gray-500 mt-1.5 truncate">{edge.description}</div>
                      )}
                      {/* Quick-add both nodes to selection */}
                      <div className="flex gap-1 mt-2">
                        {[srcId, ...(!isSelf ? [tgtId] : [])].filter(Boolean).map(nid => (
                          <button key={nid}
                            onClick={e => { e.stopPropagation(); toggleNodeSelection(nid); setViewMode('graph') }}
                            className="text-[9px] px-2 py-0.5 rounded-md bg-kz-blue/10 border border-kz-blue/20 text-kz-blue hover:bg-kz-blue/20 transition-colors">
                            + Граф
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="col-span-3 text-center py-12 text-gray-500">
                    Нет операций данного типа
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      ) : (
      /* ─────────── GRAPH / MAP / GLOBE Canvas ─────────── */
      <div className="flex-1 relative overflow-hidden" ref={containerRef}
        onClick={() => setContextMenu(null)}>
        <svg ref={svgRef} className="w-full h-full" />

        {/* Hover tooltip (graph mode) */}
        {hoveredNode && viewMode === 'graph' && (
          <div className="absolute top-4 left-4 bg-kz-panel/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 z-30 w-72 shadow-2xl pointer-events-none">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS[hoveredNode.type] }} />
              <span className="text-sm font-bold text-white">{hoveredNode.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div><span className="text-gray-500">Тип:</span> <span className="text-gray-300">{TYPE_NAMES[hoveredNode.type]}</span></div>
              <div><span className="text-gray-500">Риск:</span>
                <span className={hoveredNode.risk_score > 60 ? 'text-red-400' : 'text-green-400'}>
                  {' '}{hoveredNode.risk_score.toFixed(0)}%
                </span>
              </div>
              {hoveredNode.ceo_name && (
                <div className="col-span-2">
                  <span className="text-gray-500">CEO:</span> <span className="text-gray-300">{hoveredNode.ceo_name}</span>
                </div>
              )}
              {hoveredNode.suspicion_summary && (
                <div className="col-span-2"><span className="text-yellow-400">⚠ {hoveredNode.suspicion_summary}</span></div>
              )}
              {nodeNotes[hoveredNode.id] && (
                <div className="col-span-2 mt-1 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <span className="text-purple-300 text-[9px] leading-relaxed">📝 {nodeNotes[hoveredNode.id]}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend — collapsible */}
        <div className="absolute bottom-6 left-6 bg-kz-panel/80 backdrop-blur border border-white/5 rounded-xl z-10 overflow-hidden">
          <button
            onClick={() => setShowLegend(p => !p)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
          >
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold flex-1">Легенда</div>
            <span className="text-gray-500 text-[10px]">{showLegend ? '▲' : '▼'}</span>
          </button>
          {showLegend && (
            <div className="px-3 pb-3 space-y-1.5">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-gray-400">{TYPE_NAMES[type]}</span>
                </div>
              ))}
              <div className="border-t border-white/5 pt-1.5 mt-1.5 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-purple-500" />
                  <span className="text-[10px] text-gray-400">✈ Перелёт</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-amber-500" />
                  <span className="text-[10px] text-gray-400">🛒 Покупка</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-rose-500" />
                  <span className="text-[10px] text-gray-400">💸 Обналичивание</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-red-500" />
                  <span className="text-[10px] text-gray-400">⚠ Подозрительный</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-blue-500" />
                  <span className="text-[10px] text-gray-400">Обычный перевод</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-pink-500" style={{ borderTop: '1px dashed' }} />
                  <span className="text-[10px] text-gray-400">Директор</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-cyan-500" style={{ borderTop: '1px dashed' }} />
                  <span className="text-[10px] text-gray-400">Учредитель</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-orange-500" style={{ borderTop: '1px dashed' }} />
                  <span className="text-[10px] text-gray-400">Родственник</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">↺</span>
                  <span className="text-[10px] text-gray-400">Петля (на себя)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Context menu on node right-click ── */}
        {contextMenu && (
          <div
            className="absolute z-50 bg-kz-panel border border-white/10 rounded-xl shadow-2xl py-1 min-w-[170px] select-none"
            style={{ left: contextMenu.x + 8, top: contextMenu.y - 8 }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="text-[10px] font-bold text-gray-400 px-3 py-1.5 border-b border-white/10 truncate">
              {contextMenu.name}
            </div>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 transition-colors"
              onClick={() => {
                setCollapsedNodes(prev => new Set([...prev, contextMenu.nodeId]))
                setContextMenu(null)
              }}
            >
              <EyeOff className="w-3.5 h-3.5 text-red-400" />
              Скрыть связи
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 transition-colors"
              onClick={() => {
                setCollapsedNodes(prev => { const n = new Set(prev); n.delete(contextMenu.nodeId); return n })
                setContextMenu(null)
              }}
            >
              <Eye className="w-3.5 h-3.5 text-green-400" />
              Раскрыть
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 transition-colors"
              onClick={() => { setCollapsedNodes(new Set()); setContextMenu(null) }}
            >
              <Expand className="w-3.5 h-3.5 text-blue-400" />
              Показать всё
            </button>
            <div className="border-t border-white/10 mt-0.5" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 transition-colors"
              onClick={() => { handleNodeClick(contextMenu.nodeId); setContextMenu(null) }}
            >
              <ChevronRight className="w-3.5 h-3.5 text-yellow-400" />
              Детали
            </button>
            <div className="border-t border-white/10 mt-0.5" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 transition-colors"
              onClick={() => {
                setNoteText(nodeNotes[contextMenu.nodeId] ?? '')
                setNoteDialog({ nodeId: contextMenu.nodeId, name: contextMenu.name })
                setContextMenu(null)
              }}
            >
              <MapPin className="w-3.5 h-3.5 text-purple-400" />
              {nodeNotes[contextMenu.nodeId] ? 'Редактировать заметку' : 'Добавить заметку'}
            </button>
            <div className="border-t border-white/10 mt-0.5" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={() => {
                setRemovedNodes(prev => new Set([...prev, contextMenu.nodeId]))
                setSelectedNodeIds(prev => prev.filter(id => id !== contextMenu.nodeId))
                setContextMenu(null)
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Удалить из графа
            </button>
          </div>
        )}

        {/* In-canvas floating search bar */}
        {(viewMode === 'graph' || viewMode === 'globe' || viewMode === 'map') && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
              <input
                type="text"
                value={canvasSearchQuery}
                onChange={e => setCanvasSearchQuery(e.target.value)}
                placeholder="Поиск на карте..."
                className="pl-8 pr-8 py-2 bg-kz-panel/95 backdrop-blur border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 w-52 shadow-lg transition-all"
              />
              {canvasSearchQuery && (
                <button onClick={() => setCanvasSearchQuery('')}
                  className="absolute right-2 top-2 text-gray-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {canvasSearchQuery.trim() && (() => {
              const q = canvasSearchQuery.toLowerCase()
              // RIGHT SEARCH: only search nodes CURRENTLY on the graph/view — highlight only, no add
              const graphNodes = filteredGraph?.nodes ?? []
              const matches = graphNodes.filter(n =>
                n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
              )
              return matches.length > 0 ? (
                <div className="absolute top-full right-0 mt-1 bg-kz-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 w-72 max-h-64 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[9px] font-bold text-amber-500/80 uppercase tracking-wider bg-amber-500/5 border-b border-white/5 flex items-center gap-1.5">
                    <Search className="w-2.5 h-2.5" /> Подсветить на графе ({matches.length})
                  </div>
                  {matches.slice(0, 8).map(node => (
                    <button key={node.id}
                      onClick={() => { setCanvasSearchQuery(node.name) }}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors border-b border-white/5 last:border-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[node.type] }} />
                      <div>
                        <div className="text-xs text-white font-medium">{node.name}</div>
                        <div className="text-[9px] text-gray-500">{TYPE_NAMES[node.type]} · {node.region}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="absolute top-full right-0 mt-1 bg-kz-panel border border-white/10 rounded-xl shadow-2xl p-3 z-50 w-64">
                  <p className="text-xs text-gray-500 text-center">Не найдено на текущем графе</p>
                </div>
              )
            })()}
          </div>
        )}

        {/* Bottom note bar — shows note for hovered node */}
        {hoveredNode && nodeNotes[hoveredNode.id] && (viewMode === 'graph' || viewMode === 'map') && (
          <div className="absolute bottom-0 left-0 right-0 bg-purple-950/90 backdrop-blur border-t border-purple-500/25 px-4 py-2 flex items-center gap-2.5 z-20 pointer-events-none">
            <MapPin className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span className="text-xs text-purple-300 font-medium truncate">{hoveredNode.name}:</span>
            <span className="text-xs text-purple-100 leading-snug line-clamp-1">{nodeNotes[hoveredNode.id]}</span>
          </div>
        )}

        {/* Note edit dialog */}
        {noteDialog && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-kz-panel border border-white/10 rounded-2xl shadow-2xl p-6 w-96 mx-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-white truncate max-w-[250px]">Заметка: {noteDialog.name}</span>
                </div>
                <button onClick={() => setNoteDialog(null)} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                className="w-full bg-kz-surface border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 resize-none h-28"
                placeholder="Введите заметку по этой организации..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                autoFocus
              />
              <div className="flex items-center justify-between mt-3 gap-2">
                {nodeNotes[noteDialog.nodeId] && (
                  <button
                    onClick={() => {
                      setNodeNotes(prev => { const n = { ...prev }; delete n[noteDialog.nodeId]; return n })
                      setNoteDialog(null)
                    }}
                    className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all"
                  >
                    Удалить
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setNoteDialog(null)}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 rounded-xl transition-all">
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      if (noteText.trim()) {
                        setNodeNotes(prev => ({ ...prev, [noteDialog.nodeId]: noteText.trim() }))
                      } else {
                        setNodeNotes(prev => { const n = { ...prev }; delete n[noteDialog.nodeId]; return n })
                      }
                      setNoteDialog(null)
                    }}
                    className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all font-medium">
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Zoom controls + AI action buttons — graph/map only */}
        {viewMode !== 'globe' && (
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
          {/* Hide non-highlighted toggle (AI active) */}
          {aiHighlightedPaths.length > 0 && (
            <button
              onClick={() => setFilterToHighlighted(f => !f)}
              title={filterToHighlighted ? 'Показать все' : 'Скрыть невыделенные'}
              className={`p-2 backdrop-blur border rounded-xl transition-colors shadow-lg ${
                filterToHighlighted
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-kz-panel/90 border-white/10 text-gray-400 hover:bg-white/10'
              }`}>
              {filterToHighlighted
                ? <Eye className="w-4 h-4" />
                : <EyeOff className="w-4 h-4" />}
            </button>
          )}

          {/* Standard zoom buttons */}
          <button className="p-2 bg-kz-panel/90 backdrop-blur border border-white/10 rounded-xl hover:bg-white/10 transition-colors shadow-lg"
            onClick={() => {
              if (svgRef.current && zoomRef.current)
                d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3)
            }}>
            <ZoomIn className="w-4 h-4 text-gray-300" />
          </button>
          <button className="p-2 bg-kz-panel/90 backdrop-blur border border-white/10 rounded-xl hover:bg-white/10 transition-colors shadow-lg"
            onClick={() => {
              if (svgRef.current && zoomRef.current)
                d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7)
            }}>
            <ZoomOut className="w-4 h-4 text-gray-300" />
          </button>
          <button className="p-2 bg-kz-panel/90 backdrop-blur border border-white/10 rounded-xl hover:bg-white/10 transition-colors shadow-lg"
            onClick={() => {
              if (svgRef.current && zoomRef.current && containerRef.current) {
                const w = containerRef.current.clientWidth
                const h = containerRef.current.clientHeight
                d3.select(svgRef.current).transition().duration(500)
                  .call(zoomRef.current.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(0.8))
              }
            }}>
            <Maximize2 className="w-4 h-4 text-gray-300" />
          </button>
        </div>
        )}

        {/* ═══════════════════════════════════════════
            ENTITY DETAIL PANEL (right side)
            ═══════════════════════════════════════════ */}
        {showPanel && selectedEntity && (
          <div className="absolute inset-y-0 right-0 w-[420px] bg-kz-panel/95 backdrop-blur-xl border-l border-white/10 z-30 overflow-y-auto shadow-2xl animate-slide-in"
            onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: TYPE_COLORS[selectedEntity.entity.type] + '20' }}>
                    <Building2 className="w-5 h-5" style={{ color: TYPE_COLORS[selectedEntity.entity.type] }} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white leading-tight">{selectedEntity.entity.name}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border"
                      style={{
                        color: TYPE_COLORS[selectedEntity.entity.type],
                        borderColor: TYPE_COLORS[selectedEntity.entity.type] + '40',
                        backgroundColor: TYPE_COLORS[selectedEntity.entity.type] + '10',
                      }}>
                      {TYPE_NAMES[selectedEntity.entity.type]}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowPanel(false)}
                  className="text-gray-400 hover:text-white bg-white/5 p-1.5 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-kz-surface rounded-xl p-3 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase">Риск</div>
                  <div className={`text-xl font-bold ${
                    selectedEntity.entity.risk_score > 60 ? 'text-red-400'
                    : selectedEntity.entity.risk_score > 30 ? 'text-yellow-400'
                    : 'text-green-400'
                  }`}>
                    {selectedEntity.entity.risk_score.toFixed(0)}%
                  </div>
                </div>
                <div className="bg-kz-surface rounded-xl p-3 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase">Транзакции</div>
                  <div className="text-xl font-bold text-white">{selectedEntity.entity.transaction_count}</div>
                </div>
                <div className="bg-kz-surface rounded-xl p-3 border border-white/5 text-center">
                  <div className="text-[9px] text-gray-500 uppercase">Регион</div>
                  <div className="text-xs font-bold text-white mt-1">{selectedEntity.entity.region}</div>
                </div>
              </div>

              {/* CEO / Company Info */}
              {(selectedEntity.entity as any).ceo_name && (
                <div className="bg-kz-surface rounded-xl p-4 border border-white/5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase">Руководитель / CEO</span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1">{(selectedEntity.entity as any).ceo_name}</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] mt-2">
                    {(selectedEntity.entity as any).bin_number && (
                      <div>
                        <span className="text-gray-500">БИН:</span>{' '}
                        <span className="text-gray-300 font-mono">{(selectedEntity.entity as any).bin_number}</span>
                      </div>
                    )}
                    {(selectedEntity.entity as any).founded_year > 0 && (
                      <div>
                        <span className="text-gray-500">Осн.:</span>{' '}
                        <span className="text-gray-300">{(selectedEntity.entity as any).founded_year} г.</span>
                      </div>
                    )}
                    {(selectedEntity.entity as any).employee_count > 0 && (
                      <div>
                        <span className="text-gray-500">Сотр.:</span>{' '}
                        <span className="text-gray-300">{(selectedEntity.entity as any).employee_count}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tender audit — won vs spent */}
              {(selectedEntity.entity as any).tender_won_amount > 0 && (
                <div className="bg-kz-surface rounded-xl p-4 border border-white/5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase">Аудит тендеров</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] text-gray-500">Выиграно тендеров</div>
                      <div className="text-lg font-bold text-blue-400">
                        ₸{formatAmount((selectedEntity.entity as any).tender_won_amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-500">Факт. расходы</div>
                      <div className="text-lg font-bold text-red-400">
                        ₸{formatAmount((selectedEntity.entity as any).actual_spent_amount)}
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const won = (selectedEntity.entity as any).tender_won_amount || 0
                    const spent = (selectedEntity.entity as any).actual_spent_amount || 0
                    const diff = won - spent
                    const pct = won > 0 ? ((diff / won) * 100).toFixed(0) : '0'
                    return diff > 0 ? (
                      <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <div className="text-xs text-red-300">
                          <span className="font-bold">₸{formatAmount(diff)}</span> ({pct}%) — неизвестно куда потрачено.
                          Требуется расследование.
                        </div>
                      </div>
                    ) : null
                  })()}
                </div>
              )}

              {/* Suspicion alert */}
              {(selectedEntity.entity as any).suspicion_summary && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-xs font-bold text-red-400 mb-1">Подозрение</span>
                    <span className="block text-xs text-red-300 leading-relaxed">
                      {(selectedEntity.entity as any).suspicion_summary}
                    </span>
                  </div>
                </div>
              )}

              {selectedEntity.entity.is_suspicious && !(selectedEntity.entity as any).suspicion_summary && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-red-300 leading-relaxed">
                    Организация находится под наблюдением из-за подозрительных финансовых операций.
                  </span>
                </div>
              )}

              {/* "Подробнее" → go to graph with selection (hidden if already on graph) */}
              {viewMode !== 'graph' && (
                <button
                  onClick={() => {
                    setShowPanel(false)
                    if (!selectedNodeIds.includes(selectedEntity.entity.id)) {
                      toggleNodeSelection(selectedEntity.entity.id)
                    }
                    setViewMode('graph')
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-kz-blue/20 border border-kz-blue/30 rounded-xl text-kz-blue text-sm font-medium hover:bg-kz-blue/30 transition-all mb-5">
                  <Network className="w-4 h-4" /> Подробнее на графе <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {/* Outgoing flows */}
              <div className="space-y-5">
                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5" /> Исходящие потоки ({selectedEntity.outgoing_flows.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedEntity.outgoing_flows.slice(0, 15).map(f => (
                      <div key={f.id}
                        className={`p-3 rounded-xl border ${
                          f.is_suspicious ? 'bg-red-500/5 border-red-500/20' : 'bg-kz-surface border-white/5'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-300 font-medium truncate flex-1">{f.target_name}</span>
                          <span className="text-xs font-bold text-white ml-2">₸{formatAmount(f.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] flex-wrap">
                          {f.flow_type === 'flight' && (
                            <span className="text-purple-400 flex items-center gap-1">
                              <Plane className="w-3 h-3" />Перелёт
                            </span>
                          )}
                          {f.flow_type === 'purchase' && (
                            <span className="text-amber-400 flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3" />Покупка
                            </span>
                          )}
                          {f.flow_type === 'cash_out' && (
                            <span className="text-rose-400 flex items-center gap-1">💸 Обнал</span>
                          )}
                          {!['flight', 'purchase', 'cash_out'].includes(f.flow_type) && (
                            <span className="text-gray-500">{f.flow_type}</span>
                          )}
                          {f.flow_date && (
                            <span className="text-gray-500">📅 {formatDate(f.flow_date)}</span>
                          )}
                          {f.is_suspicious && <span className="text-red-400 ml-auto">⚠</span>}
                        </div>
                        {f.description && (
                          <div className="text-[9px] text-gray-500 mt-1.5 leading-relaxed bg-white/[0.02] px-2 py-1 rounded">
                            {f.description.substring(0, 100)}{f.description.length > 100 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedEntity.outgoing_flows.length === 0 && (
                      <div className="text-[10px] text-gray-600 text-center py-3">Нет исходящих потоков</div>
                    )}
                  </div>
                </div>

                {/* Incoming flows */}
                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ArrowLeft className="w-3.5 h-3.5" /> Входящие потоки ({selectedEntity.incoming_flows.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedEntity.incoming_flows.slice(0, 15).map(f => (
                      <div key={f.id}
                        className={`p-3 rounded-xl border ${
                          f.is_suspicious ? 'bg-red-500/5 border-red-500/20' : 'bg-kz-surface border-white/5'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-300 font-medium truncate flex-1">{f.source_name}</span>
                          <span className="text-xs font-bold text-white ml-2">₸{formatAmount(f.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] flex-wrap">
                          {f.flow_type === 'flight' && (
                            <span className="text-purple-400 flex items-center gap-1">
                              <Plane className="w-3 h-3" />Перелёт
                            </span>
                          )}
                          {f.flow_type === 'purchase' && (
                            <span className="text-amber-400 flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3" />Покупка
                            </span>
                          )}
                          {f.flow_type === 'cash_out' && (
                            <span className="text-rose-400 flex items-center gap-1">💸 Обнал</span>
                          )}
                          {!['flight', 'purchase', 'cash_out'].includes(f.flow_type) && (
                            <span className="text-gray-500">{f.flow_type}</span>
                          )}
                          {f.flow_date && (
                            <span className="text-gray-500">📅 {formatDate(f.flow_date)}</span>
                          )}
                          {f.is_suspicious && <span className="text-red-400 ml-auto">⚠</span>}
                        </div>
                        {f.description && (
                          <div className="text-[9px] text-gray-500 mt-1.5 leading-relaxed bg-white/[0.02] px-2 py-1 rounded">
                            {f.description.substring(0, 100)}{f.description.length > 100 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedEntity.incoming_flows.length === 0 && (
                      <div className="text-[10px] text-gray-600 text-center py-3">Нет входящих потоков</div>
                    )}
                  </div>
                </div>

                {/* Connected entities */}
                {selectedEntity.connected_entities && selectedEntity.connected_entities.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Network className="w-3.5 h-3.5" /> Связанные организации ({selectedEntity.connected_entities.length})
                    </h3>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedEntity.connected_entities.map((ce: any) => (
                        <button key={ce.id}
                          onClick={() => handleNodeClick(ce.id)}
                          className="w-full text-left flex items-center gap-2 p-2 rounded-lg bg-kz-surface border border-white/5 hover:bg-white/5 transition-colors">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[ce.type] || '#6B7280' }} />
                          <span className="text-[10px] text-gray-300 flex-1 truncate">{ce.name}</span>
                          <span className={`text-[9px] font-bold ${ce.risk_score > 60 ? 'text-red-400' : 'text-gray-500'}`}>
                            {ce.risk_score?.toFixed(0)}%
                          </span>
                          {ce.is_suspicious && <span className="text-[10px] text-red-400">⚠</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            FLOW DETAIL PANEL (right side) — redesigned
            ═══════════════════════════════════════════ */}
        {showFlowPanel && selectedFlow && (() => {
          const flowSource = typeof selectedFlow.source === 'object'
            ? selectedFlow.source
            : (graphData?.nodes.find(n => n.id === (selectedFlow.source as string)) ?? null)
          const flowTarget = typeof selectedFlow.target === 'object'
            ? selectedFlow.target
            : (graphData?.nodes.find(n => n.id === (selectedFlow.target as string)) ?? null)
          // Robust ID extraction — works whether source/target is an object or a plain string
          const sourceId: string | null = flowSource ? ((flowSource as any).id ?? null)
            : (typeof selectedFlow.source === 'string' ? selectedFlow.source : null)
          const targetId: string | null = flowTarget ? ((flowTarget as any).id ?? null)
            : (typeof selectedFlow.target === 'string' ? selectedFlow.target : null)
          // Flights are always rendered as self-loops on graph; data-level self-loops also count
          const isSelfLoop = selectedFlow.flow_type === 'flight' ||
            (sourceId !== null && sourceId === targetId)
          const flowTypeMap: Record<string, { label: string; color: string; border: string; bg: string; icon: string }> = {
            'flight': { label: 'Перелёт', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', icon: '✈' },
            'purchase': { label: 'Покупка', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: '🛒' },
            'cash_out': { label: 'Обналичивание', color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', icon: '💸' },
            'contract_payment': { label: 'Оплата контракта', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', icon: '📄' },
            'subcontract': { label: 'Субподряд', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', icon: '🔗' },
            'consulting_fee': { label: 'Консалтинг', color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/10', icon: '💼' },
            'investment': { label: 'Инвестиция', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', icon: '📈' },
            'loan': { label: 'Займ', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', icon: '🏦' },
            'commission': { label: 'Комиссия', color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', icon: '💱' },
            'director': { label: 'Директор', color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10', icon: '👔' },
            'founder': { label: 'Учредитель', color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10', icon: '🏛' },
            'relative': { label: 'Родственник', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', icon: '👨‍👩‍👧' },
            'unknown': { label: 'Неизвестный', color: 'text-gray-400', border: 'border-gray-500/30', bg: 'bg-gray-500/10', icon: '❓' },
          }
          const ft = flowTypeMap[selectedFlow.flow_type || ''] || flowTypeMap['unknown']
          return (
          <div className="absolute inset-y-0 right-0 w-[420px] bg-gradient-to-b from-kz-panel/98 to-[#0a1628]/98 backdrop-blur-xl border-l border-white/10 z-30 overflow-y-auto shadow-2xl animate-slide-in"
            onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              {/* Header with colored accent bar */}
              <div className="relative">
                <div className={`absolute top-0 left-0 w-1 h-full rounded-full ${
                  selectedFlow.is_suspicious ? 'bg-red-500' : 'bg-blue-500'}`} />
                <div className="pl-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Детали операции</div>
                    <div className={`text-3xl font-black tracking-tight ${
                      selectedFlow.is_suspicious ? 'text-red-400' : 'text-white'}`}>
                      ₸{formatAmount(selectedFlow.amount)}
                    </div>
                  </div>
                  <button onClick={() => setShowFlowPanel(false)}
                    className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Suspicious banner */}
              {selectedFlow.is_suspicious && (
                <div className="bg-gradient-to-r from-red-500/15 to-red-900/10 border border-red-500/25 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-red-400 mb-0.5">Подозрительная операция</div>
                    <div className="text-[10px] text-red-300/80 leading-relaxed">
                      Помечено из-за расхождений, связи с оффшором или быстрых переводов
                    </div>
                  </div>
                </div>
              )}

              {/* Flow type badge — large, prominent */}
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${ft.border} ${ft.bg}`}>
                <span className="text-2xl">{ft.icon}</span>
                <div>
                  <div className={`text-sm font-bold ${ft.color}`}>{ft.label}</div>
                  {isSelfLoop && selectedFlow.flow_type !== 'flight' && (
                    <div className="text-[10px] text-gray-400 mt-0.5">Операция на себя (петля)</div>
                  )}
                </div>
              </div>

              {/* ── Flight details ── */}
              {selectedFlow.flow_type === 'flight' && (() => {
                // Parse description: "Перелёт Астана→Дубай, ОАЭ | Lufthansa рейс LU854 | Бизнес-класс | Аманов Жандос | 22.10.2025"
                const desc = selectedFlow.description || ''
                const parts = desc.split('|').map((s: string) => s.trim())
                let routeFrom = '', routeTo = '', airline = '', flightNum = '', flightClass = '', passenger = ''
                const extraParts: string[] = []
                parts.forEach((p: string) => {
                  const arrow = p.indexOf('→')
                  if (arrow !== -1 && (p.toLowerCase().includes('перелёт') || p.toLowerCase().includes('перелет') || arrow > 0)) {
                    // Route part e.g. "Перелёт Астана→Дубай, ОАЭ"
                    const routeStr = p.replace(/перелёт|перелет/gi, '').trim()
                    routeFrom = routeStr.slice(0, arrow - p.replace(/перелёт|перелет/gi,'').search(routeStr[0])).trim()
                    const raw = routeStr.split('→')
                    routeFrom = raw[0].trim()
                    routeTo = raw[1]?.trim() || ''
                  } else if (/рейс/i.test(p)) {
                    // "Lufthansa рейс LU854"
                    const m = p.match(/^(.+?)\s+рейс\s+(\S+)$/i)
                    if (m) { airline = m[1].trim(); flightNum = m[2].trim() }
                    else { airline = p }
                  } else if (/класс/i.test(p)) {
                    flightClass = p.trim()
                  } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(p)) {
                    // date — skip, already shown
                  } else if (p.length > 2) {
                    // Check if it looks like a person name (contains 2+ words, all starting Capital)
                    const words = p.split(' ').filter(Boolean)
                    const looksLikeName = words.length >= 2 && words.every(w => /^[А-ЯЁA-Z]/.test(w))
                    if (looksLikeName && !passenger) passenger = p
                    else if (p.length > 3) extraParts.push(p)
                  }
                })
                return (
                <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl p-4 space-y-3">
                  <div className="text-[10px] text-purple-300 uppercase font-bold tracking-wider flex items-center gap-1.5">
                    ✈ Данные перелёта
                  </div>
                  {/* Route: From → To */}
                  {(routeFrom || routeTo) ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-center bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Откуда</div>
                      <div className="text-sm font-bold text-white">{routeFrom || '—'}</div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                      <span className="text-purple-400 text-base">✈</span>
                      <div className="w-8 h-0.5 bg-purple-500/50 rounded-full" />
                    </div>
                    <div className="flex-1 text-center bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Куда</div>
                      <div className="text-sm font-bold text-white">{routeTo || '—'}</div>
                    </div>
                  </div>
                  ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-center">
                      <div className="text-[10px] text-gray-500 mb-0.5">Откуда</div>
                      <div className="text-sm font-bold text-white">{flowSource ? (flowSource as any).country || (flowSource as any).name : '—'}</div>
                    </div>
                    <span className="text-purple-400 text-lg">✈</span>
                    <div className="flex-1 text-center">
                      <div className="text-[10px] text-gray-500 mb-0.5">Куда</div>
                      <div className="text-sm font-bold text-white">{flowTarget ? (flowTarget as any).country || (flowTarget as any).name : '—'}</div>
                    </div>
                  </div>
                  )}
                  {/* Flight info grid */}
                  {(airline || flightNum || flightClass || passenger) && (
                  <div className="grid grid-cols-2 gap-2">
                    {airline && (
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Авиакомпания</div>
                      <div className="text-xs font-semibold text-white">{airline}</div>
                    </div>
                    )}
                    {flightNum && (
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Рейс</div>
                      <div className="text-xs font-semibold text-purple-300 font-mono">{flightNum}</div>
                    </div>
                    )}
                    {flightClass && (
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Класс</div>
                      <div className="text-xs font-semibold text-white">{flightClass}</div>
                    </div>
                    )}
                    {passenger && (
                    <div className="bg-black/20 rounded-xl p-2.5 col-span-2">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Пассажир</div>
                      <div className="text-xs font-semibold text-white">{passenger}</div>
                    </div>
                    )}
                  </div>
                  )}
                  {/* Date */}
                  {selectedFlow.flow_date && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-300 bg-black/20 rounded-xl px-3 py-2">
                    <span className="text-purple-300">📅</span>
                    Дата перелёта: <span className="font-semibold ml-1">{formatDate(selectedFlow.flow_date)}</span>
                  </div>
                  )}
                  {/* Extra context (who accompanied, hotel, etc.) */}
                  {extraParts.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Дополнительно</div>
                    {extraParts.map((ep: string, i: number) => (
                      <div key={i} className="text-[10px] text-gray-300 bg-black/20 rounded-xl px-3 py-2 leading-relaxed">{ep}</div>
                    ))}
                  </div>
                  )}
                  <div className="text-[10px] text-purple-300/50 italic">Возможные попутчики: проверьте связи по датам</div>
                </div>
                )
              })()}

              {/* ── Purchase details ── */}
              {selectedFlow.flow_type === 'purchase' && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 space-y-3">
                  <div className="text-[10px] text-amber-300 uppercase font-bold tracking-wider">🛒 Детали покупки</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Место покупки</div>
                      <div className="text-xs font-semibold text-white">
                        {flowTarget ? (flowTarget as any).name : '—'}
                      </div>
                      {flowTarget && (flowTarget as any).country && (
                        <div className="text-[9px] text-amber-300/70">{(flowTarget as any).country}</div>
                      )}
                    </div>
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Сумма</div>
                      <div className="text-xs font-semibold text-amber-300">₸{formatAmount(selectedFlow.amount)}</div>
                    </div>
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Метод оплаты</div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1">
                        {selectedFlow.description?.toLowerCase().includes('нал') || selectedFlow.description?.toLowerCase().includes('cash')
                          ? <><Banknote className="w-3 h-3 text-green-400" /> Наличные</>
                          : <><CreditCard className="w-3 h-3 text-blue-400" /> Карта</>}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Покупатель</div>
                      <div className="text-xs font-semibold text-white truncate">
                        {flowSource ? (flowSource as any).name : '—'}
                      </div>
                    </div>
                  </div>
                  {selectedFlow.description && (
                    <div className="text-[10px] text-gray-400 bg-black/20 rounded-xl px-3 py-2 leading-relaxed">
                      {selectedFlow.description}
                    </div>
                  )}
                </div>
              )}

              {/* ── Cash-out details ── */}
              {selectedFlow.flow_type === 'cash_out' && (
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 space-y-3">
                  <div className="text-[10px] text-rose-300 uppercase font-bold tracking-wider">💸 Обналичивание</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Источник</div>
                      <div className="text-xs font-semibold text-white">{flowSource ? (flowSource as any).name : '—'}</div>
                    </div>
                    <div className="bg-black/20 rounded-xl p-2.5">
                      <div className="text-[9px] text-gray-500 uppercase mb-0.5">Сумма</div>
                      <div className="text-xs font-semibold text-rose-400">₸{formatAmount(selectedFlow.amount)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* From → To card — only for types without dedicated sections */}
              {!['flight', 'purchase', 'cash_out'].includes(selectedFlow.flow_type || '') && (
              <div className="bg-kz-surface/80 rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-1.5 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Отправитель
                      </div>
                      <div className="text-sm font-bold text-white truncate">
                        {flowSource ? (flowSource as any).name : String(selectedFlow.source)}
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                      {isSelfLoop ? (
                        <span className="text-xs text-gray-400">↺</span>
                      ) : (
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-1.5 flex items-center justify-end gap-1">
                        Получатель
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                      <div className="text-sm font-bold text-white truncate">
                        {flowTarget ? (flowTarget as any).name : String(selectedFlow.target)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Description — hidden for flights (already parsed above) */}
              {selectedFlow.description && selectedFlow.flow_type !== 'flight' && (
                <div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-2">Описание</div>
                  <div className="text-xs text-gray-300 bg-white/[0.03] p-4 rounded-xl leading-relaxed border border-white/5">
                    {selectedFlow.description}
                  </div>
                </div>
              )}

              {/* Date */}
              {'flow_date' in selectedFlow && selectedFlow.flow_date && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-400 text-xs">📅</span>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-500 uppercase font-bold">Дата операции</div>
                    <div className="text-sm text-gray-200 font-medium">{formatDate(selectedFlow.flow_date)}</div>
                  </div>
                </div>
              )}

              {/* Linked document */}
              {'document' in selectedFlow && selectedFlow.document && (
                <div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-2">Связанный документ</div>
                  <div className="p-4 bg-kz-surface border border-white/5 rounded-2xl space-y-3">
                    <div className="font-bold text-sm text-gray-200">{selectedFlow.document.title}</div>
                    <div className="text-[10px] text-gray-400 font-mono bg-white/5 inline-block px-2 py-0.5 rounded">
                      {selectedFlow.document.contract_number}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/[0.03] rounded-lg p-2.5">
                        <div className="text-[9px] text-gray-500 mb-0.5">Контракт</div>
                        <div className="text-sm font-bold text-blue-400">₸{formatAmount(selectedFlow.document.contract_amount)}</div>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-2.5">
                        <div className="text-[9px] text-gray-500 mb-0.5">Факт. оплата</div>
                        <div className={`text-sm font-bold ${selectedFlow.document.discrepancy_percent > 5 ? 'text-red-400' : 'text-green-400'}`}>
                          ₸{formatAmount(selectedFlow.document.actual_paid)}
                        </div>
                      </div>
                    </div>
                    {selectedFlow.document.discrepancy_percent > 3 && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span className="text-[11px] text-red-400 font-bold">
                          Расхождение: +{selectedFlow.document.discrepancy_percent.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation buttons — context-aware per flow type */}
              <div className="flex flex-col gap-2 pt-2">
                {/* Show on graph — always available if we have a source */}
                {sourceId && (
                  <button
                    onClick={() => {
                      const ids = [sourceId, ...(targetId && targetId !== sourceId ? [targetId] : [])].filter(Boolean) as string[]
                      setSelectedNodeIds(ids)
                      setViewMode('graph')
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border
                      ${ selectedFlow.flow_type === 'flight' ? 'bg-purple-500/10 border-purple-500/20 text-purple-300 hover:bg-purple-500/20'
                        : selectedFlow.flow_type === 'purchase' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20'
                        : selectedFlow.flow_type === 'cash_out' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20'
                        : 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20' }`}>
                    <Network className="w-3.5 h-3.5" /> Показать на графе
                  </button>
                )}
                {/* Show on map — for flights and if we have coordinates/IDs */}
                {(selectedFlow.flow_type === 'flight' || selectedFlow.flow_type === 'purchase') && (sourceId || targetId) && (
                  <button
                    onClick={() => {
                      const ids = [sourceId, targetId].filter(Boolean) as string[]
                      setSelectedNodeIds(ids)
                      setViewMode('map')
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 hover:bg-blue-500/20 transition-all font-medium">
                    <MapPin className="w-3.5 h-3.5" /> Показать на карте
                  </button>
                )}
                {/* Open entity detail */}
                {sourceId && (
                  <button
                    onClick={() => { if (sourceId) handleNodeClick(sourceId) }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-300 hover:bg-white/10 transition-all font-medium">
                    <Building2 className="w-3.5 h-3.5" /> Открыть {isSelfLoop ? 'организацию' : 'отправителя'}
                  </button>
                )}
                {targetId && targetId !== sourceId && (
                  <button
                    onClick={() => { if (targetId) handleNodeClick(targetId) }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-300 hover:bg-white/10 transition-all font-medium">
                    <Building2 className="w-3.5 h-3.5" /> Открыть получателя
                  </button>
                )}
              </div>
            </div>
          </div>
          )
        })()}

        {/* ═══════════════════════════════════════════
            AI ANALYSIS PANEL (left side)
            ═══════════════════════════════════════════ */}
        {aiResult && (
          <div className="absolute inset-y-0 left-0 w-[450px] bg-kz-panel/95 backdrop-blur-xl border-r border-white/10 z-30 overflow-y-auto shadow-2xl animate-slide-in"
            onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-sm font-bold text-white">ИИ Анализ</h2>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNodeIds.length > 0 && (() => {
                    const _openProtocol = () => {
                      const score = aiResult.network_risk_score ?? 0
                      const caseNum = `ФМ-${selectedNodeIds[0].replace(/[^A-Z0-9]/g, '')}-${new Date().getFullYear()}`
                      const dateStr = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
                      const classification = score >= 80 ? 'СОВЕРШЕННО СЕКРЕТНО' : score >= 60 ? 'СЕКРЕТНО' : 'ДЛЯ СЛУЖЕБНОГО ПОЛЬЗОВАНИЯ'
                      const classColor = score >= 80 ? '#dc2626' : score >= 60 ? '#d97706' : '#b45309'
                      const patterns = aiResult.suspicious_patterns ?? []
                      const findings = aiResult.key_findings ?? []
                      const recs = aiResult.recommended_investigations ?? []
                      const TYPE_LABELS: Record<string, string> = {
                        government: 'Государственный орган', company: 'ТОО/АО',
                        intermediary: 'Посредник', offshore: 'Оффшорная структура', individual: 'Физическое лицо',
                      }
                      const fmtAmt = (v: number) => v >= 1e9 ? `${(v / 1e9).toFixed(2)} млрд тенге` : `${(v / 1e6).toFixed(1)} млн тенге`
                      const totalAmt = patterns.reduce((acc, p) => {
                        const a = p.estimated_risk_amount && p.estimated_risk_amount > 0
                          ? p.estimated_risk_amount
                          : Math.round(score * score * selectedNodeIds.length * 250_000 / Math.max(1, patterns.length))
                        return acc + a
                      }, 0)
                      const subjectRows = selectedNodeIds.map((id, i) => {
                        const n = graphData?.nodes.find(x => x.id === id)
                        return `<tr style="${i % 2 === 0 ? 'background:#fafafa' : ''}">
                          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${i + 1}</td>
                          <td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${n?.name ?? id}</td>
                          <td style="padding:6px 10px;border:1px solid #ddd">${n ? (TYPE_LABELS[n.type] ?? n.type) : id}</td>
                          <td style="padding:6px 10px;border:1px solid #ddd">${(n as any)?.region ?? '—'}</td>
                          <td style="padding:6px 10px;border:1px solid #ddd;color:${(n as any)?.is_suspicious ? '#dc2626' : '#16a34a'}">${(n as any)?.is_suspicious ? 'ДА' : 'НЕТ'}</td>
                        </tr>`
                      }).join('')
                      const violationsRows = patterns.map((p, i) => {
                        const a = p.estimated_risk_amount && p.estimated_risk_amount > 0
                          ? p.estimated_risk_amount
                          : Math.round(score * score * selectedNodeIds.length * 250_000 / Math.max(1, patterns.length))
                        const sc = p.severity === 'CRITICAL' ? '#dc2626' : p.severity === 'HIGH' ? '#d97706' : '#2563eb'
                        return `<tr style="${i % 2 === 0 ? 'background:#fafafa' : ''}">
                          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${i + 1}</td>
                          <td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${p.pattern_type}</td>
                          <td style="padding:6px 10px;border:1px solid #ddd">${p.description}</td>
                          <td style="padding:6px 10px;border:1px solid #ddd;color:${sc};font-weight:700">${p.severity}</td>
                          <td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${fmtAmt(a)}</td>
                        </tr>`
                      }).join('')
                      const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Протокол ${caseNum}</title>
<style>
@page{size:A4;margin:20mm 25mm 20mm 30mm}
*{box-sizing:border-box}
body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#111;line-height:1.5}
h1{font-size:13pt;text-transform:uppercase;text-align:center;margin:0 0 4px}
h2{font-size:12pt;text-transform:uppercase;margin:16px 0 8px;border-bottom:1px solid #333;padding-bottom:3px}
table{width:100%;border-collapse:collapse;font-size:11pt;margin:8px 0}
th{background:#1a1a2e;color:#fff;padding:7px 10px;border:1px solid #333;text-align:left;font-size:10pt;text-transform:uppercase;letter-spacing:.5px}
p{margin:4px 0;text-indent:1.5em;text-align:justify}
.cls{display:inline-block;border:2px solid ${classColor};color:${classColor};font-weight:900;font-size:11pt;letter-spacing:2px;padding:3px 16px}
.hdr{border-bottom:2px solid #1a1a2e;padding-bottom:12px;margin-bottom:16px}
.hdr-inner{display:flex;align-items:center;gap:18px;justify-content:center;margin-bottom:10px}
.logo-wrap{flex-shrink:0;width:72px;height:72px;border-radius:10px;overflow:hidden;background:#1e1b4b;border:1.5px solid #4dc9f040}
.conc{border:2px solid #1a1a2e;padding:14px 18px;margin-top:16px}
.sr{display:flex;justify-content:space-between;margin-top:32px}
.sl{width:45%}
.sl-line{border-top:1px solid #333;margin-top:32px;font-size:10pt;color:#555}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
<div class="hdr-inner">
<div class="logo-wrap"><img src="${window.location.origin}/auron-logo.svg" width="72" height="72" style="display:block" /></div>
<div style="text-align:left">
<div style="font-size:9pt;color:#555;margin-bottom:4px">ҚАЗАҚСТАН РЕСПУБЛИКАСЫ &middot; РЕСПУБЛИКА КАЗАХСТАН<br>Қаржылық мониторинг комитеті &middot; Комитет финансового мониторинга</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:18pt;font-weight:900;letter-spacing:0.15em;color:#1a1a2e;margin-left:-1px">AURON</div>
<div style="font-size:9pt;color:#555">ИИ-система антикоррупционного мониторинга</div>
</div>
</div>
<h1 style="text-align:center">Протокол служебного расследования</h1>
<div style="font-size:11pt;text-align:center;color:#333;margin:4px 0">Дело &numero; ${caseNum}</div>
<div style="margin-top:10px"><span class="cls">${classification}</span></div>
<div style="display:flex;justify-content:space-between;font-size:10pt;color:#444;margin-top:10px">
<span>Дата: ${dateStr}</span>
<span>Индекс риска: <strong style="font-size:14pt;color:${score>=80?'#dc2626':score>=60?'#d97706':'#2563eb'}">${score}</strong>/100</span>
<span>Субъектов: ${selectedNodeIds.length}</span>
</div></div>
<h2>Раздел I. Субъекты расследования</h2>
<table><thead><tr><th style="width:4%">&numero;</th><th style="width:28%">Наименование</th><th style="width:22%">Орг. форма</th><th style="width:18%">Регион</th><th style="width:14%">Признаки</th></tr></thead><tbody>${subjectRows}</tbody></table>
${aiResult.risk_assessment?`<h2>Раздел II. Оценка рисков</h2><p>${aiResult.risk_assessment}</p>`:''}
${patterns.length?`<h2>Раздел III. Выявленные нарушения (${fmtAmt(totalAmt)} под риском)</h2><table><thead><tr><th style="width:4%">&numero;</th><th style="width:22%">Тип</th><th style="width:34%">Описание</th><th style="width:12%">Степень</th><th style="width:18%">Сумма</th></tr></thead><tbody>${violationsRows}</tbody></table>`:''}
${findings.length?`<h2>Раздел IV. Ключевые факты</h2><ol style="margin:0;padding-left:1.5em">${findings.map(f=>`<li style="margin:4px 0">${f}</li>`).join('')}</ol>`:''}
${recs.length?`<h2>Раздел V. Рекомендуемые действия</h2><ol style="margin:0;padding-left:1.5em">${recs.map(r=>`<li style="margin:5px 0">${r}</li>`).join('')}</ol>`:''}
<div class="conc"><strong>ЗАКЛЮЧЕНИЕ.</strong> По итогам анализа сети взаимодействий <strong>${selectedNodeIds.length}</strong> субъектов выявлено <strong>${patterns.length}</strong> схем. Объём риска: <strong>${fmtAmt(totalAmt)}</strong>. Индекс: <strong style="color:${score>=80?'#dc2626':score>=60?'#d97706':'#2563eb'}">${score}/100</strong>. ${score>=80?'Требует немедленной передачи материалов в правоохранительные органы':score>=60?'Требует расширенной проверки':'Подлежит дополнительной проверке'}.</div>
<div class="sr"><div class="sl">Составил: Аналитик СИСТЕМЫ<div class="sl-line">подпись / мөр</div></div>
<div class="sl" style="text-align:right">Утвердил: Руководитель<div class="sl-line">подпись / мөр</div></div></div>
<div style="margin-top:18px;font-size:9pt;color:#888;text-align:center;border-top:1px solid #ccc;padding-top:6px">Дело &numero; ${caseNum} &middot; Сформировано системой ИИ-анализа &middot; ${dateStr} &middot; ${classification}</div>
</body></html>`
                      const win = window.open('', '_blank', 'width=900,height=1200')
                      if (!win) { alert('Разрешите всплывающие окна для экспорта PDF'); return }
                      win.document.write(html)
                      win.document.close()
                      setTimeout(() => { win.focus(); win.print() }, 600)
                    }
                    return (
                      <button onClick={_openProtocol} title="Составить протокол PDF"
                        className="flex items-center gap-1.5 text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-1.5 rounded-lg hover:bg-purple-500/25 transition-colors">
                        <FileText className="w-3.5 h-3.5" /> Протокол
                      </button>
                    )
                  })()}
                  <button onClick={() => setAiResult(null)}
                    className="text-gray-400 hover:text-white bg-white/5 p-1.5 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {aiResult.error ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-xs text-red-300">
                  {aiResult.error}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Risk score + verdict */}
                  <div className="rounded-xl border overflow-hidden"
                    style={{ borderColor: (aiResult.network_risk_score ?? 0) >= 80 ? '#EF444440' : (aiResult.network_risk_score ?? 0) >= 60 ? '#F59E0B40' : '#3B82F640' }}>
                    <div className="flex items-center justify-between px-4 py-3"
                      style={{ background: (aiResult.network_risk_score ?? 0) >= 80 ? 'linear-gradient(90deg,#EF444422,#EF444408)' : (aiResult.network_risk_score ?? 0) >= 60 ? 'linear-gradient(90deg,#F59E0B22,#F59E0B08)' : 'linear-gradient(90deg,#3B82F622,#3B82F608)' }}>
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Оценка риска сети</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: (aiResult.network_risk_score ?? 0) >= 80 ? '#EF444425' : (aiResult.network_risk_score ?? 0) >= 60 ? '#F59E0B25' : '#3B82F625', color: (aiResult.network_risk_score ?? 0) >= 80 ? '#F87171' : (aiResult.network_risk_score ?? 0) >= 60 ? '#FCD34D' : '#60A5FA' }}>
                          {(aiResult.network_risk_score ?? 0) >= 80 ? 'КРИТИЧЕСКИЙ' : (aiResult.network_risk_score ?? 0) >= 60 ? 'ВЫСОКИЙ' : (aiResult.network_risk_score ?? 0) >= 40 ? 'СРЕДНИЙ' : 'НИЗКИЙ'}
                        </span>
                        <div className={`text-3xl font-black ${
                          (aiResult.network_risk_score ?? 0) >= 80 ? 'text-red-400'
                          : (aiResult.network_risk_score ?? 0) >= 60 ? 'text-yellow-400'
                          : 'text-green-400'}`}>
                          {aiResult.network_risk_score}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Assessment — colored sentence breakdown */}
                  {aiResult.risk_assessment && (
                  <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-yellow-400" /> Оценка
                    </h3>
                    <div className="space-y-1.5">
                      {aiResult.risk_assessment.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 8).map((s, i) => {
                        const isRed = /хищен|откат|незакон|мошен|фиктив|подозрит|схем/i.test(s)
                        const isGreen = /легал|официальн|соответств/i.test(s)
                        const isYellow = /требует|проверить|уточнить|необходимо|особого внимания/i.test(s)
                        const parts = s.split(/(₸[\d,]+(?:\.\d+)?(?:\s*(?:млн|млрд|тыс))?)/g)
                        return (
                          <div key={i} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                            isRed ? 'bg-red-500/8 border border-red-500/20 text-red-300'
                            : isGreen ? 'bg-green-500/8 border border-green-500/20 text-green-300'
                            : isYellow ? 'bg-yellow-500/8 border border-yellow-500/20 text-yellow-300'
                            : 'text-gray-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${isRed ? 'bg-red-400' : isGreen ? 'bg-green-400' : isYellow ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                            <span className="leading-snug">{parts.map((part, j) =>
                              part.startsWith('₸')
                                ? <span key={j} className="font-bold text-orange-300 bg-orange-400/15 rounded px-1 mx-0.5 whitespace-nowrap">{part}</span>
                                : <span key={j}>{part}</span>
                            )}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  )}

                  {/* Suspicious patterns */}
                  {aiResult.suspicious_patterns && aiResult.suspicious_patterns.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-400" /> Обнаруженные схемы
                      </h3>
                      <div className="space-y-2">
                        {aiResult.suspicious_patterns.map((p, i) => {
                          const patternLabels: Record<string, string> = {
                            KICKBACK_CHAIN: 'Откатная цепочка', SHELL_COMPANY: 'Компании-однодневки',
                            OFFSHORE_LAYERING: 'Офшорное расслоение', CIRCULAR_TRANSACTIONS: 'Кольцевые транзакции',
                            FAKE_CONTRACTS: 'Фиктивные контракты', MONEY_LAUNDERING: 'Отмывание денег',
                            CASH_OUT: 'Схема обналичивания', CONFLICT_OF_INTEREST: 'Конфликт интересов',
                            SUSPICIOUS_FLIGHTS: 'Подозрительные перелёты',
                          }
                          const sev = p.severity?.toUpperCase()
                          const isCrit = sev === 'CRITICAL'
                          const isHigh = sev === 'HIGH'
                          const amt = p.estimated_risk_amount && p.estimated_risk_amount > 0 ? p.estimated_risk_amount : null
                          return (
                            <div key={i} className={`p-3 rounded-xl border ${
                              isCrit ? 'bg-red-900/20 border-red-500/30' : isHigh ? 'bg-orange-900/15 border-orange-500/25' : 'bg-white/4 border-white/10'}`}>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="font-bold text-white text-xs leading-tight">{patternLabels[p.pattern_type] ?? p.pattern_type}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                  isCrit ? 'bg-red-500/20 text-red-400' : isHigh ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>{sev}</span>
                              </div>
                              <div className="text-[11px] text-gray-400 mb-1.5 leading-snug">{p.description}</div>
                              {amt && (
                                <div className="text-[10px] font-bold text-orange-400 mb-1.5">
                                  ₸{amt >= 1e9 ? `${(amt/1e9).toFixed(1)} млрд` : `${(amt/1e6).toFixed(0)} млн`} под риском
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {p.involved_entities.map((entId: string, ei: number) => {
                                  const entNode = graphData?.nodes.find(n => n.id === entId || n.name === entId)
                                  const entType = entNode?.type ?? 'company'
                                  const entColor = ({government:'#3B82F6',company:'#22C55E',intermediary:'#F59E0B',offshore:'#EF4444',individual:'#EC4899'} as Record<string,string>)[entType] ?? '#64748B'
                                  return (
                                    <div key={ei} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                                      style={{ backgroundColor: entColor + '20', border: `1px solid ${entColor}40`, color: entColor }}>
                                      {entType === 'individual' ? <User className="w-2.5 h-2.5 flex-shrink-0" /> : <Building2 className="w-2.5 h-2.5 flex-shrink-0" />}
                                      <span className="truncate max-w-[110px]">{entNode?.name ?? entId}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Key findings */}
                  {aiResult.key_findings && aiResult.key_findings.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3 text-purple-400" /> Ключевые находки
                      </h3>
                      <ul className="space-y-1.5">
                        {aiResult.key_findings.map((f: string, i: number) => {
                          const isRed = /хищен|откат|незакон|мошен|фиктив|разниц.*%/i.test(f)
                          const isYellow = /требует|проверить|уточнить|зафиксировано/i.test(f)
                          const parts = f.split(/(₸[\d,]+(?:\.\d+)?(?:\s*(?:млн|млрд))?(?:\s*\([^)]*\))?)/g)
                          return (
                            <li key={i} className={`flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                              isRed ? 'bg-red-500/8 border border-red-500/15 text-red-300'
                              : isYellow ? 'bg-yellow-500/8 border border-yellow-500/15 text-yellow-300'
                              : 'text-gray-300'
                            }`}>
                              <ChevronRight className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isRed ? 'text-red-400' : isYellow ? 'text-yellow-400' : 'text-purple-400'}`} />
                              <span className="leading-snug">
                                {parts.map((part, j) =>
                                  part.startsWith('₸')
                                    ? <span key={j} className="font-bold text-orange-300 bg-orange-400/15 rounded px-1 mx-0.5 whitespace-nowrap">{part}</span>
                                    : <span key={j}>{part}</span>
                                )}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Recommended investigations */}
                  {aiResult.recommended_investigations && aiResult.recommended_investigations.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-blue-400" /> Рекомендации
                      </h3>
                      <ul className="space-y-1.5">
                        {aiResult.recommended_investigations.map((r, i) => (
                          <li key={i} className="text-xs text-gray-300 flex items-start gap-2 px-2.5 py-1.5 bg-blue-500/6 border border-blue-500/15 rounded-lg">
                            <span className="w-4 h-4 bg-blue-500/20 text-blue-400 text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            <span className="leading-snug">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
