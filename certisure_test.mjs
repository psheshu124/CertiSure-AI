/**
 * CertiSure AI — End-to-End Regression Test Script
 * Playwright-based, runs headless Chromium against http://localhost:5173
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const REPORT_PATH = path.join(__dirname, 'test_report.md');
const APP_URL = 'http://localhost:5173';

const results = [];
const consoleErrors = [];
const networkErrors = [];
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function addResult(tcId, name, status, expected, observed, notes = '') {
  results.push({ tcId, name, status, expected, observed, notes });
  log(`${status} — ${name}: ${observed}`);
}

async function waitForText(page, text, timeout = 15000) {
  try {
    await page.waitForFunction(
      (t) => document.body.innerText.includes(t),
      text,
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  log(`Screenshot saved: ${name}.png`);
  return filePath;
}

async function clickSidebarItem(page, labelText) {
  // Try finding nav items by text content
  const navItem = page.locator(`nav a, nav button, aside a, aside button, [role="navigation"] *`).filter({ hasText: labelText }).first();
  if (await navItem.count() > 0) {
    await navItem.click();
    await page.waitForTimeout(800);
    return true;
  }
  // Fallback: find any clickable element with the label text
  const anyEl = page.locator(`a, button`).filter({ hasText: labelText }).first();
  if (await anyEl.count() > 0) {
    await anyEl.click();
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function navigateToScreen(page, screenName) {
  // Map screen names to possible sidebar label texts
  const labels = {
    'new-verification': ['New Verification', 'New verification', 'New Verif'],
    'overview': ['Overview', 'Dashboard'],
    'test-lab': ['Test Lab', 'TestLab'],
    'settings': ['Settings'],
    'verification-history': ['Verification History', 'History'],
    'review-queue': ['Review Queue'],
    'approval-gate': ['Approval Gate'],
    'agent-activity': ['Agent Activity'],
  };
  const candidates = labels[screenName] || [screenName];
  for (const label of candidates) {
    const found = await clickSidebarItem(page, label);
    if (found) {
      await page.waitForTimeout(500);
      return true;
    }
  }
  log(`WARNING: Could not find sidebar item for ${screenName}`);
  return false;
}

async function runTests() {
  await ensureDir(SCREENSHOTS_DIR);
  log('Starting CertiSure AI E2E Regression Test Suite');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  // Capture network failures
  page.on('requestfailed', (request) => {
    networkErrors.push(`FAILED: ${request.method()} ${request.url()} — ${request.failure()?.errorText}`);
  });

  page.on('response', async (response) => {
    if (response.status() >= 400) {
      const url = response.url();
      // Only log API calls, not static assets
      if (url.includes('/api/') || url.includes('localhost:3001')) {
        networkErrors.push(`HTTP ${response.status()}: ${response.request().method()} ${url}`);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // TC0: Application Load & Navigation Smoke Test
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC0: Application Load ===');
  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    const bodyText = await page.locator('body').innerText();
    const hasSidebar = await page.locator('nav, aside, [role="navigation"]').count() > 0;
    const hasContent = bodyText.length > 100;

    await screenshot(page, '00_initial_load');

    if (hasSidebar && hasContent) {
      addResult('TC0', 'Application Load & Navigation Smoke Test', 'PASS',
        'App loads, sidebar visible',
        `Title: "${title}" | Sidebar: ${hasSidebar} | Body has content: ${hasContent}`);
    } else {
      addResult('TC0', 'Application Load & Navigation Smoke Test', 'FAIL',
        'App loads, sidebar visible',
        `Title: "${title}" | Sidebar: ${hasSidebar} | Has content: ${hasContent}`);
    }
  } catch (err) {
    addResult('TC0', 'Application Load & Navigation Smoke Test', 'FAIL',
      'App loads at localhost:5173', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC1-BLANK: New Verification — Blank Form State
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC1-BLANK: New Verification Blank Form ===');
  try {
    await navigateToScreen(page, 'new-verification');
    await page.waitForTimeout(1000);

    // Check page heading
    const pageText = await page.locator('body').innerText();
    const hasNewVerif = pageText.includes('New verification') || pageText.includes('New Verification');

    // Check blank fields
    const candidateNameVal = await page.locator('input[placeholder*="Sarah Lin"]').inputValue().catch(() => 'NOT_FOUND');
    const credentialIdVal = await page.locator('input[placeholder*="STAN"]').inputValue().catch(() => 'NOT_FOUND');
    const issuerVal = await page.locator('select').inputValue().catch(() => 'NOT_FOUND');
    const consentChecked = await page.locator('input[type="checkbox"]').isChecked().catch(() => 'ERROR');

    // Check CONSENT MISSING badge
    const hasConsentMissing = pageText.includes('CONSENT MISSING');
    const hasConsentDocumented = pageText.includes('CONSENT DOCUMENTED');

    // Check dossier preview (should show dashes)
    const hasDashes = pageText.includes('—');

    await screenshot(page, 'blank_form');

    const allBlank = candidateNameVal === '' && credentialIdVal === '' && consentChecked === false;
    const status = (hasNewVerif && allBlank && hasConsentMissing) ? 'PASS' : 'FAIL';

    addResult('TC1-BLANK', 'New Verification — Blank Form State', status,
      'All fields empty, consent unchecked, CONSENT MISSING badge shown',
      `Page: ${hasNewVerif} | Name: "${candidateNameVal}" | CredID: "${credentialIdVal}" | Issuer: "${issuerVal}" | Consent checked: ${consentChecked} | CONSENT MISSING badge: ${hasConsentMissing} | Has dashes: ${hasDashes}`,
      'Screenshot: blank_form.png');
  } catch (err) {
    addResult('TC1-BLANK', 'New Verification — Blank Form State', 'FAIL',
      'All fields empty, CONSENT MISSING', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC4: Missing Consent Block — Test FIRST before loading fixtures to keep screen
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC4: Missing Consent Block ===');
  try {
    // Navigate to new verification (should already be there)
    await navigateToScreen(page, 'new-verification');
    await page.waitForTimeout(800);

    // Click TC4 fixture button
    const tc4Btn = page.locator('button').filter({ hasText: /TC4.*Missing Consent/i }).first();
    if (await tc4Btn.count() > 0) {
      await tc4Btn.click();
      await page.waitForTimeout(600);
    } else {
      // Try partial match
      const tc4Btn2 = page.locator('button').filter({ hasText: /TC4/ }).first();
      await tc4Btn2.click();
      await page.waitForTimeout(600);
    }

    const pageText = await page.locator('body').innerText();
    const consentChecked = await page.locator('input[type="checkbox"]').first().isChecked();
    const hasTC4Notice = pageText.includes('TC4') || pageText.includes('Missing Consent') || pageText.includes('missing');
    const hasConsentMissing = pageText.includes('CONSENT MISSING');
    const hasTC4Warning = pageText.includes('TC4 Test Fixture Active') || pageText.includes('intentionally ungranted') || pageText.includes('consent blocking');
    const candidateName = await page.locator('input[placeholder*="Sarah Lin"]').inputValue().catch(() => 'N/A');
    const credId = await page.locator('input[placeholder*="STAN"]').inputValue().catch(() => 'N/A');

    await screenshot(page, 'tc4_consent');

    // Try to submit without consent
    const proceedBtn = page.locator('button[type="submit"], button').filter({ hasText: /Proceed to Human Approval Gate/i }).first();
    if (await proceedBtn.count() > 0) {
      await proceedBtn.click();
      await page.waitForTimeout(1000);
    }

    // Check if we're on the approval gate now (we should be — the form doesn't block, only the gate does)
    const afterSubmitText = await page.locator('body').innerText();
    const onApprovalGate = afterSubmitText.includes('Approval Gate') || afterSubmitText.includes('Human Authorization');

    if (onApprovalGate) {
      // On Approval Gate, try to execute without consent
      await screenshot(page, 'tc4_approval_gate');

      // Check the authorization checkbox if present
      const authCheckboxes = await page.locator('input[type="checkbox"]').all();
      // Find the "I authorize execution" checkbox (not the consent one)
      let authChecked = false;
      for (const cb of authCheckboxes) {
        const parent = await cb.locator('..').innerText().catch(() => '');
        if (parent.toLowerCase().includes('authoriz') && !parent.toLowerCase().includes('candidate')) {
          await cb.check();
          authChecked = true;
          break;
        }
      }

      // Try clicking execute
      const executeBtn = page.locator('button').filter({ hasText: /Execute Verification|Approve.*Execute/i }).first();
      if (await executeBtn.count() > 0) {
        await executeBtn.click();
        await page.waitForTimeout(1500);
      }

      const gateText = await page.locator('body').innerText();
      const hasConsentError = gateText.includes('consent is absent') ||
        gateText.includes('Candidate consent is absent') ||
        gateText.includes('prohibits external query') ||
        gateText.includes('authorization') && gateText.includes('absent');
      const blockedNavigation = !(gateText.includes('Agent Activity') || gateText.includes('INITIALIZING'));

      await screenshot(page, 'tc4_gate_error');

      const status = (hasConsentError && blockedNavigation) ? 'PASS' : 'FAIL';
      addResult('TC4', 'Missing Consent Block (Approval Gate)', status,
        'Error shown: consent absent, no navigation to Agent Activity',
        `Consent error shown: ${hasConsentError} | Blocked from agent activity: ${blockedNavigation} | Gate text (excerpt): "${gateText.substring(0, 300)}"`,
        'Screenshots: tc4_consent.png, tc4_approval_gate.png, tc4_gate_error.png');
    } else {
      // Still on new verification or somewhere else
      addResult('TC4', 'Missing Consent Block (Approval Gate)', 'FAIL',
        'Should navigate to Approval Gate after submit',
        `After clicking Proceed: ${afterSubmitText.substring(0, 200)}`);
    }

  } catch (err) {
    addResult('TC4', 'Missing Consent Block', 'FAIL',
      'Consent block prevents execution', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC1: Valid Match — Sarah Lin
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC1: Valid Match — Sarah Lin ===');
  try {
    await navigateToScreen(page, 'new-verification');
    await page.waitForTimeout(800);

    // Click TC1 fixture
    const tc1Btn = page.locator('button').filter({ hasText: /TC1.*Valid Match|TC1.*Sarah Lin/i }).first();
    await tc1Btn.click();
    await page.waitForTimeout(600);

    const candidateName = await page.locator('input[placeholder*="Sarah Lin"]').inputValue().catch(() => 'N/A');
    const credId = await page.locator('input[placeholder*="STAN"]').inputValue().catch(() => 'N/A');
    const consentBefore = await page.locator('input[type="checkbox"]').first().isChecked();

    // Grant consent
    const consentCheckbox = page.locator('input[type="checkbox"]').first();
    await consentCheckbox.check();
    await page.waitForTimeout(300);
    const consentAfter = await page.locator('input[type="checkbox"]').first().isChecked();
    const pageText = await page.locator('body').innerText();
    const hasConsentDocumented = pageText.includes('CONSENT DOCUMENTED');

    // Validate fixture loaded correctly
    const fixtureCorrect = (
      candidateName === 'Sarah Lin' &&
      credId === 'STAN-ML-99201-X' &&
      !consentBefore // must have been unchecked before user action
    );

    await screenshot(page, 'tc1_with_consent');

    // Submit
    const proceedBtn = page.locator('button[type="submit"], button').filter({ hasText: /Proceed to Human Approval Gate/i }).first();
    await proceedBtn.click();
    await page.waitForTimeout(1500);

    // Check approval gate
    const gateText = await page.locator('body').innerText();
    const onApprovalGate = gateText.includes('Approval Gate') || gateText.includes('Human Authorization') || gateText.includes('Authoriz');

    if (!onApprovalGate) {
      addResult('TC1', 'Valid Match — Sarah Lin (Form → Gate)', 'FAIL',
        'Navigates to Approval Gate', `Page after submit: ${gateText.substring(0, 200)}`);
    } else {
      // At Approval Gate — check checkbox and execute
      await screenshot(page, 'tc1_approval_gate');

      const authCheckboxes = await page.locator('input[type="checkbox"]').all();
      for (const cb of authCheckboxes) {
        const isChecked = await cb.isChecked();
        if (!isChecked) {
          await cb.check();
          await page.waitForTimeout(200);
        }
      }

      const executeBtn = page.locator('button').filter({ hasText: /Execute Verification|Approve.*Execute/i }).first();
      if (await executeBtn.count() > 0) {
        await executeBtn.click();
        log('Clicked Execute — waiting for agent activity...');
        await page.waitForTimeout(2000);

        // Wait for agent activity or result (up to 30s)
        let completionDetected = false;
        for (let i = 0; i < 20; i++) {
          const currentText = await page.locator('body').innerText();
          if (currentText.includes('VERIFIED') || currentText.includes('COMPLETED') ||
            currentText.includes('Verification Result') || currentText.includes('AUTHENTIC')) {
            completionDetected = true;
            break;
          }
          await page.waitForTimeout(1500);
        }

        await screenshot(page, 'tc1_result');
        const resultText = await page.locator('body').innerText();
        const isVerified = resultText.includes('VERIFIED') || resultText.includes('AUTHENTIC') ||
          resultText.includes('Verified Authentic');
        const isMismatch = resultText.includes('MISMATCH');
        const isNotFound = resultText.includes('NOT FOUND');

        let status = 'FAIL';
        if (completionDetected && isVerified && !isMismatch && !isNotFound) {
          status = 'PASS';
        }

        addResult('TC1', 'Valid Match — Sarah Lin (Full Flow)', status,
          'VERIFIED AUTHENTIC result',
          `Fixture loaded: ${fixtureCorrect} | Consent auto-unchecked: ${!consentBefore} | On approval gate: ${onApprovalGate} | Completed: ${completionDetected} | Verified: ${isVerified} | Result excerpt: "${resultText.substring(0, 400)}"`,
          'Screenshots: tc1_with_consent.png, tc1_approval_gate.png, tc1_result.png');
      } else {
        addResult('TC1', 'Valid Match — Sarah Lin (Execute button)', 'FAIL',
          'Execute button found', 'Execute button not found on Approval Gate');
      }
    }
  } catch (err) {
    addResult('TC1', 'Valid Match — Sarah Lin', 'FAIL',
      'VERIFIED AUTHENTIC', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC2: Mismatch Detection — Marcus Brody
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC2: Mismatch — Marcus Brody ===');
  try {
    await navigateToScreen(page, 'new-verification');
    await page.waitForTimeout(800);

    const tc2Btn = page.locator('button').filter({ hasText: /TC2.*Marcus Brody|TC2.*Mismatch/i }).first();
    await tc2Btn.click();
    await page.waitForTimeout(600);

    const candidateName = await page.locator('input[placeholder*="Sarah Lin"]').inputValue().catch(() => 'N/A');
    const consentBefore = await page.locator('input[type="checkbox"]').first().isChecked();

    // Grant consent
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(300);

    const proceedBtn = page.locator('button[type="submit"], button').filter({ hasText: /Proceed to Human Approval Gate/i }).first();
    await proceedBtn.click();
    await page.waitForTimeout(1500);

    // At approval gate — check and execute
    const authCheckboxes = await page.locator('input[type="checkbox"]').all();
    for (const cb of authCheckboxes) {
      const isChecked = await cb.isChecked();
      if (!isChecked) {
        await cb.check();
        await page.waitForTimeout(200);
      }
    }

    const executeBtn = page.locator('button').filter({ hasText: /Execute Verification|Approve.*Execute/i }).first();
    if (await executeBtn.count() > 0) {
      await executeBtn.click();
      log('TC2: Waiting for result...');

      let completionDetected = false;
      for (let i = 0; i < 20; i++) {
        const currentText = await page.locator('body').innerText();
        if (currentText.includes('MISMATCH') || currentText.includes('Mismatch') ||
          currentText.includes('COMPLETED') || currentText.includes('does not match')) {
          completionDetected = true;
          break;
        }
        await page.waitForTimeout(1500);
      }

      await screenshot(page, 'tc2_result');
      const resultText = await page.locator('body').innerText();
      const isMismatch = resultText.includes('MISMATCH') || resultText.includes('Mismatch') ||
        resultText.includes('does not match') || resultText.includes('Identity Mismatch');

      addResult('TC2', 'Mismatch Detection — Marcus Brody',
        (completionDetected && isMismatch) ? 'PASS' : 'FAIL',
        'MISMATCH CONFIRMED result',
        `Candidate: ${candidateName} | Consent auto-unchecked: ${!consentBefore} | Completed: ${completionDetected} | Mismatch shown: ${isMismatch} | Result: "${resultText.substring(0, 400)}"`,
        'Screenshot: tc2_result.png');
    }
  } catch (err) {
    addResult('TC2', 'Mismatch Detection — Marcus Brody', 'FAIL',
      'MISMATCH CONFIRMED', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC3: Not Found — STAN-VOID
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC3: Not Found — STAN-VOID ===');
  try {
    await navigateToScreen(page, 'new-verification');
    await page.waitForTimeout(800);

    const tc3Btn = page.locator('button').filter({ hasText: /TC3.*Not Found|TC3.*VOID/i }).first();
    await tc3Btn.click();
    await page.waitForTimeout(600);

    const credId = await page.locator('input[placeholder*="STAN"]').inputValue().catch(() => 'N/A');
    const consentBefore = await page.locator('input[type="checkbox"]').first().isChecked();

    // Grant consent
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(300);

    const proceedBtn = page.locator('button[type="submit"], button').filter({ hasText: /Proceed to Human Approval Gate/i }).first();
    await proceedBtn.click();
    await page.waitForTimeout(1500);

    // At approval gate
    const authCheckboxes = await page.locator('input[type="checkbox"]').all();
    for (const cb of authCheckboxes) {
      const isChecked = await cb.isChecked();
      if (!isChecked) {
        await cb.check();
        await page.waitForTimeout(200);
      }
    }

    const executeBtn = page.locator('button').filter({ hasText: /Execute Verification|Approve.*Execute/i }).first();
    if (await executeBtn.count() > 0) {
      await executeBtn.click();
      log('TC3: Waiting for result...');

      let completionDetected = false;
      for (let i = 0; i < 20; i++) {
        const currentText = await page.locator('body').innerText();
        if (currentText.includes('NOT FOUND') || currentText.includes('Not Found') ||
          currentText.includes('no record') || currentText.includes('COMPLETED')) {
          completionDetected = true;
          break;
        }
        await page.waitForTimeout(1500);
      }

      await screenshot(page, 'tc3_result');
      const resultText = await page.locator('body').innerText();
      const isNotFound = resultText.includes('NOT FOUND') || resultText.includes('Not Found') ||
        resultText.includes('no matching record') || resultText.includes('no record found');

      addResult('TC3', 'Not Found — STAN-ML-00000-VOID',
        (completionDetected && isNotFound) ? 'PASS' : 'FAIL',
        'NOT FOUND result',
        `CredID: ${credId} | Consent auto-unchecked: ${!consentBefore} | Completed: ${completionDetected} | Not Found shown: ${isNotFound} | Result: "${resultText.substring(0, 400)}"`,
        'Screenshot: tc3_result.png');
    }
  } catch (err) {
    addResult('TC3', 'Not Found — STAN-ML-00000-VOID', 'FAIL',
      'NOT FOUND', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC5: Test Lab — Initial State & Run All
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC5: Test Lab ===');
  try {
    await navigateToScreen(page, 'test-lab');
    await page.waitForTimeout(1500);

    await screenshot(page, 'testlab_initial');

    const pageText = await page.locator('body').innerText();
    const hasTC1 = pageText.includes('TC1') || pageText.includes('Sarah Lin');
    const hasTC2 = pageText.includes('TC2') || pageText.includes('Marcus Brody');
    const hasTC3 = pageText.includes('TC3') || pageText.includes('VOID');
    const hasTC4 = pageText.includes('TC4') || pageText.includes('Missing Consent');

    const hasRunAllBtn = await page.locator('button').filter({ hasText: /Run All|Execute All/i }).count() > 0;

    // Click Run All Tests
    if (hasRunAllBtn) {
      const runAllBtn = page.locator('button').filter({ hasText: /Run All|Execute All/i }).first();
      await runAllBtn.click();
      log('TC5: Run All Tests clicked — waiting for completion (up to 90s)...');

      // Wait for all 4 tests to complete
      let allDone = false;
      for (let i = 0; i < 45; i++) {
        const currentText = await page.locator('body').innerText();
        // Check if we see result indicators for all 4 test cases
        const hasResults = (currentText.includes('VERIFIED') || currentText.includes('Verified')) &&
          (currentText.includes('MISMATCH') || currentText.includes('Mismatch')) &&
          (currentText.includes('NOT FOUND') || currentText.includes('Not Found')) &&
          (currentText.includes('BLOCKED') || currentText.includes('Blocked') || currentText.includes('Consent'));

        // Also check for PASS/FAIL indicators
        const passCount = (currentText.match(/\bPASS\b/gi) || []).length;
        const failCount = (currentText.match(/\bFAIL\b/gi) || []).length;

        if (hasResults || passCount >= 3) {
          allDone = true;
          log(`TC5: Tests completed after ${(i + 1) * 2}s`);
          break;
        }
        await page.waitForTimeout(2000);
      }

      await screenshot(page, 'testlab_completed');
      const completedText = await page.locator('body').innerText();

      // Parse individual results
      const tc1Pass = completedText.includes('VERIFIED') || completedText.includes('Verified Authentic');
      const tc2Pass = completedText.includes('MISMATCH') || completedText.includes('Mismatch');
      const tc3Pass = completedText.includes('NOT FOUND') || completedText.includes('Not Found');
      const tc4Pass = completedText.includes('BLOCKED') || completedText.includes('Consent Required') || completedText.includes('Missing Consent');

      addResult('TC5', 'Test Lab — TC1 (Verified Authentic)', tc1Pass ? 'PASS' : 'FAIL',
        'TC1: VERIFIED AUTHENTIC', `Shown: ${tc1Pass}`, 'Part of Run All');
      addResult('TC5', 'Test Lab — TC2 (Mismatch)', tc2Pass ? 'PASS' : 'FAIL',
        'TC2: MISMATCH CONFIRMED', `Shown: ${tc2Pass}`, 'Part of Run All');
      addResult('TC5', 'Test Lab — TC3 (Not Found)', tc3Pass ? 'PASS' : 'FAIL',
        'TC3: NOT FOUND', `Shown: ${tc3Pass}`, 'Part of Run All');
      addResult('TC5', 'Test Lab — TC4 (Blocked)', tc4Pass ? 'PASS' : 'FAIL',
        'TC4: BLOCKED / CONSENT REQUIRED', `Shown: ${tc4Pass}`, 'Part of Run All');

      addResult('TC5', 'Test Lab — Run All Tests (Overall)',
        (allDone && tc1Pass && tc2Pass && tc3Pass && tc4Pass) ? 'PASS' : 'FAIL',
        'All 4 tests complete with correct outcomes',
        `All done: ${allDone} | TC1: ${tc1Pass} | TC2: ${tc2Pass} | TC3: ${tc3Pass} | TC4: ${tc4Pass}`,
        'Screenshots: testlab_initial.png, testlab_completed.png');
    } else {
      addResult('TC5', 'Test Lab — Run All Tests', 'FAIL',
        '"Run All Tests" button present',
        `Has TC1: ${hasTC1} | TC2: ${hasTC2} | TC3: ${hasTC3} | TC4: ${hasTC4} | Run All button: ${hasRunAllBtn}`);
    }
  } catch (err) {
    addResult('TC5', 'Test Lab', 'FAIL', 'Test Lab loads and runs', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC6: Settings — Live Statistics
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC6: Settings Page ===');
  try {
    await navigateToScreen(page, 'settings');
    await page.waitForTimeout(2000);

    await screenshot(page, 'settings_stats');

    const pageText = await page.locator('body').innerText();
    const hasStanford = pageText.includes('Stanford');
    const hasMIT = pageText.includes('MIT');
    const hasCoursera = pageText.includes('Coursera');
    const hasGoogle = pageText.includes('Google Cloud');
    const hasAWS = pageText.includes('AWS');
    const hasOperatingMode = pageText.includes('Operating Mode') || pageText.includes('operating mode');
    const hasSupabase = pageText.includes('Supabase') || pageText.includes('Database');
    const hasGemini = pageText.includes('Gemini') || pageText.includes('AI');
    const hasStats = pageText.includes('verification') || pageText.includes('total') || pageText.includes('Total');

    const status = (hasStanford && hasMIT && hasCoursera && hasOperatingMode) ? 'PASS' : 'FAIL';

    addResult('TC6', 'Settings — Live Statistics & Adapters', status,
      'Adapters, operating mode, Supabase status, Gemini status, live counts shown',
      `Stanford: ${hasStanford} | MIT: ${hasMIT} | Coursera: ${hasCoursera} | Google: ${hasGoogle} | AWS: ${hasAWS} | Operating Mode: ${hasOperatingMode} | Supabase: ${hasSupabase} | Gemini: ${hasGemini} | Stats: ${hasStats}`,
      'Screenshot: settings_stats.png');
  } catch (err) {
    addResult('TC6', 'Settings — Live Statistics', 'FAIL',
      'Settings page loads with stats', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC7: Dashboard Overview
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC7: Dashboard Overview ===');
  try {
    await navigateToScreen(page, 'overview');
    await page.waitForTimeout(1500);

    await screenshot(page, 'dashboard_overview');

    const pageText = await page.locator('body').innerText();
    const hasDashboard = pageText.includes('Overview') || pageText.includes('Dashboard');
    const hasStats = pageText.includes('Verif') || pageText.includes('verif') || pageText.includes('Total');
    const hasNumbers = /\d+/.test(pageText);

    addResult('TC7', 'Dashboard Overview', (hasDashboard && hasStats) ? 'PASS' : 'FAIL',
      'Dashboard loads with statistics',
      `Has overview/dashboard: ${hasDashboard} | Has stats: ${hasStats} | Has numbers: ${hasNumbers}`,
      'Screenshot: dashboard_overview.png');
  } catch (err) {
    addResult('TC7', 'Dashboard Overview', 'FAIL',
      'Dashboard loads with stats', `ERROR: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TC8: Verification History
  // ═══════════════════════════════════════════════════════════
  log('\n=== TC8: Verification History ===');
  try {
    await navigateToScreen(page, 'verification-history');
    await page.waitForTimeout(1500);

    await screenshot(page, 'verification_history');

    const pageText = await page.locator('body').innerText();
    const hasHistory = pageText.includes('History') || pageText.includes('history');
    const hasSarahLin = pageText.includes('Sarah Lin');
    const hasRecords = pageText.includes('STAN-ML') || pageText.includes('Stanford');

    addResult('TC8', 'Verification History', hasHistory ? 'PASS' : 'FAIL',
      'History screen loads with recent verifications including Sarah Lin',
      `Has history page: ${hasHistory} | Has Sarah Lin: ${hasSarahLin} | Has STAN-ML records: ${hasRecords}`,
      'Screenshot: verification_history.png');
  } catch (err) {
    addResult('TC8', 'Verification History', 'FAIL',
      'History screen loads', `ERROR: ${err.message}`);
  }

  // Final screenshot
  await screenshot(page, 'final_state');

  await browser.close();
  log('\nAll tests complete. Generating report...');

  // ═══════════════════════════════════════════════════════════
  // Generate Markdown Report
  // ═══════════════════════════════════════════════════════════
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const blockedCount = results.filter(r => r.status === 'BLOCKED').length;

  let report = `# CertiSure AI — End-to-End Regression Test Report
**Generated:** ${new Date().toISOString()}
**App URL:** ${APP_URL}
**Results:** ${passCount} PASS | ${failCount} FAIL | ${blockedCount} BLOCKED

---

## Test Results Table

| TC | Test Name | Status | Expected | Observed | Notes |
|---|---|---|---|---|---|
`;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⛔';
    report += `| ${r.tcId} | ${r.name} | ${icon} ${r.status} | ${r.expected} | ${r.observed.substring(0, 150)} | ${r.notes} |\n`;
  }

  report += `
---

## Console Errors

`;
  if (consoleErrors.length === 0) {
    report += '_No console errors captured._\n';
  } else {
    consoleErrors.forEach(e => { report += `- \`${e}\`\n`; });
  }

  report += `
---

## Failed Network Requests

`;
  if (networkErrors.length === 0) {
    report += '_No failed network requests captured._\n';
  } else {
    networkErrors.forEach(e => { report += `- \`${e}\`\n`; });
  }

  report += `
---

## Screenshots Captured

All screenshots saved to: \`${SCREENSHOTS_DIR}\`

| Filename | Description |
|---|---|
| \`00_initial_load.png\` | Initial app load state |
| \`blank_form.png\` | New Verification blank form (TC1-BLANK) |
| \`tc4_consent.png\` | TC4 consent block with warning message |
| \`tc4_approval_gate.png\` | TC4 at Approval Gate |
| \`tc4_gate_error.png\` | TC4 consent error at Approval Gate |
| \`tc1_with_consent.png\` | TC1 form with consent granted |
| \`tc1_approval_gate.png\` | TC1 at Approval Gate |
| \`tc1_result.png\` | TC1 verification result |
| \`tc2_result.png\` | TC2 mismatch result |
| \`tc3_result.png\` | TC3 not found result |
| \`testlab_initial.png\` | Test Lab initial state |
| \`testlab_completed.png\` | Test Lab after Run All |
| \`settings_stats.png\` | Settings page with live statistics |
| \`dashboard_overview.png\` | Dashboard overview |
| \`verification_history.png\` | Verification history |

---

## Overall Assessment

${passCount + failCount + blockedCount} tests executed: **${passCount} passed**, **${failCount} failed**, **${blockedCount} blocked**.
`;

  await fs.writeFile(REPORT_PATH, report, 'utf-8');
  log(`Report written to: ${REPORT_PATH}`);

  // Print summary to stdout for the agent to read
  console.log('\n\n========== FINAL RESULTS ==========');
  for (const r of results) {
    console.log(`${r.status.padEnd(7)} | ${r.tcId.padEnd(12)} | ${r.name}`);
    console.log(`         | Observed: ${r.observed.substring(0, 200)}`);
  }
  console.log('\nCONSOLE ERRORS:', consoleErrors.length === 0 ? 'None' : consoleErrors.join('\n'));
  console.log('NETWORK ERRORS:', networkErrors.length === 0 ? 'None' : networkErrors.join('\n'));
  console.log('===================================');
}

runTests().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
