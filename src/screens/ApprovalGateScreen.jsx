import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function ApprovalGateScreen() {
  const {
    currentVerification,
    setCurrentVerification,
    setActiveScreen,
    user,
    authSession,
    setActiveTrace,
    saveVerificationResult
  } = useApp();

  const [authorized, setAuthorized] = useState(true);
  const [recruiterNotes, setRecruiterNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gateError, setGateError] = useState('');
  const [adapters, setAdapters] = useState([]);

  useEffect(() => {
    fetch('/api/adapters')
      .then(res => res.json())
      .then(data => {
        if (data?.adapters && Array.isArray(data.adapters)) {
          setAdapters(data.adapters);
        }
      })
      .catch(() => {});
  }, []);

  if (!currentVerification) {
    return (
      <div className="flex flex-col items-center justify-center p-space-xl min-h-[400px] text-center gap-space-md bg-surface-container-lowest rounded-xl border border-outline-variant/20 max-w-2xl mx-auto mt-space-lg">
        <span className="material-symbols-outlined text-[48px] text-outline">verified_user</span>
        <h2 className="font-headline-md text-headline-md text-primary font-bold">No Pending Verification Action</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          The Human Authorization Gate requires an active verification payload. Initiate a verification from the intake form to review and authorize external queries.
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

  const payload = currentVerification;

  // Determine if running in Demo Mode (explicit 'demo' mode or synthetic demo credential)
  const isDemoMode = payload.operatingMode === 'demo' ||
    !payload.operatingMode ||
    payload.credentialId?.startsWith('DEMO-') ||
    payload.issuer === 'CertiSure Demo University' ||
    payload.issuer === 'Controlled Synthetic Demo Registry';

  // Find genuine configured adapter for production mode
  const matchedAdapter = adapters.find(a =>
    a.name?.toLowerCase() === payload.issuer?.toLowerCase() ||
    a.code?.toLowerCase() === payload.issuer?.toLowerCase() ||
    a.id?.toLowerCase() === payload.issuer?.toLowerCase()
  );

  const isConfigured = Boolean(matchedAdapter && (matchedAdapter.isConfigured === true || (!matchedAdapter.requiredEnvVar && Boolean(matchedAdapter.endpointUrl))));

  // Target endpoint determination
  let targetEndpoint = '';
  let targetEndpointSublabel = '';
  let targetEndpointTitle = 'Target Registrar Endpoint';
  let queryProtocolTitle = '';
  let queryProtocolSublabel = '';
  let claimedIssuerSublabel = '';

  if (isDemoMode) {
    targetEndpointTitle = 'Target Verification Source';
    targetEndpoint = `demo://controlled-synthetic-registry/${payload.credentialId}`;
    targetEndpointSublabel = 'Controlled Synthetic Demo Registry';
    queryProtocolTitle = 'Local Synthetic Fixture Comparison (Zero External Requests)';
    queryProtocolSublabel = 'DEMO/SYNTHETIC — for demonstration only';
    claimedIssuerSublabel = 'Controlled Synthetic Authority';
  } else if (isConfigured) {
    targetEndpointTitle = 'Target Registrar Endpoint';
    targetEndpoint = `${matchedAdapter.endpointUrl}/${encodeURIComponent(payload.credentialId)}`;
    targetEndpointSublabel = 'Authoritative Institutional Registrar';
    queryProtocolTitle = 'Authoritative Direct Registry API Query';
    queryProtocolSublabel = 'Authenticated Partner API & SHA-256 Digest Match';
    claimedIssuerSublabel = 'Accredited Channel (Configured)';
  } else {
    targetEndpointTitle = 'Target Verification Source';
    targetEndpoint = payload.publicVerificationUrl || (matchedAdapter ? `${matchedAdapter.endpointUrl}/${encodeURIComponent(payload.credentialId)}` : 'N/A — No Registered Adapter');
    targetEndpointSublabel = 'Unconfigured Verification Source (Awaiting Partner Credentials)';
    queryProtocolTitle = 'Unconfigured Adapter — Inconclusive Result Expected';
    queryProtocolSublabel = 'Requires partner API credentials; will transfer to Human Review Queue';
    claimedIssuerSublabel = 'Unconfigured / Requires Human Review';
  }

  const handleApprove = async () => {
    if (!authorized) {
      setGateError('You must check the authorization confirmation before executing.');
      return;
    }

    // Explicit Consent Check: If consent was missing in intake, fail immediately with clear warning
    if (!payload.consentGranted) {
      setGateError('Candidate consent is absent. CertiSure AI prohibits external query without valid candidate authorization.');
      return;
    }

    setIsSubmitting(true);
    setGateError('');

    try {
      // Transition immediately to Screen 4 (Agent Activity Trace)
      setActiveTrace({
        status: 'INITIALIZING',
        elapsedSeconds: '0.00s',
        stages: [],
        logs: [],
        payload,
      });
      setActiveScreen('agent-activity');

      // Call backend verification engine
      const headers = { 'Content-Type': 'application/json' };
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`;
      }

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const verificationResult = await res.json();

      // Save result — get back persistenceWarning so we can show it on the result screen.
      const { persistenceWarning } = await saveVerificationResult(verificationResult, payload);
      setCurrentVerification(verificationResult);

      // Mark pipeline complete and carry the warning forward
      setActiveTrace({
        status: 'COMPLETED',
        result: verificationResult,
        payload,
        persistenceWarning: persistenceWarning || null,
      });

      // Navigate immediately to the result dossier — it is ready now.
      setActiveScreen('verification-result');
    } catch (err) {
      console.error('[Approval Gate Execute Error]', err);
      setGateError(err.message || 'Verification execution failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectToQueue = () => {
    // Save to review queue (fire-and-forget; warning not surfaced here)
    saveVerificationResult({
      requestId: `REQ-${Date.now()}`,
      credentialId: payload.credentialId,
      candidateNameSubmitted: payload.candidateName,
      issuer: payload.issuer,
      courseTitle: payload.courseTitle,
      issueDate: payload.issueDate,
      outcome: 'Unable to Verify',
      uiStatus: 'UNABLE TO VERIFY',
      dbStatus: 'pending',
      confidenceScore: null,
      explanation: recruiterNotes || 'Manually routed by recruiter to exception review queue.',
      verificationMethod: 'Manual Intake',
      sourceUrl: 'N/A',
      sourceType: 'Manual Forensic Review',
      stages: [],
      logs: [],
    }, payload);

    setActiveScreen('review-queue');
  };

  return (
    <div className="flex flex-col w-full">
      <div className="max-w-4xl mx-auto w-full space-y-space-lg pb-space-xl">
        {/* Breadcrumb & Status Header Block */}
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-metadata text-metadata">
            <span className="hover:text-on-surface cursor-pointer" onClick={() => setActiveScreen('overview')}>Queue</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="hover:text-on-surface cursor-pointer" onClick={() => setActiveScreen('new-verification')}>Verifications</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-on-surface font-body-md-medium">Authorization Gate</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pt-space-xs">
            <div>
              <div className="flex items-center gap-space-sm mb-space-xs">
                <span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-pill-label text-pill-label uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Human-in-the-Loop Protocol
                </span>
                <span className="font-metadata text-metadata text-on-surface-variant tabular-nums">Ref: ACT-GATE-8812</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
                Review verification action
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
                {isDemoMode
                  ? 'Explicit human authorization is required before evaluating credentials against the Controlled Synthetic Demo Registry.'
                  : 'Explicit human authorization is required before transmitting credential queries or accessing external verification endpoints.'}
              </p>
            </div>

            <div className="flex items-center gap-space-sm text-right self-start md:self-end">
              <div className="bg-surface-container-high px-space-md py-space-xs rounded-lg">
                <span className="block font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[10px]">
                  Gateway State
                </span>
                <span className="font-body-md-medium text-body-md-medium text-primary flex items-center gap-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
                  Awaiting Recruiter Signoff
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Alert / Warning Banner */}
        <div className="rounded-xl p-space-md bg-[#FFF5D9] text-[#9A6700] shadow-sm flex items-start gap-space-md border border-[#F0DC9B]">
          <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">verified_user</span>
          <div className="flex flex-col gap-0.5">
            <span className="font-body-md-medium text-body-md-medium font-bold">Human-in-the-Loop Gate</span>
            <span className="font-body-md text-body-md leading-relaxed text-[#9A6700]/90">
              {isDemoMode
                ? 'Review the proposed action payload. In Demo Mode, no external issuer request is sent; evidence is evaluated locally against the Controlled Synthetic Demo Registry.'
                : 'Review the proposed action payload. CertiSure AI never executes autonomous external lookups without verified recruiter authorization.'}
            </span>
          </div>
        </div>

        {gateError && (
          <div className="p-space-md rounded-xl bg-[#FCEEEE] text-[#B54747] text-body-md flex items-center gap-space-sm border border-[#F4C7C7]">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{gateError}</span>
          </div>
        )}

        {/* 1. Candidate & Credential Summary Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md border border-outline-variant/20">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high/60">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">badge</span>
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Candidate & Claimed Credential</h2>
                <p className="font-metadata text-metadata text-on-surface-variant">Parsed from applicant submission & legal disclosure</p>
              </div>
            </div>
            <span className="font-pill-label text-pill-label px-space-sm py-1 rounded-full bg-surface-container text-on-surface-variant font-bold">
              RECORD #CLAIM-01
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md pt-space-xs">
            <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">Candidate</span>
              <span className="font-body-md-medium text-body-md-medium text-on-surface mt-1 font-semibold">{payload.candidateName}</span>
              <span className="font-metadata text-metadata text-on-surface-variant/80 mt-0.5">Authenticated Intake</span>
            </div>

            <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">Claimed Credential</span>
              <span className="font-body-md-medium text-body-md-medium text-on-surface mt-1 font-semibold truncate" title={payload.courseTitle}>
                {payload.courseTitle}
              </span>
              <span className="font-metadata text-metadata text-on-surface-variant/80 mt-0.5">Declared Qualification</span>
            </div>

            <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">Claimed Issuer</span>
              <span className="font-body-md-medium text-body-md-medium text-on-surface mt-1 font-semibold">{payload.issuer}</span>
              <span className="font-metadata text-metadata text-on-surface-variant/80 mt-0.5">{claimedIssuerSublabel}</span>
            </div>

            <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">Claimed Credential ID</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-body-md-medium text-body-md-medium font-mono text-primary font-bold">{payload.credentialId}</span>
              </div>
              <span className="font-metadata text-metadata text-on-surface-variant/80 mt-0.5">Alphanumeric hash/ID</span>
            </div>

            <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">Claimed Issue Date</span>
              <span className="font-body-md-medium text-body-md-medium text-on-surface mt-1 font-semibold">{payload.issueDate || 'Undisclosed'}</span>
              <span className="font-metadata text-metadata text-on-surface-variant/80 mt-0.5">Declared validity</span>
            </div>

            <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">Candidate Consent</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${payload.consentGranted ? 'bg-[#267653]' : 'bg-[#B54747]'}`}></span>
                <span className={`font-body-md-medium text-body-md-medium font-bold ${payload.consentGranted ? 'text-[#267653]' : 'text-[#B54747]'}`}>
                  {payload.consentGranted ? 'Documented (Active)' : 'ABSENT (BLOCKED)'}
                </span>
              </div>
              <span className="font-metadata text-metadata text-on-surface-variant/80 mt-0.5">
                {payload.consentGranted ? 'Legal disclosure signed' : 'Prohibits external query'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Proposed Action Payload Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md border border-outline-variant/20">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high/60">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">hub</span>
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Proposed Action Payload</h2>
                <p className="font-metadata text-metadata text-on-surface-variant">
                  {isDemoMode
                    ? 'Local sandbox registry evaluation (Zero external network requests)'
                    : 'Outbound network query and verification scope'}
                </p>
              </div>
            </div>
            <span className="px-space-sm py-0.5 rounded-full bg-[#EDF3F8] text-[#287D78] font-pill-label text-pill-label uppercase font-bold">
              {isDemoMode ? 'Local Evaluation Only' : isConfigured ? 'Read-Only Query' : 'Unconfigured / Manual Review'}
            </span>
          </div>

          {/* Transparent Notice Banner */}
          {isDemoMode ? (
            <div className="p-space-sm rounded-lg bg-[#EDF3F8] text-[#287D78] text-[12px] flex items-center gap-2 border border-[#BBDCD9]">
              <span className="material-symbols-outlined text-[18px] shrink-0">info</span>
              <span>
                <strong>Notice:</strong> No external issuer request is sent in Demo Mode. Evidence is evaluated against the local Controlled Synthetic Demo Registry for demonstration purposes only.
              </span>
            </div>
          ) : !isConfigured ? (
            <div className="p-space-sm rounded-lg bg-[#FFF5D9] text-[#9A6700] text-[12px] flex items-center gap-2 border border-[#F0DC9B]">
              <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
              <span>
                <strong>Production Notice:</strong> This issuer does not have partner API credentials configured. Automated query is unavailable; verification will be marked inconclusive and require human review.
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-space-xs">
            <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">{targetEndpointTitle}</span>
              <span className="font-mono text-body-md text-primary font-semibold mt-1 truncate" title={targetEndpoint}>
                {targetEndpoint}
              </span>
              <span className="font-metadata text-metadata text-on-surface-variant mt-0.5">{targetEndpointSublabel}</span>
            </div>

            <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider text-[11px]">Query Protocol</span>
              <span className="font-body-md-medium text-body-md-medium text-on-surface font-semibold mt-1">
                {queryProtocolTitle}
              </span>
              <span className="font-metadata text-metadata text-on-surface-variant mt-0.5">{queryProtocolSublabel}</span>
            </div>
          </div>
        </div>

        {/* 3. Recruiter Authorization Sign-Off Panel */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-xl flex flex-col gap-space-md border border-outline-variant/20">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high/60">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Recruiter Authorization Sign-Off</h2>
                <p className="font-metadata text-metadata text-on-surface-variant">Record authorized reviewer audit decision</p>
              </div>
            </div>
            <span className="font-metadata text-metadata text-secondary font-semibold">
              Authorized Reviewer: {user.name}
            </span>
          </div>

          <label className="flex items-start gap-space-md cursor-pointer p-space-md rounded-xl bg-surface-container-low">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-primary focus:ring-secondary cursor-pointer"
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-body-md-medium text-body-md text-on-surface font-semibold">
                {isDemoMode
                  ? 'I authorize CertiSure AI to evaluate this credential against the Controlled Synthetic Demo Registry.'
                  : isConfigured
                    ? 'I authorize CertiSure AI to query the issuing institution registry on behalf of our enterprise.'
                    : 'I authorize CertiSure AI to process this verification and transfer to the Human Review Queue.'}
              </span>
              <span className="font-metadata text-metadata text-on-surface-variant text-[12px]">
                {isDemoMode
                  ? 'No external issuer request is sent in Demo Mode. Evidence is labeled DEMO/SYNTHETIC — for demonstration only.'
                  : 'I certify that candidate consent is verified and this check strictly adheres to verification guidelines.'}
              </span>
            </div>
          </label>

          <div className="flex flex-col gap-1">
            <label className="font-form-label text-form-label text-on-surface">Reviewer Audit Notes (Optional)</label>
            <input
              type="text"
              value={recruiterNotes}
              onChange={(e) => setRecruiterNotes(e.target.value)}
              placeholder="e.g. Verified candidate portfolio matches official application submission"
              className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary"
            />
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center justify-between pt-space-md border-t border-surface-container-high/60 flex-wrap gap-space-md">
            <button
              type="button"
              onClick={handleRejectToQueue}
              className="h-10 px-space-lg rounded-xl bg-surface-container text-[#B54747] hover:bg-[#FCEEEE] font-body-md-medium text-body-md transition-colors flex items-center gap-space-xs"
            >
              <span className="material-symbols-outlined text-[18px]">rule</span>
              <span>Flag & Transfer to Review Queue</span>
            </button>

            <div className="flex items-center gap-space-md">
              <button
                type="button"
                onClick={() => setActiveScreen('new-verification')}
                className="h-10 px-space-lg rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-body-md-medium text-body-md transition-colors"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="h-10 px-space-xl rounded-xl bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-body-md flex items-center gap-space-sm transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    <span>Approve & Execute Verification</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
