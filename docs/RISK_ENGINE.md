# AI Health Risk Engine Specifications

**Document ID:** RISK-ENG-001  
**Project:** Blood AI Platform  
**Target File:** `frontend/src/lib/risk-engine.ts`  

---

## 1. Risk Calculation Methodology

The AI Health Risk Engine computes risk levels (0-100) per organ system. It uses a weighted clinical algorithm that combines deviations of relevant biomarkers from their normal values.

Risk calculations are mapped to standard levels:
* **$0 - 30$**: 🟢 Low Risk
* **$31 - 60$**: 🟡 Moderate Risk
* **$61 - 100$**: 🔴 High Risk

---

## 2. Organ System & Biomarker Mappings

Each organ system computes its risk score based on the values and severities of specific biomarkers:

### 2.1 Cardiovascular Risk
* **Primary Biomarkers:** Total Cholesterol, LDL, HDL, Triglycerides.
* **Logic:** High LDL, high Triglycerides, or low HDL increase risk.
* **Equation:**
  $$\text{CardioRisk} = \max(0, \min(100, 20 \times \text{LDL\_Severity} + 20 \times \text{TG\_Severity} + 15 \times \text{HDL\_Severity} + 10))$$

### 2.2 Diabetes Risk
* **Primary Biomarkers:** Glucose.
* **Logic:** Fasting glucose level is the primary driver.
* **Equation:**
  * Glucose $\le 100$ mg/dL: Score = $10 + (\text{Glucose} - 70) \times 0.5$
  * Glucose $101 - 125$ mg/dL (Prediabetes): Score = $31 + (\text{Glucose} - 100) \times 1.2$
  * Glucose $\ge 126$ mg/dL (Diabetes range): Score = $61 + \min(39, (\text{Glucose} - 126) \times 0.8)$

### 2.3 Kidney Risk
* **Primary Biomarkers:** Creatinine.
* **Logic:** High creatinine indicates compromised kidney filtration rate.
* **Equation:**
  $$\text{KidneyRisk} = \max(0, \min(100, \text{Creatinine\_Severity} \times 90 + 10))$$
  * *Note: A Creatinine level of 6.5 mg/dL generates a severity score of 1.0, translating to a Kidney Risk score of 100 (Critical/High).*

### 2.4 Liver Risk
* **Primary Biomarkers:** Bilirubin, Enzymes (if present).
* **Logic:** Elevated bilirubin or enzymes drives risk upward.

### 2.5 Hematology Risk
* **Primary Biomarkers:** Hemoglobin, WBC, RBC, Platelets.
* **Logic:** Anemia (low Hb/RBC) or infection (high WBC) drives hematological risk.

---

## 3. Overall Health Score Calculation
The Overall Health Score (0-100) is a weighted average of individual system health scores (where $100$ represents perfect health):

$$\text{HealthScore} = 100 - \max(\text{System Risk Scores}) \times 0.6 - \text{mean}(\text{System Risk Scores}) \times 0.4$$

This ensures that a single critical system failure (e.g. renal failure with score 100) will drop the overall health score significantly, preventing critical issues from being obscured by averages.
