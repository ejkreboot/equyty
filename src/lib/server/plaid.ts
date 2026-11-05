import {
	Configuration,
	CountryCode,
	PlaidApi,
	PlaidEnvironments,
	Products,
	type LinkTokenCreateRequest
} from 'plaid';
import { env } from '$env/dynamic/private';

let client: PlaidApi | null = null;

const plaidEnv = () => (env.PLAID_ENV || 'sandbox').toLowerCase();

/**
 * Plaid issues a different secret per environment. Prefer the one matching
 * PLAID_ENV (PLAID_SANDBOX_SECRET / PLAID_PRODUCTION_SECRET), else PLAID_SECRET.
 */
function plaidSecret(): string | undefined {
	const specific = plaidEnv() === 'production' ? env.PLAID_PRODUCTION_SECRET : env.PLAID_SANDBOX_SECRET;
	return specific || env.PLAID_SECRET || undefined;
}

export function isPlaidConfigured(): boolean {
	return Boolean(env.PLAID_CLIENT_ID && plaidSecret());
}

export function plaid(): PlaidApi {
	if (client) return client;
	if (!isPlaidConfigured()) {
		throw new Error('Plaid is not configured. Set PLAID_CLIENT_ID, PLAID_ENV and the matching secret.');
	}
	const basePath = PlaidEnvironments[plaidEnv() as keyof typeof PlaidEnvironments];
	if (!basePath) throw new Error(`Unknown PLAID_ENV "${env.PLAID_ENV}" (use sandbox or production)`);

	client = new PlaidApi(
		new Configuration({
			basePath,
			baseOptions: {
				headers: {
					'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
					'PLAID-SECRET': plaidSecret(),
					'Plaid-Version': '2020-09-14'
				},
				timeout: 30_000
			}
		})
	);
	return client;
}

function parseProducts(value: string | undefined, fallback: Products[]): Products[] {
	if (!value) return fallback;
	const valid = new Set<string>(Object.values(Products));
	return value
		.split(',')
		.map((p) => p.trim())
		.filter((p): p is Products => valid.has(p));
}

/**
 * Creates a Link token. Pass `accessToken` to open Link in *update mode*
 * (re-authenticating an item whose login expired).
 */
export async function createLinkToken(userId: string, accessToken?: string) {
	const request: LinkTokenCreateRequest = {
		user: { client_user_id: userId },
		client_name: 'Equyty',
		language: 'en',
		country_codes: [CountryCode.Us],
		webhook: env.PLAID_WEBHOOK_URL || undefined,
		redirect_uri: env.PLAID_REDIRECT_URI || undefined
	};

	if (accessToken) {
		request.access_token = accessToken;
	} else {
		request.products = parseProducts(env.PLAID_PRODUCTS, [Products.Transactions]);
		const optional = parseProducts(env.PLAID_OPTIONAL_PRODUCTS, []);
		if (optional.length) request.optional_products = optional;
		request.transactions = { days_requested: 730 };
	}

	const { data } = await plaid().linkTokenCreate(request);
	return data;
}

/** Plaid errors arrive as Axios errors with the Plaid error body in response.data. */
export function plaidError(err: unknown): { code: string | null; type: string | null; message: string } {
	const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
	if (data && typeof data === 'object') {
		return {
			code: (data.error_code as string) ?? null,
			type: (data.error_type as string) ?? null,
			message: (data.display_message as string) || (data.error_message as string) || 'Plaid request failed'
		};
	}
	return { code: null, type: null, message: err instanceof Error ? err.message : 'Plaid request failed' };
}
