import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:rules');
	const { data } = await locals.supabase.from('categorization_rules').select('id, merchant_pattern, category_id, created_at').order('merchant_pattern');
	return { rules: data ?? [] };
};

export const actions: Actions = {
	profile: async ({ request, locals }) => {
		const name = String((await request.formData()).get('display_name') ?? '').trim().slice(0, 80);
		const { error } = await locals.supabase.from('profiles').update({ display_name: name || null }).eq('id', locals.user!.id);
		if (error) return fail(500, { profileError: 'Could not save your profile' });
		return { profileSaved: true };
	}
};
