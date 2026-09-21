import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, String, JSON, ForeignKey, DateTime, Boolean, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .config import settings

def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc)
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str]
    role: Mapped[str] = mapped_column(default='user')
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
