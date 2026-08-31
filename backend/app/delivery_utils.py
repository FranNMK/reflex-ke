import hashlib
import hmac

from app.config import get_settings

settings = get_settings()

# Valid status transitions
ALLOWED_TRANSITIONS: dict[str, str | None] = {
    "requested": "assigned",
    "assigned": "picked_up",
    "picked_up": "delivered",
    "delivered": None,
}


def generate_confirmation_code(delivery_id: int) -> str:
    """HMAC-SHA256(secret, delivery_id) → first 8 hex chars."""
    key = settings.DELIVERY_CODE_SECRET.encode()
    msg = str(delivery_id).encode()
    return hmac.new(key, msg, digestmod=hashlib.sha256).hexdigest()[:8]


def verify_confirmation_code(delivery_id: int, scanned_code: str) -> bool:
    expected = generate_confirmation_code(delivery_id)
    return hmac.compare_digest(expected.lower(), scanned_code.strip().lower())
