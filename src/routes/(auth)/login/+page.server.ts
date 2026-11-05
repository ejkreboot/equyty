import { fail, redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/server/redirect';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email || !password) return fail(400, { email, message: 'Enter your email and password.' });

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error) {
			// Deliberately generic: don't reveal whether the account exists.
			return fail(400, {
				email,
				message: error.code === 'email_not_confirmed' ? 'Please confirm your email first — check your inbox.' : 'Incorrect email or password.'
			});
		}
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
