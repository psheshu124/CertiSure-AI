# CertiSure AI — End-to-End Regression Test Report
**Generated:** 2026-10-18T17:57:44.962Z
**App URL:** http://localhost:5173
**Results:** 10 PASS | 4 FAIL | 0 BLOCKED

---

## Test Results Table

| TC | Test Name | Status | Expected | Observed | Notes |
|---|---|---|---|---|---|
| TC0 | Application Load & Navigation Smoke Test | ✅ PASS | App loads, sidebar visible | Title: "CertiSure AI — Certificate Authenticity Checker" | Sidebar: true | Body has content: true |  |
| TC1-BLANK | New Verification — Blank Form State | ✅ PASS | All fields empty, consent unchecked, CONSENT MISSING badge shown | Page: true | Name: "" | CredID: "" | Issuer: "" | Consent checked: false | CONSENT MISSING badge: true | Has dashes: true | Screenshot: blank_form.png |
| TC4 | Missing Consent Block (Approval Gate) | ❌ FAIL | Should navigate to Approval Gate after submit | After clicking Proceed: shield
CertiSure AI
Enterprise Verification
dashboard
Overview
verified
New Verification
history
Verification History
fact_che |  |
| TC1 | Valid Match — Sarah Lin (Full Flow) | ❌ FAIL | VERIFIED AUTHENTIC result | Fixture loaded: true | Consent auto-unchecked: true | On approval gate: true | Completed: true | Verified: false | Result excerpt: "shield
CertiSure A | Screenshots: tc1_with_consent.png, tc1_approval_gate.png, tc1_result.png |
| TC2 | Mismatch Detection — Marcus Brody | ❌ FAIL | MISMATCH CONFIRMED result | Candidate: Marcus Brody | Consent auto-unchecked: true | Completed: true | Mismatch shown: false | Result: "shield
CertiSure AI
Enterprise Verificatio | Screenshot: tc2_result.png |
| TC3 | Not Found — STAN-ML-00000-VOID | ❌ FAIL | NOT FOUND result | CredID: STAN-ML-00000-VOID | Consent auto-unchecked: true | Completed: true | Not Found shown: false | Result: "shield
CertiSure AI
Enterprise Verific | Screenshot: tc3_result.png |
| TC5 | Test Lab — TC1 (Verified Authentic) | ✅ PASS | TC1: VERIFIED AUTHENTIC | Shown: true | Part of Run All |
| TC5 | Test Lab — TC2 (Mismatch) | ✅ PASS | TC2: MISMATCH CONFIRMED | Shown: true | Part of Run All |
| TC5 | Test Lab — TC3 (Not Found) | ✅ PASS | TC3: NOT FOUND | Shown: true | Part of Run All |
| TC5 | Test Lab — TC4 (Blocked) | ✅ PASS | TC4: BLOCKED / CONSENT REQUIRED | Shown: true | Part of Run All |
| TC5 | Test Lab — Run All Tests (Overall) | ✅ PASS | All 4 tests complete with correct outcomes | All done: true | TC1: true | TC2: true | TC3: true | TC4: true | Screenshots: testlab_initial.png, testlab_completed.png |
| TC6 | Settings — Live Statistics & Adapters | ✅ PASS | Adapters, operating mode, Supabase status, Gemini status, live counts shown | Stanford: true | MIT: true | Coursera: true | Google: true | AWS: true | Operating Mode: true | Supabase: true | Gemini: true | Stats: true | Screenshot: settings_stats.png |
| TC7 | Dashboard Overview | ✅ PASS | Dashboard loads with statistics | Has overview/dashboard: true | Has stats: true | Has numbers: true | Screenshot: dashboard_overview.png |
| TC8 | Verification History | ✅ PASS | History screen loads with recent verifications including Sarah Lin | Has history page: true | Has Sarah Lin: true | Has STAN-ML records: true | Screenshot: verification_history.png |

---

## Console Errors

_No console errors captured._

---

## Failed Network Requests

_No failed network requests captured._

---

## Screenshots Captured

All screenshots saved to: `C:\Users\Admin\OneDrive\Desktop\certiSure-AI\screenshots`

| Filename | Description |
|---|---|
| `00_initial_load.png` | Initial app load state |
| `blank_form.png` | New Verification blank form (TC1-BLANK) |
| `tc4_consent.png` | TC4 consent block with warning message |
| `tc4_approval_gate.png` | TC4 at Approval Gate |
| `tc4_gate_error.png` | TC4 consent error at Approval Gate |
| `tc1_with_consent.png` | TC1 form with consent granted |
| `tc1_approval_gate.png` | TC1 at Approval Gate |
| `tc1_result.png` | TC1 verification result |
| `tc2_result.png` | TC2 mismatch result |
| `tc3_result.png` | TC3 not found result |
| `testlab_initial.png` | Test Lab initial state |
| `testlab_completed.png` | Test Lab after Run All |
| `settings_stats.png` | Settings page with live statistics |
| `dashboard_overview.png` | Dashboard overview |
| `verification_history.png` | Verification history |

---

## Overall Assessment

14 tests executed: **10 passed**, **4 failed**, **0 blocked**.
