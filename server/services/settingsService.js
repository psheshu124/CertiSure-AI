/**
 * CERTISURE AI — SETTINGS & CONFIGURATION SERVICE
 * Manages enterprise verification settings, operating modes, AI provider models,
 * and OCR confidence thresholds with safe disk persistence and in-memory fallback.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '../config');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');

// Supported Gemini AI models
export const SUPPORTED_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

// Valid operating modes
export const VALID_OPERATING_MODES = ['demo', 'production', 'offline'];

// Deployment Default Operating Mode (defaults to 'demo' for hackathon demos unless explicitly overridden)
const defaultOperatingMode = process.env.OPERATING_MODE || 'demo';

// Default configuration
const DEFAULT_SETTINGS = {
  operatingMode: defaultOperatingMode, // 'demo' | 'production' | 'offline'
  ocrConfidenceThreshold: 85, // integer 50 to 99
  aiProvider: {
    provider: 'Google Gemini',
    model: 'gemini-3.5-flash',
  },
  adapterSettings: {
    stanford: { enabled: true },
    mit: { enabled: true },
    coursera: { enabled: true },
    google_cloud: { enabled: true },
    aws: { enabled: true }
  },
  lastSaved: new Date().toISOString(),
  savedBy: 'System Default'
};

// Persistence state tracking (detects read-only filesystems / ephemeral containers)
let isDiskPersistent = true;
let diskPersistenceWarning = null;

// Ensure config directory exists safely
function ensureConfigDir() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    return true;
  } catch (err) {
    isDiskPersistent = false;
    diskPersistenceWarning = `Config directory creation unavailable (${err.code || err.message}). Operating in-memory.`;
    return false;
  }
}

// In-memory cache of current settings
let currentSettings = { ...DEFAULT_SETTINGS };

// Load settings from disk on startup with safe in-memory fallback
export function loadSettingsFromDisk() {
  try {
    const dirReady = ensureConfigDir();
    if (dirReady && fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      currentSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        // Environment variable takes precedence over file for cloud deployments
        operatingMode: process.env.OPERATING_MODE || parsed.operatingMode || defaultOperatingMode,
        aiProvider: {
          ...DEFAULT_SETTINGS.aiProvider,
          ...(parsed.aiProvider || {})
        },
        adapterSettings: {
          ...DEFAULT_SETTINGS.adapterSettings,
          ...(parsed.adapterSettings || {})
        }
      };
      isDiskPersistent = true;
      diskPersistenceWarning = null;
      console.log(`[SettingsService] Loaded settings from disk. Mode: ${currentSettings.operatingMode}, Model: ${currentSettings.aiProvider.model}, OCR Threshold: ${currentSettings.ocrConfidenceThreshold}%`);
    } else {
      // First run or missing file: initialize and attempt disk write
      saveSettingsToDisk(DEFAULT_SETTINGS);
    }
  } catch (err) {
    isDiskPersistent = false;
    diskPersistenceWarning = `Disk read unavailable (${err.code || err.message}). Using safe in-memory defaults.`;
    console.warn(`[SettingsService] ${diskPersistenceWarning}`);
    currentSettings = { ...DEFAULT_SETTINGS };
  }
  return currentSettings;
}

// Save settings to disk with graceful in-memory fallback (never crashes on read-only filesystems)
function saveSettingsToDisk(settings) {
  try {
    const dirReady = ensureConfigDir();
    if (!dirReady) {
      return { success: true, persisted: false, warning: diskPersistenceWarning };
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    isDiskPersistent = true;
    diskPersistenceWarning = null;
    return { success: true, persisted: true };
  } catch (err) {
    isDiskPersistent = false;
    diskPersistenceWarning = `Disk write unavailable (${err.code || err.message}). Operating in-memory for this container instance.`;
    console.warn(`[SettingsService] Notice: ${diskPersistenceWarning}`);
    return { success: true, persisted: false, warning: diskPersistenceWarning };
  }
}

// Get raw internal settings
export function getSettings() {
  return currentSettings;
}

// Get public safe settings (EXCLUDES ANY SECRETS)
export function getPublicSettings() {
  const s = currentSettings;
  return {
    operatingMode: s.operatingMode,
    ocrConfidenceThreshold: s.ocrConfidenceThreshold,
    aiProvider: {
      provider: s.aiProvider.provider,
      model: s.aiProvider.model,
      supportedModels: SUPPORTED_MODELS,
      configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '')
    },
    adapterSettings: s.adapterSettings,
    lastSaved: s.lastSaved,
    savedBy: s.savedBy,
    persistedToDisk: isDiskPersistent,
    persistenceNotice: diskPersistenceWarning || (isDiskPersistent ? 'Persistent disk storage active.' : 'In-memory storage active.')
  };
}

/**
 * Validate and update settings
 * @param {Object} updates
 * @param {string} author
 */
export function updateSettings(updates, author = 'Authorized Recruiter') {
  const errors = [];

  // Validate operating mode
  if (updates.operatingMode !== undefined) {
    if (!VALID_OPERATING_MODES.includes(updates.operatingMode)) {
      errors.push(`Invalid operating mode '${updates.operatingMode}'. Must be one of: ${VALID_OPERATING_MODES.join(', ')}.`);
    }
  }

  // Validate OCR threshold
  if (updates.ocrConfidenceThreshold !== undefined) {
    const thresh = Number(updates.ocrConfidenceThreshold);
    if (isNaN(thresh) || thresh < 50 || thresh > 99) {
      errors.push('OCR confidence threshold must be an integer between 50 and 99.');
    }
  }

  // Validate AI model
  if (updates.aiProvider?.model !== undefined) {
    if (!SUPPORTED_MODELS.includes(updates.aiProvider.model)) {
      errors.push(`Invalid AI model '${updates.aiProvider.model}'. Must be one of: ${SUPPORTED_MODELS.join(', ')}.`);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      message: errors.join(' ')
    };
  }

  // Apply updates to in-memory state
  currentSettings = {
    ...currentSettings,
    ...(updates.operatingMode ? { operatingMode: updates.operatingMode } : {}),
    ...(updates.ocrConfidenceThreshold !== undefined ? { ocrConfidenceThreshold: Math.round(Number(updates.ocrConfidenceThreshold)) } : {}),
    aiProvider: {
      ...currentSettings.aiProvider,
      ...(updates.aiProvider?.model ? { model: updates.aiProvider.model } : {})
    },
    adapterSettings: {
      ...currentSettings.adapterSettings,
      ...(updates.adapterSettings || {})
    },
    lastSaved: new Date().toISOString(),
    savedBy: author
  };

  // Attempt disk write with safe fallback
  const diskResult = saveSettingsToDisk(currentSettings);

  console.log(`[SettingsService] Settings updated by ${author}. Mode: ${currentSettings.operatingMode}, Model: ${currentSettings.aiProvider.model}, OCR Threshold: ${currentSettings.ocrConfidenceThreshold}% (Persisted: ${diskResult.persisted})`);

  return {
    success: true,
    persistedToDisk: diskResult.persisted,
    persistenceNotice: diskResult.persisted
      ? 'Settings successfully saved to server disk configuration.'
      : 'Settings updated in-memory for current container instance. Notice: settings reset upon container restart or redeploy on ephemeral hosting.',
    settings: getPublicSettings()
  };
}

// Initialize on module load
loadSettingsFromDisk();
