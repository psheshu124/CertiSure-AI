import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { isSupabaseConfigured } from '../lib/supabase.js';

export default function SettingsScreen() {
  const {
    user,
    authSession,
    handleSignOut,
    setAuthModalOpen,
    serverHealth,
    refreshServerHealth,
    metrics,
    certificates,
    verificationHistory,
    dbLoading,
    dbError,
    loadSupabaseData
  } = useApp();

  // Settings State
  const [operatingMode, setOperatingMode] = useState('demo'); // 'production' | 'demo' | 'offline'
  const [ocrConfidenceThreshold, setOcrConfidenceThreshold] = useState(85);
  const [aiModel, setAiModel] = useState('gemini-3.8-flash');
  const [supportedModels, setSupportedModels] = useState([
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-3.8-flash'
  ]);
  const [adapterSettings, setAdapterSettings] = useState({});
  const [lastSaved, setLastSaved] = useState(null);
  const [savedBy, setSavedBy] = useState('');

  // UI & Network State
  const [adapters, setAdapters] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthMessage, setHealthMessage] = useState(null);

  // Load Enterprise Settings & Adapters on Mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoadingSettings(true);
        const [settingsRes, adaptersRes] = await Promise.all([
          fetch('/api/settings').then(r => r.json()).catch(() => null),
          fetch('/api/adapters').then(r => r.json()).catch(() => null)
        ]);

        if (isMounted) {
          if (settingsRes?.success && settingsRes.settings) {
            const s = settingsRes.settings;
            setOperatingMode(s.operatingMode || 'demo');
            setOcrConfidenceThreshold(s.ocrConfidenceThreshold || 85);
            if (s.aiProvider?.model) setAiModel(s.aiProvider.model);
            if (s.aiProvider?.supportedModels) setSupportedModels(s.aiProvider.supportedModels);
            if (s.adapterSettings) setAdapterSettings(s.adapterSettings);
            if (s.lastSaved) setLastSaved(s.lastSaved);
            if (s.savedBy) setSavedBy(s.savedBy);
          }

          if (adaptersRes?.success && Array.isArray(adaptersRes.adapters)) {
            setAdapters(adaptersRes.adapters);
          }
        }
      } catch (err) {
        console.warn('[SettingsScreen] Error loading initial configuration:', err);
      } finally {
        if (isMounted) setLoadingSettings(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save Configuration to Server (Protected)
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      if (!authSession?.user) {
        setSaveError('Authentication required. Only authenticated enterprise recruiters can modify configuration settings. Please sign in to save changes.');
        setSaving(false);
        return;
      }

      const payload = {
        operatingMode,
        ocrConfidenceThreshold,
        aiProvider: {
          model: aiModel
        },
        adapterSettings,
        savedBy: user.email || 'Authorized Recruiter'
      };

      const headers = { 'Content-Type': 'application/json' };
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`;
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to save configuration');
      }

      setLastSaved(data.settings.lastSaved);
      setSavedBy(data.settings.savedBy);
      setSaveNotice(data.persistenceNotice || 'Configuration saved successfully.');
      setSaveSuccess(true);
      if (refreshServerHealth) await refreshServerHealth();

      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error('[SettingsScreen] Save error:', err);
      setSaveError(err.message || 'Server error while saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Run On-Demand Live Connectivity Check for Adapters
  const handleRunHealthCheck = async () => {
    try {
      setCheckingHealth(true);
      setHealthMessage(null);

      const res = await fetch('/api/adapters/check-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.adapters)) {
        setAdapters(data.adapters);
        setHealthMessage(`Health check completed across ${data.adapters.length} documented endpoints.`);
      }
    } catch (err) {
      console.error('[SettingsScreen] Health check failed:', err);
      setHealthMessage(`Health check error: ${err.message}`);
    } finally {
      setCheckingHealth(false);
      setTimeout(() => setHealthMessage(null), 5000);
    }
  };

  const toggleAdapter = (adapterId) => {
    setAdapterSettings(prev => ({
      ...prev,
      [adapterId]: {
        ...prev[adapterId],
        enabled: prev[adapterId]?.enabled === false ? true : false
      }
    }));
  };

  const isGeminiReady = serverHealth?.aiProvider?.configured;

  return (
    <div className="flex flex-col w-full">
      {/* Top Anchor Sub-Nav & Scope Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-xl">
        <div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-metadata text-metadata mb-1">
            <span>SECURITY DOMAIN</span>
            <span>/</span>
            <span className="text-on-surface font-body-md-medium">SYS-POL-8820-ORCHESTRATION</span>
            {lastSaved && (
              <>
                <span>/</span>
                <span className="text-secondary text-[11px]">
                  Saved: {new Date(lastSaved).toLocaleTimeString()} by {savedBy}
                </span>
              </>
            )}
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
            Settings
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5 max-w-3xl">
            Configure real verification sources, deterministic rules, operating modes, AI model selection, and audit policies.
          </p>
        </div>

        {/* Quick Telemetry Chip & Controls */}
        <div className="flex items-center gap-space-sm flex-wrap">
          <div className="bg-surface-container-high px-space-md py-space-xs rounded-full flex items-center gap-space-sm shadow-sm">
            <span className={`w-2 h-2 rounded-full ${operatingMode === 'production' ? 'bg-[#267653]' : operatingMode === 'offline' ? 'bg-[#64748B]' : 'bg-[#9A6700]'} animate-pulse`}></span>
            <span className="font-metadata text-metadata text-on-surface font-semibold uppercase tracking-wider">
              Mode: {operatingMode}
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-container text-on-primary font-body-md-medium text-body-md px-space-lg py-space-sm rounded-lg shadow-md transition-all flex items-center gap-space-xs font-bold disabled:opacity-50"
            type="button"
          >
            <span className={`material-symbols-outlined text-[18px] ${saving ? 'animate-spin' : ''}`}>
              {saving ? 'sync' : 'save'}
            </span>
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-space-md mb-space-lg rounded-xl bg-[#EAF5EE] text-[#267653] border border-[#BFE0CD] flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span className="font-semibold">{saveNotice || 'Configuration saved successfully and updated.'}</span>
          </div>
          <span className="text-[12px] opacity-80">{new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {saveError && (
        <div className="p-space-md mb-space-lg rounded-xl bg-[#FCEEEE] text-[#B54747] border border-[#F4C7C7] flex items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>Save Error: {saveError}</span>
        </div>
      )}

      {/* Internal Navigation Pill Ribbon */}
      <div className="w-full bg-surface-container-low rounded-xl p-space-xs mb-space-xl shadow-sm flex items-center gap-space-xs overflow-x-auto border border-outline-variant/30">
        <a
          href="#section-sources"
          className="px-space-md py-space-xs rounded-lg bg-surface-container-lowest font-body-md-medium text-body-md text-primary shadow-sm flex items-center gap-space-xs whitespace-nowrap font-bold"
        >
          <span className="material-symbols-outlined text-[16px] text-primary">hub</span>
          <span>1. Verification Sources</span>
          <span className="ml-1 px-1.5 py-0.2 bg-secondary-container text-on-secondary-container font-pill-label text-pill-label rounded-full">
            {adapters.length}
          </span>
        </a>
        <a
          href="#section-modes"
          className="px-space-md py-space-xs rounded-lg text-on-surface-variant hover:text-on-surface font-body-md text-body-md hover:bg-surface-container-high transition-all flex items-center gap-space-xs whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          <span>2. Operating Mode</span>
        </a>
        <a
          href="#section-agent"
          className="px-space-md py-space-xs rounded-lg text-on-surface-variant hover:text-on-surface font-body-md text-body-md hover:bg-surface-container-high transition-all flex items-center gap-space-xs whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[16px]">neurology</span>
          <span>3. AI Provider & Architecture</span>
        </a>
        <a
          href="#section-account"
          className="px-space-md py-space-xs rounded-lg text-on-surface-variant hover:text-on-surface font-body-md text-body-md hover:bg-surface-container-high transition-all flex items-center gap-space-xs whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[16px]">account_circle</span>
          <span>4. Account & Supabase</span>
        </a>
        <a
          href="#section-statistics"
          className="px-space-md py-space-xs rounded-lg text-on-surface-variant hover:text-on-surface font-body-md text-body-md hover:bg-surface-container-high transition-all flex items-center gap-space-xs whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[16px]">analytics</span>
          <span>5. Real-Time Statistics & Ledger</span>
        </a>
      </div>

      <div className="flex flex-col gap-space-xl pb-space-xl">
        {/* SECTION 1: Verification Sources (Adapter Registry) */}
        <section id="section-sources" className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-xs border-b border-surface-container-high/60">
            <div>
              <div className="flex items-center gap-space-xs">
                <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider font-semibold">
                  Registry Section 01
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                <span className="font-metadata text-metadata text-secondary font-semibold">
                  Documented Endpoints Only
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md text-primary tracking-tight font-bold">
                Verification Sources (Adapter Registry)
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
                Real institutional gateways, public credential lookup endpoints, and digital badge APIs with honest telemetry.
              </p>
            </div>

            <div className="flex items-center gap-space-sm">
              <button
                type="button"
                onClick={handleRunHealthCheck}
                disabled={checkingHealth}
                className="px-space-md py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface font-body-md-medium text-body-md flex items-center gap-1.5 transition-all shadow-sm border border-outline-variant/30 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${checkingHealth ? 'animate-spin text-secondary' : 'text-primary'}`}>
                  network_check
                </span>
                <span>{checkingHealth ? 'Testing Connections...' : 'Run Connectivity Check'}</span>
              </button>
            </div>
          </div>

          {healthMessage && (
            <div className="p-space-sm rounded-lg bg-surface-container-low text-secondary text-[13px] flex items-center gap-2 border border-secondary/20">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span>{healthMessage}</span>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg bg-surface-container-low/40 border border-outline-variant/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/80 text-on-surface-variant font-table-header text-table-header uppercase">
                  <th className="py-space-sm px-space-md tracking-wider">Source Name</th>
                  <th className="py-space-sm px-space-md tracking-wider">Source Type</th>
                  <th className="py-space-sm px-space-md tracking-wider">Documented Endpoint</th>
                  <th className="py-space-sm px-space-md tracking-wider">Live Connectivity</th>
                  <th className="py-space-sm px-space-md tracking-wider">Supported Fields</th>
                  <th className="py-space-sm px-space-md text-right tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60 font-body-md text-body-md">
                {adapters.map((adapter) => {
                  const isEnabled = adapterSettings[adapter.id]?.enabled !== false;

                  // Compute badge style
                  let badgeBg = 'bg-[#FFF5D9] text-[#9A6700]';
                  let dotBg = 'bg-[#9A6700]';
                  if (adapter.status === 'ACTIVE') {
                    badgeBg = 'bg-[#EAF5EE] text-[#267653]';
                    dotBg = 'bg-[#267653]';
                  } else if (adapter.status === 'PUBLIC_VERIFICATION_AVAILABLE') {
                    badgeBg = 'bg-[#E8F0FE] text-[#1A73E8]';
                    dotBg = 'bg-[#1A73E8]';
                  } else if (adapter.status === 'UNAVAILABLE') {
                    badgeBg = 'bg-[#FCEEEE] text-[#B54747]';
                    dotBg = 'bg-[#B54747]';
                  }

                  return (
                    <tr key={adapter.id} className="hover:bg-surface-container-high/60 transition-colors bg-surface-container-lowest">
                      <td className="py-space-md px-space-md">
                        <div className="flex items-center gap-space-sm">
                          <button
                            type="button"
                            onClick={() => toggleAdapter(adapter.id)}
                            title={isEnabled ? 'Adapter Enabled (Click to disable)' : 'Adapter Disabled (Click to enable)'}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                              isEnabled ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container border-outline text-transparent'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          </button>
                          <div className="flex flex-col min-w-0">
                            <span className={`font-body-md-medium truncate font-semibold ${isEnabled ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
                              {adapter.name}
                            </span>
                            <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">
                              {adapter.tier}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-space-md px-space-md font-mono text-[12px] text-on-surface-variant">
                        {adapter.type}
                      </td>
                      <td className="py-space-md px-space-md font-mono text-[12px] text-primary truncate max-w-xs">
                        <a href={adapter.endpointUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          <span>{adapter.endpointUrl}</span>
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </a>
                      </td>
                      <td className="py-space-md px-space-md">
                        <div className="flex flex-col">
                          <span className="font-body-md-medium text-secondary text-[13px]">
                            {adapter.availability}
                          </span>
                          <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">
                            {adapter.availabilityLabel || 'Not monitored'}
                          </span>
                        </div>
                      </td>
                      <td className="py-space-md px-space-md text-metadata text-on-surface-variant">
                        {Array.isArray(adapter.supportedFields) ? adapter.supportedFields.join(', ') : 'Standard Schema'}
                      </td>
                      <td className="py-space-md px-space-md text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-pill-label text-pill-label font-bold whitespace-nowrap ${badgeBg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                            {adapter.statusLabel || adapter.status}
                          </span>
                          {adapter.statusNote && (
                            <span className="text-[10px] text-on-surface-variant max-w-[200px] text-right truncate" title={adapter.statusNote}>
                              {adapter.statusNote}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-space-sm rounded-lg bg-surface-container-low/60 border border-outline-variant/20 text-[12px] text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
            <span>
              <strong>Integrity Guard:</strong> HTTP 200 on a public lookup page alone does not grant automated authentication. Mismatches and unauthenticated public records require recruiter adjudication.
            </span>
          </div>
        </section>

        {/* SECTION 2: Operating Mode */}
        <section id="section-modes" className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
          <div className="pb-space-xs border-b border-surface-container-high/60">
            <h2 className="font-headline-md text-headline-md text-primary tracking-tight font-bold">
              Operating Mode
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Select verification gateway mode for enterprise environment. Validated on both backend and frontend.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <label className={`p-space-lg rounded-xl border cursor-pointer flex flex-col gap-2 transition-all ${
              operatingMode === 'demo'
                ? 'border-primary bg-surface-container-low ring-1 ring-primary'
                : 'border-outline-variant/30 hover:bg-surface-container-low'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-primary font-bold">Sandbox Demo Mode</span>
                <input
                  type="radio"
                  name="operatingMode"
                  value="demo"
                  checked={operatingMode === 'demo'}
                  onChange={() => setOperatingMode('demo')}
                  className="w-4 h-4 text-primary"
                />
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant text-[13px] leading-relaxed">
                Uses clearly labeled synthetic and mocked responses for controlled testing (TC1–TC4). Simulated evidence is explicitly marked.
              </p>
              <span className="text-[11px] font-mono text-secondary mt-auto">Evidence: [Sandbox Controlled Fixture]</span>
            </label>

            <label className={`p-space-lg rounded-xl border cursor-pointer flex flex-col gap-2 transition-all ${
              operatingMode === 'production'
                ? 'border-primary bg-surface-container-low ring-1 ring-primary'
                : 'border-outline-variant/30 hover:bg-surface-container-low'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-primary font-bold">Production Gateway</span>
                <input
                  type="radio"
                  name="operatingMode"
                  value="production"
                  checked={operatingMode === 'production'}
                  onChange={() => setOperatingMode('production')}
                  className="w-4 h-4 text-primary"
                />
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant text-[13px] leading-relaxed">
                Uses only genuinely configured sovereign registrar adapters. Never silently falls back to simulated mocks. Requires candidate consent.
              </p>
              <span className="text-[11px] font-mono text-[#267653] mt-auto">Evidence: Authoritative Sovereign Endpoint</span>
            </label>

            <label className={`p-space-lg rounded-xl border cursor-pointer flex flex-col gap-2 transition-all ${
              operatingMode === 'offline'
                ? 'border-primary bg-surface-container-low ring-1 ring-primary'
                : 'border-outline-variant/30 hover:bg-surface-container-low'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-primary font-bold">Offline Fixtures</span>
                <input
                  type="radio"
                  name="operatingMode"
                  value="offline"
                  checked={operatingMode === 'offline'}
                  onChange={() => setOperatingMode('offline')}
                  className="w-4 h-4 text-primary"
                />
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant text-[13px] leading-relaxed">
                Zero external network requests guaranteed. Runs deterministic local tests for air-gapped security validation.
              </p>
              <span className="text-[11px] font-mono text-outline mt-auto">Evidence: Air-Gapped Simulation (0 Egress)</span>
            </label>
          </div>
        </section>

        {/* SECTION 3: AI Provider & Architecture */}
        <section id="section-agent" className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
          <div className="pb-space-xs border-b border-surface-container-high/60">
            <h2 className="font-headline-md text-headline-md text-primary tracking-tight font-bold">
              AI Provider & Architecture
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Multimodal optical character recognition (OCR) and forensic document intake configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2 border border-outline-variant/20">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase text-[11px] font-semibold">Active AI Engine</span>
              <div className="flex items-center justify-between">
                <span className="font-body-md-medium text-body-md text-on-surface font-bold">
                  Google Gemini Multimodal Vision
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-pill-label text-pill-label font-bold ${
                  isGeminiReady ? 'bg-[#EAF5EE] text-[#267653]' : 'bg-[#FFF5D9] text-[#9A6700]'
                }`}>
                  {isGeminiReady ? 'API KEY CONFIGURED' : 'STANDBY (NO KEY IN .ENV)'}
                </span>
              </div>

              {/* Supported Model Selection */}
              <div className="mt-2 flex flex-col gap-1">
                <label className="text-metadata text-on-surface-variant font-semibold">Configured Gemini Model:</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-2 font-mono text-body-md text-primary font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {supportedModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <p className="font-metadata text-metadata text-on-surface-variant mt-1 leading-relaxed text-[12px]">
                Applies directly to server-side OCR text extraction and forensic document parsing.
              </p>
            </div>

            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2 border border-outline-variant/20">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase text-[11px] font-semibold">Alternative AI Providers</span>
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
                  <span className="text-body-md text-on-surface-variant font-medium">OpenAI GPT-4o Vision</span>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-surface-container text-on-surface-variant font-semibold">UNAVAILABLE</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
                  <span className="text-body-md text-on-surface-variant font-medium">Anthropic Claude 3.5 Sonnet</span>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-surface-container text-on-surface-variant font-semibold">UNAVAILABLE</span>
                </div>
              </div>
              <p className="font-metadata text-metadata text-on-surface-variant mt-auto text-[11px]">
                Only Google Gemini is currently implemented in this deployment. Unsupported providers are honestly labeled.
              </p>
            </div>
          </div>

          {/* OCR Confidence Threshold Slider */}
          <div className="flex flex-col gap-2 pt-space-xs bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20">
            <div className="flex justify-between items-center text-metadata font-metadata">
              <span className="text-on-surface font-semibold text-body-md">
                OCR Optical Extraction Confidence Threshold:
              </span>
              <span className="font-bold text-primary font-mono text-headline-sm">{ocrConfidenceThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="99"
              value={ocrConfidenceThreshold}
              onChange={(e) => setOcrConfidenceThreshold(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer h-2 bg-surface-container-high rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-on-surface-variant font-mono">
              <span>50% (Permissive)</span>
              <span>85% (Enterprise Default)</span>
              <span>99% (Strict Inspection)</span>
            </div>
            <p className="font-metadata text-metadata text-on-surface-variant text-[12px] leading-relaxed mt-1">
              <strong>Enforcement Policy:</strong> Extractions with confidence below <strong>{ocrConfidenceThreshold}%</strong> are automatically flagged as <code>NEEDS REVIEW</code> and routed to the Human Adjudication Queue, even if an authoritative identifier matches.
            </p>
          </div>
        </section>

        {/* SECTION 4: Account & Supabase Database */}
        <section id="section-account" className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
          <div className="pb-space-xs border-b border-surface-container-high/60 flex items-center justify-between">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary tracking-tight font-bold">
                Account & Database Configuration
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
                Supabase authentication, Row Level Security, and storage settings.
              </p>
            </div>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-space-md py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-body-md-medium font-body-md-medium transition-colors"
            >
              Manage Session
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-1">
              <span className="font-metadata text-metadata text-on-surface-variant text-[11px] uppercase">Active User Account</span>
              <span className="font-body-md-medium text-body-md text-on-surface font-bold">
                {user.email || 'Not signed in (Guest Recruiter Mode)'}
              </span>
              <span className="font-metadata text-metadata text-secondary">
                {user.email ? user.role : 'Guest Session (Read-Only Demo Mode)'}
              </span>
              <div className="pt-2">
                {user.email ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-metadata text-error font-semibold hover:underline"
                  >
                    Sign Out Session
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="text-metadata text-primary font-semibold hover:underline"
                  >
                    Sign In to Supabase
                  </button>
                )}
              </div>
            </div>

            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-1">
              <span className="font-metadata text-metadata text-on-surface-variant text-[11px] uppercase">Supabase Integration Status</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-[#267653]' : 'bg-[#9A6700]'}`}></span>
                <span className="font-body-md-medium text-body-md text-on-surface font-bold">
                  {isSupabaseConfigured ? 'Configured & Active' : 'Standby Demo Mode'}
                </span>
              </div>
              <span className="font-metadata text-metadata text-on-surface-variant text-[12px] mt-1 leading-relaxed">
                {isSupabaseConfigured
                  ? 'Connected to configured project URL and Publishable anon key with RLS enforcement.'
                  : 'Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env to connect live Supabase project.'}
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 5: Real-Time Statistics & Ledger Telemetry */}
        <section id="section-statistics" className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
          <div className="pb-space-xs border-b border-surface-container-high/60 flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
            <div>
              <div className="flex items-center gap-space-xs mb-1">
                <span className="font-metadata text-metadata text-secondary uppercase tracking-wider font-semibold">
                  Live Audit Metrics
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                <span className="font-metadata text-metadata text-on-tertiary-container font-semibold">
                  Row Level Security Active
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md text-primary tracking-tight font-bold">
                Real-Time Statistics & Ledger Telemetry
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
                Authentic verification metrics derived strictly from persisted Supabase records belonging to the authenticated account.
              </p>
            </div>

            <div className="flex items-center gap-space-sm self-start sm:self-auto">
              <button
                type="button"
                onClick={() => user.id && loadSupabaseData(user.id)}
                disabled={dbLoading}
                className="h-9 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-metadata font-body-md-medium flex items-center gap-1.5 transition-colors border border-outline-variant/30 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${dbLoading ? 'animate-spin text-secondary' : 'text-on-surface-variant'}`}>
                  sync
                </span>
                <span>{dbLoading ? 'Syncing...' : 'Refresh Live Ledger'}</span>
              </button>
            </div>
          </div>

          {/* Database Error Banner if any */}
          {dbError && (
            <div className="p-space-md rounded-xl bg-[#FCEEEE] text-[#B54747] text-body-md flex items-center gap-space-sm border border-[#F4C7C7]">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <span>Database Synchronization Notice: {dbError}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {dbLoading ? (
            <div className="py-space-xl text-center flex flex-col items-center justify-center gap-space-sm bg-surface-container-low/40 rounded-xl border border-outline-variant/20">
              <span className="material-symbols-outlined text-[32px] text-secondary animate-spin">sync</span>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Querying authenticated records from Supabase tables...
              </p>
            </div>
          ) : (
            <>
              {/* 5-Card Metric Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md pt-space-xs">
                {/* Metric 1: Total Checks */}
                <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between border border-outline-variant/30">
                  <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">
                    Total Certificates
                  </span>
                  <div className="flex items-baseline gap-space-xs my-1">
                    <span className="font-headline-lg text-headline-lg text-primary font-bold">
                      {metrics.totalDistinct}
                    </span>
                    <span className="text-metadata text-on-surface-variant">records</span>
                  </div>
                  <span className="font-metadata text-metadata text-secondary text-[11px]">
                    Authoritative: public.certificates
                  </span>
                </div>

                {/* Metric 2: Verified Authentic */}
                <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">
                      Verified Authentic
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#267653]"></span>
                  </div>
                  <div className="flex items-baseline gap-space-xs my-1">
                    <span className="font-headline-lg text-headline-lg text-[#267653] font-bold">
                      {metrics.verifiedCount}
                    </span>
                    <span className="text-metadata text-[#267653] font-semibold">({metrics.verifiedRate}%)</span>
                  </div>
                  <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">
                    status = 'verified'
                  </span>
                </div>

                {/* Metric 3: Mismatch */}
                <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">
                      Mismatch
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#B54747]"></span>
                  </div>
                  <div className="flex items-baseline gap-space-xs my-1">
                    <span className="font-headline-lg text-headline-lg text-[#B54747] font-bold">
                      {metrics.mismatchCount}
                    </span>
                    <span className="text-metadata text-[#B54747] font-semibold">({metrics.mismatchRate}%)</span>
                  </div>
                  <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">
                    status = 'rejected'
                  </span>
                </div>

                {/* Metric 4: Not Found */}
                <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">
                      Not Found (Absence)
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#9A6700]"></span>
                  </div>
                  <div className="flex items-baseline gap-space-xs my-1">
                    <span className="font-headline-lg text-headline-lg text-[#9A6700] font-bold">
                      {metrics.notFoundCount}
                    </span>
                    <span className="text-metadata text-[#9A6700] font-semibold">({metrics.notFoundRate}%)</span>
                  </div>
                  <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">
                    status = 'flagged'
                  </span>
                </div>

                {/* Metric 5: Awaiting Review */}
                <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">
                      Awaiting Review
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#64748B]"></span>
                  </div>
                  <div className="flex items-baseline gap-space-xs my-1">
                    <span className="font-headline-lg text-headline-lg text-[#64748B] font-bold">
                      {metrics.awaitingReviewCount}
                    </span>
                    <span className="text-metadata text-[#64748B] font-semibold">({metrics.awaitingReviewRate}%)</span>
                  </div>
                  <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">
                    status = 'pending'
                  </span>
                </div>
              </div>

              {/* Zero Records Empty State Note */}
              {certificates.length === 0 && (
                <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface-variant text-body-md flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px] text-outline">info</span>
                  <span>
                    Zero persisted certificate records found in Supabase for this account. Create a verification via New Verification to populate your cloud audit ledger.
                  </span>
                </div>
              )}

              {/* Schema Authority & Counting Rules Documentation */}
              <div className="mt-space-xs p-space-md rounded-xl bg-surface-container-low/60 border border-outline-variant/20 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-metadata text-primary font-semibold">
                  <span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
                  <span>Data Integrity & Audit Counting Specification:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm text-metadata text-on-surface-variant leading-relaxed">
                  <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/10">
                    <span className="font-bold text-on-surface block mb-0.5">Authoritative Unique Table:</span>
                    <code>public.certificates</code> is the authoritative source for credential records. Each verification evaluates a distinct certificate ID, preventing double counting even when multiple audit iterations occur.
                  </div>
                  <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/10">
                    <span className="font-bold text-on-surface block mb-0.5">Authoritative Audit Trail Table:</span>
                    <code>public.verification_history</code> ({verificationHistory.length} events logged) records historical audit runs and full JSONB forensics. It is queried for audit trail inspection without inflating unique certificate totals.
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
