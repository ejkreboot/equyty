import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from './supabase-admin';
import { addMonths, monthStart, monthEnd, isoDate } from '$lib/dates';

const MODEL = env.ANTHROPIC_MODEL || 'claude-opus-5';

export const InsightPayload = z.object({
	headline: z.string(),
	insights: z.array(
		z.object({
			title: z.string(),
			body: z.string(),
			tone: z.enum(['positive', 'neutral', 'attention'])
		})
	),
	actions: z.array(
		z.object({
			title: z.string(),
			body: z.string(),
			estimated_monthly_impact: z.number().nullable()
		})
	)
});
export type InsightPayload = z.infer<typeof InsightPayload>;

function money(n: number) {
	return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Builds an aggregate-only snapshot of the user's finances (no account numbers,
 * no raw transaction list) and asks Claude for insights and next steps.
 */
export async function generateInsights(userId: string): Promise<InsightPayload> {
	if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');

	const now = new Date();
	const start = monthStart(addMonths(now, -3));
	const end = now;

	const [{ data: txns }, { data: categories }, { data: groups }, { data: budgets }, { data: recurring }, { data: accounts }] =
		await Promise.all([
			supabaseAdmin
				.from('transactions')
				.select('date, amount, category_id, merchant_name, name')
				.eq('user_id', userId)
				.eq('is_excluded', false)
				.gte('date', isoDate(start))
				.lte('date', isoDate(end))
				.limit(5000),
			supabaseAdmin.from('categories').select('id, name, group_id').eq('user_id', userId),
			supabaseAdmin.from('category_groups').select('id, name, kind').eq('user_id', userId),
			supabaseAdmin
				.from('budgets')
				.select('category_id, amount')
				.eq('user_id', userId)
				.eq('month', isoDate(monthStart(now))),
			supabaseAdmin
				.from('recurring_streams')
				.select('description, merchant_name, direction, frequency, average_amount, is_active')
				.eq('user_id', userId)
				.eq('is_active', true),
			supabaseAdmin.from('accounts').select('type, current_balance, is_hidden').eq('user_id', userId).is('removed_at', null)
		]);

	const catById = new Map((categories ?? []).map((c) => [c.id, c]));
	const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
	const kindOf = (categoryId: string | null, amount: number) => {
		const c = categoryId ? catById.get(categoryId) : undefined;
		const g = c ? groupById.get(c.group_id) : undefined;
		return g?.kind ?? (amount >= 0 ? 'income' : 'expense');
	};

	// Per-month, per-category totals
	const months = new Map<string, { income: number; expenses: number; byCategory: Map<string, number> }>();
	const merchants = new Map<string, number>();
	for (const t of txns ?? []) {
		const kind = kindOf(t.category_id, t.amount);
		if (kind === 'transfer') continue;
		const key = t.date.slice(0, 7);
		const m = months.get(key) ?? { income: 0, expenses: 0, byCategory: new Map() };
		if (kind === 'income') m.income += t.amount;
		else {
			m.expenses += -t.amount;
			const name = (t.category_id && catById.get(t.category_id)?.name) || 'Uncategorized';
			m.byCategory.set(name, (m.byCategory.get(name) ?? 0) - t.amount);
			const merchant = t.merchant_name ?? t.name;
			merchants.set(merchant, (merchants.get(merchant) ?? 0) - t.amount);
		}
		months.set(key, m);
	}

	const monthLines = [...months.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, m]) => {
			const top = [...m.byCategory.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 12)
				.map(([n, v]) => `${n} ${money(v)}`)
				.join(', ');
			const partial = month === isoDate(now).slice(0, 7) ? ` (month to date, day ${now.getDate()} of ${monthEnd(now).getDate()})` : '';
			return `${month}${partial}: income ${money(m.income)}, spending ${money(m.expenses)}. By category: ${top}`;
		});

	const topMerchants = [...merchants.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 15)
		.map(([n, v]) => `${n} ${money(v)}`)
		.join(', ');

	const budgetLines = (budgets ?? []).map((b) => {
		const name = catById.get(b.category_id)?.name ?? 'Unknown';
		const spent = months.get(isoDate(now).slice(0, 7))?.byCategory.get(name) ?? 0;
		return `${name}: budget ${money(b.amount)}, spent ${money(spent)}`;
	});

	const recurringLines = (recurring ?? []).map(
		(r) => `${r.merchant_name ?? r.description}: ${r.direction === 'outflow' ? 'pays' : 'receives'} ${money(r.average_amount)} ${r.frequency.toLowerCase()}`
	);

	const visible = (accounts ?? []).filter((a) => !a.is_hidden);
	const cash = visible.filter((a) => a.type === 'depository').reduce((s, a) => s + (a.current_balance ?? 0), 0);
	const debt = visible
		.filter((a) => a.type === 'credit' || a.type === 'loan')
		.reduce((s, a) => s + (a.current_balance ?? 0), 0);
	const invested = visible.filter((a) => a.type === 'investment').reduce((s, a) => s + (a.current_balance ?? 0), 0);

	const snapshot = [
		`Today: ${isoDate(now)}`,
		`Balances: cash ${money(cash)}, investments ${money(invested)}, debt ${money(debt)}`,
		'',
		'<monthly_summary>',
		...monthLines,
		'</monthly_summary>',
		'',
		`<top_merchants_by_spend>${topMerchants || 'none'}</top_merchants_by_spend>`,
		'',
		'<budgets_this_month>',
		...(budgetLines.length ? budgetLines : ['No budgets set']),
		'</budgets_this_month>',
		'',
		'<recurring>',
		...(recurringLines.length ? recurringLines : ['None detected']),
		'</recurring>'
	].join('\n');

	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
	const response = await client.beta.messages.parse({
		model: MODEL,
		max_tokens: 16000,
		betas: ['server-side-fallback-2026-07-01'],
		fallbacks: 'default',
		system:
			'You are a thoughtful, plain-spoken personal finance coach inside a budgeting app. ' +
			'You receive an aggregate snapshot of one person\'s finances. Write a one-sentence headline, ' +
			'3 to 5 insights, and 2 to 4 concrete next actions. Ground every statement in the numbers provided and cite them; ' +
			'compare the current partial month on a pro-rated basis. Do not invent data, do not recommend specific securities, ' +
			'and keep each body to two sentences. Address the person as "you".',
		messages: [{ role: 'user', content: snapshot }],
		output_config: { effort: 'medium', format: betaZodOutputFormat(InsightPayload) }
	});

	if (response.stop_reason === 'refusal' || !response.parsed_output) {
		throw new Error('Could not generate insights right now');
	}

	const payload = response.parsed_output;
	await supabaseAdmin.from('ai_insights').insert({
		user_id: userId,
		period_start: isoDate(start),
		period_end: isoDate(end),
		payload
	});
	return payload;
}
