import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { syncAllItemsForUser } from '$lib/server/sync';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

/** "Refresh all" for the signed-in user. */
export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	const results = await syncAllItemsForUser(user.id);
	return json({
		results,
		added: results.reduce((s, r) => s + r.added, 0),
		failed: results.filter((r) => r.error).length
	});
};
