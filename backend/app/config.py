from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List
from pathlib import Path

# Always resolve .env relative to this file's directory (backend/app/../.env → backend/.env)
# This works regardless of the working directory uvicorn/alembic/pytest is launched from.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


def _normalise_origin(origin: str) -> str:
    """Railway's UI strips https:// from variable values. Re-add it if missing."""
    o = origin.strip()
    if not o:
        return o
    if o.startswith("http://") or o.startswith("https://"):
        return o
    return f"https://{o}"


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    DELIVERY_CODE_SECRET: str
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [_normalise_origin(o) for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = {
        "env_file": str(_ENV_FILE),
        "env_file_encoding": "utf-8",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
