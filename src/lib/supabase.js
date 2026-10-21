import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Determine if real Supabase credentials are configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-supabase-publishable')
);

// Instantiate client only if valid URL string or dummy fallback to prevent initialization crashes
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Storage Document Upload Helper
 * Uploads certificate PDF/PNG/JPEG to private 'certificates' bucket
 * Path convention: <user_id>/<verification_id>/<safe_filename>
 */
export async function uploadCertificateDocument(file, userId, verificationId) {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[Supabase] Not configured. Simulating document storage.');
    return {
      path: `simulated/${verificationId}/${file.name}`,
      publicUrl: null,
      isSimulated: true,
    };
  }

  // Validate file size (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('Document exceeds maximum allowed size of 5MB.');
  }

  // Validate allowed mime types
  const allowedMime = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedMime.includes(file.type)) {
    throw new Error('Invalid file format. Only PDF, PNG, and JPEG documents are permitted.');
  }

  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${verificationId}/${Date.now()}_${sanitizedFileName}`;

  const { data, error } = await supabase.storage
    .from('certificates')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('[Supabase Storage Error]', error);
    throw error;
  }

  return {
    path: data.path,
    fullPath: data.fullPath,
    isSimulated: false,
  };
}

/**
 * Generate secure, short-lived signed URL for private document inspection
 */
export async function getDocumentSignedUrl(filePath, expiresInSeconds = 300) {
  if (!isSupabaseConfigured || !supabase || !filePath || filePath.startsWith('simulated/')) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from('certificates')
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    console.warn('[Supabase Storage Signed URL Error]', error);
    return null;
  }

  return data?.signedUrl || null;
}
