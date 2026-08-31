from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import get_settings
from app.models.models import Base

settings = get_settings()

# Build engine kwargs — add SSL for TiDB Cloud (mysql+pymysql with ssl params in URL)
# The ?ssl_verify_cert=true&ssl_verify_identity=true in the URL handles TiDB Cloud TLS.
# connect_args passes the system CA bundle so the server certificate is trusted.
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
