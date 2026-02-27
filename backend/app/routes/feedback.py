"""
Feedback endpoints for analyst corrections
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Tender, Feedback
from app.schemas import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/api/v1", tags=["Feedback"])


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    request: FeedbackRequest,
    db: AsyncSession = Depends(get_db)
):
    """Submit analyst feedback on AI prediction accuracy."""
    result = await db.execute(
        select(Tender).where(Tender.tender_id == request.tender_id)
    )
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    feedback = Feedback(
        tender_id=tender.id,
        analyst_name=request.analyst_name,
        is_correct=request.is_correct,
        comment=request.comment,
        suggested_risk_level=request.suggested_risk_level,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return FeedbackResponse(
        id=feedback.id,
        tender_id=feedback.tender_id,
        analyst_name=feedback.analyst_name,
        is_correct=feedback.is_correct,
        comment=feedback.comment,
        suggested_risk_level=feedback.suggested_risk_level,
        created_at=feedback.created_at,
    )
