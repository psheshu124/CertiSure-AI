/**
 * CERTISURE AI — FULL-STACK EXPRESS SERVER
 * Handles server-side AI OCR, issuer adapter lookups, deterministic verification, and test fixtures.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ADAPTER_REGISTRY, SUPPORTED_ISSUERS } from './adapters/issuerAdapters.js';
import { isGeminiConfigured, extractCertificateDetails } from './services/geminiService.js';
import { runVerificationPipeline } from './services/verificationEngine.js';
import { confirmDevelopmentTestUser, isDevAdminAvailable } from './services/devAuthAdmin.js';
import { getPublicSettings, updateSettings, getSettings } from './services/settingsService.js';
import { authenticateRequest } from './middleware/authMiddleware.js';
import { createRateLimiter } from './middleware/rateLimiter.js';

// Load environment variables
dotenv.config();

// Process-level resilience against external API network timeouts and unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning] Unhandled Promise Rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server Error] Uncaught Exception:', err?.message || err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static assets from compiled Vite production build if present
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// In-memory rate limiters for expensive endpoints
const ocrLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  maxAuthenticated: 100,
  endpointName: 'Document OCR'
});

const verifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  maxAuthenticated: 150,
  endpointName: 'Verification Engine'
});

// Configure multer memory storage for secure in-memory document parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, PNG, and JPEG documents are permitted.'));
    }
  }
});

// 1. Health & Configuration Diagnostic
app.get('/api/health', (req, res) => {
  const geminiActive = isGeminiConfigured();
  const supabaseSet = Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const settings = getPublicSettings();

  res.json({
    status: 'ONLINE',
    version: '2.5.0',
    serverTime: new Date().toISOString(),
    operatingMode: settings.operatingMode,
    ocrConfidenceThreshold: settings.ocrConfidenceThreshold,
    aiProvider: {
      provider: 'Google Gemini',
      model: settings.aiProvider.model,
      configured: geminiActive,
      status: geminiActive ? 'ACTIVE' : 'MISSING_KEY',
      message: geminiActive
        ? `Gemini vision & OCR engine ready with model: ${settings.aiProvider.model}.`
        : 'GEMINI_API_KEY is not configured in .env. Test fixtures and deterministic manual verification remain active.'
    },
    database: {
      provider: 'Supabase',
      configured: supabaseSet,
      status: supabaseSet ? 'CONNECTED' : 'STANDBY_DEMO'
    },
    authAdmin: {
      devAvailable: isDevAdminAvailable(),
      mode: process.env.NODE_ENV === 'production' ? 'DISABLED' : 'LOCAL_DEVELOPMENT_ONLY',
    },
    adaptersCount: ADAPTER_REGISTRY.length,
  });
});

// 2. Issuer Adapters Registry Endpoint
app.get('/api/adapters', (req, res) => {
  res.json({
    success: true,
    adapters: ADAPTER_REGISTRY.map(a => a.toPublicJson()),
    timestamp: new Date().toISOString()
  });
});

// 2b. Run Connectivity / Health Check on Adapters
app.post('/api/adapters/check-health', async (req, res) => {
  try {
    const { adapterId } = req.body || {};
    let targets = ADAPTER_REGISTRY;
    if (adapterId) {
      targets = ADAPTER_REGISTRY.filter(a => a.id === adapterId || a.code.toLowerCase() === adapterId.toLowerCase());
    }

    const checkResults = [];
    for (const adapter of targets) {
      const result = await adapter.checkConnectivity();
      checkResults.push({
        id: adapter.id,
        name: adapter.name,
        result,
      });
    }

    res.json({
      success: true,
      adapters: ADAPTER_REGISTRY.map(a => a.toPublicJson()),
      checkResults,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API /api/adapters/check-health Error]', err);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to complete connectivity check.'
    });
  }
});

// 2c. Enterprise Settings Endpoints
app.get('/api/settings', (req, res) => {
  res.json({
    success: true,
    settings: getPublicSettings(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/settings', async (req, res) => {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Only authenticated enterprise recruiters can modify configuration settings.'
      });
    }

    const updates = req.body;
    const author = auth.user.email || req.body.savedBy || 'Enterprise Recruiter';
    const result = updateSettings(updates, author);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[API /api/settings Error]', err);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to update enterprise settings.'
    });
  }
});

// 3. Document OCR Extraction Endpoint (Multipart file or Base64) with Rate Limiting
app.post('/api/extract-ocr', ocrLimiter, (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'FILE_TOO_LARGE',
          message: 'Document exceeds the 5MB size limit. Please upload a smaller file.'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'INVALID_FILE_TYPE',
        message: err.message || 'Invalid file format. Only PDF, PNG, and JPEG documents are permitted.'
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    let fileBuffer;
    let mimeType = 'image/png';

    const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : req.file;

    if (uploadedFile) {
      fileBuffer = uploadedFile.buffer;
      mimeType = uploadedFile.mimetype;
    } else if (req.body && req.body.base64) {
      fileBuffer = req.body.base64;
      mimeType = req.body.mimeType || 'image/png';
    } else {
      return res.status(400).json({
        success: false,
        error: 'NO_PAYLOAD',
        message: 'No document file or base64 payload provided.'
      });
    }

    const extractionResult = await extractCertificateDetails(fileBuffer, mimeType);
    res.json(extractionResult);
  } catch (err) {
    console.error('[API /api/extract-ocr Error]', err);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to extract certificate details: ' + err.message
    });
  }
});

// 4. Primary Verification Dispatcher Endpoint (Protected & Rate Limited)
app.post('/api/verify', verifyLimiter, async (req, res) => {
  try {
    const payload = req.body || {};
    const settings = getSettings();
    const auth = await authenticateRequest(req);

    if (auth.authenticated && auth.user) {
      // Authenticated session: bind verified user identity
      payload.userId = auth.user.id;
      payload.verifiedUser = {
        id: auth.user.id,
        email: auth.user.email,
        role: auth.user.user_metadata?.role || 'Enterprise Recruiter'
      };
    } else {
      // Unauthenticated / Guest session: restrict to safe demo operations
      payload.userId = 'guest-session';
      payload.verifiedUser = null;

      // Prevent unauthenticated callers from triggering production live registrar lookups
      if (payload.operatingMode === 'production') {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED_PRODUCTION_MODE',
          message: 'Live external registrar verification requires an authenticated recruiter session. Please sign in or switch to Demo Mode.'
        });
      }

      if (!payload.operatingMode) {
        payload.operatingMode = 'demo';
      }
    }

    if (!payload.operatingMode) {
      payload.operatingMode = settings.operatingMode || 'demo';
    }

    const verificationResult = await runVerificationPipeline(payload);
    res.json(verificationResult);
  } catch (err) {
    console.error('[API /api/verify Error]', err);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Verification engine encountered an internal error.'
    });
  }
});

// 5. Test Lab Dynamic Acceptance Suite (Dynamic Credentials + TC1-TC4 Legacy Presets)
app.post('/api/test-lab/run', verifyLimiter, async (req, res) => {
  try {
    const { credential, scenarioId, testCaseId } = req.body;

    const legacyDefinitions = {
      tc1: {
        id: 'tc1',
        title: 'TC1: Matching Candidate Name (Synthetic Demo Match)',
        input: {
          candidateName: 'Sarah Lin',
          credentialId: 'STAN-ML-99201-X',
          issuer: 'Stanford Online',
          courseTitle: 'Advanced Machine Learning Specialization',
          issueDate: '2023-11-15',
          consentGranted: true,
          isTestLab: true,
        },
        expectedOutcome: 'VERIFIED (DEMO)',
        expectedUiStatus: 'VERIFIED (DEMO)',
        assertion: (r) => r.outcome === 'VERIFIED (DEMO)' || r.outcome === 'Demo Match' || r.outcome === 'Verified',
      },
      tc2: {
        id: 'tc2',
        title: 'TC2: Different Candidate Name (Synthetic Demo Mismatch)',
        input: {
          candidateName: 'Marcus Brody',
          credentialId: 'STAN-ML-99201-X',
          issuer: 'Stanford Online',
          courseTitle: 'Advanced Machine Learning Specialization',
          issueDate: '2023-11-15',
          consentGranted: true,
          isTestLab: true,
        },
        expectedOutcome: 'MISMATCH (DEMO)',
        expectedUiStatus: 'MISMATCH (DEMO)',
        assertion: (r) => r.outcome === 'MISMATCH (DEMO)' || r.outcome === 'Demo Mismatch' || r.outcome === 'Mismatch',
      },
      tc3: {
        id: 'tc3',
        title: 'TC3: No Matching Record (Explicit Absence Confirmation)',
        input: {
          candidateName: 'Sarah Lin',
          credentialId: 'STAN-ML-00000-VOID',
          issuer: 'Stanford Online',
          courseTitle: 'Advanced Machine Learning Specialization',
          issueDate: '2023-11-15',
          consentGranted: true,
          isTestLab: true,
        },
        expectedOutcome: 'NOT FOUND (DEMO)',
        expectedUiStatus: 'NOT FOUND (DEMO)',
        assertion: (r) => r.outcome === 'NOT FOUND (DEMO)' || r.outcome === 'Not Found',
      },
      tc4: {
        id: 'tc4',
        title: 'TC4: Missing Consent (Deterministic Authorization Block)',
        input: {
          candidateName: 'Sarah Lin',
          credentialId: 'STAN-ML-99201-X',
          issuer: 'Stanford Online',
          courseTitle: 'Advanced Machine Learning Specialization',
          issueDate: '2023-11-15',
          consentGranted: false, // EXPLICITLY ABSENT
          isTestLab: true,
        },
        expectedOutcome: 'BLOCKED / CONSENT REQUIRED',
        expectedUiStatus: 'BLOCKED / CONSENT REQUIRED',
        assertion: (r) => r.blocked === true || r.outcome === 'BLOCKED / CONSENT REQUIRED' || r.outcome === 'Missing Consent',
      }
    };

    // Helper: Build 6 dynamic test scenarios from any user-provided credential
    const buildDynamicDefinitions = (cred) => {
      const cName = cred.candidateName?.trim() || 'Candidate Name';
      const cId = cred.credentialId?.trim() || 'CRED-001';
      const cIssuer = cred.issuer?.trim() || 'Issuing Authority';
      const cCourse = cred.courseTitle?.trim() || 'Certification Track';
      const cDate = cred.issueDate?.trim() || new Date().toISOString().split('T')[0];

      const mockAuthRecord = {
        credentialId: cId,
        candidateName: cName,
        issuer: cIssuer,
        courseTitle: cCourse,
        issueDate: cDate,
        status: 'ACTIVE',
        sourceType: 'Synthetic Test Fixture (Sandbox Isolated)',
        sourceUrl: `local://test-records/${encodeURIComponent(cId)}`,
        verificationMethod: 'Local Synthetic Fixture Comparison',
      };

      return {
        valid_match: {
          id: 'valid_match',
          title: 'Scenario 1: Valid Authoritative Match',
          description: `Evaluates candidate '${cName}' against a reference record with matching identifier '${cId}'.`,
          isSyntheticSimulation: false,
          input: {
            candidateName: cName,
            credentialId: cId,
            issuer: cIssuer,
            courseTitle: cCourse,
            issueDate: cDate,
            consentGranted: true,
            isTestLab: true,
            mockQueryResult: {
              found: true,
              record: mockAuthRecord,
              sourceUrl: mockAuthRecord.sourceUrl,
              sourceType: mockAuthRecord.sourceType,
              method: 'Local Synthetic Fixture Comparison',
              retrievalTimestamp: new Date().toISOString(),
              latencyMs: 28,
              adapter: cIssuer,
              status: 'SUCCESS',
              isTestFixture: true,
              evidenceType: 'Synthetic Test Fixture (Sandbox Isolated)',
              evidenceLabel: 'Sandbox Reference Record',
            }
          },
          expectedOutcome: 'VERIFIED (DEMO)',
          expectedUiStatus: 'VERIFIED (DEMO)',
          assertion: (r) => r.outcome === 'VERIFIED (DEMO)' || r.outcome === 'Demo Match' || r.outcome === 'Verified' || r.outcome === 'Verified Match',
        },
        field_mismatch: {
          id: 'field_mismatch',
          title: 'Scenario 2: Field Mismatch (Identity Alteration Test)',
          description: `Alters candidate name in an isolated test copy to detect identity discrepancies against the reference record.`,
          isSyntheticSimulation: true,
          alteredField: {
            field: 'Candidate Name',
            originalValue: cName,
            alteredValue: `${cName} [Altered Test Copy]`
          },
          input: {
            candidateName: `${cName} [Altered Test Copy]`,
            credentialId: cId,
            issuer: cIssuer,
            courseTitle: cCourse,
            issueDate: cDate,
            consentGranted: true,
            isTestLab: true,
            mockQueryResult: {
              found: true,
              record: mockAuthRecord,
              sourceUrl: mockAuthRecord.sourceUrl,
              sourceType: mockAuthRecord.sourceType,
              method: 'Local Synthetic Fixture Comparison',
              retrievalTimestamp: new Date().toISOString(),
              latencyMs: 32,
              adapter: cIssuer,
              status: 'SUCCESS',
              isTestFixture: true,
              evidenceType: 'Discrepancy Detection Probe (Sandbox Isolated)',
              evidenceLabel: 'Identity Discrepancy Probe',
            }
          },
          expectedOutcome: 'MISMATCH (DEMO)',
          expectedUiStatus: 'MISMATCH (DEMO)',
          assertion: (r) => r.outcome === 'MISMATCH (DEMO)' || r.outcome === 'Demo Mismatch' || r.outcome === 'Mismatch',
        },
        not_found: {
          id: 'not_found',
          title: 'Scenario 3: Record Not Found (Absence Confirmation)',
          description: `Queries a non-existent identifier ('${cId}-VOID') to ensure missing records are reported honestly without hallucination.`,
          isSyntheticSimulation: true,
          alteredField: {
            field: 'Credential Identifier',
            originalValue: cId,
            alteredValue: `${cId}-VOID`
          },
          input: {
            candidateName: cName,
            credentialId: `${cId}-VOID`,
            issuer: cIssuer,
            courseTitle: cCourse,
            issueDate: cDate,
            consentGranted: true,
            isTestLab: true,
            mockQueryResult: {
              found: false,
              record: null,
              sourceUrl: `local://test-records/${encodeURIComponent(cId + '-VOID')}`,
              sourceType: 'Synthetic Test Fixture (Sandbox Isolated)',
              method: 'Synthetic Negative Record Check',
              retrievalTimestamp: new Date().toISOString(),
              latencyMs: 24,
              adapter: cIssuer,
              status: 'NOT_FOUND',
              isTestFixture: true,
              evidenceType: 'Synthetic Negative Test Record',
              evidenceLabel: 'Negative Record Registry Query',
              message: `Reference environment explicitly reports no record exists for identifier '${cId}-VOID'.`
            }
          },
          expectedOutcome: 'NOT FOUND (DEMO)',
          expectedUiStatus: 'NOT FOUND (DEMO)',
          assertion: (r) => r.outcome === 'NOT FOUND (DEMO)' || r.outcome === 'Not Found',
        },
        revoked: {
          id: 'revoked',
          title: 'Scenario 4: Revoked / Expired Status Simulation',
          description: `Simulates an authoritative reference entry whose operational status is marked as REVOKED by the issuer.`,
          isSyntheticSimulation: true,
          simulationLabel: 'SIMULATED REVOCATION',
          input: {
            candidateName: cName,
            credentialId: cId,
            issuer: cIssuer,
            courseTitle: cCourse,
            issueDate: cDate,
            consentGranted: true,
            isTestLab: true,
            mockQueryResult: {
              found: true,
              record: {
                ...mockAuthRecord,
                status: 'REVOKED',
              },
              sourceUrl: mockAuthRecord.sourceUrl,
              sourceType: mockAuthRecord.sourceType,
              method: 'Local Synthetic Fixture Comparison',
              retrievalTimestamp: new Date().toISOString(),
              latencyMs: 31,
              adapter: cIssuer,
              status: 'SUCCESS',
              isTestFixture: true,
              evidenceType: 'Revocation Inspection (Sandbox Isolated)',
              evidenceLabel: 'Revoked Credential Record',
            }
          },
          expectedOutcome: 'REVOKED (DEMO)',
          expectedUiStatus: 'REVOKED (DEMO)',
          assertion: (r) => r.outcome === 'REVOKED (DEMO)' || r.outcome === 'Revoked',
        },
        missing_consent: {
          id: 'missing_consent',
          title: 'Scenario 5: Missing Consent (Deterministic Gate Block)',
          description: `Candidate consent flag is explicitly false. Verifies pipeline halts at Stage 2 without contacting registrar.`,
          isSyntheticSimulation: false,
          input: {
            candidateName: cName,
            credentialId: cId,
            issuer: cIssuer,
            courseTitle: cCourse,
            issueDate: cDate,
            consentGranted: false, // MANDATORY BLOCK
            isTestLab: true,
          },
          expectedOutcome: 'BLOCKED / CONSENT REQUIRED',
          expectedUiStatus: 'BLOCKED / CONSENT REQUIRED',
          assertion: (r) => r.blocked === true || r.outcome === 'BLOCKED / CONSENT REQUIRED' || r.outcome === 'Missing Consent',
        },
        issuer_unavailable: {
          id: 'issuer_unavailable',
          title: 'Scenario 6: Issuer Gateway Timeout / Outage Simulation',
          description: `Simulates network timeout / 504 gateway outage from issuing registrar, halting automated lookup.`,
          isSyntheticSimulation: true,
          simulationLabel: 'SIMULATED OUTAGE / TIMEOUT',
          input: {
            candidateName: cName,
            credentialId: cId,
            issuer: cIssuer,
            courseTitle: cCourse,
            issueDate: cDate,
            consentGranted: true,
            simulateTimeout: true,
            isTestLab: true,
          },
          expectedOutcome: 'INCONCLUSIVE / ISSUER UNAVAILABLE',
          expectedUiStatus: 'INCONCLUSIVE / ISSUER UNAVAILABLE',
          assertion: (r) => r.outcome === 'INCONCLUSIVE / ISSUER UNAVAILABLE' || r.outcome === 'Unable to Verify' || r.outcome === 'Inconclusive / Needs Review' || r.uiStatus === 'INCONCLUSIVE / ISSUER UNAVAILABLE' || r.uiStatus === 'UNABLE TO VERIFY' || r.uiStatus === 'NEEDS REVIEW',
        }
      };
    };

    const runSingleTest = async (def) => {
      const startTime = Date.now();
      const result = await runVerificationPipeline(def.input);
      const executionLatencyMs = Date.now() - startTime;
      const passed = def.assertion ? def.assertion(result) : (result.outcome === def.expectedOutcome);

      return {
        testCaseId: def.id,
        title: def.title,
        description: def.description || '',
        isSyntheticSimulation: Boolean(def.isSyntheticSimulation),
        simulationLabel: def.simulationLabel || null,
        alteredField: def.alteredField || null,
        expectedOutcome: def.expectedOutcome,
        expectedUiStatus: def.expectedUiStatus,
        actualOutcome: result.outcome,
        actualUiStatus: result.uiStatus,
        passed,
        executionLatencyMs,
        details: result,
      };
    };

    // Case 1: Dynamic Credential provided
    if (credential && (credential.candidateName || credential.credentialId)) {
      const activeScenarios = buildDynamicDefinitions(credential);
      const targetScenario = scenarioId || testCaseId;

      if (targetScenario && targetScenario !== 'all') {
        const def = activeScenarios[targetScenario.toLowerCase()];
        if (!def) {
          return res.status(404).json({ success: false, message: `Unknown dynamic scenario: ${targetScenario}` });
        }
        const report = await runSingleTest(def);
        return res.json({ success: true, report });
      }

      // Run all dynamic scenarios in batch
      const allResults = [];
      for (const key of Object.keys(activeScenarios)) {
        allResults.push(await runSingleTest(activeScenarios[key]));
      }

      return res.json({
        success: true,
        dynamic: true,
        credentialTested: {
          candidateName: credential.candidateName,
          credentialId: credential.credentialId,
          issuer: credential.issuer,
        },
        allPassed: allResults.every(r => r.passed),
        passingCount: allResults.filter(r => r.passed).length,
        totalCount: allResults.length,
        reports: allResults,
        timestamp: new Date().toISOString(),
      });
    }

    // Case 2: Legacy static presets (TC1-TC4)
    if (testCaseId && testCaseId !== 'all') {
      const def = legacyDefinitions[testCaseId.toLowerCase()];
      if (!def) {
        return res.status(404).json({ success: false, message: `Unknown test case: ${testCaseId}` });
      }
      const testReport = await runSingleTest(def);
      return res.json({ success: true, report: testReport });
    }

    // Run all legacy test cases in batch
    const allResults = [];
    for (const key of ['tc1', 'tc2', 'tc3', 'tc4']) {
      allResults.push(await runSingleTest(legacyDefinitions[key]));
    }

    const allPassed = allResults.every(r => r.passed);
    res.json({
      success: true,
      legacy: true,
      allPassed,
      passingCount: allResults.filter(r => r.passed).length,
      totalCount: allResults.length,
      reports: allResults,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API /api/test-lab/run Error]', err);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Test lab runner encountered an error.'
    });
  }
});

// 6. Local Development Test Account Confirmation Endpoint (Restricted)
app.post('/api/dev/confirm-test-user', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Dev admin action is strictly prohibited in production mode.'
    });
  }

  const { targetUserId, targetEmail, adminSecret } = req.body || {};
  const token = adminSecret || req.headers['x-dev-admin-secret'];

  const result = await confirmDevelopmentTestUser({
    targetUserId,
    targetEmail,
    adminSecret: token
  });

  return res.status(result.status || 200).json(result);
});

// Fallback for unmatched API routes: return JSON 404, NOT the SPA index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API_ENDPOINT_NOT_FOUND',
    message: `API endpoint '${req.method} ${req.path}' does not exist.`
  });
});

// SPA Catch-all: serve dist/index.html for client-side routing on valid frontend paths
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('CertiSure AI production client build not found. Please run "npm run build" first.');
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[CertiSure AI Server] Running on http://localhost:${PORT}`);
  console.log(`[CertiSure AI Server] Gemini Status: ${isGeminiConfigured() ? 'CONFIGURED' : 'STANDBY (no key)'}`);
  console.log(`[CertiSure AI Server] Static UI: ${fs.existsSync(DIST_DIR) ? 'SERVED FROM /dist' : 'NOT BUILT (Run npm run build)'}`);
});
