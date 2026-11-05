import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		if (password.length < 10) return fail(400, { message: 'Use at least 10 characters.' });
		if (password !== confirm) return fail(400, { message: 'Passwords don’t match.' });
		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) return fail(400, { message: error.message });
		await locals.supabase.auth.signOut({ scope: 'others' });
		redirect(303, '/settings?password=updated');
	}
};
