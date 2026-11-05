import { isoDate, monthEnd, parseDate } from '$lib/dates';
import { loadTotals } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const now = new Date();
	const raw = url.searchParams.get('month');
	const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : isoDate(now).slice(0, 7);
	const start = parseDate(`${month}-01`);
	const prev3Start = new Date(start.getFullYear(), start.getMonth() - 3, 1);
	const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);

	const [budgets, prevBudgets, totals, history] = await Promise.all([
		locals.supabase.from('budgets').select('category_id, amount').eq('month', isoDate(start)),
		locals.supabase.from('budgets').select('category_id, amount').eq('month', isoDate(prevStart)),
		loadTotals(locals.supabase, isoDate(start), isoDate(monthEnd(start))),
		loadTotals(locals.supabase, isoDate(prev3Start), isoDate(new Date(start.getFullYear(), start.getMonth(), 0)))
	]);

	return {
		month,
		budgets: budgets.data ?? [],
		prevBudgets: prevBudgets.data ?? [],
		totals,
		history
	};
};
