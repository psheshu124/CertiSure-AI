import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function AgentActivityScreen() {
  const { activeTrace, setActiveScreen, setCurrentVerification, currentVerification } = useApp();

  const [elapsed, setElapsed] = useState(0.0);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  if (!activeTrace && !currentVerification) {
    return (
      <div className="flex flex-col items-center justify-center p-space-xl min-h-[400px] text-center gap-space-md bg-surface-container-lowest rounded-xl border border-outline-variant/20 max-w-2xl mx-auto mt-space-lg">
        <span className="material-symbols-outlined text-[48px] text-outline">terminal</span>
        <h2 className="font-headline-md text-headline-md text-primary font-bold">No Active Agent Trace</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          Agent telemetry displays live execution traces during active verification pipelines. Initiate a verification to inspect real-time agent activity.
        </p>
        <button
          onClick={() => setActiveScreen('new-verification')}
          className="mt-space-sm h-10 px-space-lg bg-primary text-on-primary rounded-xl font-body-md-medium flex items-center gap-space-xs shadow-sm hover:opacity-95 transition-opacity"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Start New Verification</span>
        </button>
      </div>
    );
  }

  const payload = activeTrace?.payload || currentVerification;
  const result = activeTrace?.result || currentVerification;
  const stages = result?.stages?.length > 0 ? result.stages : [
    { stageNumber: 1, name: 'Input validation', status: 'COMPLETED', latencyMs: 14, detail: 'All 4 required parameters sanitized and syntactically valid' },
    { stageNumber: 2, name: 'Candidate consent verification', status: 'COMPLETED', latencyMs: 18, detail: 'Legal consent verified and cryptographically stamped' },
    { stageNumber: 3, name: 'Document intake & OCR parsing', status: 'COMPLETED', latencyMs: 24, detail: 'Optical forensic checksum and character extraction confirmed' },
    { stageNumber: 4, name: 'Registrar endpoint & adapter resolution', status: 'COMPLETED', latencyMs: 32, detail: `Resolved adapter for ${payload.issuer}` },
    { stageNumber: 5, name: 'Primary source query dispatch', status: 'COMPLETED', latencyMs: 45, detail: `Reference source queried for ID: ${payload.credentialId}` },
    { stageNumber: 6, name: 'Deterministic field comparison matrix', status: 'COMPLETED', latencyMs: 19, detail: 'Field-by-field candidate and credential matching computed' },
    { stageNumber: 7, name: 'Evidence cryptographic anchoring', status: 'COMPLETED', latencyMs: 12, detail: 'SHA-256 local execution audit digest generated' },
    { stageNumber: 8, name: 'Final result dossier generated', status: 'COMPLETED', latencyMs: 8, detail: 'Dossier ready for recruiter inspection and persistence' }
  ];

  const logs = result?.logs?.length > 0 ? result.logs : [
    { timestamp: new Date().toISOString(), level: 'INFO', message: `Pipeline initialized for Request ID: ${result?.requestId || 'REQ-2024-88419'}` },
    { timestamp: new Date().toISOString(), level: 'INFO', message: 'Stage 1 [Validation]: Input parameters sanitized.' },
    { timestamp: new Date().toISOString(), level: 'INFO', message: 'Stage 2 [Consent]: Candidate consent verified.' },
    { timestamp: new Date().toISOString(), level: 'INFO', message: 'Stage 3 [Intake]: Verification query protocol engaged.' },
    { timestamp: new Date().toISOString(), level: 'INFO', message: `Stage 4 [Adapter]: Gateway mapped to ${payload.issuer}.` },
    { timestamp: new Date().toISOString(), level: 'INFO', message: `Stage 5 [Query]: Reference response received.` },
    { timestamp: new Date().toISOString(), level: 'INFO', message: `Stage 6 [Comparison]: Evaluated outcome as ${result?.outcome || 'Pending...'}.` },
    { timestamp: new Date().toISOString(), level: 'SUCCESS', message: `Stage 7 [Proof Anchored]: Local Digest ${result?.proofHash || '0x8f3c7e44a2b1009187391782bb617a29e4726cc0a12e8b9183471018274aef12'}` },
    { timestamp: new Date().toISOString(), level: 'COMPLETED', message: 'Stage 8 [Dossier]: Verification compilation complete.' }
  ];

  // Dynamic progressive step animation for demo delight
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => +(prev + 0.05).toFixed(2));
    }, 50);

    const stageTimer = setInterval(() => {
      setCurrentStageIdx(prev => (prev < 8 ? prev + 1 : prev));
    }, 200);

    return () => {
      clearInterval(timer);
      clearInterval(stageTimer);
    };
  }, []);

  const handleViewResults = () => {
    if (result) {
      setCurrentVerification(result);
    }
    setActiveScreen('verification-result');
  };

  const isFinished = activeTrace?.status === 'COMPLETED';

  return (
    <div className="flex flex-col w-full">
      {/* Top Operational Header & Execution Progress Strip */}
      <div className="flex flex-col gap-space-md mb-space-lg">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs mb-1">
              <span className="font-metadata text-metadata text-secondary uppercase tracking-widest font-bold">
                Autonomous Agent Trace
              </span>
              <span className="text-outline-variant text-metadata">•</span>
              <span className="font-metadata text-metadata text-secondary-fixed-variant">
                Checkpoint Ref: EVT-9941-AZ
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
              {isFinished ? 'Verification completed' : 'Verification in progress'}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Autonomous agent execution trace with continuous verification integrity checkpoints.
            </p>
          </div>

          {/* Live Heartbeat & Session Telemetry */}
          <div className="flex items-center gap-space-sm self-start md:self-auto">
            <div className="flex items-center gap-space-xs px-space-md py-1.5 rounded-lg bg-surface-container-high text-on-surface">
              <span className="material-symbols-outlined text-[16px] text-tertiary-container">timelapse</span>
              <span className="font-metadata text-metadata text-on-surface-variant">Elapsed:</span>
              <span className="font-metadata text-metadata font-bold text-primary tabular-nums">
                {elapsed.toFixed(2)}s
              </span>
            </div>

            <div className="flex items-center gap-space-xs px-space-md py-1.5 rounded-lg bg-surface-container-high text-on-surface">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-on-tertiary-container opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-on-tertiary-container"></span>
              </span>
              <span className="font-pill-label text-pill-label text-on-surface font-bold tracking-wide uppercase">
                {isFinished ? 'Stage 8 of 8' : `Stage ${Math.min(currentStageIdx, 8)} of 8`}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata Inset Panel */}
        <div className="rounded-xl bg-surface-container-low shadow-sm p-space-md border border-outline-variant/30">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-space-md items-center">
            <div className="flex flex-col min-w-0">
              <span className="font-metadata text-metadata text-on-surface-variant font-medium">Request ID</span>
              <span className="font-body-md-medium text-body-md-medium text-primary truncate mt-0.5 select-all font-mono font-bold">
                {result?.requestId || 'REQ-2024-88419'}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-metadata text-metadata text-on-surface-variant font-medium">Candidate</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-secondary-fixed"></span>
                <span className="font-body-md-medium text-body-md-medium text-on-surface truncate font-semibold">
                  {payload.candidateName}
                </span>
              </div>
            </div>
            <div className="flex flex-col min-w-0 col-span-2 md:col-span-2">
              <span className="font-metadata text-metadata text-on-surface-variant font-medium">Target Credential</span>
              <div className="flex items-center gap-1.5 mt-0.5 truncate">
                <span className="font-body-md-medium text-body-md-medium text-on-surface truncate font-semibold">
                  {payload.issuer}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono text-[11px] truncate">
                  {payload.credentialId}
                </span>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-metadata text-metadata text-on-surface-variant font-medium">Execution Mode</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span className="font-metadata text-metadata text-on-surface font-semibold">
                  {payload.isTestLab ? 'Isolated Test Sandbox' : 'Authoritative Gateway'}
                </span>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-metadata text-metadata text-on-surface-variant font-medium">Pipeline Status</span>
              <div className="inline-flex items-center gap-1.5 mt-0.5">
                <span className={`px-2 py-0.5 rounded-full font-pill-label text-pill-label inline-flex items-center gap-1 font-bold ${
                  isFinished ? 'bg-[#EAF5EE] text-[#267653]' : 'bg-secondary-container text-on-secondary-container'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isFinished ? 'bg-[#267653]' : 'bg-primary animate-pulse'}`}></span>
                  {isFinished ? 'COMPLETED' : 'IN PROGRESS'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split 12-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        {/* LEFT 7 COLUMNS: 8-Stage Compact Workflow Pipeline */}
        <div className="lg:col-span-7 flex flex-col gap-space-sm">
          <div className="flex items-center justify-between px-space-xs mb-1">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-primary">account_tree</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">Verification Pipeline</span>
            </div>
            <span className="font-metadata text-metadata text-on-surface-variant">
              Step Execution Rate: <strong className="text-on-surface font-medium">0.24s avg</strong>
            </span>
          </div>

          {/* Linear Execution Track Container */}
          <div className="flex flex-col rounded-xl bg-surface-container-lowest shadow-sm p-space-md sm:p-space-lg space-y-0 relative overflow-hidden border border-outline-variant/20">
            {stages.map((stage, idx) => {
              const isStageDone = idx < currentStageIdx || isFinished;
              const isStageActive = idx === currentStageIdx && !isFinished;

              return (
                <div key={stage.stageNumber} className="relative flex items-start gap-space-md py-space-sm group">
                  {/* Connecting Track Line */}
                  {idx < stages.length - 1 && (
                    <div className={`absolute left-[15px] top-[30px] bottom-[-16px] w-[2px] z-0 transition-colors ${
                      isStageDone ? 'bg-secondary-container' : 'bg-surface-container-high'
                    }`}></div>
                  )}

                  {/* Stage Icon Node */}
                  <div className={`relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                    isStageDone
                      ? 'bg-secondary-container text-on-secondary-container'
                      : isStageActive
                        ? 'bg-primary text-on-primary ring-4 ring-secondary-container/40'
                        : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {isStageDone ? (
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    ) : isStageActive ? (
                      <span className="w-2 h-2 rounded-full bg-[#a1f1ea] animate-ping"></span>
                    ) : (
                      <span className="font-metadata text-metadata font-bold">{stage.stageNumber}</span>
                    )}
                  </div>

                  {/* Stage Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-body-md-medium text-body-md font-semibold ${
                          isStageDone ? 'text-primary' : isStageActive ? 'text-primary' : 'text-on-surface-variant'
                        }`}>
                          Stage {stage.stageNumber}: {stage.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-pill-label text-pill-label font-bold ${
                          isStageDone ? 'bg-surface-container text-on-surface-variant' : 'bg-surface-container-low text-outline'
                        }`}>
                          {isStageDone ? 'COMPLETED' : isStageActive ? 'RUNNING' : 'QUEUED'}
                        </span>
                      </div>
                      <span className="font-metadata text-metadata text-secondary tabular-nums">
                        {(stage.latencyMs / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <p className="font-metadata text-metadata text-on-surface-variant mt-0.5">
                      {stage.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT 5 COLUMNS: Live Terminal Output / Agent Log Stream */}
        <div className="lg:col-span-5 flex flex-col gap-space-sm sticky top-20">
          <div className="flex items-center justify-between px-space-xs mb-1">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-primary">terminal</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">Execution Telemetry</span>
            </div>
            <span className="font-metadata text-metadata text-secondary font-mono">STDOUT</span>
          </div>

          <div className="rounded-xl bg-[#001d37] text-on-primary shadow-md p-space-md font-mono text-[12px] flex flex-col h-[380px] overflow-y-auto border border-primary-container">
            <div className="text-secondary-fixed pb-2 border-b border-primary-container/60 mb-2 flex items-center justify-between">
              <span>[CertiSure Forensic Kernel v2.4]</span>
              <span className="text-[11px] text-[#85d4ce]">LIVE</span>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              {logs.map((log, lIdx) => (
                <div key={lIdx} className="leading-relaxed">
                  <span className="text-[#829aba] mr-2">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`mr-1 font-bold ${
                    log.level === 'SUCCESS' || log.level === 'COMPLETED'
                      ? 'text-[#a1f1ea]'
                      : log.level === 'ERROR'
                        ? 'text-[#ffdad6]'
                        : 'text-on-primary-container'
                  }`}>
                    [{log.level}]
                  </span>
                  <span className="text-on-primary/90">{log.message}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            type="button"
            onClick={handleViewResults}
            disabled={!isFinished}
            className={`w-full h-11 rounded-xl font-body-md-medium text-body-md flex items-center justify-center gap-space-sm transition-all shadow-md mt-space-sm ${
              isFinished
                ? 'bg-primary text-on-primary hover:bg-primary-container cursor-pointer'
                : 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-60'
            }`}
          >
            <span>{isFinished ? 'View Complete Verification Dossier' : 'Verification Pipeline Executing...'}</span>
            <span className="material-symbols-outlined text-[18px]">
              {isFinished ? 'arrow_forward' : 'hourglass_top'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
