/**
 * AI Health Risk Calculation Engine (Clinical Pattern Detection Engine)
 * Computes organ system risk indexes (0-100) and overall health scores.
 */

import { validateBiomarker, MedicalValidationResult } from './medical-validation';

export interface SystemRiskResult {
  score: number; // 0 to 100
  status: 'Low' | 'Mild' | 'Moderate' | 'High';
  findings: string;
  confidence: number;
  biomarkersExpected: string[];
  biomarkersUsed: {
    name: string;
    value: string;
    status: string;
    isAbnormal: boolean;
    arrow: string;
  }[];
  trend?: 'Improving' | 'Stable' | 'Worsening';
  primaryFinding: string;
  clinicalInterpretation: string;
  whyThisMatters: string;
  nextStep: string;
}

export interface ClinicalPattern {
  name: string;
  evidence: string[];
  significance: string;
  followUp: string;
}

export interface RiskAnalysisReport {
  overallHealthScore: number;
  overallRiskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  confidenceScore: number;
  systems: {
    cardiovascular: SystemRiskResult;
    diabetes: SystemRiskResult;
    kidney: SystemRiskResult;
    liver: SystemRiskResult;
    hematology: SystemRiskResult;
    [key: string]: SystemRiskResult;
  };
  patternsDetected: string[];
  clinicalPatterns?: ClinicalPattern[];
  primaryConcern?: string;
  secondaryConcern?: string;
  findings: {
    primary: string[];
    secondary: string[];
    normal: string[];
  };
  scoringBreakdown: {
    baseScore: number;
    coverageBonus: number;
    systemDeductions: {
      label: string;
      deduction: number;
    }[];
  };
}


const SYSTEM_MAPPINGS: Record<string, { label: string; markers: string[] }> = {
  cardiovascular: { label: 'Cardiovascular', markers: ['LDL', 'HDL', 'Triglycerides', 'Total Cholesterol'] },
  diabetes: { label: 'Diabetes', markers: ['HbA1c', 'Glucose'] },
  kidney: { label: 'Kidney', markers: ['Creatinine', 'eGFR', 'BUN', 'Urea', 'Uric Acid'] },
  liver: { label: 'Liver', markers: ['ALT', 'AST', 'ALP', 'Bilirubin Total', 'Bilirubin Direct', 'Albumin'] },
  hematology: { label: 'Hematology', markers: ['Hemoglobin', 'RBC', 'WBC', 'Platelets', 'MCV', 'MCH', 'Macroovalocytes'] },
  vitamins: { label: 'Vitamin Status', markers: ['Vitamin D', 'Vitamin B12'] },
  iron: { label: 'Iron Metabolism', markers: ['Ferritin', 'Iron'] },
  thyroid: { label: 'Thyroid', markers: ['TSH', 'T3', 'T4'] },
  inflammation: { label: 'Inflammation', markers: ['CRP'] },
  hormonal: { label: 'Hormonal Health', markers: ['DHT', 'SHBG', 'Cortisol'] },
  autoimmune: { label: 'Autoimmune Markers', markers: ['ANA'] },
  hair: { label: 'Hair Health', markers: ['Ferritin', 'Zinc', 'DHT'] },
  minerals: { label: 'Mineral & Electrolyte Status', markers: ['Calcium', 'Phosphorus', 'Magnesium', 'Sodium', 'Chloride', 'Zinc'] }
};

export function calculateRisk(
  biomarkers: any[], 
  gender?: string, 
  previousScores?: Record<string, number>
): RiskAnalysisReport {
  // Validate all biomarkers first
  const validated: Record<string, MedicalValidationResult> = {};
  let totalConfidence = 0;
  let validCount = 0;

  biomarkers.forEach(b => {
    const valResult = validateBiomarker(b.name, b.value, b.unit, gender, b.reference_range);
    validated[valResult.biomarker.name] = valResult;
    totalConfidence += valResult.biomarker.confidence;
    validCount++;
  });

  const averageConfidence = validCount > 0 ? totalConfidence / validCount : 1.0;

  // Build active mappings dynamically based on validated biomarkers to ensure full coverage
  const activeMappings = { ...SYSTEM_MAPPINGS };
  const mappedMarkers = new Set<string>();
  Object.values(activeMappings).forEach(sys => {
    sys.markers.forEach(m => mappedMarkers.add(m));
  });

  const unmappedMarkers = Object.keys(validated).filter(name => !mappedMarkers.has(name));
  if (unmappedMarkers.length > 0) {
    activeMappings['general'] = {
      label: 'General Systemic & Metabolic Status',
      markers: unmappedMarkers
    };
  }

  // --- PHASE 2: PATTERN DETECTION ---
  const clinicalPatterns: ClinicalPattern[] = [];
  const patternsDetected: string[] = [];

  const isLow = (name: string) => {
    const v = validated[name];
    if (!v) return false;
    const stat = v.interpretedStatus.toLowerCase();
    return stat.includes('low') || stat.includes('defic') || stat.includes('insufficient') || stat.includes('borderline');
  };

  const isHigh = (name: string) => {
    const v = validated[name];
    if (!v) return false;
    const stat = v.interpretedStatus.toLowerCase();
    return stat.includes('high') || stat.includes('positive') || stat.includes('present');
  };

  const hasLowRBC = isLow('RBC');
  const hasHighMCV = isHigh('MCV');
  const hasHighMCH = isHigh('MCH');
  const hasMacroovalocytes = isHigh('Macroovalocytes');
  const hasLowB12 = isLow('Vitamin B12');
  const hasLowD = isLow('Vitamin D');
  const hasLowFerritin = isLow('Ferritin');
  const hasPositiveANA = isHigh('ANA');

  // 1. Macrocytic Anemia Pattern
  if (hasLowRBC && hasLowB12 && (hasHighMCV || hasHighMCH || hasMacroovalocytes)) {
    const evidence: string[] = [];
    const rbcVal = validated['RBC'];
    evidence.push(`Low RBC (${rbcVal.biomarker.normalizedValue} ${rbcVal.biomarker.normalizedUnit})`);
    if (hasHighMCV) {
      const mcvVal = validated['MCV'];
      evidence.push(`High MCV (${mcvVal.biomarker.normalizedValue} ${mcvVal.biomarker.normalizedUnit})`);
    }
    if (hasHighMCH) {
      const mchVal = validated['MCH'];
      evidence.push(`High MCH (${mchVal.biomarker.normalizedValue} ${mchVal.biomarker.normalizedUnit})`);
    }
    if (hasMacroovalocytes) {
      evidence.push(`Macroovalocytes (Present)`);
    }
    const b12Val = validated['Vitamin B12'];
    evidence.push(`Low Vitamin B12 (${b12Val.biomarker.normalizedValue} ${b12Val.biomarker.normalizedUnit})`);

    clinicalPatterns.push({
      name: "Macrocytic Anemia Pattern",
      evidence,
      significance: "Suggests macrocytic anemia, a condition where red blood cells are larger than normal, typically caused by Vitamin B12 deficiency. This can lead to fatigue, muscle weakness, and neurological symptoms.",
      followUp: "Consult a primary care physician to discuss B12 therapeutic supplementation or injections, and monitor complete blood count (CBC) trends."
    });
    patternsDetected.push("Macrocytic Anemia Pattern");
  }

  // 2. Nutritional Deficiency Pattern
  if (hasLowFerritin && hasLowD && hasLowB12) {
    const evidence: string[] = [];
    const fVal = validated['Ferritin'];
    const dVal = validated['Vitamin D'];
    const b12Val = validated['Vitamin B12'];
    evidence.push(`Low Ferritin (${fVal.biomarker.normalizedValue} ${fVal.biomarker.normalizedUnit})`);
    evidence.push(`Low Vitamin D (${dVal.biomarker.normalizedValue} ${dVal.biomarker.normalizedUnit})`);
    evidence.push(`Low Vitamin B12 (${b12Val.biomarker.normalizedValue} ${b12Val.biomarker.normalizedUnit})`);

    clinicalPatterns.push({
      name: "Nutritional Deficiency Pattern",
      evidence,
      significance: "Indicates co-existing key nutritional deficiencies in iron stores (Ferritin), Vitamin D, and Vitamin B12. This combination significantly impacts cellular metabolism, bone density, immune response, energy levels, and hair follicle growth.",
      followUp: "Discuss a targeted nutritional rehabilitation and supplementation plan with a clinician. Re-test levels in 2-3 months."
    });
    patternsDetected.push("Nutritional Deficiency Pattern");
  }

  // 3. Autoimmune Reactivity Pattern
  if (hasPositiveANA) {
    const anaVal = validated['ANA'];
    clinicalPatterns.push({
      name: "Autoimmune Reactivity Pattern",
      evidence: [`Positive ANA (${anaVal.biomarker.normalizedValue} Index)`],
      significance: "Detection of Antinuclear Antibodies (ANA) is a marker of autoimmune activity. A positive result warrants clinical evaluation but is not diagnostic of any specific autoimmune disease on its own.",
      followUp: "Consult a rheumatologist for clinical correlation, symptom review, and detailed autoimmune screening if indicated."
    });
    patternsDetected.push("Autoimmune Reactivity Pattern");
  }

  // Set of biomarkers that are part of detected patterns to suppress from individual listing
  const patternEvidenceBiomarkers = new Set<string>();
  clinicalPatterns.forEach(pattern => {
    if (pattern.name === "Macrocytic Anemia Pattern") {
      patternEvidenceBiomarkers.add("RBC");
      patternEvidenceBiomarkers.add("MCV");
      patternEvidenceBiomarkers.add("MCH");
      patternEvidenceBiomarkers.add("Macroovalocytes");
      patternEvidenceBiomarkers.add("Vitamin B12");
    } else if (pattern.name === "Nutritional Deficiency Pattern") {
      patternEvidenceBiomarkers.add("Ferritin");
      patternEvidenceBiomarkers.add("Vitamin D");
      patternEvidenceBiomarkers.add("Vitamin B12");
    } else if (pattern.name === "Autoimmune Reactivity Pattern") {
      patternEvidenceBiomarkers.add("ANA");
    }
  });


  // --- PHASE 3: ORGAN/SYSTEM ASSESSMENT (DYNAMIC) ---
  const systems: Record<string, SystemRiskResult> = {};

  Object.entries(activeMappings).forEach(([systemKey, sysInfo]) => {
    // Check which markers in this system are actually present in the report
    const presentMarkers = sysInfo.markers.filter(m => validated[m] !== undefined);
    
    // Do not create/display system card if there is no data for it
    if (presentMarkers.length === 0) {
      return;
    }

    const presentResults = presentMarkers.map(m => validated[m]);
    const abnormal = presentResults.filter(v => v.interpretedSeverity !== 'Normal');
    
    const mildCount = abnormal.filter(v => v.interpretedSeverity === 'Mild').length;
    const moderateCount = abnormal.filter(v => v.interpretedSeverity === 'Moderate').length;
    const highRiskCount = abnormal.filter(v => v.interpretedSeverity === 'High Risk').length;
    const criticalCount = abnormal.filter(v => v.interpretedSeverity === 'Critical').length;

    let score = 15; // baseline
    score += mildCount * 8;
    score += moderateCount * 15;
    score += highRiskCount * 30;
    score += criticalCount * 45;

    const hasClinicalThresholdMet = highRiskCount > 0 || criticalCount > 0;
    if (!hasClinicalThresholdMet) {
      score = Math.min(60, score);
    }

    score = Math.max(10, Math.min(100, Math.round(score)));

    let status: 'Low' | 'Mild' | 'Moderate' | 'High' = 'Low';
    if (score <= 20) status = 'Low';
    else if (score <= 35) status = 'Mild';
    else if (score <= 60) status = 'Moderate';
    else status = 'High';

    // Format biomarkers used in the system
    const biomarkersUsed = presentMarkers.map(name => {
      const v = validated[name];
      const val = v.biomarker.normalizedValue;
      const stat = v.interpretedStatus;
      const isAbnormal = v.interpretedSeverity !== 'Normal';
      const arrow = stat.includes('High') || stat.includes('Very High') || stat.includes('Diabetes') || stat.includes('Prediabetes') || stat.includes('Positive') || stat.includes('Present')
        ? '↑' 
        : (stat.includes('Low') || stat.includes('Deficient') || stat.includes('Severe Deficiency') || stat.includes('Insufficient') ? '↓' : '✓');
      
      let displayValue = `${val}`;
      if (name === 'HbA1c') displayValue = `${val}%`;

      return {
        name,
        value: displayValue,
        status: stat,
        isAbnormal,
        arrow
      };
    });

    // Dynamic findings description
    const abnormalList = biomarkersUsed.filter(b => b.isAbnormal);
    let findingsText = "";
    if (abnormalList.length === 0) {
      findingsText = `All tested ${sysInfo.label.toLowerCase()} biomarkers are within healthy reference ranges.`;
    } else {
      const detailsStr = abnormalList.map(b => `${b.name} (${b.value}) is ${b.status.toLowerCase()}`).join(', ');
      findingsText = `${sysInfo.label} markers show deviations: ${detailsStr}.`;
    }

    // Dynamic clinical panels metadata
    let primaryFinding = "Not Tested";
    let clinicalInterpretation = "No markers available for evaluation.";
    let whyThisMatters = "Maintaining biological parameters supports organ homeostasis.";
    let nextStep = "Focus on healthy lifestyle and annual checks.";

    if (biomarkersUsed.length > 0) {
      const firstAbnormal = biomarkersUsed.find(b => b.isAbnormal);
      if (firstAbnormal) {
        primaryFinding = `${firstAbnormal.name}: ${firstAbnormal.value}`;
        clinicalInterpretation = `${firstAbnormal.name} is ${firstAbnormal.status.toLowerCase()}, indicating system imbalance.`;
      } else {
        primaryFinding = `${biomarkersUsed[0].name}: ${biomarkersUsed[0].value}`;
        clinicalInterpretation = `All tested markers are within standard clinical ranges.`;
      }
    }

    // Specific clinical custom text overrides
    if (systemKey === 'hematology') {
      whyThisMatters = "Blood cells are critical for oxygen transport, immune defense, and clotting.";
      if (patternsDetected.includes("Macrocytic Anemia Pattern")) {
        primaryFinding = "Macrocytic Anemia Pattern";
        clinicalInterpretation = "Presence of macrocytic anemia pattern (low RBC with high MCV/MCH), highly suggestive of B12 deficiency.";
        nextStep = "Seek medical advice regarding B12 therapy and full blood count check.";
      }
    } else if (systemKey === 'vitamins') {
      whyThisMatters = "Adequate vitamin levels support bone health, immune function, and nerve transmission.";
      if (validated['Vitamin B12'] && isLow('Vitamin B12')) {
        nextStep = "Implement B12 supplementation under medical advice and re-test in 2-3 months.";
      }
    } else if (systemKey === 'iron') {
      whyThisMatters = "Ferritin is the primary marker of total body iron stores, essential for cellular respiration and hair follicles.";
      if (validated['Ferritin'] && isLow('Ferritin')) {
        clinicalInterpretation = "Iron storage depletion, which is a major factor contributing to telogen effluvium (hair loss).";
        nextStep = "Consult physician to monitor full iron panel and initiate gentle iron therapy.";
      }
    } else if (systemKey === 'autoimmune') {
      whyThisMatters = "Antinuclear antibodies (ANA) indicate autoantibody activity targeting cellular nuclei.";
      if (validated['ANA'] && isHigh('ANA')) {
        clinicalInterpretation = "Positive ANA test suggests autoimmune activation; clinical correlation is required.";
        nextStep = "Consult a rheumatologist for a detailed autoimmune workup.";
      }
    } else if (systemKey === 'hair') {
      whyThisMatters = "Hair follicles are highly active metabolic tissues that require vitamins, minerals, and hormonal balance to function optimally.";
      if (validated['Ferritin'] && (validated['Ferritin'].interpretedStatus.includes('Low') || validated['Ferritin'].interpretedStatus.includes('Defic'))) {
        clinicalInterpretation = "Low iron stores (Ferritin) compromise hair follicle growth cycles, leading to increased hair shedding.";
        nextStep = "Consult a physician to discuss iron supplementation and diet adjustments to support hair regrowth.";
      } else {
        clinicalInterpretation = "Nutrient and mineral support for hair follicle health appears adequate.";
        nextStep = "Maintain optimal mineral and vitamin intake.";
      }
    } else if (systemKey === 'thyroid') {
      whyThisMatters = "Thyroid hormones regulate baseline metabolic rate, energy levels, and temperature.";
      nextStep = "Maintain routine screening.";
    } else if (systemKey === 'inflammation') {
      whyThisMatters = "CRP measures active systemic inflammation and tissue injury response.";
      nextStep = "Continue healthy routine.";
    }

    // Compute system confidence score based on expected biomarkers
    let sumConf = 0;
    sysInfo.markers.forEach(m => {
      const v = validated[m];
      if (v) sumConf += v.biomarker.confidence;
    });
    const sysConfidence = sysInfo.markers.length > 0 ? Math.round((sumConf / sysInfo.markers.length) * 100) : 100;

    const getTrend = (key: string, curScore: number) => {
      if (!previousScores || previousScores[key] === undefined) return undefined;
      const prev = previousScores[key];
      if (curScore < prev) return 'Improving';
      if (curScore > prev) return 'Worsening';
      return 'Stable';
    };

    systems[systemKey] = {
      score,
      status,
      findings: findingsText,
      confidence: sysConfidence,
      biomarkersExpected: sysInfo.markers,
      biomarkersUsed,
      trend: getTrend(systemKey, score),
      primaryFinding,
      clinicalInterpretation,
      whyThisMatters,
      nextStep
    };
  });

  // Ensure core keys exist to fulfill TypeScript compilation compatibility
  const coreKeys = ['cardiovascular', 'diabetes', 'kidney', 'liver', 'hematology'];
  coreKeys.forEach(k => {
    if (!systems[k]) {
      systems[k] = {
        score: 15,
        status: 'Low',
        findings: 'No biomarkers tested.',
        confidence: 100,
        biomarkersExpected: SYSTEM_MAPPINGS[k].markers,
        biomarkersUsed: [],
        primaryFinding: 'Not Tested',
        clinicalInterpretation: 'No markers available for evaluation.',
        whyThisMatters: 'System not evaluated.',
        nextStep: 'Routine monitoring.'
      };
    }
  });

  // --- PHASE 4: RISK CLASSIFICATION & PHASE 7: SCORING ---
  const systemDeductionsMap: Record<string, number> = {};

  Object.entries(validated).forEach(([name, v]) => {
    if (v.interpretedSeverity === 'Normal') return;
    const val = v.biomarker.normalizedValue;
    const stat = v.interpretedStatus.toLowerCase();

    let deduction = 0;
    let sysLabel = "General Systemic";

    if (name === 'Vitamin B12') {
      sysLabel = "Vitamin Status";
      deduction = val < 150 ? 15 : 5;
    } else if (name === 'Vitamin D') {
      sysLabel = "Vitamin Status";
      deduction = val < 20 ? 10 : 5;
    } else if (name === 'Ferritin') {
      sysLabel = "Iron Metabolism";
      deduction = 10;
    } else if (name === 'Iron') {
      sysLabel = "Iron Metabolism";
      deduction = stat.includes('low') ? 5 : 0;
    } else if (name === 'ANA') {
      sysLabel = "Autoimmune";
      deduction = 8;
    } else if (name === 'RBC') {
      sysLabel = "Hematology";
      deduction = 5;
    } else if (name === 'Hemoglobin') {
      sysLabel = "Hematology";
      deduction = val <= 7.0 ? 20 : 10;
    } else if (name === 'Platelets') {
      sysLabel = "Hematology";
      deduction = val <= 50 ? 25 : 10;
    } else if (['WBC', 'MCV', 'MCH', 'Macroovalocytes'].includes(name)) {
      sysLabel = "Hematology";
      deduction = 5;
    } else if (name === 'HbA1c') {
      sysLabel = "Diabetes";
      deduction = val >= 6.5 ? 15 : 8;
    } else if (name === 'Glucose') {
      sysLabel = "Diabetes";
      deduction = val > 125 ? 15 : 8;
    } else if (name === 'LDL') {
      sysLabel = "Cardiovascular";
      deduction = val >= 130 ? 10 : 5;
    } else if (name === 'HDL') {
      sysLabel = "Cardiovascular";
      deduction = 10;
    } else if (name === 'Triglycerides') {
      sysLabel = "Cardiovascular";
      deduction = val >= 200 ? 10 : 5;
    } else if (name === 'Total Cholesterol') {
      sysLabel = "Cardiovascular";
      deduction = 5;
    } else if (name === 'Creatinine') {
      sysLabel = "Kidney";
      deduction = val >= 3.0 ? 30 : 15;
    } else if (name === 'eGFR') {
      sysLabel = "Kidney";
      deduction = val < 15 ? 35 : 15;
    } else if (['BUN', 'Urea', 'Uric Acid'].includes(name)) {
      sysLabel = "Kidney";
      deduction = 5;
    } else if (['ALT', 'AST', 'ALP'].includes(name)) {
      sysLabel = "Liver";
      deduction = val > 500 ? 30 : 10;
    } else if (['Bilirubin Total', 'Bilirubin Direct', 'Albumin'].includes(name)) {
      sysLabel = "Liver";
      deduction = 5;
    } else if (['TSH', 'T3', 'T4'].includes(name)) {
      sysLabel = "Thyroid";
      deduction = 8;
    } else if (name === 'CRP') {
      sysLabel = "Inflammation";
      deduction = val >= 10.0 ? 25 : 10;
    } else if (['DHT', 'SHBG', 'Cortisol'].includes(name)) {
      sysLabel = "Hormonal Health";
      deduction = 8;
    } else if (['Calcium', 'Phosphorus', 'Magnesium', 'Sodium', 'Chloride', 'Zinc'].includes(name)) {
      sysLabel = "Minerals & Electrolytes";
      deduction = 5;
    }

    if (deduction > 0) {
      systemDeductionsMap[sysLabel] = (systemDeductionsMap[sysLabel] || 0) + deduction;
    }
  });

  const SYSTEM_CAPS: Record<string, number> = {
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
    "Minerals & Electrolytes": 15
  };

  const systemDeductions: { label: string; deduction: number }[] = [];
  let totalDeductions = 0;

  Object.entries(systemDeductionsMap).forEach(([label, value]) => {
    const cap = SYSTEM_CAPS[label] || 20;
    const finalDeduction = Math.min(cap, value);
    systemDeductions.push({
      label,
      deduction: finalDeduction
    });
    totalDeductions += finalDeduction;
  });

  const baseScore = 100;
  const coverageBonus = validCount >= 14 ? 10 : Math.round((validCount / 14) * 10);
  let overallHealthScore = baseScore + coverageBonus - totalDeductions;

  // Emergency Findings Check
  const hasEmergencyFinding = 
    (validated['eGFR'] && validated['eGFR'].biomarker.normalizedValue < 15) ||
    (validated['Creatinine'] && validated['Creatinine'].biomarker.normalizedValue >= 3.0) ||
    (validated['ALT'] && validated['ALT'].biomarker.normalizedValue > 500) ||
    (validated['AST'] && validated['AST'].biomarker.normalizedValue > 500) ||
    (validated['Sodium'] && (validated['Sodium'].biomarker.normalizedValue <= 120 || validated['Sodium'].biomarker.normalizedValue >= 160)) ||
    (validated['Hemoglobin'] && validated['Hemoglobin'].biomarker.normalizedValue <= 7.0) ||
    (validated['Platelets'] && validated['Platelets'].biomarker.normalizedValue <= 50) ||
    (validated['CRP'] && validated['CRP'].biomarker.normalizedValue >= 10.0);

  // Count systems that have moderate or high deductions (affected systems)
  // Let's define an affected system as one having a deduction of 5 or more.
  const affectedSystems = systemDeductions.filter(sd => sd.deduction >= 5);

  const criticalCount = Object.values(validated).filter(v => v.interpretedSeverity === 'Critical').length;

  let overallRiskLevel: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Low';

  if (hasEmergencyFinding) {
    // Dangerous values exist or critical systems affected
    if (criticalCount > 1 || affectedSystems.length >= 3) {
      overallRiskLevel = 'Critical';
    } else {
      overallRiskLevel = 'High'; // One critical system with dangerous values
    }
  } else if (overallHealthScore < 60) {
    if (affectedSystems.length >= 2) {
      overallRiskLevel = 'High'; // Multiple affected systems
    } else {
      // One severe system alone cannot force High Risk
      overallRiskLevel = 'Moderate';
      overallHealthScore = Math.max(60, overallHealthScore); // Clamp to Moderate Risk bracket
    }
  } else if (
    overallHealthScore < 80 ||
    affectedSystems.length > 0 ||
    validated['Vitamin B12'] ||
    validated['Vitamin D'] ||
    validated['Ferritin']
  ) {
    overallRiskLevel = 'Moderate';
  }

  // Align score with risk level brackets (Rule 3)
  if (overallRiskLevel === 'Critical') {
    overallHealthScore = Math.max(10, Math.min(39, overallHealthScore));
  } else if (overallRiskLevel === 'High') {
    overallHealthScore = Math.max(40, Math.min(59, overallHealthScore));
  } else if (overallRiskLevel === 'Moderate') {
    overallHealthScore = Math.max(60, Math.min(79, overallHealthScore));
  } else {
    overallHealthScore = Math.max(80, Math.min(100, overallHealthScore));
  }

  // Apply Rule 4: Minimum score of 50 if no emergency biomarkers are present
  if (!hasEmergencyFinding) {
    overallHealthScore = Math.max(50, overallHealthScore);
  }

  // --- PHASE 6: FINDINGS PRIORITIZATION ---
  const primaryFindings: string[] = [];
  const secondaryFindings: string[] = [];
  const normalFindings: string[] = [];

  // Categorize patterns as primary findings
  clinicalPatterns.forEach(pattern => {
    primaryFindings.push(pattern.name);
  });

  // Categorize standard primary markers if not suppressed by a pattern
  if (!patternEvidenceBiomarkers.has("Vitamin B12")) {
    if (validated['Vitamin B12'] && validated['Vitamin B12'].biomarker.normalizedValue < 150) {
      primaryFindings.push("Severe Vitamin B12 Deficiency");
    } else if (validated['Vitamin B12'] && validated['Vitamin B12'].interpretedSeverity !== 'Normal') {
      primaryFindings.push("Vitamin B12 Deficiency");
    }
  }

  if (!patternEvidenceBiomarkers.has("Vitamin D")) {
    if (validated['Vitamin D'] && validated['Vitamin D'].interpretedSeverity !== 'Normal') {
      primaryFindings.push("Vitamin D Deficiency");
    }
  }

  if (!patternEvidenceBiomarkers.has("Ferritin")) {
    if (validated['Ferritin'] && validated['Ferritin'].interpretedSeverity !== 'Normal') {
      primaryFindings.push("Low Ferritin");
    }
  }

  if (!patternEvidenceBiomarkers.has("ANA")) {
    if (validated['ANA'] && validated['ANA'].interpretedSeverity !== 'Normal') {
      primaryFindings.push("Positive ANA");
    }
  }

  if (!patternEvidenceBiomarkers.has("RBC")) {
    if (validated['RBC'] && validated['RBC'].interpretedSeverity !== 'Normal') {
      secondaryFindings.push("Low RBC");
    }
  }

  // Categorize normals
  const checkNormal = (key: string, label: string) => {
    if (validated[key] && validated[key].interpretedSeverity === 'Normal') {
      normalFindings.push(label);
    }
  };

  // Add thyroid profile validation status
  const hasTSH = validated['TSH'] !== undefined;
  const tNormal = (!validated['TSH'] || validated['TSH'].interpretedSeverity === 'Normal') &&
                  (!validated['T3'] || validated['T3'].interpretedSeverity === 'Normal') &&
                  (!validated['T4'] || validated['T4'].interpretedSeverity === 'Normal');
  if (hasTSH && tNormal) {
    normalFindings.push("Thyroid profile normal");
  }

  checkNormal('CRP', 'CRP normal');
  checkNormal('Zinc', 'Zinc normal');
  checkNormal('Magnesium', 'Magnesium normal');
  checkNormal('Platelets', 'Platelets normal');
  checkNormal('Hemoglobin', 'Hemoglobin normal');

  // Push other unclassified abnormalities/normals
  Object.entries(validated).forEach(([name, v]) => {
    const isAbnormal = v.interpretedSeverity !== 'Normal';

    // Suppress from independent findings if part of a pattern
    if (patternEvidenceBiomarkers.has(name)) {
      return;
    }

    // Prevent duplicates
    const isReportedPrimary = primaryFindings.some(f => f.toLowerCase().includes(name.toLowerCase()));
    const isReportedSecondary = secondaryFindings.some(f => f.toLowerCase().includes(name.toLowerCase()));
    const isReportedNormal = normalFindings.some(f => f.toLowerCase().includes(name.toLowerCase()));

    if (isAbnormal) {
      if (!isReportedPrimary && !isReportedSecondary) {
        if (v.interpretedSeverity === 'High Risk' || v.interpretedSeverity === 'Critical') {
          primaryFindings.push(`${name} abnormal`);
        } else {
          secondaryFindings.push(`${name} abnormal`);
        }
      }
    } else {
      if (!isReportedNormal && !['TSH', 'T3', 'T4', 'WBC'].includes(name)) {
        normalFindings.push(`${name} normal`);
      }
    }
  });

  // Set Concerns
  let primaryConcern = "General metabolic screening";
  let secondaryConcern = "Routine monitoring";

  const concernsList: string[] = [];
  if (patternsDetected.includes("Macrocytic Anemia Pattern")) {
    concernsList.push("Macrocytic Anemia Pattern (Low RBC with High MCV/MCH and Low B12)");
  }
  if (patternsDetected.includes("Nutritional Deficiency Pattern")) {
    concernsList.push("Nutritional Deficiency Pattern (Low Ferritin, Vitamin D, and Vitamin B12)");
  }
  if (patternsDetected.includes("Autoimmune Reactivity Pattern")) {
    concernsList.push("Autoimmune Reactivity Pattern (Positive ANA)");
  }

  if (concernsList.length > 0) {
    primaryConcern = concernsList[0];
    if (concernsList.length > 1) {
      secondaryConcern = concernsList.slice(1).join(', ');
    } else {
      // Find remaining independent primary findings
      const nonPatternPrimaries = primaryFindings.filter(f => !patternsDetected.includes(f));
      if (nonPatternPrimaries.length > 0) {
        secondaryConcern = nonPatternPrimaries.join(', ');
      }
    }
  }

  return {
    overallHealthScore,
    overallRiskLevel,
    confidenceScore: Math.round(averageConfidence * 100),
    systems: systems as any,
    patternsDetected,
    clinicalPatterns,
    primaryConcern,
    secondaryConcern,
    findings: {
      primary: primaryFindings,
      secondary: secondaryFindings,
      normal: normalFindings
    },
    scoringBreakdown: {
      baseScore,
      coverageBonus,
      systemDeductions
    }
  };
}
