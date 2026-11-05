import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { generateInsights } from '$lib/server/insights';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 120 };

const COOLDOWN_MS = 5 * 60 * 1000;

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);

	// Simple per-user cooldown so the AI endpoint can't be hammered.
	const { data: last } = await event.locals.supabase
		.from('ai_insights')
		.select('created_at')
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (last && Date.now() - new Date(last.created_at).getTime() < COOLDOWN_MS) {
		error(429, 'Fresh insights were generated a moment ago. Try again in a few minutes.');
	}

	try {
		return json(await generateInsights(user.id));
	} catch (err) {
		console.error('[insights]', err);
		error(502, err instanceof Error ? err.message : 'Could not generate insights');
	}
};
