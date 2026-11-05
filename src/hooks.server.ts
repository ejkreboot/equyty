import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from '$lib/supabase/database.types';
import { DB_SCHEMA, type DbSchema } from '$lib/supabase/schema';

/**
 * Per-request Supabase client using the *anon* key + the user's auth cookies.
 * Every query made through `locals.supabase` runs as the signed-in user, so
 * Postgres RLS is always enforced. The service role client lives in
 * $lib/server/supabase-admin.ts and is never used for user-initiated reads.
 */
const supabase: Handle = async ({ event, resolve }) => {
	const cacheHeaders: Record<string, string> = {};

	event.locals.supabase = createServerClient<Database, DbSchema>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		db: { schema: DB_SCHEMA },
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
				// Supabase asks us not to let CDNs cache responses that set auth cookies.
				Object.assign(cacheHeaders, headers);
			}
		}
	});

	/**
	 * getSession() alone reads the cookie without verifying it. getUser()
	 * round-trips to Supabase Auth, which validates the JWT, so we only trust
	 * the session once both agree.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };

		return { session, user };
	};

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});

	for (const [key, value] of Object.entries(cacheHeaders)) {
		response.headers.set(key, value);
	}
	return response;
};

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/auth', '/api/plaid/webhook', '/api/cron'];

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	const path = event.url.pathname;
	const isPublic = path === '/' || PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

	if (!user && !isPublic) {
		if (path.startsWith('/api/')) {
			return new Response(JSON.stringify({ message: 'Unauthorized' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
	}

	if (user && (path === '/login' || path === '/signup' || path === '/forgot-password')) {
		redirect(303, '/dashboard');
	}

	return resolve(event);
};

const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	// Financial data: never let shared caches store authenticated pages.
	if (event.locals.user && !response.headers.has('cache-control')) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};

export const handle: Handle = sequence(supabase, authGuard, securityHeaders);
