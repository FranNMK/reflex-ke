"""
Seed production TiDB database with one user per role for testing.

Usage (run from the backend/ directory):
    python seed_production.py

Reads DATABASE_URL, JWT_SECRET, DELIVERY_CODE_SECRET from backend/.env
(or from environment variables set on Railway).

Safe to re-run: existing phone numbers are skipped, not duplicated.
"""

import sys
import os

# Allow "python seed_production.py" from the backend/ directory
sys.path.insert(0, os.path.dirname(__file__))

from app.config import get_settings
from app.database import SessionLocal
from app.models.models import User, UserRole
from app.auth import hash_password

# ── Seed data ────────────────────────────────────────────────────────────────
SEED_USERS = [
    {
        "name": "Alice Wanjiku",
        "phone": "0700000001",
        "password": "Retailer@123",
        "role": UserRole.retailer_staff,
    },
    {
        "name": "Brian Otieno",
        "phone": "0700000002",
        "password": "Dispatch@123",
        "role": UserRole.dispatcher,
    },
    {
        "name": "Carol Njeri",
        "phone": "0700000003",
        "password": "Rider@12345",
        "role": UserRole.rider,
    },
]


def seed() -> None:
    settings = get_settings()
    print(f"\n📦  Connecting to: {settings.DATABASE_URL[:40]}…\n")

    db = SessionLocal()
    try:
        created = []
        skipped = []

        for u in SEED_USERS:
            existing = db.query(User).filter(User.phone == u["phone"]).first()
            if existing:
                skipped.append(u)
                continue

            user = User(
                name=u["name"],
                phone=u["phone"],
                role=u["role"],
                hashed_password=hash_password(u["password"]),
            )
            db.add(user)
            db.flush()   # get the auto-assigned id before commit
            created.append((user.id, u))

        db.commit()

        # ── Report ────────────────────────────────────────────────────────────
        if created:
            print("✅  Created users:")
            print(f"  {'ID':<6} {'Name':<20} {'Phone':<14} {'Role':<18} {'Password'}")
            print("  " + "-" * 76)
            for uid, u in created:
                print(f"  {uid:<6} {u['name']:<20} {u['phone']:<14} {u['role'].value:<18} {u['password']}")
        else:
            print("ℹ️   No new users created.")

        if skipped:
            print("\n⚠️   Skipped (already exist):")
            for u in skipped:
                print(f"  {u['phone']}  ({u['role'].value})")

        print("\n🔑  Use these credentials on the login page.")
        print("    Phone field = the number above, Password field = the password above.\n")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
