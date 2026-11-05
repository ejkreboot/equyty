-- =============================================================================
-- Equyty — initial schema
--
-- Everything lives in its own `equyty` schema so the app can share a Supabase
-- project (e.g. a team dev database) with other apps without name collisions.
-- This migration creates objects ONLY inside `equyty`: it adds no triggers to
-- the shared auth.users table and changes no privileges outside this schema.
--
-- Security model
--   * Every table has RLS enabled. Policies scope rows to (select auth.uid()).
--   * Supabase only pre-grants privileges on `public`, so this schema grants
--     explicitly: authenticated gets table access (then narrowed below),
--     service_role gets full access, anon gets nothing at all.
--   * Tables that mirror Plaid data (items, accounts, transactions, holdings,
--     recurring streams, balance snapshots) are written ONLY by server code
--     using the service role. Browser clients get read access plus narrowly
--     scoped column-level UPDATE grants (e.g. a transaction's category/notes).
--   * Plaid access tokens live in plaid_item_secrets, encrypted at the
--     application layer (AES-256-GCM). That table has RLS enabled with NO
--     policies and no privileges for anon/authenticated, so it is reachable
--     only with the service role key.
--   * Composite foreign keys (id, user_id) guarantee a row can only reference
--     a parent row owned by the same user (e.g. no pointing a transaction at
--     another user's category).
--   * New users are set up lazily by equyty.ensure_user_setup(), which the app
--     calls on first load, instead of a trigger on the shared auth.users.
--
-- The Data API must expose this schema: Dashboard → Project Settings →
-- Data API → Exposed schemas → add `equyty`.
-- =============================================================================

create schema if not exists equyty;
grant usage on schema equyty to authenticated, service_role;

create type equyty.category_kind as enum ('income', 'expense', 'transfer');
create type equyty.category_source as enum ('plaid', 'ai', 'rule', 'user');
create type equyty.item_status as enum ('good', 'login_required', 'pending_expiration', 'error', 'revoked');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function equyty.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table equyty.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------
create table equyty.category_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind equyty.category_kind not null,
  color_slot smallint not null default 0 check (color_slot between 0 and 7),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table equyty.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default 'category' check (char_length(icon) <= 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  foreign key (group_id, user_id) references equyty.category_groups (id, user_id) on delete cascade
);
create index categories_group_idx on equyty.categories (group_id);

-- -----------------------------------------------------------------------------
-- Plaid items & secrets
-- -----------------------------------------------------------------------------
create table equyty.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id text not null unique,
  institution_id text,
  institution_name text,
  institution_color text,
  status equyty.item_status not null default 'good',
  error_code text,
  transactions_cursor text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index plaid_items_user_idx on equyty.plaid_items (user_id);

create table equyty.plaid_item_secrets (
  item_id uuid primary key references equyty.plaid_items (id) on delete cascade,
  access_token_ciphertext text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------
create table equyty.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null,
  plaid_account_id text not null unique,
  name text not null,
  display_name text check (char_length(display_name) <= 80),
  official_name text,
  mask text,
  type text not null,
  subtype text,
  current_balance numeric(14, 2),
  available_balance numeric(14, 2),
  credit_limit numeric(14, 2),
  iso_currency_code text not null default 'USD',
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (item_id, user_id) references equyty.plaid_items (id, user_id) on delete cascade
);
create index accounts_user_idx on equyty.accounts (user_id);
create index accounts_item_idx on equyty.accounts (item_id);

create table equyty.account_balance_snapshots (
  account_id uuid not null,
  user_id uuid not null,
  snapshot_date date not null,
  balance numeric(14, 2) not null,
  primary key (account_id, snapshot_date),
  foreign key (account_id, user_id) references equyty.accounts (id, user_id) on delete cascade
);
create index balance_snapshots_user_date_idx on equyty.account_balance_snapshots (user_id, snapshot_date);

-- -----------------------------------------------------------------------------
-- Transactions
--   amount sign convention: positive = money in, negative = money out.
--   (Plaid uses the opposite; the sync layer flips it.)
-- -----------------------------------------------------------------------------
create table equyty.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  plaid_transaction_id text not null unique,
  pending_transaction_id text,
  date date not null,
  authorized_date date,
  name text not null,
  merchant_name text,
  amount numeric(14, 2) not null,
  iso_currency_code text not null default 'USD',
  pending boolean not null default false,
  category_id uuid,
  category_source equyty.category_source,
  ai_confidence text check (ai_confidence in ('high', 'medium', 'low')),
  needs_review boolean not null default false,
  plaid_category_primary text,
  plaid_category_detailed text,
  logo_url text,
  website text,
  payment_channel text,
  notes text check (char_length(notes) <= 1000),
  is_excluded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references equyty.accounts (id, user_id) on delete cascade,
  foreign key (category_id, user_id) references equyty.categories (id, user_id) on delete set null (category_id)
);
create index transactions_user_date_idx on equyty.transactions (user_id, date desc);
create index transactions_user_category_idx on equyty.transactions (user_id, category_id);
create index transactions_account_idx on equyty.transactions (account_id);
create index transactions_uncategorized_idx on equyty.transactions (user_id) where category_id is null;

-- -----------------------------------------------------------------------------
-- Categorization rules (learned from user corrections)
-- -----------------------------------------------------------------------------
create table equyty.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  merchant_pattern text not null check (char_length(merchant_pattern) between 2 and 120),
  category_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, merchant_pattern),
  foreign key (category_id, user_id) references equyty.categories (id, user_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- Budgets
-- -----------------------------------------------------------------------------
create table equyty.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  month date not null check (extract(day from month) = 1),
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month),
  foreign key (category_id, user_id) references equyty.categories (id, user_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- Goals
-- -----------------------------------------------------------------------------
create table equyty.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  target_date date,
  icon text not null default 'savings' check (char_length(icon) <= 60),
  color_slot smallint not null default 0 check (color_slot between 0 and 7),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Recurring streams (from Plaid /transactions/recurring/get)
-- -----------------------------------------------------------------------------
create table equyty.recurring_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  plaid_stream_id text not null unique,
  description text not null,
  merchant_name text,
  direction text not null check (direction in ('inflow', 'outflow')),
  frequency text not null,
  average_amount numeric(14, 2) not null,
  last_amount numeric(14, 2) not null,
  first_date date,
  last_date date,
  predicted_next_date date,
  is_active boolean not null default true,
  status text,
  plaid_category_detailed text,
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references equyty.accounts (id, user_id) on delete cascade
);
create index recurring_user_idx on equyty.recurring_streams (user_id);

-- -----------------------------------------------------------------------------
-- Investment holdings
-- -----------------------------------------------------------------------------
create table equyty.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  security_id text not null,
  name text,
  ticker text,
  security_type text,
  quantity numeric(20, 6) not null default 0,
  price numeric(14, 4),
  value numeric(14, 2),
  cost_basis numeric(14, 2),
  iso_currency_code text not null default 'USD',
  updated_at timestamptz not null default now(),
  unique (account_id, security_id),
  foreign key (account_id, user_id) references equyty.accounts (id, user_id) on delete cascade
);
create index holdings_user_idx on equyty.holdings (user_id);

-- -----------------------------------------------------------------------------
-- AI insights (Advice)
-- -----------------------------------------------------------------------------
create table equyty.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index ai_insights_user_idx on equyty.ai_insights (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger profiles_updated_at before update on equyty.profiles for each row execute function equyty.set_updated_at();
create trigger plaid_items_updated_at before update on equyty.plaid_items for each row execute function equyty.set_updated_at();
create trigger accounts_updated_at before update on equyty.accounts for each row execute function equyty.set_updated_at();
create trigger transactions_updated_at before update on equyty.transactions for each row execute function equyty.set_updated_at();
create trigger budgets_updated_at before update on equyty.budgets for each row execute function equyty.set_updated_at();
create trigger goals_updated_at before update on equyty.goals for each row execute function equyty.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table equyty.profiles enable row level security;
alter table equyty.category_groups enable row level security;
alter table equyty.categories enable row level security;
alter table equyty.plaid_items enable row level security;
alter table equyty.plaid_item_secrets enable row level security;
alter table equyty.accounts enable row level security;
alter table equyty.account_balance_snapshots enable row level security;
alter table equyty.transactions enable row level security;
alter table equyty.categorization_rules enable row level security;
alter table equyty.budgets enable row level security;
alter table equyty.goals enable row level security;
alter table equyty.recurring_streams enable row level security;
alter table equyty.holdings enable row level security;
alter table equyty.ai_insights enable row level security;

-- Baseline grants for this schema (Supabase only does this automatically for
-- `public`). Each table is narrowed below. anon is deliberately never granted.
grant select, insert, update, delete on all tables in schema equyty to authenticated;
grant all on all tables in schema equyty to service_role;
alter default privileges in schema equyty grant all on tables to service_role;

-- Secrets: service role only. RLS on + no policies + no grants.
revoke all on equyty.plaid_item_secrets from authenticated;

-- ----- profiles -------------------------------------------------------------
create policy "profiles: read own" on equyty.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on equyty.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, delete, update on equyty.profiles from authenticated;
grant update (display_name) on equyty.profiles to authenticated;

-- ----- user-owned, fully editable tables ------------------------------------
create policy "category_groups: own" on equyty.category_groups
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "categories: own" on equyty.categories
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "rules: own" on equyty.categorization_rules
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "budgets: own" on equyty.budgets
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals: own" on equyty.goals
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ----- Plaid-mirrored tables: read own; writes via service role -------------
create policy "plaid_items: read own" on equyty.plaid_items
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on equyty.plaid_items from authenticated;

create policy "accounts: read own" on equyty.accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "accounts: update own" on equyty.accounts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on equyty.accounts from authenticated;
grant update (display_name, is_hidden) on equyty.accounts to authenticated;

create policy "snapshots: read own" on equyty.account_balance_snapshots
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on equyty.account_balance_snapshots from authenticated;

create policy "transactions: read own" on equyty.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "transactions: update own" on equyty.transactions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on equyty.transactions from authenticated;
grant update (category_id, category_source, needs_review, notes, is_excluded) on equyty.transactions to authenticated;

create policy "recurring: read own" on equyty.recurring_streams
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on equyty.recurring_streams from authenticated;

create policy "holdings: read own" on equyty.holdings
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on equyty.holdings from authenticated;

create policy "insights: read own" on equyty.ai_insights
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on equyty.ai_insights from authenticated;

-- =============================================================================
-- Aggregation RPCs (SECURITY INVOKER — RLS applies; filters on auth.uid() too)
-- =============================================================================
create or replace function equyty.category_month_totals(p_start date, p_end date)
returns table (month date, category_id uuid, inflow numeric, outflow numeric, txn_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    date_trunc('month', t.date)::date as month,
    t.category_id,
    coalesce(sum(t.amount) filter (where t.amount > 0), 0) as inflow,
    coalesce(-sum(t.amount) filter (where t.amount < 0), 0) as outflow,
    count(*) as txn_count
  from equyty.transactions t
  where t.user_id = (select auth.uid())
    and t.date between p_start and p_end
    and not t.is_excluded
  group by 1, 2
  order by 1, 2;
$$;

create or replace function equyty.top_merchants(p_start date, p_end date, p_direction text, p_limit integer default 10)
returns table (merchant text, total numeric, txn_count bigint, logo_url text)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(t.merchant_name, t.name) as merchant,
    sum(t.amount) as total,
    count(*) as txn_count,
    max(t.logo_url) as logo_url
  from equyty.transactions t
  left join equyty.categories c on c.id = t.category_id
  left join equyty.category_groups g on g.id = c.group_id
  where t.user_id = (select auth.uid())
    and t.date between p_start and p_end
    and not t.is_excluded
    and coalesce(g.kind, 'expense') <> 'transfer'
    and case when p_direction = 'in' then t.amount > 0 else t.amount < 0 end
  group by 1
  order by abs(sum(t.amount)) desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function equyty.daily_spending(p_start date, p_end date)
returns table (day date, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.date as day, sum(t.amount) as total
  from equyty.transactions t
  left join equyty.categories c on c.id = t.category_id
  left join equyty.category_groups g on g.id = c.group_id
  where t.user_id = (select auth.uid())
    and t.date between p_start and p_end
    and not t.is_excluded
    and coalesce(g.kind, case when t.amount < 0 then 'expense' else 'income' end::equyty.category_kind) = 'expense'
  group by 1
  order by 1;
$$;

create or replace function equyty.net_worth_history(p_start date)
returns table (day date, assets numeric, liabilities numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.snapshot_date as day,
    sum(case when a.type in ('credit', 'loan') then 0 else s.balance end) as assets,
    sum(case when a.type in ('credit', 'loan') then s.balance else 0 end) as liabilities
  from equyty.account_balance_snapshots s
  join equyty.accounts a on a.id = s.account_id
  where s.user_id = (select auth.uid())
    and s.snapshot_date >= p_start
    and not a.is_hidden
  group by 1
  order by 1;
$$;

revoke execute on function equyty.category_month_totals(date, date) from public;
revoke execute on function equyty.top_merchants(date, date, text, integer) from public;
revoke execute on function equyty.daily_spending(date, date) from public;
revoke execute on function equyty.net_worth_history(date) from public;
grant execute on function equyty.category_month_totals(date, date) to authenticated;
grant execute on function equyty.top_merchants(date, date, text, integer) to authenticated;
grant execute on function equyty.daily_spending(date, date) to authenticated;
grant execute on function equyty.net_worth_history(date) to authenticated;

-- =============================================================================
-- New-user bootstrap: profile + default categories
-- =============================================================================
create or replace function equyty.seed_default_categories(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  gid uuid;
begin
  for g in
    select * from (values
      (1,  'Income',               'income'::equyty.category_kind,   5, array['Paychecks:payments', 'Interest & Dividends:percent', 'Business Income:storefront', 'Refunds & Reimbursements:currency_exchange', 'Other Income:add_card']),
      (2,  'Housing',              'expense'::equyty.category_kind,  3, array['Mortgage:home', 'Rent:apartment', 'Home Improvement:handyman', 'Home Services:cleaning_services']),
      (3,  'Bills & Utilities',    'expense'::equyty.category_kind,  0, array['Gas & Electric:bolt', 'Water:water_drop', 'Garbage:delete', 'Internet & Cable:wifi', 'Phone:smartphone', 'Subscriptions:subscriptions']),
      (4,  'Food & Dining',        'expense'::equyty.category_kind,  1, array['Groceries:local_grocery_store', 'Restaurants & Bars:restaurant', 'Coffee Shops:local_cafe', 'Food Delivery:delivery_dining']),
      (5,  'Auto & Transport',     'expense'::equyty.category_kind,  6, array['Gas:local_gas_station', 'Auto Payment:directions_car', 'Auto Maintenance:car_repair', 'Parking & Tolls:local_parking', 'Public Transit:train', 'Ride Share:local_taxi']),
      (6,  'Shopping',             'expense'::equyty.category_kind,  4, array['Shopping:shopping_bag', 'Clothing:checkroom', 'Electronics:devices', 'Household:chair']),
      (7,  'Travel & Lifestyle',   'expense'::equyty.category_kind,  2, array['Travel & Vacation:flight', 'Entertainment:theater_comedy', 'Personal Care:spa', 'Pets:pets', 'Hobbies:palette']),
      (8,  'Health & Wellness',    'expense'::equyty.category_kind,  7, array['Medical:medical_services', 'Dentist:dentistry', 'Pharmacy:medication', 'Fitness:fitness_center']),
      (9,  'Financial',            'expense'::equyty.category_kind,  4, array['Loan Repayment:account_balance', 'Insurance:umbrella', 'Financial & Legal Services:gavel', 'Taxes:receipt_long', 'Cash & ATM:local_atm', 'Fees & Charges:paid']),
      (10, 'Children & Education', 'expense'::equyty.category_kind,  2, array['Child Care:child_care', 'Education:school', 'Kids Activities:toys']),
      (11, 'Gifts & Donations',    'expense'::equyty.category_kind,  7, array['Gifts:redeem', 'Charity:volunteer_activism']),
      (12, 'Other',                'expense'::equyty.category_kind,  0, array['Miscellaneous:category']),
      (13, 'Transfers',            'transfer'::equyty.category_kind, 0, array['Transfer:swap_horiz', 'Credit Card Payment:credit_card', 'Investment Transfer:trending_up'])
    ) as t(sort_order, name, kind, color_slot, cats)
  loop
    insert into equyty.category_groups (user_id, name, kind, color_slot, sort_order)
    values (p_user, g.name, g.kind, g.color_slot, g.sort_order)
    on conflict (user_id, name) do nothing
    returning id into gid;

    if gid is not null then
      insert into equyty.categories (user_id, group_id, name, icon, sort_order)
      select p_user, gid, split_part(c, ':', 1), split_part(c, ':', 2), ord::int
      from unnest(g.cats) with ordinality as x(c, ord)
      on conflict (user_id, name) do nothing;
    end if;
  end loop;
end;
$$;

revoke execute on function equyty.seed_default_categories(uuid) from public, authenticated;

-- Called by the app (as the signed-in user) on first load. Idempotent.
-- Avoids a trigger on auth.users, which is shared by every app on the project.
create or replace function equyty.ensure_user_setup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into equyty.profiles (id, display_name)
  select u.id, nullif(u.raw_user_meta_data ->> 'display_name', '')
  from auth.users u
  where u.id = uid
  on conflict (id) do nothing;

  if not exists (select 1 from equyty.category_groups where user_id = uid) then
    perform equyty.seed_default_categories(uid);
  end if;
end;
$$;

revoke execute on function equyty.ensure_user_setup() from public;
grant execute on function equyty.ensure_user_setup() to authenticated;
