import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/server/redirect';
import type { RequestHandler } from './$types';

/** Handles links from Supabase auth emails (signup confirmation, password recovery). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;
	const next = safeNext(url.searchParams.get('next'));

	const code = url.searchParams.get('code');

	// Custom email templates: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…
	if (tokenHash && type) {
		const { error } = await locals.supabase.auth.verifyOtp({ type, token_hash: tokenHash });
		if (!error) redirect(303, type === 'signup' || type === 'email' ? '/login?confirmed=1' : next);
	}
	// Default templates with the PKCE flow redirect here with ?code=…
	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) redirect(303, next);
	}
	redirect(303, '/login?error=link');
};
