import { rangeFromUrl } from '$lib/dates';
import { loadTotals } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

const TABS = ['cash-flow', 'spending', 'income'] as const;
export type ReportTab = (typeof TABS)[number];

export const load: PageServerLoad = async ({ locals, url }) => {
	const range = rangeFromUrl(url);
	const raw = url.searchParams.get('tab');
	const tab: ReportTab = TABS.includes(raw as ReportTab) ? (raw as ReportTab) : 'cash-flow';

	const [totals, merchants] = await Promise.all([
		loadTotals(locals.supabase, range.start, range.end),
		tab === 'cash-flow'
			? Promise.resolve({ data: [] })
			: locals.supabase.rpc('top_merchants', {
					p_start: range.start,
					p_end: range.end,
					p_direction: tab === 'income' ? 'in' : 'out',
					p_limit: 12
				})
	]);

	return { range, tab, totals, merchants: merchants.data ?? [] };
};
