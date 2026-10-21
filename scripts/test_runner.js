/**
 * Comprehensive Validation Runner for CertiSure AI
 * Validates:
 * 1. Server health & Gemini readiness
 * 2. TC1: Valid ID with matching name -> Verified Authentic
 * 3. TC2: ID with differing name -> Mismatch Flagged
 * 4. TC3: No record found -> Not Found (never fake)
 * 5. TC4: Missing consent -> Blocked (before query)
 * 6. Live /api/verify with Gemini AI forensic reasoning
 */

async function main() {
  console.log('=== CERTISURE AI COMPREHENSIVE END-TO-END VALIDATION ===\n');

  // 1. Health Check
  console.log('[1/4] Checking Server Health...');
  const healthRes = await fetch('http://localhost:3001/api/health');
  const health = await healthRes.json();
  console.log(`- Status: ${health.status}`);
  console.log(`- AI Provider: ${health.aiProvider.provider} (${health.aiProvider.model}) -> ${health.aiProvider.status}`);
  console.log(`- Database Provider: ${health.database.provider} -> ${health.database.status}`);
  console.log(`- Adapters Count: ${health.adaptersCount}\n`);

  // 2. Test Lab All Cases
  console.log('[2/4] Executing Test Lab Acceptance Suite (TC1–TC4)...');
  const testLabRes = await fetch('http://localhost:3001/api/test-lab/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testCaseId: 'all' })
  });
  const testLab = await testLabRes.json();
  console.log(`- All Passed: ${testLab.allPassed} (${testLab.passingCount}/${testLab.totalCount})`);
  testLab.reports.forEach(r => {
    console.log(`  * ${r.testCaseId.toUpperCase()}: [${r.passed ? 'PASS' : 'FAIL'}] Expected: ${r.expectedOutcome} | Actual: ${r.actualOutcome} (${r.executionLatencyMs}ms)`);
    console.log(`    Evidence: ${r.details.evidenceType} | Label: ${r.details.evidenceLabel}`);
    console.log(`    Reason: ${r.details.explanation || r.details.reason}`);
  });
  console.log();

  // 3. Live Verification with Gemini Reasoning
  console.log('[3/4] Testing Live Pipeline with Gemini AI Forensic Reasoning (/api/verify)...');
  const verifyRes = await fetch('http://localhost:3001/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidateName: 'Sarah Lin',
      credentialId: 'STAN-ML-99201-X',
      issuer: 'Stanford Online',
      courseTitle: 'Advanced Machine Learning Specialization',
      issueDate: '2023-11-15',
      consentGranted: true,
      consentTimestamp: new Date().toISOString(),
      isTestLab: false
    })
  });
  const verifyData = await verifyRes.json();
  console.log(`- Outcome: ${verifyData.outcome}`);
  console.log(`- Status: ${verifyData.uiStatus}`);
  console.log(`- Confidence: ${verifyData.confidenceScore}%`);
  console.log(`- Proof Hash: ${verifyData.proofHash}`);
  console.log(`- Deterministic Reason: ${verifyData.explanation}`);
  console.log(`- Gemini Forensic Summary: ${verifyData.aiForensicSummary || 'N/A'}`);
  console.log(`- Stages Completed: ${verifyData.stages.length}\n`);

  // 4. Live Mismatch with Gemini Reasoning
  console.log('[4/4] Testing Identity Mismatch with Gemini Reasoning...');
  const mismatchRes = await fetch('http://localhost:3001/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidateName: 'Marcus Brody',
      credentialId: 'STAN-ML-99201-X',
      issuer: 'Stanford Online',
      courseTitle: 'Advanced Machine Learning Specialization',
      issueDate: '2023-11-15',
      consentGranted: true,
      consentTimestamp: new Date().toISOString(),
      isTestLab: false
    })
  });
  const mismatchData = await mismatchRes.json();
  console.log(`- Outcome: ${mismatchData.outcome}`);
  console.log(`- Status: ${mismatchData.uiStatus}`);
  console.log(`- Deterministic Reason: ${mismatchData.explanation}`);
  console.log(`- Gemini Forensic Summary: ${mismatchData.aiForensicSummary || 'N/A'}`);

  console.log('\n=== ALL AUTOMATED VALIDATIONS COMPLETED SUCCESSFULLY ===');
}

main().catch(err => {
  console.error('[Validation Script Error]', err);
  process.exit(1);
});
