"""
TechnoFilter — AI-Powered Procurement Corruption Detector
Main FastAPI Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from app.config import settings
from app.database import init_db, async_session
from app.models import Tender, RiskFlag, NetworkEntity, MoneyFlow, ContractDocument
from app.analyzer import risk_analyzer
from app.demo_data import generate_demo_tenders
from app.network_data import generate_network_data

from app.routes import tenders, dashboard, feedback
from app.routes import network as network_routes
from app.routes import admin as admin_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and seed demo data on startup."""
    await init_db()

    # Seed demo data if DB is empty
    async with async_session() as db:
        from sqlalchemy import select, func
        count_result = await db.execute(select(func.count(Tender.id)))
        count = count_result.scalar()

        if count == 0:
            print("🔄 Seeding demo data (500 tenders)...")
            demo_tenders = generate_demo_tenders(500)

            for td in demo_tenders:
                tender = Tender(
                    tender_id=td["tender_id"],
                    title=td["title"],
                    description=td["description"],
                    full_text=td["full_text"],
                    customer_name=td["customer_name"],
                    customer_tin=td["customer_tin"],
                    winner_name=td["winner_name"],
                    winner_tin=td["winner_tin"],
                    amount=td["amount"],
                    region=td["region"],
                    oked_code=td["oked_code"],
                    category=td["category"],
                    publication_date=datetime.fromisoformat(td["publication_date"]),
                    deadline_date=datetime.fromisoformat(td["deadline_date"]),
                    delivery_days=td["delivery_days"],
                    participant_count=td["participant_count"],
                    status=td["status"],
                )

                # Run analysis
                analysis = risk_analyzer.analyze(
                    text=td["full_text"],
                    title=td["title"],
                    amount=td["amount"],
                    delivery_days=td["delivery_days"],
                    participant_count=td["participant_count"],
                    region=td["region"],
                    oked_code=td["oked_code"],
                    customer_name=td["customer_name"],
                    winner_name=td.get("winner_name", ""),
                )

                tender.risk_score = analysis["risk_score"]
                tender.risk_level = analysis["risk_level"]
                tender.confidence = analysis["confidence"]
                tender.recommendation = analysis["recommendation"]
                tender.analyzed_at = datetime.utcnow()
                tender.is_analyzed = True

                db.add(tender)
                await db.flush()

                # Add flags
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
            print(f"✅ Seeded {len(demo_tenders)} tenders with risk analysis")

    # Seed network data if empty
    async with async_session() as db:
        from sqlalchemy import select, func
        ne_count_result = await db.execute(select(func.count(NetworkEntity.id)))
        ne_count = ne_count_result.scalar()

        if ne_count == 0:
            print("🔄 Seeding network graph data...")
            entities_data, flows_data, docs_data = generate_network_data()

            entity_id_to_db_id = {}

            for ed in entities_data:
                entity = NetworkEntity(
                    entity_id=ed["entity_id"],
                    name=ed["name"],
                    entity_type=ed["entity_type"],
                    region=ed["region"],
                    country=ed["country"],
                    lat=ed["lat"],
                    lng=ed["lng"],
                    bin_number=ed.get("bin", ""),
                    risk_score=ed["risk_score"],
                    total_inflow=ed["total_inflow"],
                    total_outflow=ed["total_outflow"],
                    transaction_count=ed["transaction_count"],
                    is_suspicious=ed["is_suspicious"],
                    ceo_name=ed.get("ceo_name", ""),
                    ceo_iin=ed.get("ceo_iin", ""),
                    founded_year=ed.get("founded_year", 0),
                    employee_count=ed.get("employee_count", 0),
                    suspicion_summary=ed.get("suspicion_summary", ""),
                    tender_won_amount=ed.get("tender_won_amount", 0),
                    actual_spent_amount=ed.get("actual_spent_amount", 0),
                )
                db.add(entity)
                await db.flush()
                entity_id_to_db_id[ed["entity_id"]] = entity.id

            # Create documents first
            doc_id_to_db_id = {}
            for dd in docs_data:
                doc = ContractDocument(
                    doc_id=dd["doc_id"],
                    contract_number=dd["contract_number"],
                    title=dd["title"],
                    document_type=dd["document_type"],
                    customer_name=dd.get("customer_name", ""),
                    customer_bin=dd.get("customer_bin", ""),
                    contractor_name=dd.get("contractor_name", ""),
                    contractor_bin=dd.get("contractor_bin", ""),
                    contract_amount=dd.get("contract_amount", 0),
                    actual_paid=dd.get("actual_paid", 0),
                    budget_code=dd.get("budget_code", ""),
                    goszakup_url=dd.get("goszakup_url", ""),
                    goszakup_lot_id=dd.get("goszakup_lot_id", ""),
                    signed_date=datetime.fromisoformat(dd["signed_date"]) if dd.get("signed_date") else None,
                    start_date=datetime.fromisoformat(dd["start_date"]) if dd.get("start_date") else None,
                    end_date=datetime.fromisoformat(dd["end_date"]) if dd.get("end_date") else None,
                    region=dd.get("region", ""),
                    status=dd.get("status", "active"),
                    description=dd.get("description", ""),
                    risk_notes=dd.get("risk_notes", ""),
                    is_suspicious=dd.get("is_suspicious", False),
                    discrepancy_percent=dd.get("discrepancy_percent", 0),
                )
                db.add(doc)
                await db.flush()
                doc_id_to_db_id[dd["doc_id"]] = doc.id

            for fd in flows_data:
                src_db_id = entity_id_to_db_id.get(fd["source_id"])
                tgt_db_id = entity_id_to_db_id.get(fd["target_id"])
                if src_db_id and tgt_db_id:
                    doc_db_id = doc_id_to_db_id.get(fd.get("document_id")) if fd.get("document_id") else None
                    flow = MoneyFlow(
                        flow_id=fd["flow_id"],
                        source_id=src_db_id,
                        target_id=tgt_db_id,
                        amount=fd["amount"],
                        flow_date=datetime.fromisoformat(fd["flow_date"]),
                        description=fd.get("description", ""),
                        tender_id=fd.get("tender_id"),
                        document_id=doc_db_id,
                        is_suspicious=fd["is_suspicious"],
                        risk_score=fd["risk_score"],
                        flow_type=fd["flow_type"],
                    )
                    db.add(flow)

            await db.commit()
            print(f"✅ Seeded {len(entities_data)} entities, {len(flows_data)} flows, {len(docs_data)} documents")

    yield

    # Graceful shutdown
    print("🛑 Shutting down TechnoFilter...")


app = FastAPI(
    title="TechnoFilter — AI Anti-Corruption System API",
    description="AI-powered detection of manipulative specifications in government procurement",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(tenders.router)
app.include_router(dashboard.router)
app.include_router(feedback.router)
app.include_router(network_routes.router)
app.include_router(admin_routes.router)


@app.get("/")
async def root():
    return {
        "system": "TechnoFilter — AI Anti-Corruption System",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }
