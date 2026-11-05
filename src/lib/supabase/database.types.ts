// Mirrors supabase/migrations. Once the project is linked you can regenerate with:
//   npx supabase gen types typescript --linked --schema equyty > src/lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
	Row: Row;
	Insert: Insert;
	Update: Update;
	Relationships: [];
};

export type CategoryKind = 'income' | 'expense' | 'transfer';
export type CategorySource = 'plaid' | 'ai' | 'rule' | 'user';
export type ItemStatus = 'good' | 'login_required' | 'pending_expiration' | 'error' | 'revoked';
export type Confidence = 'high' | 'medium' | 'low';

export type ProfileRow = {
	id: string;
	display_name: string | null;
	created_at: string;
	updated_at: string;
};

export type CategoryGroupRow = {
	id: string;
	user_id: string;
	name: string;
	kind: CategoryKind;
	color_slot: number;
	sort_order: number;
	created_at: string;
};

export type CategoryRow = {
	id: string;
	user_id: string;
	group_id: string;
	name: string;
	icon: string;
	sort_order: number;
	created_at: string;
};

export type PlaidItemRow = {
	id: string;
	user_id: string;
	plaid_item_id: string;
	institution_id: string | null;
	institution_name: string | null;
	institution_color: string | null;
	status: ItemStatus;
	error_code: string | null;
	transactions_cursor: string | null;
	last_synced_at: string | null;
	created_at: string;
	updated_at: string;
};

export type PlaidItemSecretRow = {
	item_id: string;
	access_token_ciphertext: string;
	created_at: string;
};

export type AccountRow = {
	id: string;
	user_id: string;
	item_id: string;
	plaid_account_id: string;
	name: string;
	display_name: string | null;
	official_name: string | null;
	mask: string | null;
	type: string;
	subtype: string | null;
	current_balance: number | null;
	available_balance: number | null;
	credit_limit: number | null;
	iso_currency_code: string;
	is_hidden: boolean;
	removed_at: string | null;
	created_at: string;
	updated_at: string;
};

export type BalanceSnapshotRow = {
	account_id: string;
	user_id: string;
	snapshot_date: string;
	balance: number;
};

export type TransactionRow = {
	id: string;
	user_id: string;
	account_id: string;
	plaid_transaction_id: string;
	pending_transaction_id: string | null;
	date: string;
	authorized_date: string | null;
	name: string;
	merchant_name: string | null;
	amount: number;
	iso_currency_code: string;
	pending: boolean;
	category_id: string | null;
	category_source: CategorySource | null;
	ai_confidence: Confidence | null;
	needs_review: boolean;
	plaid_category_primary: string | null;
	plaid_category_detailed: string | null;
	logo_url: string | null;
	website: string | null;
	payment_channel: string | null;
	notes: string | null;
	is_excluded: boolean;
	created_at: string;
	updated_at: string;
};

export type RuleRow = {
	id: string;
	user_id: string;
	merchant_pattern: string;
	category_id: string;
	created_at: string;
};

export type BudgetRow = {
	id: string;
	user_id: string;
	category_id: string;
	month: string;
	amount: number;
	created_at: string;
	updated_at: string;
};

export type GoalRow = {
	id: string;
	user_id: string;
	name: string;
	target_amount: number;
	current_amount: number;
	target_date: string | null;
	icon: string;
	color_slot: number;
	is_archived: boolean;
	created_at: string;
	updated_at: string;
};

export type RecurringStreamRow = {
	id: string;
	user_id: string;
	account_id: string;
	plaid_stream_id: string;
	description: string;
	merchant_name: string | null;
	direction: 'inflow' | 'outflow';
	frequency: string;
	average_amount: number;
	last_amount: number;
	first_date: string | null;
	last_date: string | null;
	predicted_next_date: string | null;
	is_active: boolean;
	status: string | null;
	plaid_category_detailed: string | null;
	updated_at: string;
};

export type HoldingRow = {
	id: string;
	user_id: string;
	account_id: string;
	security_id: string;
	name: string | null;
	ticker: string | null;
	security_type: string | null;
	quantity: number;
	price: number | null;
	value: number | null;
	cost_basis: number | null;
	iso_currency_code: string;
	updated_at: string;
};

export type InsightRow = {
	id: string;
	user_id: string;
	period_start: string;
	period_end: string;
	payload: Json;
	created_at: string;
};

type WithDefaults<Row, Required extends keyof Row> = Pick<Row, Required> &
	Partial<Omit<Row, Required>>;

export type Database = {
	equyty: {
		Tables: {
			profiles: Table<ProfileRow, WithDefaults<ProfileRow, 'id'>>;
			category_groups: Table<CategoryGroupRow, WithDefaults<CategoryGroupRow, 'name' | 'kind'>>;
			categories: Table<CategoryRow, WithDefaults<CategoryRow, 'name' | 'group_id'>>;
			plaid_items: Table<PlaidItemRow, WithDefaults<PlaidItemRow, 'user_id' | 'plaid_item_id'>>;
			plaid_item_secrets: Table<
				PlaidItemSecretRow,
				WithDefaults<PlaidItemSecretRow, 'item_id' | 'access_token_ciphertext'>
			>;
			accounts: Table<
				AccountRow,
				WithDefaults<AccountRow, 'user_id' | 'item_id' | 'plaid_account_id' | 'name' | 'type'>
			>;
			account_balance_snapshots: Table<
				BalanceSnapshotRow,
				WithDefaults<BalanceSnapshotRow, 'account_id' | 'user_id' | 'snapshot_date' | 'balance'>
			>;
			transactions: Table<
				TransactionRow,
				WithDefaults<
					TransactionRow,
					'user_id' | 'account_id' | 'plaid_transaction_id' | 'date' | 'name' | 'amount'
				>
			>;
			categorization_rules: Table<
				RuleRow,
				WithDefaults<RuleRow, 'merchant_pattern' | 'category_id'>
			>;
			budgets: Table<BudgetRow, WithDefaults<BudgetRow, 'category_id' | 'month' | 'amount'>>;
			goals: Table<GoalRow, WithDefaults<GoalRow, 'name' | 'target_amount'>>;
			recurring_streams: Table<
				RecurringStreamRow,
				WithDefaults<
					RecurringStreamRow,
					| 'user_id'
					| 'account_id'
					| 'plaid_stream_id'
					| 'description'
					| 'direction'
					| 'frequency'
					| 'average_amount'
					| 'last_amount'
				>
			>;
			holdings: Table<
				HoldingRow,
				WithDefaults<HoldingRow, 'user_id' | 'account_id' | 'security_id'>
			>;
			ai_insights: Table<
				InsightRow,
				WithDefaults<InsightRow, 'user_id' | 'period_start' | 'period_end' | 'payload'>
			>;
		};
		Views: { [_ in never]: never };
		Functions: {
			ensure_user_setup: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			category_month_totals: {
				Args: { p_start: string; p_end: string };
				Returns: {
					month: string;
					category_id: string | null;
					inflow: number;
					outflow: number;
					txn_count: number;
				}[];
			};
			top_merchants: {
				Args: { p_start: string; p_end: string; p_direction: 'in' | 'out'; p_limit?: number };
				Returns: { merchant: string; total: number; txn_count: number; logo_url: string | null }[];
			};
			daily_spending: {
				Args: { p_start: string; p_end: string };
				Returns: { day: string; total: number }[];
			};
			net_worth_history: {
				Args: { p_start: string };
				Returns: { day: string; assets: number; liabilities: number }[];
			};
		};
		Enums: {
			category_kind: CategoryKind;
			category_source: CategorySource;
			item_status: ItemStatus;
		};
		CompositeTypes: { [_ in never]: never };
	};
};
