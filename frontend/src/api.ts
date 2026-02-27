import axios from 'axios'
import type {
  AnalyzeRequest,
  AnalysisResult,
  DashboardStats,
  TenderDetail,
  TenderListItem,
  CustomerProfile,
  PaginatedResponse,
  NetworkGraphData,
  EntityDetail,
  MapFlowData,
  TimelineEntry,
  NetworkStats,
  GeminiAnalysisResult,
  NetworkAIAnalysis,
  ContractDocument,
  SuspiciousSchemesResponse,
  AdminPaginatedResponse,
} from './types'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

export const analyzeTender = async (data: AnalyzeRequest): Promise<AnalysisResult> => {
  const res = await api.post('/analyze', data)
  return res.data
}

export const getTenders = async (params: {
  page?: number
  page_size?: number
  risk_level?: string
  region?: string
  search?: string
  sort_by?: string
  sort_order?: string
}): Promise<PaginatedResponse<TenderListItem>> => {
  const res = await api.get('/tenders', { params })
  return res.data
}

export const getTenderDetail = async (tenderId: string): Promise<TenderDetail> => {
  const res = await api.get(`/tenders/${tenderId}`)
  return res.data
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const res = await api.get('/stats/dashboard')
  return res.data
}

export const getCustomerProfile = async (tin: string): Promise<CustomerProfile> => {
  const res = await api.get(`/customers/${tin}/risk-profile`)
  return res.data
}

export const submitFeedback = async (data: {
  tender_id: string
  is_correct: boolean
  comment?: string
  analyst_name?: string
  suggested_risk_level?: string
}) => {
  const res = await api.post('/feedback', data)
  return res.data
}

// ============= Network Graph API =============

export const getNetworkGraph = async (params?: {
  entity_type?: string
  min_risk?: number
  region?: string
}): Promise<NetworkGraphData> => {
  const res = await api.get('/network/graph', { params })
  return res.data
}

export const getEntityDetail = async (entityId: string): Promise<EntityDetail> => {
  const res = await api.get(`/network/entity/${entityId}`)
  return res.data
}

export const getMapFlows = async (): Promise<MapFlowData> => {
  const res = await api.get('/network/map-flows')
  return res.data
}

export const getFlowTimeline = async (): Promise<{ timeline: TimelineEntry[] }> => {
  const res = await api.get('/network/flows/timeline')
  return res.data
}

export const getNetworkStats = async (): Promise<NetworkStats> => {
  const res = await api.get('/network/stats')
  return res.data
}

// ============= AI Analysis API =============

export const aiAnalyzeTender = async (data: {
  text?: string
  tender_id?: string
  language?: string
  metadata?: Record<string, unknown>
}): Promise<GeminiAnalysisResult> => {
  const res = await api.post('/ai/analyze-tender', data)
  return res.data
}

export const aiAnalyzeNetwork = async (data: {
  entity_ids?: string[]
  language?: string
}): Promise<NetworkAIAnalysis> => {
  const res = await api.post('/ai/analyze-network', data)
  return res.data
}

// ============= Admin / Documents API =============

const adminApi = axios.create({
  baseURL: '/api/v1/admin',
  headers: { 'Content-Type': 'application/json' },
})

export const getDocuments = async (params?: {
  page?: number
  per_page?: number
  search?: string
  suspicious_only?: boolean
  doc_type?: string
}): Promise<AdminPaginatedResponse<ContractDocument>> => {
  const res = await adminApi.get('/documents', { params })
  return res.data
}

export const getDocument = async (id: number): Promise<ContractDocument> => {
  const res = await adminApi.get(`/documents/${id}`)
  return res.data
}

export const getDocumentByDocId = async (docId: string): Promise<ContractDocument> => {
  const res = await adminApi.get(`/documents/by-doc-id/${docId}`)
  return res.data
}

export const createDocument = async (data: Partial<ContractDocument>): Promise<ContractDocument> => {
  const res = await adminApi.post('/documents', data)
  return res.data
}

export const updateDocument = async (id: number, data: Partial<ContractDocument>): Promise<ContractDocument> => {
  const res = await adminApi.put(`/documents/${id}`, data)
  return res.data
}

export const deleteDocument = async (id: number): Promise<void> => {
  await adminApi.delete(`/documents/${id}`)
}

export const getSuspiciousSchemes = async (): Promise<SuspiciousSchemesResponse> => {
  const res = await adminApi.get('/suspicious-schemes')
  return res.data
}

export const getAdminEntities = async (params?: {
  page?: number
  per_page?: number
  search?: string
  entity_type?: string
}): Promise<AdminPaginatedResponse<Record<string, unknown>>> => {
  const res = await adminApi.get('/entities', { params })
  return res.data
}

export const getAdminFlows = async (params?: {
  page?: number
  per_page?: number
  suspicious_only?: boolean
  source_id?: string
  target_id?: string
}): Promise<AdminPaginatedResponse<Record<string, unknown>>> => {
  const res = await adminApi.get('/flows', { params })
  return res.data
}
