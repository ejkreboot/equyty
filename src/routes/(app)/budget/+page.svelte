<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import MonthNav from '$lib/components/MonthNav.svelte';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import { catalog } from '$lib/catalog';
	import { summarize } from '$lib/finance';
	import { money } from '$lib/format';
	import { isoDate, monthEnd, parseDate } from '$lib/dates';
	import { supabase } from '$lib/supabase/browser';
	import { toast } from '$lib/toast.svelte';

	let { data } = $props();

	const cat = $derived(catalog(data));
	const monthEndIso = $derived(isoDate(monthEnd(parseDate(`${data.month}-01`))));
	const s = $derived(summarize(data.totals, cat.index));
	const hist = $derived(summarize(data.history, cat.index));

	let amounts = $state<Record<string, number>>({});
	$effect.pre(() => {
		amounts = Object.fromEntries(data.budgets.map((b) => [b.category_id, Number(b.amount)]));
	});

	const spentBy = $derived(new Map(s.expenseCategories.map((c) => [c.category.id, c.amount])));
	const avgBy = $derived(new Map(hist.expenseCategories.map((c) => [c.category.id, c.amount / 3])));

	const sections = $derived(
		data.groups
			.filter((g) => g.kind === 'expense')
			.map((g) => {
				const cats = cat.ordered.filter((c) => c.group.id === g.id);
				const budget = cats.reduce((sum, c) => sum + (amounts[c.id] ?? 0), 0);
				const spent = cats.reduce((sum, c) => sum + Math.max(0, spentBy.get(c.id) ?? 0), 0);
				return { g, cats, budget, spent };
			})
	);

	const totalBudget = $derived(Object.values(amounts).reduce((sum, v) => sum + v, 0));
	const budgetedSpent = $derived(Object.keys(amounts).reduce((sum, id) => sum + Math.max(0, spentBy.get(id) ?? 0), 0));
	const unbudgeted = $derived(Math.max(0, s.expenses - budgetedSpent));
	const remaining = $derived(totalBudget - budgetedSpent);
	const ratio = $derived(totalBudget > 0 ? budgetedSpent / totalBudget : 0);

	async function setBudget(categoryId: string, raw: string) {
		const value = raw.trim() === '' ? null : Math.round(Number(raw.replace(/[$,]/g, '')) * 100) / 100;
		if (value !== null && (!Number.isFinite(value) || value < 0)) return toast('Enter a positive amount', 'error');
		const prev = amounts[categoryId];
		if ((value ?? undefined) === prev) return;

		if (value === null || value === 0) {
			delete amounts[categoryId];
			const { error } = await supabase().from('budgets').delete().eq('category_id', categoryId).eq('month', `${data.month}-01`);
			if (error) {
				amounts[categoryId] = prev;
				toast('Could not update the budget', 'error');
			}
			return;
		}
		amounts[categoryId] = value;
		const { error } = await supabase()
			.from('budgets')
			.upsert({ category_id: categoryId, month: `${data.month}-01`, amount: value }, { onConflict: 'user_id,category_id,month' });
		if (error) {
			if (prev === undefined) delete amounts[categoryId];
			else amounts[categoryId] = prev;
			toast('Could not update the budget', 'error');
		}
	}

	async function bulkSet(rows: { category_id: string; amount: number }[], message: string) {
		if (!rows.length) return toast('Nothing to fill in', 'info');
		const { error } = await supabase()
			.from('budgets')
			.upsert(
				rows.map((r) => ({ ...r, month: `${data.month}-01` })),
				{ onConflict: 'user_id,category_id,month' }
			);
		if (error) return toast('Could not update budgets', 'error');
		await invalidateAll();
		toast(message, 'success');
	}

	const copyLast = () =>
		bulkSet(
			data.prevBudgets.filter((b) => amounts[b.category_id] === undefined).map((b) => ({ category_id: b.category_id, amount: Number(b.amount) })),
			'Copied last month’s budget'
		);

	const fillAverages = () =>
		bulkSet(
			[...avgBy.entries()]
				.filter(([id, avg]) => amounts[id] === undefined && avg >= 5 && cat.index.has(id))
				.map(([id, avg]) => ({ category_id: id, amount: Math.ceil(avg / 5) * 5 })),
			'Filled from your 3-month averages'
		);
</script>

<svelte:head><title>Budget · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="title">
			<h1>Budget</h1>
			<MonthNav month={data.month} hrefFor={(m) => `/budget?month=${m}`} />
		</div>
		<div class="actions">
			{#if data.prevBudgets.length}
				<button class="btn" onclick={copyLast}><Icon name="event_repeat" size={18} />Copy last month</button>
			{/if}
			<button class="btn" onclick={fillAverages} title="Fill empty categories with your average monthly spending">
				<Icon name="auto_awesome" size={18} />Fill from averages
			</button>
		</div>
	</header>

	<section class="card overview">
		<div class="ov-nums">
			<div><span class="eyebrow">Budgeted</span><b class="num">{money(totalBudget, { cents: false })}</b></div>
			<div><span class="eyebrow">Spent</span><b class="num">{money(budgetedSpent, { cents: false })}</b></div>
			<div>
				<span class="eyebrow">{remaining >= 0 ? 'Remaining' : 'Over budget'}</span>
				<b class="num" class:negative={remaining < 0}>{money(Math.abs(remaining), { cents: false })}</b>
			</div>
			<div><span class="eyebrow">Income</span><b class="num">{money(s.income, { cents: false })}</b></div>
		</div>
		<div class="meter big" class:warning={ratio >= 0.85 && ratio <= 1} class:over={ratio > 1}>
			<span style:width="{Math.min(100, ratio * 100)}%"></span>
		</div>
		{#if unbudgeted > 0}
			<p class="muted note"><Icon name="info" size={15} />{money(unbudgeted, { cents: false })} spent in categories without a budget this month.</p>
		{/if}
	</section>

	{#each sections as sec (sec.g.id)}
		<section class="card group">
			<div class="g-head">
				<h2>{sec.g.name}</h2>
				<span class="num muted">
					{money(sec.spent, { cents: false })}{#if sec.budget > 0}&nbsp;of {money(sec.budget, { cents: false })}{/if}
				</span>
			</div>
			<div class="rows">
				<div class="row head">
					<span>Category</span><span class="r">Budget</span><span class="r">Spent</span><span class="r hide-sm">Remaining</span>
				</div>
				{#each sec.cats as c (c.id)}
					{@const budget = amounts[c.id]}
					{@const spent = Math.max(0, spentBy.get(c.id) ?? 0)}
					{@const r = budget ? spent / budget : 0}
					<div class="row">
						<div class="name">
							<CategoryIcon icon={c.icon} slot={c.group.color_slot} size={28} />
							<div>
								{c.name}
								{#if budget}
									<div class="meter" class:warning={r >= 0.85 && r <= 1} class:over={r > 1}><span style:width="{Math.min(100, r * 100)}%"></span></div>
								{:else if avgBy.get(c.id)}
									<small class="muted">avg {money(avgBy.get(c.id) ?? 0, { cents: false })}/mo</small>
								{/if}
							</div>
						</div>
						<span class="r">
							<span class="input-group amount">
								<span class="prefix">$</span>
								<input
									class="input num"
									inputmode="decimal"
									placeholder="—"
									value={budget ? String(budget) : ''}
									aria-label="Budget for {c.name}"
									onchange={(e) => setBudget(c.id, e.currentTarget.value)}
									onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
								/>
							</span>
						</span>
						<a class="r num spent" href="/transactions?category={c.id}&range=custom&from={data.month}-01&to={monthEndIso}">{money(spent, { cents: false })}</a>
						<span class="r num hide-sm" class:negative={budget !== undefined && spent > budget} class:muted={budget === undefined}>
							{budget !== undefined ? money(budget - spent, { cents: false }) : '—'}
						</span>
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.overview {
		padding: 22px;
		margin-bottom: 16px;
	}
	.ov-nums {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
		margin-bottom: 16px;
	}
	.ov-nums div {
		display: grid;
		gap: 4px;
	}
	.ov-nums b {
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.02em;
		font-variant-numeric: proportional-nums;
	}
	.meter.big {
		height: 10px;
	}
	.note {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 12px;
		font-size: 12.5px;
	}
	.group {
		margin-bottom: 16px;
	}
	.g-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 18px 20px 6px;
	}
	.g-head .num {
		font-size: 13px;
	}
	.rows {
		padding: 0 8px 8px;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 130px 100px 110px;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 13.5px;
	}
	.row:not(.head):hover {
		background: var(--surface-2);
	}
	.row.head {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-3);
		padding-top: 4px;
		padding-bottom: 4px;
	}
	.r {
		text-align: right;
		justify-self: end;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		font-weight: 500;
	}
	.name > div {
		flex: 1;
		min-width: 0;
	}
	.name .meter {
		margin-top: 6px;
		max-width: 260px;
	}
	.name small {
		display: block;
		font-weight: 400;
		font-size: 11.5px;
	}
	.amount {
		width: 120px;
	}
	.amount .input {
		height: 32px;
		text-align: right;
		border-color: transparent;
		background: var(--surface-2);
	}
	.amount .input:hover {
		border-color: var(--border-strong);
	}
	.amount .input:focus {
		background: var(--surface);
	}
	.spent:hover {
		text-decoration: underline;
	}
	@media (max-width: 720px) {
		.ov-nums {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.row {
			grid-template-columns: minmax(0, 1fr) 104px 72px;
		}
		.amount {
			width: 100px;
		}
		.hide-sm {
			display: none;
		}
	}
</style>
