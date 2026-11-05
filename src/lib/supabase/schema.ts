/**
 * Postgres schema holding all of Equyty's tables. The app lives in its own
 * schema so it can share a Supabase project with other apps. The schema must
 * be listed under Dashboard → Project Settings → Data API → Exposed schemas.
 */
export const DB_SCHEMA = 'equyty' as const;
export type DbSchema = typeof DB_SCHEMA;
