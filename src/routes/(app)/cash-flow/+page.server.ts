import { monthsBetween, parseDate, rangeFromUrl } from '$lib/dates';
import { loadTotals } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const range = rangeFromUrl(url, 'last-12-months');
	const totals = await loadTotals(locals.supabase, range.start, range.end);
	const months = monthsBetween(parseDate(range.start), parseDate(range.end)).map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
	return { range, totals, months };
};
