"""
SQLAlchemy ORM Models for TechnoFilter
"""

from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, Boolean,
    ForeignKey, JSON, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FlagType(str, enum.Enum):
    BRAND_LOCK = "BRAND_LOCK"
    TIMELINE = "TIMELINE"
    CERTIFICATION = "CERTIFICATION"
    FINANCIAL = "FINANCIAL"
    REPEAT_WINNER = "REPEAT_WINNER"
    SINGLE_BID = "SINGLE_BID"
    LINGUISTIC = "LINGUISTIC"


class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tender_id = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    full_text = Column(Text)
    customer_name = Column(String(300))
    customer_tin = Column(String(20), index=True)
    winner_name = Column(String(300))
    winner_tin = Column(String(20))
    amount = Column(Float)
    currency = Column(String(10), default="KZT")
    region = Column(String(100))
    oked_code = Column(String(20))
    category = Column(String(200))
    publication_date = Column(DateTime)
    deadline_date = Column(DateTime)
    delivery_days = Column(Integer)
    participant_count = Column(Integer, default=0)
    status = Column(String(50))

    # Risk analysis results
    risk_score = Column(Float, default=0.0)
    risk_level = Column(String(20), default="LOW")
    confidence = Column(Float, default=0.0)
    recommendation = Column(Text)
    analyzed_at = Column(DateTime)
    is_analyzed = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    flags = relationship("RiskFlag", back_populates="tender", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="tender", cascade="all, delete-orphan")


class RiskFlag(Base):
    __tablename__ = "risk_flags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    flag_type = Column(String(50), nullable=False)
    description = Column(Text)
    severity = Column(String(20))  # low, medium, high
    evidence = Column(Text)
    score_contribution = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)

    tender = relationship("Tender", back_populates="flags")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    analyst_name = Column(String(200))
    is_correct = Column(Boolean)
    comment = Column(Text)
    suggested_risk_level = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)

    tender = relationship("Tender", back_populates="feedbacks")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tin = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(300), nullable=False)
    region = Column(String(100))
    total_tenders = Column(Integer, default=0)
    high_risk_tenders = Column(Integer, default=0)
    avg_risk_score = Column(Float, default=0.0)
    single_bid_rate = Column(Float, default=0.0)
    repeat_winner_count = Column(Integer, default=0)
    total_amount = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tender_id = Column(String(100))
    analysis_type = Column(String(50))  # ml_prefilter, llm_deep, manual
    risk_score = Column(Float)
    risk_level = Column(String(20))
    processing_time_ms = Column(Integer)
    model_version = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)


# =============================================
# NETWORK GRAPH MODELS
# =============================================

class EntityType(str, enum.Enum):
    GOVERNMENT = "government"
    COMPANY = "company"
    INTERMEDIARY = "intermediary"
    INDIVIDUAL = "individual"
    OFFSHORE = "offshore"


class NetworkEntity(Base):
    """Node in the financial network graph"""
    __tablename__ = "network_entities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(300), nullable=False)
    entity_type = Column(String(50), nullable=False)  # government, company, intermediary, offshore
    region = Column(String(100))
    country = Column(String(100), default="Kazakhstan")
    lat = Column(Float)
    lng = Column(Float)
    bin_number = Column(String(30), default="")
    description = Column(String(500), default="")
    ceo_name = Column(String(200), default="")
    ceo_iin = Column(String(20), default="")
    founded_year = Column(Integer, default=0)
    employee_count = Column(Integer, default=0)
    suspicion_summary = Column(Text, default="")
    risk_score = Column(Float, default=0.0)
    total_inflow = Column(Float, default=0.0)
    total_outflow = Column(Float, default=0.0)
    transaction_count = Column(Integer, default=0)
    is_suspicious = Column(Boolean, default=False)
    tender_won_amount = Column(Float, default=0.0)
    actual_spent_amount = Column(Float, default=0.0)
    metadata_json = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    outgoing_flows = relationship("MoneyFlow", foreign_keys="MoneyFlow.source_id", back_populates="source_entity")
    incoming_flows = relationship("MoneyFlow", foreign_keys="MoneyFlow.target_id", back_populates="target_entity")


class MoneyFlow(Base):
    """Edge in the financial network — a money transfer between entities"""
    __tablename__ = "money_flows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flow_id = Column(String(50), unique=True, index=True, nullable=False)
    source_id = Column(Integer, ForeignKey("network_entities.id"), nullable=False)
    target_id = Column(Integer, ForeignKey("network_entities.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="KZT")
    flow_date = Column(DateTime)
    description = Column(String(500))
    tender_id = Column(String(100))  # Related tender if any
    document_id = Column(Integer, ForeignKey("contract_documents.id"), nullable=True)
    is_suspicious = Column(Boolean, default=False)
    risk_score = Column(Float, default=0.0)
    flow_type = Column(String(50))  # contract_payment, subcontract, consulting_fee, donation, unknown
    metadata_json = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    source_entity = relationship("NetworkEntity", foreign_keys=[source_id], back_populates="outgoing_flows")
    target_entity = relationship("NetworkEntity", foreign_keys=[target_id], back_populates="incoming_flows")
    document = relationship("ContractDocument", back_populates="flows")


class ContractDocument(Base):
    """Contract/document backing a money flow — goszakup, certificate, invoice, act"""
    __tablename__ = "contract_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_id = Column(String(50), unique=True, index=True, nullable=False)
    contract_number = Column(String(100), nullable=False)
    title = Column(String(500), nullable=False)
    document_type = Column(String(50), nullable=False)  # contract, certificate, invoice, act, supplement
    customer_name = Column(String(300))
    customer_bin = Column(String(20))
    contractor_name = Column(String(300))
    contractor_bin = Column(String(20))
    contract_amount = Column(Float, default=0.0)
    actual_paid = Column(Float, default=0.0)
    budget_code = Column(String(50))
    goszakup_url = Column(String(500))
    goszakup_lot_id = Column(String(100))
    signed_date = Column(DateTime)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    delivery_address = Column(String(500))
    region = Column(String(100))
    status = Column(String(50), default="active")  # active, completed, terminated, disputed
    description = Column(Text)
    risk_notes = Column(Text)
    is_suspicious = Column(Boolean, default=False)
    discrepancy_percent = Column(Float, default=0.0)  # difference between contract_amount and actual_paid %
    metadata_json = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    flows = relationship("MoneyFlow", back_populates="document")
