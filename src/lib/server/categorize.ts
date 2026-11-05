import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from './supabase-admin';
import { plaidCategoryToName } from './plaid-category-map';
import { normalizeMerchant } from '$lib/merchant';
import type { CategorySource, Confidence, TransactionRow } from '$lib/supabase/database.types';

const MODEL = env.ANTHROPIC_MODEL || 'claude-opus-5';
const CHUNK_SIZE = 40;

let anthropic: Anthropic | null = null;
function claude(): Anthropic | null {
	if (!env.ANTHROPIC_API_KEY) return null;
	anthropic ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 3 });
	return anthropic;
}

type Txn = Pick<
	TransactionRow,
	| 'id'
	| 'name'
	| 'merchant_name'
	| 'amount'
	| 'date'
	| 'plaid_category_primary'
	| 'plaid_category_detailed'
	| 'payment_channel'
	| 'account_id'
>;

type Assignment = { id: string; categoryId: string; source: CategorySource; confidence: Confidence | null };

export interface CategorizeResult {
	considered: number;
	byRule: number;
	byAi: number;
	byPlaid: number;
}

/**
 * Categorizes a user's uncategorized transactions.
 *
 * Order of precedence:
 *   1. The user's merchant rules (learned from their own corrections)
 *   2. Claude, prompted with the user's category list + their past corrections
 *   3. Plaid's personal-finance-category mapped onto default category names
 *
 * `userId` must come from a verified session or verified Plaid webhook: this
 * runs with the service role and every query below is scoped by it.
 */
export async function categorizeUncategorized(
	userId: string,
	opts: { limit?: number; transactionIds?: string[] } = {}
): Promise<CategorizeResult> {
	const result: CategorizeResult = { considered: 0, byRule: 0, byAi: 0, byPlaid: 0 };

	let query = supabaseAdmin
		.from('transactions')
		.select(
			'id, name, merchant_name, amount, date, plaid_category_primary, plaid_category_detailed, payment_channel, account_id'
		)
		.eq('user_id', userId)
		.is('category_id', null)
		.order('date', { ascending: false })
		.limit(Math.min(opts.limit ?? 400, 1000));
	if (opts.transactionIds?.length) query = query.in('id', opts.transactionIds);

	const [{ data: txns, error }, { data: groups }, { data: categories }, { data: rules }, { data: accounts }] =
		await Promise.all([
			query,
			supabaseAdmin.from('category_groups').select('id, name, kind').eq('user_id', userId),
			supabaseAdmin.from('categories').select('id, name, group_id').eq('user_id', userId),
			supabaseAdmin.from('categorization_rules').select('merchant_pattern, category_id').eq('user_id', userId),
			supabaseAdmin.from('accounts').select('id, type, subtype').eq('user_id', userId)
		]);
	if (error) throw error;
	if (!txns?.length || !categories?.length || !groups) return result;
	result.considered = txns.length;

	const groupById = new Map(groups.map((g) => [g.id, g]));
	const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
	const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
	const assignments: Assignment[] = [];
	let remaining: Txn[] = [];

	// 1. Rules — longest pattern wins so "amazon prime" beats "amazon".
	const sortedRules = [...(rules ?? [])].sort((a, b) => b.merchant_pattern.length - a.merchant_pattern.length);
	for (const t of txns) {
		const merchant = normalizeMerchant(t.merchant_name ?? t.name);
		const rule = sortedRules.find((r) => merchant.includes(r.merchant_pattern));
		if (rule) {
			assignments.push({ id: t.id, categoryId: rule.category_id, source: 'rule', confidence: 'high' });
			result.byRule++;
		} else {
			remaining.push(t);
		}
	}

	// 2. Claude
	const client = claude();
	if (client && remaining.length) {
		const keyed = categories.map((c, i) => ({ key: `c${i + 1}`, ...c }));
		const keyToId = new Map(keyed.map((c) => [c.key, c.id]));
		const examples = await loadUserExamples(userId, new Map(categories.map((c) => [c.id, c.name])));

		const categoryList = keyed
			.map((c) => {
				const g = groupById.get(c.group_id);
				return `${c.key}: ${c.name} (group: ${g?.name ?? '—'}, kind: ${g?.kind ?? 'expense'})`;
			})
			.join('\n');

		const system = [
			'You categorize personal bank and credit card transactions for a budgeting app.',
			'Choose exactly one category key per transaction from the list below. Use the person\'s own past corrections as the strongest signal: if a merchant appears there, reuse that category.',
			'',
			'Guidance:',
			'- "direction: in" means money entered the account; "out" means it left.',
			'- Payments to a credit card, transfers between the person\'s own accounts, and brokerage/retirement contributions are transfers, not spending.',
			'- Money coming back from a merchant is usually a refund: pick the refund/reimbursement category if one exists, otherwise the category of the original purchase.',
			'- Payroll/direct deposit from an employer is a paycheck.',
			'- The bank-provided hint is often right but is generic; prefer the more specific category from the list when one fits.',
			'- confidence: "high" when the merchant clearly implies the category, "medium" when it is a reasonable guess, "low" when the description is ambiguous (e.g. a person\'s name, a generic payment processor, or a cryptic code).',
			'',
			'<categories>',
			categoryList,
			'</categories>',
			'',
			'<past_corrections>',
			examples.length ? examples.join('\n') : '(none yet)',
			'</past_corrections>'
		].join('\n');

		const Output = z.object({
			results: z.array(
				z.object({
					id: z.string(),
					category: z.enum(keyed.map((c) => c.key) as [string, ...string[]]),
					confidence: z.enum(['high', 'medium', 'low'])
				})
			)
		});

		const leftovers: Txn[] = [];
		for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
			const chunk = remaining.slice(i, i + CHUNK_SIZE);
			const lines = chunk.map((t, idx) => {
				const account = accountById.get(t.account_id);
				return JSON.stringify({
					id: `t${idx + 1}`,
					description: t.name,
					merchant: t.merchant_name ?? undefined,
					amount: Math.abs(t.amount).toFixed(2),
					direction: t.amount >= 0 ? 'in' : 'out',
					date: t.date,
					channel: t.payment_channel ?? undefined,
					account: account ? [account.type, account.subtype].filter(Boolean).join('/') : undefined,
					bank_hint: t.plaid_category_detailed ?? t.plaid_category_primary ?? undefined
				});
			});

			try {
				const response = await client.beta.messages.parse({
					model: MODEL,
					max_tokens: 16000,
					betas: ['server-side-fallback-2026-07-01'],
					fallbacks: 'default',
					system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
					messages: [
						{
							role: 'user',
							content: `Categorize these ${chunk.length} transactions. Return one result per id.\n\n${lines.join('\n')}`
						}
					],
					output_config: { effort: 'low', format: betaZodOutputFormat(Output) }
				});

				if (response.stop_reason === 'refusal' || !response.parsed_output) {
					leftovers.push(...chunk);
					continue;
				}

				const seen = new Set<string>();
				for (const r of response.parsed_output.results) {
					const idx = Number(r.id.slice(1)) - 1;
					const t = chunk[idx];
					const categoryId = keyToId.get(r.category);
					if (!t || !categoryId || seen.has(t.id)) continue;
					seen.add(t.id);
					assignments.push({ id: t.id, categoryId, source: 'ai', confidence: r.confidence });
					result.byAi++;
				}
				leftovers.push(...chunk.filter((t) => !seen.has(t.id)));
			} catch (err) {
				logAnthropicError(err);
				leftovers.push(...chunk);
			}
		}
		remaining = leftovers;
	}

	// 3. Plaid taxonomy fallback
	for (const t of remaining) {
		const name = plaidCategoryToName(t.plaid_category_primary, t.plaid_category_detailed);
		const category = name ? categoryByName.get(name.toLowerCase()) : undefined;
		if (category) {
			assignments.push({ id: t.id, categoryId: category.id, source: 'plaid', confidence: 'medium' });
			result.byPlaid++;
		}
	}

	await applyAssignments(userId, assignments);
	return result;
}

/** Recent manual corrections, one line per merchant, used as few-shot signal. */
async function loadUserExamples(userId: string, categoryNames: Map<string, string>): Promise<string[]> {
	const { data } = await supabaseAdmin
		.from('transactions')
		.select('name, merchant_name, amount, category_id')
		.eq('user_id', userId)
		.eq('category_source', 'user')
		.not('category_id', 'is', null)
		.order('updated_at', { ascending: false })
		.limit(300);

	const seen = new Set<string>();
	const lines: string[] = [];
	for (const t of data ?? []) {
		const merchant = t.merchant_name ?? t.name;
		const key = normalizeMerchant(merchant);
		const category = t.category_id ? categoryNames.get(t.category_id) : undefined;
		if (!category || seen.has(key)) continue;
		seen.add(key);
		lines.push(`${merchant} (${t.amount >= 0 ? 'in' : 'out'}) → ${category}`);
		if (lines.length >= 60) break;
	}
	return lines;
}

async function applyAssignments(userId: string, assignments: Assignment[]) {
	// Group identical updates so we issue one UPDATE per (category, source, confidence).
	const buckets = new Map<string, Assignment[]>();
	for (const a of assignments) {
		const key = `${a.categoryId}|${a.source}|${a.confidence}`;
		const list = buckets.get(key) ?? [];
		list.push(a);
		buckets.set(key, list);
	}

	await Promise.all(
		[...buckets.values()].map(async (list) => {
			const { categoryId, source, confidence } = list[0];
			for (let i = 0; i < list.length; i += 200) {
				const ids = list.slice(i, i + 200).map((a) => a.id);
				const { error } = await supabaseAdmin
					.from('transactions')
					.update({
						category_id: categoryId,
						category_source: source,
						ai_confidence: source === 'ai' ? confidence : null,
						needs_review: source === 'ai' && confidence === 'low'
					})
					.eq('user_id', userId)
					.in('id', ids)
					// Never overwrite a category the user picked while we were thinking.
					.is('category_id', null);
				if (error) console.error('[categorize] update failed', error.message);
			}
		})
	);
}

function logAnthropicError(err: unknown) {
	if (err instanceof Anthropic.RateLimitError) {
		console.warn('[categorize] rate limited by Anthropic; falling back to Plaid categories');
	} else if (err instanceof Anthropic.AuthenticationError) {
		console.error('[categorize] invalid ANTHROPIC_API_KEY');
	} else if (err instanceof Anthropic.BadRequestError) {
		console.error('[categorize] bad request:', err.message);
	} else if (err instanceof Anthropic.APIError) {
		console.error(`[categorize] Anthropic API error ${err.status}:`, err.message);
	} else {
		console.error('[categorize] unexpected error', err);
	}
}
