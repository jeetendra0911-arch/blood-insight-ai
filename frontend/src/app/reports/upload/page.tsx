'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Upload, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Only PDF files are supported.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setError('');
    setLoading(true);

    try {
      await api.uploadReport(file);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'File upload failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-semibold">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <ThemeToggle />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Upload Lab Report</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Select a PDF blood analysis report. Our clinical AI will extract the data and analyze it.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleUpload} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-700 transition-colors">
              <Upload className="h-10 w-10 text-slate-400" />
              <div className="mt-4 text-center">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:bg-slate-900 dark:text-blue-400"
                >
                  <span>Select PDF file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    accept=".pdf"
                    className="sr-only"
                    required
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1 text-slate-500 dark:text-slate-400 text-xs mt-1">PDF up to 10MB</p>
              </div>
            </div>

            {file && (
              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">{file.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !file}
                className="flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading & Processing...
                  </span>
                ) : (
                  'Analyze Report'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
