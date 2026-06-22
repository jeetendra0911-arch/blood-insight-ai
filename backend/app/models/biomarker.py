from sqlalchemy import Integer, String, Float, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Biomarker(Base):
    __tablename__ = "biomarkers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String, nullable=True)
    reference_range: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String(15), nullable=True)
    raw_ocr_text: Mapped[str] = mapped_column(Text, nullable=True)
    severity: Mapped[float] = mapped_column(Float, nullable=True)
    patient_explanation: Mapped[dict] = mapped_column(JSON, nullable=True)

    report = relationship("Report", back_populates="biomarkers")
