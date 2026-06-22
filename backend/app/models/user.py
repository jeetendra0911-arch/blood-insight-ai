from datetime import datetime, timezone
from sqlalchemy import Integer, String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=True)
    full_name: Mapped[str] = mapped_column(String, nullable=True)
    dob: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    gender: Mapped[str] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String(7), default="PATIENT", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=True, onupdate=lambda: datetime.now(timezone.utc))

    auth_provider: Mapped[str] = mapped_column(String, default="email", nullable=False)
    google_id: Mapped[str] = mapped_column(String, unique=True, nullable=True, index=True)
    avatar: Mapped[str] = mapped_column(String, nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")
