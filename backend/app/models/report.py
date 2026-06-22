from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_url: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="uploading", nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=True)

    # Real-Time Processing fields
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processing_started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    processing_completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    estimated_completion_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str] = mapped_column(String(500), nullable=True)
    processing_duration: Mapped[int] = mapped_column(Integer, nullable=True)


    user = relationship("User", back_populates="reports")
    biomarkers = relationship("Biomarker", back_populates="report", cascade="all, delete-orphan")
    analysis = relationship("Analysis", back_populates="report", uselist=False, cascade="all, delete-orphan")
