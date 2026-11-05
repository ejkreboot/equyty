import { json } from '@sveltejs/kit';
import { requireOwnedItem } from '$lib/server/guards';
import { syncItem } from '$lib/server/sync';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

export const POST: RequestHandler = async (event) => {
	await requireOwnedItem(event, event.params.id);
	return json(await syncItem(event.params.id));
};
