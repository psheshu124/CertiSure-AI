# CERTISURE AI — Full-Stack AI Certificate Authenticity Platform

CertiSure AI is an enterprise-grade credential authenticity and verification platform designed for corporate recruiters, forensic credential analysts, and compliance officers. It turns static credential checks into an explainable, cryptographically anchored, multi-stage verification pipeline.

---

## 1. Core Principles

- **AI Extraction is Not Proof of Authenticity:** While AI models (Google Gemini) excel at OCR, field extraction, and text normalization, authenticity is established only through deterministic comparison against authoritative issuer records or registries.
- **Mandatory Legal Consent:** External queries to issuing institutions or third-party registrars require explicit candidate consent. If consent is absent, verification is immediately halted.
- **Explainable Decisions Supported by Evidence:** Outcomes distinguish between **Verified Authentic**, **Confirmed Mismatch**, **Registry Record Not Found** (absence ≠ fraud), and **Inconclusive / Needs Review**.
- **Human-in-the-Loop Protocol:** Ambiguous claims or unaccredited sources are transferred to an exception adjudication workbench for authorized reviewer sign-off.

---

## 2. The Nine Application Screens

The application implements the complete nine-screen Google Stitch enterprise design:

| Screen | Name | Description |
|---|---|---|
| **Screen 1** | **Recruiter Dashboard** | Live telemetry, distinct certificate metrics, real-time outcome distribution, and recent audit activity feed. |
| **Screen 2** | **New Certificate Verification** | Intake form for candidate identity claims, credential identifiers, private document upload, and consent logging. |
| **Screen 3** | **Human Approval & Action Review** | Human-in-the-loop gate reviewing proposed action payloads, target endpoints, and candidate consent prior to query execution. |
| **Screen 4** | **AI Agent Activity** | 8-stage verification pipeline execution trace with live millisecond elapsed timer and real-time terminal stdout telemetry. |
| **Screen 5** | **Verification Results & Evidence** | Visual credential inspection, side-by-side field comparison matrix, and cryptographic SHA-256 audit trail. |
| **Screen 6** | **Verification History** | Searchable, immutable ledger of all verified credentials with multi-field search and outcome filtering. |
| **Screen 7** | **Review Queue** | Exception adjudication workbench with SLA tracking, discrepancy notes, and manual reviewer decision overrides. |
| **Screen 8** | **Verification Test Lab** | Isolated acceptance test suite executing TC1–TC4 scenarios with 100% deterministic fixture compliance. |
| **Screen 9** | **Settings & Verification Sources** | Trusted issuer adapter registry (Stanford, MIT, Coursera, Google Cloud, AWS), operating mode selectors, and diagnostics. |

---

## 3. Technology Stack

- **Frontend:** React 18, Tailwind CSS (with custom Precision Verification System tokens), Material Symbols Outlined, Inter font typography.
- **Backend Server:** Node.js, Express, Multer (secure in-memory buffer handling), CORS, Dotenv.
- **AI Integration:** Google Gemini (`gemini-3.8-flash` / `@google/generative-ai`) running server-side for OCR and structured document parsing.
- **Database & Storage:** Supabase Postgres (`public.certificates`, `public.verification_history`) with Row Level Security (RLS) and private `certificates` Storage Bucket.
- **Build Tool:** Vite 6 with dev proxy (`/api` -> `http://localhost:3001`).

---

## 4. Setup & Configuration

### Prerequisites
- Node.js (v18 or later, tested on v24.21.0)
- npm (v9 or later)

### Quick Start

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your keys:
   ```env
   # Frontend Supabase Client (Vite-exposed)
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-anon-key

   # Server-Side AI Integration (Server-only, NEVER exposed to client)
   GEMINI_API_KEY=your-google-gemini-api-key

   # Server Port Configuration
   PORT=3001
   ```

   > **Note:** If `GEMINI_API_KEY` or Supabase keys are not set, CertiSure AI runs in interactive Sandbox Demo Mode. All test fixtures (TC1–TC4), manual adjudications, and UI flows remain functional.

3. **Database Migration (Supabase):**
   Execute the migration script in your Supabase SQL Editor:
   - File: `supabase/migrations/20261018000000_certisure_schema.sql`
   - This sets up `public.certificates`, `public.verification_history`, RLS policies, performance indexes, and the private `certificates` storage bucket.

4. **Run Locally:**
   ```bash
   npm run dev
   ```
   This concurrently starts:
   - **Backend API:** `http://localhost:3001`
   - **Frontend App:** `http://localhost:5173`

---

## 5. Acceptance Test Cases (Test Lab)

The Test Lab implements and executes the four required acceptance scenarios:

| Test Case | Scenario | Input | Expected Outcome | Actual Result |
|---|---|---|---|---|
| **TC1** | Matching Candidate Name | Candidate: `Sarah Lin`, ID: `STAN-ML-99201-X`, Issuer: `Stanford Online`, Consent: `True` | `VERIFIED AUTHENTIC` | **PASS (100% Match)** |
| **TC2** | Different Candidate Name | Candidate: `Marcus Brody`, ID: `STAN-ML-99201-X`, Issuer: `Stanford Online`, Consent: `True` | `MISMATCH CONFIRMED` | **PASS (Mismatch Detected)** |
| **TC3** | No Matching Record | Candidate: `Sarah Lin`, ID: `STAN-ML-00000-VOID`, Issuer: `Stanford Online`, Consent: `True` | `RECORD NOT FOUND` | **PASS (Absence Confirmed)** |
| **TC4** | Missing Consent | Candidate: `Sarah Lin`, ID: `STAN-ML-99201-X`, Issuer: `Stanford Online`, Consent: `False` | `BLOCKED / CONSENT REQUIRED` | **PASS (Query Halted)** |

To run the tests:
1. Navigate to **Test Lab** (Screen 8) in the left sidebar.
2. Click **Run all test cases** or test individual cards.
3. Tests run in an isolated sandbox and never corrupt production records.
