import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('supabase:auth');
	return {
		// Only what the client needs; tokens stay in the auth cookies.
		session: locals.session ? { expires_at: locals.session.expires_at ?? null } : null,
		user: locals.user ? { id: locals.user.id, email: locals.user.email ?? '' } : null
	};
};
