import { json } from '@sveltejs/kit';
import { readJson, requireUser } from '$lib/server/guards';
import { categorizeUncategorized } from '$lib/server/categorize';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

/** Runs AI categorization over the caller's uncategorized transactions. */
export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	const body = await readJson<{ transactionIds?: unknown }>(event.request);
	const ids = Array.isArray(body.transactionIds)
		? body.transactionIds.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500)
		: undefined;
	const result = await categorizeUncategorized(user.id, { limit: 500, transactionIds: ids });
	return json(result);
};
