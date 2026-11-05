import type { CategoryGroupRow, CategoryKind, CategoryRow } from './supabase/database.types';

export type GroupMeta = Pick<CategoryGroupRow, 'id' | 'name' | 'kind' | 'color_slot' | 'sort_order'>;
export type CategoryMeta = Pick<CategoryRow, 'id' | 'name' | 'icon' | 'sort_order'> & { group: GroupMeta };

/** Stand-ins for transactions that have no category yet. */
export const UNCATEGORIZED_EXPENSE: CategoryMeta = {
	id: 'uncategorized-out',
	name: 'Uncategorized',
	icon: 'help',
	sort_order: 999,
	group: { id: 'uncategorized-out', name: 'Uncategorized', kind: 'expense', color_slot: -1, sort_order: 999 }
};
export const UNCATEGORIZED_INCOME: CategoryMeta = {
	id: 'uncategorized-in',
	name: 'Uncategorized income',
	icon: 'help',
	sort_order: 999,
	group: { id: 'uncategorized-in', name: 'Income', kind: 'income', color_slot: -1, sort_order: 999 }
};

export function indexCategories(
	groups: GroupMeta[],
	categories: Pick<CategoryRow, 'id' | 'name' | 'icon' | 'sort_order' | 'group_id'>[]
): Map<string, CategoryMeta> {
	const groupById = new Map(groups.map((g) => [g.id, g]));
	const out = new Map<string, CategoryMeta>();
	for (const c of categories) {
		const group = groupById.get(c.group_id);
		if (group) out.set(c.id, { id: c.id, name: c.name, icon: c.icon, sort_order: c.sort_order, group });
	}
	return out;
}

export function kindOf(categoryId: string | null, amount: number, index: Map<string, CategoryMeta>): CategoryKind {
	const c = categoryId ? index.get(categoryId) : undefined;
	return c?.group.kind ?? (amount >= 0 ? 'income' : 'expense');
}

/** CSS color for a group's categorical slot; -1 = neutral. */
export function slotColor(slot: number): string {
	return slot < 0 ? 'var(--series-neutral)' : `var(--series-${(slot % 8) + 1})`;
}

export interface TotalsRow {
	month: string;
	category_id: string | null;
	inflow: number;
	outflow: number;
	txn_count: number;
}

export interface CategoryAmount {
	category: CategoryMeta;
	amount: number;
	count: number;
}

export interface GroupAmount {
	group: GroupMeta;
	amount: number;
	categories: CategoryAmount[];
}

export interface Summary {
	income: number;
	expenses: number;
	net: number;
	savingsRate: number;
	incomeCategories: CategoryAmount[];
	expenseCategories: CategoryAmount[];
	expenseGroups: GroupAmount[];
	incomeGroups: GroupAmount[];
}

/**
 * Collapses per-(month, category) inflow/outflow rows into income/expense
 * totals. Expense categories count net spend (refunds reduce it), income
 * categories count net income, transfers are ignored, and uncategorized
 * money is split by direction.
 */
export function summarize(rows: TotalsRow[], index: Map<string, CategoryMeta>): Summary {
	const byCategory = new Map<string, CategoryAmount>();
	const add = (category: CategoryMeta, amount: number, count: number) => {
		const cur = byCategory.get(category.id) ?? { category, amount: 0, count: 0 };
		cur.amount += amount;
		cur.count += count;
		byCategory.set(category.id, cur);
	};

	for (const r of rows) {
		const inflow = Number(r.inflow);
		const outflow = Number(r.outflow);
		const count = Number(r.txn_count);
		const category = r.category_id ? index.get(r.category_id) : undefined;
		if (!category) {
			if (inflow) add(UNCATEGORIZED_INCOME, inflow, 0);
			if (outflow) add(UNCATEGORIZED_EXPENSE, outflow, count);
			continue;
		}
		if (category.group.kind === 'transfer') continue;
		add(category, category.group.kind === 'income' ? inflow - outflow : outflow - inflow, count);
	}

	const all = [...byCategory.values()].filter((c) => Math.abs(c.amount) >= 0.005);
	const incomeCategories = all.filter((c) => c.category.group.kind === 'income').sort((a, b) => b.amount - a.amount);
	const expenseCategories = all.filter((c) => c.category.group.kind === 'expense').sort((a, b) => b.amount - a.amount);

	const income = incomeCategories.reduce((s, c) => s + c.amount, 0);
	const expenses = expenseCategories.reduce((s, c) => s + c.amount, 0);

	return {
		income,
		expenses,
		net: income - expenses,
		savingsRate: income > 0 ? (income - expenses) / income : 0,
		incomeCategories,
		expenseCategories,
		expenseGroups: groupUp(expenseCategories),
		incomeGroups: groupUp(incomeCategories)
	};
}

function groupUp(categories: CategoryAmount[]): GroupAmount[] {
	const groups = new Map<string, GroupAmount>();
	for (const c of categories) {
		const g = groups.get(c.category.group.id) ?? { group: c.category.group, amount: 0, categories: [] };
		g.amount += c.amount;
		g.categories.push(c);
		groups.set(c.category.group.id, g);
	}
	return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

export interface MonthPoint {
	month: string; // YYYY-MM
	income: number;
	expenses: number;
	net: number;
}

export function monthlySeries(rows: TotalsRow[], index: Map<string, CategoryMeta>, months: string[]): MonthPoint[] {
	const byMonth = new Map<string, TotalsRow[]>();
	for (const r of rows) {
		const key = r.month.slice(0, 7);
		const list = byMonth.get(key) ?? [];
		list.push(r);
		byMonth.set(key, list);
	}
	return months.map((month) => {
		const s = summarize(byMonth.get(month) ?? [], index);
		return { month, income: s.income, expenses: s.expenses, net: s.net };
	});
}

/** Liabilities come back from Plaid as positive balances owed. */
export function isLiability(type: string): boolean {
	return type === 'credit' || type === 'loan';
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
	depository: 'Cash',
	credit: 'Credit cards',
	investment: 'Investments',
	loan: 'Loans',
	other: 'Other'
};

export const ACCOUNT_TYPE_ICONS: Record<string, string> = {
	depository: 'account_balance',
	credit: 'credit_card',
	investment: 'trending_up',
	loan: 'real_estate_agent',
	other: 'wallet'
};
