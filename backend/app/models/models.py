import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, relationship

# Use Integer for SQLite compatibility (autoincrement) and BigInteger for MySQL/TiDB.
# SQLAlchemy's BigInteger maps to INTEGER on SQLite which breaks RETURNING + autoincrement.
_PK_TYPE = Integer


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    retailer_staff = "retailer_staff"
    dispatcher = "dispatcher"
    rider = "rider"


class DeliveryStatus(str, enum.Enum):
    requested = "requested"
    assigned = "assigned"
    picked_up = "picked_up"
    delivered = "delivered"


class User(Base):
    __tablename__ = "users"

    id = Column(_PK_TYPE, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    phone = Column(String(20), nullable=False, unique=True)
    role = Column(Enum(UserRole), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Deliveries this user created (retailer_staff)
    created_deliveries = relationship(
        "DeliveryRequest",
        foreign_keys="DeliveryRequest.created_by_id",
        back_populates="creator",
    )

    # Deliveries assigned to this user (rider)
    assigned_deliveries = relationship(
        "DeliveryRequest",
        foreign_keys="DeliveryRequest.assigned_rider_id",
        back_populates="assigned_rider",
    )

    # Products created by this user (retailer_staff)
    products = relationship(
        "Product",
        foreign_keys="Product.created_by_id",
        back_populates="creator",
    )


class DeliveryRequest(Base):
    __tablename__ = "delivery_requests"

    id = Column(_PK_TYPE, primary_key=True, autoincrement=True)
    customer_name = Column(String(120), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    address = Column(Text, nullable=False)
    item_description = Column(Text, nullable=False)
    status = Column(
        Enum(DeliveryStatus), nullable=False, default=DeliveryStatus.requested
    )
    confirmation_code = Column(String(255), nullable=False)
    created_by_id = Column(_PK_TYPE, ForeignKey("users.id"), nullable=False)
    assigned_rider_id = Column(_PK_TYPE, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="created_deliveries",
    )
    assigned_rider = relationship(
        "User",
        foreign_keys=[assigned_rider_id],
        back_populates="assigned_deliveries",
    )
    confirmation = relationship(
        "DeliveryConfirmation",
        back_populates="delivery",
        uselist=False,
    )


class DeliveryConfirmation(Base):
    __tablename__ = "delivery_confirmations"

    id = Column(_PK_TYPE, primary_key=True, autoincrement=True)
    delivery_id = Column(
        _PK_TYPE, ForeignKey("delivery_requests.id"), nullable=False
    )
    scanned_code = Column(String(255), nullable=False)
    confirmed_at = Column(DateTime, nullable=False, server_default=func.now())

    delivery = relationship("DeliveryRequest", back_populates="confirmation")

    __table_args__ = (UniqueConstraint("delivery_id", name="uq_confirmation_delivery"),)


class Product(Base):
    """Stock item that a retailer has available for delivery."""
    __tablename__ = "products"

    id = Column(_PK_TYPE, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False, default="General")
    description = Column(Text, nullable=True)
    price = Column(Numeric(12, 2), nullable=True)          # KES price, optional
    stock_qty = Column(Integer, nullable=False, default=0)
    created_by_id = Column(_PK_TYPE, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    creator = relationship("User", foreign_keys=[created_by_id], back_populates="products")
