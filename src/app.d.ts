import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';
import type { DbSchema } from '$lib/supabase/schema';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database, DbSchema>;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
		}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
