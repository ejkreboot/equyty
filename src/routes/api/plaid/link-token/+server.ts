import { error, json } from '@sveltejs/kit';
import { createLinkToken, isPlaidConfigured, plaidError } from '$lib/server/plaid';
import { getAccessToken } from '$lib/server/sync';
import { readJson, requireOwnedItem, requireUser } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	if (!isPlaidConfigured()) error(503, 'Bank connections are not configured yet. Add your Plaid keys to the environment.');

	const { itemId } = await readJson<{ itemId?: string | null }>(event.request);

	let accessToken: string | undefined;
	if (itemId) {
		await requireOwnedItem(event, itemId);
		accessToken = await getAccessToken(itemId);
	}

	try {
		const { link_token, expiration } = await createLinkToken(user.id, accessToken);
		return json({ link_token, expiration });
	} catch (err) {
		const e = plaidError(err);
		console.error('[plaid] link token failed', e.code, e.message);
		error(502, e.message);
	}
};
