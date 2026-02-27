"""
Tender analysis and listing endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from datetime import datetime
import time

from app.database import get_db
from app.models import Tender, RiskFlag
from app.schemas import (
    TenderAnalyzeRequest, TenderDetailResponse, TenderListResponse,
    AnalysisResult, RiskFlagResponse, PaginatedResponse
)
from app.analyzer import risk_analyzer

router = APIRouter(prefix="/api/v1", tags=["Tenders"])


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_tender(
    request: TenderAnalyzeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Analyze a tender for corruption risk.
    Accepts either raw text or a tender_id to look up.
    """
    start_time = time.time()

    text = request.text or ""
    title = request.title or ""

    # If tender_id provided, look it up in DB
    if request.tender_id and not text:
        result = await db.execute(
            select(Tender).where(Tender.tender_id == request.tender_id)
        )
        tender = result.scalar_one_or_none()
        if tender:
            text = tender.full_text or tender.description or ""
            title = tender.title or ""
        else:
            raise HTTPException(status_code=404, detail="Tender not found")

    if not text and not title:
        raise HTTPException(status_code=400, detail="Provide text or tender_id")

    # Run analysis
    analysis = risk_analyzer.analyze(
        text=text,
        title=title,
        amount=request.amount or 0,
        delivery_days=request.delivery_days or 0,
        participant_count=0,
        region=request.region or "",
        oked_code=request.oked_code or "",
        customer_name=request.customer_name or "",
    )

    processing_time = int((time.time() - start_time) * 1000)

    # If we have a tender_id, update the record
    if request.tender_id:
        result = await db.execute(
            select(Tender).where(Tender.tender_id == request.tender_id)
        )
        tender = result.scalar_one_or_none()
        if tender:
            tender.risk_score = analysis["risk_score"]
            tender.risk_level = analysis["risk_level"]
            tender.confidence = analysis["confidence"]
            tender.recommendation = analysis["recommendation"]
            tender.analyzed_at = datetime.utcnow()
            tender.is_analyzed = True

            # Clear old flags and add new ones
            await db.execute(
                select(RiskFlag).where(RiskFlag.tender_id == tender.id)
            )
            for flag_data in analysis["triggered_flags"]:
                flag = RiskFlag(
                    tender_id=tender.id,
                    flag_type=flag_data["flag_type"],
                    description=flag_data["description"],
                    severity=flag_data["severity"],
                    evidence=flag_data.get("evidence", ""),
                    score_contribution=flag_data["score_contribution"],
                )
                db.add(flag)

            await db.commit()

    return AnalysisResult(
        tender_id=request.tender_id or "manual-input",
        risk_score=analysis["risk_score"],
        risk_level=analysis["risk_level"],
        triggered_flags=[
            RiskFlagResponse(**f) for f in analysis["triggered_flags"]
        ],
        recommendation=analysis["recommendation"],
        similar_corrupt_cases=analysis["similar_corrupt_cases"],
        confidence=analysis["confidence"],
        processing_time_ms=processing_time,
    )


@router.get("/tenders", response_model=PaginatedResponse)
async def list_tenders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    risk_level: Optional[str] = None,
    region: Optional[str] = None,
    oked_code: Optional[str] = None,
    customer: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("risk_score", regex="^(risk_score|amount|publication_date)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db)
):
    """Get paginated list of analyzed tenders with filters."""
    query = select(Tender)

    # Filters
    if risk_level:
        query = query.where(Tender.risk_level == risk_level.upper())
    if region:
        query = query.where(Tender.region == region)
    if oked_code:
        query = query.where(Tender.oked_code == oked_code)
    if customer:
        query = query.where(Tender.customer_name.contains(customer))
    if search:
        query = query.where(
            Tender.title.contains(search) | Tender.description.contains(search)
        )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Sorting
    sort_column = getattr(Tender, sort_by)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    tenders = result.scalars().all()

    items = [
        TenderListResponse(
            id=t.id,
            tender_id=t.tender_id,
            title=t.title,
            customer_name=t.customer_name,
            amount=t.amount,
            region=t.region,
            risk_score=t.risk_score or 0,
            risk_level=t.risk_level or "LOW",
            participant_count=t.participant_count or 0,
            publication_date=t.publication_date,
            is_analyzed=t.is_analyzed or False,
        )
        for t in tenders
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, -(-total // page_size)),
    )


@router.get("/tenders/{tender_id}", response_model=TenderDetailResponse)
async def get_tender(tender_id: str, db: AsyncSession = Depends(get_db)):
    """Get full tender details with risk analysis."""
    result = await db.execute(
        select(Tender).where(Tender.tender_id == tender_id)
    )
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    # Get flags
    flags_result = await db.execute(
        select(RiskFlag).where(RiskFlag.tender_id == tender.id)
    )
    flags = flags_result.scalars().all()

    return TenderDetailResponse(
        id=tender.id,
        tender_id=tender.tender_id,
        title=tender.title,
        description=tender.description,
        full_text=tender.full_text,
        customer_name=tender.customer_name,
        customer_tin=tender.customer_tin,
        winner_name=tender.winner_name,
        winner_tin=tender.winner_tin,
        amount=tender.amount,
        currency=tender.currency or "KZT",
        region=tender.region,
        oked_code=tender.oked_code,
        category=tender.category,
        publication_date=tender.publication_date,
        deadline_date=tender.deadline_date,
        delivery_days=tender.delivery_days,
        participant_count=tender.participant_count or 0,
        status=tender.status,
        risk_score=tender.risk_score or 0,
        risk_level=tender.risk_level or "LOW",
        confidence=tender.confidence or 0,
        recommendation=tender.recommendation,
        analyzed_at=tender.analyzed_at,
        is_analyzed=tender.is_analyzed or False,
        flags=[
            RiskFlagResponse(
                flag_type=f.flag_type,
                description=f.description,
                severity=f.severity,
                evidence=f.evidence,
                score_contribution=f.score_contribution,
            )
            for f in flags
        ],
    )
