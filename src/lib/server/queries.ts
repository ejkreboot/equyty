import type { SupabaseClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import type { Database } from '$lib/supabase/database.types';
import type { DbSchema } from '$lib/supabase/schema';
import type { TotalsRow } from '$lib/finance';

type DB = SupabaseClient<Database, DbSchema>;

/** Per-(month, category) inflow/outflow for the signed-in user (RLS-scoped RPC). */
export async function loadTotals(sb: DB, start: string, end: string): Promise<TotalsRow[]> {
	const { data, error: e } = await sb.rpc('category_month_totals', { p_start: start, p_end: end });
	if (e) error(500, 'Could not load totals');
	return data ?? [];
}

/** Strips characters that have meaning in PostgREST filter syntax. */
export function sanitizeSearch(q: string): string {
	return q.replace(/[,()*%\\"'.:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
