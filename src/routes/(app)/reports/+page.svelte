<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import DateRangeMenu from '$lib/components/DateRangeMenu.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import MerchantLogo from '$lib/components/MerchantLogo.svelte';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import Sankey, { type SankeyMode } from '$lib/components/charts/Sankey.svelte';
	import BarList from '$lib/components/charts/BarList.svelte';
	import { catalog } from '$lib/catalog';
	import { slotColor, summarize, type CategoryAmount } from '$lib/finance';
	import { longDate, money, percent } from '$lib/format';

	let { data } = $props();

	const cat = $derived(catalog(data));
	const s = $derived(summarize(data.totals, cat.index));

	const MODES: { value: SankeyMode; label: string }[] = [
		{ value: 'category-group', label: 'By category & group' },
		{ value: 'group', label: 'By group' },
		{ value: 'category', label: 'By category' }
	];
	let mode = $state<SankeyMode>('category-group');
	let view = $state<'chart' | 'table'>('chart');
	let spendBy = $state<'category' | 'group'>('category');

	const tabHref = (tab: string) => {
		const url = new URL(page.url);
		url.searchParams.set('tab', tab);
		return `${url.pathname}${url.search}`;
	};

	const txnHref = (categoryId: string) => {
		const q = new URLSearchParams({ category: categoryId, range: data.range.preset });
		if (data.range.preset === 'custom') {
			q.set('from', data.range.start);
			q.set('to', data.range.end);
		}
		return `/transactions?${q}`;
	};

	const toRows = (list: CategoryAmount[], total: number) =>
		list
			.filter((c) => c.amount > 0)
			.map((c) => ({
				id: c.category.id,
				label: c.category.name,
				icon: c.category.icon,
				slot: c.category.group.color_slot,
				amount: c.amount,
				share: total > 0 ? c.amount / total : 0,
				sublabel: `${c.count} transaction${c.count === 1 ? '' : 's'}`,
				href: c.category.id.startsWith('uncategorized') ? '/transactions?category=none' : txnHref(c.category.id)
			}));

	const spendingRows = $derived(
		spendBy === 'category'
			? toRows(s.expenseCategories, s.expenses)
			: s.expenseGroups
					.filter((g) => g.amount > 0)
					.map((g) => ({
						id: g.group.id,
						label: g.group.name,
						slot: g.group.color_slot,
						amount: g.amount,
						share: s.expenses > 0 ? g.amount / s.expenses : 0,
						sublabel: g.categories.map((c) => c.category.name).slice(0, 3).join(', ')
					}))
	);
	const incomeRows = $derived(toRows(s.incomeCategories, s.income));
	const hasData = $derived(s.income > 0 || s.expenses > 0);
	const merchantTotal = $derived(data.merchants.reduce((sum, m) => sum + Math.abs(Number(m.total)), 0));
</script>

<svelte:head><title>Reports · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="title">
			<h1>Reports</h1>
			<nav class="tabs" aria-label="Report type">
				<a href={tabHref('cash-flow')} aria-current={data.tab === 'cash-flow' ? 'page' : undefined} data-sveltekit-noscroll>Cash Flow</a>
				<a href={tabHref('spending')} aria-current={data.tab === 'spending' ? 'page' : undefined} data-sveltekit-noscroll>Spending</a>
				<a href={tabHref('income')} aria-current={data.tab === 'income' ? 'page' : undefined} data-sveltekit-noscroll>Income</a>
			</nav>
		</div>
		<div class="actions">
			<DateRangeMenu range={data.range} />
		</div>
	</header>

	<section class="stats">
		<StatCard label="Total income" value={money(s.income)} tone="positive" />
		<StatCard label="Total expenses" value={money(s.expenses)} tone="negative" />
		<StatCard label="Total net income" value={money(s.net)} />
		<StatCard label="Savings rate" value={percent(s.savingsRate)} />
	</section>

	{#if !hasData}
		<section class="card main-card">
			<EmptyState icon="pie_chart" title="Nothing to report for this period" body="Pick a different date range, or connect an account to import transactions.">
				<button class="btn" onclick={() => goto('?range=last-12-months', { noScroll: true })}>Show last 12 months</button>
			</EmptyState>
		</section>
	{:else if data.tab === 'cash-flow'}
		<section class="card main-card">
			<div class="report-head">
				<div>
					<span class="eyebrow">Cash flow</span>
					<h2 class="range">{longDate(data.range.start)} – {longDate(data.range.end)}</h2>
				</div>
				<div class="controls">
					<select class="select mode" bind:value={mode} aria-label="Grouping">
						{#each MODES as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
					</select>
					<div class="segmented" role="group" aria-label="View">
						<button aria-pressed={view === 'chart'} onclick={() => (view = 'chart')} title="Flow diagram" aria-label="Flow diagram"><Icon name="account_tree" size={18} /></button>
						<button aria-pressed={view === 'table'} onclick={() => (view = 'table')} title="Table" aria-label="Table"><Icon name="stacked_bar_chart" size={18} /></button>
					</div>
				</div>
			</div>
			<hr class="divider" />
			{#if view === 'chart'}
				<div class="sankey">
					<Sankey summary={s} {mode} />
				</div>
			{:else}
				<table class="table">
					<thead>
						<tr><th>Category</th><th class="right">Amount</th><th class="right">% of income</th></tr>
					</thead>
					<tbody>
						{#each s.incomeCategories as c (c.category.id)}
							<tr>
								<td><span class="cell"><CategoryIcon icon={c.category.icon} slot={c.category.group.color_slot} size={24} />{c.category.name}</span></td>
								<td class="right num positive">{money(c.amount)}</td>
								<td class="right num muted">{percent(s.income ? c.amount / s.income : 0)}</td>
							</tr>
						{/each}
						{#each s.expenseGroups as g (g.group.id)}
							<tr class="group-row">
								<td><span class="cell"><span class="sw" style:background={slotColor(g.group.color_slot)}></span>{g.group.name}</span></td>
								<td class="right num">{money(-g.amount)}</td>
								<td class="right num">{percent(s.income ? g.amount / s.income : 0)}</td>
							</tr>
							{#each g.categories as c (c.category.id)}
								<tr>
									<td class="indent"><span class="cell"><CategoryIcon icon={c.category.icon} slot={c.category.group.color_slot} size={24} />{c.category.name}</span></td>
									<td class="right num">{money(-c.amount)}</td>
									<td class="right num muted">{percent(s.income ? c.amount / s.income : 0)}</td>
								</tr>
							{/each}
						{/each}
						<tr class="group-row">
							<td>Net savings</td>
							<td class="right num" class:positive={s.net >= 0} class:negative={s.net < 0}>{money(s.net)}</td>
							<td class="right num">{percent(s.savingsRate)}</td>
						</tr>
					</tbody>
				</table>
			{/if}
		</section>
	{:else}
		{@const rows = data.tab === 'spending' ? spendingRows : incomeRows}
		<div class="two-col">
			<section class="card">
				<div class="card-header">
					<h2>{data.tab === 'spending' ? 'Spending' : 'Income'} by {data.tab === 'spending' ? spendBy : 'category'}</h2>
					{#if data.tab === 'spending'}
						<div class="segmented" role="group" aria-label="Group by">
							<button aria-pressed={spendBy === 'category'} onclick={() => (spendBy = 'category')}>Category</button>
							<button aria-pressed={spendBy === 'group'} onclick={() => (spendBy = 'group')}>Group</button>
						</div>
					{/if}
				</div>
				<div class="card-pad">
					{#if rows.length}
						<BarList {rows} />
					{:else}
						<p class="muted">No {data.tab} in this period.</p>
					{/if}
				</div>
			</section>

			<section class="card">
				<div class="card-header">
					<h2>{data.tab === 'spending' ? 'Top merchants' : 'Top sources'}</h2>
				</div>
				<ul class="merchants">
					{#each data.merchants as m, i (m.merchant)}
						<li>
							<span class="rank num">{i + 1}</span>
							<MerchantLogo src={m.logo_url} icon="storefront" size={30} />
							<span class="m-name">
								<a href="/transactions?q={encodeURIComponent(m.merchant)}">{m.merchant}</a>
								<span class="muted">{m.txn_count} transaction{Number(m.txn_count) === 1 ? '' : 's'}</span>
							</span>
							<span class="m-amt num">
								{money(Math.abs(Number(m.total)))}
								<span class="muted">{percent(merchantTotal ? Math.abs(Number(m.total)) / merchantTotal : 0)}</span>
							</span>
						</li>
					{:else}
						<li class="muted">No merchants in this period.</li>
					{/each}
				</ul>
			</section>
		</div>
	{/if}
</div>

<style>
	.main-card {
		margin-top: 16px;
	}
	.report-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding: 22px 28px 18px;
	}
	.range {
		margin-top: 6px;
		font-size: 19px;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.mode {
		width: auto;
		height: 36px;
		font-size: 13.5px;
		font-weight: 500;
	}
	.sankey {
		padding: 24px 28px 28px;
	}
	.table .cell {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.table .indent {
		padding-left: 36px;
	}
	.group-row td {
		font-weight: 600;
		background: var(--surface-2);
	}
	.sw {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.two-col {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		gap: 16px;
		margin-top: 16px;
		align-items: start;
	}
	.merchants {
		list-style: none;
		margin: 0;
		padding: 10px 12px 14px;
	}
	.merchants li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 10px;
		border-radius: 6px;
		font-size: 13.5px;
	}
	.merchants li:hover {
		background: var(--surface-2);
	}
	.rank {
		width: 16px;
		text-align: right;
		color: var(--ink-3);
		font-size: 12px;
	}
	.m-name {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.m-name a {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.m-name a:hover {
		text-decoration: underline;
	}
	.m-name .muted {
		font-size: 12px;
	}
	.m-amt {
		display: grid;
		justify-items: end;
		font-weight: 600;
	}
	.m-amt .muted {
		font-size: 11.5px;
		font-weight: 400;
	}
	@media (max-width: 900px) {
		.two-col {
			grid-template-columns: minmax(0, 1fr);
		}
		.report-head,
		.sankey {
			padding-left: 16px;
			padding-right: 16px;
		}
	}
</style>
