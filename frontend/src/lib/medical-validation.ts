/**
 * Medical Validation Engine
 * Validates biomarker values, reference ranges, gender/age specific bounds,
 * and handles confidence calculations.
 */

import { normalizeBiomarker, NormalizedBiomarker } from './biomarker-normalizer';

export interface MedicalValidationResult {
  isValid: boolean;
  biomarker: NormalizedBiomarker;
  interpretedStatus: string; // E.g., "Normal", "Prediabetes", "Diabetes", "Deficient", "Borderline", "Protective"
  interpretedSeverity: 'Normal' | 'Mild' | 'Moderate' | 'High Risk' | 'Critical';
  interpretedRange: string;
  patientExplanation: string;
  requiresManualReview: boolean;
}

// Clinical Range configuration for general fallbacks
interface AgeGenderRange {
  low: number;
  high: number;
  criticalLow?: number;
  criticalHigh?: number;
}

interface ReferenceRangeConfig {
  default: AgeGenderRange;
  male?: AgeGenderRange;
  female?: AgeGenderRange;
}

const CLINICAL_RANGES: Record<string, ReferenceRangeConfig> = {
  'Glucose': {
    default: { low: 70, high: 99, criticalLow: 50, criticalHigh: 250 },
  },
  'HbA1c': {
    default: { low: 4.0, high: 5.6 },
  },
  'Hemoglobin': {
    default: { low: 12.0, high: 17.5, criticalLow: 7.0, criticalHigh: 20.0 },
    male: { low: 13.5, high: 17.5, criticalLow: 7.0, criticalHigh: 20.0 },
    female: { low: 12.0, high: 15.5, criticalLow: 7.0, criticalHigh: 20.0 },
  },
  'Creatinine': {
    default: { low: 0.6, high: 1.3, criticalLow: 0.4, criticalHigh: 3.0 },
    male: { low: 0.7, high: 1.3, criticalLow: 0.4, criticalHigh: 3.0 },
    female: { low: 0.6, high: 1.1, criticalLow: 0.4, criticalHigh: 3.0 },
  },
  'Total Cholesterol': {
    default: { low: 100, high: 199, criticalHigh: 300 },
  },
  'LDL': {
    default: { low: 0, high: 99, criticalHigh: 190 },
  },
  'HDL': {
    default: { low: 40, high: 100, criticalLow: 20 },
    male: { low: 40, high: 100, criticalLow: 20 },
    female: { low: 50, high: 100, criticalLow: 20 },
  },
  'Triglycerides': {
    default: { low: 0, high: 149, criticalHigh: 500 },
  },
  'Vitamin D': {
    default: { low: 30, high: 100 },
  },
  'Vitamin B12': {
    default: { low: 300, high: 900 },
  },
  'WBC': {
    default: { low: 4.5, high: 11.0, criticalLow: 2.0, criticalHigh: 30.0 },
  },
  'RBC': {
    default: { low: 3.5, high: 5.9, criticalLow: 2.5, criticalHigh: 6.5 },
    male: { low: 4.3, high: 5.9, criticalLow: 2.5, criticalHigh: 6.5 },
    female: { low: 3.5, high: 5.5, criticalLow: 2.5, criticalHigh: 6.5 },
  },
  'Platelets': {
    default: { low: 150, high: 450, criticalLow: 50, criticalHigh: 1000 },
  },
  'Sodium': {
    default: { low: 135, high: 145, criticalLow: 120, criticalHigh: 160 },
  },
  'Chloride': {
    default: { low: 96, high: 106, criticalLow: 80, criticalHigh: 120 },
  },
  'Bilirubin Total': {
    default: { low: 0.2, high: 1.2 },
  },
  'Bilirubin Direct': {
    default: { low: 0.0, high: 0.3 },
  },
  'ALP': {
    default: { low: 44, high: 147 },
  },
  'AST': {
    default: { low: 10, high: 40 },
  },
  'ALT': {
    default: { low: 7, high: 56 },
  },
  'Albumin': {
    default: { low: 3.4, high: 5.4 },
  },
  'BUN': {
    default: { low: 7, high: 20 },
  },
  'Urea': {
    default: { low: 15, high: 45 },
  },
  'Uric Acid': {
    default: { low: 3.5, high: 7.2 },
    male: { low: 3.5, high: 7.2 },
    female: { low: 2.6, high: 6.0 },
  },
  'eGFR': {
    default: { low: 60, high: 150 },
  },
  'Ferritin': {
    default: { low: 15, high: 150, criticalLow: 10 },
    male: { low: 30, high: 400, criticalLow: 15 },
    female: { low: 15, high: 150, criticalLow: 10 }
  },
  'Iron': {
    default: { low: 50, high: 170 },
    male: { low: 50, high: 170 },
    female: { low: 45, high: 160 }
  },
  'ANA': {
    default: { low: 0, high: 0 }
  },
  'CRP': {
    default: { low: 0, high: 3.0, criticalHigh: 10.0 }
  },
  'DHT': {
    default: { low: 12, high: 65 },
    male: { low: 250, high: 990 },
    female: { low: 12, high: 65 }
  },
  'SHBG': {
    default: { low: 18, high: 144 },
    male: { low: 10, high: 57 },
    female: { low: 18, high: 144 }
  },
  'Cortisol': {
    default: { low: 6.0, high: 23.0 }
  },
  'TSH': {
    default: { low: 0.45, high: 4.5 }
  },
  'T3': {
    default: { low: 76, high: 181 }
  },
  'T4': {
    default: { low: 4.8, high: 11.6 }
  },
  'Zinc': {
    default: { low: 60, high: 120 }
  },
  'Magnesium': {
    default: { low: 1.6, high: 2.6 }
  },
  'Calcium': {
    default: { low: 8.6, high: 10.3, criticalLow: 7.0, criticalHigh: 12.0 }
  },
  'Phosphorus': {
    default: { low: 2.5, high: 4.5 }
  },
  'MCV': {
    default: { low: 80, high: 100 }
  },
  'MCH': {
    default: { low: 27, high: 33 }
  },
  'Macroovalocytes': {
    default: { low: 0, high: 0 }
  }
};

function parseRangeString(rangeStr: string): AgeGenderRange | null {
  if (!rangeStr) return null;
  const clean = rangeStr.replace(/\s+/g, "").toLowerCase();

  // Pattern: low - high (e.g. "12.0-16.0", "70-100")
  let match = clean.match(/^([\d\.]+)-([\d\.]+)$/);
  if (match) {
    const low = parseFloat(match[1]);
    const high = parseFloat(match[2]);
    return { low, high };
  }

  // Pattern: < high (e.g. "<200", "<=150")
  match = clean.match(/^[<]=?([\d\.]+)$/);
  if (match) {
    const high = parseFloat(match[1]);
    return { low: 0, high };
  }

  // Pattern: > low (e.g. ">30", ">=50")
  match = clean.match(/^[>]=?([\d\.]+)$/);
  if (match) {
    const low = parseFloat(match[1]);
    return { low, high: Infinity };
  }

  return null;
}

export function validateBiomarker(
  name: string,
  value: number,
  unit?: string,
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | string,
  rawReferenceRange?: string
): MedicalValidationResult {
  const norm = normalizeBiomarker(name, value, unit);
  const val = norm.normalizedValue;
  const isMale = gender?.toUpperCase() === 'MALE';
  const isFemale = gender?.toUpperCase() === 'FEMALE';

  let interpretedStatus = 'Normal';
  let interpretedSeverity: 'Normal' | 'Mild' | 'Moderate' | 'High Risk' | 'Critical' = 'Normal';
  let interpretedRange = 'N/A';
  let patientExplanation = '';

  // Rule-based clinical validation
  switch (norm.name) {
    case 'HbA1c':
      interpretedRange = '< 5.7 %';
      if (val < 5.7) {
        interpretedStatus = 'Normal';
        interpretedSeverity = 'Normal';
        patientExplanation = `Your HbA1c level of ${val}% is in the normal range, indicating healthy glucose regulation over the past 2-3 months.`;
      } else if (val >= 5.7 && val <= 6.4) {
        interpretedStatus = 'Prediabetes';
        interpretedSeverity = 'Mild';
        patientExplanation = `Your HbA1c level of ${val}% indicates prediabetes. This suggests an increased risk of developing type 2 diabetes. Lifestyle modifications are recommended.`;
      } else if (val >= 6.5 && val <= 8.4) {
        interpretedStatus = 'Diabetes';
        interpretedSeverity = 'High Risk';
        patientExplanation = `Average blood sugar is elevated and falls within the diabetic range. Medical follow-up is recommended.`;
      } else {
        interpretedStatus = 'Critical Diabetes';
        interpretedSeverity = 'Critical';
        patientExplanation = `Average blood sugar is extremely elevated at ${val}%. Urgent clinical consultation is required.`;
      }
      break;

    case 'Glucose':
      interpretedRange = '< 100 mg/dL';
      if (val < 100) {
        interpretedStatus = 'Normal';
        interpretedSeverity = 'Normal';
        patientExplanation = `Fasting glucose level of ${val} mg/dL is within the normal healthy range.`;
      } else if (val >= 100 && val <= 125) {
        interpretedStatus = 'Prediabetes';
        interpretedSeverity = 'Mild';
        patientExplanation = `Fasting blood sugar of ${val} mg/dL falls in the prediabetic range, suggesting impaired fasting glucose. Dietary modification is advised.`;
      } else if (val > 125 && val < 250 && val > 50) {
        interpretedStatus = 'Diabetes';
        interpretedSeverity = 'High Risk';
        patientExplanation = `Fasting blood sugar of ${val} mg/dL is elevated and meets the diagnostic threshold for diabetes. Consultation with a healthcare provider is recommended.`;
      } else {
        interpretedStatus = val <= 50 ? 'Critical Hypoglycemia' : 'Critical Hyperglycemia';
        interpretedSeverity = 'Critical';
        patientExplanation = `Fasting glucose level of ${val} mg/dL is in a critically dangerous range. Immediate medical attention is required.`;
      }
      break;

    case 'Vitamin D':
      interpretedRange = '> 30 ng/mL';
      if (val >= 30) {
        interpretedStatus = 'Optimal';
        interpretedSeverity = 'Normal';
        patientExplanation = `Your Vitamin D level of ${val} ng/mL is optimal, supporting bone density, immune response, and overall wellness.`;
      } else if (val >= 20 && val < 30) {
        interpretedStatus = 'Insufficient';
        interpretedSeverity = 'Mild';
        patientExplanation = `Vitamin D levels of ${val} ng/mL indicate mild insufficiency. Supplementary intake or moderate sun exposure may help optimize levels.`;
      } else if (val >= 10 && val < 20) {
        interpretedStatus = 'Deficient';
        interpretedSeverity = 'Moderate';
        patientExplanation = `Vitamin D level of ${val} ng/mL indicates deficiency, which can impact calcium absorption and bone density. Supplementation is recommended.`;
      } else {
        interpretedStatus = 'Severe Deficiency';
        interpretedSeverity = 'High Risk';
        patientExplanation = `Vitamin D level of ${val} ng/mL is severely deficient. Therapeutic dose supplementation under medical guidance is recommended.`;
      }
      break;

    case 'Vitamin B12':
      interpretedRange = '300 - 900 pg/mL';
      if (val >= 300) {
        interpretedStatus = 'Normal';
        interpretedSeverity = 'Normal';
        patientExplanation = `Your Vitamin B12 level of ${val} pg/mL is normal, supporting healthy red blood cell production and nerve function.`;
      } else if (val >= 200 && val < 300) {
        interpretedStatus = 'Borderline';
        interpretedSeverity = 'Mild';
        patientExplanation = `Vitamin B12 level is borderline. Watch for symptoms like fatigue or tingling, and discuss supplementation options with a doctor.`;
      } else if (val >= 150 && val < 200) {
        interpretedStatus = 'Deficient';
        interpretedSeverity = 'Moderate';
        patientExplanation = `Vitamin B12 level of ${val} pg/mL is low. Dietary modifications or daily supplements are recommended to avoid symptoms.`;
      } else {
        interpretedStatus = 'Severe Deficiency';
        interpretedSeverity = 'High Risk';
        patientExplanation = `Vitamin B12 level is severely deficient at ${val} pg/mL. Immediate medical consultation for B12 injection or high-dose therapy is recommended.`;
      }
      break;

    default:
      const config = CLINICAL_RANGES[norm.name];
      let range = config?.default;

      if (config) {
        if (isMale && config.male) {
          range = config.male;
        } else if (isFemale && config.female) {
          range = config.female;
        }
      }

      // If no static range is configured, try parsing it from the report
      if (!range && rawReferenceRange) {
        const parsed = parseRangeString(rawReferenceRange);
        if (parsed) {
          range = parsed;
        }
      }

      if (range) {
        const lowBound = range.low;
        const highBound = range.high;
        interpretedRange = rawReferenceRange || `${lowBound} - ${highBound} ${norm.normalizedUnit}`;

        if (range.criticalLow && val <= range.criticalLow) {
          interpretedStatus = 'Critical Low';
          interpretedSeverity = 'Critical';
          patientExplanation = `CRITICAL: Your ${norm.name} of ${val} ${norm.normalizedUnit} is critically low (Threshold: < ${range.criticalLow}). Seek medical evaluation immediately.`;
        } else if (range.criticalHigh && val >= range.criticalHigh) {
          interpretedStatus = 'Critical High';
          interpretedSeverity = 'Critical';
          patientExplanation = `CRITICAL: Your ${norm.name} of ${val} ${norm.normalizedUnit} is critically high (Threshold: > ${range.criticalHigh}). Seek medical evaluation immediately.`;
        } else {
          // Calculate percentage-based deviation from bounds
          let dev = 0;
          if (val > highBound) {
            dev = highBound > 0 ? (val - highBound) / highBound : 1.0;
            interpretedStatus = 'High';
          } else if (val < lowBound && lowBound > 0) {
            dev = (lowBound - val) / lowBound;
            interpretedStatus = 'Low';
          }

          if (dev === 0) {
            interpretedStatus = 'Normal';
            interpretedSeverity = 'Normal';
            patientExplanation = `Your ${norm.name} of ${val} ${norm.normalizedUnit} is within the normal reference limits.`;
          } else {
            const rangeStr = rawReferenceRange || `${lowBound} - ${highBound}`;
            if (dev < 0.1) {
              interpretedSeverity = 'Mild'; // Low severity for slight deviation (< 10%)
              patientExplanation = `Your ${norm.name} of ${val} ${norm.normalizedUnit} shows a slight deviation outside reference range limits (${rangeStr}).`;
            } else if (dev < 0.3) {
              interpretedSeverity = 'Moderate'; // Medium severity for moderate deviation (10%-30%)
              patientExplanation = `Your ${norm.name} of ${val} ${norm.normalizedUnit} is outside reference range limits (${rangeStr}).`;
            } else {
              interpretedSeverity = 'High Risk'; // High severity for large deviation (>= 30%)
              patientExplanation = `Your ${norm.name} of ${val} ${norm.normalizedUnit} shows a significant deviation outside reference range limits (${rangeStr}).`;
            }
          }
        }
      } else {
        interpretedRange = rawReferenceRange || 'N/A';
        interpretedStatus = 'Normal';
        interpretedSeverity = 'Normal';
        patientExplanation = `Your ${norm.name} of ${val} ${norm.normalizedUnit} is observed. No specific reference range is configured.`;
      }
  }

  const requiresManualReview = norm.confidence < 0.8;

  return {
    isValid: true,
    biomarker: norm,
    interpretedStatus,
    interpretedSeverity,
    interpretedRange,
    patientExplanation: requiresManualReview
      ? 'Unable to confidently interpret this biomarker. Manual review recommended.'
      : patientExplanation,
    requiresManualReview,
  };
}
