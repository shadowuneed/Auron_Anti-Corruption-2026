"""
Dashboard statistics and analytics endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, desc
from typing import List

from app.database import get_db
from app.models import Tender, RiskFlag, Customer
from app.schemas import DashboardStats, CustomerProfile, TenderListResponse

router = APIRouter(prefix="/api/v1", tags=["Dashboard"])


@router.get("/stats/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Aggregate statistics for the main dashboard."""

    # Total tenders
    total_result = await db.execute(select(func.count(Tender.id)))
    total_tenders = total_result.scalar() or 0

    # Analyzed tenders
    analyzed_result = await db.execute(
        select(func.count(Tender.id)).where(Tender.is_analyzed == True)
    )
    analyzed_tenders = analyzed_result.scalar() or 0

    # Risk distribution
    risk_dist = {}
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        r = await db.execute(
            select(func.count(Tender.id)).where(Tender.risk_level == level)
        )
        risk_dist[level] = r.scalar() or 0

    high_risk_count = risk_dist.get("HIGH", 0)
    critical_count = risk_dist.get("CRITICAL", 0)

    # Total value at risk (HIGH + CRITICAL tenders)
    vr = await db.execute(
        select(func.coalesce(func.sum(Tender.amount), 0)).where(
            Tender.risk_level.in_(["HIGH", "CRITICAL"])
        )
    )
    total_value_at_risk = vr.scalar() or 0

    # Average risk score
    avg_result = await db.execute(
        select(func.coalesce(func.avg(Tender.risk_score), 0))
    )
    avg_risk_score = round(avg_result.scalar() or 0, 1)

    # Single-bid rate
    single_bid = await db.execute(
        select(func.count(Tender.id)).where(Tender.participant_count == 1)
    )
    single_bid_count = single_bid.scalar() or 0
    single_bid_rate = round(
        (single_bid_count / max(1, total_tenders)) * 100, 1
    )

    # Top risky regions
    region_query = await db.execute(
        select(
            Tender.region,
            func.count(Tender.id).label("count"),
            func.coalesce(func.avg(Tender.risk_score), 0).label("avg_score"),
            func.coalesce(func.sum(Tender.amount), 0).label("total_amount"),
        )
        .where(Tender.region.isnot(None))
        .group_by(Tender.region)
        .order_by(desc("avg_score"))
        .limit(10)
    )
    top_risky_regions = [
        {
            "region": row[0],
            "count": row[1],
            "avg_score": round(row[2], 1),
            "total_amount": row[3],
        }
        for row in region_query.all()
    ]

    # Top risky customers
    customer_query = await db.execute(
        select(
            Tender.customer_name,
            Tender.customer_tin,
            func.count(Tender.id).label("count"),
            func.coalesce(func.avg(Tender.risk_score), 0).label("avg_score"),
            func.coalesce(func.sum(Tender.amount), 0).label("total_amount"),
        )
        .where(Tender.customer_name.isnot(None))
        .group_by(Tender.customer_name, Tender.customer_tin)
        .order_by(desc("avg_score"))
        .limit(10)
    )
    top_risky_customers = [
        {
            "name": row[0],
            "tin": row[1],
            "count": row[2],
            "avg_score": round(row[3], 1),
            "total_amount": row[4],
        }
        for row in customer_query.all()
    ]

    # Monthly trends (group by month)
    monthly_query = await db.execute(
        select(
            func.strftime("%Y-%m", Tender.publication_date).label("month"),
            func.count(Tender.id).label("count"),
            func.coalesce(func.avg(Tender.risk_score), 0).label("avg_score"),
            func.count(case((Tender.risk_level.in_(["HIGH", "CRITICAL"]), 1))).label("high_risk"),
        )
        .where(Tender.publication_date.isnot(None))
        .group_by("month")
        .order_by("month")
    )
    monthly_trends = [
        {
            "month": row[0],
            "count": row[1],
            "avg_score": round(row[2], 1),
            "high_risk": row[3],
        }
        for row in monthly_query.all()
    ]

    # Common flag types
    flag_query = await db.execute(
        select(
            RiskFlag.flag_type,
            func.count(RiskFlag.id).label("count"),
        )
        .group_by(RiskFlag.flag_type)
        .order_by(desc("count"))
    )
    common_flags = [
        {"flag_type": row[0], "count": row[1]}
        for row in flag_query.all()
    ]

    return DashboardStats(
        total_tenders=total_tenders,
        analyzed_tenders=analyzed_tenders,
        high_risk_count=high_risk_count,
        critical_count=critical_count,
        total_value_at_risk=total_value_at_risk,
        avg_risk_score=avg_risk_score,
        single_bid_rate=single_bid_rate,
        risk_distribution=risk_dist,
        top_risky_regions=top_risky_regions,
        top_risky_customers=top_risky_customers,
        monthly_trends=monthly_trends,
        common_flags=common_flags,
    )


@router.get("/customers/{tin}/risk-profile", response_model=CustomerProfile)
async def get_customer_profile(tin: str, db: AsyncSession = Depends(get_db)):
    """Risk profile for a specific government customer."""

    # Get all tenders for this customer
    result = await db.execute(
        select(Tender)
        .where(Tender.customer_tin == tin)
        .order_by(desc(Tender.risk_score))
    )
    tenders = result.scalars().all()

    if not tenders:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Customer not found")

    first = tenders[0]
    total = len(tenders)
    high_risk = sum(1 for t in tenders if t.risk_level in ["HIGH", "CRITICAL"])
    avg_score = sum(t.risk_score or 0 for t in tenders) / max(1, total)
    single_bids = sum(1 for t in tenders if t.participant_count == 1)
    total_amount = sum(t.amount or 0 for t in tenders)

    # Count repeat winners
    winner_counts = {}
    for t in tenders:
        if t.winner_tin:
            winner_counts[t.winner_tin] = winner_counts.get(t.winner_tin, 0) + 1
    repeat_winners = sum(1 for c in winner_counts.values() if c >= 3)

    tender_items = [
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
        for t in tenders[:50]  # Limit to 50
    ]

    return CustomerProfile(
        tin=tin,
        name=first.customer_name or "Unknown",
        region=first.region,
        total_tenders=total,
        high_risk_tenders=high_risk,
        avg_risk_score=round(avg_score, 1),
        single_bid_rate=round((single_bids / max(1, total)) * 100, 1),
        repeat_winner_count=repeat_winners,
        total_amount=total_amount,
        tenders=tender_items,
    )
