import { error, json } from '@sveltejs/kit';
import { CountryCode } from 'plaid';
import { plaid, plaidError } from '$lib/server/plaid';
import { encryptSecret } from '$lib/server/crypto';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { syncItem } from '$lib/server/sync';
import { readJson, requireUser } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	const { public_token } = await readJson<{ public_token?: string }>(event.request);
	if (!public_token || typeof public_token !== 'string' || !public_token.startsWith('public-')) {
		error(400, 'Missing public token');
	}

	let accessToken: string;
	let plaidItemId: string;
	try {
		const { data } = await plaid().itemPublicTokenExchange({ public_token });
		accessToken = data.access_token;
		plaidItemId = data.item_id;
	} catch (err) {
		error(502, plaidError(err).message);
	}

	// Institution details for display (best effort).
	let institution: { id: string | null; name: string | null; color: string | null } = { id: null, name: null, color: null };
	try {
		const { data: itemData } = await plaid().itemGet({ access_token: accessToken });
		const institutionId = itemData.item.institution_id ?? null;
		if (institutionId) {
			const { data: inst } = await plaid().institutionsGetById({
				institution_id: institutionId,
				country_codes: [CountryCode.Us],
				options: { include_optional_metadata: true }
			});
			institution = { id: institutionId, name: inst.institution.name, color: inst.institution.primary_color ?? null };
		}
	} catch (err) {
		console.warn('[plaid] institution lookup failed', plaidError(err).code);
	}

	const { data: item, error: insertError } = await supabaseAdmin
		.from('plaid_items')
		.insert({
			user_id: user.id,
			plaid_item_id: plaidItemId,
			institution_id: institution.id,
			institution_name: institution.name,
			institution_color: institution.color
		})
		.select('id')
		.single();
	if (insertError || !item) {
		await plaid().itemRemove({ access_token: accessToken }).catch(() => {});
		error(500, 'Could not save the connection');
	}

	const { error: secretError } = await supabaseAdmin
		.from('plaid_item_secrets')
		.insert({ item_id: item.id, access_token_ciphertext: encryptSecret(accessToken) });
	if (secretError) {
		await supabaseAdmin.from('plaid_items').delete().eq('id', item.id);
		await plaid().itemRemove({ access_token: accessToken }).catch(() => {});
		error(500, 'Could not save the connection');
	}

	// First sync. Historical data may still be preparing at Plaid; the
	// SYNC_UPDATES_AVAILABLE webhook (or the next manual refresh) fills it in.
	const result = await syncItem(item.id);
	return json({ itemId: item.id, added: result.added, institution: institution.name });
};
