import React from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function Sidebar() {
  const { activeScreen, setActiveScreen, metrics } = useApp();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'new-verification', label: 'New Verification', icon: 'verified' },
    { id: 'verification-history', label: 'Verification History', icon: 'history' },
    { id: 'review-queue', label: 'Review Queue', icon: 'fact_check', badge: metrics.awaitingReviewCount },
    { id: 'test-lab', label: 'Test Lab', icon: 'science' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-surface-container-low z-50 flex flex-col justify-between py-space-lg border-r border-outline-variant/30">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="px-space-lg mb-space-xl flex items-start gap-space-sm cursor-pointer" onClick={() => setActiveScreen('overview')}>
          <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[20px] text-[#a1f1ea]">shield</span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">CertiSure AI</span>
            <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Enterprise Verification</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col px-space-sm gap-space-xs">
          {navItems.map((item) => {
            const isActive = activeScreen === item.id ||
              (item.id === 'new-verification' && (activeScreen === 'approval-gate' || activeScreen === 'agent-activity' || activeScreen === 'verification-result'));

            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                className={`flex items-center justify-between px-space-md py-space-sm rounded-lg transition-all text-left w-full ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-body-md-medium shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-space-sm">
                  <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-[#a1f1ea]' : ''}`}>
                    {item.icon}
                  </span>
                  <span className="font-body-md text-body-md">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-space-xs py-0.5 rounded-full font-pill-label text-pill-label ${
                    isActive ? 'bg-[#55a5a0] text-primary' : 'bg-secondary-container text-on-secondary-container'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="px-space-lg flex flex-col gap-space-xs text-on-surface-variant border-t border-outline-variant/20 pt-space-md">
        <div className="flex items-center gap-space-xs font-metadata text-metadata">
          <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse"></span>
          <span>v2.4.1-engine</span>
        </div>
        <div className="font-metadata text-metadata text-outline text-[11px] flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px] text-secondary">verified_user</span>
          <span>SOC2 Type II Standard</span>
        </div>
      </div>
    </aside>
  );
}
