from sqlalchemy import Integer, String, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=True)
    evidence_score: Mapped[float] = mapped_column(Float, nullable=True)
    safety_check: Mapped[str] = mapped_column(Text, nullable=True)

    analysis = relationship("Analysis", back_populates="recommendations")
