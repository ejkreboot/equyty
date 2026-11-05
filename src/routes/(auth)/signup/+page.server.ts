import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 80);
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email) return fail(400, { name, email, message: 'Enter your email.' });
		if (password.length < 10) return fail(400, { name, email, message: 'Use at least 10 characters for your password.' });

		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: { display_name: name },
				emailRedirectTo: `${url.origin}/auth/confirm`
			}
		});
		if (error) return fail(400, { name, email, message: error.message });

		// Email confirmation disabled → we already have a session.
		if (data.session) redirect(303, '/dashboard');
		return { sent: true, email };
	}
};
