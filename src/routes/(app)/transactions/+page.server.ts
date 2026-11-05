import { rangeFromUrl } from '$lib/dates';
import { sanitizeSearch } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

const PAGE = 100;
const UUID = /^[0-9a-f-]{36}$/i;

export const load: PageServerLoad = async ({ locals, url }) => {
	const q = sanitizeSearch(url.searchParams.get('q') ?? '');
	const account = url.searchParams.get('account');
	const category = url.searchParams.get('category');
	const review = url.searchParams.get('review') === '1';
	const hasRange = url.searchParams.has('range');
	const range = hasRange ? rangeFromUrl(url) : null;
	const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || PAGE, PAGE), 1000);

	let query = locals.supabase
		.from('transactions')
		.select(
			'id, date, name, merchant_name, amount, category_id, category_source, ai_confidence, needs_review, account_id, pending, logo_url, notes, is_excluded, plaid_category_detailed, payment_channel, website',
			{ count: 'exact' }
		)
		.order('date', { ascending: false })
		.order('created_at', { ascending: false })
		.limit(limit);

	if (q) query = query.or(`merchant_name.ilike.*${q}*,name.ilike.*${q}*`);
	if (account && UUID.test(account)) query = query.eq('account_id', account);
	if (category === 'none') query = query.is('category_id', null);
	else if (category && UUID.test(category)) query = query.eq('category_id', category);
	if (review) query = query.or('needs_review.eq.true,category_id.is.null');
	if (range) query = query.gte('date', range.start).lte('date', range.end);

	const { data, count } = await query;
	return {
		transactions: data ?? [],
		total: count ?? 0,
		limit,
		filters: { q, account, category, review, range }
	};
};
