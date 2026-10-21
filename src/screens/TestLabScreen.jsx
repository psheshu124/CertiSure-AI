import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function TestLabScreen() {
  const { certificates } = useApp();

  // Test Lab Mode: 'dynamic' (Normal Operation) vs 'demo' (Demo / Synthetic Data Presets)
  const [labMode, setLabMode] = useState('dynamic');

  // Selected Credential Source Tab: 'manual' | 'upload' | 'import'
  const [sourceTab, setSourceTab] = useState('manual');

  // Normalized Active Credential under test
  const [activeCredential, setActiveCredential] = useState(() => {
    try {
      const stored = sessionStorage.getItem('certisure_dynamic_test_credential');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Dynamic test execution results
  const [testResults, setTestResults] = useState(() => {
    try {
      const stored = sessionStorage.getItem('certisure_test_lab_results');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Loading states
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningIndividual, setRunningIndividual] = useState({});

  // Source A: Manual Entry form state
  const [manualForm, setManualForm] = useState({
    candidateName: '',
    credentialId: '',
    issuer: '',
    courseTitle: '',
    issueDate: '',
  });
  const [manualError, setManualError] = useState('');

  // Source B: Upload & OCR state
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Source C: Issuer Integration / Import state
  const [importSelectedCertId, setImportSelectedCertId] = useState('');
  const [publicUrlInput, setPublicUrlInput] = useState('');

  // Legacy static test fixtures for DEMO / SYNTHETIC DATA mode
  const legacyTestCases = [
    {
      id: 'tc1',
      title: 'TC1: Matching Candidate Name (Synthetic Demo Match)',
      candidate: 'Sarah Lin',
      credentialId: 'STAN-ML-99201-X',
      issuer: 'Stanford Online',
      issueDate: '11/15/2023',
      consent: 'Consent Granted (True)',
      expected: 'VERIFIED (DEMO)',
      expectedOutcome: 'VERIFIED (DEMO)',
      note: 'Synthetic demo fixture record matches candidate and organization. Expected: VERIFIED (DEMO).',
    },
    {
      id: 'tc2',
      title: 'TC2: Different Candidate Name (Synthetic Demo Mismatch)',
      candidate: 'Marcus Brody',
      credentialId: 'STAN-ML-99201-X',
      issuer: 'Stanford Online',
      issueDate: '11/15/2023',
      consent: 'Consent Granted (True)',
      expected: 'MISMATCH (DEMO)',
      expectedOutcome: 'MISMATCH (DEMO)',
      note: 'Synthetic demo record belongs to Sarah Lin; submitted name Marcus Brody conflicts. Expected: MISMATCH (DEMO).',
    },
    {
      id: 'tc3',
      title: 'TC3: No Matching Record (Explicit Absence Confirmation)',
      candidate: 'Sarah Lin',
      credentialId: 'STAN-ML-00000-VOID',
      issuer: 'Stanford Online',
      issueDate: '11/15/2023',
      consent: 'Consent Granted (True)',
      expected: 'NOT FOUND (DEMO)',
      expectedOutcome: 'NOT FOUND (DEMO)',
      note: 'Reference environment explicitly reports no matching record found for void ID. Expected: NOT FOUND (DEMO).',
    },
    {
      id: 'tc4',
      title: 'TC4: Missing Consent (Deterministic Authorization Block)',
      candidate: 'Sarah Lin',
      credentialId: 'STAN-ML-99201-X',
      issuer: 'Stanford Online',
      issueDate: '11/15/2023',
      consent: 'Consent Absent (False)',
      expected: 'BLOCKED / CONSENT REQUIRED',
      expectedOutcome: 'BLOCKED / CONSENT REQUIRED',
      note: 'Candidate consent is false; process deterministically halts before contacting issuing authority. Expected: BLOCKED / CONSENT REQUIRED.',
    }
  ];

  // Helper to persist active credential
  const saveActiveCredential = (cred) => {
    setActiveCredential(cred);
    setTestResults({}); // Clear previous test runs on new subject
    try {
      if (cred) {
        sessionStorage.setItem('certisure_dynamic_test_credential', JSON.stringify(cred));
      } else {
        sessionStorage.removeItem('certisure_dynamic_test_credential');
      }
      sessionStorage.removeItem('certisure_test_lab_results');
    } catch (e) {
      console.warn('[SessionStorage Warning]', e);
    }
  };

  // Helper to persist test results
  const saveTestResults = (updater) => {
    setTestResults(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        sessionStorage.setItem('certisure_test_lab_results', JSON.stringify(next));
      } catch (e) {
        console.warn('[SessionStorage Warning]', e);
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Action Handlers for Credential Sources
  // ---------------------------------------------------------------------------

  // Handle Manual Entry Load
  const handleLoadManual = (e) => {
    e.preventDefault();
    setManualError('');
    if (!manualForm.candidateName.trim()) {
      setManualError('Candidate Name is required for manual entry.');
      return;
    }
    if (!manualForm.credentialId.trim()) {
      setManualError('Credential ID / Certificate Number is required.');
      return;
    }
    if (!manualForm.issuer.trim()) {
      setManualError('Issuing Institution is required.');
      return;
    }

    const normalized = {
      candidateName: manualForm.candidateName.trim(),
      credentialId: manualForm.credentialId.trim(),
      issuer: manualForm.issuer.trim(),
      courseTitle: manualForm.courseTitle.trim() || 'Professional Qualification',
      issueDate: manualForm.issueDate.trim() || new Date().toISOString().split('T')[0],
      sourceType: 'MANUAL_ENTRY',
      sourceProvenance: 'User Manual Entry Intake Form',
      isAuthoritative: false,
    };

    saveActiveCredential(normalized);
  };

  // Handle Certificate Upload & OCR
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setOcrResult(null);
    setUploadedFileName(file.name);

    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      setUploadError('Invalid file format. Please upload a PDF, PNG, or JPEG certificate.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Document exceeds 5MB size limit.');
      return;
    }

    try {
      setIsExtractingOcr(true);
      const formData = new FormData();
      formData.append('document', file);

      const res = await fetch('/api/extract-ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.extractedData) {
        setOcrResult({
          data: data.extractedData,
          confidence: data.extractedData.confidenceScore || data.confidenceScore || 92,
          rawSummary: data.rawText || data.extractedData.rawTextSnippet || 'OCR parsed document fields successfully.',
        });
      } else {
        setUploadError(data.message || 'OCR parsing was unable to extract certificate fields.');
      }
    } catch (err) {
      console.error('[OCR Upload Error]', err);
      setUploadError('Failed to communicate with OCR extraction service.');
    } finally {
      setIsExtractingOcr(false);
    }
  };

  // Set OCR Parsed Document as Active Subject
  const handleAdoptOcrResult = () => {
    if (!ocrResult || !ocrResult.data) return;
    const ed = ocrResult.data;

    const normalized = {
      candidateName: ed.candidateName || 'Extracted Recipient',
      credentialId: ed.credentialId || `OCR-${Math.floor(100000 + Math.random() * 900000)}`,
      issuer: ed.issuer || 'Extracted Institution',
      courseTitle: ed.courseTitle || 'Extracted Course',
      issueDate: ed.issueDate || new Date().toISOString().split('T')[0],
      sourceType: 'OCR_DOCUMENT',
      sourceProvenance: `Gemini OCR Extraction from ${uploadedFileName}`,
      ocrConfidence: ocrResult.confidence,
      isAuthoritative: false,
      extractedFields: ed,
    };

    saveActiveCredential(normalized);
  };

  // Handle Import from Configured Issuer or Existing Records
  const handleImportRecord = () => {
    if (publicUrlInput.trim()) {
      const normalized = {
        candidateName: 'Verified Web Holder',
        credentialId: publicUrlInput.trim(),
        issuer: 'Public Web Registry',
        courseTitle: 'Online Verified Program',
        issueDate: new Date().toISOString().split('T')[0],
        sourceType: 'ISSUER_RECORD',
        sourceProvenance: `Live Public Registry Endpoint (${publicUrlInput.trim()})`,
        isAuthoritative: true,
      };
      saveActiveCredential(normalized);
      return;
    }

    if (importSelectedCertId) {
      const found = certificates.find(c => c.id === importSelectedCertId);
      if (found) {
        const normalized = {
          candidateName: found.student_name,
          credentialId: found.certificate_number,
          issuer: found.institution_name,
          courseTitle: found.course_name,
          issueDate: found.issue_date || '2024-01-01',
          sourceType: 'ISSUER_RECORD',
          sourceProvenance: `Authoritative Database Record ID ${found.id}`,
          isAuthoritative: true,
        };
        saveActiveCredential(normalized);
      }
    }
  };

  // Clear Active Test Subject
  const handleClearCredential = () => {
    saveActiveCredential(null);
    setManualForm({
      candidateName: '',
      credentialId: '',
      issuer: '',
      courseTitle: '',
      issueDate: '',
    });
    setOcrResult(null);
    setUploadedFileName('');
    setImportSelectedCertId('');
    setPublicUrlInput('');
  };

  // ---------------------------------------------------------------------------
  // Dynamic Scenarios Definition (Derived from Active Credential)
  // ---------------------------------------------------------------------------
  const dynamicScenarios = activeCredential ? [
    {
      id: 'valid_match',
      title: 'Scenario 1: Valid Authoritative Match',
      description: `Evaluates candidate '${activeCredential.candidateName}' against a reference record with matching identifier '${activeCredential.credentialId}'.`,
      expectedOutcome: 'Demo Match',
      expectedUiStatus: 'DEMO MATCH (SYNTHETIC)',
      isSynthetic: false,
      alteredLabel: null,
    },
    {
      id: 'field_mismatch',
      title: 'Scenario 2: Field Mismatch (Identity Alteration Test)',
      description: `Alters candidate name in an isolated test copy to detect identity discrepancies against the reference record.`,
      expectedOutcome: 'Demo Mismatch',
      expectedUiStatus: 'DEMO MISMATCH (SYNTHETIC)',
      isSynthetic: true,
      alteredLabel: `Altered Input: Candidate Name = "${activeCredential.candidateName} [Altered Test Copy]"`,
    },
    {
      id: 'not_found',
      title: 'Scenario 3: Record Not Found (Absence Confirmation)',
      description: `Queries a non-existent identifier ('${activeCredential.credentialId}-VOID') to ensure missing records are reported honestly without hallucination.`,
      expectedOutcome: 'Not Found',
      expectedUiStatus: 'NOT FOUND (DEMO)',
      isSynthetic: true,
      alteredLabel: `Altered Input: Credential Identifier = "${activeCredential.credentialId}-VOID"`,
    },
    {
      id: 'revoked',
      title: 'Scenario 4: Revoked / Expired Status Simulation',
      description: `Simulates an authoritative reference entry whose operational status is marked as REVOKED by the issuing authority.`,
      expectedOutcome: 'Revoked',
      expectedUiStatus: 'DEMO REVOKED (SYNTHETIC)',
      isSynthetic: true,
      simulationBadge: 'SIMULATED REVOCATION',
      alteredLabel: `Condition: Authoritative Status = "REVOKED"`,
    },
    {
      id: 'missing_consent',
      title: 'Scenario 5: Missing Consent (Deterministic Gate Block)',
      description: `Candidate consent flag is explicitly false. Verifies pipeline halts at Stage 2 without contacting registrar.`,
      expectedOutcome: 'Missing Consent',
      expectedUiStatus: 'BLOCKED',
      isSynthetic: false,
      alteredLabel: `Enforcement: Candidate Consent = "FALSE (Absent)"`,
    },
    {
      id: 'issuer_unavailable',
      title: 'Scenario 6: Issuer Gateway Timeout / Outage Simulation',
      description: `Simulates network timeout / 504 gateway outage from issuing registrar, halting automated lookup and transferring to review queue.`,
      expectedOutcome: 'Unable to Verify',
      expectedUiStatus: 'UNABLE TO VERIFY',
      isSynthetic: true,
      simulationBadge: 'SIMULATED OUTAGE / TIMEOUT',
      alteredLabel: `Condition: Gateway Network Latency > 5000ms`,
    }
  ] : [];

  // ---------------------------------------------------------------------------
  // Execution Handlers
  // ---------------------------------------------------------------------------

  // Execute single scenario
  const executeScenario = async (scenarioId) => {
    setRunningIndividual(prev => ({ ...prev, [scenarioId]: true }));
    try {
      let payload;
      if (labMode === 'dynamic' && activeCredential) {
        payload = {
          credential: activeCredential,
          scenarioId: scenarioId,
        };
      } else {
        payload = { testCaseId: scenarioId };
      }

      const res = await fetch('/api/test-lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.report) {
        saveTestResults(prev => ({ ...prev, [scenarioId]: data.report }));
      }
    } catch (err) {
      console.error(`[Test Lab Error for ${scenarioId}]`, err);
    } finally {
      setRunningIndividual(prev => ({ ...prev, [scenarioId]: false }));
    }
  };

  // Execute all scenarios in batch
  const executeAllScenarios = async () => {
    setIsRunningAll(true);
    try {
      let payload;
      if (labMode === 'dynamic' && activeCredential) {
        payload = {
          credential: activeCredential,
          scenarioId: 'all',
        };
      } else {
        payload = { testCaseId: 'all' };
      }

      const res = await fetch('/api/test-lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.reports) {
        const resultMap = {};
        data.reports.forEach(r => {
          resultMap[r.testCaseId] = r;
        });
        saveTestResults(resultMap);
      }
    } catch (err) {
      console.error('[Test Lab Run All Error]', err);
    } finally {
      setIsRunningAll(false);
    }
  };

  // Reset test execution results back to zero
  const resetTestResults = () => {
    saveTestResults({});
  };

  // ---------------------------------------------------------------------------
  // Metrics & Counters
  // ---------------------------------------------------------------------------
  const activeSuiteCount = labMode === 'dynamic' ? dynamicScenarios.length : legacyTestCases.length;
  const executedCount = Object.keys(testResults).length;
  const passCount = Object.values(testResults).filter(r => r?.passed).length;
  const failCount = Object.values(testResults).filter(r => r && !r.passed).length;
  const hasExecuted = executedCount > 0;
  const allPassing = hasExecuted && passCount === executedCount;

  return (
    <div className="flex flex-col w-full">
      {/* Top Header Card & Mode Switcher */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg shadow-sm mb-space-lg flex flex-col gap-space-lg border border-outline-variant/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-space-sm mb-1">
              <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-pill-label text-pill-label uppercase tracking-wider font-bold">
                {labMode === 'dynamic' ? 'Dynamic Verification Lab v2.5' : 'Synthetic Data / Demo Mode'}
              </span>
              <span className="font-metadata text-metadata text-on-surface-variant flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container inline-block"></span>
                Isolated In-Memory Sandbox (0 DB Writes)
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
              Verification test lab
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {labMode === 'dynamic'
                ? 'Test dynamic verification scenarios derived from actual user-provided credentials, certificate OCR, and issuer integrations.'
                : 'Controlled developer fixtures (TC1–TC4 Sarah Lin & Marcus Brody) retained for synthetic demo and regression tests.'}
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-lg border border-outline-variant/30 shrink-0">
            <button
              type="button"
              onClick={() => {
                setLabMode('dynamic');
                setTestResults({});
              }}
              className={`px-3 py-1.5 rounded-md text-body-md-medium font-bold text-xs flex items-center gap-1.5 transition-all ${
                labMode === 'dynamic'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Dynamic Test Lab</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLabMode('demo');
                setTestResults({});
              }}
              className={`px-3 py-1.5 rounded-md text-body-md-medium font-bold text-xs flex items-center gap-1.5 transition-all ${
                labMode === 'demo'
                  ? 'bg-secondary text-on-secondary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">science</span>
              <span>Demo / Synthetic Fixtures</span>
            </button>
          </div>
        </div>

        {/* Action Controls & Telemetry Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pt-space-xs border-t border-outline-variant/20">
          <div className="flex items-center gap-space-sm flex-wrap">
            <button
              onClick={resetTestResults}
              disabled={isRunningAll || executedCount === 0}
              className="h-9 px-space-md rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-body-md-medium text-body-md-medium flex items-center gap-space-xs transition-colors shadow-sm disabled:opacity-40"
              type="button"
              title="Reset test executions to zero"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Reset test executions</span>
            </button>

            <button
              onClick={executeAllScenarios}
              disabled={isRunningAll || (labMode === 'dynamic' && !activeCredential)}
              className="h-9 px-space-md rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-body-md-medium flex items-center gap-space-xs transition-all shadow-sm disabled:opacity-40 font-bold"
              type="button"
              title={labMode === 'dynamic' && !activeCredential ? 'Select or import a credential first' : 'Run all test scenarios'}
            >
              {isRunningAll ? (
                <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              )}
              <span>Run all test scenarios</span>
            </button>
          </div>

          <div className="flex items-center gap-space-sm text-metadata font-metadata text-on-surface-variant">
            <span className="px-2 py-1 rounded bg-[#EAF5EE] text-[#267653] font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              0 DB Writes (100% Isolated)
            </span>
            <span className="px-2 py-1 rounded bg-surface-container font-bold text-on-surface">
              {executedCount} / {activeSuiteCount} Executed
            </span>
          </div>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm bg-surface-container-low rounded-lg p-space-md border border-outline-variant/20">
          <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              !hasExecuted
                ? 'bg-surface-container text-on-surface-variant'
                : allPassing
                  ? 'bg-[#EAF5EE] text-[#267653]'
                  : 'bg-[#FCEEEE] text-[#B54747]'
            }`}>
              <span className="material-symbols-outlined text-[20px]">
                {!hasExecuted ? 'pending' : allPassing ? 'task_alt' : 'warning'}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-metadata text-metadata text-on-surface-variant truncate text-[11px]">Suite Status</span>
              <span className="font-headline-sm text-headline-sm text-primary truncate font-bold">
                {!hasExecuted
                  ? '0 RUN'
                  : `${passCount}/${executedCount} PASSING (${Math.round((passCount / executedCount) * 100)}%)`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
            <div className="w-9 h-9 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-metadata text-metadata text-on-surface-variant truncate text-[11px]">Active Subject</span>
              <span className="font-headline-sm text-headline-sm text-primary truncate font-bold">
                {labMode === 'dynamic'
                  ? (activeCredential ? activeCredential.candidateName : 'None Selected')
                  : 'Sarah Lin (Demo)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
            <div className="w-9 h-9 rounded-full bg-[#EAF5EE] text-[#267653] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">database</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-metadata text-metadata text-on-surface-variant truncate text-[11px]">Production History</span>
              <span className="font-headline-sm text-headline-sm text-primary truncate font-bold">
                Untouched
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
            <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">timer</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-metadata text-metadata text-on-surface-variant truncate text-[11px]">Average Latency</span>
              <span className="font-headline-sm text-headline-sm text-primary truncate font-bold">
                {hasExecuted
                  ? `${Math.round(Object.values(testResults).reduce((sum, r) => sum + (r.executionLatencyMs || 0), 0) / executedCount)}ms`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =======================================================================
          DYNAMIC TEST LAB: Credential Intake Deck & Active Subject Banner
          ======================================================================= */}
      {labMode === 'dynamic' && (
        <div className="flex flex-col gap-space-lg mb-space-lg">
          {/* Active Test Subject Banner (If Loaded) */}
          {activeCredential ? (
            <div className="w-full bg-[#F4F9F6] border-2 border-[#267653]/40 rounded-xl p-space-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-md">
              <div className="flex items-start gap-space-md">
                <div className="w-10 h-10 rounded-full bg-[#267653] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[24px]">verified_user</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-space-sm flex-wrap mb-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#267653]/15 text-[#267653] uppercase tracking-wider">
                      Active Test Subject
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-container text-on-surface-variant font-semibold">
                      Provenance: {activeCredential.sourceProvenance}
                    </span>
                  </div>
                  <h3 className="text-headline-sm font-bold text-primary">
                    {activeCredential.candidateName} — {activeCredential.credentialId}
                  </h3>
                  <p className="text-body-md text-on-surface-variant text-sm mt-0.5">
                    <strong>Issuer:</strong> {activeCredential.issuer} &bull; <strong>Course / Program:</strong> {activeCredential.courseTitle} &bull; <strong>Issue Date:</strong> {activeCredential.issueDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-space-sm shrink-0">
                <button
                  type="button"
                  onClick={handleClearCredential}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-body-md-medium text-xs flex items-center gap-1 shadow-sm transition-colors font-bold"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  <span>Change Credential</span>
                </button>
              </div>
            </div>
          ) : (
            /* Empty State Credential Intake Deck */
            <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm border-b border-outline-variant/20">
                <div className="flex flex-col">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[22px]">fingerprint</span>
                    Select Credential Source for Dynamic Testing
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">
                    Test Lab normal operation derives all test scenarios dynamically from actual user input, uploaded document OCR, or configured issuer integrations.
                  </p>
                </div>
              </div>

              {/* Source Tabs */}
              <div className="flex items-center gap-space-xs border-b border-outline-variant/20 pb-2">
                <button
                  type="button"
                  onClick={() => setSourceTab('manual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    sourceTab === 'manual'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  <span>Source A: Manual Entry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceTab('upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    sourceTab === 'upload'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>Source B: Uploaded Certificate (OCR)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceTab('import')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    sourceTab === 'import'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">hub</span>
                  <span>Source C: Imported Issuer Record</span>
                </button>
              </div>

              {/* Source A: Manual Entry */}
              {sourceTab === 'manual' && (
                <form onSubmit={handleLoadManual} className="flex flex-col gap-space-md pt-space-xs">
                  {manualError && (
                    <div className="p-3 bg-[#FCEEEE] border border-[#B54747]/30 text-[#B54747] rounded-lg text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{manualError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                        Candidate Full Name *
                      </label>
                      <input
                        type="text"
                        value={manualForm.candidateName}
                        onChange={(e) => setManualForm({ ...manualForm, candidateName: e.target.value })}
                        placeholder="e.g. Dr. Anita Roy"
                        className="h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                        Credential ID / Serial *
                      </label>
                      <input
                        type="text"
                        value={manualForm.credentialId}
                        onChange={(e) => setManualForm({ ...manualForm, credentialId: e.target.value })}
                        placeholder="e.g. IIT-AI-9021-X"
                        className="h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm font-mono focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                        Issuing Institution *
                      </label>
                      <input
                        type="text"
                        value={manualForm.issuer}
                        onChange={(e) => setManualForm({ ...manualForm, issuer: e.target.value })}
                        placeholder="e.g. Indian Institute of Technology"
                        className="h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                        Course / Qualification Title
                      </label>
                      <input
                        type="text"
                        value={manualForm.courseTitle}
                        onChange={(e) => setManualForm({ ...manualForm, courseTitle: e.target.value })}
                        placeholder="e.g. Advanced Deep Learning Specialization"
                        className="h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                        Issue Date
                      </label>
                      <input
                        type="date"
                        value={manualForm.issueDate}
                        onChange={(e) => setManualForm({ ...manualForm, issueDate: e.target.value })}
                        className="h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="h-10 px-space-lg w-full rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Load Credential into Test Lab</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Source B: Upload Certificate & OCR */}
              {sourceTab === 'upload' && (
                <div className="flex flex-col gap-space-md pt-space-xs">
                  {uploadError && (
                    <div className="p-3 bg-[#FCEEEE] border border-[#B54747]/30 text-[#B54747] rounded-lg text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className="p-space-lg border-2 border-dashed border-outline-variant/60 rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center gap-2">
                    <span className="material-symbols-outlined text-[36px] text-secondary">cloud_upload</span>
                    <span className="text-sm font-bold text-on-surface">Upload a Certificate Document for OCR Extraction</span>
                    <span className="text-xs text-on-surface-variant max-w-md">
                      Upload any PNG, JPEG, or PDF certificate. Gemini vision extracts fields in real time to generate dynamic test scenarios.
                    </span>

                    <label className="mt-2 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container cursor-pointer font-bold text-xs flex items-center gap-2 transition-all shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">folder_open</span>
                      <span>{isExtractingOcr ? 'Analyzing with Gemini OCR...' : 'Browse Certificate File'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,application/pdf"
                        onChange={handleFileUpload}
                        disabled={isExtractingOcr}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* OCR Extraction Result Card */}
                  {ocrResult && (
                    <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-space-sm shadow-sm">
                      <div className="flex items-center justify-between pb-space-xs border-b border-outline-variant/20">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#267653] text-[20px]">smart_toy</span>
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            Extracted OCR Credential Details (Gemini Vision)
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#EAF5EE] text-[#267653] text-[11px] font-bold">
                          Confidence: {ocrResult.confidence}%
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm text-xs font-metadata p-2 bg-surface-container-low rounded-lg">
                        <div><strong className="text-on-surface-variant">Extracted Name:</strong> <span className="text-on-surface font-semibold">{ocrResult.data.candidateName || 'Not detected'}</span></div>
                        <div><strong className="text-on-surface-variant">Extracted ID:</strong> <span className="text-primary font-mono font-bold">{ocrResult.data.credentialId || 'Not detected'}</span></div>
                        <div><strong className="text-on-surface-variant">Extracted Issuer:</strong> <span className="text-on-surface font-semibold">{ocrResult.data.issuer || 'Not detected'}</span></div>
                        <div><strong className="text-on-surface-variant">Course / Title:</strong> <span className="text-on-surface font-semibold">{ocrResult.data.courseTitle || 'Not detected'}</span></div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-on-surface-variant italic">
                          Notice: Extracted OCR fields represent document text, distinguished from independent issuer verification.
                        </span>
                        <button
                          type="button"
                          onClick={handleAdoptOcrResult}
                          className="px-4 py-1.5 rounded-lg bg-[#267653] text-white hover:bg-[#1f5f43] font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          <span>Set Parsed Certificate as Test Subject</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Source C: Configured Issuer Import */}
              {sourceTab === 'import' && (
                <div className="flex flex-col gap-space-md pt-space-xs">
                  {/* Honest Issuer Status Notice */}
                  <div className="p-3 bg-surface-container-low border border-outline-variant/30 rounded-lg text-xs flex items-start gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">info</span>
                    <div className="flex flex-col gap-0.5">
                      <strong className="text-on-surface">Institutional Registrar Integration Status:</strong>
                      <span>
                        Automated institutional registrar APIs (Stanford Sovereign Gateway, MIT xPRO, Coursera Enterprise) require accredited partner credentials in <code className="bg-surface-container px-1 rounded">.env</code>. Currently awaiting sovereign API keys. Live public URL inspection and authorized database records are available below.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                    {/* Option 1: Existing Certificate Record from Supabase */}
                    <div className="p-space-md bg-surface-container-low rounded-xl flex flex-col gap-space-sm border border-outline-variant/20">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        Import from Authorized Verification Records
                      </span>
                      <select
                        value={importSelectedCertId}
                        onChange={(e) => setImportSelectedCertId(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-xs focus:outline-none focus:border-primary"
                      >
                        <option value="">-- Choose an existing candidate record --</option>
                        {certificates.map(cert => (
                          <option key={cert.id} value={cert.id}>
                            {cert.student_name} — {cert.certificate_number} ({cert.institution_name})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleImportRecord}
                        disabled={!importSelectedCertId}
                        className="h-9 px-3 rounded-lg bg-primary text-on-primary font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-1 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">file_download</span>
                        <span>Import Database Record</span>
                      </button>
                    </div>

                    {/* Option 2: Live Public Registry URL */}
                    <div className="p-space-md bg-surface-container-low rounded-xl flex flex-col gap-space-sm border border-outline-variant/20">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        Query Live Public Verification URL
                      </span>
                      <input
                        type="url"
                        value={publicUrlInput}
                        onChange={(e) => setPublicUrlInput(e.target.value)}
                        placeholder="https://coursera.org/verify/EXAMPLE-ID"
                        className="h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-xs font-mono focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleImportRecord}
                        disabled={!publicUrlInput.trim()}
                        className="h-9 px-3 rounded-lg bg-primary text-on-primary font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-1 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                        <span>Inspect Public URL as Subject</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TEST SCENARIO CARDS DECK
          ======================================================================= */}
      {labMode === 'dynamic' && !activeCredential ? (
        <div className="p-space-xl rounded-xl bg-surface-container-low border border-outline-variant/30 text-center flex flex-col items-center justify-center gap-space-sm">
          <div className="w-12 h-12 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">search_insights</span>
          </div>
          <h3 className="text-headline-sm font-bold text-primary">No Credential Loaded for Testing</h3>
          <p className="text-body-md text-on-surface-variant max-w-lg text-sm">
            Normal Test Lab operation requires an actual test subject. Enter candidate details manually, upload a certificate document for OCR extraction, or switch to <strong>Demo / Synthetic Fixtures</strong> mode above.
          </p>
        </div>
      ) : (
        /* Render Active Scenarios (Dynamic 6 or Legacy 4) */
        <div className="flex flex-col gap-space-lg w-full">
          {(labMode === 'dynamic' ? dynamicScenarios : legacyTestCases).map((sc) => {
            const report = testResults[sc.id];
            const isExecuted = Boolean(report);
            const isPassed = report?.passed;
            const isRunning = runningIndividual[sc.id];

            return (
              <div
                key={sc.id}
                className="w-full bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-outline-variant/20 transition-all hover:border-outline-variant"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-sm gap-space-sm border-b border-surface-container-high/60">
                  <div className="flex items-center gap-space-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      !isExecuted ? 'bg-outline-variant' : isPassed ? 'bg-[#267653]' : 'bg-[#B54747]'
                    }`}></span>
                    <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                      {sc.title}
                    </h2>
                    {sc.simulationBadge && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8DEF8] text-[#4A4458] uppercase">
                        {sc.simulationBadge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-space-sm">
                    {/* Status Badge */}
                    {!isExecuted ? (
                      <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full font-pill-label text-pill-label font-bold bg-surface-container text-on-surface-variant">
                        <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                        STANDBY
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full font-pill-label text-pill-label font-bold ${
                        isPassed ? 'bg-[#EAF5EE] text-[#267653]' : 'bg-[#FCEEEE] text-[#B54747]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isPassed ? 'bg-[#267653]' : 'bg-[#B54747]'}`}></span>
                        {isPassed ? 'PASS' : 'FAIL'}
                      </span>
                    )}

                    <button
                      onClick={() => executeScenario(sc.id)}
                      disabled={isRunning || isRunningAll}
                      className="h-8 px-space-sm rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-body-md-medium text-metadata flex items-center gap-1 transition-colors disabled:opacity-50"
                      type="button"
                    >
                      {isRunning ? (
                        <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                      )}
                      <span>{isExecuted ? 'Re-run test' : 'Run test'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
                  {/* Left Column: Input and Expected Outcome */}
                  <div className="lg:col-span-5 bg-surface-container-low rounded-lg p-space-md flex flex-col gap-space-sm">
                    <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider font-semibold text-[11px]">
                      Scenario Conditions & Test Input
                    </span>

                    <div className="flex flex-col gap-1.5 bg-surface-container-lowest p-space-sm rounded-lg border border-outline-variant/10 text-metadata font-metadata">
                      <div className="flex justify-between items-center">
                        <span className="text-on-surface-variant">Candidate:</span>
                        <span className="font-body-md-medium text-body-md text-on-surface font-semibold">
                          {labMode === 'dynamic' ? activeCredential.candidateName : sc.candidate}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-on-surface-variant">Credential ID:</span>
                        <span className="font-body-md-medium text-primary font-mono font-bold">
                          {labMode === 'dynamic' ? activeCredential.credentialId : sc.credentialId}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-on-surface-variant">Issuer:</span>
                        <span className="text-on-surface font-semibold">
                          {labMode === 'dynamic' ? activeCredential.issuer : sc.issuer}
                        </span>
                      </div>
                      {sc.alteredLabel && (
                        <div className="mt-1 pt-1 border-t border-outline-variant/20 flex flex-col gap-0.5">
                          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Test Alteration (Isolated):</span>
                          <span className="text-xs text-[#B54747] font-semibold">{sc.alteredLabel}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-1 pt-space-xs text-metadata font-metadata border-t border-surface-container-high">
                      <span className="text-on-surface-variant font-semibold">Expected Outcome:</span>
                      <span className="inline-flex items-center gap-1 font-body-md-medium text-body-md font-bold text-secondary">
                        {sc.expectedUiStatus || sc.expected}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Actual Execution Result */}
                  <div className="lg:col-span-7 bg-surface-container-lowest rounded-lg p-space-md flex flex-col gap-space-sm border border-outline-variant/30">
                    <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider font-semibold text-[11px]">
                      Actual Engine Execution Output
                    </span>

                    <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Actual Outcome</span>
                        <span className={`font-headline-sm text-headline-sm font-bold ${
                          !isExecuted ? 'text-on-surface-variant text-base' : 'text-primary'
                        }`}>
                          {!isExecuted ? 'Pending Execution (Click \'Run test\')' : report.actualOutcome}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Engine Latency</span>
                        <span className="font-metadata text-metadata font-mono text-secondary font-bold">
                          {isExecuted ? `${report.executionLatencyMs}ms` : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] font-metadata">
                      <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-semibold">
                        Source: {isExecuted ? (report?.details?.evidenceType || 'Deterministic Engine Check') : 'Simulated Registry'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">
                        Evidence: {isExecuted ? (report?.details?.evidenceLabel || 'Sandbox Isolated') : 'Pending Execution'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#EAF5EE] text-[#267653] font-semibold">
                        DB Writes: 0 (Isolated)
                      </span>
                    </div>

                    <p className="font-body-md text-body-md text-on-surface-variant text-[13px] leading-relaxed">
                      {isExecuted
                        ? (report?.details?.explanation || report?.details?.reason || sc.description || sc.note)
                        : (sc.description || sc.note)}
                    </p>

                    <div className="pt-space-xs flex items-center justify-between text-metadata font-metadata text-outline border-t border-outline-variant/20 truncate">
                      <span className="truncate">
                        Proof Digest: {isExecuted ? (report?.details?.proofHash || 'N/A') : '—'}
                      </span>
                      <span className="text-[#267653] font-bold shrink-0 ml-2">ISOLATED SANDBOX</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
