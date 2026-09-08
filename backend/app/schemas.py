from pydantic import BaseModel
from typing import Optional
from app.models import UserRole


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    phone: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    phone: str
    password: str
    role: UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    phone: str
    role: UserRole


# ── Users ────────────────────────────────────────────────────────────────────

class RiderCreateRequest(BaseModel):
    name: str
    phone: str


class RiderUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    reset_password: bool = False


class RiderCreatedOut(UserOut):
    temp_password: str


# ── Products ──────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    category: str = "General"
    description: str = ""
    price: Optional[float] = None
    stock_qty: int = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock_qty: Optional[int] = None


class ProductOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    category: str
    description: Optional[str]
    price: Optional[float]
    stock_qty: int
    created_by_id: int


# ── Deliveries ────────────────────────────────────────────────────────────────

class DeliveryCreate(BaseModel):
    customer_name: str
    customer_phone: str
    address: str
    item_description: str


class AssignRiderRequest(BaseModel):
    rider_id: int


class StatusUpdateRequest(BaseModel):
    status: str  # only "picked_up" allowed via this endpoint


class ConfirmDeliveryRequest(BaseModel):
    scanned_code: str


class DeliveryOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    customer_name: str
    customer_phone: str
    address: str
    item_description: str
    status: str
    confirmation_code: str
    created_by_id: int
    assigned_rider_id: Optional[int]
