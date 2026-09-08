import secrets
from typing import List, Union

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole, DeliveryRequest, DeliveryStatus
from app.schemas import RiderCreateRequest, RiderCreatedOut, RiderUpdateRequest, UserOut

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


# ── PATCH /users/riders/{id} ─────────────────────────────────────────────────

@router.patch("/riders/{rider_id}", response_model=Union[RiderCreatedOut, UserOut])
def update_rider(
    rider_id: int,
    payload: RiderUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispatcher-only: update a rider's name/phone and/or reset their password."""
    if current_user.role != UserRole.dispatcher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rider = db.query(User).filter(User.id == rider_id, User.role == UserRole.rider).first()
    if not rider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rider not found")

    # Phone uniqueness check — only if phone is being changed
    if payload.phone and payload.phone != rider.phone:
        if db.query(User).filter(User.phone == payload.phone).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone already registered")

    if payload.name:
        rider.name = payload.name
    if payload.phone:
        rider.phone = payload.phone

    if payload.reset_password:
        temp_password = f"rider-{secrets.randbelow(9000) + 1000}"
        rider.hashed_password = hash_password(temp_password)
        db.commit()
        db.refresh(rider)
        return RiderCreatedOut(
            id=rider.id,
            name=rider.name,
            phone=rider.phone,
            role=rider.role,
            temp_password=temp_password,
        )

    db.commit()
    db.refresh(rider)
    return rider


# ── DELETE /users/riders/{id} ────────────────────────────────────────────────

@router.delete("/riders/{rider_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rider(
    rider_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispatcher-only: delete a rider. Blocked if rider has active deliveries."""
    if current_user.role != UserRole.dispatcher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rider = db.query(User).filter(User.id == rider_id, User.role == UserRole.rider).first()
    if not rider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rider not found")

    active = db.query(DeliveryRequest).filter(
        DeliveryRequest.assigned_rider_id == rider_id,
        DeliveryRequest.status.in_([DeliveryStatus.assigned, DeliveryStatus.picked_up]),
    ).first()
    if active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Rider has active deliveries and cannot be removed",
        )

    db.delete(rider)
    db.commit()
