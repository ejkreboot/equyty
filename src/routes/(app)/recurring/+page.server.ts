import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data } = await locals.supabase
		.from('recurring_streams')
		.select('id, account_id, description, merchant_name, direction, frequency, average_amount, last_amount, last_date, predicted_next_date, is_active, status, plaid_category_detailed')
		.order('average_amount', { ascending: false });
	return { streams: data ?? [] };
};
