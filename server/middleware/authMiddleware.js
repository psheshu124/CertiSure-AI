import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

let supabaseClient = null;
if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project-id')) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Validates Supabase JWT from Authorization header
 * @param {import('express').Request} req
 * @returns {Promise<{ authenticated: boolean, user: Object|null, error: string|null }>}
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, user: null, error: 'NO_BEARER_TOKEN' };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { authenticated: false, user: null, error: 'EMPTY_BEARER_TOKEN' };
  }

  if (!supabaseClient) {
    return { authenticated: false, user: null, error: 'SUPABASE_NOT_CONFIGURED_ON_SERVER' };
  }

  try {
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data?.user) {
      return { authenticated: false, user: null, error: error?.message || 'INVALID_JWT_TOKEN' };
    }
    return { authenticated: true, user: data.user, error: null };
  } catch (err) {
    return { authenticated: false, user: null, error: err.message };
  }
}
