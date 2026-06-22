# UI/UX Improvements & Dashboard Redesign

**Project:** Blood AI Platform  
**Target File:** `frontend/src/app/page.tsx` & `frontend/src/app/reports/[id]/page.tsx`  

---

## 1. Aesthetic Philosophy & Premium Design

The redesigned interface transitions the application from a generic developer template to a high-end medical SaaS portal.

* **Palette:** Sleek dark/light transitions utilizing a HSL Slate base (`slate-50` to `slate-950`), custom blue gradients for primaries (`from-blue-600 to-indigo-600`), and semantic health colors (Emerald for Normal/Low, Amber for Warning/Moderate, Crimson for Critical/High).
* **Typography:** Utilizes Inter as the sans font for reading biomarkers and numbers, and Geist Mono for reference ranges to ensure maximum scannability.
* **Layout Grid:** Balanced two-column grid dashboard layout for report views (Left: Executive summary, biomarker listings, trend charts; Right: Key findings list, priority AI recommendations).

---

## 2. Redesigned Sections

### 2.1 Section 1: Patient Card
* Header badge showing Patient details: Full Name, Age (calculated from DOB), Gender, Report Upload Date, and inferred Lab source.

### 2.2 Section 2: AI Health Score
* Radial progress ring or premium card showing the calculated overall health score (e.g., `85/100`).
* Dynamic colored risk level badge:
  * 🟢 Low Risk (0-30)
  * 🟡 Moderate Risk (31-60)
  * 🔴 High Risk (61-100)

### 2.3 Section 3: Executive AI Summary
* Dedicated card with tabbed views for **Clinical Summary** (professional) and **Patient-Friendly Summary** (warm, easy to understand).

### 2.4 Section 4: System Health Analysis
* Organ system cards showing cardiovascular, metabolic, renal, hepatic, and hematologic statuses. Includes risk scores (0-100) per system.

### 2.5 Section 5: Biomarker Table
* Full interactive table supporting search by biomarker name, filtering by status (All, High, Low, Normal), and sorting by value or severity.

### 2.6 Section 6: AI Recommendations
* Grouped priority cards (Priority 1: Urgent, Priority 2: Standard, Priority 3: Wellness) showing targeted advice with confidence and evidence ratings, plus safety disclaimers.

### 2.7 Section 7: Recharts Trend Analysis
* Line charts comparing the historical results for key indicators (HDL, LDL, HbA1c, Creatinine, Hemoglobin, Vitamin D) across multiple reports.
