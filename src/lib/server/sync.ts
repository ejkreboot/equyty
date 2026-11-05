import type { AccountBase, Transaction, TransactionStream } from 'plaid';
import { supabaseAdmin } from './supabase-admin';
import { decryptSecret } from './crypto';
import { plaid, plaidError } from './plaid';
import { categorizeUncategorized, type CategorizeResult } from './categorize';
import type { Database, ItemStatus } from '$lib/supabase/database.types';

type TxnInsert = Database['equyty']['Tables']['transactions']['Insert'];

export interface SyncResult {
	itemId: string;
	added: number;
	modified: number;
	removed: number;
	status: ItemStatus;
	error?: string;
	categorized?: CategorizeResult;
}

const today = () => new Date().toISOString().slice(0, 10);

async function loadItem(itemId: string) {
	const { data: item, error } = await supabaseAdmin
		.from('plaid_items')
		.select('id, user_id, plaid_item_id, transactions_cursor')
		.eq('id', itemId)
		.single();
	if (error || !item) throw new Error(`Item ${itemId} not found`);

	const { data: secret } = await supabaseAdmin
		.from('plaid_item_secrets')
		.select('access_token_ciphertext')
		.eq('item_id', itemId)
		.single();
	if (!secret) throw new Error(`No access token stored for item ${itemId}`);

	return { item, accessToken: decryptSecret(secret.access_token_ciphertext) };
}

export async function getAccessToken(itemId: string): Promise<string> {
	return (await loadItem(itemId)).accessToken;
}

/**
 * Upserts Plaid accounts and records today's balance snapshot. Returns
 * plaid_account_id → uuid for ACTIVE accounts only: accounts the user removed
 * are left out, so their transactions, holdings and recurring streams are never
 * re-imported.
 */
async function upsertAccounts(userId: string, itemId: string, accounts: AccountBase[]) {
	if (!accounts.length) return new Map<string, string>();

	const { data, error } = await supabaseAdmin
		.from('accounts')
		.upsert(
			accounts.map((a) => ({
				user_id: userId,
				item_id: itemId,
				plaid_account_id: a.account_id,
				name: a.name,
				official_name: a.official_name,
				mask: a.mask,
				type: a.type,
				subtype: a.subtype,
				current_balance: a.balances.current,
				available_balance: a.balances.available,
				credit_limit: a.balances.limit,
				iso_currency_code: a.balances.iso_currency_code ?? 'USD'
			})),
			{ onConflict: 'plaid_account_id' }
		)
		.select('id, plaid_account_id, current_balance, removed_at');
	if (error) throw error;

	const active = (data ?? []).filter((a) => a.removed_at === null);
	const snapshots = active
		.filter((a) => a.current_balance !== null)
		.map((a) => ({
			account_id: a.id,
			user_id: userId,
			snapshot_date: today(),
			balance: a.current_balance as number
		}));
	if (snapshots.length) {
		await supabaseAdmin
			.from('account_balance_snapshots')
			.upsert(snapshots, { onConflict: 'account_id,snapshot_date' });
	}

	return new Map(active.map((a) => [a.plaid_account_id, a.id]));
}

function toRow(userId: string, accountId: string, t: Transaction): TxnInsert {
	return {
		user_id: userId,
		account_id: accountId,
		plaid_transaction_id: t.transaction_id,
		pending_transaction_id: t.pending_transaction_id ?? null,
		date: t.date,
		authorized_date: t.authorized_date ?? null,
		name: t.name,
		merchant_name: t.merchant_name ?? null,
		// Plaid: positive = money out. Ours: positive = money in.
		amount: -t.amount,
		iso_currency_code: t.iso_currency_code ?? 'USD',
		pending: t.pending,
		plaid_category_primary: t.personal_finance_category?.primary ?? null,
		plaid_category_detailed: t.personal_finance_category?.detailed ?? null,
		logo_url: t.logo_url ?? t.counterparties?.[0]?.logo_url ?? null,
		website: t.website ?? null,
		payment_channel: t.payment_channel ?? null
	};
}

/** Pulls all changes since the stored cursor, restarting if Plaid mutates data mid-pagination. */
async function fetchTransactionChanges(accessToken: string, startCursor: string | null) {
	for (let attempt = 0; attempt < 3; attempt++) {
		let cursor = startCursor ?? undefined;
		const added: Transaction[] = [];
		const modified: Transaction[] = [];
		const removed: string[] = [];
		let accounts: AccountBase[] = [];
		try {
			let hasMore = true;
			while (hasMore) {
				const { data } = await plaid().transactionsSync({ access_token: accessToken, cursor, count: 500 });
				added.push(...data.added);
				modified.push(...data.modified);
				removed.push(...data.removed.map((r) => r.transaction_id));
				accounts = data.accounts;
				hasMore = data.has_more;
				cursor = data.next_cursor;
			}
			return { added, modified, removed, accounts, cursor: cursor ?? null };
		} catch (err) {
			if (plaidError(err).code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') continue;
			throw err;
		}
	}
	throw new Error('Plaid data kept changing during pagination; try again shortly');
}

async function syncRecurring(userId: string, accessToken: string, accountIds: Map<string, string>) {
	try {
		const { data } = await plaid().transactionsRecurringGet({ access_token: accessToken });
		const toRows = (streams: TransactionStream[], direction: 'inflow' | 'outflow') =>
			streams
				.filter((s) => accountIds.has(s.account_id))
				.map((s) => ({
					user_id: userId,
					account_id: accountIds.get(s.account_id) as string,
					plaid_stream_id: s.stream_id,
					description: s.description,
					merchant_name: s.merchant_name,
					direction,
					frequency: s.frequency,
					average_amount: Math.abs(s.average_amount.amount ?? 0),
					last_amount: Math.abs(s.last_amount.amount ?? 0),
					first_date: s.first_date,
					last_date: s.last_date,
					predicted_next_date: s.predicted_next_date ?? null,
					is_active: s.is_active,
					status: s.status,
					plaid_category_detailed: s.personal_finance_category?.detailed ?? null,
					updated_at: new Date().toISOString()
				}));

		const rows = [...toRows(data.inflow_streams, 'inflow'), ...toRows(data.outflow_streams, 'outflow')];
		if (rows.length) {
			await supabaseAdmin.from('recurring_streams').upsert(rows, { onConflict: 'plaid_stream_id' });
		}
		// Drop streams Plaid no longer reports for these accounts.
		const keep = rows.map((r) => r.plaid_stream_id);
		let del = supabaseAdmin
			.from('recurring_streams')
			.delete()
			.eq('user_id', userId)
			.in('account_id', [...accountIds.values()]);
		if (keep.length) del = del.not('plaid_stream_id', 'in', `(${keep.map((k) => `"${k}"`).join(',')})`);
		await del;
	} catch (err) {
		// Recurring isn't available for every item/product configuration; not fatal.
		console.warn('[sync] recurring skipped:', plaidError(err).code ?? plaidError(err).message);
	}
}

async function syncHoldings(userId: string, accessToken: string, accountIds: Map<string, string>) {
	try {
		const { data } = await plaid().investmentsHoldingsGet({ access_token: accessToken });
		const securities = new Map(data.securities.map((s) => [s.security_id, s]));
		const rows = data.holdings
			.filter((h) => accountIds.has(h.account_id))
			.map((h) => {
				const s = securities.get(h.security_id);
				return {
					user_id: userId,
					account_id: accountIds.get(h.account_id) as string,
					security_id: h.security_id,
					name: s?.name ?? null,
					ticker: s?.ticker_symbol ?? null,
					security_type: s?.type ?? null,
					quantity: h.quantity,
					price: h.institution_price,
					value: h.institution_value,
					cost_basis: h.cost_basis,
					iso_currency_code: h.iso_currency_code ?? 'USD',
					updated_at: new Date().toISOString()
				};
			});
		await supabaseAdmin.from('holdings').delete().eq('user_id', userId).in('account_id', [...accountIds.values()]);
		if (rows.length) await supabaseAdmin.from('holdings').insert(rows);
	} catch (err) {
		console.warn('[sync] holdings skipped:', plaidError(err).code ?? plaidError(err).message);
	}
}

/**
 * Full sync of one Plaid item: accounts, balances, transactions (cursor-based),
 * recurring streams, investment holdings, then AI categorization.
 */
export async function syncItem(itemId: string, opts: { categorize?: boolean } = {}): Promise<SyncResult> {
	const { item, accessToken } = await loadItem(itemId);
	const userId = item.user_id;

	try {
		const { data: accountsResp } = await plaid().accountsGet({ access_token: accessToken });
		const accountIds = await upsertAccounts(userId, item.id, accountsResp.accounts);

		const changes = await fetchTransactionChanges(accessToken, item.transactions_cursor);

		// Posted transactions replace their pending twin: carry over a category the user chose.
		const pendingIds = changes.added.map((t) => t.pending_transaction_id).filter((id): id is string => !!id);
		const carried = new Map<string, { category_id: string; category_source: 'user' | 'rule' }>();
		if (pendingIds.length) {
			const { data } = await supabaseAdmin
				.from('transactions')
				.select('plaid_transaction_id, category_id, category_source')
				.eq('user_id', userId)
				.in('plaid_transaction_id', pendingIds)
				.in('category_source', ['user', 'rule'])
				.not('category_id', 'is', null);
			for (const t of data ?? []) {
				carried.set(t.plaid_transaction_id, {
					category_id: t.category_id as string,
					category_source: t.category_source as 'user' | 'rule'
				});
			}
		}

		const plain: TxnInsert[] = [];
		const withCategory: TxnInsert[] = [];
		for (const t of [...changes.added, ...changes.modified]) {
			const accountId = accountIds.get(t.account_id);
			if (!accountId) continue;
			const row = toRow(userId, accountId, t);
			const carry = t.pending_transaction_id ? carried.get(t.pending_transaction_id) : undefined;
			if (carry) withCategory.push({ ...row, ...carry });
			else plain.push(row);
		}

		// Rows in one upsert must share a column set, or missing columns get reset
		// to their defaults on conflict (which would wipe user categories).
		for (const rows of [plain, withCategory]) {
			for (let i = 0; i < rows.length; i += 500) {
				const { error } = await supabaseAdmin
					.from('transactions')
					.upsert(rows.slice(i, i + 500), { onConflict: 'plaid_transaction_id' });
				if (error) throw error;
			}
		}

		for (let i = 0; i < changes.removed.length; i += 200) {
			await supabaseAdmin
				.from('transactions')
				.delete()
				.eq('user_id', userId)
				.in('plaid_transaction_id', changes.removed.slice(i, i + 200));
		}

		await supabaseAdmin
			.from('plaid_items')
			.update({
				transactions_cursor: changes.cursor,
				last_synced_at: new Date().toISOString(),
				status: 'good',
				error_code: null
			})
			.eq('id', item.id);

		await syncRecurring(userId, accessToken, accountIds);
		if (accountsResp.accounts.some((a) => a.type === 'investment' && accountIds.has(a.account_id))) {
			await syncHoldings(userId, accessToken, accountIds);
		}

		const result: SyncResult = {
			itemId,
			added: changes.added.length,
			modified: changes.modified.length,
			removed: changes.removed.length,
			status: 'good'
		};
		if (opts.categorize !== false) {
			result.categorized = await categorizeUncategorized(userId, { limit: 600 });
		}
		return result;
	} catch (err) {
		const { code, message } = plaidError(err);
		const status: ItemStatus =
			code === 'ITEM_LOGIN_REQUIRED' || code === 'PENDING_EXPIRATION' ? 'login_required' : 'error';
		await supabaseAdmin.from('plaid_items').update({ status, error_code: code }).eq('id', item.id);
		console.error(`[sync] item ${itemId} failed:`, code ?? message);
		return { itemId, added: 0, modified: 0, removed: 0, status, error: message };
	}
}

export async function syncAllItemsForUser(userId: string): Promise<SyncResult[]> {
	const { data: items } = await supabaseAdmin
		.from('plaid_items')
		.select('id')
		.eq('user_id', userId)
		.neq('status', 'revoked');
	const results: SyncResult[] = [];
	for (const item of items ?? []) results.push(await syncItem(item.id));
	return results;
}
