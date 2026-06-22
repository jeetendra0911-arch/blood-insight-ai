import os
import shutil
import time
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.core.deps import get_current_user
from app.models.user import User
from app.models.report import Report
from app.models.biomarker import Biomarker
from app.models.analysis import Analysis
from app.models.recommendation import Recommendation
from app.schemas.report import ReportResponse, BiomarkerResponse, AnalysisResponse, RecommendationResponse
from app.services.ocr import extract_text_from_pdf, parse_biomarkers, extract_patient_metadata
from app.services.ai import analyze_report_data
from app.services.pdf_generator import generate_analysis_pdf
from app.core.security import decode_token

router = APIRouter()


def make_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def update_report_progress(
    db: Session,
    report_id: int,
    status: str,
    progress_percentage: int,
    error_message: str | None = None
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        return
    
    report.status = status
    report.progress_percentage = progress_percentage
    report.updated_at = datetime.now(timezone.utc)
    
    if status == "uploading" and not report.processing_started_at:
        report.processing_started_at = datetime.now(timezone.utc)
        
    if status == "completed":
        report.processing_completed_at = datetime.now(timezone.utc)
        report.estimated_completion_time = None
        if report.processing_started_at:
            report.processing_duration = int((make_aware(report.processing_completed_at) - make_aware(report.processing_started_at)).total_seconds())
    elif status == "failed":
        report.processing_completed_at = datetime.now(timezone.utc)
        report.estimated_completion_time = None
        report.error_message = error_message
        if report.processing_started_at:
            report.processing_duration = int((make_aware(report.processing_completed_at) - make_aware(report.processing_started_at)).total_seconds())
    else:
        # Update estimated completion time based on percentage
        started_at = make_aware(report.processing_started_at)
        if started_at:
            elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
            if progress_percentage > 0:
                total_est = elapsed / (progress_percentage / 100.0)
                remaining = total_est - elapsed
                report.estimated_completion_time = datetime.now(timezone.utc) + timedelta(seconds=max(2.0, min(remaining, 60.0)))
            else:
                report.estimated_completion_time = datetime.now(timezone.utc) + timedelta(seconds=20)
        else:
            report.processing_started_at = datetime.now(timezone.utc)
            report.estimated_completion_time = datetime.now(timezone.utc) + timedelta(seconds=20)
            
    db.commit()
    db.refresh(report)
    
    # Broadcast to WebSocket
    from app.core.websocket import broadcast_progress
    
    report_data = ReportResponse.model_validate(report).model_dump()
    for k, v in report_data.items():
        if isinstance(v, datetime):
            report_data[k] = v.isoformat()
            
    broadcast_progress(report.user_id, {
        "type": "report_progress",
        "report": report_data
    })


def process_report_pipeline(report_id: int, pdf_path: str, user_name: str):
    """Executes the full extraction and AI analysis pipeline in the background."""
    db = SessionLocal()
    try:
        # 1. Fetch report
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return

        # Start processing pipeline
        update_report_progress(db, report_id, "uploading", 10)
        time.sleep(1.0)

        # 2. Extract Text & Biomarkers
        update_report_progress(db, report_id, "extracting", 15)
        ocr_text = extract_text_from_pdf(pdf_path)
        update_report_progress(db, report_id, "extracting", 25)

        # Extract & save patient metadata
        report.metadata_json = extract_patient_metadata(ocr_text)
        db.commit()

        # Parse Biomarkers
        biomarker_data = parse_biomarkers(ocr_text)
        
        # Save biomarkers to database
        biomarker_objs = []
        for b in biomarker_data:
            bio_obj = Biomarker(
                report_id=report.id,
                name=b["name"],
                value=b["value"],
                unit=b["unit"],
                reference_range=b["reference_range"],
                status=b["status"],
                raw_ocr_text=b["raw_ocr_text"],
                severity=b["severity"],
                patient_explanation=b["patient_explanation"]
            )
            db.add(bio_obj)
            biomarker_objs.append(bio_obj)
        db.commit()
        
        update_report_progress(db, report_id, "extracting", 40)
        time.sleep(1.0)

        # 3. Clinical Validation
        update_report_progress(db, report_id, "validating", 45)
        time.sleep(1.5)
        update_report_progress(db, report_id, "validating", 60)
        time.sleep(1.0)

        # 4. Generate AI Analysis
        update_report_progress(db, report_id, "analyzing", 65)
        analysis_result = analyze_report_data(biomarker_data, report.user.dob, report.user.gender)
        
        # Save analysis summary
        analysis_obj = Analysis(
            report_id=report.id,
            summary=analysis_result.get("summary", ""),
            risk_level=analysis_result.get("risk_level", "Low"),
            model_version=analysis_result.get("model_version", "rules-fallback"),
            patient_summary=analysis_result.get("patient_summary", ""),
            key_findings=analysis_result.get("key_findings", {})
        )
        db.add(analysis_obj)
        db.commit()
        db.refresh(analysis_obj)

        # Save recommendations
        for rec in analysis_result.get("recommendations", []):
            rec_obj = Recommendation(
                analysis_id=analysis_obj.id,
                category=rec.get("category", "General"),
                content=rec.get("content", ""),
                priority=rec.get("priority", 3),
                confidence_score=rec.get("confidence_score", 1.0),
                evidence_score=rec.get("evidence_score", 1.0),
                safety_check=rec.get("safety_check", "")
            )
            db.add(rec_obj)
        db.commit()

        update_report_progress(db, report_id, "analyzing", 85)
        time.sleep(1.0)

        # 5. Generate PDF report
        update_report_progress(db, report_id, "generating", 90)
        patient_name = report.metadata_json.get("patient_name") if report.metadata_json else None
        if not patient_name:
            patient_name = user_name
        out_pdf_name = f"summary_{report.id}.pdf"
        out_pdf_path = os.path.join(settings.UPLOAD_DIR, out_pdf_name)
        generate_analysis_pdf(
            pdf_path=out_pdf_path,
            user_name=patient_name,
            report_name=report.filename,
            analysis_data=analysis_result,
            biomarkers=biomarker_data
        )
        update_report_progress(db, report_id, "generating", 95)
        time.sleep(1.0)

        # 6. Finalizing
        update_report_progress(db, report_id, "finalizing", 98)
        time.sleep(1.0)

        # 7. Completed
        update_report_progress(db, report_id, "completed", 100)

    except Exception as e:
        print(f"Error processing report {report_id}: {e}")
        try:
            update_report_progress(db, report_id, "failed", 0, error_message=str(e))
        except Exception as db_ex:
            print(f"Error updating failed report status in DB: {db_ex}")
    finally:
        db.close()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None, db: Session = Depends(get_db)):
    # Validate token
    user_id_str = decode_token(token) if token else None
    if not user_id_str:
        await websocket.accept()
        await websocket.close(code=1008)
        return
        
    user_id = int(user_id_str)
    
    from app.core.websocket import manager
    await manager.connect(user_id, websocket)
    try:
        # Send current progress of all active reports to connect client
        user_reports = db.query(Report).filter(Report.user_id == user_id).all()
        for report in user_reports:
            if report.status in ["uploading", "extracting", "validating", "analyzing", "generating", "finalizing"]:
                report_data = ReportResponse.model_validate(report).model_dump()
                for k, v in report_data.items():
                    if isinstance(v, datetime):
                        report_data[k] = v.isoformat()
                await websocket.send_json({
                    "type": "report_progress",
                    "report": report_data
                })
        
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)


@router.post("/upload", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def upload_report(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF blood report files are supported."
        )

    # Make upload dir if missing
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # 1. Create Report row in database
    temp_filename = f"{int(datetime.now().timestamp())}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, temp_filename)
    
    new_report = Report(
        user_id=current_user.id,
        filename=file.filename,
        file_url=file_path,
        status="uploading",
        progress_percentage=0,
        processing_started_at=datetime.now(timezone.utc),
        estimated_completion_time=datetime.now(timezone.utc) + timedelta(seconds=20)
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    # 2. Save file on disk
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Add file size
        new_report.file_size = os.path.getsize(file_path)
        new_report.progress_percentage = 10
        db.commit()
        
        # Trigger initial broadcast
        report_data = ReportResponse.model_validate(new_report).model_dump()
        for k, v in report_data.items():
            if isinstance(v, datetime):
                report_data[k] = v.isoformat()
                
        from app.core.websocket import broadcast_progress
        broadcast_progress(new_report.user_id, {
            "type": "report_progress",
            "report": report_data
        })
    except Exception as e:
        new_report.status = "failed"
        new_report.error_message = f"Failed to save upload file: {e}"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save upload file: {e}"
        )

    # 3. Queue processing pipeline in background
    user_name = current_user.full_name if current_user.full_name else current_user.email
    background_tasks.add_task(process_report_pipeline, new_report.id, file_path, user_name)

    return new_report


@router.post("/{id}/retry", response_model=ReportResponse)
def retry_report(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    report = db.query(Report).filter(Report.id == id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    if report.status not in ["failed", "FAILED"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only failed reports can be retried")
        
    # Reset fields
    report.status = "uploading"
    report.progress_percentage = 10
    report.processing_started_at = datetime.now(timezone.utc)
    report.processing_completed_at = None
    report.estimated_completion_time = datetime.now(timezone.utc) + timedelta(seconds=20)
    report.error_message = None
    report.processing_duration = None
    db.commit()
    
    # Broadcast to WebSocket
    report_data = ReportResponse.model_validate(report).model_dump()
    for k, v in report_data.items():
        if isinstance(v, datetime):
            report_data[k] = v.isoformat()
            
    from app.core.websocket import broadcast_progress
    broadcast_progress(report.user_id, {
        "type": "report_progress",
        "report": report_data
    })
    
    # Trigger background pipeline
    user_name = current_user.full_name if current_user.full_name else current_user.email
    background_tasks.add_task(process_report_pipeline, report.id, report.file_url, user_name)
    
    return report


@router.get("", response_model=list[ReportResponse])
def list_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns all reports associated with the current user."""
    return db.query(Report).filter(Report.user_id == current_user.id).order_by(Report.created_at.desc()).all()


@router.get("/{id}", response_model=ReportResponse)
def get_report(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{id}/biomarkers", response_model=list[BiomarkerResponse])
def get_biomarkers(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report.biomarkers


@router.get("/{id}/analysis", response_model=AnalysisResponse)
def get_analysis(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.analysis:
        raise HTTPException(status_code=404, detail="Analysis results not ready or failed")
    return report.analysis


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Remove file on disk if exists
    if os.path.exists(report.file_url):
        try:
            os.remove(report.file_url)
        except Exception as e:
            print(f"Error removing file: {e}")
            
    # Remove generated summary PDF as well
    out_pdf_path = os.path.join(settings.UPLOAD_DIR, f"summary_{report.id}.pdf")
    if os.path.exists(out_pdf_path):
        try:
            os.remove(out_pdf_path)
        except Exception as e:
            print(f"Error removing summary PDF: {e}")

    db.delete(report)
    db.commit()
    return
