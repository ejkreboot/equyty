import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const email = String((await request.formData()).get('email') ?? '').trim();
		if (!email) return fail(400, { message: 'Enter your email.' });
		await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/auth/confirm?next=/settings/password`
		});
		// Same response whether or not the account exists.
		return { sent: true };
	}
};
