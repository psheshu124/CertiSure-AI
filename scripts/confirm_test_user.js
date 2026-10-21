/**
 * CERTISURE AI — LOCAL TEST ACCOUNT CONFIRMATION SCRIPT
 * Confirms an unconfirmed user account in Supabase using the Auth Admin API.
 *
 * Usage:
 *   node scripts/confirm_test_user.js <targetUserId> [optionalMatchingEmail]
 * Example:
 *   node scripts/confirm_test_user.js 11111111-2222-3333-4444-555555555555 recruiter@example.com
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function run() {
  console.log('====================================================');
  console.log('   CERTISURE AI — LOCAL DEV AUTH CONFIRMATION       ');
  console.log('====================================================\n');

  if (process.env.NODE_ENV === 'production') {
    console.error('[Restricted] This development tool refuses to run in production environments (NODE_ENV=production).');
    process.exit(1);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('[Error] VITE_SUPABASE_URL is missing in .env');
    process.exit(1);
  }

  if (!serviceRoleKey || serviceRoleKey.trim().length < 10) {
    console.warn('[!] SUPABASE_SERVICE_ROLE_KEY is not configured in .env (server-side).');
    console.log('\nTo use this server-side confirmation tool:');
    console.log('1. Go to your Supabase Project Dashboard: https://supabase.com/dashboard/project/_/settings/api');
    console.log('2. Under "Project API keys", copy the "service_role" secret key (reveal it).');
    console.log('3. Add it to your local .env file (DO NOT commit it):');
    console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key\n');
    console.log('----------------------------------------------------');
    console.log('ALTERNATIVE 1-CLICK METHOD (NO KEY NEEDED IN .ENV):');
    console.log('In your Supabase Dashboard:');
    console.log('1. Click "SQL Editor" in the left sidebar.');
    console.log('2. Run this query:');
    console.log("   UPDATE auth.users SET email_confirmed_at = now() WHERE email = '<your-email>';");
    console.log('====================================================\n');
    process.exit(0);
  }

  const args = process.argv.slice(2);
  const targetId = args[0];
  const targetEmail = args[1];

  if (!targetId) {
    console.log('Please provide your target User ID (UUID from Supabase Authentication -> Users table).');
    console.log('Usage: node scripts/confirm_test_user.js <user-uuid> [email]');
    process.exit(1);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(targetId)) {
    console.error(`[Error] Provided targetId '${targetId}' is not a valid UUID format.`);
    process.exit(1);
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  console.log(`Target User UUID: ${targetId}`);
  if (targetEmail) console.log(`Target Email Verification: ${targetEmail}`);

  const adminClient = createClient(supabaseUrl, serviceRoleKey.trim(), {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Verify user exists first
  const { data: userRes, error: fetchErr } = await adminClient.auth.admin.getUserById(targetId);
  if (fetchErr || !userRes?.user) {
    console.error(`\n[Failed] User not found: ${fetchErr?.message || 'No user matching this ID'}`);
    process.exit(1);
  }

  const foundUser = userRes.user;
  console.log(`Found registered user: ${foundUser.email} (Current confirmed: ${Boolean(foundUser.email_confirmed_at)})`);

  if (targetEmail && targetEmail.toLowerCase() !== foundUser.email?.toLowerCase()) {
    console.error(`\n[Mismatch Error] User email '${foundUser.email}' does not match requested targetEmail '${targetEmail}'. Aborting.`);
    process.exit(1);
  }

  // Update confirmation
  const { data: updateRes, error: updateErr } = await adminClient.auth.admin.updateUserById(targetId, {
    email_confirm: true
  });

  if (updateErr) {
    console.error(`\n[Failed] Update failed: ${updateErr.message}`);
    process.exit(1);
  }

  console.log('\n[SUCCESS] User account has been successfully confirmed!');
  console.log(`- ID: ${updateRes.user.id}`);
  console.log(`- Email: ${updateRes.user.email}`);
  console.log(`- Confirmed At: ${updateRes.user.email_confirmed_at}`);
  console.log('\nYou can now log in at http://localhost:5173 with this email and your password.');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('[Error in confirmation script]', err);
  process.exit(1);
});
