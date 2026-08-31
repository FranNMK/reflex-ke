from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole, DeliveryRequest, DeliveryStatus, DeliveryConfirmation
from app.schemas import (
    DeliveryCreate,
    DeliveryOut,
    AssignRiderRequest,
    StatusUpdateRequest,
    ConfirmDeliveryRequest,
    UserOut,
)
from app.delivery_utils import generate_confirmation_code, verify_confirmation_code

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


def _require_role(user: User, *roles: UserRole) -> None:
    if user.role not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


def _get_delivery_or_404(delivery_id: int, db: Session) -> DeliveryRequest:
    delivery = db.query(DeliveryRequest).filter(DeliveryRequest.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found")
    return delivery


# ── POST /deliveries ──────────────────────────────────────────────────────────

@router.post("", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED)
def create_delivery(
    payload: DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.retailer_staff)

    delivery = DeliveryRequest(
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        address=payload.address,
        item_description=payload.item_description,
        status=DeliveryStatus.requested,
        confirmation_code="pending",  # placeholder until we have the id
        created_by_id=current_user.id,
    )
    db.add(delivery)
    db.flush()  # populate delivery.id without committing

    # Generate code now that we have the id
    delivery.confirmation_code = generate_confirmation_code(delivery.id)
    db.commit()
    db.refresh(delivery)
    return delivery


# ── GET /deliveries ───────────────────────────────────────────────────────────

@router.get("", response_model=List[DeliveryOut])
def list_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.retailer_staff, UserRole.dispatcher)
    return db.query(DeliveryRequest).order_by(DeliveryRequest.created_at.desc()).all()


# ── GET /deliveries/mine ──────────────────────────────────────────────────────

@router.get("/mine", response_model=List[DeliveryOut])
def list_my_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.rider)
    return (
        db.query(DeliveryRequest)
        .filter(
            DeliveryRequest.assigned_rider_id == current_user.id,
            DeliveryRequest.status.in_([DeliveryStatus.assigned, DeliveryStatus.picked_up]),
        )
        .order_by(DeliveryRequest.created_at.desc())
        .all()
    )


# ── PATCH /deliveries/{id}/assign ─────────────────────────────────────────────

@router.patch("/{delivery_id}/assign", response_model=DeliveryOut)
def assign_rider(
    delivery_id: int,
    payload: AssignRiderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.dispatcher)
    delivery = _get_delivery_or_404(delivery_id, db)

    if delivery.status != DeliveryStatus.requested:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot assign: delivery is already '{delivery.status.value}'",
        )

    rider = db.query(User).filter(User.id == payload.rider_id, User.role == UserRole.rider).first()
    if not rider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rider not found")

    delivery.assigned_rider_id = payload.rider_id
    delivery.status = DeliveryStatus.assigned
    db.commit()
    db.refresh(delivery)
    return delivery


# ── PATCH /deliveries/{id}/status ─────────────────────────────────────────────

@router.patch("/{delivery_id}/status", response_model=DeliveryOut)
def update_status(
    delivery_id: int,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.rider)
    delivery = _get_delivery_or_404(delivery_id, db)

    if delivery.assigned_rider_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your delivery")

    # Only rider-driven transition allowed here is assigned → picked_up
    if payload.status != "picked_up":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only 'picked_up' is allowed via this endpoint",
        )
    if delivery.status != DeliveryStatus.assigned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{delivery.status.value}' to 'picked_up'",
        )

    delivery.status = DeliveryStatus.picked_up
    db.commit()
    db.refresh(delivery)
    return delivery


# ── POST /deliveries/{id}/confirm ─────────────────────────────────────────────

@router.post("/{delivery_id}/confirm", response_model=DeliveryOut)
def confirm_delivery(
    delivery_id: int,
    payload: ConfirmDeliveryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.rider)
    delivery = _get_delivery_or_404(delivery_id, db)

    if delivery.assigned_rider_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your delivery")

    if delivery.status != DeliveryStatus.picked_up:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot confirm: delivery status is '{delivery.status.value}', expected 'picked_up'",
        )

    if not verify_confirmation_code(delivery.id, payload.scanned_code):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Confirmation code does not match",
        )

    # Atomic: create confirmation + update status
    confirmation = DeliveryConfirmation(
        delivery_id=delivery.id,
        scanned_code=payload.scanned_code.strip(),
    )
    db.add(confirmation)
    delivery.status = DeliveryStatus.delivered
    db.commit()
    db.refresh(delivery)
    return delivery
