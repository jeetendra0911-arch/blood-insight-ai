import os
import sys
from app.core.database import SessionLocal
from app.models.report import Report
from app.models.biomarker import Biomarker
from app.models.analysis import Analysis
from app.models.recommendation import Recommendation
from app.services.ai import analyze_report_data
from app.services.pdf_generator import generate_analysis_pdf
from app.core.config import settings

def run_analysis_for_report_17():
    db = SessionLocal()
    try:
        report = db.query(Report).filter(Report.id == 17).first()
        if not report:
            print("Report 17 not found!")
            return

        # Fetch seeded biomarkers
        db_biomarkers = db.query(Biomarker).filter(Biomarker.report_id == 17).all()
        biomarkers_data = []
        for b in db_biomarkers:
            biomarkers_data.append({
                "name": b.name,
                "value": b.value,
                "unit": b.unit,
                "reference_range": b.reference_range,
                "status": b.status,
                "severity": b.severity,
                "raw_ocr_text": b.raw_ocr_text,
                "patient_explanation": b.patient_explanation
            })

        print(f"Loaded {len(biomarkers_data)} biomarkers for report 17.")

        # Clean existing analysis and recommendations
        db.query(Recommendation).filter(Recommendation.analysis_id.in_(
            db.query(Analysis.id).filter(Analysis.report_id == 17)
        )).delete(synchronize_session=False)
        db.query(Analysis).filter(Analysis.report_id == 17).delete(synchronize_session=False)
        db.commit()

        # Run analyze_report_data
        analysis_result = analyze_report_data(biomarkers_data, report.user.dob, report.user.gender)
        print("Analysis generated.")
        print(f"Risk Level: {analysis_result.get('risk_level')}")
        print(f"Summary: {analysis_result.get('summary')}")

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
        print(f"Saved analysis and {len(analysis_result.get('recommendations', []))} recommendations to database.")

        # Generate summary PDF
        out_pdf_name = f"summary_{report.id}.pdf"
        out_pdf_path = os.path.join(settings.UPLOAD_DIR, out_pdf_name)
        patient_name = report.metadata_json.get("patient_name") if report.metadata_json else None
        if not patient_name:
            patient_name = report.user.full_name if report.user.full_name else report.user.email

        generate_analysis_pdf(
            pdf_path=out_pdf_path,
            user_name=patient_name,
            report_name=report.filename,
            analysis_data=analysis_result,
            biomarkers=biomarkers_data
        )
        print(f"PDF generated at: {out_pdf_path}")

    finally:
        db.close()

if __name__ == "__main__":
    run_analysis_for_report_17()
