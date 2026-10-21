import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { isSupabaseConfigured } from '../lib/supabase.js';

export default function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    authMode,
    setAuthMode,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    user,
    authSession,
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      if (authMode === 'signup') {
        const res = await handleSignUp(email, password, fullName);
        if (res?.confirmationRequired) {
          setSuccessMsg(res.message);
        } else {
          setSuccessMsg('Account registered and session initialized.');
          setTimeout(() => setAuthModalOpen(false), 1200);
        }
      } else {
        await handleSignIn(email, password);
        setSuccessMsg('Signed in successfully.');
        setTimeout(() => setAuthModalOpen(false), 1200);
      }
    } catch (err) {
      console.error('[Auth Error]', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#001d37]/40 backdrop-blur-xs p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant max-w-md w-full p-space-xl relative overflow-hidden">

        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Header */}
        <div className="flex flex-col gap-1 mb-space-lg">
          <div className="flex items-center gap-space-sm mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">security</span>
            </div>
            <span className="font-metadata text-metadata uppercase tracking-wider text-secondary font-semibold">
              Enterprise Access Gateway
            </span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
            {authSession?.user
              ? 'Active Recruiter Session'
              : authMode === 'signup'
                ? 'Create Recruiter Account'
                : 'Sign In to CertiSure AI'}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant text-[13px]">
            {authSession?.user
              ? 'Your private certificate verification records and audit history are secured with Supabase RLS.'
              : isSupabaseConfigured
                ? 'Authentication is powered by Supabase with Row Level Security.'
                : 'Interactive Sandbox Session.'}
          </p>
        </div>

        {/* Current Active Account Profile Strip (Only if currently signed in) */}
        {authSession?.user && (
          <div className="bg-surface-container-low p-space-md rounded-lg mb-space-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase text-[11px]">Authenticated Account:</span>
              <span className="px-2 py-0.5 rounded-full font-pill-label text-pill-label bg-[#EAF5EE] text-[#267653] font-bold">
                RLS CONNECTED
              </span>
            </div>
            <span className="font-body-md-medium text-body-md text-on-surface font-semibold truncate">{authSession.user.email}</span>
            <span className="font-metadata text-metadata text-secondary truncate text-[11px]">User UUID: {authSession.user.id}</span>
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await handleSignOut();
                  setSuccessMsg('Signed out successfully.');
                  setTimeout(() => setSuccessMsg(''), 2500);
                }}
                className="px-space-md py-1.5 rounded-lg bg-error-container text-on-error-container hover:opacity-90 text-metadata font-body-md-medium transition-colors font-bold"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Notifications / Errors */}
        {errorMsg && (
          <div className="p-space-sm mb-space-md rounded-lg bg-[#FCEEEE] text-[#B54747] text-body-md text-[13px] flex items-center gap-2 border border-[#F4C7C7]">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-space-sm mb-space-md rounded-lg bg-[#EAF5EE] text-[#267653] text-body-md text-[13px] flex items-center gap-2 border border-[#BFE0CD]">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form (Only shown when NOT currently signed in) */}
        {!authSession?.user ? (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
              {authMode === 'signup' && (
                <div className="flex flex-col gap-1">
                  <label className="font-form-label text-form-label text-on-surface">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Eleanor Vance"
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="font-form-label text-form-label text-on-surface">Corporate Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="recruiter@enterprise.com"
                  required
                  className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-form-label text-form-label text-on-surface">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 mt-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-body-md flex items-center justify-center gap-space-xs transition-all shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      {authMode === 'signup' ? 'person_add' : 'login'}
                    </span>
                    <span>{authMode === 'signup' ? 'Create Account' : 'Authenticate Session'}</span>
                  </>
                )}
              </button>
            </form>

            {/* Switch Mode Toggle */}
            <div className="mt-space-lg text-center pt-space-sm border-t border-outline-variant/30 flex items-center justify-between text-metadata font-metadata text-on-surface-variant">
              <span>
                {authMode === 'signup' ? 'Already registered?' : 'Need a new account?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-secondary hover:text-primary font-semibold underline underline-offset-2"
              >
                {authMode === 'signup' ? 'Switch to Sign In' : 'Create an Account'}
              </button>
            </div>
          </>
        ) : (
          <div className="pt-space-md border-t border-outline-variant/30 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="px-space-lg py-2 rounded-lg bg-surface-container text-on-surface font-body-md-medium text-body-md hover:bg-surface-container-high transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
