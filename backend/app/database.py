import pymysql  # noqa: F401 — explicit import forces SQLAlchemy to find the pymysql dialect
                # without this, SQLAlchemy falls back to MySQLdb which is not installed
pymysql.install_as_MySQLdb()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import get_settings
from app.models.models import Base

settings = get_settings()

# Build engine kwargs — add SSL for TiDB Cloud.
# connect_args passes the system CA bundle so the TiDB server certificate is trusted.
_connect_args: dict = {}
if settings.DATABASE_URL.startswith("mysql"):
    import ssl
    _ssl_ctx = ssl.create_default_context()
    _connect_args = {"ssl": _ssl_ctx}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
