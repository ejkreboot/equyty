import { json } from '@sveltejs/kit';
import { requireOwnedItem } from '$lib/server/guards';
import { disconnectItem } from '$lib/server/removal';
import type { RequestHandler } from './$types';

/** Disconnects an institution: revokes the Plaid item, then deletes its data. */
export const DELETE: RequestHandler = async (event) => {
	const item = await requireOwnedItem(event, event.params.id);
	await disconnectItem(item.id, event.locals.user!.id);
	return json({ ok: true });
};
