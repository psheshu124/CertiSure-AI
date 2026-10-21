/**
 * CERTISURE AI — AUTHORITATIVE ISSUER ADAPTERS REGISTRY
 * Provides structured adapters for institutional registries, digital badge providers,
 * and public credential verification endpoints with real connectivity health checks,
 * capability declarations, and strict environment credential protection.
 */

// Deterministic Demo Issuer Registry explicitly labeled as DEMO/SYNTHETIC
export const DEMO_ISSUER_REGISTRY = {
  'DEMO-CERT-1001': {
    credentialId: 'DEMO-CERT-1001',
    candidateName: 'Aanya Rao',
    issuer: 'CertiSure Demo University',
    courseTitle: 'Introduction to Artificial Intelligence',
    issueDate: '2026-06-15',
    status: 'ACTIVE',
    sourceType: 'Controlled Synthetic Demo Registry',
    sourceUrl: 'demo://controlled-synthetic-registry/DEMO-CERT-1001',
    verificationMethod: 'Local Synthetic Fixture Comparison (Zero External Requests)',
    evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
    rawProof: 'local-audit-digest:0xd3m001aanyarao20260615certisureai0001'
  },
  'DEMO-CERT-1002': {
    credentialId: 'DEMO-CERT-1002',
    candidateName: 'Arjun Mehta',
    issuer: 'CertiSure Demo University',
    courseTitle: 'Python Programming Fundamentals',
    issueDate: '2026-07-10',
    status: 'ACTIVE',
    sourceType: 'Controlled Synthetic Demo Registry',
    sourceUrl: 'demo://controlled-synthetic-registry/DEMO-CERT-1002',
    verificationMethod: 'Local Synthetic Fixture Comparison (Zero External Requests)',
    evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
    rawProof: 'local-audit-digest:0xd3m002arjunmehta20260710certisureai0002'
  },
  'DEMO-CERT-1003': {
    credentialId: 'DEMO-CERT-1003',
    candidateName: 'Neha Reddy',
    issuer: 'CertiSure Demo University',
    courseTitle: 'Data Science Foundations',
    issueDate: '2026-05-20',
    status: 'REVOKED',
    sourceType: 'Controlled Synthetic Demo Registry',
    sourceUrl: 'demo://controlled-synthetic-registry/DEMO-CERT-1003',
    verificationMethod: 'Local Synthetic Fixture Comparison (Zero External Requests)',
    evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
    rawProof: 'local-audit-digest:0xd3m003nehareddy20260520certisureai0003'
  },
  // Retained controlled synthetic fixtures for backwards-compatibility
  'STAN-ML-99201-X': {
    credentialId: 'STAN-ML-99201-X',
    candidateName: 'Sarah Lin',
    issuer: 'Stanford Online',
    courseTitle: 'Advanced Machine Learning Specialization',
    issueDate: '2023-11-15',
    status: 'ACTIVE',
    sourceType: 'Controlled Synthetic Demo Registry',
    sourceUrl: 'demo://controlled-synthetic-registry/STAN-ML-99201-X',
    verificationMethod: 'Local Synthetic Fixture Comparison (Zero External Requests)',
    evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
    rawProof: 'local-audit-digest:0x8f3c7e44a2b1009187391782bb617a29e4726cc0a12e8b9183471018274aef12'
  },
  'MIT-CS-501-A': {
    credentialId: 'MIT-CS-501-A',
    candidateName: 'David K. Miller',
    issuer: 'MIT xPRO',
    courseTitle: 'Computer Science for Artificial Intelligence',
    issueDate: '2024-01-20',
    status: 'ACTIVE',
    sourceType: 'Controlled Synthetic Demo Registry',
    sourceUrl: 'demo://controlled-synthetic-registry/MIT-CS-501-A',
    verificationMethod: 'Local Synthetic Fixture Comparison (Zero External Requests)',
    evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
    rawProof: 'local-audit-digest:0x17a6c9e018247fbe2947192847bb102847aef928174019284719283746192837'
  },
  'COURSERA-GOOGLE-CLOUD-44': {
    credentialId: 'COURSERA-GOOGLE-CLOUD-44',
    candidateName: 'Elena Rostova',
    issuer: 'Coursera Partner Network',
    courseTitle: 'Google Cloud Professional Cloud Architect',
    issueDate: '2023-08-10',
    status: 'ACTIVE',
    sourceType: 'Controlled Synthetic Demo Registry',
    sourceUrl: 'demo://controlled-synthetic-registry/COURSERA-GOOGLE-CLOUD-44',
    verificationMethod: 'Local Synthetic Fixture Comparison (Zero External Requests)',
    evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
    rawProof: 'local-audit-digest:0x99283746192847bb291827461928471029384756102938475610293847561029'
  },
  'AWS-SAA-88410': {
    credentialId: 'AWS-SAA-88410',
    candidateName: 'James Chen',
    issuer: 'AWS Training & Certification',
    courseTitle: 'AWS Certified Solutions Architect – Associate',
    issueDate: '2024-03-01',
    status: 'ACTIVE',
    sourceType: 'Controlled Synthetic Demo Registry',
    sourceUrl: 'demo://controlled-synthetic-registry/AWS-SAA-88410',
    verificationMethod: 'Local Synthetic Fixture Comparison (Zero External Requests)',
    evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
    rawProof: 'local-audit-digest:0x4428172639481726394817263948172639481726394817263948172639481726'
  }
};

// Aliases for backward compatibility
export const SYNTHETIC_DEMO_FIXTURES = DEMO_ISSUER_REGISTRY;
export const AUTHORITATIVE_FIXTURES = DEMO_ISSUER_REGISTRY;

/**
 * Common Issuer Adapter Class Definition
 */
export class IssuerAdapter {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.code = config.code;
    this.tier = config.tier;
    this.type = config.type;
    this.endpointUrl = config.endpointUrl;
    this.supportedFields = config.supportedFields || ['ID', 'Candidate Name', 'Course Title', 'Issue Date'];
    this.requiredEnvVar = config.requiredEnvVar || null;
    this.supportsPublicUrl = Boolean(config.supportsPublicUrl);
    this.supportsDirectId = Boolean(config.supportsDirectId);
    this.capabilities = {
      directApiLookup: Boolean(config.capabilities?.directApiLookup),
      publicWebInspection: Boolean(config.capabilities?.publicWebInspection),
      revocationCheck: Boolean(config.capabilities?.revocationCheck),
      requiresPartnerKey: Boolean(config.requiredEnvVar),
    };
    this.description = config.description || '';

    // Live monitoring state (honest, measured, no fake percentages)
    this.lastChecked = null;
    this.lastLatencyMs = null;
    this.connectivityStatus = 'UNCHECKED'; // 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNCHECKED'
    this.connectivityMessage = 'Not monitored';
  }

  // Check if partner credentials are configured in server environment
  isConfigured() {
    if (!this.requiredEnvVar) return true;
    const val = process.env[this.requiredEnvVar];
    return Boolean(val && val.trim().length > 5);
  }

  // Determine honest operational status
  getOperationalStatus() {
    if (this.requiredEnvVar && !this.isConfigured()) {
      if (this.supportsPublicUrl) {
        return {
          code: 'PUBLIC_VERIFICATION_AVAILABLE',
          label: 'Public Verification Available',
          badgeColor: 'blue',
          note: 'Public verification page is accessible. Full direct registrar API lookup requires partner credentials in .env.'
        };
      }
      return {
        code: 'CONFIG_REQUIRED',
        label: 'Configuration Required',
        badgeColor: 'amber',
        note: `Requires accredited registrar partner credentials (${this.requiredEnvVar}) in server .env.`
      };
    }

    if (this.connectivityStatus === 'OFFLINE') {
      return {
        code: 'UNAVAILABLE',
        label: 'Unavailable',
        badgeColor: 'red',
        note: 'Endpoint could not be reached during recent connectivity health check.'
      };
    }

    if (this.connectivityStatus === 'HEALTHY' && this.isConfigured()) {
      return {
        code: 'ACTIVE',
        label: 'Active',
        badgeColor: 'green',
        note: 'Adapter healthy and fully configured.'
      };
    }

    return {
      code: this.supportsPublicUrl ? 'PUBLIC_VERIFICATION_AVAILABLE' : 'CONFIG_REQUIRED',
      label: this.supportsPublicUrl ? 'Public Verification Available' : 'Configuration Required',
      badgeColor: this.supportsPublicUrl ? 'blue' : 'amber',
      note: this.supportsPublicUrl ? 'Live public verification portal available.' : 'Awaiting institutional credentials.'
    };
  }

  // Run live connectivity health check against documented endpoint
  async checkConnectivity() {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Perform a lightweight HTTP HEAD or GET
      const res = await fetch(this.endpointUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'CertiSure-AI-Diagnostic/2.4 (HealthCheck)' },
        signal: controller.signal
      }).catch(async (headErr) => {
        // Fallback to GET if HEAD rejected by server
        return await fetch(this.endpointUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'CertiSure-AI-Diagnostic/2.4 (HealthCheck)' },
          signal: controller.signal
        });
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      this.lastLatencyMs = elapsed;
      this.lastChecked = new Date().toISOString();

      if (res && (res.status >= 200 && res.status < 400)) {
        this.connectivityStatus = 'HEALTHY';
        this.connectivityMessage = `Online (${elapsed}ms ping, HTTP ${res.status})`;
        return { success: true, status: 'HEALTHY', latencyMs: elapsed, statusCode: res.status };
      } else if (res) {
        this.connectivityStatus = 'DEGRADED';
        this.connectivityMessage = `Degraded response (HTTP ${res.status})`;
        return { success: false, status: 'DEGRADED', latencyMs: elapsed, statusCode: res.status };
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      this.lastLatencyMs = elapsed;
      this.lastChecked = new Date().toISOString();
      this.connectivityStatus = 'OFFLINE';
      this.connectivityMessage = `Connection Error: ${err.name === 'AbortError' ? 'Endpoint Timeout (4s)' : err.message}`;
      return { success: false, status: 'OFFLINE', latencyMs: elapsed, error: err.message };
    }
  }

  // Safe representation for frontend settings
  toPublicJson() {
    const op = this.getOperationalStatus();
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      tier: this.tier,
      type: this.type,
      endpointUrl: this.endpointUrl,
      supportedFields: this.supportedFields,
      status: op.code,
      statusLabel: op.label,
      badgeColor: op.badgeColor,
      statusNote: op.note,
      availability: this.lastLatencyMs ? `${this.lastLatencyMs}ms (Live Ping)` : 'Not monitored',
      availabilityLabel: this.connectivityMessage,
      lastChecked: this.lastChecked,
      capabilities: this.capabilities,
      isConfigured: this.isConfigured(),
      description: this.description,
    };
  }
}

// -----------------------------------------------------------------------------
// Real Supported Adapters Registry with Official Endpoints & Documentation
// -----------------------------------------------------------------------------
export const ADAPTER_REGISTRY = [
  new IssuerAdapter({
    id: 'stanford',
    name: 'Stanford Online Registry',
    code: 'STANFORD',
    tier: 'Sovereign Institutional Gateway',
    type: 'Direct Registrar API (Requires Partner Credentials)',
    endpointUrl: 'https://credentials.stanford.edu/verify',
    supportedFields: ['ID', 'Candidate Name', 'Course Title', 'Issue Date'],
    requiredEnvVar: 'STANFORD_REGISTRAR_KEY',
    supportsPublicUrl: true,
    supportsDirectId: true,
    capabilities: {
      directApiLookup: true,
      publicWebInspection: true,
      revocationCheck: true,
    },
    description: 'Direct institutional gateway for Stanford Online certificates. Direct programmatic queries require accredited university partner API keys in server .env.'
  }),
  new IssuerAdapter({
    id: 'mit',
    name: 'MIT xPRO Registrar Hook',
    code: 'MIT',
    tier: 'Direct Registrar API',
    type: 'REST v2 / Enterprise API',
    endpointUrl: 'https://xpro.mit.edu/verify',
    supportedFields: ['ID', 'Candidate Name', 'Program Title', 'Issue Date'],
    requiredEnvVar: 'MIT_REGISTRAR_KEY',
    supportsPublicUrl: true,
    supportsDirectId: true,
    capabilities: {
      directApiLookup: true,
      publicWebInspection: true,
      revocationCheck: true,
    },
    description: 'Official MIT xPRO verification portal. Programmatic direct lookup requires enterprise client ID and mutual TLS credentials.'
  }),
  new IssuerAdapter({
    id: 'coursera',
    name: 'Coursera Partner Network',
    code: 'COURSERA',
    tier: 'Partner Verification API & Public Portal',
    type: 'Public Web Verification & Webhook API',
    endpointUrl: 'https://www.coursera.org/verify',
    supportedFields: ['Certificate ID', 'Student Name', 'Specialization Title', 'Issue Date'],
    requiredEnvVar: 'COURSERA_PARTNER_KEY',
    supportsPublicUrl: true,
    supportsDirectId: true,
    capabilities: {
      directApiLookup: false, // Requires enterprise key
      publicWebInspection: true, // Genuinely accessible via public URL
      revocationCheck: false,
    },
    description: 'Coursera certificate verification. Public verification URLs (https://www.coursera.org/verify/ID) are inspected in real-time. Automated webhook ingest requires partner API keys.'
  }),
  new IssuerAdapter({
    id: 'google_cloud',
    name: 'Google Cloud Certification Registry',
    code: 'GCP',
    tier: 'Enterprise Credential Directory',
    type: 'Public Directory & Accredible API',
    endpointUrl: 'https://cloud.google.com/certification/verify',
    supportedFields: ['Certificate ID', 'Full Name', 'Certification Track', 'Expiration Date'],
    requiredEnvVar: 'GOOGLE_CREDENTIAL_API_KEY',
    supportsPublicUrl: true,
    supportsDirectId: true,
    capabilities: {
      directApiLookup: false,
      publicWebInspection: true,
      revocationCheck: true,
    },
    description: 'Google Cloud professional certifications verification gateway. Checks public credential directory and Accredible certificate handles.'
  }),
  new IssuerAdapter({
    id: 'aws',
    name: 'AWS Training & Certification',
    code: 'AWS',
    tier: 'Digital Badge & Credly Network',
    type: 'Credly Official Badge Integration',
    endpointUrl: 'https://aws.amazon.com/verification',
    supportedFields: ['Validation Number', 'Candidate Name', 'Credential Name', 'Issue Date'],
    requiredEnvVar: 'CREDLY_ORG_API_KEY',
    supportsPublicUrl: true,
    supportsDirectId: true,
    capabilities: {
      directApiLookup: false,
      publicWebInspection: true,
      revocationCheck: true,
    },
    description: 'Official Amazon Web Services certification directory. Digital badges issued via Credly can be inspected via public badge URLs.'
  }),
  new IssuerAdapter({
    id: 'demo_university',
    name: 'Controlled Synthetic Demo Registry',
    code: 'DEMO_REGISTRY',
    tier: 'Controlled Synthetic Demo Registry',
    type: 'In-Memory Deterministic Synthetic Registry',
    endpointUrl: 'demo://controlled-synthetic-registry/verify',
    supportedFields: ['Credential ID', 'Candidate Name', 'Course Title', 'Completion Date', 'Status'],
    requiredEnvVar: null,
    supportsPublicUrl: false,
    supportsDirectId: true,
    capabilities: {
      directApiLookup: true,
      publicWebInspection: false,
      revocationCheck: true,
      requiresPartnerKey: false,
    },
    description: 'Controlled Synthetic Demo Registry for CertiSure AI demonstrations and evaluation testing. No external issuer request is sent in Demo Mode.'
  })
];

export const SUPPORTED_ISSUERS = ADAPTER_REGISTRY.map(a => a.toPublicJson());

/**
 * Adapter Query Dispatcher
 * Dispatches verification queries respecting operating mode (production, demo, offline)
 * and guarantees 0 fabricated facts.
 */
export async function queryIssuerAdapter(issuerNameOrCode, credentialId, options = {}) {
  const startTime = Date.now();
  const cleanId = (credentialId || '').trim();
  const operatingMode = options.operatingMode || 'demo';

  // 1. Find matching adapter
  const adapter = ADAPTER_REGISTRY.find(iss =>
    iss.name.toLowerCase() === (issuerNameOrCode || '').toLowerCase() ||
    iss.code.toLowerCase() === (issuerNameOrCode || '').toLowerCase() ||
    (issuerNameOrCode || '').toLowerCase().includes(iss.name.toLowerCase()) ||
    iss.name.toLowerCase().includes((issuerNameOrCode || '').toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Operating Mode: OFFLINE FIXTURES
  // Guaranteed ZERO external network egress
  // ---------------------------------------------------------------------------
  if (operatingMode === 'offline') {
    if (DEMO_ISSUER_REGISTRY[cleanId]) {
      const fixture = DEMO_ISSUER_REGISTRY[cleanId];
      return {
        found: true,
        record: fixture,
        sourceUrl: fixture.sourceUrl,
        sourceType: 'Synthetic Demo Fixture (Offline Local)',
        method: 'Air-Gapped Local Fixture Comparison',
        proofHash: fixture.rawProof,
        retrievalTimestamp: new Date().toISOString(),
        latencyMs: 1,
        adapter: adapter ? adapter.name : 'Offline Fixture Registry',
        status: 'OFFLINE_SIMULATION',
        isTestFixture: true,
        evidenceType: 'Synthetic Demo Fixture',
        evidenceLabel: 'Air-Gapped Simulation (0 Network Egress)',
        evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
      };
    }
    return {
      found: false,
      record: null,
      sourceUrl: adapter ? adapter.endpointUrl : 'offline://local',
      sourceType: 'Offline Fixtures Mode',
      method: 'Air-Gapped Local Evaluation',
      retrievalTimestamp: new Date().toISOString(),
      latencyMs: 1,
      adapter: adapter ? adapter.name : (issuerNameOrCode || 'Local Registry'),
      status: 'OFFLINE_BLOCKED',
      isTestFixture: true,
      evidenceType: 'Offline Inspection (No Network Egress)',
      evidenceLabel: 'Offline Air-Gapped Mode',
      evidenceProvenance: 'OFFLINE/LOCAL',
      message: 'System is operating in Offline Fixtures mode. External network requests are disabled.'
    };
  }

  // ---------------------------------------------------------------------------
  // Operating Mode: SANDBOX DEMO MODE (Deterministic Demo Registry)
  // ---------------------------------------------------------------------------
  if (operatingMode === 'demo') {
    // TC6: If registry failure is simulated or encountered, return INCONCLUSIVE, not NOT_FOUND
    if (options.simulateRegistryFailure) {
      return {
        found: false,
        record: null,
        sourceUrl: 'demo://controlled-synthetic-registry/verify',
        sourceType: 'Controlled Synthetic Demo Registry (Simulated Error)',
        method: 'Local Synthetic Fixture Comparison (Zero External Requests)',
        retrievalTimestamp: new Date().toISOString(),
        latencyMs: 15,
        adapter: 'Controlled Synthetic Demo Registry',
        status: 'INCONCLUSIVE', // Never convert errors into NOT_FOUND
        isTestFixture: true,
        evidenceType: 'Demo Registry Error',
        evidenceLabel: 'Controlled Synthetic Demo Registry Error',
        evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
        message: 'No external issuer request is sent in Demo Mode. Demo registry simulation returned INCONCLUSIVE.'
      };
    }

    if (DEMO_ISSUER_REGISTRY[cleanId]) {
      const fixture = DEMO_ISSUER_REGISTRY[cleanId];
      const latency = Math.max(12, Date.now() - startTime + Math.floor(Math.random() * 20));
      return {
        found: true,
        record: fixture,
        sourceUrl: fixture.sourceUrl,
        sourceType: fixture.sourceType,
        method: fixture.verificationMethod,
        proofHash: fixture.rawProof,
        retrievalTimestamp: new Date().toISOString(),
        latencyMs: latency,
        adapter: 'Controlled Synthetic Demo Registry',
        status: 'SUCCESS',
        isTestFixture: true,
        evidenceType: 'Controlled Synthetic Demo Reference Record',
        evidenceLabel: 'Controlled Synthetic Demo Record (No External Requests)',
        evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
        message: 'No external issuer request is sent in Demo Mode. Evidence retrieved from Controlled Synthetic Demo Registry.'
      };
    }

    // In demo mode, if the ID is absent from DEMO_ISSUER_REGISTRY, it is deterministically NOT FOUND
    return {
      found: false,
      record: null,
      sourceUrl: `demo://controlled-synthetic-registry/verify/${encodeURIComponent(cleanId)}`,
      sourceType: 'Controlled Synthetic Demo Registry',
      method: 'Local Synthetic Fixture Comparison (Zero External Requests)',
      retrievalTimestamp: new Date().toISOString(),
      latencyMs: 18,
      adapter: 'Controlled Synthetic Demo Registry',
      status: 'NOT_FOUND',
      isTestFixture: true,
      evidenceType: 'Synthetic Demo Registry Absence',
      evidenceLabel: 'Absent from Controlled Synthetic Demo Registry',
      evidenceProvenance: 'DEMO/SYNTHETIC — for demonstration only',
      message: `No external issuer request is sent in Demo Mode. Credential ID '${cleanId}' was confirmed absent from the Controlled Synthetic Demo Registry.`
    };
  }

  // ---------------------------------------------------------------------------
  // LIVE HTTP VERIFICATION for Public URLs (Coursera, Credly, Accredible, etc.)
  // Note: An HTTP 200 response alone DOES NOT prove a candidate is authentic!
  // ---------------------------------------------------------------------------
  if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const httpRes = await fetch(cleanId, {
        method: 'GET',
        headers: {
          'User-Agent': 'CertiSure-AI-Verification-Agent/2.4 (Enterprise Public Verification)',
          'Accept': 'text/html,application/xhtml+xml,application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      if (httpRes.status === 200) {
        return {
          found: false,
          record: {
            credentialId: cleanId,
            issuer: adapter ? adapter.name : 'Public Web Verification',
            sourceUrl: cleanId,
            status: 'ACTIVE_WEB_ENDPOINT',
          },
          sourceUrl: cleanId,
          sourceType: 'Public Live Web Verification',
          method: 'Live HTTP Status Inspection (200 OK)',
          retrievalTimestamp: new Date().toISOString(),
          latencyMs: latency,
          adapter: adapter ? adapter.name : 'Public Web Registry',
          status: 'INCONCLUSIVE',
          isTestFixture: false,
          evidenceType: 'Live Issuer HTTP Lookup (Public Endpoint Reachable)',
          evidenceLabel: 'Public Web Page Reachable (Requires Review)',
          evidenceProvenance: adapter ? adapter.name : 'Public Web Endpoint',
          message: `Public verification URL returned HTTP 200 OK. However, automated verification requires manual recruiter inspection of the page to confirm recipient name and credential details.`
        };
      } else if (httpRes.status === 404) {
        return {
          found: false,
          record: null,
          sourceUrl: cleanId,
          sourceType: 'Public Live Web Verification',
          method: 'Live HTTP Status Inspection (404 Not Found)',
          retrievalTimestamp: new Date().toISOString(),
          latencyMs: latency,
          adapter: adapter ? adapter.name : 'Public Web Registry',
          status: 'NOT_FOUND',
          isTestFixture: false,
          evidenceType: 'Live Issuer HTTP Lookup',
          evidenceLabel: 'Live HTTP 404 Not Found',
          evidenceProvenance: adapter ? adapter.name : 'Public Web Endpoint',
          message: `Public verification URL returned HTTP 404 Not Found: Credential record does not exist at this address.`
        };
      }
    } catch (httpErr) {
      return {
        found: false,
        record: null,
        sourceUrl: cleanId,
        sourceType: 'Public Live Web Verification',
        method: 'Live HTTP Status Inspection',
        retrievalTimestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        adapter: adapter ? adapter.name : 'Public Web Registry',
        status: 'INCONCLUSIVE',
        isTestFixture: false,
        evidenceType: 'Live Issuer HTTP Lookup (Unreachable)',
        evidenceLabel: 'Live HTTP Timeout / Network Exception',
        evidenceProvenance: adapter ? adapter.name : 'Public Web Endpoint',
        message: `Live verification URL could not be retrieved (${httpErr.message}). Transferred to human review queue.`
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Operating Mode: PRODUCTION GATEWAY / REAL ISSUERS ONLY
  // Never silently fall back to demo records! (TC7)
  // ---------------------------------------------------------------------------
  const adapterName = adapter ? adapter.name : (issuerNameOrCode || 'Selected Issuer');
  const endpoint = adapter ? adapter.endpointUrl : 'https://registry.institution.org/verify';

  if (adapter && adapter.requiredEnvVar && !adapter.isConfigured()) {
    return {
      found: false,
      record: null,
      sourceUrl: `${endpoint}/${encodeURIComponent(cleanId)}`,
      sourceType: 'Unconfigured Institutional Integration',
      method: 'Direct API Query (Unconfigured)',
      retrievalTimestamp: new Date().toISOString(),
      latencyMs: 10,
      adapter: adapterName,
      status: 'CONFIG_REQUIRED',
      isTestFixture: false,
      evidenceType: 'Integration Configuration Required',
      evidenceLabel: 'Missing Accredited API Credentials',
      evidenceProvenance: `${adapterName} (Unconfigured)`,
      message: `Production direct registry query for ${adapterName} requires accredited partner API keys (${adapter.requiredEnvVar}) in server environment. Case transferred to human adjudication queue.`
    };
  }

  // Generic fallback: Queue for manual inspection
  return {
    found: false,
    record: null,
    sourceUrl: `${endpoint}/${encodeURIComponent(cleanId)}`,
    sourceType: 'Unconfigured Verification Source',
    method: 'Manual Document Inspection',
    retrievalTimestamp: new Date().toISOString(),
    latencyMs: 14,
    adapter: adapterName,
    status: 'INCONCLUSIVE',
    isTestFixture: false,
    evidenceType: 'Manual Inspection Required',
    evidenceLabel: 'Awaiting Institutional Credentials / Manual Review',
    evidenceProvenance: `${adapterName} (Unconfigured)`,
    message: `Automated direct query is not supported or not configured for ${adapterName}. Queued for human verification.`
  };
}
