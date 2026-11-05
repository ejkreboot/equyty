import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Database } from '$lib/supabase/database.types';
import { DB_SCHEMA, type DbSchema } from '$lib/supabase/schema';

/**
 * Service-role client. BYPASSES RLS.
 *
 * - Lives under $lib/server, so SvelteKit refuses to bundle it into client code.
 * - Only used by server endpoints for writes the user must not be able to make
 *   directly (Plaid-mirrored data, encrypted access tokens, AI output).
 * - Callers MUST scope every query by a user id they obtained from a verified
 *   session (locals.safeGetSession) or a verified Plaid webhook.
 */
export const supabaseAdmin = createClient<Database, DbSchema>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	db: { schema: DB_SCHEMA },
	auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
