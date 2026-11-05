import { error, type RequestEvent } from '@sveltejs/kit';

/** Returns the verified user for an API request or throws 401. */
export function requireUser(event: Pick<RequestEvent, 'locals'>) {
	const user = event.locals.user;
	if (!user) error(401, 'Unauthorized');
	return user;
}

/**
 * Confirms the item belongs to the caller by reading it through the user's
 * RLS-scoped client. Only after this passes may service-role code touch it.
 */
export async function requireOwnedItem(event: Pick<RequestEvent, 'locals'>, itemId: string) {
	requireUser(event);
	if (!/^[0-9a-f-]{36}$/i.test(itemId)) error(400, 'Invalid item id');
	const { data } = await event.locals.supabase.from('plaid_items').select('id, plaid_item_id').eq('id', itemId).maybeSingle();
	if (!data) error(404, 'Connection not found');
	return data;
}

/** Only accept JSON bodies on JSON endpoints (blocks form-encoded CSRF attempts). */
export async function readJson<T>(request: Request): Promise<T> {
	if (!request.headers.get('content-type')?.includes('application/json')) error(415, 'Expected application/json');
	try {
		return (await request.json()) as T;
	} catch {
		error(400, 'Invalid JSON');
	}
}
