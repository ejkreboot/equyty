import { supabaseAdmin } from './supabase-admin';
import { getAccessToken } from './sync';
import { plaid, plaidError } from './plaid';

/**
 * Revokes a Plaid Item and deletes it locally. Cascades to its secret,
 * accounts, transactions, snapshots, holdings and recurring streams.
 * Callers must have verified the item belongs to `userId`.
 */
export async function disconnectItem(itemId: string, userId: string) {
	try {
		await plaid().itemRemove({ access_token: await getAccessToken(itemId) });
	} catch (err) {
		// Still delete locally; the item may already be gone at Plaid.
		console.warn('[plaid] item remove failed', plaidError(err).code);
	}
	const { error } = await supabaseAdmin.from('plaid_items').delete().eq('id', itemId).eq('user_id', userId);
	if (error) throw error;
}

export type RemovalResult = { removed: 'account' } | { removed: 'connection'; itemId: string };

/**
 * Removes one account. Plaid can't stop sharing a single account within an
 * Item, so the row is kept as a tombstone (removed_at) that sync skips, and
 * all of its data is deleted. Removing an Item's last active account
 * disconnects the whole Item instead, since nothing would be left to sync.
 * Callers must have verified the account belongs to `userId`.
 */
export async function removeAccount(accountId: string, itemId: string, userId: string): Promise<RemovalResult> {
	const { count } = await supabaseAdmin
		.from('accounts')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId)
		.eq('item_id', itemId)
		.is('removed_at', null)
		.neq('id', accountId);

	if (!count) {
		await disconnectItem(itemId, userId);
		return { removed: 'connection', itemId };
	}

	// Tombstone first so a sync running concurrently stops importing into it.
	const { error } = await supabaseAdmin
		.from('accounts')
		.update({ removed_at: new Date().toISOString(), is_hidden: true })
		.eq('id', accountId)
		.eq('user_id', userId);
	if (error) throw error;

	for (const table of ['transactions', 'account_balance_snapshots', 'holdings', 'recurring_streams'] as const) {
		const { error: delError } = await supabaseAdmin.from(table).delete().eq('user_id', userId).eq('account_id', accountId);
		if (delError) throw delError;
	}
	return { removed: 'account' };
}
