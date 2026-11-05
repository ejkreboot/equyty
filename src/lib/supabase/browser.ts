import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from './database.types';
import { DB_SCHEMA, type DbSchema } from './schema';

let client: SupabaseClient<Database, DbSchema> | null = null;

/**
 * Browser Supabase client (anon key + the user's session cookie).
 * All writes it makes are constrained by RLS policies and column grants.
 */
export function supabase(): SupabaseClient<Database, DbSchema> {
	client ??= createBrowserClient<Database, DbSchema>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		db: { schema: DB_SCHEMA }
	});
	return client;
}
