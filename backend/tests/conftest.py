import os
import pytest

# Ensure env vars are set before any app import happens in any test file
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_reflex.db")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("DELIVERY_CODE_SECRET", "test-delivery-secret")


@pytest.fixture(autouse=True, scope="session")
def clear_settings_cache():
    """Clear the lru_cache on get_settings so tests always use the env vars above."""
    from app.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
