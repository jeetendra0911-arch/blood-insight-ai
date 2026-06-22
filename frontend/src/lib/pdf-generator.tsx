import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { validateBiomarker } from './medical-validation';

// Define clean, diagnostic-grade corporate stylesheet
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b', // slate-800
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f172a',
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reportSubtitle: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  orgTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  orgSubtitle: {
    fontSize: 7.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  patientInfoTable: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 8,
    marginBottom: 12,
    borderRadius: 4,
  },
  infoCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 3,
  },
  infoRow: {
    flexDirection: 'row',
    fontSize: 8.5,
  },
  infoLabel: {
    fontWeight: 'bold',
    width: 90,
    color: '#475569',
  },
  infoValue: {
    color: '#0f172a',
  },
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    padding: '3 6',
    marginBottom: 6,
    borderRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#0f172a',
    textTransform: 'uppercase',
  },
  summaryText: {
    lineHeight: 1.4,
    marginBottom: 6,
    color: '#334155',
    fontSize: 8.5,
  },
  
  // Table styles
  table: {
    width: '100%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    fontWeight: 'bold',
    padding: '4 6',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    padding: '5 6',
    alignItems: 'center',
    fontSize: 8,
  },
  tableRowAlternate: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: '5 6',
    alignItems: 'center',
    fontSize: 8,
  },
  colName: { width: '25%', fontWeight: 'bold', color: '#0f172a' },
  colValue: { width: '15%' },
  colRange: { width: '20%', fontFamily: 'Courier' },
  colStatus: { width: '12%', fontWeight: 'bold' },
  colSeverity: { width: '13%', fontWeight: 'bold' },
  colAction: { width: '15%', fontWeight: 'bold', textAlign: 'right' },
  
  statusHigh: { color: '#dc2626' },
  statusLow: { color: '#2563eb' },
  statusNormal: { color: '#16a34a' },
  
  // Organ systems breakdown
  systemCard: {
    flexDirection: 'column',
    padding: '6 8',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
  },
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  systemName: {
    fontWeight: 'bold',
    fontSize: 9.5,
    color: '#0f172a',
    textTransform: 'capitalize',
  },
  systemStatus: {
    fontSize: 8.5,
    fontWeight: 'bold',
  },
  systemDetails: {
    flexDirection: 'column',
    fontSize: 8,
    color: '#334155',
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
    marginTop: 2,
  },
  
  // Recommendations
  recCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 3,
    marginBottom: 4,
  },
  recCategory: {
    fontWeight: 'bold',
    color: '#0f172a',
    fontSize: 8.5,
    textTransform: 'uppercase',
  },
  recPriority: {
    fontWeight: 'bold',
    fontSize: 8,
  },
  recContent: {
    lineHeight: 1.35,
    marginBottom: 3,
    fontSize: 8.5,
  },
  recGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 3,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 3,
    fontSize: 7.5,
    color: '#475569',
  },
  recGridItem: {
    width: '50%',
    marginBottom: 1,
  },
  recLabel: {
    fontWeight: 'bold',
    color: '#64748b',
  },
  recValue: {
    color: '#334155',
  },
  recSafety: {
    fontSize: 7.5,
    marginTop: 4,
    fontWeight: 'bold',
  },
  disclaimer: {
    fontSize: 7,
    color: '#64748b',
    lineHeight: 1.3,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 6,
    marginTop: 10,
  },
});

// Helper function to grade organs
function getOrganGrade(score: number): string {
  if (score <= 15) return 'A+';
  if (score <= 30) return 'A';
  if (score <= 45) return 'B';
  if (score <= 60) return 'C';
  if (score <= 80) return 'D';
  return 'F';
}

// Helper to determine clinical action from severity
function getActionNeeded(sev: string): string {
  if (sev === 'Critical') return 'Seek Immediate Care';
  if (sev === 'High Risk') return 'Consult Physician';
  if (sev === 'Moderate') return 'Lifestyle Change';
  if (sev === 'Mild') return 'Monitor & Re-test';
  return 'Maintain Routine';
}

// Helper to get enhanced recommendation data
function getEnhancedRecommendation(rec: any, validatedBiomarkers: any[]) {
  const content = rec.content.toLowerCase();
  const category = rec.category.toLowerCase();
  
  const findBio = (name: string) => {
    return validatedBiomarkers.find(v => v.biomarker.name === name);
  };

  let bioName = "";
  let currentVal = "";
  let targetVal = "";
  let timeline = "";
  let outcome = "";

  // Refined standard checks
  if (content.includes('glucose') || content.includes('sugar') || content.includes('hba1c') || content.includes('glycemic')) {
    const glucose = findBio('Glucose');
    const hba1c = findBio('HbA1c');
    if (hba1c && hba1c.interpretedSeverity !== 'Normal') {
      bioName = "HbA1c";
      currentVal = `${hba1c.biomarker.normalizedValue}%`;
      targetVal = "< 5.7%";
      timeline = "3 months";
      outcome = "Regulation of long-term blood sugar levels.";
    } else if (glucose) {
      bioName = "Glucose";
      currentVal = `${glucose.biomarker.normalizedValue} mg/dL`;
      targetVal = "70 - 99 mg/dL";
      timeline = "3 months";
      outcome = "Prevention of insulin resistance progression.";
    }
  } else if (content.includes('cholesterol') || content.includes('ldl') || content.includes('lipid') || content.includes('triglycerides') || category.includes('cardio') || content.includes('cardiovascular')) {
    const ldl = findBio('LDL');
    const tg = findBio('Triglycerides');
    const hdl = findBio('HDL');
    if (ldl && ldl.interpretedSeverity !== 'Normal') {
      bioName = "LDL Cholesterol";
      currentVal = `${ldl.biomarker.normalizedValue} mg/dL`;
      targetVal = "< 100 mg/dL";
      timeline = "3 months";
      outcome = "Reduction in atherogenic plaque buildup risk.";
    } else if (tg && tg.interpretedSeverity !== 'Normal') {
      bioName = "Triglycerides";
      currentVal = `${tg.biomarker.normalizedValue} mg/dL`;
      targetVal = "< 150 mg/dL";
      timeline = "3 months";
      outcome = "Optimized lipid metabolism and lower metabolic syndrome risk.";
    } else if (hdl && hdl.interpretedSeverity !== 'Normal') {
      bioName = "HDL Cholesterol";
      currentVal = `${hdl.biomarker.normalizedValue} mg/dL`;
      targetVal = ">= 40 mg/dL (M), >= 50 mg/dL (F)";
      timeline = "3 months";
      outcome = "Increased reverse cholesterol transport efficiency.";
    } else {
      bioName = "Lipid Panel";
      targetVal = "Optimal lipid ranges";
      timeline = "3-6 months";
      outcome = "Maintained cardiovascular integrity.";
    }
  } else if (content.includes('vitamin d') || content.includes('vit d') || content.includes('hydroxyvitamin')) {
    const vitd = findBio('Vitamin D');
    if (vitd) {
      bioName = "Vitamin D";
      currentVal = `${vitd.biomarker.normalizedValue} ng/mL`;
      targetVal = ">= 30 ng/mL";
      timeline = "2-3 months";
      outcome = "Improved bone mineral absorption and immune optimization.";
    }
  } else if (content.includes('b12') || content.includes('cobalamin') || content.includes('vitamin b12')) {
    const vitb12 = findBio('Vitamin B12');
    if (vitb12) {
      bioName = "Vitamin B12";
      currentVal = `${vitb12.biomarker.normalizedValue} pg/mL`;
      targetVal = ">= 300 pg/mL";
      timeline = "2-3 months";
      outcome = "Enhanced neurological support and healthy red blood cell counts.";
    }
  } else if (content.includes('creatinine') || content.includes('egfr') || content.includes('kidney') || content.includes('renal')) {
    const egfr = findBio('eGFR');
    const creat = findBio('Creatinine');
    if (egfr && egfr.interpretedSeverity !== 'Normal') {
      bioName = "eGFR";
      currentVal = `${egfr.biomarker.normalizedValue}`;
      targetVal = ">= 60";
      timeline = "3 months";
      outcome = "Sustained filtration capacity and clearance.";
    } else if (creat && creat.interpretedSeverity !== 'Normal') {
      bioName = "Creatinine";
      currentVal = `${creat.biomarker.normalizedValue} mg/dL`;
      targetVal = "0.6 - 1.3 mg/dL";
      timeline = "3 months";
      outcome = "Stabilized glomerular clearance and metabolic waste elimination.";
    } else {
      bioName = "Kidney Panel";
      targetVal = "Normal filtration limits";
      timeline = "3-6 months";
      outcome = "Regulated fluid and electrolyte balance.";
    }
  } else if (content.includes('liver') || content.includes('alt') || content.includes('ast') || content.includes('alp') || content.includes('enzyme')) {
    const alt = findBio('ALT');
    const ast = findBio('AST');
    if (alt && alt.interpretedSeverity !== 'Normal') {
      bioName = "ALT Enzyme";
      currentVal = `${alt.biomarker.normalizedValue} U/L`;
      targetVal = "7 - 56 U/L";
      timeline = "2 months";
      outcome = "Reduction in liver cellular stress and enzyme leakage.";
    } else if (ast && ast.interpretedSeverity !== 'Normal') {
      bioName = "AST Enzyme";
      currentVal = `${ast.biomarker.normalizedValue} U/L`;
      targetVal = "10 - 40 U/L";
      timeline = "2 months";
      outcome = "Decreased cellular inflammation.";
    } else {
      bioName = "Liver Enzymes";
      targetVal = "Normal enzymatic bounds";
      timeline = "3 months";
      outcome = "Maintained hepatic detoxification efficiency.";
    }
  } else if (content.includes('ferritin')) {
    const fer = findBio('Ferritin');
    if (fer) {
      bioName = "Ferritin";
      currentVal = `${fer.biomarker.normalizedValue} ng/mL`;
      targetVal = "15 - 150 ng/mL";
      timeline = "3 months";
      outcome = "Replenished iron storage supporting cellular hair regrowth.";
    }
  } else if (content.includes('iron') || content.includes('serum iron')) {
    const iron = findBio('Iron');
    if (iron) {
      bioName = "Serum Iron";
      currentVal = `${iron.biomarker.normalizedValue} mcg/dL`;
      targetVal = "50 - 170 mcg/dL";
      timeline = "3 months";
      outcome = "Stabilized circulating serum iron levels.";
    }
  } else if (content.includes('zinc')) {
    const zinc = findBio('Zinc');
    if (zinc) {
      bioName = "Zinc";
      currentVal = `${zinc.biomarker.normalizedValue} mcg/dL`;
      targetVal = "60 - 120 mcg/dL";
      timeline = "3 months";
      outcome = "Optimized enzyme activity and protein synthesis.";
    }
  } else if (content.includes('magnesium')) {
    const mag = findBio('Magnesium');
    if (mag) {
      bioName = "Magnesium";
      currentVal = `${mag.biomarker.normalizedValue} mg/dL`;
      targetVal = "1.6 - 2.6 mg/dL";
      timeline = "3 months";
      outcome = "Optimized electrolyte stability and neurological function.";
    }
  } else if (content.includes('calcium')) {
    const calc = findBio('Calcium');
    if (calc) {
      bioName = "Calcium";
      currentVal = `${calc.biomarker.normalizedValue} mg/dL`;
      targetVal = "8.6 - 10.3 mg/dL";
      timeline = "3 months";
      outcome = "Sustained skeletal integrity and cellular transduction.";
    }
  } else if (content.includes('phosphorus') || content.includes('phosphorous')) {
    const phos = findBio('Phosphorus');
    if (phos) {
      bioName = "Phosphorus";
      currentVal = `${phos.biomarker.normalizedValue} mg/dL`;
      targetVal = "2.5 - 4.5 mg/dL";
      timeline = "3 months";
      outcome = "Restored mineral balance and cellular energy clearance.";
    }
  } else if (content.includes('crp') || content.includes('reactive protein') || content.includes('inflammation')) {
    const crp = findBio('CRP');
    if (crp) {
      bioName = "CRP";
      currentVal = `${crp.biomarker.normalizedValue} mg/L`;
      targetVal = "< 3.0 mg/L";
      timeline = "1 month";
      outcome = "Reduction in acute systemic inflammation.";
    }
  } else if (content.includes('ana') || content.includes('antinuclear')) {
    const ana = findBio('ANA');
    if (ana) {
      bioName = "ANA";
      currentVal = `${ana.biomarker.normalizedValue} Index`;
      targetVal = "Negative";
      timeline = "1 month";
      outcome = "Autoimmune profiling clarification.";
    }
  } else if (content.includes('tsh') || content.includes('t3') || content.includes('t4') || content.includes('thyroid')) {
    const tsh = findBio('TSH');
    const t3 = findBio('T3');
    const t4 = findBio('T4');
    if (tsh) {
      bioName = "TSH";
      currentVal = `${tsh.biomarker.normalizedValue} uIU/mL`;
      targetVal = "0.45 - 4.5 uIU/mL";
    } else if (t3) {
      bioName = "T3";
      currentVal = `${t3.biomarker.normalizedValue} ng/dL`;
      targetVal = "76 - 181 ng/dL";
    } else if (t4) {
      bioName = "T4";
      currentVal = `${t4.biomarker.normalizedValue} µg/dL`;
      targetVal = "4.8 - 11.6 µg/dL";
    }
    timeline = "2 months";
    outcome = "Restored metabolic and thyroid hormone regulation.";
  } else if (content.includes('dht') || content.includes('shbg') || content.includes('cortisol')) {
    const dht = findBio('DHT');
    const shbg = findBio('SHBG');
    const cortisol = findBio('Cortisol');
    if (dht) {
      bioName = "DHT";
      currentVal = `${dht.biomarker.normalizedValue} pg/mL`;
      targetVal = "250 - 990 pg/mL (M), 12 - 65 pg/mL (F)";
    } else if (shbg) {
      bioName = "SHBG";
      currentVal = `${shbg.biomarker.normalizedValue} nmol/L`;
      targetVal = "10 - 57 nmol/L (M), 18 - 144 nmol/L (F)";
    } else if (cortisol) {
      bioName = "Cortisol";
      currentVal = `${cortisol.biomarker.normalizedValue} µg/dL`;
      targetVal = "6.0 - 23.0 µg/dL";
    }
    timeline = "2 months";
    outcome = "Balanced hormone clearance.";
  } else if (content.includes('hemoglobin') || content.includes('anemia') || content.includes('rbc') || content.includes('cbc')) {
    const hb = findBio('Hemoglobin');
    if (hb) {
      bioName = "Hemoglobin";
      currentVal = `${hb.biomarker.normalizedValue} g/dL`;
      targetVal = "12.0 - 17.5 g/dL";
      timeline = "3 months";
      outcome = "Optimized red blood cell production and fatigue recovery.";
    }
  }

  // --- GENERIC DYNAMIC MATCH FALLBACK ---
  if (!bioName) {
    const matchedBio = validatedBiomarkers.find(v => {
      const nameLower = v.biomarker.name.toLowerCase();
      return content.includes(nameLower) || nameLower.includes(content);
    });

    if (matchedBio) {
      bioName = matchedBio.biomarker.name;
      currentVal = `${matchedBio.biomarker.normalizedValue} ${matchedBio.biomarker.normalizedUnit}`.trim();
      targetVal = matchedBio.interpretedRange || "Optimal limits";
      timeline = matchedBio.interpretedSeverity !== 'Normal' ? "2-3 months" : "6 months";
      outcome = `Optimization of ${matchedBio.biomarker.name} levels and associated metabolic pathways.`;
    }
  }

  if (!bioName) {
    bioName = "Systemic Wellness";
    currentVal = "Screened";
    targetVal = "Optimal homeostasis";
    timeline = "6 months";
    outcome = "Maintenance of stable baseline metabolic health.";
  }

  return {
    triggeredBy: bioName,
    currentValue: currentVal,
    targetValue: targetVal,
    retestTimeline: timeline,
    expectedOutcome: outcome
  };
}

const isSystemSupported = (system: string, details: any) => {
  return details && details.biomarkersUsed && details.biomarkersUsed.length > 0;
};

// Generate dynamic patient friendly summary text
function generatePatientSummary(validatedList: any[]): string {
  if (!validatedList || validatedList.length === 0) {
    return "";
  }

  const abnormals = validatedList.filter(r => r.interpretedSeverity !== 'Normal');
  const normals = validatedList.filter(r => r.interpretedSeverity === 'Normal');

  if (abnormals.length === 0) {
    return "Great news! All of your analyzed biomarkers are currently within their normal, healthy limits. This indicates good cardiovascular, metabolic, and systemic health. To maintain this profile, continue with your balanced diet, regular exercise, and standard routine screenings. No immediate medical follow-up or lifestyle interventions are indicated.";
  }

  const sugarAbnormals = abnormals.filter(r => r.biomarker.name === 'Glucose' || r.biomarker.name === 'HbA1c');
  const lipidAbnormals = abnormals.filter(r => r.biomarker.name === 'LDL' || r.biomarker.name === 'Triglycerides' || (r.biomarker.name === 'HDL' && r.interpretedStatus === 'Low'));
  const vitaminAbnormals = abnormals.filter(r => r.biomarker.name === 'Vitamin D' || r.biomarker.name === 'Vitamin B12');
  const otherAbnormals = abnormals.filter(r => r.biomarker.name !== 'Glucose' && r.biomarker.name !== 'HbA1c' && r.biomarker.name !== 'LDL' && r.biomarker.name !== 'Triglycerides' && r.biomarker.name !== 'HDL' && r.biomarker.name !== 'Vitamin D' && r.biomarker.name !== 'Vitamin B12');

  let part1 = "Your blood test shows a few areas that need attention. ";
  const abnormalDescriptions: string[] = [];

  if (sugarAbnormals.length > 0) {
    const isDiabetes = sugarAbnormals.some(r => r.interpretedStatus === 'Diabetes');
    abnormalDescriptions.push(`your average blood sugar levels are elevated (${isDiabetes ? 'indicating diabetes ranges' : 'suggesting prediabetes'})`);
  }
  if (vitaminAbnormals.length > 0) {
    const names = vitaminAbnormals.map(r => r.biomarker.name).join(' and ');
    abnormalDescriptions.push(`your ${names} levels are significantly low, which can contribute to fatigue, muscle weakness, or bone health concerns`);
  }
  if (lipidAbnormals.length > 0) {
    abnormalDescriptions.push("some cholesterol and fat levels (lipids) are outside optimal cardiovascular boundaries");
  }
  if (otherAbnormals.length > 0) {
    const names = otherAbnormals.slice(0, 2).map(r => r.biomarker.name).join(', ');
    abnormalDescriptions.push(`certain panels like ${names} are currently out of balance`);
  }

  part1 += "Specifically, " + abnormalDescriptions.join(', and ') + ". ";

  let part2 = "On the positive side, ";
  const normalGroups: string[] = [];
  const normalNames = normals.map(r => r.biomarker.name);

  if (normalNames.includes('Creatinine')) normalGroups.push("kidney function");
  if (normalNames.includes('AST') || normalNames.includes('ALT') || normalNames.includes('ALP')) normalGroups.push("liver enzymes");
  if (normalNames.includes('Hemoglobin') || normalNames.includes('RBC') || normalNames.includes('WBC')) normalGroups.push("blood counts");
  if (normalNames.includes('Total Cholesterol') && !lipidAbnormals.some(r => r.biomarker.name === 'LDL')) normalGroups.push("general cholesterol markers");

  if (normalGroups.length > 0) {
    part2 += `your ${normalGroups.join(', ')} are performing well and fall within standard healthy reference limits. `;
  } else {
    part2 += "several of your remaining blood markers are stable and healthy. ";
  }

  // Next steps based strictly on available abnormal biomarkers
  const nextStepsList: string[] = [];
  if (sugarAbnormals.length > 0) nextStepsList.push("glycemic tracking and blood sugar management");
  if (lipidAbnormals.length > 0) nextStepsList.push("cardiovascular lipid management");
  if (vitaminAbnormals.length > 0) {
    const vitaminNames = vitaminAbnormals.map(r => r.biomarker.name).join(' and ');
    nextStepsList.push(`${vitaminNames} supplementation`);
  }
  if (abnormals.some(r => r.biomarker.name === 'Creatinine' || r.biomarker.name === 'eGFR')) {
    nextStepsList.push("renal clearance monitoring");
  }
  if (abnormals.some(r => r.biomarker.name === 'ALT' || r.biomarker.name === 'AST')) {
    nextStepsList.push("liver enzyme monitoring");
  }
  if (abnormals.some(r => r.biomarker.name === 'Hemoglobin' || r.biomarker.name === 'RBC' || r.biomarker.name === 'WBC' || r.biomarker.name === 'Platelets')) {
    nextStepsList.push("complete blood count monitoring");
  }

  let part3 = "Recommended next steps include discussing these results with your healthcare provider to establish appropriate monitoring and care plans.";
  if (nextStepsList.length > 0) {
    part3 = `Recommended next steps include discussing ${nextStepsList.join(', ')} with your doctor. Follow-up testing may be needed to monitor improvement.`;
  }

  const fullText = part1 + part2 + part3;
  return fullText.replace(/\s+/g, ' ').trim();
}

export interface PDFReportData {
  report: any;
  biomarkers: any[];
  analysis: any;
  riskReport: any;
}

export const BloodReportPDF = ({ data }: { data: PDFReportData }) => {
  const { report, biomarkers, analysis, riskReport } = data;
  
  const patientName = report?.metadata_json?.patient_name || report?.user?.full_name || 'Guest Patient';
  const age = report?.metadata_json?.patient_age || (report?.user?.dob
    ? new Date().getFullYear() - new Date(report.user.dob).getFullYear()
    : 'N/A');
  const gender = report?.metadata_json?.patient_gender || report?.user?.gender || 'Not Specified';
  const labName = report?.metadata_json?.lab_name || 'Inferred Labcorp';

  // Run clinical validation to match UI dashboard results
  const validatedBiomarkers = biomarkers.map((b: any) => 
    validateBiomarker(b.name, b.value, b.unit, gender)
  );

  return (
    <Document>
      {/* PAGE 1: Laboratory Diagnostic Report Header & Overview */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportTitle}>Clinical Health Synthesis Report</Text>
            <Text style={styles.reportSubtitle}>Automated Laboratory Verification & AI Summary</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.orgTitle}>{labName}</Text>
            <Text style={styles.orgSubtitle}>Accredited Reference Lab</Text>
          </View>
        </View>

        {/* Structured Patient Info Table */}
        <View style={styles.patientInfoTable}>
          <View style={styles.infoCol}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Patient Name:</Text>
              <Text style={styles.infoValue}>{patientName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age / Gender:</Text>
              <Text style={styles.infoValue}>{age} Yrs / {gender}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Patient DOB:</Text>
              <Text style={styles.infoValue}>{report?.user?.dob ? new Date(report.user.dob).toLocaleDateString() : 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoCol}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Report ID:</Text>
              <Text style={styles.infoValue}>#{report?.id}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Observation Date:</Text>
              <Text style={styles.infoValue}>{new Date(report?.created_at).toLocaleDateString()}</Text>
            </View>
             <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Validation Status:</Text>
              <Text style={[styles.infoValue, { fontWeight: 'bold' }]}>Verified (Quality: {riskReport?.confidenceScore >= 85 ? 'High' : (riskReport?.confidenceScore >= 60 ? 'Medium' : 'Low')})</Text>
            </View>
          </View>
        </View>

        {/* AI Executive Summary Panel */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Patient Friendly Summary</Text>
          <Text style={styles.summaryText}>
            {generatePatientSummary(validatedBiomarkers)}
          </Text>
        </View>

        {/* Clinical Patterns Detected Panel */}
        {riskReport?.clinicalPatterns && riskReport.clinicalPatterns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Clinical Patterns Detected</Text>
            {riskReport.clinicalPatterns.map((pattern: any, idx: number) => (
              <View key={idx} style={{ marginBottom: 6, padding: 6, borderWidth: 0.5, borderColor: '#cbd5e1', borderRadius: 3, backgroundColor: '#f8fafc', gap: 2 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e3a8a' }}>🧬 {pattern.name}</Text>
                <Text style={{ fontSize: 7.5 }}><Text style={{ fontWeight: 'bold', color: '#475569' }}>Evidence: </Text>{pattern.evidence.join(', ')}</Text>
                <Text style={{ fontSize: 7.5 }}><Text style={{ fontWeight: 'bold', color: '#475569' }}>Clinical Significance: </Text>{pattern.significance}</Text>
                <Text style={{ fontSize: 7.5 }}><Text style={{ fontWeight: 'bold', color: '#1e3a8a' }}>Recommended Follow-up: </Text>{pattern.followUp}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Clinical Pattern & Concerns Panel */}
        {riskReport && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Clinical Concerns & Prioritized Findings</Text>
            <View style={{ gap: 4, marginBottom: 8, paddingLeft: 4 }}>
              <Text style={{ fontSize: 8.5 }}><Text style={{ fontWeight: 'bold', color: '#1e293b' }}>Primary Concern: </Text>{riskReport.primaryConcern}</Text>
              {riskReport.secondaryConcern && (
                <Text style={{ fontSize: 8.5 }}><Text style={{ fontWeight: 'bold', color: '#475569' }}>Secondary Concern: </Text>{riskReport.secondaryConcern}</Text>
              )}
            </View>
            <View style={{ gap: 4, paddingLeft: 4, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 6 }}>
              {riskReport.findings?.primary?.length > 0 && (
                <Text style={{ fontSize: 8.5 }}><Text style={{ fontWeight: 'bold', color: '#dc2626' }}>Primary Findings: </Text>{riskReport.findings.primary.join(', ')}</Text>
              )}
              {riskReport.findings?.secondary?.length > 0 && (
                <Text style={{ fontSize: 8.5 }}><Text style={{ fontWeight: 'bold', color: '#d97706' }}>Secondary Findings: </Text>{riskReport.findings.secondary.join(', ')}</Text>
              )}
              {riskReport.findings?.normal?.length > 0 && (
                <Text style={{ fontSize: 8.5 }}><Text style={{ fontWeight: 'bold', color: '#16a34a' }}>Normal Findings: </Text>{riskReport.findings.normal.join(', ')}</Text>
              )}
            </View>
          </View>
        )}

        {/* System Health Score Table */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Organ System Health Profile</Text>
          <Text style={[styles.summaryText, { marginBottom: 10 }]}>
            Overall Health Score: <Text style={{ fontWeight: 'bold' }}>{riskReport?.overallHealthScore}/100</Text> | Overall Risk Classification: <Text style={{ fontWeight: 'bold', color: riskReport?.overallRiskLevel === 'Critical' ? '#7f1d1d' : (riskReport?.overallRiskLevel === 'High' ? '#dc2626' : (riskReport?.overallRiskLevel === 'Moderate' ? '#d97706' : '#16a34a')) }}>{riskReport?.overallRiskLevel} Risk</Text>
          </Text>

          {/* Render structured Organ breakdown */}
          {riskReport && Object.entries(riskReport.systems)
            .filter(([system, details]: any) => isSystemSupported(system, details))
            .map(([system, details]: any) => {
              const numUsed = details.biomarkersUsed?.length || 0;
              const numExpected = details.biomarkersExpected?.length || 0;
              const systemRiskColor = details.status === 'High' ? '#dc2626' : (details.status === 'Moderate' ? '#d97706' : (details.status === 'Mild' ? '#b45309' : '#16a34a'));
              
              return (
                <View key={system} style={styles.systemCard}>
                  <View style={styles.systemRow}>
                    <Text style={styles.systemName}>{system} panel</Text>
                    <Text style={[styles.systemStatus, { color: systemRiskColor }]}>
                      Grade {getOrganGrade(details.score)} ({details.status === 'Low' ? 'Excellent' : (details.status === 'Mild' ? 'Mild Attention Needed' : `${details.status} Risk`)})
                    </Text>
                  </View>
                  <View style={styles.systemDetails}>
                    <Text><Text style={{ fontWeight: 'bold' }}>Biomarkers Tested:</Text> {numUsed}/{numExpected}</Text>
                    <>
                      <Text><Text style={{ fontWeight: 'bold' }}>Primary Finding:</Text> {details.primaryFinding}</Text>
                      <Text><Text style={{ fontWeight: 'bold' }}>Clinical Interpretation:</Text> {details.clinicalInterpretation}</Text>
                      <Text><Text style={{ fontWeight: 'bold' }}>Clinical Urgency:</Text> {details.nextStep}</Text>
                    </>
                  </View>
                </View>
              );
            })}
        </View>
      </Page>

      {/* PAGE 2: Validated Biomarkers Detailed Lab Sheet */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportTitle}>Biomarker Verification Sheet</Text>
            <Text style={styles.reportSubtitle}>Observed Values Mapped to Reference Ranges</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Validated Laboratory Values</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colName}>Biomarker</Text>
              <Text style={styles.colValue}>Observed Value</Text>
              <Text style={styles.colRange}>Reference Interval</Text>
              <Text style={styles.colStatus}>Status</Text>
              <Text style={styles.colSeverity}>Severity</Text>
              <Text style={styles.colAction}>Clinical Action</Text>
            </View>

            {/* Table Rows */}
            {validatedBiomarkers.map((result: any, idx: number) => {
              const status = result.interpretedStatus;
              const severity = result.interpretedSeverity;
              
              const statusUpper = status.toUpperCase();
              const isNormal = statusUpper === 'NORMAL' || statusUpper === 'OPTIMAL' || statusUpper === 'PROTECTIVE';
              const isMild = statusUpper === 'PREDIABETES' || statusUpper === 'BORDERLINE' || statusUpper === 'BORDERLINE HIGH' || statusUpper === 'INSUFFICIENT';
              
              const statusColor = isNormal ? styles.statusNormal : (isMild ? styles.statusLow : styles.statusHigh);
              const rowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlternate;

              return (
                <View key={idx} style={rowStyle}>
                  <Text style={styles.colName}>{result.biomarker.name}</Text>
                  <Text style={styles.colValue}>
                    {result.biomarker.normalizedValue} {result.biomarker.normalizedUnit}
                  </Text>
                  <Text style={styles.colRange}>{result.interpretedRange}</Text>
                  <Text style={[styles.colStatus, statusColor]}>{status}</Text>
                  <Text style={[styles.colSeverity, statusColor]}>{severity}</Text>
                  <Text style={[styles.colAction, statusColor]}>{getActionNeeded(severity)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Detailed Clinical Interpretation list */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Biomarker Interpretations & Clinical Guidance</Text>
          <View style={{ gap: 5 }}>
            {validatedBiomarkers.map((result: any, idx: number) => (
              <Text key={idx} style={[styles.summaryText, { marginBottom: 3 }]}>
                • <Text style={{ fontWeight: 'bold' }}>{result.biomarker.name}:</Text> {result.patientExplanation}
              </Text>
            ))}
          </View>
        </View>
      </Page>

      {/* PAGE 3: Actionable Recommendations & Legal Declarations */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportTitle}>Recommendations & Medical Protocols</Text>
            <Text style={styles.reportSubtitle}>Actionable Protocols Derived from Anomalies</Text>
          </View>
        </View>

        {/* Actionable recommendations panel */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Actionable Clinical Interventions</Text>
          <View style={{ gap: 6 }}>
            {(() => {
              const filteredRecs = (analysis?.recommendations || []).filter((rec: any) => {
                const content = rec.content.toLowerCase();
                const category = rec.category.toLowerCase();
                const findBio = (name: string) => validatedBiomarkers.find(b => b.biomarker.name === name);
                
                const isPresent = (name: string) => findBio(name) !== undefined;

                // Determine presence of biomarker panels
                const hasSugar = isPresent('Glucose') || isPresent('HbA1c');
                const hasLipid = isPresent('LDL') || isPresent('HDL') || isPresent('Triglycerides') || isPresent('Total Cholesterol');
                const hasKidney = isPresent('Creatinine') || isPresent('eGFR');
                const hasLiver = isPresent('ALT') || isPresent('AST') || isPresent('ALP');
                const hasHematology = isPresent('Hemoglobin') || isPresent('RBC') || isPresent('WBC') || isPresent('Platelets');
                const hasVitaminD = isPresent('Vitamin D');
                const hasVitaminB12 = isPresent('Vitamin B12');

                // Check mentioned domains (with safeguard against "cardiovascular exercise")
                const mentionsSugar = content.includes('sugar') || content.includes('glucose') || content.includes('hba1c') || content.includes('glycemic') || category.includes('diabetes');
                const mentionsLipid = content.includes('cholesterol') || content.includes('ldl') || content.includes('lipid') || content.includes('triglycerides') || category.includes('cardio') || (content.includes('cardiovascular') && !content.includes('cardiovascular exercise') && !content.includes('cardiovascular activity') && !content.includes('cardiovascular fitness') && !content.includes('cardiovascular health') && !content.includes('cardiovascular training'));
                const mentionsKidney = content.includes('creatinine') || content.includes('egfr') || content.includes('kidney') || content.includes('renal');
                const mentionsLiver = content.includes('liver') || content.includes('alt') || content.includes('ast') || content.includes('alp') || content.includes('enzyme');
                const mentionsHematology = content.includes('hemoglobin') || content.includes('anemia') || content.includes('iron') || content.includes('rbc') || content.includes('cbc') || content.includes('platelet') || content.includes('wbc') || content.includes('hematologic');
                const mentionsVitaminD = content.includes('vitamin d') || content.includes('vit d') || content.includes('hydroxyvitamin');
                const mentionsVitaminB12 = content.includes('b12') || content.includes('cobalamin') || content.includes('vitamin b12');

                // If it explicitly details missing/not-evaluated panels or screenings, allow it as preventive feedback
                if (content.includes('did not evaluate') || content.includes('not tested') || content.includes('not evaluate') || content.includes('screening')) {
                  return true;
                }

                // For general routine wellness or doctor/annual checkups, show them unless they only mention missing panels
                const isGeneral = category.includes('general') || category.includes('follow-up') || content.includes('annual') || content.includes('routine') || content.includes('wellness') || content.includes('examination') || content.includes('physician') || content.includes('doctor');

                // Build list of mentioned and present domains for intersection check
                const mentionedDomains: string[] = [];
                if (mentionsSugar) mentionedDomains.push('sugar');
                if (mentionsLipid) mentionedDomains.push('lipid');
                if (mentionsKidney) mentionedDomains.push('kidney');
                if (mentionsLiver) mentionedDomains.push('liver');
                if (mentionsHematology) mentionedDomains.push('hematology');
                if (mentionsVitaminD) mentionedDomains.push('vitamind');
                if (mentionsVitaminB12) mentionedDomains.push('vitaminb12');

                if (mentionedDomains.length === 0) {
                  return true; // General recommendation, always show
                }

                const presentDomains: string[] = [];
                if (hasSugar) presentDomains.push('sugar');
                if (hasLipid) presentDomains.push('lipid');
                if (hasKidney) presentDomains.push('kidney');
                if (hasLiver) presentDomains.push('liver');
                if (hasHematology) presentDomains.push('hematology');
                if (hasVitaminD) presentDomains.push('vitamind');
                if (hasVitaminB12) presentDomains.push('vitaminb12');

                // Allow the recommendation if at least one mentioned panel is present in the report
                const hasMatchingPresentDomain = mentionedDomains.some(d => presentDomains.includes(d));

                if (isGeneral) {
                  // For general checkup, hide only if it mentions sugar/lipid/kidney/liver specific markers but all of those mentioned are missing
                  if (mentionsSugar && !hasSugar) return false;
                  if (mentionsLipid && !hasLipid) return false;
                  if (mentionsKidney && !hasKidney) return false;
                  if (mentionsLiver && !hasLiver) return false;
                  return true;
                }

                return hasMatchingPresentDomain;
              });

              if (filteredRecs.length === 0) {
                return (
                  <View style={{ padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 4 }}>
                    <Text style={[styles.summaryText, { color: '#64748b', textAlign: 'center' }]}>
                      No actionable recommendations triggered by abnormal biomarkers.
                    </Text>
                  </View>
                );
              }

              const sortedRecs = [...filteredRecs].sort((a, b) => (a.priority || 3) - (b.priority || 3));

              return sortedRecs.map((rec: any, idx: number) => {
                const enhanced = getEnhancedRecommendation(rec, validatedBiomarkers);
                const priorityColor = rec.priority === 1 ? '#dc2626' : (rec.priority === 2 ? '#d97706' : '#475569');

                return (
                  <View key={rec.id || idx} style={styles.recCard}>
                    <View style={styles.recHeader}>
                      <Text style={styles.recCategory}>{idx + 1}. {rec.category}</Text>
                      <Text style={[styles.recPriority, { color: priorityColor }]}>Priority Level {rec.priority}</Text>
                    </View>
                    <Text style={styles.recContent}>{rec.content}</Text>
                    
                    {/* Clinical Metadata */}
                    <View style={styles.recGrid}>
                      <View style={styles.recGridItem}>
                        <Text style={styles.recLabel}>Triggered By: <Text style={styles.recValue}>{enhanced.triggeredBy} {enhanced.currentValue ? `(${enhanced.currentValue})` : ''}</Text></Text>
                      </View>
                      <View style={styles.recGridItem}>
                        <Text style={styles.recLabel}>Target Value: <Text style={styles.recValue}>{enhanced.targetValue}</Text></Text>
                      </View>
                      <View style={styles.recGridItem}>
                        <Text style={styles.recLabel}>Retest Timeline: <Text style={styles.recValue}>{enhanced.retestTimeline}</Text></Text>
                      </View>
                      <View style={styles.recGridItem}>
                        <Text style={styles.recLabel}>Expected Outcome: <Text style={styles.recValue}>{enhanced.expectedOutcome}</Text></Text>
                      </View>
                    </View>

                    {rec.safety_check && (
                      <Text style={[styles.recSafety, { color: '#dc2626', marginTop: 4, fontWeight: 'bold' }]}>
                        Safety Disclaimer: {rec.safety_check}
                      </Text>
                    )}
                  </View>
                );
              });
            })()}
          </View>
        </View>

        {/* Legal medical disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Medical Disclaimer & Conditions of Reporting:</Text>
          <Text>
            1. The clinical AI evaluations provided in this document are generated automatically from digitalized data extracts of biological reports. These evaluations are synthesized strictly for personal metabolic tracking, health self-auditing, and reference purposes.
          </Text>
          <Text style={{ marginTop: 2 }}>
            2. This report does not constitute official medical advice, diagnostic services, or the prescription of therapeutic protocols. Any actions or adjustments concerning medications, dietary supplements, exercise regimens, or disease management protocols must be reviewed directly with your primary care physician or a qualified clinical specialist.
          </Text>
          <Text style={{ marginTop: 2 }}>
            3. Accuracy of the AI synthesis depends entirely on the OCR readability of the uploaded documentation. Standard physical parameters and individual patient clinical history must be correlated by a certified pathologist or general practitioner before any medical conclusions are drawn.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
