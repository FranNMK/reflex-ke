import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from app.auth import hash_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole
from app.schemas import RiderCreateRequest, RiderCreatedOut, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserOut])
def list_users(
    role: str = Query(None, description="Filter by role"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users. Dispatcher uses ?role=rider to populate the assignment dropdown."""
    if current_user.role not in (UserRole.dispatcher, UserRole.retailer_staff):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.name).all()


# ── POST /users/riders ────────────────────────────────────────────────────────

@router.post("/riders", response_model=RiderCreatedOut, status_code=status.HTTP_201_CREATED)
def create_rider(
    payload: RiderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispatcher-only: create a rider account and return the one-time temp password."""
    if current_user.role != UserRole.dispatcher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if db.query(User).filter(User.phone == payload.phone).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone already registered")

    temp_password = f"rider-{secrets.randbelow(9000) + 1000}"
    user = User(
        name=payload.name,
        phone=payload.phone,
        role=UserRole.rider,
        hashed_password=hash_password(temp_password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return RiderCreatedOut(
        id=user.id,
        name=user.name,
        phone=user.phone,
        role=user.role,
        temp_password=temp_password,
    )
