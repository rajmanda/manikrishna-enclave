import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db as database
from app.core.config import get_settings
from app.routers import (
    apartments,
    auth,
    communities,
    dashboard,
    finance,
    users,
    vendors,
    work_orders,
)


logger = logging.getLogger("communityhub")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    db = database.connect()
    try:
        await database.ensure_indexes(db)
        if settings.seed_on_start:
            from app.seed import seed

            if await seed(db):
                logger.info("Seeded initial community data")
    except Exception:
        # Don't block startup on a transient DB outage; requests will surface
        # connection errors until MongoDB is reachable.
        logger.exception("MongoDB not reachable at startup — continuing")
    yield
    database.disconnect()


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(communities.router, prefix=API_PREFIX)
app.include_router(apartments.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(finance.router, prefix=API_PREFIX)
app.include_router(work_orders.router, prefix=API_PREFIX)
app.include_router(vendors.router, prefix=API_PREFIX)


# Note: GFE intercepts /healthz on *.run.app domains and returns its own 404,
# so /health is the canonical probe path; /healthz kept for LB/custom-domain use.
@app.get("/health", tags=["health"])
@app.get("/healthz", tags=["health"])
async def healthz() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
