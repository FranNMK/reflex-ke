from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth as auth_router
from app.routers import deliveries as deliveries_router
from app.routers import users as users_router
from app.routers import products as products_router

settings = get_settings()

app = FastAPI(
    title="Reflex API",
    description="Delivery coordination system for small Kenyan retailers.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(deliveries_router.router)
app.include_router(users_router.router)
app.include_router(products_router.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
