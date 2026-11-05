import { json } from '@sveltejs/kit';
import { createHash, timingSafeEqual } from 'node:crypto';
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose';
import { plaid } from '$lib/server/plaid';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { syncItem } from '$lib/server/sync';
import type { ItemStatus } from '$lib/supabase/database.types';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

const keyCache = new Map<string, { key: JWK; fetchedAt: number }>();

async function verificationKey(kid: string): Promise<JWK | null> {
	const cached = keyCache.get(kid);
	if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) return cached.key;
	const { data } = await plaid().webhookVerificationKeyGet({ key_id: kid });
	if (data.key.expired_at) return null;
	const key = data.key as unknown as JWK;
	keyCache.set(kid, { key, fetchedAt: Date.now() });
	return key;
}

/**
 * Verifies the Plaid-Verification JWT:
 *   - ES256 only, signed by a current Plaid key
 *   - issued within the last 5 minutes (replay protection)
 *   - request_body_sha256 claim matches the exact raw body
 * https://plaid.com/docs/api/webhooks/webhook-verification/
 */
async function verify(request: Request, rawBody: string): Promise<boolean> {
	const token = request.headers.get('plaid-verification');
	if (!token) return false;
	try {
		const header = decodeProtectedHeader(token);
		if (header.alg !== 'ES256' || !header.kid) return false;
		const jwk = await verificationKey(header.kid);
		if (!jwk) return false;
		const { payload } = await jwtVerify(token, await importJWK(jwk, 'ES256'), {
			algorithms: ['ES256'],
			maxTokenAge: '5 min'
		});
		const claimed = String(payload.request_body_sha256 ?? '');
		const actual = createHash('sha256').update(rawBody, 'utf8').digest('hex');
		return claimed.length === actual.length && timingSafeEqual(Buffer.from(claimed), Buffer.from(actual));
	} catch {
		return false;
	}
}

interface PlaidWebhook {
	webhook_type: string;
	webhook_code: string;
	item_id: string;
	error?: { error_code?: string } | null;
}

export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();
	if (!(await verify(request, rawBody))) {
		return json({ ok: false }, { status: 401 });
	}

	const hook = JSON.parse(rawBody) as PlaidWebhook;
	const { data: item } = await supabaseAdmin
		.from('plaid_items')
		.select('id')
		.eq('plaid_item_id', hook.item_id)
		.maybeSingle();
	if (!item) return json({ ok: true }); // Unknown/removed item: acknowledge and ignore.

	const setStatus = (status: ItemStatus, errorCode: string | null = null) =>
		supabaseAdmin.from('plaid_items').update({ status, error_code: errorCode }).eq('id', item.id);

	switch (`${hook.webhook_type}:${hook.webhook_code}`) {
		case 'TRANSACTIONS:SYNC_UPDATES_AVAILABLE':
		case 'TRANSACTIONS:RECURRING_TRANSACTIONS_UPDATE':
		case 'HOLDINGS:DEFAULT_UPDATE':
			await syncItem(item.id);
			break;
		case 'ITEM:ERROR':
			await setStatus(
				hook.error?.error_code === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error',
				hook.error?.error_code ?? null
			);
			break;
		case 'ITEM:PENDING_EXPIRATION':
		case 'ITEM:PENDING_DISCONNECT':
			await setStatus('pending_expiration');
			break;
		case 'ITEM:USER_PERMISSION_REVOKED':
		case 'ITEM:USER_ACCOUNT_REVOKED':
			await setStatus('revoked');
			break;
		case 'ITEM:LOGIN_REPAIRED':
			await setStatus('good');
			await syncItem(item.id);
			break;
	}

	return json({ ok: true });
};
