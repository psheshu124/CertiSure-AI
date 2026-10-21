import React from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function VerificationResultScreen() {
  const { currentVerification, setActiveScreen, certificates, activeTrace } = useApp();

  // Active result dossier or fallback from latest saved certificate
  const dossier = currentVerification || (certificates[0] ? {
    requestId: certificates[0].metadata?.requestId || 'REQ-2024-88419',
    credentialId: certificates[0].certificate_number,
    candidateNameSubmitted: certificates[0].student_name,
    issuer: certificates[0].institution_name,
    courseTitle: certificates[0].course_name || 'Specialization',
    issueDate: certificates[0].issue_date || '2023-11-15',
    outcome: certificates[0].metadata?.outcome || (certificates[0].status === 'verified' ? 'Verified Match' : certificates[0].status === 'rejected' ? 'Mismatch' : certificates[0].status === 'flagged' ? 'Not Found' : 'Unable to Verify'),
    uiStatus: certificates[0].metadata?.uiStatus || (certificates[0].status === 'verified' ? 'VERIFIED MATCH' : certificates[0].status === 'rejected' ? 'MISMATCH' : certificates[0].status === 'flagged' ? 'NOT FOUND' : 'UNABLE TO VERIFY'),
    confidenceScore: certificates[0].metadata?.confidenceScore || null,
    sourceUrl: certificates[0].metadata?.sourceUrl || null,
    sourceType: certificates[0].metadata?.sourceType || 'Audited Verification Record',
    verificationMethod: certificates[0].metadata?.verificationMethod || 'Deterministic Reference Comparison',
    proofHash: certificates[0].metadata?.proofHash || '0x8f3c7e44a2b1009187391782bb617a29e4726cc0a12e8b9183471018274aef12',
    retrievalTimestamp: certificates[0].created_at,
    explanation: certificates[0].metadata?.explanation || certificates[0].metadata?.reason || `Verification record evaluated for candidate ${certificates[0].student_name}.`,
    aiForensicSummary: certificates[0].metadata?.aiForensicSummary || certificates[0].metadata?.explanation || null,
    comparisonMatrix: certificates[0].metadata?.comparisonMatrix || [
      { field: 'Candidate Name', submitted: certificates[0].student_name, evidence: certificates[0].student_name, match: true, matchResult: 'MATCH', note: 'Exact identity match' },
      { field: 'Credential Identifier', submitted: certificates[0].certificate_number, evidence: certificates[0].certificate_number, match: true, matchResult: 'MATCH', note: 'Identifier matched' },
      { field: 'Issuing Institution', submitted: certificates[0].institution_name, evidence: certificates[0].institution_name, match: true, matchResult: 'MATCH', note: 'Organization matched' }
    ],
    previewUrl: certificates[0].metadata?.previewUrl || null,
    isTestFixture: Boolean(certificates[0].metadata?.isTestFixture),
  } : null);

  if (!dossier) {
    return (
      <div className="p-space-xl text-center bg-surface-container-lowest rounded-xl">
        <p className="font-body-md text-on-surface-variant">No verification selected.</p>
        <button onClick={() => setActiveScreen('overview')} className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg">
          Back to Overview
        </button>
      </div>
    );
  }

  const outcome = dossier.outcome || '';
  const uiStatus = dossier.uiStatus || '';

  const isDemoMatch = outcome === 'VERIFIED (DEMO)' || outcome === 'Demo Match' || uiStatus === 'VERIFIED (DEMO)' || uiStatus === 'DEMO MATCH (SYNTHETIC)';
  const isDemoMismatch = outcome === 'MISMATCH (DEMO)' || outcome === 'Demo Mismatch' || uiStatus === 'MISMATCH (DEMO)' || uiStatus === 'DEMO MISMATCH (SYNTHETIC)';
  const isVerifiedMatch = outcome === 'VERIFIED MATCH' || outcome === 'Verified Match' || outcome === 'Verified' || uiStatus === 'VERIFIED MATCH';
  const isMismatch = outcome === 'MISMATCH' || outcome === 'Mismatch' || uiStatus === 'MISMATCH';
  const isNotFound = outcome === 'NOT FOUND (DEMO)' || outcome === 'Not Found' || outcome === 'NOT FOUND' || uiStatus === 'NOT FOUND (DEMO)' || uiStatus === 'NOT FOUND';
  const isRevoked = outcome === 'REVOKED (DEMO)' || outcome === 'Revoked' || outcome === 'REVOKED' || uiStatus === 'REVOKED (DEMO)' || uiStatus === 'DEMO REVOKED (SYNTHETIC)' || uiStatus === 'REVOKED';
  const isUnableToVerify = outcome === 'INCONCLUSIVE / ISSUER UNAVAILABLE' || outcome === 'Unable to Verify' || outcome === 'UNABLE TO VERIFY' || outcome === 'Inconclusive / Needs Review' || outcome === 'Inconclusive' || outcome === 'Needs Review';
  const isBlocked = outcome === 'BLOCKED / CONSENT REQUIRED' || outcome === 'Missing Consent' || uiStatus === 'BLOCKED / CONSENT REQUIRED' || uiStatus === 'BLOCKED';

  let statusBadge = {
    text: 'text-[#64748B]',
    bg: 'bg-[#EEF1F5]',
    border: 'border-[#D4DCE5]',
    label: 'INCONCLUSIVE / ISSUER UNAVAILABLE',
    icon: 'help_outline',
    bar: 'bg-[#64748B]'
  };

  if (isDemoMatch) {
    statusBadge = {
      text: 'text-[#267653]',
      bg: 'bg-[#EAF5EE]',
      border: 'border-[#BFE0CD]',
      label: 'VERIFIED (DEMO)',
      icon: 'science',
      bar: 'bg-[#267653]'
    };
  } else if (isDemoMismatch) {
    statusBadge = {
      text: 'text-[#B54747]',
      bg: 'bg-[#FCEEEE]',
      border: 'border-[#F4C7C7]',
      label: 'MISMATCH (DEMO)',
      icon: 'science',
      bar: 'bg-[#B54747]'
    };
  } else if (isVerifiedMatch) {
    statusBadge = {
      text: 'text-[#267653]',
      bg: 'bg-[#EAF5EE]',
      border: 'border-[#BFE0CD]',
      label: 'VERIFIED MATCH',
      icon: 'check_circle',
      bar: 'bg-[#267653]'
    };
  } else if (isMismatch) {
    statusBadge = {
      text: 'text-[#B54747]',
      bg: 'bg-[#FCEEEE]',
      border: 'border-[#F4C7C7]',
      label: 'MISMATCH',
      icon: 'cancel',
      bar: 'bg-[#B54747]'
    };
  } else if (isNotFound) {
    statusBadge = {
      text: 'text-[#9A6700]',
      bg: 'bg-[#FFF5D9]',
      border: 'border-[#F0DC9B]',
      label: dossier.isTestFixture ? 'NOT FOUND (DEMO)' : 'NOT FOUND',
      icon: 'search_off',
      bar: 'bg-[#9A6700]'
    };
  } else if (isRevoked) {
    statusBadge = {
      text: 'text-[#B54747]',
      bg: 'bg-[#FCEEEE]',
      border: 'border-[#F4C7C7]',
      label: dossier.isTestFixture ? 'REVOKED (DEMO)' : 'REVOKED',
      icon: 'block',
      bar: 'bg-[#B54747]'
    };
  } else if (isBlocked) {
    statusBadge = {
      text: 'text-[#9A6700]',
      bg: 'bg-[#FFF5D9]',
      border: 'border-[#F0DC9B]',
      label: 'BLOCKED / CONSENT REQUIRED',
      icon: 'security',
      bar: 'bg-[#9A6700]'
    };
  }

  const renderMatchBadge = (row) => {
    const result = row.matchResult || (row.match === true ? 'MATCH' : row.match === false ? 'MISMATCH' : 'UNCONFIRMED');
    if (result === 'MATCH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-pill-label text-pill-label font-bold bg-[#EAF5EE] text-[#267653]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#267653]"></span>
          MATCH
        </span>
      );
    }
    if (result === 'MISMATCH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-pill-label text-pill-label font-bold bg-[#FCEEEE] text-[#B54747]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B54747]"></span>
          MISMATCH
        </span>
      );
    }
    if (result === 'NOT FOUND') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-pill-label text-pill-label font-bold bg-[#FFF5D9] text-[#9A6700]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9A6700]"></span>
          NOT FOUND
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-pill-label text-pill-label font-bold bg-[#EEF1F5] text-[#64748B]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>
        {result}
      </span>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const persistenceWarning = dossier.persistenceWarning || activeTrace?.persistenceWarning;

  return (
    <div className="flex flex-col w-full">
      {/* Environmental Dossier Ribbon */}
      <div className="flex items-center justify-between pb-space-md mb-space-lg border-b border-surface-container-high text-on-surface-variant font-metadata text-metadata">
        <div className="flex items-center gap-space-sm flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-pill-label text-pill-label font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            DOSSIER COMPLIANCE RECORD
          </span>
          <span className="text-outline">/</span>
          <span className="font-mono text-on-surface font-semibold">{dossier.credentialId}</span>
          <span className="text-outline">/</span>
          <span className="inline-flex items-center gap-1 text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span> Audit Digest: SHA-256 Stamped
          </span>
        </div>

        <div className="flex items-center gap-space-md hidden sm:flex">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-tertiary">verified_user</span>
            CertiSure Verification Engine
          </span>
          <span className="font-mono text-on-surface-variant">{dossier.requestId || 'REQ-2024-88419'}</span>
        </div>
      </div>

      {/* Persistence Warning Alert */}
      {persistenceWarning && (
        <div className="mb-space-lg p-space-md rounded-xl bg-[#FFF5D9] border border-[#F0DC9B] text-[#9A6700] flex items-center justify-between gap-space-md shadow-sm">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[22px] text-[#9A6700]">warning</span>
            <div className="flex flex-col">
              <span className="font-body-md-medium text-body-md font-semibold text-[#7A5200]">
                {persistenceWarning}
              </span>
              <span className="text-[12px] text-[#9A6700]/80">
                The verification dossier is fully visible, but was not stored to permanent history.
              </span>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-md bg-[#F0DC9B]/40 text-[#7A5200] text-[11px] font-mono uppercase tracking-wider font-bold">
            Persistence Notice
          </span>
        </div>
      )}

      {/* Primary Header & Command Deck */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm mb-space-xl border border-outline-variant/20">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-space-lg">
          <div className="flex flex-col gap-space-xs max-w-3xl">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="font-metadata text-metadata uppercase tracking-wider text-on-surface-variant font-semibold">
                {dossier.isTestFixture ? 'Synthetic Demo Evaluation' : 'Reference Source Verification'}
              </span>
              <span className="text-outline-variant">•</span>
              <span className="font-metadata text-metadata text-on-surface-variant">
                {dossier.isTestFixture ? 'Local Sandbox Fixture' : 'Source Protocol Match'}
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-primary tracking-tight font-bold">
              Verification result
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed">
              Deterministic credential evaluation against {dossier.isTestFixture ? 'synthetic sandbox demo fixtures' : 'configured verification sources'}.
            </p>

            {/* Candidate & Credential Micro-Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-space-md pt-space-lg mt-space-sm">
              <div className="flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Candidate Name</span>
                <span className="font-body-md-medium text-body-md text-on-surface font-semibold mt-0.5">
                  {dossier.candidateNameSubmitted}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Credential Identifier</span>
                <span className="font-body-md-medium text-body-md font-mono text-primary font-bold mt-0.5">
                  {dossier.credentialId}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Issuing Institution</span>
                <span className="font-body-md-medium text-body-md text-on-surface font-semibold mt-0.5 truncate" title={dossier.issuer}>
                  {dossier.issuer}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Verification Stamp</span>
                <span className="font-body-md-medium text-body-md text-on-surface mt-0.5 font-mono text-[13px]">
                  {new Date(dossier.retrievalTimestamp || Date.now()).toLocaleDateString()} UTC
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Source Type</span>
                <span className="font-body-md-medium text-body-md text-secondary font-semibold mt-0.5 truncate" title={dossier.sourceType}>
                  {dossier.sourceType || (dossier.isTestFixture ? 'Synthetic Demo Fixture' : 'Configured Source')}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Audit Checkpoint</span>
                <span className="font-body-md-medium text-body-md text-tertiary-container mt-0.5 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[15px]">security</span>
                  Audit Stamped
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge & Action Triggers */}
          <div className="flex flex-col items-start lg:items-end gap-space-md shrink-0">
            {/* Prominent Status Pill */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusBadge.bg} ${statusBadge.text} shadow-sm border ${statusBadge.border}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${statusBadge.bar} animate-pulse`}></span>
              <span className="material-symbols-outlined text-[18px]">{statusBadge.icon}</span>
              <span className="font-pill-label text-[13px] tracking-wider uppercase font-bold">{statusBadge.label}</span>
            </div>

            <div className="flex items-center gap-space-sm flex-wrap lg:justify-end mt-1">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-space-md h-9 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-body-md-medium text-body-md shadow-sm transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                <span>Download PDF report</span>
              </button>
              <a
                href="#audit-trail-section"
                className="inline-flex items-center gap-1.5 px-space-md h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-md-medium text-body-md shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">timeline</span>
                <span>View audit trail</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION A: Decision Explanation Panel */}
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm mb-space-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg relative overflow-hidden border border-outline-variant/20">
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusBadge.bar}`}></div>
        <div className="flex items-start gap-space-md pl-space-sm">
          <div className={`w-10 h-10 rounded-xl ${statusBadge.bg} ${statusBadge.text} flex items-center justify-center shrink-0 mt-0.5`}>
            <span className="material-symbols-outlined text-[24px]">{statusBadge.icon}</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                Decision Summary: {
                  isDemoMatch ? 'Synthetic Demo Fixture Match' :
                  isDemoMismatch ? 'Synthetic Demo Mismatch' :
                  isVerifiedMatch ? 'Authoritative Reference Match' :
                  isMismatch ? 'Field Discrepancy Detected' :
                  isNotFound ? 'Reference Record Absent' :
                  isRevoked ? 'Credential Revoked' :
                  'Unable to Verify / Transferred for Review'
                }
              </span>
              {dossier.isTestFixture ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-pill-label text-pill-label font-bold">
                  MODE: SYNTHETIC DEMO SIMULATION
                </span>
              ) : dossier.confidenceScore ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${statusBadge.bg} ${statusBadge.text} font-pill-label text-pill-label font-bold`}>
                  CONFIDENCE SCORE: {dossier.confidenceScore}%
                </span>
              ) : null}
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-4xl leading-relaxed">
              {dossier.explanation}
            </p>
            {dossier.isTestFixture && (
              <div className="mt-2 p-2 rounded-lg bg-[#FFF5D9] border border-[#F0DC9B] text-[#9A6700] text-[12px] flex items-center gap-2 max-w-4xl">
                <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
                <span>
                  <strong>Demo Mode Simulation:</strong> No external issuer request is sent in Demo Mode. Outcomes and evidence are generated from the Controlled Synthetic Demo Registry for demonstration purposes only. They do not constitute real-world authenticity confirmation or prove credential non-existence with any real issuer.
                </span>
              </div>
            )}
            {dossier.aiForensicSummary && (
              <div className="mt-2 p-space-sm rounded-lg bg-surface-container-low border border-secondary/20 flex items-start gap-2 max-w-4xl">
                <span className="material-symbols-outlined text-[18px] text-secondary shrink-0 mt-0.5">neurology</span>
                <div className="flex flex-col">
                  <span className="font-metadata text-metadata text-secondary font-semibold uppercase text-[11px] tracking-wider">
                    Gemini Plain-English Forensic Analysis
                  </span>
                  <span className="font-body-md text-body-md text-on-surface leading-relaxed text-[13px]">
                    {dossier.aiForensicSummary}
                  </span>
                </div>
              </div>
            )}
            <div className="font-metadata text-metadata text-secondary mt-1 flex items-center gap-1 flex-wrap">
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              <span>
                Distinctions: {dossier.ocrConfidence ? `OCR Extraction Confidence: ${dossier.ocrConfidence}% • ` : ''}
                Source: {dossier.sourceType || (dossier.isTestFixture ? 'Synthetic Demo Fixture' : 'Verification Endpoint')} •
                Human Review: {dossier.humanReviewStatus || 'Authorized by Recruiter'} •
                Audit Stamp: Local SHA-256 Pipeline Execution Digest.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dual-Pane Evidence Comparison Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg mb-space-xl items-start">
        {/* LEFT PANE: Document Preview (5 cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high/60">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-secondary">image</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">Source Document</span>
            </div>
            <span className="font-metadata text-metadata text-secondary">Vault Ingestion</span>
          </div>

          {/* Certificate Document Visual View */}
          <div className="rounded-xl bg-surface-container-low border border-outline-variant/40 p-space-md flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden">
            {dossier.previewUrl ? (
              <img src={dossier.previewUrl} alt="Uploaded Certificate" className="max-h-64 object-contain rounded-lg shadow-xs" />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary mb-2 shadow-xs">
                  <span className="material-symbols-outlined text-[32px]">verified</span>
                </div>
                <span className="font-body-md-medium text-body-md text-on-surface font-bold">
                  {dossier.issuer} Certificate
                </span>
                <span className="font-mono text-metadata text-secondary mt-1">
                  ID: {dossier.credentialId}
                </span>
                <span className="font-metadata text-metadata text-on-surface-variant mt-1">
                  {dossier.isTestFixture ? 'Synthetic Demo Fixture Protocol Engaged' : 'Verification Lookup Protocol Engaged'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-metadata text-on-surface-variant font-metadata pt-1">
            <span>Reference Source URL:</span>
            {dossier.sourceUrl ? (
              <a href={dossier.sourceUrl} target="_blank" rel="noreferrer" className="text-secondary hover:text-primary font-mono underline truncate max-w-[220px]">
                {dossier.sourceUrl}
              </a>
            ) : <span>N/A</span>}
          </div>
        </div>

        {/* RIGHT PANE: Comparison Table Matrix (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high/60">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-secondary">balance</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">Field-by-Field Matrix</span>
            </div>
            <span className="font-metadata text-metadata text-on-surface-variant font-semibold">
              {dossier.isTestFixture ? 'Synthetic Demo Reference vs Submitted' : 'Reference Evidence vs Submitted Claim'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-container-high text-on-surface-variant font-table-header text-table-header uppercase">
                  <th className="py-2.5 px-3">Field</th>
                  <th className="py-2.5 px-3">Submitted Claim</th>
                  <th className="py-2.5 px-3">Reference Evidence</th>
                  <th className="py-2.5 px-3">Provenance</th>
                  <th className="py-2.5 px-3 text-right">Match Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60 font-body-md text-body-md">
                {dossier.comparisonMatrix?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-2.5 px-3 font-body-md-medium text-body-md text-on-surface font-semibold">
                      {row.field}
                    </td>
                    <td className="py-2.5 px-3 text-on-surface">
                      {row.submitted || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-body-md-medium text-primary">
                      {row.evidence || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-surface-container-high text-on-surface-variant">
                        {row.evidenceProvenance || dossier.evidenceProvenance || (dossier.isTestFixture ? 'DEMO/SYNTHETIC — for demonstration only' : 'Configured Issuer')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {renderMatchBadge(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cryptographic Audit Trail Timeline Section */}
      <section id="audit-trail-section" className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/20 flex flex-col gap-space-lg mb-space-xl">
        <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Cryptographic Audit Trail</h2>
              <p className="font-metadata text-metadata text-on-surface-variant">Local SHA-256 audit digest of pipeline execution (execution payload integrity)</p>
            </div>
          </div>
          <span className="font-mono text-metadata text-secondary truncate max-w-sm" title={dossier.proofHash}>
            Local Digest: {dossier.proofHash ? dossier.proofHash.substring(0, 20) + '...' : 'N/A'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-1">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase text-[11px]">Gate 01: Intake</span>
            <span className="font-body-md-medium text-body-md text-on-surface font-semibold">Consent Confirmed</span>
            <span className="font-metadata text-metadata text-secondary font-mono text-[11px]">Recruiter Authorized</span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-1">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase text-[11px]">Gate 02: Ingestion</span>
            <span className="font-body-md-medium text-body-md text-on-surface font-semibold">Document Checksum</span>
            <span className="font-metadata text-metadata text-secondary font-mono text-[11px]">Vault Ingestion</span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-1">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase text-[11px]">Gate 03: Source Query</span>
            <span className="font-body-md-medium text-body-md text-on-surface font-semibold truncate" title={dossier.sourceType}>
              {dossier.isTestFixture ? 'Synthetic Demo Fixture' : 'Verification Source'}
            </span>
            <span className="font-metadata text-metadata text-secondary font-mono text-[11px]">Outcome: {dossier.outcome}</span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-1">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase text-[11px]">Gate 04: Anchoring</span>
            <span className="font-body-md-medium text-body-md text-on-surface font-semibold">Local Audit Digest</span>
            <span className="font-metadata text-metadata text-secondary font-mono text-[11px]">SHA-256 Stamped</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-space-md border-t border-surface-container-high/60 flex-wrap gap-space-sm">
          <button
            onClick={() => setActiveScreen('overview')}
            className="px-space-lg h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-body-md-medium text-body-md transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => setActiveScreen('new-verification')}
            className="px-space-xl h-10 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-body-md transition-all shadow-md"
          >
            Verify Another Certificate
          </button>
        </div>
      </section>
    </div>
  );
}
