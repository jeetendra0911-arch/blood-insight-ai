/**
 * Biomarker Normalizer and Unit Converter
 * Handles OCR anomalies, validates values, and normalizes units.
 */

export interface NormalizedBiomarker {
  name: string;
  originalValue: number;
  originalUnit: string;
  normalizedValue: number;
  normalizedUnit: string;
  confidence: number; // 0.0 to 1.0
  validationWarning?: string;
  severity?: number;
}

// Map of standard biomarker aliases to normalize names (handling space-separated values)
const ALIAS_MAP: Record<string, string> = {
  // Glucose
  'glucose': 'Glucose',
  'fasting glucose': 'Glucose',
  'fasting blood sugar': 'Glucose',
  'fasting blood glucose': 'Glucose',
  'fbs': 'Glucose',
  'blood sugar': 'Glucose',
  'blood glucose': 'Glucose',

  // Hemoglobin
  'hemoglobin': 'Hemoglobin',
  'hb': 'Hemoglobin',
  'hgb': 'Hemoglobin',

  // HbA1c
  'hba1c': 'HbA1c',
  'hb a1c': 'HbA1c',
  'hemoglobin a1c': 'HbA1c',
  'a1c': 'HbA1c',

  // Creatinine
  'creatinine': 'Creatinine',
  'cr': 'Creatinine',
  'creat': 'Creatinine',

  // Cholesterol
  'total cholesterol': 'Total Cholesterol',
  'cholesterol total': 'Total Cholesterol',
  'cholesterol': 'Total Cholesterol',
  'chol': 'Total Cholesterol',

  // HDL
  'hdl cholesterol': 'HDL',
  'hdl': 'HDL',
  'hdl-c': 'HDL',

  // LDL
  'ldl cholesterol': 'LDL',
  'ldl': 'LDL',
  'ldl-c': 'LDL',

  // Triglycerides
  'triglycerides': 'Triglycerides',
  'tg': 'Triglycerides',
  'trig': 'Triglycerides',

  // Vitamin D
  'vitamin d': 'Vitamin D',
  'vit d': 'Vitamin D',
  '25-hydroxyvitamin d': 'Vitamin D',
  '25-oh vit d': 'Vitamin D',

  // Vitamin B12
  'vitamin b12': 'Vitamin B12',
  'vit b12': 'Vitamin B12',
  'b12': 'Vitamin B12',
  'cobalamin': 'Vitamin B12',

  // WBC
  'wbc': 'WBC',
  'white blood cell': 'WBC',
  'leukocytes': 'WBC',
  'total leukocytes count': 'WBC',
  'total leukocytes': 'WBC',

  // RBC
  'rbc': 'RBC',
  'red blood cell': 'RBC',
  'erythrocytes': 'RBC',
  'total rbc': 'RBC',

  // Platelets
  'platelets': 'Platelets',
  'plt': 'Platelets',
  'thrombocytes': 'Platelets',
  'platelet count': 'Platelets',

  // Basic Metabolic & Liver Panel
  'sodium': 'Sodium',
  'chloride': 'Chloride',
  'bilirubin direct': 'Bilirubin Direct',
  'bilirubin total': 'Bilirubin Total',
  'alp': 'ALP',
  'ast': 'AST',
  'alt': 'ALT',
  'albumin': 'Albumin',
  'bun': 'BUN',
  'blood urea nitrogen': 'BUN',
  'urea': 'Urea',
  'uric acid': 'Uric Acid',
  'egfr': 'eGFR',
  'estimated glomerular filtration rate': 'eGFR',

  // Additional aliases for report 18
  'mean corpuscular volume': 'MCV',
  'mean corpuscular hemoglobin': 'MCH',
  'dihydrotestosterone': 'DHT',
  'sex hormone binding globulin': 'SHBG',
  'phosphorous': 'Phosphorus',
  'phosphorus': 'Phosphorus',
  'ferritin': 'Ferritin',
  'zinc': 'Zinc',
  'magnesium': 'Magnesium',
  'calcium': 'Calcium',
  'ana': 'ANA',
  'cortisol': 'Cortisol',
  'tsh': 'TSH',
  't3': 'T3',
  't4': 'T4',
  'crp': 'CRP',
  'iron': 'Iron',
  'serum iron': 'Iron',
  'iron total': 'Iron',
  'total iron': 'Iron',
  'macroovalocytes': 'Macroovalocytes'
};

// Expected default units per biomarker
const STANDARD_UNITS: Record<string, string> = {
  'Iron': 'mcg/dL',
  'Glucose': 'mg/dL',
  'Hemoglobin': 'g/dL',
  'HbA1c': '%',
  'Creatinine': 'mg/dL',
  'Total Cholesterol': 'mg/dL',
  'HDL': 'mg/dL',
  'LDL': 'mg/dL',
  'Triglycerides': 'mg/dL',
  'Vitamin D': 'ng/mL',
  'Vitamin B12': 'pg/mL',
  'WBC': '10^9/L',
  'RBC': '10^12/L',
  'Platelets': '10^9/L',
  'Sodium': 'mEq/L',
  'Chloride': 'mEq/L',
  'Bilirubin Direct': 'mg/dL',
  'Bilirubin Total': 'mg/dL',
  'ALP': 'U/L',
  'AST': 'U/L',
  'ALT': 'U/L',
  'Albumin': 'g/dL',
  'BUN': 'mg/dL',
  'Urea': 'mg/dL',
  'Uric Acid': 'mg/dL',
  'eGFR': 'mL/min/1.73m²',
  'MCV': 'fL',
  'MCH': 'pg',
  'DHT': 'pg/mL',
  'SHBG': 'nmol/L',
  'Phosphorus': 'mg/dL',
  'ANA': 'Index',
  'Ferritin': 'ng/mL',
  'Zinc': 'mcg/dL',
  'Magnesium': 'mg/dL',
  'Calcium': 'mg/dL',
  'Cortisol': 'µg/dL',
  'TSH': 'uIU/mL',
  'T3': 'ng/dL',
  'T4': 'µg/dL',
  'CRP': 'mg/L'
};

function getStringSimilarity(s1: string, s2: string): number {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

export function normalizeBiomarker(rawName: string, rawValue: number, rawUnit?: string): NormalizedBiomarker {
  // Replace underscores with spaces so database-derived names map properly
  const cleanName = rawName.trim().toLowerCase().replace(/_/g, ' ');
  
  let normalizedName = ALIAS_MAP[cleanName];
  let confidence = 0.95; // Base confidence
  let warning: string | undefined;

  if (!normalizedName) {
    // Attempt fuzzy search in ALIAS_MAP keys
    let bestMatchKey = "";
    let bestSimilarity = 0;
    
    Object.keys(ALIAS_MAP).forEach(key => {
      const sim = getStringSimilarity(cleanName, key);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatchKey = key;
      }
    });
    
    if (bestSimilarity >= 0.85) {
      normalizedName = ALIAS_MAP[bestMatchKey];
      confidence -= 0.1; // Small penalty for typo matching
      warning = `Fuzzy matched '${rawName}' to standard name '${normalizedName}'.`;
    } else {
      normalizedName = rawName.trim();
    }
  }
  
  const stdUnit = STANDARD_UNITS[normalizedName] || rawUnit || '';
  let originalUnit = rawUnit?.trim() || '';
  let value = rawValue;

  // Attempt to auto-detect missing unit based on standard ranges
  if (!originalUnit) {
    confidence -= 0.15; // Penalty for missing unit
    if (normalizedName === 'Glucose') {
      originalUnit = value < 20 ? 'mmol/L' : 'mg/dL';
    } else if (normalizedName === 'Creatinine') {
      originalUnit = value > 25 ? 'umol/L' : 'mg/dL';
    } else if (normalizedName === 'Hemoglobin') {
      originalUnit = value > 25 ? 'g/L' : 'g/dL';
    } else {
      originalUnit = stdUnit;
    }
  }

  let normalizedValue = value;

  // Unit conversion rules
  const unitClean = originalUnit.toLowerCase().replace(/\s/g, '');
  if (normalizedName === 'Glucose') {
    if (unitClean === 'mmol/l') {
      normalizedValue = value * 18.0182; // mmol/L -> mg/dL
    } else if (value < 25 && unitClean === 'mg/dl') {
      normalizedValue = value * 18.0182;
      confidence -= 0.2;
      warning = 'Value suspiciously low for mg/dL. Assumed mmol/L and converted.';
    }
  } else if (normalizedName === 'Creatinine') {
    if (unitClean === 'umol/l' || unitClean === 'µmol/l') {
      normalizedValue = value / 88.4; // umol/L -> mg/dL
    } else if (value > 25 && unitClean === 'mg/dl') {
      normalizedValue = value / 88.4;
      confidence -= 0.2;
      warning = 'Value suspiciously high for mg/dL. Assumed umol/L and converted.';
    }
  } else if (normalizedName === 'Hemoglobin') {
    if (unitClean === 'g/l') {
      normalizedValue = value / 10; // g/L -> g/dL
    } else if (value > 50 && unitClean === 'g/dl') {
      normalizedValue = value / 10;
      confidence -= 0.2;
      warning = 'Value suspiciously high for g/dL. Assumed g/L and converted.';
    }
  }

  // Extreme biological value validator
  if (normalizedName === 'Creatinine' && normalizedValue > 15) {
    confidence -= 0.15;
    warning = 'Creatinine value is outside normal biological ranges. Please verify.';
  } else if (normalizedName === 'Glucose' && (normalizedValue > 600 || normalizedValue < 20)) {
    confidence -= 0.15;
    warning = 'Glucose value is outside normal biological limits. Please verify.';
  }

  // Round values
  normalizedValue = Math.round(normalizedValue * 100) / 100;

  return {
    name: normalizedName,
    originalValue: rawValue,
    originalUnit,
    normalizedValue,
    normalizedUnit: stdUnit,
    confidence: Math.max(0.1, confidence),
    validationWarning: warning,
  };
}
