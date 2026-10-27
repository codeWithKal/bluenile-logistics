import React, { useState } from 'react';
import { Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();

  // Sign In form fields
  const [signInIdentifier, setSignInIdentifier] = useState('operator');
  const [signInPassword, setSignInPassword] = useState('sandtrack123');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Error and loading states
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCredsRef, setShowCredsRef] = useState(true);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signInIdentifier.trim() || !signInPassword) {
      setError('Please provide both username/email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(signInIdentifier.trim(), signInPassword);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPresetCredentials = (u: string, p: string) => {
    setSignInIdentifier(u);
    setSignInPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Brand Lockup */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-amber-500 text-slate-950 font-bold text-2xl shadow-lg ring-4 ring-amber-500/20">
            A
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Alex Logistics
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Sand &amp; Aggregate Transport: Hired Trucks from Crusher Sites to Construction Projects
          </p>
        </div>

        {/* Main Auth Card */}
        <div className="bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-2xl p-6 sm:p-8 space-y-5">
          {/* Header indicator */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Portal Sign In</h2>
                <p className="text-[11px] text-slate-400">
                  Enter authorized account credentials to access SandTrack
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/70 px-2 py-0.5 rounded">
              <ShieldCheck className="w-3 h-3" />
              Secure
            </span>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3 bg-red-950/70 border border-red-800 rounded-lg text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          <form onSubmit={handleSignIn} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Username or Registered Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={signInIdentifier}
                  onChange={(e) => setSignInIdentifier(e.target.value)}
                  placeholder="e.g. operator or user@sandtrack.local"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white font-mono focus:border-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type={showSignInPassword ? 'text' : 'password'}
                  required
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full pl-9 pr-10 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white font-mono focus:border-amber-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowSignInPassword(!showSignInPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Admin Managed Accounts Notice */}
          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-700/60 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-snug">
              User registration is strictly managed by administrators. If you require access credentials or need your password reset, please contact the system administrator.
            </p>
          </div>

          {/* Reference Credentials Sheet for Testing */}
          <div className="pt-4 border-t border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Default System Credentials:
              </span>
              <button
                type="button"
                onClick={() => setShowCredsRef(!showCredsRef)}
                className="text-[11px] text-amber-400 hover:underline cursor-pointer"
              >
                {showCredsRef ? 'Hide Reference' : 'Show Reference'}
              </button>
            </div>

            {showCredsRef && (
              <div className="space-y-1.5 text-left text-xs">
                {/* Operator */}
                <div className="p-2 rounded bg-slate-900/70 border border-slate-700/70 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Role A: Data Entry Operator (Elena Vance)</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      User: <strong className="text-slate-200">operator</strong> • Pass: <span className="text-slate-300">sandtrack123</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetCredentials('operator', 'sandtrack123')}
                    className="px-2 py-1 text-[10px] font-mono font-semibold rounded bg-slate-800 text-emerald-400 hover:bg-emerald-950 border border-slate-700 hover:border-emerald-700 cursor-pointer transition-colors"
                  >
                    Use Credentials
                  </button>
                </div>

                {/* Viewer */}
                <div className="p-2 rounded bg-slate-900/70 border border-slate-700/70 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Role B: Viewer / Report Generator (Marcus Brody)</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      User: <strong className="text-slate-200">viewer</strong> • Pass: <span className="text-slate-300">sandtrack123</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetCredentials('viewer', 'sandtrack123')}
                    className="px-2 py-1 text-[10px] font-mono font-semibold rounded bg-slate-800 text-blue-400 hover:bg-blue-950 border border-slate-700 hover:border-blue-700 cursor-pointer transition-colors"
                  >
                    Use Credentials
                  </button>
                </div>

                {/* Admin */}
                <div className="p-2 rounded bg-slate-900/70 border border-slate-700/70 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>System Administrator</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      User: <strong className="text-slate-200">admin</strong> • Pass: <span className="text-slate-300">sandtrack123</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetCredentials('admin', 'sandtrack123')}
                    className="px-2 py-1 text-[10px] font-mono font-semibold rounded bg-slate-800 text-purple-400 hover:bg-purple-950 border border-slate-700 hover:border-purple-700 cursor-pointer transition-colors"
                  >
                    Use Credentials
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Business Clarification Footer Note */}
        <div className="text-center text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="font-semibold text-slate-300">Crusher Sites:</span>
            <span>Where Sand Loading Takes Place</span>
            <span className="text-slate-600">•</span>
            <span className="font-semibold text-slate-300">Construction Sites:</span>
            <span>Where Sand Delivery &amp; Unloading Takes Place</span>
          </div>
          <div className="text-slate-500 text-[10px]">
            Alex Logistics • Unified Fleet &amp; Delivery Management
          </div>
        </div>
      </div>
    </div>
  );
};
