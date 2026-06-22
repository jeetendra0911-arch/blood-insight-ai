from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, ForeignKey, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(String, nullable=True)
    model_version: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    patient_summary: Mapped[str] = mapped_column(Text, nullable=True)
    key_findings: Mapped[dict] = mapped_column(JSON, nullable=True)

    report = relationship("Report", back_populates="analysis")
    recommendations = relationship("Recommendation", back_populates="analysis", cascade="all, delete-orphan")
