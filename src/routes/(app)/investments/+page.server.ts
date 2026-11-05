import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data } = await locals.supabase
		.from('holdings')
		.select('id, account_id, name, ticker, security_type, quantity, price, value, cost_basis')
		.order('value', { ascending: false, nullsFirst: false });
	return { holdings: data ?? [] };
};
