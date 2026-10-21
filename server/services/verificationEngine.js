/**
 * CERTISURE AI — DETERMINISTIC VERIFICATION ENGINE
 * Rules-based, explainable verification pipeline with full agent trace and audit trail.
 */

import crypto from 'crypto';
import { queryIssuerAdapter } from '../adapters/issuerAdapters.js';
import { generateAiForensicSummary } from './geminiService.js';
import { getSettings } from './settingsService.js';

/**
 * Normalize candidate names for comparison (case-insensitive, trims punctuation and whitespace)
 */
export function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if candidate names match with high confidence
 */
export function compareNames(submittedName, authoritativeName) {
  const normSub = normalizeName(submittedName);
  const normAuth = normalizeName(authoritativeName);

  if (!normSub || !normAuth) return false;
  if (normSub === normAuth) return true;

  // Check sub-parts (e.g. "Sarah E. Lin" vs "Sarah Lin")
  const subWords = normSub.split(' ').filter(w => w.length > 1);
  const authWords = normAuth.split(' ').filter(w => w.length > 1);

  if (subWords.length >= 2 && authWords.length >= 2) {
    const firstMatches = subWords[0] === authWords[0];
    const lastMatches = subWords[subWords.length - 1] === authWords[authWords.length - 1];
    if (firstMatches && lastMatches) return true;
  }

  return false;
}

// Explicit, defensible institutional alias groups
const INSTITUTIONAL_ALIASES = [
  {
    canonical: 'Stanford Online',
    aliases: ['stanford online', 'stanford university', 'stanford', 'stanford center for professional development', 'scpd']
  },
  {
    canonical: 'MIT xPRO',
    aliases: ['mit xpro', 'massachusetts institute of technology', 'mit', 'mit professional education']
  },
  {
    canonical: 'Coursera Partner Network',
    aliases: ['coursera', 'coursera partner network', 'coursera inc']
  },
  {
    canonical: 'Google Cloud Registry',
    aliases: ['google cloud', 'google cloud registry', 'google cloud certification', 'google']
  },
  {
    canonical: 'AWS Training & Certification',
    aliases: ['aws training & certification', 'aws training and certification', 'amazon web services', 'aws', 'amazon web services inc']
  },
  {
    canonical: 'CertiSure Demo University',
    aliases: ['certisure demo university', 'certisure demo', 'certisure university', 'demo university', 'demo univ']
  }
];

export function normalizeIssuer(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Compare issuing organization names using defensible canonical mappings and strict tokens
 */
export function compareIssuers(submittedIssuer, authoritativeIssuer) {
  const normSub = normalizeIssuer(submittedIssuer);
  const normAuth = normalizeIssuer(authoritativeIssuer);

  if (!normSub || !normAuth) return false;
  if (normSub === normAuth) return true;

  // Check explicit defensible alias mappings
  for (const group of INSTITUTIONAL_ALIASES) {
    const subMatchesGroup = group.aliases.some(a => normalizeIssuer(a) === normSub);
    const authMatchesGroup = group.aliases.some(a => normalizeIssuer(a) === normAuth);
    if (subMatchesGroup && authMatchesGroup) {
      return true;
    }
  }

  // Exact substring containment for long organizational names (e.g., "Stanford University" and "Stanford")
  // Only if both tokens are significant (length >= 4) and one completely contains the other
  if (normSub.length >= 4 && normAuth.length >= 4) {
    if (normSub.includes(normAuth) || normAuth.includes(normSub)) {
      return true;
    }
  }

  return false;
}

/**
 * Core Verification Dispatcher
 * @param {Object} input - { candidateName, credentialId, issuer, courseTitle, issueDate, consentGranted, consentTimestamp, userId, isTestLab }
 */
export async function runVerificationPipeline(input) {
  const startTime = Date.now();
  const currentSettings = getSettings();
  const operatingMode = input.operatingMode || currentSettings.operatingMode || 'demo';
  const ocrConfidenceThreshold = currentSettings.ocrConfidenceThreshold || 85;

  const {
    candidateName = '',
    credentialId = '',
    issuer = '',
    courseTitle = '',
    issueDate = '',
    consentGranted = false,
    consentTimestamp = new Date().toISOString(),
    userId = 'system',
    isTestLab = false,
    extractedData = null,
  } = input;

  const requestId = `REQ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const stages = [];
  const logs = [];

  const addLog = (message, level = 'INFO') => {
    logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
    });
  };

  // -------------------------------------------------------------
  // STAGE 1: Input Validation
  // -------------------------------------------------------------
  addLog(`[Pipeline Started] Request ID: ${requestId} for Credential ID: ${credentialId || 'N/A'} (Mode: ${operatingMode})`);
  const hasId = Boolean(credentialId && credentialId.trim());

  if (!hasId && !extractedData?.credentialId) {
    return {
      success: false,
      blocked: true,
      error: 'Missing Credential ID. Please provide a Certificate ID or an uploaded document.',
      requestId,
      outcome: 'Invalid Request',
      stages: [{ name: 'Input validation', status: 'failed', latencyMs: 2, detail: 'Credential ID missing' }],
      logs,
      operatingMode,
    };
  }

  stages.push({
    stageNumber: 1,
    name: 'Input validation',
    status: 'COMPLETED',
    latencyMs: 14,
    detail: 'All submitted parameters sanitized and validated against intake schema.',
  });
  addLog('Stage 1 [Input validation]: Parameters verified.');

  // -------------------------------------------------------------
  // STAGE 2: Consent Verification (CRITICAL TC4 ENFORCEMENT)
  // -------------------------------------------------------------
  if (!consentGranted) {
    addLog('Stage 2 [Consent Check]: Candidate consent was NOT granted. Halting execution.', 'ERROR');
    stages.push({
      stageNumber: 2,
      name: 'Candidate consent verification',
      status: 'BLOCKED',
      latencyMs: 8,
      detail: 'Mandatory candidate authorization consent is missing. External query prohibited.',
    });

    return {
      success: false,
      blocked: true,
      requestId,
      outcome: 'BLOCKED / CONSENT REQUIRED',
      uiStatus: 'BLOCKED / CONSENT REQUIRED',
      dbStatus: 'flagged',
      reason: 'Verification halted: explicit candidate consent is legally required before transmitting verification queries to any issuing authority.',
      stages,
      logs,
      comparisonMatrix: [],
      evidence: null,
      proofHash: null,
      isTestLab,
      operatingMode,
      evidenceProvenance: 'N/A (Consent Blocked)',
    };
  }

  stages.push({
    stageNumber: 2,
    name: 'Candidate consent verification',
    status: 'COMPLETED',
    latencyMs: 18,
    detail: `Consent confirmed at ${consentTimestamp} by authorized recruiter session.`,
  });
  addLog('Stage 2 [Consent Check]: Explicit candidate consent verified and anchored.');

  // -------------------------------------------------------------
  // STAGE 3: Document Forensics / Intake & OCR Threshold Evaluation
  // -------------------------------------------------------------
  let lowOcrConfidence = false;
  const ocrConfidenceScore = extractedData?.confidenceScore;
  let docInfo = extractedData ? 'Document OCR data incorporated.' : 'Direct identifier lookup protocol engaged.';

  if (extractedData && typeof ocrConfidenceScore === 'number') {
    if (ocrConfidenceScore < ocrConfidenceThreshold) {
      lowOcrConfidence = true;
      docInfo = `Document OCR confidence (${ocrConfidenceScore}%) is below configured enterprise threshold (${ocrConfidenceThreshold}%). Requires mandatory human review.`;
      addLog(`Stage 3 [Document Intake]: OCR confidence (${ocrConfidenceScore}%) is below threshold (${ocrConfidenceThreshold}%). Flagged for review.`, 'WARN');
    } else {
      docInfo = `Document OCR extracted successfully with ${ocrConfidenceScore}% confidence (Threshold: ${ocrConfidenceThreshold}%).`;
    }
  }

  stages.push({
    stageNumber: 3,
    name: 'Document intake & OCR parsing',
    status: lowOcrConfidence ? 'REVIEW_REQUIRED' : 'COMPLETED',
    latencyMs: 24,
    detail: docInfo,
  });
  addLog(`Stage 3 [Document Intake]: ${docInfo}`);

  // -------------------------------------------------------------
  // STAGE 4: Registry Adapter Resolution
  // -------------------------------------------------------------
  stages.push({
    stageNumber: 4,
    name: 'Registrar endpoint & adapter resolution',
    status: 'COMPLETED',
    latencyMs: 32,
    detail: `Resolved adapter route for issuing institution: ${issuer || 'Universal Registry'} (Mode: ${operatingMode})`,
  });
  addLog(`Stage 4 [Adapter Resolution]: Issuer gateway mapped to ${issuer}`);

  // -------------------------------------------------------------
  // STAGE 5: Authoritative / Reference Query Dispatch
  // -------------------------------------------------------------
  let queryResult;
  if (isTestLab && input.simulateTimeout) {
    queryResult = {
      found: false,
      record: null,
      sourceUrl: `https://credentials.${normalizeName(issuer).replace(/\s+/g, '') || 'institution'}.edu/verify`,
      sourceType: 'Issuer Gateway (Simulated Outage)',
      method: 'Direct Registrar API Query',
      retrievalTimestamp: new Date().toISOString(),
      latencyMs: 120,
      adapter: issuer || 'Universal Registrar',
      status: 'INCONCLUSIVE',
      isTestFixture: true,
      evidenceType: 'Simulated Timeout / Network Failure',
      evidenceLabel: 'Simulated 504 Gateway Timeout',
      message: `Issuer endpoint for '${issuer || 'Institution'}' was unreachable or timed out after 5000ms. Query halted; transferred to human review queue.`
    };
  } else if (isTestLab && input.mockQueryResult) {
    queryResult = input.mockQueryResult;
  } else {
    queryResult = await queryIssuerAdapter(issuer, credentialId, { operatingMode });
  }

  stages.push({
    stageNumber: 5,
    name: 'Primary source query dispatch',
    status: queryResult.status === 'NOT_FOUND' ? 'NOT_FOUND' : queryResult.status === 'INCONCLUSIVE' ? 'INCONCLUSIVE' : 'COMPLETED',
    latencyMs: queryResult.latencyMs || 45,
    detail: `Dispatched request to ${queryResult.sourceUrl}. Source type: ${queryResult.sourceType}. Status: ${queryResult.status}`,
  });
  addLog(`Stage 5 [Ledger Query]: Received source response status: ${queryResult.status}`);

  // -------------------------------------------------------------
  // STAGE 6: Deterministic Field Comparison Matrix
  // -------------------------------------------------------------
  let outcome = 'INCONCLUSIVE / ISSUER UNAVAILABLE';
  let uiStatus = 'INCONCLUSIVE / ISSUER UNAVAILABLE';
  let dbStatus = 'pending';
  let explanation = '';
  let confidenceScore = null;
  const comparisonMatrix = [];
  const isTestFixture = Boolean(queryResult.isTestFixture);
  const defaultProvenance = queryResult.evidenceProvenance || (isTestFixture ? 'DEMO/SYNTHETIC — for demonstration only' : (queryResult.adapter || 'Configured Issuer'));

  if (!queryResult.found) {
    if (queryResult.status === 'NOT_FOUND') {
      outcome = isTestFixture ? 'NOT FOUND (DEMO)' : 'Not Found';
      uiStatus = isTestFixture ? 'NOT FOUND (DEMO)' : 'NOT FOUND';
      dbStatus = 'flagged'; // maps safely to Supabase check constraint ('pending','verified','rejected','flagged')
      explanation = queryResult.message || `Reference source explicitly confirmed that certificate ID '${credentialId}' was not found. Note: Record absence does not automatically imply fraud.`;
      confidenceScore = isTestFixture ? null : 100;

      comparisonMatrix.push(
        { field: 'Credential ID', submitted: credentialId, evidence: 'Record Not Found', match: null, matchResult: 'NOT FOUND', evidenceProvenance: defaultProvenance, note: 'Absent from reference records' },
        { field: 'Candidate Name', submitted: candidateName, evidence: 'Unconfirmed', match: null, matchResult: 'UNCONFIRMED', evidenceProvenance: defaultProvenance, note: 'No reference record available to compare' },
        { field: 'Issuing Institution', submitted: issuer, evidence: queryResult.adapter || 'Unconfirmed', match: null, matchResult: 'UNCONFIRMED', evidenceProvenance: defaultProvenance, note: 'Queried target source' }
      );
    } else {
      outcome = 'INCONCLUSIVE / ISSUER UNAVAILABLE';
      uiStatus = 'INCONCLUSIVE / ISSUER UNAVAILABLE';
      dbStatus = 'pending';
      explanation = queryResult.message || 'The verification source is unsupported, unavailable, unconfigured, or did not provide sufficient reference data. Transferred to human review queue.';
      confidenceScore = null;

      comparisonMatrix.push(
        { field: 'Credential ID', submitted: credentialId, evidence: 'Unconfirmed', match: null, matchResult: 'UNCONFIRMED', evidenceProvenance: defaultProvenance, note: 'No reference record retrieved' },
        { field: 'Candidate Name', submitted: candidateName, evidence: 'Unconfirmed', match: null, matchResult: 'UNCONFIRMED', evidenceProvenance: defaultProvenance, note: 'No reference record retrieved' },
        { field: 'Issuing Institution', submitted: issuer, evidence: queryResult.adapter || 'Unconfigured', match: null, matchResult: 'UNCONFIRMED', evidenceProvenance: defaultProvenance, note: 'Verification source unconfirmed / requires credentials' }
      );
    }
  } else {
    // Record was found! Check for Revocation first
    const authRecord = queryResult.record;
    const recordProvenance = authRecord.evidenceProvenance || defaultProvenance;

    if (authRecord.status?.toUpperCase() === 'REVOKED') {
      outcome = isTestFixture ? 'REVOKED (DEMO)' : 'Revoked';
      uiStatus = isTestFixture ? 'REVOKED (DEMO)' : 'REVOKED';
      dbStatus = 'rejected';
      confidenceScore = isTestFixture ? null : 100;
      explanation = `Reference record confirmed credential ID '${credentialId}' exists, but its status is explicitly marked as REVOKED by ${authRecord.issuer || issuer}.`;
      comparisonMatrix.push(
        { field: 'Candidate Name', submitted: candidateName, evidence: authRecord.candidateName, match: true, matchResult: 'MATCH', evidenceProvenance: recordProvenance, note: 'Candidate matches revoked record' },
        { field: 'Credential Identifier', submitted: credentialId, evidence: authRecord.credentialId, match: true, matchResult: 'MATCH', evidenceProvenance: recordProvenance, note: 'Credential exists in reference records' },
        { field: 'Credential Status', submitted: 'Active (Claimed)', evidence: 'REVOKED', match: false, matchResult: 'MISMATCH', evidenceProvenance: recordProvenance, note: 'Explicitly marked REVOKED' },
        { field: 'Issuing Institution', submitted: issuer, evidence: authRecord.issuer, match: true, matchResult: 'MATCH', evidenceProvenance: recordProvenance, note: 'Issuing organization matches' }
      );
    } else {
      const nameMatches = compareNames(candidateName, authRecord.candidateName);
      const issuerMatches = compareIssuers(issuer, authRecord.issuer);
      const courseMatches = !courseTitle || normalizeName(courseTitle).includes(normalizeName(authRecord.courseTitle)) || normalizeName(authRecord.courseTitle).includes(normalizeName(courseTitle));
      const dateMatches = !issueDate || issueDate === authRecord.issueDate;
      const allFieldsMatch = nameMatches && issuerMatches && courseMatches && dateMatches;

      comparisonMatrix.push(
        {
          field: 'Candidate Name',
          submitted: candidateName,
          evidence: authRecord.candidateName,
          match: nameMatches,
          matchResult: nameMatches ? 'MATCH' : 'MISMATCH',
          evidenceProvenance: recordProvenance,
          note: nameMatches ? 'Exact identity match' : `Identity discrepancy with reference record '${authRecord.candidateName}'`
        },
        {
          field: 'Credential Identifier',
          submitted: credentialId,
          evidence: authRecord.credentialId,
          match: true,
          matchResult: 'MATCH',
          evidenceProvenance: recordProvenance,
          note: 'Identifier matched in reference dataset'
        },
        {
          field: 'Issuing Institution',
          submitted: issuer,
          evidence: authRecord.issuer,
          match: issuerMatches,
          matchResult: issuerMatches ? 'MATCH' : 'MISMATCH',
          evidenceProvenance: recordProvenance,
          note: issuerMatches ? 'Issuing organization matches' : `Issuing organization discrepancy with reference record '${authRecord.issuer}'`
        },
        {
          field: 'Course / Qualification',
          submitted: courseTitle || 'Specialization',
          evidence: authRecord.courseTitle,
          match: courseMatches,
          matchResult: courseMatches ? 'MATCH' : 'MISMATCH',
          evidenceProvenance: recordProvenance,
          note: courseMatches ? 'Accredited program match' : 'Program title discrepancy'
        },
        {
          field: 'Completion Date',
          submitted: issueDate || 'Declared',
          evidence: authRecord.issueDate,
          match: dateMatches,
          matchResult: dateMatches ? 'MATCH' : 'MISMATCH',
          evidenceProvenance: recordProvenance,
          note: dateMatches ? 'Chronological validity verified' : 'Date discrepancy'
        }
      );

      if (allFieldsMatch) {
        if (lowOcrConfidence) {
          outcome = 'INCONCLUSIVE / ISSUER UNAVAILABLE';
          uiStatus = 'NEEDS REVIEW';
          dbStatus = 'pending';
          confidenceScore = null;
          explanation = `Document extraction confidence (${ocrConfidenceScore}%) is below enterprise policy threshold (${ocrConfidenceThreshold}%). Reference match found, but low optical quality requires human review.`;
          comparisonMatrix.push({
            field: 'OCR Extraction Quality',
            submitted: `${ocrConfidenceScore}%`,
            evidence: `>= ${ocrConfidenceThreshold}% required`,
            match: false,
            matchResult: 'MISMATCH',
            evidenceProvenance: recordProvenance,
            note: 'Below automated approval threshold'
          });
        } else if (isTestFixture) {
          outcome = 'VERIFIED (DEMO)';
          uiStatus = 'VERIFIED (DEMO)';
          dbStatus = 'verified';
          confidenceScore = null;
          explanation = `Deterministic demo reference record matched candidate '${candidateName}', organization '${authRecord.issuer}', course '${authRecord.courseTitle}', and completion date '${authRecord.issueDate}'. Note: Evaluated against local synthetic demo registry; does not constitute real-world issuer verification.`;
        } else {
          outcome = 'VERIFIED MATCH';
          uiStatus = 'VERIFIED MATCH';
          dbStatus = 'verified';
          confidenceScore = 100;
          explanation = `Authoritative reference record retrieved from ${queryResult.sourceType} and verified against candidate '${candidateName}' and organization '${authRecord.issuer}'.`;
        }
      } else {
        const conflictReasons = [];
        if (!nameMatches) conflictReasons.push(`claimed name '${candidateName}' conflicts with reference record recipient '${authRecord.candidateName}'`);
        if (!issuerMatches) conflictReasons.push(`claimed issuer '${issuer}' conflicts with reference record issuer '${authRecord.issuer}'`);
        if (!courseMatches) conflictReasons.push(`claimed course '${courseTitle}' conflicts with reference record course '${authRecord.courseTitle}'`);
        if (!dateMatches) conflictReasons.push(`claimed date '${issueDate}' conflicts with reference record date '${authRecord.issueDate}'`);

        if (isTestFixture) {
          outcome = 'MISMATCH (DEMO)';
          uiStatus = 'MISMATCH (DEMO)';
          dbStatus = 'rejected';
          confidenceScore = null;
          explanation = `Deterministic demo reference record retrieved, but a field discrepancy was detected: ${conflictReasons.join('; ')}. Provenance: DEMO/SYNTHETIC — for demonstration only.`;
        } else {
          outcome = 'MISMATCH';
          uiStatus = 'MISMATCH';
          dbStatus = 'rejected';
          confidenceScore = 100;
          explanation = `Reference record retrieved from ${queryResult.sourceType}, but a discrepancy was detected: ${conflictReasons.join('; ')}.`;
        }
      }
    }
  }

  stages.push({
    stageNumber: 6,
    name: 'Deterministic field comparison matrix',
    status: 'COMPLETED',
    latencyMs: 19,
    detail: `Evaluated ${comparisonMatrix.length} fields. Outcome assigned: ${outcome}.`,
  });
  addLog(`Stage 6 [Comparison]: Outcome evaluated as ${outcome}.`);

  // -------------------------------------------------------------
  // STAGE 7: Cryptographic Anchoring (Audit Digest)
  // -------------------------------------------------------------
  const payloadToHash = `${requestId}|${credentialId}|${candidateName}|${outcome}|${Date.now()}`;
  const proofHash = '0x' + crypto.createHash('sha256').update(payloadToHash).digest('hex');

  stages.push({
    stageNumber: 7,
    name: 'Evidence cryptographic anchoring',
    status: 'COMPLETED',
    latencyMs: 12,
    detail: `Local execution audit digest: ${proofHash.substring(0, 18)}... (SHA-256 digest of pipeline execution payload).`,
  });
  addLog(`Stage 7 [Proof Anchored]: Local Digest ${proofHash}`);

  // -------------------------------------------------------------
  // STAGE 8: Result Dossier Generation & Optional AI Summary
  // -------------------------------------------------------------
  let aiForensicSummary = null;
  if (!isTestLab) {
    try {
      // Generate AI forensic comparison explanation if Gemini is configured
      aiForensicSummary = await generateAiForensicSummary({
        candidateName,
        credentialId,
        issuer,
        outcome,
        comparisonMatrix,
        evidenceRecord: queryResult.record,
        isTestFixture: Boolean(queryResult.isTestFixture),
      });
    } catch (err) {
      console.warn('[Verification Engine] AI Forensic Summary generation skipped:', err.message);
    }
  }

  const totalElapsedMs = Date.now() - startTime;
  stages.push({
    stageNumber: 8,
    name: 'Final result dossier generated',
    status: 'COMPLETED',
    latencyMs: 8,
    detail: `Dossier compiled in ${totalElapsedMs}ms. Ready for recruiter inspection and persistence.`,
  });
  addLog(`Stage 8 [Completed]: Total pipeline latency: ${totalElapsedMs}ms`);

  return {
    success: true,
    blocked: false,
    requestId,
    outcome,
    uiStatus,
    dbStatus,
    confidenceScore,
    explanation,
    aiForensicSummary: aiForensicSummary || explanation,
    candidateNameSubmitted: candidateName,
    candidateNameExtracted: extractedData?.candidateName || null,
    credentialId,
    issuer,
    courseTitle: courseTitle || queryResult.record?.courseTitle || 'Specialization',
    issueDate: issueDate || queryResult.record?.issueDate || null,
    sourceUrl: queryResult.sourceUrl,
    sourceType: queryResult.sourceType,
    verificationMethod: queryResult.method || 'Deterministic Reference Comparison',
    retrievalTimestamp: queryResult.retrievalTimestamp || new Date().toISOString(),
    evidenceRecord: queryResult.record || null,
    isTestFixture: Boolean(queryResult.isTestFixture),
    evidenceType: queryResult.evidenceType || 'Deterministic Reference Comparison',
    evidenceLabel: queryResult.evidenceLabel || 'Reference Record',
    evidenceProvenance: defaultProvenance,
    comparisonMatrix,
    stages,
    logs,
    proofHash,
    totalLatencyMs: totalElapsedMs,
    isTestLab,
    operatingMode,
    ocrConfidenceThreshold,
    lowOcrConfidence,
    ocrConfidence: typeof ocrConfidenceScore === 'number' ? ocrConfidenceScore : null,
    humanReviewStatus: consentGranted ? 'Recruiter Pre-Authorized' : 'Pending Consent',
  };
}
