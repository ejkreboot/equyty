import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Small, app-wide reference data every page needs. All reads run through RLS. */
export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:catalog');
	const sb = locals.supabase;

	// Profile + default categories are created on first visit (idempotent), not by a
	// trigger on auth.users, which is shared with other apps on the same project.
	const { data: existing } = await sb.from('profiles').select('id').maybeSingle();
	if (!existing) {
		const { error: setupError } = await sb.rpc('ensure_user_setup');
		if (setupError) error(500, 'Could not set up your account');
	}

	const [profile, groups, categories, accounts, items] = await Promise.all([
		sb.from('profiles').select('display_name').maybeSingle(),
		sb.from('category_groups').select('id, name, kind, color_slot, sort_order').order('sort_order'),
		sb.from('categories').select('id, name, icon, sort_order, group_id').order('sort_order'),
		sb
			.from('accounts')
			.select('id, item_id, name, display_name, mask, type, subtype, current_balance, available_balance, credit_limit, iso_currency_code, is_hidden, updated_at')
			.is('removed_at', null)
			.order('name'),
		sb.from('plaid_items').select('id, institution_name, institution_color, status, error_code, last_synced_at, created_at').order('created_at')
	]);

	for (const r of [groups, categories, accounts, items]) {
		if (r.error) error(500, 'Could not load your data');
	}

	return {
		displayName: profile.data?.display_name ?? null,
		email: locals.user?.email ?? '',
		groups: groups.data ?? [],
		categories: categories.data ?? [],
		accounts: accounts.data ?? [],
		items: items.data ?? []
	};
};
