"""
Network graph and AI analysis API routes for TechnoFilter.
Provides endpoints for financial network visualization, entity details,
money flow data, and Gemini AI analysis.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models import NetworkEntity, MoneyFlow, Tender, RiskFlag, ContractDocument
from app.gemini_service import gemini_analyze_tender, gemini_analyze_network

router = APIRouter(prefix="/api/v1", tags=["network"])


# ============= NETWORK GRAPH ENDPOINTS =============

@router.get("/network/graph")
async def get_network_graph(
    entity_type: Optional[str] = None,
    min_risk: float = 0,
    region: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get full network graph data (nodes + edges) for D3 visualization."""
    # Build entity query
    entity_query = select(NetworkEntity)
    if entity_type:
        entity_query = entity_query.where(NetworkEntity.entity_type == entity_type)
    if min_risk > 0:
        entity_query = entity_query.where(NetworkEntity.risk_score >= min_risk)
    if region:
        entity_query = entity_query.where(NetworkEntity.region.contains(region))

    result = await db.execute(entity_query)
    entities = result.scalars().all()
    entity_ids = {e.id for e in entities}
    entity_id_map = {e.id: e.entity_id for e in entities}

    # Build flow query (only flows between visible entities)
    flow_query = select(MoneyFlow).where(
        MoneyFlow.source_id.in_(entity_ids),
        MoneyFlow.target_id.in_(entity_ids),
    )
    flow_result = await db.execute(flow_query)
    flows = flow_result.scalars().all()

    nodes = []
    for e in entities:
        nodes.append({
            "id": e.entity_id,
            "name": e.name,
            "type": e.entity_type,
            "region": e.region,
            "country": e.country,
            "lat": e.lat,
            "lng": e.lng,
            "risk_score": e.risk_score,
            "total_inflow": e.total_inflow,
            "total_outflow": e.total_outflow,
            "transaction_count": e.transaction_count,
            "is_suspicious": e.is_suspicious,
            "ceo_name": e.ceo_name or "",
            "bin_number": e.bin_number or "",
            "founded_year": e.founded_year or 0,
            "employee_count": e.employee_count or 0,
            "suspicion_summary": e.suspicion_summary or "",
            "tender_won_amount": e.tender_won_amount or 0,
            "actual_spent_amount": e.actual_spent_amount or 0,
        })

    # Get document data for flows
    doc_ids = {f.document_id for f in flows if f.document_id}
    doc_map = {}
    if doc_ids:
        doc_result = await db.execute(select(ContractDocument).where(ContractDocument.id.in_(doc_ids)))
        for d in doc_result.scalars().all():
            doc_map[d.id] = d

    edges = []
    for f in flows:
        edge = {
            "id": f.flow_id,
            "source": entity_id_map.get(f.source_id, ""),
            "target": entity_id_map.get(f.target_id, ""),
            "amount": f.amount,
            "currency": f.currency,
            "flow_date": f.flow_date.isoformat() if f.flow_date else None,
            "description": f.description,
            "tender_id": f.tender_id,
            "is_suspicious": f.is_suspicious,
            "risk_score": f.risk_score,
            "flow_type": f.flow_type,
            "document_id": f.document_id,
        }
        doc = doc_map.get(f.document_id)
        if doc:
            edge["document"] = {
                "doc_id": doc.doc_id,
                "title": doc.title,
                "contract_amount": doc.contract_amount,
                "actual_paid": doc.actual_paid,
                "discrepancy_percent": doc.discrepancy_percent,
                "contract_number": doc.contract_number,
                "customer_name": doc.customer_name,
                "contractor_name": doc.contractor_name,
                "is_suspicious": doc.is_suspicious,
            }
        edges.append(edge)

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "suspicious_nodes": sum(1 for n in nodes if n["is_suspicious"]),
            "suspicious_edges": sum(1 for e in edges if e["is_suspicious"]),
            "total_flow_amount": sum(e["amount"] for e in edges),
        }
    }


@router.get("/network/entity/{entity_id}")
async def get_entity_detail(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get detailed info about a specific entity with its connections."""
    result = await db.execute(
        select(NetworkEntity).where(NetworkEntity.entity_id == entity_id)
    )
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Get outgoing flows
    out_result = await db.execute(
        select(MoneyFlow).where(MoneyFlow.source_id == entity.id)
    )
    outgoing = out_result.scalars().all()

    # Get incoming flows
    in_result = await db.execute(
        select(MoneyFlow).where(MoneyFlow.target_id == entity.id)
    )
    incoming = in_result.scalars().all()

    # Get connected entity IDs
    connected_ids = set()
    for f in outgoing:
        connected_ids.add(f.target_id)
    for f in incoming:
        connected_ids.add(f.source_id)

    # Get connected entities
    if connected_ids:
        conn_result = await db.execute(
            select(NetworkEntity).where(NetworkEntity.id.in_(connected_ids))
        )
        connected_entities = conn_result.scalars().all()
        conn_map = {e.id: e for e in connected_entities}
    else:
        conn_map = {}

    # Get all entity id mapping
    all_ids = connected_ids | {entity.id}
    all_result = await db.execute(
        select(NetworkEntity).where(NetworkEntity.id.in_(all_ids))
    )
    all_entities = all_result.scalars().all()
    id_map = {e.id: e.entity_id for e in all_entities}

    return {
        "entity": {
            "id": entity.entity_id,
            "name": entity.name,
            "type": entity.entity_type,
            "region": entity.region,
            "country": entity.country,
            "lat": entity.lat,
            "lng": entity.lng,
            "risk_score": entity.risk_score,
            "total_inflow": entity.total_inflow,
            "total_outflow": entity.total_outflow,
            "transaction_count": entity.transaction_count,
            "is_suspicious": entity.is_suspicious,
            "ceo_name": entity.ceo_name or "",
            "ceo_iin": entity.ceo_iin or "",
            "bin_number": entity.bin_number or "",
            "founded_year": entity.founded_year or 0,
            "employee_count": entity.employee_count or 0,
            "suspicion_summary": entity.suspicion_summary or "",
            "tender_won_amount": entity.tender_won_amount or 0,
            "actual_spent_amount": entity.actual_spent_amount or 0,
        },
        "outgoing_flows": [
            {
                "id": f.flow_id,
                "target": id_map.get(f.target_id, ""),
                "target_name": conn_map[f.target_id].name if f.target_id in conn_map else "",
                "amount": f.amount,
                "flow_date": f.flow_date.isoformat() if f.flow_date else None,
                "description": f.description,
                "flow_type": f.flow_type,
                "is_suspicious": f.is_suspicious,
                "risk_score": f.risk_score,
                "document_id": f.document_id,
            }
            for f in outgoing
        ],
        "incoming_flows": [
            {
                "id": f.flow_id,
                "source": id_map.get(f.source_id, ""),
                "source_name": conn_map[f.source_id].name if f.source_id in conn_map else "",
                "amount": f.amount,
                "flow_date": f.flow_date.isoformat() if f.flow_date else None,
                "description": f.description,
                "flow_type": f.flow_type,
                "is_suspicious": f.is_suspicious,
                "risk_score": f.risk_score,
                "document_id": f.document_id,
            }
            for f in incoming
        ],
        "connected_entities": [
            {
                "id": e.entity_id,
                "name": e.name,
                "type": e.entity_type,
                "region": e.region,
                "risk_score": e.risk_score,
                "is_suspicious": e.is_suspicious,
            }
            for e in conn_map.values()
        ],
    }


@router.get("/network/flows/timeline")
async def get_flow_timeline(
    db: AsyncSession = Depends(get_db),
):
    """Get money flows aggregated by month for timeline histogram."""
    flows_result = await db.execute(select(MoneyFlow).order_by(MoneyFlow.flow_date))
    flows = flows_result.scalars().all()

    monthly: dict = {}
    for f in flows:
        if f.flow_date:
            key = f.flow_date.strftime("%Y-%m")
            if key not in monthly:
                monthly[key] = {"month": key, "count": 0, "total_amount": 0, "suspicious_count": 0, "suspicious_amount": 0}
            monthly[key]["count"] += 1
            monthly[key]["total_amount"] += f.amount
            if f.is_suspicious:
                monthly[key]["suspicious_count"] += 1
                monthly[key]["suspicious_amount"] += f.amount

    timeline = sorted(monthly.values(), key=lambda x: x["month"])
    return {"timeline": timeline}


@router.get("/network/map-flows")
async def get_map_flows(
    db: AsyncSession = Depends(get_db),
):
    """Get geographic money flows for map visualization. Returns flows with coordinates."""
    # Get all entities with coordinates
    entity_result = await db.execute(select(NetworkEntity))
    entities = entity_result.scalars().all()
    entity_map = {e.id: e for e in entities}

    # Get important flows (all flows for map visualization — not just suspicious)
    flow_result = await db.execute(select(MoneyFlow))
    flows = flow_result.scalars().all()

    geo_flows = []
    for f in flows:
        src = entity_map.get(f.source_id)
        tgt = entity_map.get(f.target_id)
        if src and tgt and src.lat and src.lng and tgt.lat and tgt.lng:
            flow_data = {
                "id": f.flow_id,
                "source": {
                    "id": src.entity_id,
                    "name": src.name,
                    "lat": src.lat,
                    "lng": src.lng,
                    "type": src.entity_type,
                    "country": src.country,
                },
                "target": {
                    "id": tgt.entity_id,
                    "name": tgt.name,
                    "lat": tgt.lat,
                    "lng": tgt.lng,
                    "type": tgt.entity_type,
                    "country": tgt.country,
                },
                "amount": f.amount,
                "flow_type": f.flow_type,
                "is_suspicious": f.is_suspicious,
                "risk_score": f.risk_score,
                "flow_date": f.flow_date.isoformat() if f.flow_date else None,
                "document_id": f.document_id,
                "description": f.description,
            }
            geo_flows.append(flow_data)

    # Entity locations for map markers
    locations = []
    for e in entities:
        if e.lat and e.lng:
            locations.append({
                "id": e.entity_id,
                "name": e.name,
                "type": e.entity_type,
                "lat": e.lat,
                "lng": e.lng,
                "country": e.country,
                "risk_score": e.risk_score,
                "total_inflow": e.total_inflow,
                "total_outflow": e.total_outflow,
                "is_suspicious": e.is_suspicious,
            })

    return {
        "flows": geo_flows,
        "locations": locations,
    }


# ============= AI ANALYSIS ENDPOINTS =============

@router.post("/ai/analyze-tender")
async def ai_analyze_tender(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Deep AI analysis of a tender using Google Gemini."""
    text = data.get("text", "")
    language = data.get("language", "ru")
    metadata = data.get("metadata", {})

    if not text and data.get("tender_id"):
        # Fetch tender text from DB
        result = await db.execute(
            select(Tender).where(Tender.tender_id == data["tender_id"])
        )
        tender = result.scalar_one_or_none()
        if tender:
            text = tender.full_text or tender.description or ""
            metadata = {
                "customer_name": tender.customer_name,
                "amount": tender.amount,
                "region": tender.region,
                "delivery_days": tender.delivery_days,
                "participant_count": tender.participant_count,
            }

    if not text:
        raise HTTPException(status_code=400, detail="No text provided for analysis")

    result = await gemini_analyze_tender(text, metadata, language)
    return result


@router.post("/ai/analyze-network")
async def ai_analyze_network_endpoint(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """AI analysis of the financial network using Google Gemini."""
    language = data.get("language", "ru")
    entity_ids_param: list = data.get("entity_ids", [])

    # If specific entities are requested, restrict analysis to them + direct neighbours
    if entity_ids_param:
        sel_q = select(NetworkEntity).where(NetworkEntity.entity_id.in_(entity_ids_param))
        sel_result = await db.execute(sel_q)
        selected_entities = sel_result.scalars().all()
        selected_db_ids = {e.id for e in selected_entities}

        # Flows that touch any selected entity
        flow_q = select(MoneyFlow).where(
            or_(
                MoneyFlow.source_id.in_(selected_db_ids),
                MoneyFlow.target_id.in_(selected_db_ids),
            )
        )
        flow_result = await db.execute(flow_q)
        flows = flow_result.scalars().all()

        # Expand to include direct-neighbour entities
        neighbour_ids = selected_db_ids.copy()
        for f in flows:
            neighbour_ids.add(f.source_id)
            neighbour_ids.add(f.target_id)

        entity_result = await db.execute(
            select(NetworkEntity).where(NetworkEntity.id.in_(neighbour_ids))
        )
        entities = entity_result.scalars().all()
    else:
        # Fallback: all entities and flows (full-graph summary)
        entity_result = await db.execute(select(NetworkEntity))
        entities = entity_result.scalars().all()
        flow_result = await db.execute(select(MoneyFlow))
        flows = flow_result.scalars().all()

    entity_map = {e.id: e for e in entities}

    nodes_data = [
        {
            "id": e.entity_id,
            "name": e.name,
            "type": e.entity_type,
            "region": e.region,
            "total_amount": e.total_inflow + e.total_outflow,
            "ceo_name": e.ceo_name,
            "employee_count": e.employee_count,
            "tender_won_amount": e.tender_won_amount,
            "actual_spent_amount": e.actual_spent_amount,
            "suspicion_summary": e.suspicion_summary,
        }
        for e in entities
    ]

    txn_data = [
        {
            "source": entity_map[f.source_id].name if f.source_id in entity_map else "Unknown",
            "target": entity_map[f.target_id].name if f.target_id in entity_map else "Unknown",
            "amount": f.amount,
            "description": f.description,
            "flow_type": f.flow_type,
            "is_suspicious": f.is_suspicious,
        }
        for f in flows
    ]

    result = await gemini_analyze_network(nodes_data, txn_data, language)
    return result


@router.get("/network/stats")
async def get_network_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get network-level statistics."""
    entity_count = await db.execute(select(func.count(NetworkEntity.id)))
    flow_count = await db.execute(select(func.count(MoneyFlow.id)))
    suspicious_entities = await db.execute(
        select(func.count(NetworkEntity.id)).where(NetworkEntity.is_suspicious == True)
    )
    suspicious_flows = await db.execute(
        select(func.count(MoneyFlow.id)).where(MoneyFlow.is_suspicious == True)
    )
    total_amount = await db.execute(select(func.sum(MoneyFlow.amount)))
    suspicious_amount = await db.execute(
        select(func.sum(MoneyFlow.amount)).where(MoneyFlow.is_suspicious == True)
    )

    # Entity type distribution
    type_dist = {}
    for etype in ["government", "company", "intermediary", "offshore"]:
        count = await db.execute(
            select(func.count(NetworkEntity.id)).where(NetworkEntity.entity_type == etype)
        )
        type_dist[etype] = count.scalar() or 0

    # Flow type distribution
    flow_type_dist = {}
    for ftype in ["contract_payment", "subcontract", "consulting_fee", "investment", "loan", "commission", "unknown", "service_fee", "equipment_purchase"]:
        count = await db.execute(
            select(func.count(MoneyFlow.id)).where(MoneyFlow.flow_type == ftype)
        )
        flow_type_dist[ftype] = count.scalar() or 0

    return {
        "total_entities": entity_count.scalar() or 0,
        "total_flows": flow_count.scalar() or 0,
        "suspicious_entities": suspicious_entities.scalar() or 0,
        "suspicious_flows": suspicious_flows.scalar() or 0,
        "total_flow_amount": total_amount.scalar() or 0,
        "suspicious_flow_amount": suspicious_amount.scalar() or 0,
        "entity_type_distribution": type_dist,
        "flow_type_distribution": flow_type_dist,
    }
