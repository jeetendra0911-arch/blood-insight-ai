import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_analysis_pdf(
    pdf_path: str,
    user_name: str,
    report_name: str,
    analysis_data: dict,
    biomarkers: list[dict]
):
    """Generates a professional PDF report summarizing the blood report analysis."""
    # Ensure directory exists
    os.makedirs(os.path.dirname(pdf_path), exist_ok=True)

    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0F172A'),  # Slate-900
        spaceAfter=15
    )
    
    section_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1E293B'),  # Slate-800
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),  # Slate-700
        spaceAfter=10
    )

    bold_body_style = ParagraphStyle(
        'DocBodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    # Header Title
    story.append(Paragraph("Blood Report Analysis Summary", title_style))
    story.append(Paragraph(f"<b>Patient Name:</b> {user_name}", body_style))
    story.append(Paragraph(f"<b>Original File:</b> {report_name}", body_style))
    story.append(Paragraph(f"<b>Generated At:</b> {os.path.basename(pdf_path).split('_')[0] if '_' in os.path.basename(pdf_path) else 'Recent'}", body_style))
    story.append(Spacer(1, 15))
    
    # Patient Summary Section
    story.append(Paragraph("Executive Summary", section_style))
    patient_summary_text = analysis_data.get("patient_summary", "No summary available.")
    story.append(Paragraph(patient_summary_text, body_style))
    
    # Risk Assessment
    risk_level = analysis_data.get("risk_level", "Unknown")
    risk_color = '#DC2626' if risk_level.upper() == 'HIGH' else ('#D97706' if risk_level.upper() == 'MEDIUM' else '#16A34A')
    story.append(Paragraph(f"<b>Risk Level:</b> <font color='{risk_color}'><b>{risk_level}</b></font>", body_style))
    story.append(Spacer(1, 10))
    
    # Clinical Patterns Section
    clinical_patterns = analysis_data.get("clinical_patterns", [])
    if not clinical_patterns and isinstance(analysis_data.get("key_findings"), dict):
        clinical_patterns = analysis_data["key_findings"].get("clinical_patterns", [])
        
    if clinical_patterns:
        story.append(Paragraph("Clinical Patterns Detected", section_style))
        for pattern in clinical_patterns:
            name = pattern.get("name", "Unknown Pattern")
            evidence_list = pattern.get("evidence", [])
            evidence_str = ", ".join(evidence_list)
            significance = pattern.get("significance", "")
            follow_up = pattern.get("follow_up", "") or pattern.get("followUp", "")
            
            story.append(Paragraph(f"🧬 <b>{name}</b>", bold_body_style))
            story.append(Paragraph(f"<b>Evidence:</b> {evidence_str}", body_style))
            story.append(Paragraph(f"<b>Clinical Significance:</b> {significance}", body_style))
            story.append(Paragraph(f"<b>Recommended Follow-up:</b> {follow_up}", body_style))
            story.append(Spacer(1, 4))
        story.append(Spacer(1, 10))
    
    # Biomarkers Table Section
    story.append(Paragraph("Biomarkers Checked", section_style))
    
    table_data = [[
        Paragraph("<b>Biomarker</b>", bold_body_style),
        Paragraph("<b>Value</b>", bold_body_style),
        Paragraph("<b>Reference Range</b>", bold_body_style),
        Paragraph("<b>Status</b>", bold_body_style)
    ]]
    
    for b in biomarkers:
        status_text = b.get("status", "Normal")
        status_color = '#DC2626' if status_text.upper() in ['HIGH', 'CRITICAL', 'LOW'] else '#16A34A'
        
        table_data.append([
            Paragraph(b.get("name", "Unknown"), body_style),
            Paragraph(f"{b.get('value')} {b.get('unit', '') or ''}".strip(), body_style),
            Paragraph(b.get("reference_range", "N/A") or "N/A", body_style),
            Paragraph(f"<font color='{status_color}'><b>{status_text}</b></font>", body_style)
        ])
        
    t = Table(table_data, colWidths=[150, 100, 150, 100])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F8FAFC')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    
    story.append(t)
    story.append(Spacer(1, 15))
    
    # Recommendations Section
    recs = analysis_data.get("recommendations", [])
    if recs:
        story.append(Paragraph("Actionable Recommendations", section_style))
        for i, rec in enumerate(recs, start=1):
            category = rec.get("category", "General")
            content = rec.get("content", "")
            priority_val = rec.get("priority", 3)
            p_text = f"P{priority_val}"
            
            rec_text = f"<b>{i}. [{category}] (Priority {p_text}):</b> {content}"
            story.append(Paragraph(rec_text, body_style))
            
            safety = rec.get("safety_check", "")
            if safety:
                story.append(Paragraph(f"<i>Safety check: {safety}</i>", ParagraphStyle('Safety', parent=body_style, fontSize=9, textColor=colors.HexColor('#64748B'), leftIndent=15)))
                
            story.append(Spacer(1, 4))
            
    doc.build(story)
