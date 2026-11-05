import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:goals');
	const { data } = await locals.supabase
		.from('goals')
		.select('id, name, target_amount, current_amount, target_date, icon, color_slot, is_archived, created_at')
		.order('is_archived')
		.order('created_at');
	return { goals: data ?? [] };
};
