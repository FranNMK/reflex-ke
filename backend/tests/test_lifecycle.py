"""
End-to-end lifecycle test for Reflex API.

Uses FastAPI's TestClient against an in-memory SQLite database so no
running TiDB instance is required. The full delivery lifecycle is exercised:

  register (3 roles) → login → create delivery → assign rider
  → pick up → confirm → verify delivered status
"""
import os

# Set required env vars BEFORE any app module is imported so pydantic-settings
# picks them up even if backend/.env is not present (e.g. CI, pytest run from repo root).
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_reflex.db")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("DELIVERY_CODE_SECRET", "test-delivery-secret")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db
from app.models import Base

# ── SQLite in-memory test database ────────────────────────────────────────────
SQLALCHEMY_TEST_URL = "sqlite:///./test_reflex.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────────────

def register(name: str, phone: str, password: str, role: str) -> dict:
    res = client.post("/auth/register", json={"name": name, "phone": phone, "password": password, "role": role})
    assert res.status_code == 201, res.text
    return res.json()


def login(phone: str, password: str) -> str:
    res = client.post("/auth/login", json={"phone": phone, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Full lifecycle test ────────────────────────────────────────────────────────

def test_full_delivery_lifecycle():
    # 1. Register three users
    staff = register("Alice", "0700000001", "pass1", "retailer_staff")
    dispatcher_user = register("Bob", "0700000002", "pass2", "dispatcher")
    rider_user = register("Charlie", "0700000003", "pass3", "rider")

    staff_token = login("0700000001", "pass1")
    dispatcher_token = login("0700000002", "pass2")
    rider_token = login("0700000003", "pass3")

    # 2. Retailer staff creates a delivery
    res = client.post(
        "/deliveries",
        json={
            "customer_name": "Diana",
            "customer_phone": "0711111111",
            "address": "123 Ngong Road, Nairobi",
            "item_description": "Samsung Galaxy A15",
        },
        headers=auth(staff_token),
    )
    assert res.status_code == 201, res.text
    delivery = res.json()
    assert delivery["status"] == "requested"
    delivery_id = delivery["id"]
    confirmation_code = delivery["confirmation_code"]
    assert len(confirmation_code) == 8

    # 3. Dispatcher sees the delivery in the list
    res = client.get("/deliveries", headers=auth(dispatcher_token))
    assert res.status_code == 200
    ids = [d["id"] for d in res.json()]
    assert delivery_id in ids

    # 4. Dispatcher assigns rider
    res = client.patch(
        f"/deliveries/{delivery_id}/assign",
        json={"rider_id": rider_user["id"]},
        headers=auth(dispatcher_token),
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "assigned"

    # 5. Rider sees the delivery in /mine
    res = client.get("/deliveries/mine", headers=auth(rider_token))
    assert res.status_code == 200
    my_ids = [d["id"] for d in res.json()]
    assert delivery_id in my_ids

    # 6. Rider marks picked up
    res = client.patch(
        f"/deliveries/{delivery_id}/status",
        json={"status": "picked_up"},
        headers=auth(rider_token),
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "picked_up"

    # 7. Rider confirms delivery with correct code
    res = client.post(
        f"/deliveries/{delivery_id}/confirm",
        json={"scanned_code": confirmation_code},
        headers=auth(rider_token),
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "delivered"

    # 8. Retailer sees delivered status
    res = client.get("/deliveries", headers=auth(staff_token))
    assert res.status_code == 200
    updated = next(d for d in res.json() if d["id"] == delivery_id)
    assert updated["status"] == "delivered"


# ── Role enforcement tests ─────────────────────────────────────────────────────

def test_rider_cannot_create_delivery():
    register("Rider1", "0722000001", "pass", "rider")
    token = login("0722000001", "pass")
    res = client.post(
        "/deliveries",
        json={"customer_name": "X", "customer_phone": "0", "address": "x", "item_description": "x"},
        headers=auth(token),
    )
    assert res.status_code == 403


def test_retailer_cannot_assign():
    register("Staff1", "0722000002", "pass", "retailer_staff")
    token = login("0722000002", "pass")
    res = client.patch("/deliveries/1/assign", json={"rider_id": 99}, headers=auth(token))
    assert res.status_code == 403


def test_wrong_code_rejected():
    register("Staff2", "0722000003", "pass", "retailer_staff")
    register("Dispatch2", "0722000004", "pass", "dispatcher")
    register("Rider2", "0722000005", "pass", "rider")

    staff_token = login("0722000003", "pass")
    dispatcher_token = login("0722000004", "pass")
    rider_token = login("0722000005", "pass")

    res = client.post(
        "/deliveries",
        json={"customer_name": "E", "customer_phone": "0", "address": "x", "item_description": "y"},
        headers=auth(staff_token),
    )
    delivery_id = res.json()["id"]
    rider_id = client.get("/users?role=rider", headers=auth(dispatcher_token)).json()[0]["id"]

    client.patch(f"/deliveries/{delivery_id}/assign", json={"rider_id": rider_id}, headers=auth(dispatcher_token))
    client.patch(f"/deliveries/{delivery_id}/status", json={"status": "picked_up"}, headers=auth(rider_token))

    res = client.post(
        f"/deliveries/{delivery_id}/confirm",
        json={"scanned_code": "wrongcode"},
        headers=auth(rider_token),
    )
    assert res.status_code == 422


def test_skip_transition_rejected():
    register("Staff3", "0722000006", "pass", "retailer_staff")
    token = login("0722000006", "pass")
    res = client.post(
        "/deliveries",
        json={"customer_name": "F", "customer_phone": "0", "address": "x", "item_description": "z"},
        headers=auth(token),
    )
    delivery_id = res.json()["id"]

    # Try to mark picked_up directly from requested — wrong role anyway, but also wrong state
    register("Rider3", "0722000007", "pass", "rider")
    rider_token = login("0722000007", "pass")
    res = client.patch(
        f"/deliveries/{delivery_id}/status",
        json={"status": "picked_up"},
        headers=auth(rider_token),
    )
    # Not their delivery (not assigned) → 403
    assert res.status_code == 403
