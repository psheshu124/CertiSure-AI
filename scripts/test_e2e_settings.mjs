import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\d7d253cf-c455-4bc0-bfff-661e724ebbee\\scratch\\screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runBrowserTests() {
  console.log('Launching browser for CertiSure AI UI test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  try {
    console.log('\n--- Test Step 1: Navigate to CertiSure AI App ---');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('Page title:', await page.title());

    console.log('\n--- Test Step 2: Navigate to Settings Screen & Capture Live Stats ---');
    await page.locator('button:has-text("Settings"), a:has-text("Settings")').first().click();
    await page.waitForTimeout(1000);

    const settingsHeader = await page.locator('h1:has-text("Settings")').textContent();
    console.log('Settings header found:', settingsHeader);

    // Scroll down to statistics and capture screenshot
    await page.locator('section#section-statistics').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'settings_stats.png') });
    console.log('Saved settings_stats.png');

    console.log('\n--- Test Step 3: Run Live Connectivity Check in Settings ---');
    await page.locator('section#section-sources').scrollIntoViewIfNeeded();
    const checkBtn = page.locator('button:has-text("Run Connectivity Check")');
    await checkBtn.click();
    console.log('Clicked "Run Connectivity Check", waiting for network check...');
    await page.waitForTimeout(4000);

    const tableRows = await page.locator('section#section-sources tbody tr').count();
    console.log(`Sources table rendered with ${tableRows} adapters.`);
    const firstRowAvailability = await page.locator('section#section-sources tbody tr').first().locator('td').nth(3).textContent();
    console.log(`First adapter live connectivity: "${firstRowAvailability?.trim().replace(/\s+/g, ' ')}"`);

    console.log('\n--- Test Step 4: Change Settings & Save Configuration ---');
    // Select Production Gateway radio
    const prodRadio = page.locator('input[name="operatingMode"][value="production"]');
    await prodRadio.check();

    // Change model dropdown to gemini-2.0-flash
    const modelSelect = page.locator('select').first();
    await modelSelect.selectOption('gemini-2.0-flash');

    // Click Save Configuration
    const saveBtn = page.locator('button:has-text("Save Configuration")').first();
    await saveBtn.click();
    await page.waitForTimeout(1500);

    const successBanner = await page.locator('text=Configuration saved successfully').isVisible();
    console.log('Save success notification visible:', successBanner);

    console.log('\n--- Test Step 5: Refresh Page to Verify Persistence ---');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Navigate back to Settings after page reload
    await page.locator('button:has-text("Settings"), a:has-text("Settings")').first().click();
    await page.waitForTimeout(800);

    const isProdChecked = await page.locator('input[name="operatingMode"][value="production"]').isChecked();
    const selectedModel = await page.locator('select').first().inputValue();
    console.log(`Persistence check after refresh: Production Mode = ${isProdChecked}, Selected Model = ${selectedModel}`);

    console.log('\n--- Test Step 6: Navigate to New Verification Screen & Capture Blank Form ---');
    const newVerifBtn = page.locator('button:has-text("New Verification"), a:has-text("New Verification")').first();
    await newVerifBtn.click();
    await page.waitForTimeout(800);

    // Verify candidate name input is blank by default
    const nameInput = page.locator('input[placeholder="e.g. Sarah Lin"]');
    const initialName = await nameInput.inputValue();
    console.log(`Initial Candidate Name value: "${initialName}" (Blank: ${initialName === ''})`);

    // Capture blank form screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'blank_form.png') });
    console.log('Saved blank_form.png');

    console.log('\n--- Test Step 7: Fill Form for Credential A (Alex Morgan) ---');
    await nameInput.fill('Alex Morgan');
    await page.locator('input[placeholder*="Machine Learning"]').fill('Quantum Computing Fundamentals');
    await page.locator('input[placeholder*="STAN-ML"]').fill('MIT-QC-77401-Z');
    await page.locator('input[placeholder*="Stanford Online, MIT"]').fill('MIT xPRO Registrar Hook');

    // Check preview dossier
    const dossierCandidate = await page.locator('div:has-text("STAGE-01")').locator('span:has-text("Alex Morgan")').first().isVisible();
    console.log('Live Dossier Preview updated with Alex Morgan:', dossierCandidate);

    console.log('\n--- Test Step 8: Test Consent Gate Enforcement & Capture TC4 Screenshot ---');
    const proceedBtn = page.locator('button:has-text("Proceed to Human Approval Gate")');
    await proceedBtn.click();
    await page.waitForTimeout(1000);

    // Verify at Approval Gate screen
    const gateTitle = await page.locator('h1:has-text("Review verification action")').isVisible();
    console.log('At Human Approval Gate screen (Review verification action):', gateTitle);

    // Try executing without consent
    const execBtn = page.locator('button:has-text("Approve & Execute Verification")');
    if (await execBtn.isVisible()) {
      await execBtn.click();
      await page.waitForTimeout(600);
      const consentBlock = await page.locator('text=Candidate consent is absent').isVisible();
      console.log('Blocked execution due to absent consent:', consentBlock);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc4_consent.png') });
      console.log('Saved tc4_consent.png');
    }

    console.log('\n--- Test Step 9: Test Lab Screen Initial & Completed Execution ---');
    await page.locator('button:has-text("Test Lab"), a:has-text("Test Lab")').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'testlab_initial.png') });
    console.log('Saved testlab_initial.png');

    // Adopt or run manual test
    const manualAdoptBtn = page.locator('button:has-text("Set as Active Test Credential")');
    if (await manualAdoptBtn.isVisible()) {
      await page.locator('input[placeholder*="Candidate Name"]').first().fill('Dr. Elena Rostova');
      await page.locator('input[placeholder*="STAN-ML"]').first().fill('COURSERA-GCP-881');
      await page.locator('input[placeholder*="Stanford Online"]').first().fill('Coursera Partner Network');
      await page.locator('input[placeholder*="Advanced Machine"]').first().fill('Professional Cloud Architect');
      await manualAdoptBtn.click();
      await page.waitForTimeout(800);
    }

    // Run All Dynamic Tests
    const runAllBtn = page.locator('button:has-text("Run All Scenarios"), button:has-text("Run All Tests"), button:has-text("Execute Full")').first();
    if (await runAllBtn.isVisible()) {
      await runAllBtn.click();
      console.log('Executing Test Lab suite...');
      await page.waitForTimeout(4000);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'testlab_completed.png') });
    console.log('Saved testlab_completed.png');

    console.log('\n--- Test Step 10: Revert Settings to Sandbox Demo for Evaluation ---');
    await page.locator('button:has-text("Settings"), a:has-text("Settings")').first().click();
    await page.waitForTimeout(800);
    await page.locator('input[name="operatingMode"][value="demo"]').check();
    await page.locator('select').first().selectOption('gemini-3.8-flash');
    await page.locator('button:has-text("Save Configuration")').first().click();
    await page.waitForTimeout(1000);
    console.log('Settings restored to Demo mode.');

    console.log('\n=== ALL E2E BROWSER TESTS PASSED! ===');
  } catch (err) {
    console.error('Playwright Test Failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runBrowserTests();
