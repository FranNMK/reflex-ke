from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole
from app.schemas import UserOut

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
