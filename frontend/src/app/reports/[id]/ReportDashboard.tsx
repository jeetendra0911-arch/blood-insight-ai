'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { calculateRisk, RiskAnalysisReport } from '@/lib/risk-engine';
import { validateBiomarker, MedicalValidationResult } from '@/lib/medical-validation';
import dynamic from 'next/dynamic';
import ThemeToggle from '@/components/ThemeToggle';

const PDFButton = dynamic(() => import('./PDFButton'), { ssr: false });
import { 
  ArrowLeft, Loader2, CheckCircle, AlertTriangle, 
  Heart, Activity, Info, LogOut, Download, AlertCircle, Sparkles,
  ChevronDown, ChevronUp, Search, Settings, Filter, List, Layers
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from 'recharts';

function generatePatientSummary(validatedList: any[]): string {
  if (!validatedList || validatedList.length === 0) {
    return "";
  }

  const abnormals = validatedList.filter(r => r.interpretedSeverity !== 'Normal');
  const normals = validatedList.filter(r => r.interpretedSeverity === 'Normal');

  if (abnormals.length === 0) {
    return "Great news! All of your analyzed biomarkers are currently within their normal, healthy limits. This indicates good cardiovascular, metabolic, and systemic health. To maintain this profile, continue with your balanced diet, regular exercise, and standard routine screenings. No immediate medical follow-up or lifestyle interventions are indicated.";
  }

  // Group abnormals
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

  // Normal findings
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

function getOrganGrade(score: number): string {
  if (score <= 15) return 'A+';
  if (score <= 30) return 'A';
  if (score <= 45) return 'B';
  if (score <= 60) return 'C';
  if (score <= 80) return 'D';
  return 'F';
}

function getImpactLevel(status: string): string {
  if (status === 'High') return 'Critical Impact';
  if (status === 'Moderate') return 'High Impact';
  if (status === 'Mild') return 'Moderate Impact';
  return 'Low Impact';
}

function getAssessmentQuality(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 85) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
}

const isSystemSupported = (system: string, details: any) => {
  return details && details.biomarkersUsed && details.biomarkersUsed.length > 0;
};

const BIOMARKER_CATEGORIES: Record<string, string[]> = {
  Cardiovascular: ['LDL', 'HDL', 'Triglycerides', 'Total Cholesterol'],
  Diabetes: ['HbA1c', 'Glucose'],
  Liver: ['ALT', 'AST', 'ALP', 'Bilirubin Total', 'Bilirubin Direct', 'Albumin'],
  Kidney: ['Creatinine', 'eGFR', 'BUN', 'Urea', 'Uric Acid'],
  Thyroid: ['TSH', 'T3', 'T4'],
  Vitamins: ['Vitamin D', 'Vitamin B12', 'Ferritin', 'Iron'],
  Hormones: ['DHT', 'SHBG', 'Cortisol'],
  CBC: ['Hemoglobin', 'RBC', 'WBC', 'Platelets', 'MCV', 'MCH', 'Macroovalocytes'],
  Inflammation: ['CRP']
};

function getAccessibilityIndicator(result: MedicalValidationResult) {
  const status = result.interpretedStatus.toUpperCase();
  const severity = result.interpretedSeverity;

  if (severity === 'Critical') {
    return { symbol: '🚨', text: 'Critical', color: 'text-red-700 bg-red-100 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50 font-black' };
  }
  
  if (status.includes('BORDERLINE') || status.includes('PREDIABETES') || status.includes('INSUFFICIENT')) {
    return { symbol: '⚠', text: 'Borderline', color: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30 font-semibold' };
  }

  if (status.includes('HIGH') || status.includes('VERY HIGH') || status.includes('POSITIVE') || status.includes('PRESENT')) {
    return { symbol: '▲', text: 'High', color: 'text-red-650 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 font-semibold' };
  }

  if (status.includes('LOW') || status.includes('DEFICIENT') || status.includes('SEVERE DEFICIENCY')) {
    return { symbol: '▼', text: 'Low', color: 'text-red-650 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 font-semibold' };
  }

  return { symbol: '✓', text: 'Normal', color: 'text-green-700 bg-green-50 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30' };
}

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
    } else if (hdl && hdl.interpretedSeverity !== 'Low') {
      bioName = "HDL Cholesterol";
      currentVal = `${hdl.biomarker.normalizedValue} mg/dL`;
      targetVal = ">= 40 mg/dL (M), >= 50 mg/dL (F)";
      timeline = "3 months";
      outcome = "Increased reverse cholesterol transport efficiency.";
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

export default function ReportDetailsPage() {
  const params = useParams();
  const reportId = Number(params.id);
  const router = useRouter();

  const [report, setReport] = useState<any>(null);
  const [biomarkers, setBiomarkers] = useState<any[]>([]);
  const [validatedBiomarkers, setValidatedBiomarkers] = useState<MedicalValidationResult[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [riskReport, setRiskReport] = useState<RiskAnalysisReport | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    scoreBreakdown: true,
    executiveSummary: false,
    clinicalPatterns: false,
    clinicalConcerns: false,
    prioritizedFindings: false,
    keyFindings: true,
    organSystems: false,
    recommendations: false,
    technicalIngestion: false,
  });

  const [collapsedOrganSystems, setCollapsedOrganSystems] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleOrganSystem = (system: string) => {
    setCollapsedOrganSystems(prev => ({ ...prev, [system]: !prev[system] }));
  };

  useEffect(() => {
    setIsClient(true);
    if (!api.isAuthenticated()) {
      router.push('/login');
      return;
    }
    const fetchUser = async () => {
      try {
        const userData = await api.getMe();
        setUser(userData);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      }
    };
    fetchUser();
    loadData();
  }, [reportId]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch details of active report
      const [reportData, biomarkersData, analysisData, allReports] = await Promise.all([
        api.getReport(reportId),
        api.getReportBiomarkers(reportId),
        api.getReportAnalysis(reportId),
        api.listReports(),
      ]);
      
      setReport(reportData);
      setAnalysis(analysisData);

      // Validate all biomarkers
      const gender = reportData?.user?.gender || 'MALE';
      const validatedList = biomarkersData.map((b: any) => {
        const valResult = validateBiomarker(b.name, b.value, b.unit, gender, b.reference_range);
        (valResult as any).dbBiomarker = b;
        return valResult;
      });
      setValidatedBiomarkers(validatedList);
      setBiomarkers(biomarkersData);

      // Extract completed reports chronologically
      const completedReports = allReports
        .filter((r: any) => r.status?.toLowerCase() === 'completed')
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Attempt to calculate previous report's risk for trend indicator
      const currentIndex = completedReports.findIndex((r: any) => r.id === reportId);
      let previousScores: Record<string, number> | undefined = undefined;

      if (currentIndex > 0) {
        try {
          const prevReportId = completedReports[currentIndex - 1].id;
          const prevBiomarkers = await api.getReportBiomarkers(prevReportId);
          const prevRisk = calculateRisk(prevBiomarkers, gender);
          previousScores = {
            cardiovascular: prevRisk.systems.cardiovascular.score,
            diabetes: prevRisk.systems.diabetes.score,
            kidney: prevRisk.systems.kidney.score,
            liver: prevRisk.systems.liver.score,
            hematology: prevRisk.systems.hematology.score,
          };
        } catch (e) {
          console.error("Failed to compute previous report's risk scores", e);
        }
      }

      // Re-calculate Risk using custom Risk Engine, passing previousScores for trend calculations
      const risk = calculateRisk(biomarkersData, gender, previousScores);
      setRiskReport(risk);

      // Fetch biomarkers for completed reports in parallel to construct history
      const historyPromise = completedReports.map(async (r: any) => {
        try {
          const bios = await api.getReportBiomarkers(r.id);
          const points: Record<string, any> = {
            date: new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
            reportId: r.id,
          };
          bios.forEach((b: any) => {
            const norm = validateBiomarker(b.name, b.value, b.unit, gender);
            points[norm.biomarker.name] = norm.biomarker.normalizedValue;
          });
          return points;
        } catch {
          return null;
        }
      });

      const historyResults = await Promise.all(historyPromise);
      setHistoricalData(historyResults.filter(Boolean));

    } catch (err: any) {
      setError(err.message || 'Failed to load report insights.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold animate-pulse">Running validation & risk mapping...</p>
        </div>
      </div>
    );
  }

  if (error || !report || !riskReport) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Clinical Verification Error</h3>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{error || 'Data verification failed.'}</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const patientName = report.metadata_json?.patient_name || report.user?.full_name || 'Guest Patient';
  const dob = report.user?.dob;
  const age = report.metadata_json?.patient_age || (dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 'N/A');
  const gender = report.metadata_json?.patient_gender || report.user?.gender || 'Not Specified';
  const labName = report.metadata_json?.lab_name || 'Inferred Labcorp';


  const score = riskReport.overallHealthScore;
  const riskLevel = riskReport.overallRiskLevel;

  const findBio = (name: string) => validatedBiomarkers.find(b => b.biomarker.name === name);
  
  const hasEmergencyFinding = 
    (findBio('eGFR') && (findBio('eGFR')?.biomarker.normalizedValue ?? 100) < 15) ||
    (findBio('Creatinine') && (findBio('Creatinine')?.biomarker.normalizedValue ?? 0) >= 3.0) ||
    (findBio('ALT') && (findBio('ALT')?.biomarker.normalizedValue ?? 0) > 500) ||
    (findBio('AST') && (findBio('AST')?.biomarker.normalizedValue ?? 0) > 500) ||
    (findBio('Sodium') && ((findBio('Sodium')?.biomarker.normalizedValue ?? 140) <= 120 || (findBio('Sodium')?.biomarker.normalizedValue ?? 140) >= 160)) ||
    (findBio('Hemoglobin') && (findBio('Hemoglobin')?.biomarker.normalizedValue ?? 15) <= 7.0) ||
    (findBio('Platelets') && (findBio('Platelets')?.biomarker.normalizedValue ?? 250) <= 50) ||
    (findBio('CRP') && (findBio('CRP')?.biomarker.normalizedValue ?? 0) >= 10.0);

  const hasCardio = ['LDL', 'HDL', 'Triglycerides', 'Total Cholesterol'].every(name => findBio(name) !== undefined);
  const hasDiabetes = findBio('HbA1c') !== undefined || findBio('Glucose') !== undefined;
  const hasKidney = ['Creatinine', 'eGFR'].every(name => findBio(name) !== undefined);
  const hasLiver = ['ALT', 'AST'].every(name => findBio(name) !== undefined);
  const hasHematology = ['Hemoglobin', 'RBC', 'WBC', 'Platelets'].every(name => findBio(name) !== undefined);
  const hasVitamins = findBio('Vitamin D') !== undefined || findBio('Vitamin B12') !== undefined;
  const hasIron = findBio('Ferritin') !== undefined || findBio('Iron') !== undefined;
  const hasThyroid = findBio('TSH') !== undefined || findBio('T3') !== undefined || findBio('T4') !== undefined;
  const hasInflammation = findBio('CRP') !== undefined;
  const hasHormonal = findBio('DHT') !== undefined || findBio('SHBG') !== undefined || findBio('Cortisol') !== undefined;
  const hasAutoimmune = findBio('ANA') !== undefined;
  const hasHair = findBio('Ferritin') !== undefined || findBio('Zinc') !== undefined || findBio('DHT') !== undefined;
  const hasMinerals = findBio('Calcium') !== undefined || findBio('Phosphorus') !== undefined || findBio('Magnesium') !== undefined || findBio('Zinc') !== undefined;

  const systemsCoverage = [
    { name: 'Cardiovascular', evaluated: hasCardio },
    { name: 'Diabetes', evaluated: hasDiabetes },
    { name: 'Kidney', evaluated: hasKidney },
    { name: 'Liver', evaluated: hasLiver },
    { name: 'Hematology', evaluated: hasHematology },
    { name: 'Vitamins', evaluated: hasVitamins },
    { name: 'Iron Metabolism', evaluated: hasIron },
    { name: 'Thyroid', evaluated: hasThyroid },
    { name: 'Inflammation', evaluated: hasInflammation },
    { name: 'Hormonal Health', evaluated: hasHormonal },
    { name: 'Autoimmune Markers', evaluated: hasAutoimmune },
    { name: 'Hair Health', evaluated: hasHair },
    { name: 'Minerals & Electrolytes', evaluated: hasMinerals }
  ];
  const riskColor = riskLevel === 'Critical' ? 'text-red-700 bg-red-100 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50 font-black' :
                    (riskLevel === 'High' ? 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30' : 
                    (riskLevel === 'Moderate' ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' : 
                    'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30'));

  const riskBadge = riskLevel === 'Critical' ? '🚨 Critical Risk' : (riskLevel === 'High' ? '🔴 High Risk' : (riskLevel === 'Moderate' ? '🟡 Moderate Risk' : '🟢 Low Risk'));

  // --- MODULAR TAB RENDER HELPERS ---
  const renderOverviewTab = () => {
    const breakdown = riskReport.scoringBreakdown || {
      baseScore: 100,
      coverageBonus: 10,
      systemDeductions: []
    };

    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition hover:shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-500" />
              Patient Profile
            </h3>
            <div className="space-y-3">
              <p className="text-xl font-bold text-slate-900 dark:text-white">{patientName}</p>
              <div className="grid grid-cols-1 gap-y-2.5 sm:grid-cols-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>Age: <strong className="text-slate-800 dark:text-slate-200">{age} yrs</strong></span>
                <span>Gender: <strong className="text-slate-800 dark:text-slate-200 capitalize">{gender.toLowerCase()}</strong></span>
                <span>Lab: <strong className="text-slate-800 dark:text-slate-200">{labName}</strong></span>
                <span>Uploaded: <strong className="text-slate-800 dark:text-slate-200">{new Date(report.created_at).toLocaleDateString()}</strong></span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between transition hover:shadow-md">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">AI Health Score</h3>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-blue-600 dark:text-blue-400">{score}</span>
                <span className="text-lg font-bold text-slate-400">/100</span>
              </div>
              <div className="mt-3">
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold border ${riskColor}`}>
                  {riskBadge}
                </span>
              </div>
            </div>
            
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button 
                onClick={() => toggleSection('scoreBreakdown')}
                className="w-full flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider focus:outline-none hover:text-slate-650 dark:hover:text-slate-350"
              >
                <span>Clinical Score Breakdown</span>
                {collapsedSections.scoreBreakdown ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
              
              {!collapsedSections.scoreBreakdown && (
                <div className="mt-3 text-[10px] text-slate-500 dark:text-slate-400 space-y-1.5 font-medium transition-all">
                  <div className="flex justify-between">
                    <span>Base Score</span>
                    <span className="font-bold text-green-600 dark:text-green-400">+{breakdown.baseScore} pts</span>
                  </div>

                  {breakdown.coverageBonus > 0 && (
                    <div className="flex justify-between">
                      <span>Data Coverage Bonus</span>
                      <span className="font-bold text-green-600 dark:text-green-400">+{breakdown.coverageBonus} pts</span>
                    </div>
                  )}

                  {(breakdown.systemDeductions || []).map((sd: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{sd.label}</span>
                      <span className="font-bold text-red-650 dark:text-red-400">-{sd.deduction} pts</span>
                    </div>
                  ))}

                  <div className="flex justify-between border-t border-dashed border-slate-200 dark:border-slate-800 pt-1.5 font-bold text-blue-600 dark:text-blue-400">
                    <span>Final Score</span>
                    <span>{score} / 100</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between transition hover:shadow-md">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Assessment Quality</h3>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black ${
                  getAssessmentQuality(riskReport.confidenceScore) === 'High' ? 'text-green-600 dark:text-green-400' :
                  getAssessmentQuality(riskReport.confidenceScore) === 'Medium' ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                }`}>{getAssessmentQuality(riskReport.confidenceScore)}</span>
              </div>
              <div className="flex gap-2 items-center text-xs text-slate-500 mt-3 dark:text-slate-400">
                <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
                <span>Full extraction validation completed.</span>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-[10px] text-slate-500 dark:text-slate-400 space-y-1 font-medium">
              <span className="font-bold text-slate-400 dark:text-slate-500 block uppercase tracking-wider text-[9px] mb-1">Extraction Statistics</span>
              <div className="flex justify-between">
                <span>Total Biomarkers Extracted</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{validatedBiomarkers.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Verified Matches</span>
                <span className="font-bold text-green-600 dark:text-green-400">{validatedBiomarkers.filter(b => b.biomarker.confidence >= 0.8).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Manual Reviews Flagged</span>
                <span className="font-bold text-amber-655 dark:text-amber-400">{validatedBiomarkers.filter(b => b.biomarker.confidence < 0.8 || b.biomarker.validationWarning).length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => toggleSection('executiveSummary')}
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Executive AI Summary
            </h3>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                AI Generated
              </span>
              {collapsedSections.executiveSummary ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronUp className="h-5 w-5 text-slate-400" />}
            </div>
          </div>
          
          {!collapsedSections.executiveSummary && (
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Patient-Friendly Summary</h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm antialiased font-medium bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                  {generatePatientSummary(validatedBiomarkers)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCriticalFindingsTab = () => {
    return (
      <div className="space-y-6">
        {hasEmergencyFinding && (
          <div className="bg-red-55/10 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-5 flex gap-3 items-start text-red-805 dark:text-red-300 shadow-sm border-l-4 border-l-red-600">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">🚨 Critical Patient Warning</h4>
              <p className="text-xs mt-1 font-semibold leading-relaxed">This report contains critical biomarker deviations that require immediate medical attention. Please review the highlighted indicators and consult a physician immediately.</p>
            </div>
          </div>
        )}

        {riskReport.clinicalPatterns && riskReport.clinicalPatterns.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 hover:shadow-md transition">
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => toggleSection('clinicalPatterns')}
            >
              <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-500" />
                Clinical Patterns Detected
              </h3>
              {collapsedSections.clinicalPatterns ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronUp className="h-5 w-5 text-slate-400" />}
            </div>
            
            {!collapsedSections.clinicalPatterns && (
              <div className="grid gap-4 mt-2">
                {riskReport.clinicalPatterns.map((pattern, idx) => (
                  <div key={idx} className="bg-blue-50/20 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/30 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-sm font-bold text-blue-800 dark:text-blue-400">🧬 {pattern.name}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200/50 dark:border-blue-900/35">Pattern Detected</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Evidence</span>
                        <div className="flex flex-wrap gap-1.5">
                          {pattern.evidence.map((ev, evIdx) => (
                            <span key={evIdx} className="inline-flex items-center rounded-md bg-red-50 dark:bg-red-950/20 px-2 py-0.5 text-xs font-mono font-bold text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/25">
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Recommended Follow-up</span>
                        <p className="font-bold text-blue-700 dark:text-blue-300">{pattern.followUp}</p>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Clinical Significance</span>
                      <p className="text-slate-650 dark:text-slate-350 leading-relaxed font-medium">{pattern.significance}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 hover:shadow-md transition">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => toggleSection('clinicalConcerns')}
          >
            <h3 className="text-md font-bold text-slate-900 dark:text-white">Clinical Concerns</h3>
            {collapsedSections.clinicalConcerns ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronUp className="h-5 w-5 text-slate-400" />}
          </div>
          
          {!collapsedSections.clinicalConcerns && (
            <div className="grid gap-4 sm:grid-cols-2 mt-2">
              <div className="bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 p-4 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Primary Concern</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{riskReport.primaryConcern}</p>
              </div>
              {riskReport.secondaryConcern && (
                <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Secondary Concern</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{riskReport.secondaryConcern}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 hover:shadow-md transition">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => toggleSection('prioritizedFindings')}
          >
            <h3 className="text-md font-bold text-slate-900 dark:text-white">Prioritized Findings Summary</h3>
            {collapsedSections.prioritizedFindings ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronUp className="h-5 w-5 text-slate-400" />}
          </div>
          
          {!collapsedSections.prioritizedFindings && (
            <div className="grid gap-4 md:grid-cols-3 mt-2">
              <div className="bg-red-50/20 dark:bg-red-950/5 border border-red-100/30 dark:border-red-900/20 p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider block">Primary Findings ({riskReport.findings.primary.length})</span>
                {riskReport.findings.primary.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-350 list-disc pl-4 font-medium">
                    {riskReport.findings.primary.map((finding, fIdx) => (
                      <li key={fIdx}>{finding}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No primary findings identified.</p>
                )}
              </div>

              <div className="bg-amber-50/20 dark:bg-amber-950/5 border border-amber-100/30 dark:border-amber-900/20 p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Secondary Findings ({riskReport.findings.secondary.length})</span>
                {riskReport.findings.secondary.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-350 list-disc pl-4 font-medium">
                    {riskReport.findings.secondary.map((finding, fIdx) => (
                      <li key={fIdx}>{finding}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No secondary findings identified.</p>
                )}
              </div>

              <div className="bg-green-50/20 dark:bg-green-950/5 border border-green-100/30 dark:border-green-900/20 p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-wider block">Normal Findings ({riskReport.findings.normal.length})</span>
                {riskReport.findings.normal.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-350 list-disc pl-4 font-medium">
                    {riskReport.findings.normal.map((finding, fIdx) => (
                      <li key={fIdx}>{finding}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No normal findings identified.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDetailedAnalysisTab = () => {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => toggleSection('organSystems')}
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Organ System Health Analysis</h3>
            {collapsedSections.organSystems ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronUp className="h-5 w-5 text-slate-400" />}
          </div>
          
          {!collapsedSections.organSystems && (
            <div className="grid gap-4 sm:grid-cols-2 mt-2">
              {Object.entries(riskReport.systems)
                .filter(([system, data]: any) => isSystemSupported(system, data))
                .map(([system, data]: any) => {
                  const numUsed = data.biomarkersUsed?.length || 0;
                  const numExpected = data.biomarkersExpected?.length || 0;
                  const isNotAssessed = numUsed === 0;

                  const sColor = isNotAssessed ? 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 opacity-70' :
                                 (data.status === 'High' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/30' :
                                 (data.status === 'Moderate' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-900/30' :
                                 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'));
                  
                  const textStatusColor = isNotAssessed ? 'text-slate-500 dark:text-slate-400' :
                                           (data.status === 'High' ? 'text-red-600 dark:text-red-400' :
                                           (data.status === 'Moderate' ? 'text-amber-600 dark:text-amber-400' :
                                           (data.status === 'Mild' ? 'text-yellow-600 dark:text-yellow-500' :
                                           'text-green-600 dark:text-green-400')));

                  const systemIcon = data.status === 'High' ? '🚨' :
                                     data.status === 'Moderate' ? '⚠' :
                                     data.status === 'Mild' ? '⚠' : '✓';

                  const isSystemCollapsed = collapsedOrganSystems[system] ?? false;

                  return (
                    <div key={system} className={`rounded-xl border p-5 flex flex-col justify-between hover:shadow-md transition duration-150 ${sColor}`}>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900 dark:text-white capitalize flex items-center gap-1.5">
                            <span>{systemIcon}</span>
                            <span>{system}</span>
                          </span>
                          <span className={`text-xs font-extrabold flex items-center gap-1 ${textStatusColor}`}>
                            <span>{isNotAssessed ? 'Not Assessed' : (data.status === 'Low' ? 'Excellent' : (data.status === 'Mild' ? 'Mild Attention' : `${data.status} Risk`))}</span>
                          </span>
                        </div>

                        <div className="flex justify-between items-baseline flex-wrap gap-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-800 dark:text-white">
                              {isNotAssessed ? '--' : data.score}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">/100</span>
                          </div>
                          
                          <div className="flex flex-col items-end text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider space-y-0.5">
                            <span>Tested: <strong className="text-slate-700 dark:text-slate-200">{numUsed}/{numExpected}</strong></span>
                            {data.trend && !isNotAssessed && (
                              <span className="flex items-center gap-1">
                                Trend:{' '}
                                <strong className={`px-1.5 py-0.2 rounded ${
                                  data.trend === 'Improving' ? 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400' :
                                  data.trend === 'Worsening' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' :
                                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                  {data.trend}
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <button
                          onClick={() => toggleOrganSystem(system)}
                          className="w-full flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider focus:outline-none"
                        >
                          <span>Biomarkers & Findings</span>
                          {isSystemCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                        </button>

                        {!isSystemCollapsed && (
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              Biomarkers: {data.biomarkersExpected.join(' • ')}
                            </div>
                            <p className="text-slate-650 dark:text-slate-400 leading-relaxed font-medium">
                              {isNotAssessed ? `No ${system} biomarkers were tested in this report.` : data.findings}
                            </p>

                            {data.biomarkersUsed && data.biomarkersUsed.length > 0 && (
                              <div className="border-t border-slate-100 pt-2 dark:border-slate-800/80 mt-2 space-y-1">
                                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Highlights</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {data.biomarkersUsed.map((bio: any, bIdx: number) => (
                                    <span
                                      key={bIdx}
                                      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border ${
                                        bio.isAbnormal
                                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30'
                                          : 'bg-slate-50 text-slate-650 border-slate-100 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800/40'
                                      }`}
                                    >
                                      {bio.name} {bio.value} {bio.arrow}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => toggleSection('keyFindings')}
          >
            <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Key Findings By Organ System
            </h3>
            {collapsedSections.keyFindings ? <ChevronDown className="h-5 w-5 text-slate-450" /> : <ChevronUp className="h-5 w-5 text-slate-450" />}
          </div>
          
          {!collapsedSections.keyFindings && (
            <div className="space-y-6 mt-4">
              {Object.entries(riskReport.systems)
                .filter(([system, details]: any) => isSystemSupported(system, details))
                .sort((a: any, b: any) => {
                  const severityWeights: Record<string, number> = { High: 4, Moderate: 3, Mild: 2, Low: 1 };
                  const weightA = severityWeights[a[1].status] || 0;
                  const weightB = severityWeights[b[1].status] || 0;
                  return weightB - weightA;
                })
                .map(([system, details]: any) => {
                  const badgeIcon = details.status === 'High' ? '🔴' :
                                    details.status === 'Moderate' ? '🟠' :
                                    details.status === 'Mild' ? '🟡' : '🟢';

                  return (
                    <div key={system} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0 dark:border-slate-800/50 space-y-2">
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white capitalize">
                        <div className="flex items-center gap-1.5">
                          <span>{badgeIcon}</span>
                          <span>{system}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">({details.status} Risk)</span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-black dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30 shadow-sm">
                          Grade {getOrganGrade(details.score)}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-xs pl-6">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Primary Finding</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono whitespace-pre-line">{details.primaryFinding}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Interpretation</span>
                          <span className="text-slate-650 dark:text-slate-350 font-medium">{details.clinicalInterpretation}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Why This Matters</span>
                          <span className="text-slate-500 dark:text-slate-400 font-medium">{details.whyThisMatters}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Impact Level</span>
                          <span className={`font-bold ${
                            details.status === 'High' ? 'text-red-650 dark:text-red-400' :
                            details.status === 'Moderate' ? 'text-orange-600 dark:text-orange-400' :
                            details.status === 'Mild' ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-green-600 dark:text-green-400'
                          }`}>{getImpactLevel(details.status)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Next Step</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{details.nextStep}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBiomarkerExplorerTab = () => {
    const filtered = validatedBiomarkers.filter(result => {
      const name = result.biomarker.name;
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || (() => {
        const list = BIOMARKER_CATEGORIES[selectedCategory];
        const isMatchedStatic = list ? list.includes(name) : false;
        const dbCategory = (result as any).dbBiomarker?.patient_explanation?.category;
        const isMatchedDynamic = dbCategory ? dbCategory.toLowerCase() === selectedCategory.toLowerCase() : false;
        return isMatchedStatic || isMatchedDynamic;
      })();
      return matchesSearch && matchesCategory;
    });

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Biomarker Explorer</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Search and filter validated biomarker outcomes.</p>
          </div>
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search biomarkers (e.g. B12, Glucose)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          {['All', ...Object.keys(BIOMARKER_CATEGORIES)].map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500'
                    : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="text-xs text-slate-500 dark:text-slate-455 font-bold">
            Showing {filtered.length} of {validatedBiomarkers.length} biomarkers
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/85">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr className="text-slate-500 dark:text-slate-450 text-xs uppercase font-bold tracking-wider">
                  <th className="py-3 px-4 text-left">Biomarker</th>
                  <th className="py-3 px-4 text-left">Value</th>
                  <th className="py-3 px-4 text-left">Reference Range</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left">Severity</th>
                  <th className="py-3 px-4 text-right">Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900">
                {filtered.map((result, idx) => {
                  const status = result.interpretedStatus;
                  const severity = result.interpretedSeverity;
                  
                  const indicator = getAccessibilityIndicator(result);
                  
                  const severityBadgeColor = severity === 'Normal'
                    ? 'text-green-700 bg-green-50 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30'
                    : severity === 'Mild'
                    ? 'text-yellow-600 bg-yellow-50 border-yellow-250 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30 font-semibold'
                    : severity === 'Moderate'
                    ? 'text-orange-700 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30'
                    : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
                  
                  const warningIcon = result.requiresManualReview && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 dark:bg-amber-955/15 dark:text-amber-450 dark:border-amber-900/25 mt-1.5" title="Verification quality warning">
                      <AlertCircle className="h-3 w-3" />
                      Manual Review Recommended
                    </span>
                  );

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">
                        <span className="block">{result.biomarker.name}</span>
                        {warningIcon}
                      </td>
                      <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {result.biomarker.normalizedValue} {result.biomarker.normalizedUnit}
                        {result.biomarker.validationWarning && (
                          <span className="block text-[10px] text-amber-650 italic mt-0.5">{result.biomarker.validationWarning}</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{result.interpretedRange}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${indicator.color}`}>
                          <span>{indicator.symbol}</span>
                          <span>{indicator.text}</span>
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${severityBadgeColor}`}>
                          {severity}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-xs text-slate-500 dark:text-slate-400 max-w-[250px] leading-relaxed font-medium">
                        {result.patientExplanation}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                      No biomarkers found matching "{searchQuery}" under {selectedCategory} category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filtered.map((result, idx) => {
              const status = result.interpretedStatus;
              const severity = result.interpretedSeverity;
              const indicator = getAccessibilityIndicator(result);
              
              const severityBadgeColor = severity === 'Normal'
                ? 'text-green-700 bg-green-50 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30'
                : severity === 'Mild'
                ? 'text-yellow-600 bg-yellow-50 border-yellow-250 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30 font-semibold'
                : severity === 'Moderate'
                ? 'text-orange-700 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30'
                : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
              
              const warningIcon = result.requiresManualReview && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 dark:bg-amber-955/15 dark:text-amber-450 dark:border-amber-900/25 mt-1.5" title="Verification quality warning">
                  <AlertCircle className="h-3 w-3" />
                  Review Recommended
                </span>
              );

              return (
                <div key={idx} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3 hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <span className="block font-bold text-slate-900 dark:text-white text-base truncate">{result.biomarker.name}</span>
                      {warningIcon}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${indicator.color}`}>
                      <span>{indicator.symbol}</span>
                      <span>{indicator.text}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-50 dark:border-slate-800/50 py-2.5">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Value</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-205">
                        {result.biomarker.normalizedValue} {result.biomarker.normalizedUnit}
                      </span>
                      {result.biomarker.validationWarning && (
                        <span className="block text-[9px] text-amber-600 italic mt-0.5 leading-tight">{result.biomarker.validationWarning}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Ref. Range</span>
                      <span className="font-mono text-slate-700 dark:text-slate-350">{result.interpretedRange || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Severity</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${severityBadgeColor}`}>
                      {severity}
                    </span>
                  </div>

                  {result.patientExplanation && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium pt-2 border-t border-slate-50 dark:border-slate-800/30">
                      {result.patientExplanation}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                No biomarkers found matching "{searchQuery}" under {selectedCategory} category.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendationsTab = () => {
    const filteredRecs = (analysis?.recommendations || []).filter((rec: any) => {
      const content = rec.content.toLowerCase();
      const category = rec.category.toLowerCase();
      const findBio = (name: string) => validatedBiomarkers.find(b => b.biomarker.name === name);
      const isPresent = (name: string) => findBio(name) !== undefined;

      const matchesAnyPresentBio = validatedBiomarkers.some(b => {
        const nameLower = b.biomarker.name.toLowerCase();
        return content.includes(nameLower) || (rec.category && rec.category.toLowerCase().includes(nameLower));
      });
      if (matchesAnyPresentBio) return true;

      const hasSugar = isPresent('Glucose') || isPresent('HbA1c');
      const hasLipid = isPresent('LDL') || isPresent('HDL') || isPresent('Triglycerides') || isPresent('Total Cholesterol');
      const hasKidney = isPresent('Creatinine') || isPresent('eGFR');
      const hasLiver = isPresent('ALT') || isPresent('AST') || isPresent('ALP');
      const hasHematology = isPresent('Hemoglobin') || isPresent('RBC') || isPresent('WBC') || isPresent('Platelets');
      const hasVitaminD = isPresent('Vitamin D');
      const hasVitaminB12 = isPresent('Vitamin B12');

      const mentionsSugar = content.includes('sugar') || content.includes('glucose') || content.includes('hba1c') || content.includes('glycemic') || category.includes('diabetes');
      const mentionsLipid = content.includes('cholesterol') || content.includes('ldl') || content.includes('lipid') || content.includes('triglycerides') || category.includes('cardio') || (content.includes('cardiovascular') && !content.includes('cardiovascular exercise') && !content.includes('cardiovascular activity') && !content.includes('cardiovascular fitness') && !content.includes('cardiovascular health') && !content.includes('cardiovascular training'));
      const mentionsKidney = content.includes('creatinine') || content.includes('egfr') || content.includes('kidney') || content.includes('renal');
      const mentionsLiver = content.includes('liver') || content.includes('alt') || content.includes('ast') || content.includes('alp') || content.includes('enzyme');
      const mentionsHematology = content.includes('hemoglobin') || content.includes('anemia') || content.includes('iron') || content.includes('rbc') || content.includes('cbc') || content.includes('platelet') || content.includes('wbc') || content.includes('hematologic');
      const mentionsVitaminD = content.includes('vitamin d') || content.includes('vit d') || content.includes('hydroxyvitamin');
      const mentionsVitaminB12 = content.includes('b12') || content.includes('cobalamin') || content.includes('vitamin b12');

      if (content.includes('did not evaluate') || content.includes('not tested') || content.includes('not evaluate') || content.includes('screening')) {
        return true;
      }

      const isGeneral = category.includes('general') || category.includes('follow-up') || content.includes('annual') || content.includes('routine') || content.includes('wellness') || content.includes('examination') || content.includes('physician') || content.includes('doctor');

      const mentionedDomains: string[] = [];
      if (mentionsSugar) mentionedDomains.push('sugar');
      if (mentionsLipid) mentionedDomains.push('lipid');
      if (mentionsKidney) mentionedDomains.push('kidney');
      if (mentionsLiver) mentionedDomains.push('liver');
      if (mentionsHematology) mentionedDomains.push('hematology');
      if (mentionsVitaminD) mentionedDomains.push('vitamind');
      if (mentionsVitaminB12) mentionedDomains.push('vitaminb12');

      if (mentionedDomains.length === 0) {
        return true;
      }

      const presentDomains: string[] = [];
      if (hasSugar) presentDomains.push('sugar');
      if (hasLipid) presentDomains.push('lipid');
      if (hasKidney) presentDomains.push('kidney');
      if (hasLiver) presentDomains.push('liver');
      if (hasHematology) presentDomains.push('hematology');
      if (hasVitaminD) presentDomains.push('vitamind');
      if (hasVitaminB12) presentDomains.push('vitaminb12');

      const hasMatchingPresentDomain = mentionedDomains.some(d => presentDomains.includes(d));

      if (isGeneral) {
        if (mentionsSugar && !hasSugar) return false;
        if (mentionsLipid && !hasLipid) return false;
        if (mentionsKidney && !hasKidney) return false;
        if (mentionsLiver && !hasLiver) return false;
        return true;
      }

      return hasMatchingPresentDomain;
    });

    const finalRecs = [...filteredRecs];

    validatedBiomarkers.forEach(b => {
      if (b.interpretedSeverity !== 'Normal') {
        const name = b.biomarker.name;
        const hasRec = finalRecs.some(rec => 
          rec.content.toLowerCase().includes(name.toLowerCase()) || 
          (rec.category && rec.category.toLowerCase().includes(name.toLowerCase()))
        );

        if (!hasRec) {
          let content = `Your ${name} level is abnormal (${b.biomarker.normalizedValue} ${b.biomarker.normalizedUnit}). We recommend consulting a healthcare provider to review this result.`;
          let category = "Medical Follow-up";
          let safety = "Single abnormal findings should always be evaluated within a complete clinical context.";
          
          finalRecs.push({
            id: `fallback-${name}-${Date.now()}`,
            category,
            content,
            priority: 2,
            safety_check: safety
          });
        }
      }
    });

    finalRecs.sort((a, b) => (a.priority || 3) - (b.priority || 3));

    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition hover:shadow-md">
        <div 
          className="flex justify-between items-center cursor-pointer select-none" 
          onClick={() => toggleSection('recommendations')}
        >
          <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            AI Health Recommendations
          </h3>
          {collapsedSections.recommendations ? <ChevronDown className="h-5 w-5 text-slate-450" /> : <ChevronUp className="h-5 w-5 text-slate-450" />}
        </div>

        {!collapsedSections.recommendations && (
          <div className="space-y-4 mt-4 animate-fadeIn">
            {finalRecs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                No actionable recommendations triggered by abnormal biomarkers.
              </div>
            ) : (
              finalRecs.map((rec: any) => {
                const pColor = rec.priority === 1 ? 'border-red-200 bg-red-50/50 text-red-800 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30' : 
                               (rec.priority === 2 ? 'border-amber-200 bg-amber-50/50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' : 
                               'border-slate-200 bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800');
                
                const enhanced = getEnhancedRecommendation(rec, validatedBiomarkers);
                
                return (
                  <div key={rec.id} className={`rounded-xl border p-4 space-y-3 shadow-sm ${pColor}`}>
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="uppercase tracking-wider opacity-85">{rec.category}</span>
                      <span>Priority {rec.priority}</span>
                    </div>
                    <p className="text-sm leading-relaxed font-semibold">{rec.content}</p>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[10px] border-t border-slate-100 dark:border-slate-800/80 pt-3">
                      <div>
                        <span className="font-bold block text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[8px]">Triggered By</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{enhanced.triggeredBy} {enhanced.currentValue ? `(${enhanced.currentValue})` : ''}</span>
                      </div>
                      <div>
                        <span className="font-bold block text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[8px]">Target Range</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-350">{enhanced.targetValue}</span>
                      </div>
                      <div>
                        <span className="font-bold block text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[8px]">Retest Timeline</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{enhanced.retestTimeline}</span>
                      </div>
                      <div>
                        <span className="font-bold block text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[8px]">Expected Outcome</span>
                        <span className="font-medium text-slate-650 dark:text-slate-350 leading-snug">{enhanced.expectedOutcome}</span>
                      </div>
                    </div>

                    {rec.safety_check && (
                      <div className="flex gap-1.5 items-start mt-2 border-t border-dashed border-current/25 pt-2 text-[10px] opacity-80">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span><b>Safety Check:</b> {rec.safety_check}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTechnicalDetailsTab = () => {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2 hover:shadow-md transition">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Analysis Engine Details
            </h4>
            <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1 pt-2">
              <div>Quality Rating: <b>{getAssessmentQuality(riskReport.confidenceScore)}</b></div>
              <div>Quality Confidence Score: <b>{riskReport.confidenceScore}%</b></div>
              <div>Extraction Statistics: <b>{validatedBiomarkers.length} biomarkers evaluated</b></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2 hover:shadow-md transition">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Report Ingestion Info
            </h4>
            <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1 pt-2 font-medium">
              <div className="truncate" title={report.filename}>Original Filename: <b className="font-semibold text-slate-800 dark:text-slate-200">{report.filename}</b></div>
              <div>Lab Ingest Source: <b>{labName}</b></div>
              <div className="truncate">Storage Path: <span className="font-mono text-xs opacity-80">{report.file_url}</span></div>
              <div>File Size: <b>{report.file_size ? `${(report.file_size / 1024).toFixed(1)} KB` : 'N/A'}</b></div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 hover:shadow-md transition">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => toggleSection('technicalIngestion')}
          >
            <h3 className="text-md font-bold text-slate-900 dark:text-white">Assessment Coverage & Verification</h3>
            {collapsedSections.technicalIngestion ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronUp className="h-5 w-5 text-slate-400" />}
          </div>

          {!collapsedSections.technicalIngestion && (
            <div className="space-y-4 mt-2 animate-fadeIn">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Analyzed Biomarkers: <strong className="text-slate-900 dark:text-white font-bold">{validatedBiomarkers.length}</strong>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 text-sm border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Evaluated Systems</h4>
                  <ul className="space-y-1.5">
                    {systemsCoverage.filter(s => s.evaluated).map(s => (
                      <li key={s.name} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-350">
                        <span className="text-green-600 font-bold">✓</span> {s.name}
                      </li>
                    ))}
                    {systemsCoverage.filter(s => s.evaluated).length === 0 && (
                      <li className="text-xs text-slate-400 italic">None</li>
                    )}
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hidden Systems (Insufficient Data)</h4>
                  <ul className="space-y-1.5">
                    {systemsCoverage.filter(s => !s.evaluated).map(s => (
                      <li key={s.name} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-slate-400 dark:text-slate-600">•</span> {s.name}
                      </li>
                    ))}
                    {systemsCoverage.filter(s => !s.evaluated).length === 0 && (
                      <li className="text-xs text-slate-400 italic">None</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- MAIN JSX LAYOUT ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      <header className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-bold">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="inline sm:hidden">Back</span>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-900 dark:text-white hidden md:inline truncate max-w-[200px] lg:max-w-[400px]" title={report.filename}>
              {report.filename}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/50">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    referrerPolicy="no-referrer"
                    alt={user.full_name || 'User avatar'}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase">
                    {(user.full_name || user.email).charAt(0)}
                  </div>
                )}
                <span className="hidden text-xs font-semibold text-slate-700 dark:text-slate-350 sm:inline max-w-[100px] truncate" title={user.full_name || user.email}>
                  {user.full_name || user.email}
                </span>
              </div>
            )}
            <PDFButton report={report} biomarkers={biomarkers} analysis={analysis} riskReport={riskReport} reportId={reportId} />
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-650 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 transition"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="border-b border-slate-200 dark:border-slate-800 sticky top-[73px] bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm z-10 pt-2 pb-1 overflow-hidden">
          <nav className="flex flex-nowrap gap-1 sm:gap-2 overflow-x-auto scrollbar-none pb-1" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview', icon: Activity },
              { id: 'critical', name: 'Critical Findings', icon: AlertTriangle },
              { id: 'detailed', name: 'Detailed Analysis', icon: Layers },
              { id: 'explorer', name: 'Biomarker Explorer', icon: Search },
              { id: 'recommendations', name: 'Recommendations', icon: Heart },
              { id: 'technical', name: 'Technical Details', icon: Settings }
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap py-2.5 px-4 border-b-2 font-bold text-xs sm:text-sm rounded-t-lg transition-all duration-200 ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-500 dark:text-blue-400 font-extrabold shadow-sm'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'critical' && renderCriticalFindingsTab()}
          {activeTab === 'detailed' && renderDetailedAnalysisTab()}
          {activeTab === 'explorer' && renderBiomarkerExplorerTab()}
          {activeTab === 'recommendations' && renderRecommendationsTab()}
          {activeTab === 'technical' && renderTechnicalDetailsTab()}
        </div>
      </main>
    </div>
  );
}
