import { addDays, isoDate, monthEnd, monthStart } from '$lib/dates';
import { loadTotals } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sb = locals.supabase;
	const now = new Date();
	const thisStart = monthStart(now);
	const lastStart = monthStart(new Date(now.getFullYear(), now.getMonth() - 1, 1));
	const today = isoDate(now);

	const [totals, daily, netWorth, recent, upcoming, budgets, review] = await Promise.all([
		loadTotals(sb, isoDate(lastStart), isoDate(monthEnd(now))),
		sb.rpc('daily_spending', { p_start: isoDate(lastStart), p_end: today }),
		sb.rpc('net_worth_history', { p_start: isoDate(addDays(now, -180)) }),
		sb
			.from('transactions')
			.select('id, date, name, merchant_name, amount, category_id, account_id, pending, logo_url, category_source')
			.order('date', { ascending: false })
			.order('created_at', { ascending: false })
			.limit(7),
		sb
			.from('recurring_streams')
			.select('id, description, merchant_name, average_amount, predicted_next_date, frequency, direction')
			.eq('is_active', true)
			.eq('direction', 'outflow')
			.gte('predicted_next_date', today)
			.order('predicted_next_date')
			.limit(5),
		sb.from('budgets').select('category_id, amount').eq('month', isoDate(thisStart)),
		sb.from('transactions').select('id', { count: 'exact', head: true }).or('needs_review.eq.true,category_id.is.null')
	]);

	return {
		totals,
		thisMonth: isoDate(thisStart).slice(0, 7),
		lastMonth: isoDate(lastStart).slice(0, 7),
		daily: daily.data ?? [],
		netWorth: netWorth.data ?? [],
		recent: recent.data ?? [],
		upcoming: upcoming.data ?? [],
		budgets: budgets.data ?? [],
		reviewCount: review.count ?? 0
	};
};
