'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Upload, Trash2, FileText, CheckCircle, AlertCircle, Loader2, LogOut, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const parseDateAsUTC = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.slice(10).includes('-')) {
    return new Date(`${dateStr}Z`);
  }
  return new Date(dateStr);
};

const getPdfUrl = (reportId: number) => {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const backendBase = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
  return `${backendBase}/uploads/summary_${reportId}.pdf`;
};

export default function DashboardPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [toast, setToast] = useState<{ message: string; reportId?: number } | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Keep currentTime ticking every second for processing timers
    const timerInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Polling fallback loop: only polls when there are active, in-progress reports in the UI state
  useEffect(() => {
    const hasActiveReports = reports.some(r => {
      const isCompleted = r.status === 'COMPLETED' || r.status === 'completed';
      const isFailed = r.status === 'FAILED' || r.status === 'failed';
      return !isCompleted && !isFailed;
    });

    if (!hasActiveReports) return;

    const interval = setInterval(async () => {
      try {
        const freshReports = await api.listReports();
        
        // Detect transitions to completed to trigger the toast notification
        freshReports.forEach((fresh: any) => {
          const old = reports.find(r => r.id === fresh.id);
          if (old) {
            const wasInProgress = old.status !== 'completed' && old.status !== 'COMPLETED' && old.status !== 'failed' && old.status !== 'FAILED';
            const isNowCompleted = fresh.status === 'completed' || fresh.status === 'COMPLETED';
            
            if (wasInProgress && isNowCompleted) {
              setToast({
                message: '✅ Report analysis completed',
                reportId: fresh.id
              });
              // Auto-hide toast after 6 seconds
              setTimeout(() => setToast(null), 6000);
            }
          }
        });

        setReports(freshReports);
      } catch (err) {
        console.error('Failed to poll reports status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [reports]);

  useEffect(() => {
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

    loadReports();

    // Set up WebSocket connection for real-time progress updates
    const token = localStorage.getItem('token');
    const wsUrl = `ws://localhost:8000/api/reports/ws?token=${token}`;
    
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'report_progress') {
            const updatedReport = message.report;
            setReports((prevReports) => {
              const index = prevReports.findIndex((r) => r.id === updatedReport.id);
              if (index !== -1) {
                const oldReport = prevReports[index];
                const wasInProgress = oldReport.status !== 'completed' && oldReport.status !== 'COMPLETED' && oldReport.status !== 'failed' && oldReport.status !== 'FAILED';
                const isNowCompleted = updatedReport.status === 'completed' || updatedReport.status === 'COMPLETED';
                
                if (wasInProgress && isNowCompleted) {
                  setToast({
                    message: '✅ Report analysis completed',
                    reportId: updatedReport.id
                  });
                  setTimeout(() => setToast(null), 6000);
                  setTimeout(() => {
                    loadReports();
                  }, 0);
                }
                
                const newReports = [...prevReports];
                newReports[index] = {
                  ...newReports[index],
                  ...updatedReport,
                };
                return newReports;
              } else {
                return [updatedReport, ...prevReports];
              }
            });
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket disconnected. Attempting to reconnect...');
        reconnectTimeout = setTimeout(connectWebSocket, 2000);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket?.close();
      };
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await api.listReports();
      setReports(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await api.deleteReport(id);
      // Immediately invalidate state and refetch from DB
      await loadReports();
    } catch (err: any) {
      alert(err.message || 'Failed to delete report.');
    }
  };

  const handleRetry = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await api.retryReport(id);
      // Immediately reload lists to capture updated state
      await loadReports();
    } catch (err: any) {
      alert(err.message || 'Failed to retry report analysis.');
    }
  };

  const handleLogout = () => {
    api.logout();
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Navbar */}
      <nav className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center">
              <img src="/logo.svg?v=2" alt="Blood Report Analyzer AI" className="h-6 sm:h-8 w-auto dark:hidden" />
              <img src="/logo-dark.svg?v=2" alt="Blood Report Analyzer AI" className="h-6 sm:h-8 w-auto hidden dark:block" />
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              {user && (
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg sm:border sm:border-slate-200 sm:bg-slate-50/50 sm:px-3 sm:py-1.5 sm:dark:border-slate-800 sm:dark:bg-slate-900/50">
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
              <Link
                href="/reports/upload"
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 sm:px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload Report</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-slate-650 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Your Blood Reports</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Upload and keep track of your lab results and AI generated health insights.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <FileText className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No reports uploaded</h3>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Get started by uploading your first PDF lab report.
            </p>
            <div className="mt-6">
              <Link
                href="/reports/upload"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 shadow"
              >
                <Upload className="h-4 w-4" />
                Upload First Report
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => {
              const isCompleted = report.status === 'COMPLETED' || report.status === 'completed';
              const isFailed = report.status === 'FAILED' || report.status === 'failed';
              const isInProgress = !isCompleted && !isFailed;

              // Stage text mapping
              let stageLabel = 'Processing...';
              if (isInProgress) {
                switch (report.status?.toLowerCase()) {
                  case 'uploading':
                    stageLabel = 'Uploading Report';
                    break;
                  case 'extracting':
                    stageLabel = 'Extracting Biomarkers';
                    break;
                  case 'validating':
                    stageLabel = 'Clinical Validation';
                    break;
                  case 'analyzing':
                    stageLabel = 'AI Analysis';
                    break;
                  case 'generating':
                    stageLabel = 'Generating Insights';
                    break;
                  case 'finalizing':
                    stageLabel = 'Finalizing Report';
                    break;
                }
              }

              // Visual ASCII progress bar
              const barWidth = Math.round((report.progress_percentage || 0) / 10);
              const filledBar = '█'.repeat(barWidth);
              const emptyBar = '░'.repeat(10 - barWidth);

              // Live timers
              let estimatedRemainingText = '';
              if (isInProgress && report.estimated_completion_time) {
                const estDate = parseDateAsUTC(report.estimated_completion_time);
                if (estDate) {
                  const remainingSec = Math.max(1, Math.round((estDate.getTime() - currentTime) / 1000));
                  const remainingMin = Math.ceil(remainingSec / 60);
                  estimatedRemainingText = `~${remainingMin} min${remainingMin > 1 ? 's' : ''} remaining`;
                }
              }

              let durationText = '';
              if (isInProgress && report.processing_started_at) {
                const startedDate = parseDateAsUTC(report.processing_started_at);
                if (startedDate) {
                  const elapsedSec = Math.round((currentTime - startedDate.getTime()) / 1000);
                  durationText = `Processing Time: ${Math.max(0, elapsedSec)} seconds`;
                }
              } else if (isCompleted && report.processing_duration) {
                durationText = `Completed in: ${report.processing_duration} seconds`;
              } else if (isFailed && report.processing_duration) {
                durationText = `Failed after: ${report.processing_duration} seconds`;
              }

              return (
                <div
                  key={report.id}
                  className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 hover:shadow-md transition-all duration-300"
                >
                  <div>
                    <div className="flex items-start justify-between min-w-0 gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50 shrink-0">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-900 dark:text-white truncate" title={report.filename}>
                            {report.filename}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {parseDateAsUTC(report.created_at)?.toLocaleDateString()}
                            {report.file_size ? ` • ${(report.file_size / 1024).toFixed(1)} KB` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(report.id, e)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete Report"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Progress representation or completion/failure state */}
                    {isInProgress && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                            {stageLabel}
                          </span>
                          <span className="text-blue-600 dark:text-blue-400">{report.progress_percentage || 0}%</span>
                        </div>
                        
                        {/* Premium custom animated progress bar */}
                        <div className="relative w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                            style={{ width: `${report.progress_percentage || 0}%` }}
                          />
                        </div>
                        
                        {/* Progress Bar (Unicode & ETA block) */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono tracking-tight leading-none mt-1 gap-2">
                          <span className="hidden sm:inline-block">{filledBar}{emptyBar}</span>
                          {estimatedRemainingText && <span>{estimatedRemainingText}</span>}
                        </div>

                        {durationText && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                            {durationText}
                          </p>
                        )}
                      </div>
                    )}

                    {isCompleted && (
                      <div className="mt-4 space-y-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-950/30 dark:text-green-400">
                          <CheckCircle className="h-3 w-3" />
                          Analysis Ready
                        </span>
                        {durationText && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 pl-1 mt-1">
                            {durationText}
                          </p>
                        )}
                      </div>
                    )}

                    {isFailed && (
                      <div className="mt-4 space-y-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-950/30 dark:text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          Analysis Failed
                        </span>
                        {report.error_message && (
                          <div className="text-xs rounded-lg bg-red-50/50 p-2.5 border border-red-100 dark:bg-red-950/20 dark:border-red-950/30 text-red-700 dark:text-red-400">
                            <span className="font-semibold block mb-0.5">Reason:</span>
                            <span className="line-clamp-3 leading-relaxed">{report.error_message}</span>
                          </div>
                        )}
                        {durationText && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 pl-1">
                            {durationText}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-row flex-wrap items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800 gap-2 sm:gap-4">
                    {isCompleted ? (
                      <>
                        <Link
                          href={`/reports/${report.id}`}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors"
                        >
                          View Insights &rarr;
                        </Link>
                        
                        <a
                          href={getPdfUrl(report.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-slate-500 hover:underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-all"
                        >
                          Download PDF
                        </a>
                      </>
                    ) : isFailed ? (
                      <>
                        <button
                          onClick={(e) => handleRetry(report.id, e)}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors"
                        >
                          Retry Analysis
                        </button>
                        <button
                          onClick={(e) => handleDelete(report.id, e)}
                          className="text-xs text-red-600 hover:underline dark:text-red-400 transition-colors font-medium"
                        >
                          Delete Report
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-600 italic">
                        Wait for insights
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900 transition-all duration-300 animate-slide-in">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              {toast.message}
            </span>
            {toast.reportId && (
              <Link
                href={`/reports/${toast.reportId}`}
                className="text-xs font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                View Insights
              </Link>
            )}
          </div>
          <button
            onClick={() => setToast(null)}
            className="ml-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
