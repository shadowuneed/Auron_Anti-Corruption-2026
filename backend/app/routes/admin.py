"""
Admin CRUD routes for managing entities, flows, and contract documents.
"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from ..database import async_session
from ..models import NetworkEntity, MoneyFlow, ContractDocument

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# ── Pydantic Schemas ──────────────────────────────────────────

class DocumentCreate(BaseModel):
    doc_id: Optional[str] = None
    contract_number: str = ""
    title: str = ""
    document_type: str = "contract"
    customer_name: str = ""
    customer_bin: str = ""
    contractor_name: str = ""
    contractor_bin: str = ""
    contract_amount: float = 0.0
    actual_paid: float = 0.0
    budget_code: str = ""
    goszakup_url: str = ""
    goszakup_lot_id: str = ""
    signed_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    delivery_address: str = ""
    region: str = ""
    status: str = "active"
    description: str = ""
    risk_notes: str = ""
    is_suspicious: bool = False
    discrepancy_percent: float = 0.0
    metadata_json: str = ""


class DocumentUpdate(BaseModel):
    contract_number: Optional[str] = None
    title: Optional[str] = None
    document_type: Optional[str] = None
    customer_name: Optional[str] = None
    customer_bin: Optional[str] = None
    contractor_name: Optional[str] = None
    contractor_bin: Optional[str] = None
    contract_amount: Optional[float] = None
    actual_paid: Optional[float] = None
    budget_code: Optional[str] = None
    goszakup_url: Optional[str] = None
    goszakup_lot_id: Optional[str] = None
    signed_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    delivery_address: Optional[str] = None
    region: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    risk_notes: Optional[str] = None
    is_suspicious: Optional[bool] = None
    discrepancy_percent: Optional[float] = None
    metadata_json: Optional[str] = None


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    risk_score: Optional[float] = None
    is_suspicious: Optional[bool] = None
    description: Optional[str] = None
    bin_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FlowUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    flow_type: Optional[str] = None
    is_suspicious: Optional[bool] = None
    risk_score: Optional[float] = None
    document_id: Optional[int] = None


# ── Documents CRUD ────────────────────────────────────────────

@router.get("/documents")
async def list_documents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search in title, customer, contractor"),
    suspicious_only: bool = Query(False),
    doc_type: str = Query("", description="Filter by document_type"),
):
    async with async_session() as session:
        q = select(ContractDocument)

        if search:
            like = f"%{search}%"
            q = q.where(
                (ContractDocument.title.ilike(like)) |
                (ContractDocument.customer_name.ilike(like)) |
                (ContractDocument.contractor_name.ilike(like)) |
                (ContractDocument.contract_number.ilike(like)) |
                (ContractDocument.doc_id.ilike(like))
            )
        if suspicious_only:
            q = q.where(ContractDocument.is_suspicious == True)
        if doc_type:
            q = q.where(ContractDocument.document_type == doc_type)

        # Count
        count_q = select(func.count()).select_from(q.subquery())
        total = (await session.execute(count_q)).scalar() or 0

        # Paginate
        q = q.order_by(desc(ContractDocument.created_at)).offset((page - 1) * per_page).limit(per_page)
        result = await session.execute(q)
        docs = result.scalars().all()

        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "items": [_doc_to_dict(d) for d in docs],
        }


@router.get("/documents/{doc_id}")
async def get_document(doc_id: int):
    async with async_session() as session:
        doc = await session.get(ContractDocument, doc_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        return _doc_to_dict(doc)


@router.post("/documents", status_code=201)
async def create_document(data: DocumentCreate):
    async with async_session() as session:
        doc = ContractDocument(**data.model_dump())
        if not doc.doc_id:
            count = (await session.execute(select(func.count(ContractDocument.id)))).scalar() or 0
            doc.doc_id = f"DOC-{count + 1:04d}"
        if doc.contract_amount and doc.actual_paid:
            if doc.contract_amount > 0:
                doc.discrepancy_percent = round(
                    abs(doc.actual_paid - doc.contract_amount) / doc.contract_amount * 100, 2
                )
        session.add(doc)
        await session.commit()
        await session.refresh(doc)
        return _doc_to_dict(doc)


@router.put("/documents/{doc_id}")
async def update_document(doc_id: int, data: DocumentUpdate):
    async with async_session() as session:
        doc = await session.get(ContractDocument, doc_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(doc, key, value)
        # Recalculate discrepancy
        if doc.contract_amount and doc.actual_paid and doc.contract_amount > 0:
            doc.discrepancy_percent = round(
                abs(doc.actual_paid - doc.contract_amount) / doc.contract_amount * 100, 2
            )
        doc.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(doc)
        return _doc_to_dict(doc)


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: int):
    async with async_session() as session:
        doc = await session.get(ContractDocument, doc_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        await session.delete(doc)
        await session.commit()
        return {"status": "deleted", "id": doc_id}


# ── Entities CRUD ─────────────────────────────────────────────

@router.get("/entities")
async def list_entities(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str = Query(""),
    entity_type: str = Query(""),
):
    async with async_session() as session:
        q = select(NetworkEntity)
        if search:
            like = f"%{search}%"
            q = q.where(
                (NetworkEntity.name.ilike(like)) |
                (NetworkEntity.entity_id.ilike(like)) |
                (NetworkEntity.bin_number.ilike(like))
            )
        if entity_type:
            q = q.where(NetworkEntity.entity_type == entity_type)
        count_q = select(func.count()).select_from(q.subquery())
        total = (await session.execute(count_q)).scalar() or 0
        q = q.order_by(NetworkEntity.name).offset((page - 1) * per_page).limit(per_page)
        result = await session.execute(q)
        ents = result.scalars().all()
        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "items": [_entity_to_dict(e) for e in ents],
        }


@router.get("/entities/{entity_id}")
async def get_entity(entity_id: int):
    async with async_session() as session:
        ent = await session.get(NetworkEntity, entity_id)
        if not ent:
            raise HTTPException(404, "Entity not found")
        return _entity_to_dict(ent)


@router.put("/entities/{entity_id}")
async def update_entity(entity_id: int, data: EntityUpdate):
    async with async_session() as session:
        ent = await session.get(NetworkEntity, entity_id)
        if not ent:
            raise HTTPException(404, "Entity not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(ent, key, value)
        await session.commit()
        await session.refresh(ent)
        return _entity_to_dict(ent)


# ── Flows CRUD ────────────────────────────────────────────────

@router.get("/flows")
async def list_flows(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    suspicious_only: bool = Query(False),
    source_id: str = Query(""),
    target_id: str = Query(""),
):
    async with async_session() as session:
        q = select(MoneyFlow)
        if suspicious_only:
            q = q.where(MoneyFlow.is_suspicious == True)
        if source_id:
            q = q.where(MoneyFlow.source_id == source_id)
        if target_id:
            q = q.where(MoneyFlow.target_id == target_id)
        count_q = select(func.count()).select_from(q.subquery())
        total = (await session.execute(count_q)).scalar() or 0
        q = q.order_by(desc(MoneyFlow.flow_date)).offset((page - 1) * per_page).limit(per_page)
        result = await session.execute(q)
        fls = result.scalars().all()
        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "items": [_flow_to_dict(f) for f in fls],
        }


@router.put("/flows/{flow_id}")
async def update_flow(flow_id: int, data: FlowUpdate):
    async with async_session() as session:
        fl = await session.get(MoneyFlow, flow_id)
        if not fl:
            raise HTTPException(404, "Flow not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(fl, key, value)
        await session.commit()
        await session.refresh(fl)
        return _flow_to_dict(fl)


# ── Suspicious Schemes ───────────────────────────────────────

@router.get("/suspicious-schemes")
async def get_suspicious_schemes():
    """Return top suspicious flow chains for the dashboard."""
    async with async_session() as session:
        # Latest suspicious flows
        q = (
            select(MoneyFlow)
            .where(MoneyFlow.is_suspicious == True)
            .order_by(desc(MoneyFlow.risk_score))
            .limit(20)
        )
        result = await session.execute(q)
        sus_flows = result.scalars().all()

        # Build scheme view: group by source
        schemes = []
        seen = set()

        # Build entity lookup by id (pk)
        all_entity_result = await session.execute(select(NetworkEntity))
        all_entities = {e.id: e for e in all_entity_result.scalars().all()}

        for f in sus_flows:
            if f.source_id in seen:
                continue
            seen.add(f.source_id)

            # Find all suspicious flows from this source
            chain_q = (
                select(MoneyFlow)
                .where(MoneyFlow.source_id == f.source_id, MoneyFlow.is_suspicious == True)
                .order_by(desc(MoneyFlow.amount))
                .limit(5)
            )
            chain_result = await session.execute(chain_q)
            chain_flows = chain_result.scalars().all()

            src = all_entities.get(f.source_id)

            total = sum(cf.amount for cf in chain_flows)
            targets = []
            for cf in chain_flows:
                tgt = all_entities.get(cf.target_id)
                targets.append({
                    "entity_id": tgt.entity_id if tgt else str(cf.target_id),
                    "name": tgt.name if tgt else str(cf.target_id),
                    "amount": cf.amount,
                    "flow_type": cf.flow_type,
                })

            # Get related documents
            doc_ids = [cf.document_id for cf in chain_flows if cf.document_id]
            docs_q = select(ContractDocument).where(ContractDocument.id.in_(doc_ids)) if doc_ids else None
            doc_list = []
            if docs_q is not None:
                docs_result = await session.execute(docs_q)
                for d in docs_result.scalars().all():
                    doc_list.append({
                        "id": d.id,
                        "doc_id": d.doc_id,
                        "title": d.title,
                        "contract_amount": d.contract_amount,
                        "actual_paid": d.actual_paid,
                        "discrepancy_percent": d.discrepancy_percent,
                    })

            schemes.append({
                "source_id": src.entity_id if src else str(f.source_id),
                "source_name": src.name if src else str(f.source_id),
                "source_type": src.entity_type if src else "unknown",
                "total_suspicious_amount": round(total, 2),
                "flow_count": len(chain_flows),
                "max_risk_score": max(cf.risk_score for cf in chain_flows),
                "targets": targets,
                "documents": doc_list,
            })

            if len(schemes) >= 8:
                break

        # Summary stats
        total_sus_q = select(func.count()).where(MoneyFlow.is_suspicious == True)
        total_sus = (await session.execute(total_sus_q)).scalar() or 0
        total_sus_amount_q = select(func.sum(MoneyFlow.amount)).where(MoneyFlow.is_suspicious == True)
        total_sus_amount = (await session.execute(total_sus_amount_q)).scalar() or 0

        # Discrepancy stats
        disc_q = select(func.avg(ContractDocument.discrepancy_percent)).where(
            ContractDocument.is_suspicious == True
        )
        avg_disc = (await session.execute(disc_q)).scalar() or 0

        return {
            "schemes": schemes,
            "summary": {
                "total_suspicious_flows": total_sus,
                "total_suspicious_amount": round(total_sus_amount, 2),
                "avg_discrepancy_percent": round(avg_disc, 2),
                "scheme_count": len(schemes),
            },
        }


# ── Document by doc_id string ────────────────────────────────

@router.get("/documents/by-doc-id/{doc_id_str}")
async def get_document_by_doc_id(doc_id_str: str):
    async with async_session() as session:
        q = select(ContractDocument).where(ContractDocument.doc_id == doc_id_str)
        result = await session.execute(q)
        doc = result.scalar()
        if not doc:
            raise HTTPException(404, "Document not found")
        return _doc_to_dict(doc)


# ── Helpers ──────────────────────────────────────────────────

def _doc_to_dict(d: ContractDocument) -> dict:
    return {
        "id": d.id,
        "doc_id": d.doc_id,
        "contract_number": d.contract_number,
        "title": d.title,
        "document_type": d.document_type,
        "customer_name": d.customer_name,
        "customer_bin": d.customer_bin,
        "contractor_name": d.contractor_name,
        "contractor_bin": d.contractor_bin,
        "contract_amount": d.contract_amount,
        "actual_paid": d.actual_paid,
        "budget_code": d.budget_code,
        "goszakup_url": d.goszakup_url,
        "goszakup_lot_id": d.goszakup_lot_id,
        "signed_date": d.signed_date,
        "start_date": d.start_date,
        "end_date": d.end_date,
        "delivery_address": d.delivery_address,
        "region": d.region,
        "status": d.status,
        "description": d.description,
        "risk_notes": d.risk_notes,
        "is_suspicious": d.is_suspicious,
        "discrepancy_percent": d.discrepancy_percent,
        "metadata_json": d.metadata_json,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def _entity_to_dict(e: NetworkEntity) -> dict:
    return {
        "id": e.id,
        "entity_id": e.entity_id,
        "name": e.name,
        "entity_type": e.entity_type,
        "region": e.region,
        "country": e.country,
        "risk_score": e.risk_score,
        "is_suspicious": e.is_suspicious,
        "description": e.description,
        "bin_number": e.bin_number,
        "lat": e.lat,
        "lng": e.lng,
        "total_inflow": e.total_inflow,
        "total_outflow": e.total_outflow,
        "transaction_count": e.transaction_count,
        "ceo_name": e.ceo_name or "",
        "ceo_iin": e.ceo_iin or "",
        "founded_year": e.founded_year or 0,
        "employee_count": e.employee_count or 0,
        "suspicion_summary": e.suspicion_summary or "",
        "tender_won_amount": e.tender_won_amount or 0,
        "actual_spent_amount": e.actual_spent_amount or 0,
    }


def _flow_to_dict(f: MoneyFlow) -> dict:
    return {
        "id": f.id,
        "flow_id": f.flow_id,
        "source_id": f.source_id,
        "target_id": f.target_id,
        "amount": f.amount,
        "flow_date": f.flow_date,
        "description": f.description,
        "flow_type": f.flow_type,
        "is_suspicious": f.is_suspicious,
        "risk_score": f.risk_score,
        "tender_id": f.tender_id,
        "document_id": f.document_id,
    }
