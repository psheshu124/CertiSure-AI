import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { uploadCertificateDocument } from '../lib/supabase.js';

export default function NewVerificationScreen() {
  const { setActiveScreen, setCurrentVerification, user, authSession, serverHealth } = useApp();

  // Active Intake Method: 'manual' | 'upload' | 'issuer'
  const [intakeMethod, setIntakeMethod] = useState('manual');

  // Form State (empty by default; explicit real intake required)
  const [candidateName, setCandidateName] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [issuer, setIssuer] = useState('');
  const [publicVerificationUrl, setPublicVerificationUrl] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);

  // File Upload & OCR State
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [extractingAI, setExtractingAI] = useState(false);
  const [aiExtractedFields, setAiExtractedFields] = useState(null);
  const [ocrConfidenceScore, setOcrConfidenceScore] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Configured Adapters Registry State
  const [adapters, setAdapters] = useState([]);
  const [selectedAdapterId, setSelectedAdapterId] = useState('');
  const [loadingAdapters, setLoadingAdapters] = useState(false);

  // Enterprise Settings
  const [operatingMode, setOperatingMode] = useState('demo');
  const [ocrConfidenceThreshold, setOcrConfidenceThreshold] = useState(85);
  const [activeSandboxFixture, setActiveSandboxFixture] = useState(null);

  // Load Enterprise Settings & Adapters
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        setLoadingAdapters(true);
        const [settingsRes, adaptersRes] = await Promise.all([
          fetch('/api/settings').then(r => r.json()).catch(() => null),
          fetch('/api/adapters').then(r => r.json()).catch(() => null)
        ]);

        if (isMounted) {
          if (settingsRes?.success && settingsRes.settings) {
            setOperatingMode(settingsRes.settings.operatingMode || 'demo');
            setOcrConfidenceThreshold(settingsRes.settings.ocrConfidenceThreshold || 85);
          }
          if (adaptersRes?.success && Array.isArray(adaptersRes.adapters)) {
            setAdapters(adaptersRes.adapters);
          }
        }
      } catch (err) {
        console.warn('[NewVerificationScreen] Init warning:', err);
      } finally {
        if (isMounted) setLoadingAdapters(false);
      }
    }
    init();
    return () => { isMounted = false; };
  }, []);

  // Clear all fields and return to blank intake form
  const clearForm = () => {
    setCandidateName('');
    setCourseTitle('');
    setIssueDate('');
    setCredentialId('');
    setIssuer('');
    setPublicVerificationUrl('');
    setConsentGranted(false);
    setUploadedFile(null);
    setUploadPreview(null);
    setAiExtractedFields(null);
    setOcrConfidenceScore(null);
    setValidationError('');
    setSelectedAdapterId('');
    setActiveSandboxFixture(null);
  };

  // Optional Sandbox Demo Sample Loader (strictly in Demo mode, clearly labeled)
  const loadSandboxSample = (sampleType) => {
    setActiveSandboxFixture(sampleType);
    setValidationError('');
    setConsentGranted(false); // Never auto-grant consent

    if (sampleType === 'demo1') {
      setCandidateName('Aanya Rao');
      setCredentialId('DEMO-CERT-1001');
      setIssuer('CertiSure Demo University');
      setCourseTitle('Introduction to Artificial Intelligence');
      setIssueDate('2026-06-15');
      setPublicVerificationUrl('demo://controlled-synthetic-registry/DEMO-CERT-1001');
    } else if (sampleType === 'demo2') {
      setCandidateName('Arjun Mehta');
      setCredentialId('DEMO-CERT-1002');
      setIssuer('CertiSure Demo University');
      setCourseTitle('Python Programming Fundamentals');
      setIssueDate('2026-07-10');
      setPublicVerificationUrl('demo://controlled-synthetic-registry/DEMO-CERT-1002');
    } else if (sampleType === 'demo3') {
      setCandidateName('Neha Reddy');
      setCredentialId('DEMO-CERT-1003');
      setIssuer('CertiSure Demo University');
      setCourseTitle('Data Science Foundations');
      setIssueDate('2026-05-20');
      setPublicVerificationUrl('demo://controlled-synthetic-registry/DEMO-CERT-1003');
    } else if (sampleType === 'stan') {
      setCandidateName('Sarah Lin');
      setCredentialId('STAN-ML-99201-X');
      setIssuer('Stanford Online Registry');
      setCourseTitle('Advanced Machine Learning Specialization');
      setIssueDate('2023-11-15');
      setPublicVerificationUrl('https://credentials.stanford.edu/verify/STAN-ML-99201-X');
    } else if (sampleType === 'mit') {
      setCandidateName('David K. Miller');
      setCredentialId('MIT-CS-501-A');
      setIssuer('MIT xPRO Registrar Hook');
      setCourseTitle('Computer Science for Artificial Intelligence');
      setIssueDate('2024-01-20');
      setPublicVerificationUrl('https://xpro.mit.edu/verify/MIT-CS-501-A');
    } else if (sampleType === 'coursera') {
      setCandidateName('Elena Rostova');
      setCredentialId('COURSERA-GOOGLE-CLOUD-44');
      setIssuer('Coursera Partner Network');
      setCourseTitle('Google Cloud Professional Cloud Architect');
      setIssueDate('2023-08-10');
      setPublicVerificationUrl('https://www.coursera.org/verify/COURSERA-GOOGLE-CLOUD-44');
    }
  };

  // Handle Issuer Adapter Selection (Option C)
  const handleAdapterSelect = (adapterId) => {
    setSelectedAdapterId(adapterId);
    const found = adapters.find(a => a.id === adapterId);
    if (found) {
      setIssuer(found.name);
      if (found.endpointUrl) {
        setPublicVerificationUrl(found.endpointUrl);
      }
    }
  };

  // Handle File Upload & AI OCR Extraction (Option B)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      setValidationError('Invalid file format. Only PDF, PNG, and JPEG documents are permitted.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setValidationError('Document exceeds 5MB size limit.');
      return;
    }

    setValidationError('');
    setUploadedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => setUploadPreview(event.target?.result);
      reader.readAsDataURL(file);
    } else {
      setUploadPreview(null);
    }

    // Trigger AI OCR Extraction via server API
    triggerAiExtraction(file);
  };

  // Helper to parse date to YYYY-MM-DD for HTML5 date input (timezone-safe)
  const parseDateToIso = (rawDate) => {
    if (!rawDate) return '';
    const trimmed = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  // Helper to resolve fields from documented JSON or wrapped objects (data, result, extractedFields, extractedData)
  const resolveExtractedData = (resData) => {
    if (!resData) return null;
    const source =
      resData.extractedData ||
      resData.extractedFields ||
      resData.data ||
      resData.result ||
      resData;

    const candidateName = source.candidateName ? String(source.candidateName).trim() : '';
    const credentialId = source.credentialId ? String(source.credentialId).trim() : '';
    const issuingAuthority = (source.issuingAuthority || source.issuer) ? String(source.issuingAuthority || source.issuer).trim() : '';
    const qualification = (source.qualification || source.courseTitle) ? String(source.qualification || source.courseTitle).trim() : '';
    const completionDate = (source.completionDate || source.issueDate) ? String(source.completionDate || source.issueDate).trim() : '';

    let ocrConfidence = null;
    if (source.ocrConfidence !== undefined && source.ocrConfidence !== null && !isNaN(Number(source.ocrConfidence))) {
      ocrConfidence = Math.round(Number(source.ocrConfidence));
    } else if (source.confidenceScore !== undefined && source.confidenceScore !== null && !isNaN(Number(source.confidenceScore))) {
      ocrConfidence = Math.round(Number(source.confidenceScore));
    } else if (source.ocrConfidenceScore !== undefined && source.ocrConfidenceScore !== null && !isNaN(Number(source.ocrConfidenceScore))) {
      ocrConfidence = Math.round(Number(source.ocrConfidenceScore));
    }

    return {
      candidateName,
      credentialId,
      issuingAuthority,
      qualification,
      completionDate,
      ocrConfidence,
      rawSource: source
    };
  };

  const triggerAiExtraction = async (file) => {
    try {
      setExtractingAI(true);
      setValidationError('');
      const formData = new FormData();
      formData.append('document', file);

      const headers = {};
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`;
      }

      const res = await fetch('/api/extract-ocr', {
        method: 'POST',
        headers,
        body: formData,
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Server returned an unparseable response during OCR extraction.');
      }

      if (!data || !data.success) {
        setAiExtractedFields(null);
        setOcrConfidenceScore(null);
        const errMsg = data?.message || data?.error || 'Failed to extract certificate details. Please check the document or enter details manually.';
        setValidationError(errMsg);
        return;
      }

      const extracted = resolveExtractedData(data);
      if (!extracted) {
        setAiExtractedFields(null);
        setOcrConfidenceScore(null);
        setValidationError('No structured certificate fields were returned by the OCR engine.');
        return;
      }

      // Update OCR status
      setAiExtractedFields(extracted.rawSource);
      if (extracted.ocrConfidence !== null) {
        setOcrConfidenceScore(extracted.ocrConfidence);
      }

      // Explicit mapping to form state while preserving existing user values if extracted field is blank
      if (extracted.candidateName) {
        setCandidateName(extracted.candidateName);
      }
      if (extracted.credentialId) {
        setCredentialId(extracted.credentialId);
      }
      if (extracted.issuingAuthority) {
        setIssuer(extracted.issuingAuthority);
      }
      if (extracted.qualification) {
        setCourseTitle(extracted.qualification);
      }
      if (extracted.completionDate) {
        const iso = parseDateToIso(extracted.completionDate);
        if (iso) {
          setIssueDate(iso);
        }
      }
    } catch (err) {
      console.error('[AI Extraction Error]', err);
      setAiExtractedFields(null);
      setOcrConfidenceScore(null);
      setValidationError(err.message || 'OCR document extraction encountered an unexpected error.');
    } finally {
      setExtractingAI(false);
    }
  };

  // Form Submission -> Navigates to Screen 3 (Approval Gate)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!credentialId.trim()) {
      setValidationError('Please enter a Credential ID or upload a certificate document.');
      return;
    }

    if (!candidateName.trim()) {
      setValidationError('Candidate full name is required for verification.');
      return;
    }

    if (!issuer.trim()) {
      setValidationError('Please select or specify the issuing institution.');
      return;
    }

    // If file was uploaded, upload to private Supabase storage bucket under user UUID
    let storagePath = null;
    if (uploadedFile && user?.id) {
      try {
        const uploadRes = await uploadCertificateDocument(
          uploadedFile,
          user.id,
          `verif-${Date.now()}`
        );
        storagePath = uploadRes.path;
      } catch (uploadErr) {
        console.warn('[Storage Upload Warning]', uploadErr);
      }
    }

    const verificationPayload = {
      candidateName: candidateName.trim(),
      credentialId: credentialId.trim(),
      issuer: issuer.trim(),
      courseTitle: courseTitle.trim(),
      issueDate: issueDate ? issueDate.trim() : null,
      publicVerificationUrl: publicVerificationUrl.trim() || null,
      consentGranted,
      consentTimestamp: new Date().toISOString(),
      filePath: storagePath,
      previewUrl: uploadPreview,
      extractedData: aiExtractedFields,
      ocrConfidenceScore,
      userId: user.id,
      operatingMode,
      intakeMethod,
    };

    setCurrentVerification(verificationPayload);
    // Proceed to Screen 3: Human Approval Gate
    setActiveScreen('approval-gate');
  };

  const selectedAdapter = adapters.find(a => a.id === selectedAdapterId);
  const isLowConfidence = ocrConfidenceScore !== null && ocrConfidenceScore < ocrConfidenceThreshold;

  return (
    <div className="flex flex-col w-full gap-space-xl">
      {/* Page Header Hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-md pb-space-xs">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-sm text-secondary">
            <span className="font-metadata text-metadata uppercase tracking-wider text-secondary">
              Protocol Stage 01 // Intake
            </span>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span className="font-metadata text-metadata text-on-surface-variant">Deterministic Validation Spec</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
            New verification
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            Enter candidate credential parameters, extract forensic data from uploaded certificates, or query configured issuer registries.
          </p>
        </div>

        {/* Live Telemetry Tag */}
        <div className="flex items-center gap-space-md self-start sm:self-auto bg-surface-container-low px-space-md py-space-sm rounded-xl border border-outline-variant/30">
          <div className="flex flex-col">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider">Operating Mode</span>
            <span className="font-body-md-medium text-body-md-medium text-primary flex items-center gap-1.5 font-semibold">
              <span className={`w-2 h-2 rounded-full ${operatingMode === 'production' ? 'bg-[#267653]' : operatingMode === 'offline' ? 'bg-[#64748B]' : 'bg-[#9A6700]'} animate-pulse`}></span>
              {operatingMode === 'production' ? 'Production Gateway' : operatingMode === 'offline' ? 'Offline Fixtures' : 'Sandbox Demo'}
            </span>
          </div>
          <div className="h-6 w-px bg-surface-variant"></div>
          <div className="flex flex-col">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider">OCR Review Threshold</span>
            <span className="font-body-md-medium text-body-md-medium text-on-surface font-semibold">{ocrConfidenceThreshold}%</span>
          </div>
        </div>
      </div>

      {/* Production Warning if No Adapters Configured */}
      {operatingMode === 'production' && adapters.every(a => a.status === 'CONFIG_REQUIRED') && (
        <div className="p-space-md rounded-xl bg-[#FFF5D9] text-[#9A6700] text-body-md flex items-center gap-space-sm border border-[#F0DC9B]">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          <span>
            <strong>Production Gateway Notice:</strong> External registrar adapters require partner credentials. Direct queries will be routed to human adjudication with evidence requirements.
          </span>
        </div>
      )}

      {/* Clearly Labeled Sandbox Demo Sample Bar (Displayed ONLY in Demo Mode) */}
      {operatingMode === 'demo' && (
        <div className="bg-surface-container-low p-space-sm rounded-xl flex items-center justify-between gap-2 flex-wrap border border-outline-variant/30">
          <div className="flex items-center gap-2 text-metadata text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-secondary">science</span>
            <span className="font-semibold text-on-surface">Sandbox Demo Fixtures:</span>
            <span className="text-[11px] text-secondary">(Clearly labeled synthetic identities)</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => loadSandboxSample('demo1')}
              className={`px-2.5 py-1 rounded-lg text-metadata font-body-md-medium transition-colors ${
                activeSandboxFixture === 'demo1'
                  ? 'bg-primary text-on-primary shadow-xs font-bold ring-2 ring-primary/40'
                  : 'bg-surface-container-lowest hover:bg-surface-container text-primary shadow-xs'
              }`}
              title="Record A: Aanya Rao (Active AI Credential)"
            >
              Demo A (Aanya Rao)
            </button>
            <button
              type="button"
              onClick={() => loadSandboxSample('demo2')}
              className={`px-2.5 py-1 rounded-lg text-metadata font-body-md-medium transition-colors ${
                activeSandboxFixture === 'demo2'
                  ? 'bg-primary text-on-primary shadow-xs font-bold ring-2 ring-primary/40'
                  : 'bg-surface-container-lowest hover:bg-surface-container text-primary shadow-xs'
              }`}
              title="Record B: Arjun Mehta (Active Python Credential)"
            >
              Demo B (Arjun Mehta)
            </button>
            <button
              type="button"
              onClick={() => loadSandboxSample('demo3')}
              className={`px-2.5 py-1 rounded-lg text-metadata font-body-md-medium transition-colors ${
                activeSandboxFixture === 'demo3'
                  ? 'bg-primary text-on-primary shadow-xs font-bold ring-2 ring-primary/40'
                  : 'bg-surface-container-lowest hover:bg-surface-container text-primary shadow-xs'
              }`}
              title="Record C: Neha Reddy (Revoked Data Science Credential)"
            >
              Demo C (Neha Reddy - Revoked)
            </button>
            <button
              type="button"
              onClick={() => loadSandboxSample('stan')}
              className={`px-2.5 py-1 rounded-lg text-metadata font-body-md-medium transition-colors ${
                activeSandboxFixture === 'stan'
                  ? 'bg-primary text-on-primary shadow-xs font-bold ring-2 ring-primary/40'
                  : 'bg-surface-container-lowest hover:bg-surface-container text-primary shadow-xs'
              }`}
            >
              Stanford ML
            </button>
            {(activeSandboxFixture || candidateName || credentialId) && (
              <button
                type="button"
                onClick={clearForm}
                className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-metadata font-body-md-medium flex items-center gap-1 transition-colors border border-outline-variant/30 ml-1"
                title="Reset all fields to blank"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                <span>Reset Blank Form</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3 Real Intake Methods Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/30">
        <button
          type="button"
          onClick={() => setIntakeMethod('manual')}
          className={`py-space-sm px-space-md rounded-lg flex items-center justify-center gap-2 font-body-md-medium text-body-md transition-all ${
            intakeMethod === 'manual'
              ? 'bg-surface-container-lowest text-primary shadow-sm font-bold border border-outline-variant/30'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">edit_note</span>
          <span>Option A: Manual Intake</span>
        </button>

        <button
          type="button"
          onClick={() => setIntakeMethod('upload')}
          className={`py-space-sm px-space-md rounded-lg flex items-center justify-center gap-2 font-body-md-medium text-body-md transition-all ${
            intakeMethod === 'upload'
              ? 'bg-surface-container-lowest text-primary shadow-sm font-bold border border-outline-variant/30'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          <span>Option B: Upload Certificate (OCR)</span>
        </button>

        <button
          type="button"
          onClick={() => setIntakeMethod('issuer')}
          className={`py-space-sm px-space-md rounded-lg flex items-center justify-center gap-2 font-body-md-medium text-body-md transition-all ${
            intakeMethod === 'issuer'
              ? 'bg-surface-container-lowest text-primary shadow-sm font-bold border border-outline-variant/30'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">hub</span>
          <span>Option C: Issuer Record Registry</span>
        </button>
      </div>

      {validationError && (
        <div className="p-space-md rounded-xl bg-[#FCEEEE] text-[#B54747] text-body-md flex items-center gap-space-sm border border-[#F4C7C7]">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          <span>{validationError}</span>
        </div>
      )}

      {/* Primary 2-Column Workflow Container */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">

        {/* LEFT COLUMN: Input Form Sections (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-space-xl">

          {/* OPTION C SPECIFIC: Issuer Registry Selector */}
          {intakeMethod === 'issuer' && (
            <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
                <div className="flex items-center gap-space-sm">
                  <span className="w-6 h-6 rounded-lg bg-surface-container-high text-primary font-pill-label text-pill-label flex items-center justify-center font-bold">
                    00
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Issuer Adapter Resolution</h2>
                </div>
                <span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-pill-label text-pill-label uppercase font-semibold">
                  Documented Gateway
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-form-label text-form-label text-on-surface font-semibold">
                  Select Configured Authority:
                </label>
                <select
                  value={selectedAdapterId}
                  onChange={(e) => handleAdapterSelect(e.target.value)}
                  className="w-full h-10 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all cursor-pointer"
                >
                  <option value="">-- Choose Authoritative Issuer --</option>
                  {adapters.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.statusLabel} ({a.tier})
                    </option>
                  ))}
                </select>
              </div>

              {selectedAdapter && (
                <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2 border border-outline-variant/20 text-metadata">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-on-surface">{selectedAdapter.name}</span>
                    <span className={`px-2 py-0.5 rounded-full font-pill-label text-pill-label font-bold ${
                      selectedAdapter.status === 'ACTIVE' ? 'bg-[#EAF5EE] text-[#267653]' :
                      selectedAdapter.status === 'PUBLIC_VERIFICATION_AVAILABLE' ? 'bg-[#E8F0FE] text-[#1A73E8]' :
                      'bg-[#FFF5D9] text-[#9A6700]'
                    }`}>
                      {selectedAdapter.statusLabel}
                    </span>
                  </div>
                  <span className="text-on-surface-variant font-mono text-[11px] truncate">
                    Endpoint: {selectedAdapter.endpointUrl}
                  </span>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-on-surface-variant">
                    <span>Direct API: <strong>{selectedAdapter.capabilities?.directApiLookup ? 'Supported' : 'Requires Partner Key'}</strong></span>
                    <span>•</span>
                    <span>Public Web Inspection: <strong>{selectedAdapter.capabilities?.publicWebInspection ? 'Supported' : 'No'}</strong></span>
                    <span>•</span>
                    <span>Revocation Checks: <strong>{selectedAdapter.capabilities?.revocationCheck ? 'Supported' : 'No'}</strong></span>
                  </div>
                  {selectedAdapter.description && (
                    <p className="text-[12px] text-on-surface-variant mt-1 leading-relaxed">
                      {selectedAdapter.description}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* OPTION B SPECIFIC: Certificate Upload & OCR Parsing Banner */}
          {intakeMethod === 'upload' && (
            <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col gap-space-lg border border-outline-variant/20">
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
                <div className="flex items-center gap-space-sm">
                  <span className="w-6 h-6 rounded-lg bg-surface-container-high text-primary font-pill-label text-pill-label flex items-center justify-center font-bold">
                    01
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Certificate Document Upload & OCR</h2>
                </div>
                <span className="px-space-sm py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-pill-label text-pill-label uppercase font-semibold">
                  Private Vault (Max 5MB)
                </span>
              </div>

              <div className="flex flex-col gap-space-md">
                <label className="border-2 border-dashed border-outline-variant hover:border-secondary transition-colors rounded-xl p-space-xl flex flex-col items-center justify-center gap-space-sm cursor-pointer bg-surface-container-low/40">
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/jpg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                  </div>
                  <div className="text-center">
                    <span className="font-body-md-medium text-body-md text-primary font-semibold block">
                      {uploadedFile ? uploadedFile.name : 'Upload PDF or scan image'}
                    </span>
                    <span className="font-metadata text-metadata text-on-surface-variant block mt-0.5">
                      {uploadedFile
                        ? `${(uploadedFile.size / 1024).toFixed(1)} KB • Click to replace`
                        : 'PDF, PNG, or JPG up to 5MB (stored in private Supabase bucket)'}
                    </span>
                  </div>
                </label>

                {extractingAI && (
                  <div className="p-space-sm rounded-lg bg-surface-container-high flex items-center gap-2 text-metadata text-on-surface animate-pulse">
                    <span className="material-symbols-outlined text-[16px] text-secondary">neurology</span>
                    <span>Gemini multimodal vision engine extracting text fields...</span>
                  </div>
                )}

                {aiExtractedFields && (
                  <div className={`p-space-md rounded-xl flex flex-col gap-2 border ${
                    isLowConfidence
                      ? 'bg-[#FFF5D9] text-[#9A6700] border-[#F0DC9B]'
                      : 'bg-[#EAF5EE] text-[#267653] border-[#BFE0CD]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-body-md">
                        <span className="material-symbols-outlined text-[18px]">
                          {isLowConfidence ? 'warning' : 'check_circle'}
                        </span>
                        AI OCR Extraction Completed ({ocrConfidenceScore}% Confidence)
                      </span>
                      <span className="text-metadata font-mono font-semibold">
                        Review Threshold: {ocrConfidenceThreshold}%
                      </span>
                    </div>

                    {isLowConfidence && (
                      <p className="text-[12px] text-[#9A6700] leading-relaxed">
                        <strong>Policy Warning:</strong> Extraction confidence ({ocrConfidenceScore}%) is below your enterprise threshold ({ocrConfidenceThreshold}%). Fields have been populated below for your manual correction. This record will trigger mandatory human adjudication.
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1">
                      <span className="font-semibold">Populated & Editable:</span>
                      {candidateName && <span className="px-2 py-0.5 rounded bg-surface-container-high font-mono">Candidate Name</span>}
                      {credentialId && <span className="px-2 py-0.5 rounded bg-surface-container-high font-mono">Credential ID</span>}
                      {issuer && <span className="px-2 py-0.5 rounded bg-surface-container-high font-mono">Issuing Authority</span>}
                      {courseTitle && <span className="px-2 py-0.5 rounded bg-surface-container-high font-mono">Qualification</span>}
                      {issueDate && <span className="px-2 py-0.5 rounded bg-surface-container-high font-mono">Completion Date</span>}
                    </div>

                    <span className="text-[11px] opacity-90">
                      All fields below remain fully editable by the recruiter prior to verification dispatch.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SECTION A: Candidate Information (Editable) */}
          <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col gap-space-lg border border-outline-variant/20">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
              <div className="flex items-center gap-space-sm">
                <span className="w-6 h-6 rounded-lg bg-surface-container-high text-primary font-pill-label text-pill-label flex items-center justify-center font-bold">
                  {intakeMethod === 'manual' ? '01' : '02'}
                </span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Candidate Information (Review & Edit)</h2>
              </div>
              <span className="px-space-sm py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-pill-label text-pill-label uppercase font-semibold">
                Identity Claim
              </span>
            </div>

            <div className="grid grid-cols-1 gap-space-lg">
              {/* Candidate Name */}
              <div className="flex flex-col gap-1.5">
                <label className="font-form-label text-form-label text-on-surface flex items-center justify-between">
                  <span>Candidate Full Name <span className="text-error">*</span></span>
                  <span className="font-metadata text-metadata text-on-surface-variant">Matches official Gov ID</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g. Sarah Lin"
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                  />
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-3 top-2.5">
                    badge
                  </span>
                </div>
              </div>

              {/* Claimed Course */}
              <div className="flex flex-col gap-1.5">
                <label className="font-form-label text-form-label text-on-surface">
                  Course or Qualification Title <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="e.g. Advanced Machine Learning Specialization"
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                  />
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-3 top-2.5">
                    school
                  </span>
                </div>
              </div>

              {/* Completion Date */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-form-label text-form-label text-on-surface">Completion or Issue Date</label>
                  <span className="font-metadata text-metadata text-secondary">Optional when unavailable</span>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION B: Credential Information (Editable) */}
          <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col gap-space-lg border border-outline-variant/20">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
              <div className="flex items-center gap-space-sm">
                <span className="w-6 h-6 rounded-lg bg-surface-container-high text-primary font-pill-label text-pill-label flex items-center justify-center font-bold">
                  {intakeMethod === 'manual' ? '02' : '03'}
                </span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Credential Metadata</h2>
              </div>
              <span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-pill-label text-pill-label uppercase font-semibold">
                Issuance Metadata
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-lg">
              {/* Credential ID */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-form-label text-form-label text-on-surface flex items-center justify-between">
                  <span>Credential ID / Certificate Hash <span className="text-error">*</span></span>
                  <span className="font-metadata text-metadata text-outline font-mono">Serial / Identifier</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    placeholder="e.g. STAN-ML-99201-X or credential URL"
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md-medium font-mono text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                  />
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-3 top-2.5">
                    tag
                  </span>
                </div>
              </div>

              {/* Issuing Institution */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-form-label text-form-label text-on-surface">
                  Issuing Institution or Platform <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    placeholder="e.g. Stanford Online, MIT xPRO, Coursera, AWS"
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                  />
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-3 top-2.5">
                    account_balance
                  </span>
                </div>
              </div>

              {/* Public Verification URL */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-form-label text-form-label text-on-surface flex items-center justify-between">
                  <span>Public Verification URL</span>
                  <span className="font-metadata text-metadata text-secondary">Optional Live Web Link</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={publicVerificationUrl}
                    onChange={(e) => setPublicVerificationUrl(e.target.value)}
                    placeholder="https://credentials.institution.edu/verify/..."
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all font-mono text-[13px]"
                  />
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-3 top-2.5">
                    link
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION D: Explicit Candidate Consent (Strictly Enforced) */}
          <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
              <div className="flex items-center gap-space-sm">
                <span className="w-6 h-6 rounded-lg bg-surface-container-high text-primary font-pill-label text-pill-label flex items-center justify-center font-bold">
                  {intakeMethod === 'manual' ? '03' : '04'}
                </span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Candidate Consent Confirmation</h2>
              </div>
              <span className={`px-space-sm py-0.5 rounded-full font-pill-label text-pill-label uppercase font-bold ${
                consentGranted ? 'bg-[#EAF5EE] text-[#267653]' : 'bg-[#FCEEEE] text-[#B54747]'
              }`}>
                {consentGranted ? 'CONSENT DOCUMENTED' : 'CONSENT MISSING'}
              </span>
            </div>

            <label className="flex items-start gap-space-md cursor-pointer p-space-md rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low transition-colors">
              <input
                type="checkbox"
                checked={consentGranted}
                onChange={(e) => setConsentGranted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-primary focus:ring-secondary cursor-pointer"
              />
              <div className="flex flex-col gap-0.5">
                <span className="font-body-md-medium text-body-md text-on-surface font-semibold">
                  I confirm explicit candidate consent has been received and logged.
                </span>
                <span className="font-metadata text-metadata text-on-surface-variant text-[12px] leading-relaxed">
                  Candidate has authorized CertiSure AI and enterprise recruiters to query third-party registrar databases and retain this verification audit record in accordance with SOC2 and GDPR compliance.
                </span>
              </div>
            </label>

            {!consentGranted && (
              <div className="p-space-sm rounded-lg bg-[#FFF5D9] text-[#9A6700] text-metadata flex items-center gap-2 border border-[#F0DC9B]">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span>
                  Candidate authorization is legally required before external queries. Submissions without explicit affirmative consent will be halted at the Human Approval Gate.
                </span>
              </div>
            )}
          </section>

          {/* Action Trigger Button */}
          <div className="flex items-center justify-end gap-space-md">
            <button
              type="button"
              onClick={() => setActiveScreen('overview')}
              className="h-10 px-space-lg rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-body-md-medium text-body-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 px-space-xl rounded-xl bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-body-md flex items-center gap-space-sm transition-all shadow-md font-bold"
            >
              <span>Proceed to Human Approval Gate</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Verification Preview Dossier (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-space-lg sticky top-20">
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[18px] text-secondary">visibility</span>
                <span className="font-headline-sm text-headline-sm text-primary font-bold">Dossier Preview</span>
              </div>
              <span className="font-metadata text-metadata text-on-surface-variant font-mono">
                STAGE-01
              </span>
            </div>

            {/* Document Preview Thumbnail if uploaded */}
            {uploadPreview && (
              <div className="rounded-lg overflow-hidden border border-outline-variant/40 max-h-48 bg-surface-container-low flex items-center justify-center p-2">
                <img src={uploadPreview} alt="Certificate Scan" className="max-h-44 object-contain rounded" />
              </div>
            )}

            {/* Live Field Matrix */}
            <div className="flex flex-col gap-space-sm text-metadata font-metadata">
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="text-on-surface-variant uppercase tracking-wider text-[11px]">Candidate</span>
                <span className="font-body-md-medium text-body-md text-on-surface font-semibold mt-0.5">
                  {candidateName || '—'}
                </span>
              </div>

              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="text-on-surface-variant uppercase tracking-wider text-[11px]">Claimed Credential ID</span>
                <span className="font-mono text-body-md text-primary font-semibold mt-0.5">
                  {credentialId || '—'}
                </span>
              </div>

              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="text-on-surface-variant uppercase tracking-wider text-[11px]">Target Registrar / Issuer</span>
                <span className="font-body-md text-body-md text-on-surface font-semibold mt-0.5">
                  {issuer || '—'}
                </span>
              </div>

              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="text-on-surface-variant uppercase tracking-wider text-[11px]">Claimed Qualification</span>
                <span className="font-body-md text-body-md text-on-surface mt-0.5 truncate">
                  {courseTitle || '—'}
                </span>
              </div>

              {publicVerificationUrl && (
                <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                  <span className="text-on-surface-variant uppercase tracking-wider text-[11px]">Verification URL</span>
                  <span className="font-mono text-[11px] text-primary truncate mt-0.5">
                    {publicVerificationUrl}
                  </span>
                </div>
              )}

              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="text-on-surface-variant uppercase tracking-wider text-[11px]">Candidate Consent Status</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${consentGranted ? 'bg-[#267653]' : 'bg-[#B54747]'}`}></span>
                  <span className={`font-semibold ${consentGranted ? 'text-[#267653]' : 'text-[#B54747]'}`}>
                    {consentGranted ? 'Consent Documented (Authorized)' : 'Authorization Absent (Blocked)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-space-md rounded-xl bg-surface-container-low/60 border border-outline-variant/30 text-on-surface-variant font-metadata text-metadata leading-relaxed">
              <span className="font-semibold text-on-surface block mb-1">Human-in-the-Loop Principle:</span>
              CertiSure AI strictly requires recruiter sign-off at the Human Approval Gate before any outbound HTTP or cryptographic query is transmitted to the issuing registrar.
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
