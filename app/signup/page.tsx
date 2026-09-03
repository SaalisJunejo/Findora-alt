'use client';

// DEMO MODE: OTP is mocked and shown on-screen instead of sent via email, for hackathon demo reliability. Real email OTP flow can be restored by swapping this for supabase.auth.signInWithOtp().

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/db/supabase';
import { Header } from '@/components/Header';

export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [userOtp, setUserOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Step 1: Generate Mock OTP on-screen
  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    // DEMO MODE: Generate 6-digit random code locally
    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(mockCode);

    setMessage(`Demo mode — your verification code is: ${mockCode}`);
    setStep(2);
    setLoading(false);
  };

  // Step 2: Verify Mock OTP entry
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!userOtp || userOtp.trim() !== generatedOtp) {
      setError('Invalid verification code. Please enter the exact code shown above.');
      return;
    }

    setMessage('Email verified! Now set a password for your account.');
    setStep(3);
  };

  // Step 3: Create Account via /api/create-demo-account (bypassing client-side rate limits)
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Call server-side admin API route to create account immediately without rate limits
      const res = await fetch('/api/create-demo-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to create demo account.');
      }

      // Log in client-side to set session
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">Create your Account</h1>
            <p className="text-sm text-slate-400 mt-2">
              {step === 1 && 'Step 1 of 3: Enter your email address'}
              {step === 2 && 'Step 2 of 3: Verify on-screen OTP'}
              {step === 3 && 'Step 3 of 3: Set your account password'}
            </p>
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center justify-between mb-8 px-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>1</div>
            <div className={`flex-1 h-0.5 mx-2 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-800'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>2</div>
            <div className={`flex-1 h-0.5 mx-2 ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-800'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>3</div>
          </div>

          {/* On-Screen Mock OTP Notification */}
          {generatedOtp && step === 2 && (
            <div className="mb-6 p-4 rounded-xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-100 text-xs shadow-lg text-center">
              <div className="text-indigo-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Demo Mode Verification Code</div>
              <div className="text-2xl font-mono font-extrabold tracking-widest text-white my-1">{generatedOtp}</div>
              <div className="text-[11px] text-indigo-300/80">Copy or type this 6-digit code into the box below.</div>
            </div>
          )}

          {/* Error & Message Notifications */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs leading-relaxed">
              {error}
            </div>
          )}

          {message && !generatedOtp && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs leading-relaxed">
              {message}
            </div>
          )}

          {/* STEP 1: Enter Email */}
          {step === 1 && (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Verification Code
              </button>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit Mock OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Enter 6-Digit Verification Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={userOtp}
                  onChange={(e) => setUserOtp(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-700"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30"
              >
                Verify Code
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                ← Change Email
              </button>
            </form>
          )}

          {/* STEP 3: Set Password & Complete Signup */}
          {step === 3 && (
            <form onSubmit={handleSetPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Set Account Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Complete Signup'}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
