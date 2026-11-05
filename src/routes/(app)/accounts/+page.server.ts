import { addDays, isoDate } from '$lib/dates';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data } = await locals.supabase.rpc('net_worth_history', { p_start: isoDate(addDays(new Date(), -365)) });
	return { history: data ?? [] };
};
