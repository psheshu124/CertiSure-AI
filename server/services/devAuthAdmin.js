/**
 * CERTISURE AI — LOCAL DEVELOPMENT AUTH ADMIN SERVICE
 * Strictly for local development test account confirmation.
 * Protected by environment checks, admin token validation, and targeted user verification.
 * NEVER enabled in production. NEVER exposes service-role keys.
 */

import { createClient } from '@supabase/supabase-js';

export function isDevAdminAvailable() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const devSecret = process.env.DEV_ADMIN_SECRET;
  return Boolean(
    url &&
    serviceKey &&
    serviceKey.trim().length > 10 &&
    devSecret &&
    devSecret.trim().length >= 8
  );
}

export function getDevAdminClient() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[DevAuthAdmin] Restricted: Admin API is strictly prohibited in production.');
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || serviceKey.trim().length < 10) {
    throw new Error('[DevAuthAdmin] SUPABASE_SERVICE_ROLE_KEY is not configured in server-side .env file.');
  }

  return createClient(url, serviceKey.trim(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });
}

/**
 * Confirm a specific test user account in development.
 * @param {Object} options
 * @param {string} options.targetUserId - The explicit Supabase UUID of the test account
 * @param {string} options.targetEmail - Optional matching email verification
 * @param {string} options.adminSecret - Shared development authorization token
 */
export async function confirmDevelopmentTestUser({ targetUserId, targetEmail, adminSecret }) {
  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      status: 403,
      message: 'Dev admin action is strictly prohibited in production mode.',
    };
  }

  // 1. Verify shared development secret — no insecure default allowed
  const expectedSecret = process.env.DEV_ADMIN_SECRET;
  if (!expectedSecret || expectedSecret.trim().length < 8) {
    return {
      success: false,
      status: 403,
      message: 'Dev admin action is disabled: DEV_ADMIN_SECRET is not configured or too short (min 8 chars).',
    };
  }
  if (!adminSecret || adminSecret !== expectedSecret) {
    return {
      success: false,
      status: 401,
      message: 'Unauthorized: Invalid development admin secret.',
    };
  }

  // 2. Validate target user ID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cleanId = (targetUserId || '').trim();
  if (!cleanId || !uuidRegex.test(cleanId)) {
    return {
      success: false,
      status: 400,
      message: 'Invalid targetUserId format. A valid Supabase UUID is required.',
    };
  }

  // 3. Check Service Role Key availability
  if (!isDevAdminAvailable()) {
    return {
      success: false,
      status: 503,
      code: 'SERVICE_ROLE_KEY_MISSING',
      message: 'SUPABASE_SERVICE_ROLE_KEY is not configured in server .env. Please configure it in your server environment to use this development confirmation utility.',
    };
  }

  try {
    const adminClient = getDevAdminClient();

    // 4. Retrieve target user first to verify identity
    const { data: userData, error: fetchErr } = await adminClient.auth.admin.getUserById(cleanId);
    if (fetchErr || !userData?.user) {
      return {
        success: false,
        status: 404,
        message: `Target user '${cleanId}' not found in Supabase Auth registry.`,
      };
    }

    const targetUser = userData.user;

    // Optional email verification match if specified
    if (targetEmail && targetEmail.trim().toLowerCase() !== targetUser.email?.toLowerCase()) {
      return {
        success: false,
        status: 400,
        message: `Target email mismatch. User ${cleanId} has registered email '${targetUser.email}', not '${targetEmail}'.`,
      };
    }

    // 5. Update confirmation state using Supabase Auth Admin API
    const { data: updateData, error: updateErr } = await adminClient.auth.admin.updateUserById(
      cleanId,
      { email_confirm: true }
    );

    if (updateErr) {
      return {
        success: false,
        status: 500,
        error: updateErr.message,
        message: `Failed to confirm user: ${updateErr.message}`,
      };
    }

    return {
      success: true,
      status: 200,
      message: `Account '${updateData.user.email}' (UUID: ${updateData.user.id}) successfully confirmed in Supabase Auth.`,
      user: {
        id: updateData.user.id,
        email: updateData.user.email,
        email_confirmed_at: updateData.user.email_confirmed_at,
        confirmed: Boolean(updateData.user.email_confirmed_at),
      }
    };
  } catch (err) {
    return {
      success: false,
      status: 500,
      error: err.message,
      message: `Internal error in dev admin confirmation: ${err.message}`,
    };
  }
}
