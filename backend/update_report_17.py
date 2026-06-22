import sqlite3

def update_report_17():
    conn = sqlite3.connect("D:/Projects/Blood AI/backend/blood_analysis.db")
    cursor = conn.cursor()
    
    # 1. Update report status to completed and set filename
    cursor.execute("UPDATE reports SET filename = 'Comprehensive_Pattern_Report.pdf', status = 'completed' WHERE id = 17")
    
    # 2. Delete existing biomarkers for report 17
    cursor.execute("DELETE FROM biomarkers WHERE report_id = 17")
    
    # 3. Insert fresh biomarkers matching the requested clinical pattern
    biomarkers = [
        ('Hemoglobin', 13.6, 'g/dL', '12.0 - 15.5', 'Normal'),
        ('WBC', 8.02, '10^3/µL', '4.0 - 10.0', 'Normal'),
        ('RBC', 3.79, '10^6/µL', '3.8 - 4.8', 'Low'),
        ('Platelets', 278.0, '10^3/µL', '150 - 410', 'Normal'),
        ('Vitamin D', 12.3, 'ng/mL', '30 - 100', 'Low'),
        ('Vitamin B12', 145.0, 'pg/mL', '211 - 911', 'Low'),
        ('MCV', 104.0, 'fL', '80 - 100', 'High'),
        ('MCH', 35.0, 'pg', '27 - 33', 'High'),
        ('Ferritin', 8.0, 'ng/mL', '15 - 150', 'Low'),
        ('ANA', 1.0, 'Index', 'Negative', 'Positive'),
        ('TSH', 1.5, 'uIU/mL', '0.45 - 4.5', 'Normal'),
        ('CRP', 1.2, 'mg/L', '< 3.0', 'Normal'),
        ('Zinc', 85.0, 'mcg/dL', '60 - 120', 'Normal'),
        ('Magnesium', 2.0, 'mg/dL', '1.6 - 2.6', 'Normal')
    ]
    
    import json
    for name, val, unit, ref, status in biomarkers:
        cursor.execute("""
            INSERT INTO biomarkers (report_id, name, value, unit, reference_range, status, severity, raw_ocr_text, patient_explanation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (17, name, val, unit, ref, status, 0.0, f"{name}: {val} {unit}", json.dumps({"text": f"Observed {name} is {val}."})))
        
    conn.commit()
    print("Report 17 biomarkers successfully updated!")
    conn.close()

if __name__ == "__main__":
    update_report_17()
