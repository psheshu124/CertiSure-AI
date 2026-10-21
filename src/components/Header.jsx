import React from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function Header() {
  const { user, authSession, setAuthModalOpen, setAuthMode, metrics, setActiveScreen, activeScreen, serverHealth } = useApp();

  const getScreenBreadcrumb = () => {
    switch (activeScreen) {
      case 'overview': return 'Overview';
      case 'new-verification': return 'New Verification';
      case 'approval-gate': return 'Authorization Gate';
      case 'agent-activity': return 'Agent Trace';
      case 'verification-result': return 'Verification Result';
      case 'verification-history': return 'Verification History';
      case 'review-queue': return 'Review Queue';
      case 'test-lab': return 'Test Lab (TC1-TC4)';
      case 'settings': return 'Settings & Sources';
      default: return 'Overview';
    }
  };

  const isGeminiReady = serverHealth?.aiProvider?.configured;

  return (
    <header className="fixed top-0 left-60 right-0 h-14 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-margin border-b border-outline-variant/30">
      <div className="flex items-center gap-space-md">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-space-xs text-on-surface-variant font-metadata text-metadata">
          <span
            className="hover:text-on-surface transition-colors cursor-pointer"
            onClick={() => setActiveScreen('overview')}
          >
            Platform
          </span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface font-body-md-medium">{getScreenBreadcrumb()}</span>
        </div>

        {/* Environment Badge */}
        <span className={`inline-flex items-center gap-space-xs px-space-sm py-0.5 rounded-full font-pill-label text-pill-label font-bold ${
          authSession?.user ? 'bg-[#EAF5EE] text-[#267653]' : 'bg-secondary-container text-on-secondary-container'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${authSession?.user ? 'bg-[#267653]' : 'bg-secondary'}`}></span>
          {authSession?.user ? 'SUPABASE RLS ACTIVE' : 'GUEST / UNRESTRICTED'}
        </span>

        {/* AI & Telemetry Status Indicator */}
        <div className="hidden lg:flex items-center gap-space-xs text-on-surface-variant font-metadata text-metadata">
          <span className={`w-2 h-2 rounded-full ${isGeminiReady ? 'bg-on-tertiary-container animate-pulse' : 'bg-[#9A6700]'}`}></span>
          <span>{isGeminiReady ? `${serverHealth?.aiProvider?.model || 'Gemini 3.8 Flash'}: Active` : 'AI Engine: Standby (Fixtures Ready)'}</span>
        </div>
      </div>

      {/* Right Action Cluster */}
      <div className="flex items-center gap-space-md">
        {/* Notifications Button */}
        <button
          className="relative p-space-xs text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container"
          type="button"
          onClick={() => setActiveScreen('review-queue')}
          title="Review Queue Tasks"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          {metrics.awaitingReviewCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error"></span>
          )}
        </button>

        {/* Real User Profile or Sign In / Sign Up Buttons */}
        {authSession?.user ? (
          <div
            className="flex items-center gap-space-sm pl-space-sm cursor-pointer p-1 rounded-lg hover:bg-surface-container transition-colors"
            onClick={() => setAuthModalOpen(true)}
            title={`Signed in as ${authSession.user.email} (Click to manage account / sign out)`}
          >
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="font-body-md-medium text-body-md-medium text-on-surface leading-none truncate max-w-[150px]">
                {user.name || authSession.user.email.split('@')[0]}
              </span>
              <span className="font-metadata text-metadata text-on-surface-variant leading-tight mt-0.5 truncate max-w-[150px]">
                {authSession.user.email}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-body-md-medium text-xs shadow-sm font-bold">
              {user.name
                ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : authSession.user.email.substring(0, 2).toUpperCase()}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-space-xs">
            <button
              onClick={() => { setAuthMode('signin'); setAuthModalOpen(true); }}
              className="h-8 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-md-medium text-body-md transition-colors"
              type="button"
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setAuthModalOpen(true); }}
              className="h-8 px-space-md rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-body-md transition-colors shadow-sm"
              type="button"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
