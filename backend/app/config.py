from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List
from pathlib import Path

# Always resolve .env relative to this file's directory (backend/app/../.env → backend/.env)
# This works regardless of the working directory uvicorn/alembic/pytest is launched from.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    DELIVERY_CODE_SECRET: str
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    model_config = {
        "env_file": str(_ENV_FILE),
        "env_file_encoding": "utf-8",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
