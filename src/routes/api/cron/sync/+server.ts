import { error, json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { syncItem } from '$lib/server/sync';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

/**
 * Daily safety-net sync (Vercel Cron). Webhooks do the real-time work; this
 * catches anything missed. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export const GET: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	const header = request.headers.get('authorization') ?? '';
	const expected = `Bearer ${secret}`;
	if (!secret || header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
		error(401, 'Unauthorized');
	}

	const staleBefore = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
	const { data: items } = await supabaseAdmin
		.from('plaid_items')
		.select('id')
		.eq('status', 'good')
		.or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`)
		.order('last_synced_at', { ascending: true, nullsFirst: true })
		.limit(25);

	const started = Date.now();
	let synced = 0;
	for (const item of items ?? []) {
		if (Date.now() - started > 240_000) break; // stay inside maxDuration
		await syncItem(item.id);
		synced++;
	}
	return json({ synced, remaining: (items?.length ?? 0) - synced });
};
