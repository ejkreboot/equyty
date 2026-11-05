import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { removeAccount } from '$lib/server/removal';
import type { RequestHandler } from './$types';

/** Removes one account and all of its data (see removeAccount). */
export const DELETE: RequestHandler = async (event) => {
	const user = requireUser(event);
	const id = event.params.id;
	if (!/^[0-9a-f-]{36}$/i.test(id)) error(400, 'Invalid account id');

	// Ownership check through the RLS-scoped client before any service-role work.
	const { data: account } = await event.locals.supabase
		.from('accounts')
		.select('id, item_id')
		.eq('id', id)
		.is('removed_at', null)
		.maybeSingle();
	if (!account) error(404, 'Account not found');

	try {
		return json(await removeAccount(account.id, account.item_id, user.id));
	} catch (err) {
		console.error('[accounts] remove failed', err);
		error(500, 'Could not remove the account');
	}
};
