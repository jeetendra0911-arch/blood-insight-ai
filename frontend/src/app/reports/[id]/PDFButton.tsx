'use client';

import { Download } from 'lucide-react';
import { BloodReportPDF } from '@/lib/pdf-generator';
import { PDFDownloadLink } from '@react-pdf/renderer';

interface PDFButtonProps {
  report: any;
  biomarkers: any[];
  analysis: any;
  riskReport: any;
  reportId: number;
}

export default function PDFButton({ report, biomarkers, analysis, riskReport, reportId }: PDFButtonProps) {
  return (
    <PDFDownloadLink
      document={<BloodReportPDF data={{ report, biomarkers, analysis, riskReport }} />}
      fileName={`HealthReport_${reportId}.pdf`}
      className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 sm:px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
    >
      {({ loading: pdfLoading }) => (
        <>
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{pdfLoading ? 'Building PDF...' : 'Download Report'}</span>
          <span className="inline sm:hidden">{pdfLoading ? '...' : 'PDF'}</span>
        </>
      )}
    </PDFDownloadLink>
  );
}
