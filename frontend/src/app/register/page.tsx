'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('MALE');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Google OAuth States
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [confirmLinkMessage, setConfirmLinkMessage] = useState('');
  const [googleScriptFailed, setGoogleScriptFailed] = useState(false);

  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.register({
        email,
        password,
        full_name: fullName || null,
        dob: dob ? new Date(dob).toISOString() : null,
        gender,
        role: 'PATIENT',
      });
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialResponse = async (response: any) => {
    const idToken = response.credential;
    try {
      setLoading(true);
      setError('');
      
      const res = await api.googleAuth(idToken, false);
      if (res && res.status === 'link_required') {
        setPendingToken(idToken);
        setConfirmLinkMessage(res.message);
        setShowLinkDialog(true);
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err.message || 'Google Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!pendingToken) return;
    try {
      setLoading(true);
      setError('');
      setShowLinkDialog(false);
      await api.googleAuth(pendingToken, true);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Linking account failed.');
    } finally {
      setLoading(false);
      setPendingToken(null);
    }
  };

  useEffect(() => {
    let checkInterval: any = null;
    let timeout: any = null;

    const initGoogle = () => {
      if (typeof window !== 'undefined' && (window as any).google) {
        try {
          const container = document.getElementById('google-signup-btn');
          const width = container ? Math.max(200, Math.min(400, container.clientWidth)) : 320;

          (window as any).google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com',
            callback: handleCredentialResponse,
          });
          (window as any).google.accounts.id.renderButton(
            container || document.getElementById('google-signup-btn'),
            { theme: 'outline', size: 'large', width: String(width), logo_alignment: 'center' }
          );
        } catch (err) {
          console.error('Failed to initialize Google Auth:', err);
        }
      }
    };

    if (typeof window !== 'undefined') {
      if ((window as any).google) {
        initGoogle();
      } else {
        checkInterval = setInterval(() => {
          if ((window as any).google) {
            initGoogle();
            clearInterval(checkInterval);
            clearTimeout(timeout);
          }
        }, 200);

        timeout = setTimeout(() => {
          if (!(window as any).google) {
            setGoogleScriptFailed(true);
            if (checkInterval) clearInterval(checkInterval);
          }
        }, 6000);
      }
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col items-center">
          <img src="/logo.svg?v=2" alt="Blood Report Analyzer AI Logo" className="h-10 w-auto mb-2 dark:hidden" />
          <img src="/logo-dark.svg?v=2" alt="Blood Report Analyzer AI Logo" className="h-10 w-auto mb-2 hidden dark:block" />
          <h2 className="mt-4 text-center text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Create an Account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
              Sign in
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-4" onSubmit={handleRegister}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
              Registration successful! Redirecting to login...
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:text-sm"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email Address *
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:text-sm"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dob" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Date of Birth
                </label>
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:text-sm"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:text-sm"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || success}
              className="flex w-full justify-center rounded-md border border-transparent bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </div>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-850"></div>
          <span className="flex-shrink mx-4 text-slate-450 dark:text-slate-500 text-xs font-semibold uppercase">Or continue with</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-850"></div>
        </div>

        <div className="flex justify-center w-full">
          {googleScriptFailed ? (
            <div className="text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 w-full leading-normal">
              ⚠️ Google Sign-In could not load. Please check your internet connection or disable ad-blockers (like Brave Shields).
            </div>
          ) : (
            <div id="google-signup-btn" className="w-full flex justify-center min-h-[44px]"></div>
          )}
        </div>
      </div>

      {/* Account Linking Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-scaleUp">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              ⚠️ Link Account
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              {confirmLinkMessage}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowLinkDialog(false);
                  setPendingToken(null);
                }}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLink}
                className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm font-bold"
              >
                Yes, Link Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
