-- =============================================================================
-- Per-account removal
--
-- Plaid can't stop sharing a single account inside an Item, so a removed
-- account is kept as a tombstone: removed_at is set, its data is deleted, and
-- the sync layer skips it so it is never re-imported. Removal is performed by
-- server code with the service role; users cannot set removed_at themselves
-- (the column-level UPDATE grant on accounts still covers only
-- display_name and is_hidden).
-- =============================================================================

alter table equyty.accounts add column if not exists removed_at timestamptz;

create index if not exists accounts_active_idx on equyty.accounts (user_id) where removed_at is null;
