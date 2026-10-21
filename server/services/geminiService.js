/**
 * CERTISURE AI — GEMINI AI INTEGRATION SERVICE
 * Server-side OCR & Document Intelligence Provider using Google Generative AI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSettings, SUPPORTED_MODELS } from './settingsService.js';

export function isGeminiConfigured() {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey.trim() !== '' && !apiKey.includes('your-google-gemini-api-key'));
}

export function getGeminiModel(overrideModel = null) {
  if (!isGeminiConfigured()) {
    return null;
  }
  const configuredModel = overrideModel || getSettings().aiProvider?.model || 'gemini-3.5-flash';
  const validModel = SUPPORTED_MODELS.includes(configuredModel) ? configuredModel : 'gemini-3.5-flash';

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  return {
    modelInstance: genAI.getGenerativeModel({
      model: validModel,
      generationConfig: {
        temperature: 0.1, // Low temperature for high precision forensic data extraction
        responseMimeType: 'application/json',
      }
    }),
    modelName: validModel
  };
}

/**
 * Helper to produce clean, actionable user-facing error messages
 */
function formatGeminiError(err) {
  console.error('[Gemini Service Extraction Error]', err);
  const msg = err.message || '';
  let userFriendly = `AI extraction encountered an error: ${msg}`;
  let errorCode = 'EXTRACTION_ERROR';

  if (err.status === 429 || msg.includes('429') || msg.includes('Resource has been exhausted') || msg.includes('Quota exceeded')) {
    userFriendly = 'Gemini API quota or rate limit reached (HTTP 429). Please wait before retrying or enter credential details manually.';
    errorCode = 'RATE_LIMIT_EXCEEDED';
  } else if (err.status === 503 || msg.includes('503') || msg.includes('overloaded') || msg.includes('High demand')) {
    userFriendly = 'The Gemini AI model is currently experiencing high demand. Please try again in a few moments or enter details manually.';
    errorCode = 'MODEL_OVERLOADED';
  } else if (err.status === 401 || err.status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('not valid')) {
    userFriendly = 'Configured Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in the server environment.';
    errorCode = 'INVALID_API_KEY';
  }

  return {
    success: false,
    configured: true,
    error: errorCode,
    message: userFriendly,
    extractedData: null,
    extractedFields: null,
  };
}

/**
 * Extract structured certificate fields from an uploaded document buffer or base64 data.
 * @param {Buffer|string} fileData - The document buffer or base64 string
 * @param {string} mimeType - e.g. 'image/png', 'image/jpeg', 'application/pdf'
 */
export async function extractCertificateDetails(fileData, mimeType = 'image/png') {
  if (!isGeminiConfigured()) {
    return {
      success: false,
      configured: false,
      error: 'MISSING_API_KEY',
      message: 'GEMINI_API_KEY is not configured in server environment. Manual credential intake remains active.',
      extractedData: null,
      extractedFields: null,
    };
  }

  // Convert Buffer to base64 if needed
  const base64Data = Buffer.isBuffer(fileData)
    ? fileData.toString('base64')
    : typeof fileData === 'string' && fileData.includes(',')
      ? fileData.split(',')[1]
      : fileData;

  if (!base64Data || base64Data.trim() === '') {
    return {
      success: false,
      configured: true,
      error: 'EMPTY_FILE_PAYLOAD',
      message: 'Uploaded document payload is empty. Please provide a valid certificate image or PDF.',
      extractedData: null,
      extractedFields: null,
    };
  }

  const prompt = `
You are an expert document forensics assistant for CertiSure AI.
Analyze this certificate document image or PDF carefully and extract the following metadata in structured JSON format:

{
  "candidateName": "Full name of candidate/student as written on certificate",
  "credentialId": "Unique certificate ID, serial number, license code, or verification identifier",
  "issuingAuthority": "Issuing institution, university, organization, or platform (e.g. Stanford Online, MIT, Google, Coursera)",
  "qualification": "Title of course, specialization, degree, or credential completed",
  "completionDate": "Date of completion, issuance, or graduation in YYYY-MM-DD format if available, or text format",
  "ocrConfidence": A number from 0 to 100 representing optical clarity and confidence in extracted text,
  "verificationUrl": "Official verification URL printed or embedded in QR if visible, or null"
}

Rules:
1. Do NOT invent or guess missing values. If a field cannot be found on the document, set its value to null.
2. If the document is not a certificate, or text is unreadable, return all fields as null.
3. Respond ONLY with the JSON object.
`;

  const runModelCall = async (modelNameOverride = null) => {
    const geminiObj = getGeminiModel(modelNameOverride);
    if (!geminiObj || !geminiObj.modelInstance) {
      throw new Error('Failed to initialize Gemini model');
    }
    const { modelInstance, modelName } = geminiObj;

    const parts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'image/jpeg'
        }
      },
      { text: prompt }
    ];

    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          console.log('[Gemini Service] Transient spike detected. Retrying model call in 1500ms...');
          await new Promise(r => setTimeout(r, 1500));
        }
        const result = await modelInstance.generateContent(parts);
        const response = await result.response;
        return { text: response.text(), modelUsed: modelName };
      } catch (callErr) {
        lastErr = callErr;
        const isTransient503 = callErr.status === 503 || (callErr.message && callErr.message.includes('503'));
        if (!isTransient503) {
          throw callErr;
        }
      }
    }
    throw lastErr;
  };

  let rawText = '';
  let activeModelUsed = '';

  try {
    const res = await runModelCall();
    rawText = res.text;
    activeModelUsed = res.modelUsed;
  } catch (primaryErr) {
    console.warn(`[Gemini Service] Primary model call failed (${primaryErr.message}). Checking fallback...`);
    const isQuotaOrNotFoundError =
      primaryErr.status === 429 ||
      primaryErr.status === 404 ||
      (primaryErr.message && (
        primaryErr.message.includes('429') ||
        primaryErr.message.includes('404') ||
        primaryErr.message.includes('Resource has been exhausted') ||
        primaryErr.message.includes('Quota exceeded') ||
        primaryErr.message.includes('not found')
      ));

    const configuredModel = getSettings().aiProvider?.model || 'gemini-3.5-flash';
    if (isQuotaOrNotFoundError && configuredModel !== 'gemini-3.5-flash') {
      console.log('[Gemini Service] Attempting fallback to gemini-3.5-flash...');
      try {
        const fallbackRes = await runModelCall('gemini-3.5-flash');
        rawText = fallbackRes.text;
        activeModelUsed = fallbackRes.modelUsed;
      } catch (fallbackErr) {
        return formatGeminiError(fallbackErr);
      }
    } else {
      return formatGeminiError(primaryErr);
    }
  }

  // Parse JSON response
  let extractedData = {};
  try {
    extractedData = JSON.parse(rawText);
  } catch (parseError) {
    console.warn('[Gemini Service] JSON parse warning, cleaning raw response:', rawText);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[0]);
      } catch (secondaryParseErr) {
        return {
          success: false,
          configured: true,
          error: 'INVALID_JSON_RESPONSE',
          message: 'Gemini OCR returned an unparseable response. Please retry or enter details manually.',
          extractedData: null,
          extractedFields: null
        };
      }
    } else {
      return {
        success: false,
        configured: true,
        error: 'INVALID_RESPONSE_FORMAT',
        message: 'Gemini OCR output did not contain structured certificate data.',
        extractedData: null,
        extractedFields: null
      };
    }
  }

  // Validate extracted fields and check for empty extraction
  const candidateName = extractedData.candidateName ? String(extractedData.candidateName).trim() : null;
  const credentialId = extractedData.credentialId ? String(extractedData.credentialId).trim() : null;
  const issuingAuthority = (extractedData.issuingAuthority || extractedData.issuer) ? String(extractedData.issuingAuthority || extractedData.issuer).trim() : null;
  const qualification = (extractedData.qualification || extractedData.courseTitle) ? String(extractedData.qualification || extractedData.courseTitle).trim() : null;
  const completionDate = (extractedData.completionDate || extractedData.issueDate) ? String(extractedData.completionDate || extractedData.issueDate).trim() : null;
  const ocrConfidence = typeof extractedData.ocrConfidence === 'number'
    ? extractedData.ocrConfidence
    : typeof extractedData.confidenceScore === 'number'
      ? extractedData.confidenceScore
      : 85;

  const hasAnyField = Boolean(
    candidateName || credentialId || issuingAuthority || qualification
  );

  if (!hasAnyField) {
    return {
      success: false,
      configured: true,
      empty: true,
      error: 'EMPTY_EXTRACTION',
      message: 'No certificate details could be extracted from the uploaded document. Please check the document quality or enter details manually.',
      extractedData: null,
      extractedFields: null,
    };
  }

  const cleanExtracted = {
    candidateName,
    credentialId,
    issuingAuthority,
    qualification,
    completionDate,
    ocrConfidence,
    // Cross-compatible aliases
    issuer: issuingAuthority,
    courseTitle: qualification,
    issueDate: completionDate,
    confidenceScore: ocrConfidence,
    verificationUrl: extractedData.verificationUrl || null
  };

  return {
    success: true,
    configured: true,
    candidateName,
    credentialId,
    issuingAuthority,
    qualification,
    completionDate,
    ocrConfidence,
    extractedData: cleanExtracted,
    extractedFields: cleanExtracted,
    modelName: activeModelUsed,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Generate plain-English forensic reasoning and evidence explanation using Gemini.
 * Note: Never overrides deterministic outcome; serves as forensic assistance for recruiters.
 */
export async function generateAiForensicSummary({ candidateName, credentialId, issuer, outcome, comparisonMatrix, evidenceRecord, isTestFixture = false }) {
  if (!isGeminiConfigured()) return null;

  try {
    const geminiObj = getGeminiModel();
    if (!geminiObj || !geminiObj.modelInstance) return null;
    const model = geminiObj.modelInstance;

    const prompt = `
You are an expert credential verification forensic analyst for CertiSure AI.
Analyze the deterministic verification comparison result below and produce a concise, professional 2-sentence explanation for a corporate recruiter.

Candidate Name Claimed: "${candidateName}"
Credential ID: "${credentialId}"
Issuing Authority: "${issuer}"
Deterministic Engine Outcome: "${outcome}"
Is Synthetic Demo Fixture: ${Boolean(isTestFixture)}
Comparison Fields: ${JSON.stringify(comparisonMatrix)}
Issuer Evidence Data: ${JSON.stringify(evidenceRecord || {})}

Guidelines:
1. Clearly identify which fields matched and which fields differed or remained unconfirmed.
2. If the outcome is Not Found, state that absence in a registry does NOT automatically prove fraudulent intent.
3. If the outcome is Mismatch or Demo Mismatch, clearly note the conflict between the claimed identity and registered/demo record.
4. If isTestFixture is true, note that this evaluation was performed against a synthetic demo sandbox record rather than an active institutional API.
5. Keep the summary under 45 words, professional, objective, and evidence-grounded.

Respond in JSON format:
{
  "summary": "Your 2-sentence plain-English forensic reasoning."
}
`;

    let timeoutId;
    const generatePromise = model.generateContent(prompt);
    // Attach noop catch to prevent unhandled background rejection if timeoutPromise wins the race
    generatePromise.catch(() => {});

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Gemini API timeout (5s limit)')), 5000);
    });

    const result = await Promise.race([generatePromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    const text = (await result.response).text();
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    return parsed.summary || null;
  } catch (err) {
    console.warn('[Gemini Summary Warning]', err.message);
    return null;
  }
}
