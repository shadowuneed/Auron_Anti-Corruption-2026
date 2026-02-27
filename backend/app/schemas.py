"""
Pydantic schemas for API request/response validation
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# ============= Risk Flag Schemas =============

class RiskFlagResponse(BaseModel):
    flag_type: str
    description: str
    severity: str
    evidence: Optional[str] = None
    score_contribution: float = 0.0

    class Config:
        from_attributes = True


# ============= Tender Schemas =============

class TenderAnalyzeRequest(BaseModel):
    text: Optional[str] = None
    tender_id: Optional[str] = None
    title: Optional[str] = Field(None, max_length=500)
    customer_name: Optional[str] = None
    amount: Optional[float] = None
    region: Optional[str] = None
    oked_code: Optional[str] = None
    delivery_days: Optional[int] = None


class TenderListResponse(BaseModel):
    id: int
    tender_id: str
    title: str
    customer_name: Optional[str]
    amount: Optional[float]
    region: Optional[str]
    risk_score: float
    risk_level: str
    participant_count: int
    publication_date: Optional[datetime]
    is_analyzed: bool

    class Config:
        from_attributes = True


class TenderDetailResponse(BaseModel):
    id: int
    tender_id: str
    title: str
    description: Optional[str]
    full_text: Optional[str]
    customer_name: Optional[str]
    customer_tin: Optional[str]
    winner_name: Optional[str]
    winner_tin: Optional[str]
    amount: Optional[float]
    currency: str = "KZT"
    region: Optional[str]
    oked_code: Optional[str]
    category: Optional[str]
    publication_date: Optional[datetime]
    deadline_date: Optional[datetime]
    delivery_days: Optional[int]
    participant_count: int
    status: Optional[str]
    risk_score: float
    risk_level: str
    confidence: float
    recommendation: Optional[str]
    analyzed_at: Optional[datetime]
    is_analyzed: bool
    flags: List[RiskFlagResponse] = []

    class Config:
        from_attributes = True


class AnalysisResult(BaseModel):
    tender_id: str
    risk_score: float = Field(ge=0, le=100)
    risk_level: str
    triggered_flags: List[RiskFlagResponse]
    recommendation: str
    similar_corrupt_cases: List[str] = []
    confidence: float = Field(ge=0, le=1)
    processing_time_ms: int


# ============= Dashboard Schemas =============

class DashboardStats(BaseModel):
    total_tenders: int
    analyzed_tenders: int
    high_risk_count: int
    critical_count: int
    total_value_at_risk: float
    avg_risk_score: float
    single_bid_rate: float
    risk_distribution: dict  # {"LOW": n, "MEDIUM": n, "HIGH": n, "CRITICAL": n}
    top_risky_regions: List[dict]
    top_risky_customers: List[dict]
    monthly_trends: List[dict]
    common_flags: List[dict]


# ============= Customer Schemas =============

class CustomerProfile(BaseModel):
    tin: str
    name: str
    region: Optional[str]
    total_tenders: int
    high_risk_tenders: int
    avg_risk_score: float
    single_bid_rate: float
    repeat_winner_count: int
    total_amount: float
    tenders: List[TenderListResponse] = []

    class Config:
        from_attributes = True


# ============= Feedback Schemas =============

class FeedbackRequest(BaseModel):
    tender_id: str
    analyst_name: Optional[str] = None
    is_correct: bool
    comment: Optional[str] = None
    suggested_risk_level: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    tender_id: int
    analyst_name: Optional[str]
    is_correct: bool
    comment: Optional[str]
    suggested_risk_level: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ============= Pagination =============

class PaginatedResponse(BaseModel):
    items: List
    total: int
    page: int
    page_size: int
    total_pages: int
