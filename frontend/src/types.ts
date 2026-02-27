export interface RiskFlag {
  flag_type: string
  description: string
  severity: string
  evidence?: string
  score_contribution: number
}

export interface TenderListItem {
  id: number
  tender_id: string
  title: string
  customer_name?: string
  amount?: number
  region?: string
  risk_score: number
  risk_level: string
  participant_count: number
  publication_date?: string
  is_analyzed: boolean
}

export interface TenderDetail extends TenderListItem {
  description?: string
  full_text?: string
  customer_tin?: string
  winner_name?: string
  winner_tin?: string
  currency: string
  oked_code?: string
  category?: string
  deadline_date?: string
  delivery_days?: number
  status?: string
  confidence: number
  recommendation?: string
  analyzed_at?: string
  flags: RiskFlag[]
}

export interface AnalysisResult {
  tender_id: string
  risk_score: number
  risk_level: string
  triggered_flags: RiskFlag[]
  recommendation: string
  similar_corrupt_cases: string[]
  confidence: number
  processing_time_ms: number
}

export interface AnalyzeRequest {
  text?: string
  tender_id?: string
  title?: string
  customer_name?: string
  amount?: number
  region?: string
  oked_code?: string
  delivery_days?: number
}

export interface DashboardStats {
  total_tenders: number
  analyzed_tenders: number
  high_risk_count: number
  critical_count: number
  total_value_at_risk: number
  avg_risk_score: number
  single_bid_rate: number
  risk_distribution: Record<string, number>
  top_risky_regions: Array<{
    region: string
    count: number
    avg_score: number
    total_amount: number
  }>
  top_risky_customers: Array<{
    name: string
    tin: string
    count: number
    avg_score: number
    total_amount: number
  }>
  monthly_trends: Array<{
    month: string
    count: number
    avg_score: number
    high_risk: number
  }>
  common_flags: Array<{
    flag_type: string
    count: number
  }>
}

export interface CustomerProfile {
  tin: string
  name: string
  region?: string
  total_tenders: number
  high_risk_tenders: number
  avg_risk_score: number
  single_bid_rate: number
  repeat_winner_count: number
  total_amount: number
  tenders: TenderListItem[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============= Network Graph Types =============

export interface NetworkNode {
  id: string
  name: string
  type: 'government' | 'company' | 'intermediary' | 'offshore' | 'individual'
  region: string
  country: string
  lat: number
  lng: number
  risk_score: number
  total_inflow: number
  total_outflow: number
  transaction_count: number
  is_suspicious: boolean
  ceo_name?: string
  ceo_iin?: string
  bin_number?: string
  founded_year?: number
  employee_count?: number
  suspicion_summary?: string
  tender_won_amount?: number
  actual_spent_amount?: number
  // D3 simulation fields
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  vx?: number
  vy?: number
}

export interface NetworkEdge {
  id: string
  source: string | NetworkNode
  target: string | NetworkNode
  amount: number
  currency: string
  flow_date: string | null
  description: string
  tender_id: string | null
  is_suspicious: boolean
  risk_score: number
  flow_type: string
  document_id?: number
  document?: FlowDocument
}

export interface FlowDocument {
  doc_id: string
  title: string
  contract_amount: number
  actual_paid: number
  discrepancy_percent: number
  contract_number: string
  customer_name: string
  contractor_name: string
  is_suspicious: boolean
}

export interface NetworkGraphData {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  stats: {
    total_nodes: number
    total_edges: number
    suspicious_nodes: number
    suspicious_edges: number
    total_flow_amount: number
  }
}

export interface EntityDetail {
  entity: NetworkNode
  outgoing_flows: Array<{
    id: string
    target: string
    target_name: string
    amount: number
    flow_date: string | null
    description: string
    flow_type: string
    is_suspicious: boolean
    risk_score: number
  }>
  incoming_flows: Array<{
    id: string
    source: string
    source_name: string
    amount: number
    flow_date: string | null
    description: string
    flow_type: string
    is_suspicious: boolean
    risk_score: number
  }>
  connected_entities: Array<{
    id: string
    name: string
    type: string
    region: string
    risk_score: number
    is_suspicious: boolean
  }>
}

export interface GeoFlow {
  id: string
  source: {
    id: string
    name: string
    lat: number
    lng: number
    type: string
    country: string
  }
  target: {
    id: string
    name: string
    lat: number
    lng: number
    type: string
    country: string
  }
  amount: number
  flow_type: string
  is_suspicious: boolean
  risk_score: number
  flow_date: string | null
  document_id?: number
  description?: string
}

export interface MapFlowData {
  flows: GeoFlow[]
  locations: Array<{
    id: string
    name: string
    type: string
    lat: number
    lng: number
    country: string
    risk_score: number
    total_inflow: number
    total_outflow: number
    is_suspicious: boolean
  }>
}

export interface TimelineEntry {
  month: string
  count: number
  total_amount: number
  suspicious_count: number
  suspicious_amount: number
}

export interface NetworkStats {
  total_entities: number
  total_flows: number
  suspicious_entities: number
  suspicious_flows: number
  total_flow_amount: number
  suspicious_flow_amount: number
  entity_type_distribution: Record<string, number>
  flow_type_distribution: Record<string, number>
}

export interface GeminiAnalysisResult {
  risk_score?: number
  risk_level?: string
  summary?: string
  flags?: Array<{
    type: string
    severity: string
    description: string
    evidence: string
  }>
  recommendations?: string[]
  suspicious_entities?: string[]
  money_flow_risk?: string
  error?: string
}

export interface NetworkAIAnalysis {
  risk_assessment?: string
  suspicious_patterns?: Array<{
    pattern_type: string
    description: string
    involved_entities: string[]
    estimated_risk_amount: number
    severity: string
  }>
  key_findings?: string[]
  recommended_investigations?: string[]
  network_risk_score?: number
  error?: string
}

// ============= Contract Document Types =============

export interface ContractDocument {
  id: number
  doc_id: string
  contract_number: string
  title: string
  document_type: string
  customer_name: string
  customer_bin: string
  contractor_name: string
  contractor_bin: string
  contract_amount: number
  actual_paid: number
  budget_code: string
  goszakup_url: string
  goszakup_lot_id: string
  signed_date: string | null
  start_date: string | null
  end_date: string | null
  delivery_address: string
  region: string
  status: string
  description: string
  risk_notes: string
  is_suspicious: boolean
  discrepancy_percent: number
  metadata_json: string
  created_at: string | null
  updated_at: string | null
}

export interface SuspiciousSchemeTarget {
  entity_id: string
  name: string
  amount: number
  flow_type: string
}

export interface SuspiciousSchemeDoc {
  id: number
  doc_id: string
  title: string
  contract_amount: number
  actual_paid: number
  discrepancy_percent: number
}

export interface SuspiciousScheme {
  source_id: string
  source_name: string
  source_type: string
  total_suspicious_amount: number
  flow_count: number
  max_risk_score: number
  targets: SuspiciousSchemeTarget[]
  documents: SuspiciousSchemeDoc[]
}

export interface SuspiciousSchemesResponse {
  schemes: SuspiciousScheme[]
  summary: {
    total_suspicious_flows: number
    total_suspicious_amount: number
    avg_discrepancy_percent: number
    scheme_count: number
  }
}

export interface AdminPaginatedResponse<T> {
  total: number
  page: number
  per_page: number
  items: T[]
}
