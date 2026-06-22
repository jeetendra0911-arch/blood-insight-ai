from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.auth import UserResponse


class BiomarkerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_id: int
    name: str
    value: float
    unit: str | None = None
    reference_range: str | None = None
    status: str | None = None
    severity: float | None = None
    patient_explanation: dict | None = None


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    analysis_id: int
    category: str
    content: str
    priority: int | None = None
    confidence_score: float | None = None
    evidence_score: float | None = None
    safety_check: str | None = None


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    report_id: int
    summary: str
    risk_level: str | None = None
    model_version: str | None = None
    created_at: datetime
    patient_summary: str | None = None
    key_findings: dict | None = None
    recommendations: list[RecommendationResponse] = []


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    file_url: str
    filename: str | None = None
    status: str
    metadata_json: dict | None = None
    created_at: datetime
    updated_at: datetime
    file_size: int | None = None
    user: UserResponse | None = None
    progress_percentage: int
    processing_started_at: datetime | None = None
    processing_completed_at: datetime | None = None
    estimated_completion_time: datetime | None = None
    error_message: str | None = None
    processing_duration: int | None = None



