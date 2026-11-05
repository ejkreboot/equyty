<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import MerchantLogo from '$lib/components/MerchantLogo.svelte';
	import PlaidLinkButton from '$lib/components/PlaidLinkButton.svelte';
	import SyncButton from '$lib/components/SyncButton.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import BarList from '$lib/components/charts/BarList.svelte';
	import { catalog } from '$lib/catalog';
	import { isLiability, summarize } from '$lib/finance';
	import { daysInMonth, parseDate } from '$lib/dates';
	import { money, moneyCompact, percent, shortDate } from '$lib/format';

	let { data } = $props();

	const cat = $derived(catalog(data));
	const month = $derived(summarize(data.totals.filter((r) => r.month.startsWith(data.thisMonth)), cat.index));
	const prev = $derived(summarize(data.totals.filter((r) => r.month.startsWith(data.lastMonth)), cat.index));

	const hour = new Date().getHours();
	const greeting = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	const firstName = $derived((data.displayName ?? '').split(' ')[0]);
	const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

	// Net worth
	const visibleAccounts = $derived(data.accounts.filter((a) => !a.is_hidden));
	const assets = $derived(visibleAccounts.filter((a) => !isLiability(a.type)).reduce((s, a) => s + (a.current_balance ?? 0), 0));
	const liabilities = $derived(visibleAccounts.filter((a) => isLiability(a.type)).reduce((s, a) => s + (a.current_balance ?? 0), 0));
	const netWorth = $derived(assets - liabilities);
	const nwPoints = $derived(data.netWorth.map((p) => ({ x: parseDate(p.day).getTime(), y: Number(p.assets) - Number(p.liabilities) })));
	const nwDelta = $derived(nwPoints.length > 1 ? netWorth - nwPoints[0].y : null);

	// Spending pace: cumulative spend by day of month, this month vs last
	const pace = $derived.by(() => {
		const cumulative = (prefix: string, days: number) => {
			const byDay = new Map<number, number>();
			for (const d of data.daily) if (d.day.startsWith(prefix)) byDay.set(Number(d.day.slice(8, 10)), -Number(d.total));
			const out: { x: number; y: number }[] = [];
			let sum = 0;
			for (let day = 1; day <= days; day++) {
				sum += byDay.get(day) ?? 0;
				out.push({ x: day, y: Math.max(0, sum) });
			}
			return out;
		};
		const now = new Date();
		const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		return {
			current: cumulative(data.thisMonth, now.getDate()),
			previous: cumulative(data.lastMonth, daysInMonth(last))
		};
	});
	const paceDelta = $derived.by(() => {
		const day = pace.current.length;
		const prevAtDay = pace.previous[Math.min(day, pace.previous.length) - 1]?.y ?? 0;
		const cur = pace.current.at(-1)?.y ?? 0;
		return { diff: cur - prevAtDay, cur };
	});

	// Budgets
	const budgetRows = $derived(
		data.budgets
			.map((b) => {
				const c = cat.index.get(b.category_id);
				const spent = month.expenseCategories.find((e) => e.category.id === b.category_id)?.amount ?? 0;
				return c ? { c, budget: Number(b.amount), spent, ratio: Number(b.amount) > 0 ? spent / Number(b.amount) : 0 } : null;
			})
			.filter((r): r is NonNullable<typeof r> => r !== null)
			.sort((a, b) => b.ratio - a.ratio)
			.slice(0, 5)
	);

	const topSpending = $derived(
		month.expenseCategories
			.filter((c) => c.amount > 0)
			.map((c) => ({
				id: c.category.id,
				label: c.category.name,
				icon: c.category.icon,
				slot: c.category.group.color_slot,
				amount: c.amount,
				share: month.expenses > 0 ? c.amount / month.expenses : 0,
				href: `/transactions?category=${c.category.id}`
			}))
	);
</script>

<svelte:head><title>Dashboard · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="hello">
			<h1>{greeting}{firstName ? `, ${firstName}` : ''}</h1>
			<p class="muted">{todayLabel}</p>
		</div>
		<div class="actions">
			{#if data.items.length}<SyncButton />{/if}
			<PlaidLinkButton label="Connect account" variant={data.items.length ? '' : 'primary'} />
		</div>
	</header>

	{#if data.accounts.length === 0}
		<section class="card onboarding">
			<div class="copy">
				<span class="badge accent"><Icon name="auto_awesome" size={14} />Get started</span>
				<h2>Connect your first account</h2>
				<p class="secondary">
					Link a checking account or credit card through Plaid. We’ll import up to two years of history, categorize every transaction with AI, and
					build your cash-flow picture automatically.
				</p>
				<ol>
					<li><span>1</span>Securely connect with Plaid — read-only access</li>
					<li><span>2</span>Transactions are imported and auto-categorized</li>
					<li><span>3</span>Set budgets and goals from real spending</li>
				</ol>
				<PlaidLinkButton label="Connect an account" variant="accent" />
			</div>
			<div class="art" aria-hidden="true">
				<Icon name="account_tree" size={96} weight={300} />
			</div>
		</section>
	{:else}
		{#if data.reviewCount > 0}
			<a class="review card" href="/transactions?review=1">
				<span class="spark"><Icon name="auto_awesome" size={18} /></span>
				<span><strong>{data.reviewCount} transaction{data.reviewCount === 1 ? '' : 's'}</strong> could use a quick look — uncategorized or low AI confidence.</span>
				<span class="go">Review <Icon name="arrow_forward" size={16} /></span>
			</a>
		{/if}

		<div class="row-a">
			<section class="card networth">
				<div class="card-header">
					<span class="eyebrow">Net worth</span>
					<a class="link" href="/accounts">Accounts <Icon name="chevron_right" size={18} /></a>
				</div>
				<div class="hero">
					<div class="figure">{money(netWorth, { cents: false })}</div>
					{#if nwDelta !== null}
						<span class="badge {nwDelta >= 0 ? 'positive' : 'negative'}">
							<Icon name={nwDelta >= 0 ? 'arrow_upward' : 'arrow_downward'} size={14} />
							{money(Math.abs(nwDelta), { cents: false })} · 6 mo
						</span>
					{/if}
				</div>
				<div class="split">
					<div><span class="muted">Assets</span><b class="num">{money(assets, { cents: false })}</b></div>
					<div><span class="muted">Liabilities</span><b class="num">{money(liabilities, { cents: false })}</b></div>
				</div>
				{#if nwPoints.length > 1}
					<div class="chart">
						<LineChart
							height={170}
							series={[{ key: 'nw', label: 'Net worth', color: 'var(--series-1)', points: nwPoints, area: true }]}
							xFormat={(x) => new Date(x).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
							zeroBaseline={false}
						/>
					</div>
				{:else}
					<p class="muted note">Your net worth trend builds up as balances sync each day.</p>
				{/if}
			</section>

			<section class="card thismonth">
				<div class="card-header">
					<span class="eyebrow">Spending this month</span>
					<a class="link" href="/reports">Reports <Icon name="chevron_right" size={18} /></a>
				</div>
				<div class="hero">
					<div class="figure">{money(paceDelta.cur, { cents: false })}</div>
					{#if pace.previous.length}
						<span class="badge {paceDelta.diff <= 0 ? 'positive' : 'negative'}">
							{money(Math.abs(paceDelta.diff), { cents: false })}
							{paceDelta.diff <= 0 ? 'below' : 'above'} last month
						</span>
					{/if}
				</div>
				<div class="chart">
					<LineChart
						height={170}
						series={[
							{ key: 'prev', label: 'Last month', color: 'var(--series-neutral)', points: pace.previous, dashed: true },
							{ key: 'cur', label: 'This month', color: 'var(--series-2)', points: pace.current, area: true }
						]}
						xFormat={(x) => `Day ${x}`}
						xTicks={[1, 15, pace.previous.length || 30]}
					/>
				</div>
				<div class="foot">
					<Legend items={[{ label: 'This month', color: 'var(--series-2)' }, { label: 'Last month', color: 'var(--series-neutral)', dashed: true }]} />
					<div class="mini">
						<span>Income <b class="num">{moneyCompact(month.income)}</b></span>
						<span>Saved <b class="num">{percent(month.savingsRate, 0)}</b></span>
					</div>
				</div>
			</section>
		</div>

		<div class="row-b">
			<section class="card">
				<div class="card-header">
					<h2>Budget</h2>
					<a class="link" href="/budget">View all <Icon name="chevron_right" size={18} /></a>
				</div>
				<div class="card-pad">
					{#if budgetRows.length}
						<ul class="budgets">
							{#each budgetRows as r (r.c.id)}
								<li>
									<div class="b-top">
										<span>{r.c.name}</span>
										<span class="num"><b>{money(r.spent, { cents: false })}</b> <span class="muted">/ {money(r.budget, { cents: false })}</span></span>
									</div>
									<div class="meter" class:warning={r.ratio >= 0.85 && r.ratio <= 1} class:over={r.ratio > 1}>
										<span style:width="{Math.min(100, r.ratio * 100)}%"></span>
									</div>
									{#if r.ratio > 1}<span class="over-note"><Icon name="warning" size={14} fill />{money(r.spent - r.budget, { cents: false })} over</span>{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<div class="empty-inline">
							<p class="muted">Set monthly targets for the categories you care about.</p>
							<a class="btn sm" href="/budget">Create a budget</a>
						</div>
					{/if}
				</div>
			</section>

			<section class="card">
				<div class="card-header">
					<h2>Top categories</h2>
					<a class="link" href="/reports?tab=spending">Details <Icon name="chevron_right" size={18} /></a>
				</div>
				<div class="card-pad">
					{#if topSpending.length}
						<BarList rows={topSpending} limit={5} />
					{:else}
						<p class="muted">No spending yet this month.</p>
					{/if}
				</div>
			</section>

			<section class="card">
				<div class="card-header">
					<h2>Upcoming bills</h2>
					<a class="link" href="/recurring">Recurring <Icon name="chevron_right" size={18} /></a>
				</div>
				<div class="card-pad">
					{#if data.upcoming.length}
						<ul class="upcoming">
							{#each data.upcoming as u (u.id)}
								{@const d = parseDate(u.predicted_next_date!)}
								<li>
									<span class="cal"><small>{d.toLocaleDateString('en-US', { month: 'short' })}</small>{d.getDate()}</span>
									<span class="u-name">{u.merchant_name ?? u.description}</span>
									<span class="num">{money(u.average_amount)}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted">Recurring bills appear here once enough history is imported.</p>
					{/if}
				</div>
			</section>
		</div>

		<section class="card recent">
			<div class="card-header">
				<h2>Recent transactions</h2>
				<a class="link" href="/transactions">All transactions <Icon name="chevron_right" size={18} /></a>
			</div>
			<ul class="txns">
				{#each data.recent as t (t.id)}
					{@const c = t.category_id ? cat.index.get(t.category_id) : undefined}
					<li>
						<MerchantLogo src={t.logo_url} icon={c?.icon ?? 'receipt_long'} slot={c?.group.color_slot ?? -1} />
						<div class="t-main">
							<span class="t-name">{t.merchant_name ?? t.name}</span>
							<span class="t-sub muted">{c?.name ?? 'Uncategorized'} · {cat.accountName(t.account_id)}{t.pending ? ' · Pending' : ''}</span>
						</div>
						<span class="t-date muted">{shortDate(t.date)}</span>
						<span class="t-amt num" class:positive={t.amount > 0}>{money(t.amount, { signed: t.amount > 0 })}</span>
					</li>
				{:else}
					<li class="muted">Transactions will appear after your first sync.</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.hello p {
		margin-top: 2px;
		font-size: 13.5px;
	}
	.onboarding {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		overflow: hidden;
	}
	.onboarding .copy {
		display: grid;
		gap: 14px;
		justify-items: start;
		padding: 36px;
	}
	.onboarding h2 {
		font-size: 24px;
		letter-spacing: -0.025em;
	}
	.onboarding p {
		max-width: 480px;
	}
	.onboarding ol {
		list-style: none;
		margin: 4px 0 8px;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.onboarding li {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--ink-2);
	}
	.onboarding li span {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--surface-3);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
	}
	.art {
		display: grid;
		place-items: center;
		color: var(--accent);
		background:
			radial-gradient(60% 60% at 50% 50%, var(--accent-soft), transparent),
			var(--surface-2);
	}
	.review {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		margin-bottom: 16px;
		font-size: 13.5px;
		transition: box-shadow 0.15s;
	}
	.review:hover {
		box-shadow: var(--shadow-md);
	}
	.spark {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 5px;
		background: var(--accent-soft);
		color: var(--accent);
		flex: none;
	}
	.go {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-weight: 500;
		color: var(--accent);
		white-space: nowrap;
	}
	.row-a {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}
	.row-b {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
		margin-top: 16px;
	}
	.hero {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 8px 22px 0;
	}
	.figure {
		font-size: 34px;
		font-weight: 600;
		letter-spacing: -0.035em;
	}
	.split {
		display: flex;
		gap: 28px;
		padding: 6px 22px 0;
		font-size: 13px;
	}
	.split div {
		display: flex;
		gap: 8px;
	}
	.chart {
		padding: 12px 14px 8px 8px;
	}
	.note {
		padding: 24px 22px;
		font-size: 13px;
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 0 22px 18px;
	}
	.mini {
		display: flex;
		gap: 16px;
		font-size: 12.5px;
		color: var(--ink-3);
	}
	.mini b {
		color: var(--ink);
		font-weight: 600;
		margin-left: 4px;
	}
	.budgets {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 16px;
	}
	.b-top {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 7px;
		font-size: 13.5px;
	}
	.over-note {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 5px;
		font-size: 12px;
		color: var(--negative);
	}
	.empty-inline {
		display: grid;
		gap: 12px;
		justify-items: start;
		font-size: 13.5px;
	}
	.upcoming {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	.upcoming li {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13.5px;
	}
	.cal {
		display: grid;
		place-items: center;
		width: 38px;
		height: 40px;
		flex: none;
		border-radius: 6px;
		background: var(--surface-2);
		box-shadow: inset 0 0 0 1px var(--border);
		font-weight: 600;
		font-size: 14px;
		line-height: 1;
	}
	.cal small {
		font-size: 9.5px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--accent);
	}
	.u-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}
	.recent {
		margin-top: 16px;
	}
	.txns {
		list-style: none;
		margin: 8px 0 0;
		padding: 0 10px 10px;
	}
	.txns li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 6px;
		font-size: 13.5px;
	}
	.txns li:hover {
		background: var(--surface-2);
	}
	.t-main {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.t-name {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.t-sub {
		font-size: 12.5px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.t-amt {
		min-width: 90px;
		text-align: right;
		font-weight: 600;
	}
	@media (max-width: 1100px) {
		.row-b {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 820px) {
		.row-a,
		.row-b,
		.onboarding {
			grid-template-columns: minmax(0, 1fr);
		}
		.art {
			display: none;
		}
		.onboarding .copy {
			padding: 24px;
		}
		.t-date {
			display: none;
		}
	}
</style>
