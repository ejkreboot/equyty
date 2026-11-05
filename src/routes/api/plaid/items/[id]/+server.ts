import { json } from '@sveltejs/kit';
import { requireOwnedItem } from '$lib/server/guards';
import { getAccessToken } from '$lib/server/sync';
import { plaid, plaidError } from '$lib/server/plaid';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import type { RequestHandler } from './$types';

/** Disconnects an institution: revokes the Plaid item, then deletes its data. */
export const DELETE: RequestHandler = async (event) => {
	const item = await requireOwnedItem(event, event.params.id);
	try {
		await plaid().itemRemove({ access_token: await getAccessToken(item.id) });
	} catch (err) {
		// Still delete locally; the item may already be gone at Plaid.
		console.warn('[plaid] item remove failed', plaidError(err).code);
	}
	// Cascades to secrets, accounts, transactions, snapshots, holdings, streams.
	await supabaseAdmin.from('plaid_items').delete().eq('id', item.id).eq('user_id', event.locals.user!.id);
	return json({ ok: true });
};
