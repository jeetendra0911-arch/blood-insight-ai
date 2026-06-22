import { calculateRisk } from './risk-engine';
import { validateBiomarker } from './medical-validation';

const mockBiomarkers = [
  { name: 'Hemoglobin', value: 13.6, unit: 'g/dL' },
  { name: 'WBC', value: 8.02, unit: '10^3/µL' },
  { name: 'RBC', value: 3.79, unit: '10^6/µL' },
  { name: 'Platelets', value: 278.0, unit: '150 - 410' },
  { name: 'Vitamin D', value: 12.3, unit: 'ng/mL' },
  { name: 'Vitamin B12', value: 145.0, unit: 'pg/mL' },
  { name: 'MCV', value: 104.0, unit: 'fL' },
  { name: 'MCH', value: 35.0, unit: 'pg' },
  { name: 'Ferritin', value: 8.0, unit: 'ng/mL' },
  { name: 'ANA', value: 1.0, unit: 'Index' },
  { name: 'TSH', value: 1.5, unit: 'uIU/mL' },
  { name: 'CRP', value: 1.2, unit: 'mg/L' },
  { name: 'Zinc', value: 85.0, unit: 'mcg/dL' },
  { name: 'Magnesium', value: 2.0, unit: 'mg/dL' }
];

const report = calculateRisk(mockBiomarkers, 'MALE');
console.log("Health Score:", report.overallHealthScore);
console.log("Risk Level:", report.overallRiskLevel);
console.log("Confidence Score:", report.confidenceScore);
console.log("Primary Concern:", report.primaryConcern);
console.log("Secondary Concern:", report.secondaryConcern);
console.log("Patterns Detected:", report.patternsDetected);
console.log("Findings:", JSON.stringify(report.findings, null, 2));
console.log("Scoring Breakdown:", JSON.stringify(report.scoringBreakdown, null, 2));

console.log("All Validated Biomarkers:");
mockBiomarkers.forEach(b => {
  const res = validateBiomarker(b.name, b.value, b.unit, 'MALE');
  console.log(`- ${b.name}: val=${res.biomarker.normalizedValue}, status=${res.interpretedStatus}, severity=${res.interpretedSeverity}, range=${res.interpretedRange}`);
});
console.log("Systems present:");
Object.entries(report.systems).forEach(([sys, details]: any) => {
  console.log(`- ${sys}: score=${details.score}, status=${details.status}, biomarkersCount=${details.biomarkersUsed.length}`);
});
