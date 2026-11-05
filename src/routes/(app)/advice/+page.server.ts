import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data } = await locals.supabase
		.from('ai_insights')
		.select('id, payload, period_start, period_end, created_at')
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	return { insight: data };
};
