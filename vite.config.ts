import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import type { KitConfig } from '@sveltejs/kit';
import { defineConfig, loadEnv } from 'vite';

type ConnectSrc = NonNullable<NonNullable<KitConfig['csp']>['directives']>['connect-src'];

export default defineConfig(({ mode }) => {
	// Allow the configured Supabase origin (hosted or local) through the CSP.
	const env = loadEnv(mode, process.cwd(), 'PUBLIC_');
	const supabaseOrigin = env.PUBLIC_SUPABASE_URL
		? new URL(env.PUBLIC_SUPABASE_URL).origin
		: 'https://*.supabase.co';
	const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');
	const connectSrc = ['self', supabaseOrigin, supabaseWs, 'https://*.plaid.com'] as ConnectSrc;

	return {
		plugins: [
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},

				adapter: adapter({ runtime: 'nodejs22.x' }),

				// Content Security Policy. SvelteKit adds nonces/hashes for its own inline
				// scripts; Plaid Link needs its CDN script + iframe.
				csp: {
					mode: 'auto',
					directives: {
						'default-src': ['self'],
						'script-src': ['self', 'https://cdn.plaid.com'],
						'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
						'font-src': ['self', 'https://fonts.gstatic.com'],
						'img-src': ['self', 'data:', 'blob:', 'https://*.plaid.com'],
						'connect-src': connectSrc,
						'frame-src': ['https://cdn.plaid.com'],
						'frame-ancestors': ['none'],
						'form-action': ['self'],
						'base-uri': ['self'],
						'object-src': ['none']
					}
				}
			})
		]
	};
});
