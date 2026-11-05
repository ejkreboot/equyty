import { indexCategories, type CategoryMeta, type GroupMeta } from './finance';
import type { CategoryRow } from './supabase/database.types';

type CatalogInput = {
	groups: GroupMeta[];
	categories: Pick<CategoryRow, 'id' | 'name' | 'icon' | 'sort_order' | 'group_id'>[];
	accounts: { id: string; name: string; display_name: string | null; mask: string | null; type: string }[];
};

/** Lookup helpers derived from the app layout's reference data. */
export function catalog(data: CatalogInput) {
	const index = indexCategories(data.groups, data.categories);
	const ordered: CategoryMeta[] = [...index.values()].sort(
		(a, b) => a.group.sort_order - b.group.sort_order || a.sort_order - b.sort_order || a.name.localeCompare(b.name)
	);
	const accountsById = new Map(data.accounts.map((a) => [a.id, a]));
	const accountName = (id: string) => {
		const a = accountsById.get(id);
		return a ? (a.display_name ?? a.name) : 'Account';
	};
	return { index, ordered, accountsById, accountName };
}
