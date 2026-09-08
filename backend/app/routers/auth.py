from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password, create_access_token
from app.database import get_db
from app.models import User, UserRole
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# TEMPORARY — remove after first production seed is confirmed working
# ---------------------------------------------------------------------------
_SEED_USERS = [
    {"name": "Alice Wanjiku", "phone": "0700000001", "password": "Retailer@123", "role": UserRole.retailer_staff},
    {"name": "Brian Otieno",  "phone": "0700000002", "password": "Dispatch@123", "role": UserRole.dispatcher},
    {"name": "Carol Njeri",   "phone": "0700000003", "password": "Rider@12345",  "role": UserRole.rider},
]

@router.post("/reseed", tags=["auth"], status_code=200)
def reseed(db: Session = Depends(get_db)):
    """Update passwords for the three test users with fresh bcrypt hashes.
    Does NOT delete — just updates hashed_password in place to avoid FK issues.
    REMOVE THIS ENDPOINT once login is confirmed working in production."""
    results = []
    for u in _SEED_USERS:
        existing = db.query(User).filter(User.phone == u["phone"]).first()
        if existing:
            # Update password hash in-place — avoids FK constraint issues
            existing.hashed_password = hash_password(u["password"])
            results.append({"phone": u["phone"], "role": u["role"].value, "action": "updated"})
        else:
            user = User(
                name=u["name"],
                phone=u["phone"],
                role=u["role"],
                hashed_password=hash_password(u["password"]),
            )
            db.add(user)
            results.append({"phone": u["phone"], "role": u["role"].value, "action": "created"})
    db.commit()
    return {"seeded": results}
# ---------------------------------------------------------------------------


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account. Intended for seeding/admin use."""
    existing = db.query(User).filter(User.phone == payload.phone).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number already exists",
        )
    user = User(
        name=payload.name,
        phone=payload.phone,
        role=payload.role,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == payload.phone).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
        )
    token = create_access_token(user_id=user.id, role=user.role.value)
    return TokenResponse(access_token=token)
