import re
from app.core.config import settings

def extract_text_from_pdf(pdf_path: str) -> str:
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return ""

def parse_reference_range(range_str: str) -> dict | None:
    if not range_str:
        return None
    # Strip spaces and convert to lowercase
    clean = re.sub(r"\s+", "", range_str).lower()
    
    # Range pattern: low-high
    match = re.match(r"^([\d\.]+)-([\d\.]+)$", clean)
    if match:
        try:
            return {"low": float(match.group(1)), "high": float(match.group(2))}
        except ValueError:
            pass
        
    # Less than pattern
    match = re.match(r"^[<]=?([\d\.]+)$", clean)
    if match:
        try:
            return {"low": 0.0, "high": float(match.group(1))}
        except ValueError:
            pass
        
    # Greater than pattern
    match = re.match(r"^[>]=?([\d\.]+)$", clean)
    if match:
        try:
            return {"low": float(match.group(1)), "high": float('inf')}
        except ValueError:
            pass
        
    return None

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

def evaluate_biomarker_status(name: str, val: float, ref_range_str: str) -> tuple[str, float]:
    """Returns (status, severity) based on range bounds."""
    # Special ranges for well-known biomarkers
    name_clean = name.lower()
    if "glucose" in name_clean:
        if val < 70:
            return "Low", 0.8 if val < 50 else 0.4
        elif val > 125:
            return "High", 1.0 if val >= 250 else 0.6
        elif val >= 100:
            return "High", 0.3
        return "Normal", 0.0
    elif "hemoglobin" in name_clean:
        if val < 12.0:
            return "Low", 0.9 if val <= 7.0 else 0.4
        elif val > 17.5:
            return "High", 0.4
        return "Normal", 0.0

    # Dynamic parsing fallback
    bounds = parse_reference_range(ref_range_str)
    if bounds:
        low = bounds["low"]
        high = bounds["high"]
        
        if val < low:
            dev = (low - val) / low if low > 0 else 0.5
            severity = 0.3 if dev < 0.1 else (0.6 if dev < 0.3 else 0.9)
            return "Low", severity
        elif val > high:
            dev = (val - high) / high if high > 0 else 0.5
            severity = 0.3 if dev < 0.1 else (0.6 if dev < 0.3 else 0.9)
            return "High", severity
            
    return "Normal", 0.0

def parse_biomarkers(text: str) -> list[dict]:
    # Check if API key is present
    api_key = settings.GOOGLE_API_KEY
    if api_key:
        try:
            import google.generativeai as genai
            import json
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            prompt = f"""
You are an expert clinical AI. From the blood test report text below, extract ALL biomarkers present.
For each extracted biomarker, return a JSON object with:
- "name": Standardized name of the biomarker (e.g. "Hemoglobin", "Ferritin", "CRP", "Vitamin B12", "ANA", "TSH", "Zinc", etc.).
- "value": The numerical test value (float). If the value is a string status (like "Positive" or "Negative"), put the value as 1 for Positive / 0 for Negative, and keep the raw status in the status field.
- "unit": The unit (e.g. "mg/dL", "g/dL", "U/L", "10^9/L", "10^12/L", "cells/mcL", or "N/A" for positive/negative tests).
- "reference_range": The biological reference range as a string (e.g. "70 - 100", "< 200").
- "status": "Normal" | "High" | "Low" | "Positive" | "Negative" (based on the reference range).
- "category": Standardized clinical category (e.g. "Cardiovascular" | "Diabetes" | "Liver" | "Kidney" | "Thyroid" | "Vitamins" | "Hormones" | "CBC" | "Inflammation" | "Minerals" | "General").

Return ONLY a raw JSON array of these objects. Do not write any markdown code blocks.

Text to analyze:
{text}
"""
            response = model.generate_content(prompt)
            resp_text = response.text.strip()
            
            if resp_text.startswith("```json"):
                resp_text = resp_text[7:]
            if resp_text.endswith("```"):
                resp_text = resp_text[:-3]
            resp_text = resp_text.strip()
            
            data = json.loads(resp_text)
            
            formatted_biomarkers = []
            for b in data:
                val = float(b["value"])
                status = b.get("status", "Normal")
                name = b["name"]
                unit = b.get("unit")
                ref_range = b.get("reference_range")
                category = b.get("category", classify_biomarker_category(name))
                
                status_eval, severity = evaluate_biomarker_status(name, val, ref_range or "")
                if status == "Normal" and status_eval != "Normal":
                    status = status_eval
                    
                formatted_biomarkers.append({
                    "name": name,
                    "value": val,
                    "unit": unit,
                    "reference_range": ref_range,
                    "status": status,
                    "raw_ocr_text": f"{name}: {val} {unit or ''}",
                    "severity": severity,
                    "patient_explanation": {
                        "text": f"Your {name} level is {val} {unit or ''} which is evaluated as {status.lower()}.",
                        "category": category
                    }
                })
            if formatted_biomarkers:
                return formatted_biomarkers
        except Exception as e:
            print(f"Error parsing biomarkers with Gemini, falling back to dynamic regex: {e}")

    # --- DYNAMIC REGEX FALLBACK PARSER ---
    biomarkers = []
    lines = text.split("\n")
    
    # Common units list to assist parsing
    units_pattern = r"(?:mg/dL|g/dL|mcg/dL|pg/mL|ng/mL|uIU/mL|mIU/L|U/L|u/l|mmol/L|umol/L|µmol/L|%|Index|Ratio|10\^9/L|K/uL|10\^12/L|M/uL|cells/mcL|fL|pg|ng/dL|µg/dL|mg/L)"
    
    # Matches "[Name] [Value] [Unit] [Range]"
    pattern = re.compile(
        r"^\s*([A-Za-z0-9\s\-\/\(\)\.,]+?)(?:\s+|:|\.\.+)\(?([<>]?\s*\d+(?:\.\d+)?|Positive|Negative|Reactive|Non-reactive)\)?\s*(" + units_pattern + r")?\s*(?:[\(\[|]?([0-9\.\-\s<>\/a-zA-Z]+)[\)\]|]?)?",
        re.IGNORECASE
    )
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue
            
        match = pattern.match(line)
        if match:
            name = match.group(1).strip(":\n\r\t .")
            val_str = match.group(2).strip()
            unit = match.group(3).strip() if match.group(3) else None
            ref_range = match.group(4).strip("()[] ") if match.group(4) else None
            
            if not name or len(name) < 2 or name.isdigit() or name.lower() in ["page", "report", "date", "patient", "name", "age", "gender", "sex"]:
                continue
                
            try:
                if val_str.lower() in ["positive", "reactive"]:
                    val = 1.0
                    status = "Positive"
                elif val_str.lower() in ["negative", "non-reactive"]:
                    val = 0.0
                    status = "Negative"
                else:
                    clean_val_str = re.sub(r"[^\d\.]", "", val_str)
                    val = float(clean_val_str)
                    status = "Normal"
            except ValueError:
                continue
                
            status_eval, severity = evaluate_biomarker_status(name, val, ref_range or "")
            if status == "Normal":
                status = status_eval
                
            category = classify_biomarker_category(name)
            
            biomarkers.append({
                "name": name,
                "value": val,
                "unit": unit,
                "reference_range": ref_range,
                "status": status,
                "raw_ocr_text": line,
                "severity": severity,
                "patient_explanation": {
                    "text": f"Your {name} level is {val} {unit or ''} which is evaluated as {status.lower()}.",
                    "category": category
                }
            })
            
    return biomarkers

def extract_patient_metadata(text: str) -> dict:
    metadata = {
        "patient_name": None,
        "patient_age": None,
        "patient_gender": None,
        "lab_name": "General Diagnostic Center"
    }
    
    match = re.search(r'([A-Za-z ]+)\s*\(\s*(\d+)\s*Y\s*/\s*([MFmf])\s*\)', text)
    if not match:
        match = re.search(r'([A-Za-z ]+)\s*\(\s*(\d+)\s*Y\s*([MFmf])\s*\)', text)
        
    if match:
        metadata["patient_name"] = match.group(1).strip(":\n\r\t ")
        metadata["patient_age"] = int(match.group(2))
        g = match.group(3).upper()
        metadata["patient_gender"] = "Male" if g == "M" else ("Female" if g == "F" else None)
        
    # Check for lab name in text dynamically from top lines
    lines = text.split("\n")
    found_lab = False
    for line in lines[:15]:
        line_lower = line.lower()
        if any(k in line_lower for k in ["thyrocare", "labcorp", "quest diagnostics", "quest", "metropolis", "lal pathlabs", "pathology", "diagnostics", "laboratory", "labs", "clinic"]):
            clean_line = line.strip(" :\t\r\n*#")
            if len(clean_line) > 3 and len(clean_line) < 50:
                metadata["lab_name"] = clean_line
                found_lab = True
                break
                
    if not found_lab:
        text_lower = text.lower()
        if "thyrocare" in text_lower:
            metadata["lab_name"] = "Thyrocare"
        elif "labcorp" in text_lower:
            metadata["lab_name"] = "Labcorp"
        elif "quest" in text_lower:
            metadata["lab_name"] = "Quest Diagnostics"
            
    return metadata
