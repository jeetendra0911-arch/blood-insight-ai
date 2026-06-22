# Medical Validation Engine Specifications

**Document ID:** MED-VAL-001  
**Project:** Blood AI Platform  
**Target File:** `frontend/src/lib/medical-validation.ts`  

---

## 1. System Overview

The Medical Validation Engine acts as the clinical safety layer of the Blood Report Analyzer. Before any parsed biomarker value, unit, or reference range is sent to the database or displayed on the patient portal, it must pass through this validation engine.

The engine verifies the plausibility of the data against clinical limits, normalizes the metrics, and assesses whether the extraction confidence meets the threshold for safe interpretation ($\ge 80\%$).

---

## 2. Reference Standards & Clinical Range Matrix

The validation matrix supports gender-specific and age-specific bounds. Standard reference values are listed below:

| Biomarker | Standard Unit | Male Range | Female Range | Critical Low | Critical High |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Glucose** | mg/dL | $70 - 100$ | $70 - 100$ | $< 50$ | $> 250$ |
| **Hemoglobin** | g/dL | $13.5 - 17.5$ | $12.0 - 15.5$ | $< 7.0$ | $> 20.0$ |
| **Creatinine** | mg/dL | $0.7 - 1.3$ | $0.6 - 1.1$ | $< 0.4$ | $> 3.0$ |
| **Total Cholesterol**| mg/dL | $< 200$ | $< 200$ | N/A | $> 300$ |
| **LDL Cholesterol** | mg/dL | $< 100$ | $< 100$ | N/A | $> 190$ |
| **HDL Cholesterol** | mg/dL | $> 40$ | $> 50$ | $< 20$ | N/A |
| **Triglycerides** | mg/dL | $< 150$ | $< 150$ | N/A | $> 500$ |
| **WBC** | $10^9$/L | $4.5 - 11.0$ | $4.5 - 11.0$ | $< 2.0$ | $> 30.0$ |
| **RBC** | $10^{12}$/L | $4.3 - 5.9$ | $3.5 - 5.5$ | $< 2.5$ | $> 6.5$ |
| **Platelets** | $10^9$/L | $150 - 450$ | $150 - 450$ | $< 50$ | $> 1000$ |

---

## 3. Validation Pipeline Flow

The engine processes raw extracted tokens sequentially:

```
[Raw Token] ──> [Format Verification] ──> [Unit Normalization] ──> [Range Assessment] ──> [Confidence Scoring]
```

### 3.1 Format & Value Check
Verify the numeric token is valid and lies within biological possibility (e.g. pH cannot be $>14$ or $<0$). 

### 3.2 Unit Normalization
Convert metric or alternative units to standard base units:
* **Glucose:** mmol/L $\rightarrow$ mg/dL (Multiply by 18.0182)
* **Creatinine:** $\mu$mol/L $\rightarrow$ mg/dL (Divide by 88.4)
* **Hemoglobin:** g/L $\rightarrow$ g/dL (Divide by 10)

### 3.3 Confidence Scoring Formula
The confidence score $C$ is computed based on:
1. **Value Plausibility ($w_1$):** Is the value within extreme biological limits?
2. **Regex Confidence ($w_2$):** Did the string matching algorithm match high-quality keywords?
3. **Unit Match ($w_3$):** Did the unit extracted match standard expected units?

$$C = (w_1 \times P_{\text{val}}) + (w_2 \times P_{\text{regex}}) + (w_3 \times P_{\text{unit}})$$

If $C < 0.8$, the engine returns a warning flag: `"Unable to confidently interpret this biomarker. Manual review recommended."`
