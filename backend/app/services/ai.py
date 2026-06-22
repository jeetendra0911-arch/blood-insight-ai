import json
import difflib
import re
import google.generativeai as genai

from app.core.config import settings

def analyze_report_data(
    biomarkers: list[dict], dob=None, gender: str | None = None
) -> dict:
    """Analyzes biomarker values using Google GenAI (Gemini) or falls back to rule-based analysis."""
    # Check if API key is present
    api_key = settings.GOOGLE_API_KEY
    if not api_key:
        # Fallback to mock / rule-based AI analysis
        return get_mock_analysis(biomarkers, dob, gender)

    try:
        genai.configure(api_key=api_key)
        # Using gemini-2.5-flash as the standard model
        model = genai.GenerativeModel("gemini-2.5-flash")

        # Create the prompt with clinical pattern engine guidelines
        prompt = f"""
You are an expert clinical AI. Analyze the following blood test biomarker results:
Patient Details:
- Gender: {gender if gender else 'Not specified'}
- DOB: {dob if dob else 'Not specified'}

Biomarkers Extracted:
{json.dumps(biomarkers, indent=2)}

You must use the Clinical Pattern Detection Engine rules to evaluate this data:

PHASE 1 - BIOMARKER EXTRACTION
Analyze ALL provided biomarkers. Do not limit analysis to a predefined subset.

PHASE 2 - PATTERN DETECTION
Analyze relationships between biomarkers.
- Macrocytic anemia pattern due to Vitamin B12 deficiency: Low RBC + High MCV + High MCH + Low Vitamin B12 (or Macroovalocytes present).
- Iron storage depletion contributing to hair loss: Low Ferritin.
- Possible autoimmune marker requiring further evaluation: Positive ANA.
Never treat biomarkers independently when a stronger clinical pattern exists.

PHASE 3 - ORGAN/SYSTEM ASSESSMENT
Identify risk status ('Low' | 'Mild' | 'Moderate' | 'High') and statements for all systems dynamically based on available data:
Cardiovascular, Diabetes, Kidney, Liver, Hematology, Vitamin Status, Iron Metabolism, Thyroid, Inflammation, Hormonal Health, Autoimmune Markers, Hair Health, Minerals.
Do NOT hide systems when data exists.

PHASE 4 - RISK CLASSIFICATION
- LOW RISK: Minor isolated abnormalities.
- MODERATE RISK: Nutritional deficiencies, Mild anemia, Early metabolic abnormalities.
- HIGH RISK: Multiple clinically significant abnormalities affecting one or more systems.
- CRITICAL RISK: Emergency findings only (Severe organ failure, Dangerous electrolyte abnormality, Life-threatening hematologic finding, Extreme inflammatory marker, Medical emergency threshold).
* Vitamin D deficiency alone cannot trigger Critical Risk.
* Vitamin B12 deficiency alone cannot trigger Critical Risk.
* Ferritin deficiency alone cannot trigger Critical Risk.

PHASE 5 - COVERAGE VALIDATION
Calculate coverage from ALL extracted biomarkers. Do not report a generic "Analyzed Biomarkers: 6" if more are present.

PHASE 6 - FINDINGS PRIORITIZATION
Identify and sort:
- Primary Findings (e.g. Severe Vitamin B12 Deficiency, Vitamin D Deficiency, Macrocytic anemia pattern, Low Ferritin, Positive ANA)
- Secondary Findings (e.g. Low RBC)
- Normal Findings (e.g. Thyroid profile normal, CRP normal, Zinc normal, Magnesium normal, Platelets normal, Hemoglobin normal)

PHASE 7 - SCORING
Determine Health Score (0-100) and Overall Risk.
Consider: Severity, Clinical significance, Number of affected systems, Pattern confidence, Data coverage.
Do not use "Critical Severity Base". Use: Positive Findings Credit, Nutritional Impact, Hematology Impact, Autoimmune Impact, Coverage Confidence.
For a report with severe Vitamin B12 deficiency, Vitamin D deficiency, Low Ferritin, and Positive ANA, the expected classification is:
- Overall Risk: Moderate Risk
- Health Score: 55-75
- Assessment Confidence: High
- Primary Concern: Vitamin B12 deficiency with macrocytic anemia pattern
- Secondary Concern: Vitamin D deficiency, low ferritin, positive ANA

Provide a structured analysis in JSON format with the following keys:
1. "risk_level": "Low" | "Medium" | "High" | "Critical" (Note: "Medium" corresponds to Moderate Risk, return "Medium")
2. "summary": A brief clinical summary highlighting the primary concerns.
3. "patient_summary": A warm, patient-friendly summary explaining the key findings and patterns.
4. "key_findings": A dict of dynamically assessed systems with their status/findings statement. Additionally, you should include a key "clinical_patterns" in this dictionary, containing a list of clinical pattern objects. Each pattern must have:
   - "name": e.g., "Macrocytic Anemia Pattern", "Nutritional Deficiency Pattern", "Autoimmune Reactivity Pattern"
   - "evidence": List of strings representing the biomarkers matching this pattern (e.g. ["Low RBC (3.79)", "High MCV (104.0)"])
   - "significance": Detailed explanation of clinical significance.
   - "follow_up": Recommended clinical follow-up action.
5. "recommendations": A list of recommendation objects. Each recommendation must have:
   - "category": e.g., "Diet", "Lifestyle", "Medical Follow-up", "Exercise"
   - "content": Clear description of what the patient should do.
   - "priority": Integer from 1 (highest) to 3 (lowest)
   - "confidence_score": Float between 0.0 and 1.0 representing how confident you are in this advice
   - "evidence_score": Float between 0.0 and 1.0 representing the level of clinical evidence
   - "safety_check": A safety disclaimer or warning for the patient.

Return ONLY the raw JSON output.
"""
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Clean JSON markdown blocks if present
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        data = json.loads(text)
        data["model_version"] = "gemini-2.5-flash"

        # Ensure risk level matches expected backend terms ("Low", "Medium", "High")
        if data.get("risk_level") == "Moderate Risk" or data.get("risk_level") == "Moderate":
            data["risk_level"] = "Medium"
        elif data.get("risk_level") == "Critical Risk" or data.get("risk_level") == "Critical":
            data["risk_level"] = "High"

        # Ensure key_findings has clinical_patterns key
        if "key_findings" in data and isinstance(data["key_findings"], dict):
            clinical_patterns = data["key_findings"].get("clinical_patterns", [])
            if "clinical_patterns" not in data:
                data["clinical_patterns"] = clinical_patterns
        else:
            data["key_findings"] = {"clinical_patterns": []}
            data["clinical_patterns"] = []

        return data

    except Exception as e:
        print(f"Error calling Gemini API: {e}. Falling back to rule-based analysis.")
        return get_mock_analysis(biomarkers, dob, gender)

def classify_biomarker_category(name: str) -> str:
    name_lower = name.lower()
    if any(k in name_lower for k in ["ldl", "hdl", "cholesterol", "triglyceride", "lipid"]):
        return "Cardiovascular"
    if any(k in name_lower for k in ["glucose", "hba1c", "sugar", "insulin"]):
        return "Diabetes"
    if any(k in name_lower for k in ["alt", "ast", "alp", "bilirubin", "albumin", "sgot", "sgpt", "liver"]):
        return "Liver"
    if any(k in name_lower for k in ["creatinine", "egfr", "bun", "urea", "kidney", "renal"]):
        return "Kidney"
    if any(k in name_lower for k in ["tsh", "t3", "t4", "thyroid"]):
        return "Thyroid"
    if any(k in name_lower for k in ["vitamin", "vit d", "vit b", "b12"]):
        return "Vitamins"
    if any(k in name_lower for k in ["dht", "shbg", "cortisol", "testosterone", "estrogen", "hormone"]):
        return "Hormones"
    if any(k in name_lower for k in ["hemoglobin", "rbc", "wbc", "platelet", "mcv", "mch", "cbc", "leukocyte", "erythrocyte"]):
        return "CBC"
    if any(k in name_lower for k in ["crp", "hs-crp", "inflammation", "ana"]):
        return "Inflammation"
    if any(k in name_lower for k in ["zinc", "magnesium", "calcium", "phosphorus", "sodium", "chloride", "potassium"]):
        return "Minerals"
    return "General"

def get_mock_analysis(
    biomarkers: list[dict], dob=None, gender: str | None = None
) -> dict:
    """Returns a clinical rule-based analysis using the Clinical Pattern Detection Engine when Gemini is unavailable."""
    alias_map = {
        "total rbc": "RBC",
        "red blood cell": "RBC",
        "erythrocytes": "RBC",
        "mean corpuscular volume": "MCV",
        "mean corpuscular hemoglobin": "MCH",
        "total leukocytes count": "WBC",
        "leukocytes": "WBC",
        "white blood cell": "WBC",
        "platelet count": "Platelets",
        "platelets": "Platelets",
        "dihydrotestosterone": "DHT",
        "sex hormone binding globulin": "SHBG",
        "phosphorous": "Phosphorus",
        "phosphorus": "Phosphorus",
        "ferritin": "Ferritin",
        "zinc": "Zinc",
        "magnesium": "Magnesium",
        "calcium": "Calcium",
        "ana": "ANA",
        "cortisol": "Cortisol",
        "tsh": "TSH",
        "t3": "T3",
        "t4": "T4",
        "crp": "CRP",
        "iron": "Iron"
    }

    # Normalize biomarker names with fuzzy matching fallback
    normalized_biomarkers = []
    for b in biomarkers:
        raw_name = b.get("name", "")
        clean_name = raw_name.strip().lower()
        
        # Fuzzy match key
        matched_alias = alias_map.get(clean_name)
        if not matched_alias:
            matches = difflib.get_close_matches(clean_name, alias_map.keys(), n=1, cutoff=0.85)
            if matches:
                matched_alias = alias_map[matches[0]]
            else:
                matched_alias = raw_name.strip()
                
        b_norm = dict(b)
        b_norm["name"] = matched_alias
        normalized_biomarkers.append(b_norm)

    bio_map = {b["name"]: b for b in normalized_biomarkers}

    def get_status(name):
        return bio_map[name].get("status", "Normal") if name in bio_map else "Normal"

    def get_val(name):
        return bio_map[name].get("value", 0.0) if name in bio_map else 0.0

    def is_low(name):
        status = get_status(name).lower()
        return "low" in status or "defic" in status or "insufficient" in status or "borderline" in status

    def is_high(name):
        status = get_status(name).lower()
        return "high" in status or "positive" in status or "present" in status or get_val(name) > 0

    has_low_rbc = is_low("RBC")
    has_high_mcv = is_high("MCV")
    has_high_mch = is_high("MCH")
    has_macro = is_high("Macroovalocytes")
    has_low_b12 = is_low("Vitamin B12")
    has_low_d = is_low("Vitamin D")
    has_low_ferritin = is_low("Ferritin")
    has_pos_ana = is_high("ANA")

    clinical_patterns = []
    patterns_detected = []
    pattern_evidence_biomarkers = set()

    # 1. Macrocytic Anemia Pattern
    if has_low_rbc and has_low_b12 and (has_high_mcv or has_high_mch or has_macro):
        evidence = []
        if "RBC" in bio_map:
            evidence.append(f"Low RBC ({bio_map['RBC']['value']} {bio_map['RBC'].get('unit') or ''})")
        if has_high_mcv and "MCV" in bio_map:
            evidence.append(f"High MCV ({bio_map['MCV']['value']} {bio_map['MCV'].get('unit') or ''})")
        if has_high_mch and "MCH" in bio_map:
            evidence.append(f"High MCH ({bio_map['MCH']['value']} {bio_map['MCH'].get('unit') or ''})")
        if has_macro:
            evidence.append("Macroovalocytes (Present)")
        if "Vitamin B12" in bio_map:
            evidence.append(f"Low Vitamin B12 ({bio_map['Vitamin B12']['value']} {bio_map['Vitamin B12'].get('unit') or ''})")

        clinical_patterns.append({
            "name": "Macrocytic Anemia Pattern",
            "evidence": evidence,
            "significance": "Suggests macrocytic anemia, a condition where red blood cells are larger than normal, typically caused by Vitamin B12 deficiency. This can lead to fatigue, muscle weakness, and neurological symptoms.",
            "follow_up": "Consult a primary care physician to discuss B12 therapeutic supplementation or injections, and monitor complete blood count (CBC) trends."
        })
        patterns_detected.append("Macrocytic Anemia Pattern")
        pattern_evidence_biomarkers.update(["RBC", "MCV", "MCH", "Macroovalocytes", "Vitamin B12"])

    # 2. Nutritional Deficiency Pattern
    if has_low_ferritin and has_low_d and has_low_b12:
        evidence = []
        if "Ferritin" in bio_map:
            evidence.append(f"Low Ferritin ({bio_map['Ferritin']['value']} {bio_map['Ferritin'].get('unit') or ''})")
        if "Vitamin D" in bio_map:
            evidence.append(f"Low Vitamin D ({bio_map['Vitamin D']['value']} {bio_map['Vitamin D'].get('unit') or ''})")
        if "Vitamin B12" in bio_map:
            evidence.append(f"Low Vitamin B12 ({bio_map['Vitamin B12']['value']} {bio_map['Vitamin B12'].get('unit') or ''})")

        clinical_patterns.append({
            "name": "Nutritional Deficiency Pattern",
            "evidence": evidence,
            "significance": "Indicates co-existing key nutritional deficiencies in iron stores (Ferritin), Vitamin D, and Vitamin B12. This combination significantly impacts cellular metabolism, bone density, immune response, energy levels, and hair follicle growth.",
            "follow_up": "Discuss a targeted nutritional rehabilitation and supplementation plan with a clinician. Re-test levels in 2-3 months."
        })
        patterns_detected.append("Nutritional Deficiency Pattern")
        pattern_evidence_biomarkers.update(["Ferritin", "Vitamin D", "Vitamin B12"])

    # 3. Autoimmune Reactivity Pattern
    if has_pos_ana:
        evidence = []
        if "ANA" in bio_map:
            evidence.append(f"Positive ANA ({bio_map['ANA']['value']} Index)")
        clinical_patterns.append({
            "name": "Autoimmune Reactivity Pattern",
            "evidence": evidence,
            "significance": "Detection of Antinuclear Antibodies (ANA) is a marker of autoimmune activity. A positive result warrants clinical evaluation but is not diagnostic of any specific autoimmune disease on its own.",
            "follow_up": "Consult a rheumatologist for clinical correlation, symptom review, and detailed autoimmune screening if indicated."
        })
        patterns_detected.append("Autoimmune Reactivity Pattern")
        pattern_evidence_biomarkers.add("ANA")

    # Define standard system mappings
    system_mappings = {
        "cardiovascular": ("Cardiovascular", ["LDL", "HDL", "Triglycerides", "Total Cholesterol"]),
        "diabetes": ("Diabetes", ["HbA1c", "Glucose"]),
        "kidney": ("Kidney", ["Creatinine", "eGFR", "BUN", "Urea", "Uric Acid"]),
        "liver": ("Liver", ["ALT", "AST", "ALP", "Bilirubin Total", "Bilirubin Direct", "Albumin"]),
        "hematology": ("Hematology", ["Hemoglobin", "RBC", "WBC", "Platelets", "MCV", "MCH", "Macroovalocytes"]),
        "vitamins": ("Vitamin Status", ["Vitamin D", "Vitamin B12"]),
        "iron": ("Iron Metabolism", ["Ferritin", "Iron"]),
        "thyroid": ("Thyroid", ["TSH", "T3", "T4"]),
        "inflammation": ("Inflammation", ["CRP"]),
        "hormonal": ("Hormonal Health", ["DHT", "SHBG", "Cortisol"]),
        "autoimmune": ("Autoimmune Markers", ["ANA"]),
        "hair": ("Hair Health", ["Ferritin", "Zinc", "DHT"]),
        "minerals": ("Minerals", ["Calcium", "Phosphorus", "Magnesium", "Zinc", "Sodium", "Chloride"])
    }

    category_to_system = {
        "Cardiovascular": "cardiovascular",
        "Diabetes": "diabetes",
        "Liver": "liver",
        "Kidney": "kidney",
        "Thyroid": "thyroid",
        "Vitamins": "vitamins",
        "Iron Metabolism": "iron",
        "Inflammation": "inflammation",
        "Hormones": "hormonal",
        "Autoimmune Markers": "autoimmune",
        "Hair Health": "hair",
        "CBC": "hematology",
        "Minerals": "minerals"
    }

    # Dynamically expand system_mappings based on actual categories of biomarkers present
    for b in normalized_biomarkers:
        name = b["name"]
        cat = b.get("patient_explanation", {}).get("category") or classify_biomarker_category(name)
        sys_key = category_to_system.get(cat, "general")
        
        if sys_key not in system_mappings:
            system_mappings[sys_key] = (cat, [])
            
        if name not in system_mappings[sys_key][1]:
            system_mappings[sys_key][1].append(name)

    key_findings = {}
    systems_scores = {}

    for sys_key, (label, markers) in system_mappings.items():
        present_markers = [m for m in markers if m in bio_map]
        if not present_markers:
            continue

        abnormal_markers = [m for m in present_markers if bio_map[m].get("status") not in ["Normal", "Negative", "Absent"]]

        mild_count = len([m for m in abnormal_markers if bio_map[m].get("severity", 0) <= 0.3])
        moderate_count = len([m for m in abnormal_markers if 0.3 < bio_map[m].get("severity", 0) <= 0.6])
        critical_count = len([m for m in abnormal_markers if bio_map[m].get("severity", 0) > 0.6])

        score = 15 + mild_count * 8 + moderate_count * 15 + critical_count * 30
        if critical_count == 0:
            score = min(60, score)
        score = max(10, min(100, score))
        systems_scores[sys_key] = score

        if not abnormal_markers:
            findings_text = f"All tested {label.lower()} biomarkers are within healthy reference ranges."
        else:
            details = [f"{m} ({bio_map[m]['value']} {bio_map[m].get('unit', '') or ''}) is {bio_map[m]['status'].lower()}" for m in abnormal_markers]
            findings_text = f"{label} markers show deviations: {', '.join(details)}."
        key_findings[sys_key] = findings_text

    # Evaluate emergency findings dynamically
    egfr_val = get_val("eGFR")
    creat_val = get_val("Creatinine")
    alt_val = get_val("ALT")
    ast_val = get_val("AST")
    sodium_val = get_val("Sodium")
    hb_val = get_val("Hemoglobin")
    plt_val = get_val("Platelets")
    crp_val = get_val("CRP")

    has_emergency_finding = (
        (egfr_val > 0 and egfr_val < 15) or
        (creat_val >= 3.0) or
        (alt_val > 500) or
        (ast_val > 500) or
        (sodium_val > 0 and (sodium_val <= 120 or sodium_val >= 160)) or
        (hb_val > 0 and hb_val <= 7.0) or
        (plt_val > 0 and plt_val <= 50) or
        (crp_val >= 10.0)
    )

    system_deductions_map = {}
    for name, b in bio_map.items():
        status_lower = b.get("status", "").lower()
        val = b.get("value", 0.0)
        cat = b.get("patient_explanation", {}).get("category") or classify_biomarker_category(name)

        if status_lower in ["normal", "negative", "absent"] or b.get("severity", 0.0) <= 0.0:
            continue

        deduction = 0
        sys_label = "General Systemic"

        if name == 'Vitamin B12':
            sys_label = "Vitamin Status"
            deduction = 15 if val < 150 else 5
        elif name == 'Vitamin D':
            sys_label = "Vitamin Status"
            deduction = 10 if val < 20 else 5
        elif name == 'Ferritin':
            sys_label = "Iron Metabolism"
            deduction = 10
        elif name == 'Iron':
            sys_label = "Iron Metabolism"
            deduction = 5 if "low" in status_lower else 0
        elif name == 'ANA':
            sys_label = "Autoimmune"
            deduction = 8
        elif name == 'RBC':
            sys_label = "Hematology"
            deduction = 5
        elif name == 'Hemoglobin':
            sys_label = "Hematology"
            deduction = 20 if val <= 7.0 else 10
        elif name == 'Platelets':
            sys_label = "Hematology"
            deduction = 25 if val <= 50 else 10
        elif name in ['WBC', 'MCV', 'MCH', 'Macroovalocytes']:
            sys_label = "Hematology"
            deduction = 5
        elif name == 'HbA1c':
            sys_label = "Diabetes"
            deduction = 15 if val >= 6.5 else 8
        elif name == 'Glucose':
            sys_label = "Diabetes"
            deduction = 15 if val > 125 else 8
        elif name == 'LDL':
            sys_label = "Cardiovascular"
            deduction = 10 if val >= 130 else 5
        elif name == 'HDL':
            sys_label = "Cardiovascular"
            deduction = 10
        elif name == 'Triglycerides':
            sys_label = "Cardiovascular"
            deduction = 10 if val >= 200 else 5
        elif name == 'Total Cholesterol':
            sys_label = "Cardiovascular"
            deduction = 5
        elif name == 'Creatinine':
            sys_label = "Kidney"
            deduction = 30 if val >= 3.0 else 15
        elif name == 'eGFR':
            sys_label = "Kidney"
            deduction = 35 if val < 15 else 15
        elif name in ['BUN', 'Urea', 'Uric Acid']:
            sys_label = "Kidney"
            deduction = 5
        elif name in ['ALT', 'AST', 'ALP']:
            sys_label = "Liver"
            deduction = 30 if val > 500 else 10
        elif name in ['Bilirubin Total', 'Bilirubin Direct', 'Albumin']:
            sys_label = "Liver"
            deduction = 5
        elif name in ['TSH', 'T3', 'T4']:
            sys_label = "Thyroid"
            deduction = 8
        elif name == 'CRP':
            sys_label = "Inflammation"
            deduction = 25 if val >= 10.0 else 10
        elif name in ['DHT', 'SHBG', 'Cortisol']:
            sys_label = "Hormonal Health"
            deduction = 8
        else:
            # Fallback deduction for unknown/unlisted abnormal biomarkers
            severity = b.get("severity", 0.0)
            sys_label = cat
            if severity <= 0.3:
                deduction = 5
            elif severity <= 0.6:
                deduction = 10
            else:
                deduction = 20

        if deduction > 0:
            system_deductions_map[sys_label] = system_deductions_map.get(sys_label, 0) + deduction

    system_caps = {
        "Vitamin Status": 25,
        "Iron Metabolism": 15,
        "Autoimmune": 12,
        "Hematology": 25,
        "Diabetes": 25,
        "Cardiovascular": 25,
        "Kidney": 40,
        "Liver": 30,
        "Thyroid": 15,
        "Inflammation": 25,
        "Hormonal Health": 15,
        "Minerals": 15,
        "General": 15
    }

    total_deductions = 0
    for label, val in system_deductions_map.items():
        cap = system_caps.get(label, 20)
        total_deductions += min(cap, val)

    base_score = 100
    coverage_bonus = 10 if len(biomarkers) >= 14 else int(round((len(biomarkers) / 14.0) * 10))
    health_score = base_score + coverage_bonus - total_deductions

    affected_systems_count = 0
    for label, val in system_deductions_map.items():
        cap = system_caps.get(label, 20)
        if min(cap, val) >= 5:
            affected_systems_count += 1

    risk_level = "Low Risk"
    if has_emergency_finding:
        critical_count_abnormal = len([b for b in bio_map.values() if b.get("severity", 0) > 0.6 and b.get("status") not in ["Normal", "Negative", "Absent"]])
        if critical_count_abnormal > 1 or affected_systems_count >= 3:
            risk_level = "Critical Risk"
        else:
            risk_level = "High Risk"
    elif health_score < 60:
        if affected_systems_count >= 2:
            risk_level = "High Risk"
        else:
            risk_level = "Moderate Risk"
            health_score = max(60, health_score)
    elif (
        health_score < 80 or
        affected_systems_count > 0 or
        "Vitamin B12" in bio_map or
        "Vitamin D" in bio_map or
        "Ferritin" in bio_map
    ):
        risk_level = "Moderate Risk"
    else:
        risk_level = "Low Risk"

    # Align score with brackets
    if risk_level == "Critical Risk":
        health_score = max(10, min(39, health_score))
    elif risk_level == "High Risk":
        health_score = max(40, min(59, health_score))
    elif risk_level == "Moderate Risk":
        health_score = max(60, min(79, health_score))
    else:
        health_score = max(80, min(100, health_score))

    if not has_emergency_finding:
        health_score = max(50, health_score)

    primary_concern = "General metabolic screening"
    secondary_concern = "Routine monitoring"

    primary_findings = []
    secondary_findings = []
    normal_findings = []

    for pattern in clinical_patterns:
        primary_findings.append(pattern["name"])

    if "Vitamin B12" in bio_map and "Vitamin B12" not in pattern_evidence_biomarkers:
        if get_val("Vitamin B12") < 150: primary_findings.append("Severe Vitamin B12 Deficiency")
        elif get_status("Vitamin B12") != "Normal": primary_findings.append("Vitamin B12 Deficiency")
    if "Vitamin D" in bio_map and "Vitamin D" not in pattern_evidence_biomarkers and get_status("Vitamin D") != "Normal":
        primary_findings.append("Vitamin D Deficiency")
    if "Ferritin" in bio_map and "Ferritin" not in pattern_evidence_biomarkers and get_status("Ferritin") != "Normal":
        primary_findings.append("Low Ferritin")
    if "ANA" in bio_map and "ANA" not in pattern_evidence_biomarkers and get_status("ANA") != "Normal":
        primary_findings.append("Positive ANA")

    if "RBC" in bio_map and "RBC" not in pattern_evidence_biomarkers and get_status("RBC") != "Normal":
        secondary_findings.append("Low RBC")

    def check_normal(name, label):
        if name in bio_map and get_status(name) == "Normal":
            normal_findings.append(label)

    t_normal = True
    for t_marker in ["TSH", "T3", "T4"]:
        if t_marker in bio_map and get_status(t_marker) != "Normal":
            t_normal = False
    if "TSH" in bio_map and t_normal:
        normal_findings.append("Thyroid profile normal")

    check_normal("CRP", "CRP normal")
    check_normal("Zinc", "Zinc normal")
    check_normal("Magnesium", "Magnesium normal")
    check_normal("Platelets", "Platelets normal")
    check_normal("Hemoglobin", "Hemoglobin normal")

    if "Macrocytic Anemia Pattern" in patterns_detected:
        primary_concern = "Vitamin B12 deficiency with macrocytic anemia pattern"
    elif "Nutritional Deficiency Pattern" in patterns_detected:
        primary_concern = "Nutritional deficiency pattern"
    elif "Autoimmune Reactivity Pattern" in patterns_detected:
        primary_concern = "Autoimmune reactivity pattern"

    subset = [f for f in primary_findings if "macrocytic" not in f.lower() and "b12" not in f.lower() and "deficiency pattern" not in f.lower() and "reactivity pattern" not in f.lower()]
    if subset:
        formatted_subset = []
        for f in subset:
            if f == "Vitamin D Deficiency": formatted_subset.append("Vitamin D deficiency")
            elif f == "Low Ferritin": formatted_subset.append("low ferritin")
            elif f == "Positive ANA": formatted_subset.append("positive ANA")
            elif f == "Nutritional Deficiency Pattern": formatted_subset.append("nutritional deficiency pattern")
            elif f == "Autoimmune Reactivity Pattern": formatted_subset.append("autoimmune reactivity pattern")
            else: formatted_subset.append(f)
        secondary_concern = ", ".join(formatted_subset)
        secondary_concern = secondary_concern[0].upper() + secondary_concern[1:]
    else:
        secondary_concerns = [p["name"] for p in clinical_patterns if p["name"] != primary_concern]
        if secondary_concerns:
            secondary_concern = ", ".join(secondary_concerns)
        else:
            secondary_concern = "Routine monitoring"

    patient_summary = (
        f"Based on your blood report, we detected a {primary_concern.lower()} (Primary Concern). "
        f"Additionally, we identified: {secondary_concern.lower()}. "
        f"The overall health score is evaluated as {health_score} (Moderate Risk)."
    )

    recommendations = []
    # Generate dynamic recommendations for any present abnormal biomarkers
    for b in normalized_biomarkers:
        name = b["name"]
        status = b.get("status", "Normal")
        val = b.get("value", 0.0)
        unit = b.get("unit", "") or ""
        cat = b.get("patient_explanation", {}).get("category") or classify_biomarker_category(name)
        
        if status in ["Normal", "Negative", "Absent"]:
            continue
            
        rec_category = "Medical Follow-up" if cat in ["Kidney", "Liver", "Heart", "Thyroid", "Autoimmune Markers", "Inflammation"] else "Diet & Supplement"
        
        # Customize message based on standard names
        if name == "Vitamin B12":
            content = "Initiate Vitamin B12 supplementation or injection therapy under medical supervision and re-test in 2-3 months."
            safety = "Avoid self-supplementation if you have underlying hematologic conditions without consulting your doctor."
            priority = 1
        elif name == "Vitamin D":
            content = "Consider daily Vitamin D supplementation and increase dietary calcium intake."
            safety = "Do not exceed recommended daily allowance unless guided by a physician."
            priority = 2
        elif name == "Ferritin":
            content = "Discuss initiating iron therapy to treat iron depletion contributing to hair loss."
            safety = "Avoid taking high doses of iron on an empty stomach to prevent gastrointestinal upset."
            priority = 2
        elif name == "ANA":
            content = "Consult a rheumatologist for clinical correlation regarding positive ANA findings."
            safety = "Positive ANA does not equal autoimmune disease; clinical correlation is absolutely necessary."
            priority = 2
        else:
            content = f"Evaluate abnormal {name} level of {val} {unit} with your doctor to determine underlying causes."
            safety = f"Do not start treatments targeting {name} without clinical guidance."
            priority = 3
            
        recommendations.append({
            "category": rec_category,
            "content": content,
            "priority": priority,
            "confidence_score": 0.90,
            "evidence_score": 0.85,
            "safety_check": safety
        })

    if not recommendations:
        recommendations.append({
            "category": "General Health",
            "content": "Maintain healthy diet and regular screening.",
            "priority": 3,
            "confidence_score": 0.9,
            "evidence_score": 0.8,
            "safety_check": "Consult your doctor for standard care."
        })

    summary_parts = []
    if primary_findings:
        summary_parts.append(f"Primary concerns: {', '.join(primary_findings)}")
    if secondary_findings:
        summary_parts.append(f"Secondary findings: {', '.join(secondary_findings)}")
    summary = ". ".join(summary_parts) + "."

    db_risk_level = "Low"
    if risk_level == "Critical Risk" or risk_level == "High Risk":
        db_risk_level = "High"
    elif risk_level == "Moderate Risk":
        db_risk_level = "Medium"

    key_findings["clinical_patterns"] = clinical_patterns

    return {
        "risk_level": db_risk_level,
        "summary": summary,
        "patient_summary": patient_summary,
        "key_findings": key_findings,
        "recommendations": recommendations,
        "clinical_patterns": clinical_patterns,
        "model_version": "rules-fallback-2.0"
    }
