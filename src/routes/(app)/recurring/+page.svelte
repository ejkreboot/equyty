<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import { catalog } from '$lib/catalog';
	import { addDays, isoDate, parseDate } from '$lib/dates';
	import { money, shortDate, titleCase } from '$lib/format';

	let { data } = $props();

	const cat = $derived(catalog(data));
	let show = $state<'outflow' | 'inflow'>('outflow');
	let includeInactive = $state(false);

	const PER_MONTH: Record<string, number> = { WEEKLY: 52 / 12, BIWEEKLY: 26 / 12, SEMI_MONTHLY: 2, MONTHLY: 1, ANNUALLY: 1 / 12 };
	const monthly = (s: { frequency: string; average_amount: number }) => Number(s.average_amount) * (PER_MONTH[s.frequency] ?? 1);

	const active = $derived(data.streams.filter((s) => s.is_active));
	const outflowMonthly = $derived(active.filter((s) => s.direction === 'outflow').reduce((sum, s) => sum + monthly(s), 0));
	const inflowMonthly = $derived(active.filter((s) => s.direction === 'inflow').reduce((sum, s) => sum + monthly(s), 0));

	const today = isoDate(new Date());
	const horizon = isoDate(addDays(new Date(), 30));
	const upcoming = $derived(
		active
			.filter((s) => s.direction === 'outflow' && s.predicted_next_date && s.predicted_next_date >= today && s.predicted_next_date <= horizon)
			.sort((a, b) => (a.predicted_next_date! < b.predicted_next_date! ? -1 : 1))
	);
	const upcomingTotal = $derived(upcoming.reduce((sum, s) => sum + Number(s.average_amount), 0));

	const list = $derived(data.streams.filter((s) => s.direction === show && (includeInactive || s.is_active)));

	const ICONS: Record<string, string> = {
		RENT_AND_UTILITIES: 'bolt',
		ENTERTAINMENT: 'subscriptions',
		LOAN_PAYMENTS: 'account_balance',
		INCOME: 'payments',
		GENERAL_SERVICES: 'receipt_long',
		PERSONAL_CARE: 'fitness_center',
		TRANSPORTATION: 'directions_car',
		FOOD_AND_DRINK: 'restaurant'
	};
	const iconFor = (detailed: string | null) => {
		const key = Object.keys(ICONS).find((k) => detailed?.startsWith(k));
		return key ? ICONS[key] : 'event_repeat';
	};
	const FREQ: Record<string, string> = { WEEKLY: 'Weekly', BIWEEKLY: 'Every 2 weeks', SEMI_MONTHLY: 'Twice a month', MONTHLY: 'Monthly', ANNUALLY: 'Yearly', UNKNOWN: 'Irregular' };
</script>

<svelte:head><title>Recurring · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="title"><h1>Recurring</h1></div>
	</header>

	{#if data.streams.length === 0}
		<section class="card">
			<EmptyState
				icon="event_repeat"
				title="No recurring payments detected yet"
				body="Subscriptions, bills and paychecks are detected automatically once there’s a few months of transaction history."
			/>
		</section>
	{:else}
		<section class="stats three">
			<StatCard label="Recurring bills / mo" value={money(outflowMonthly, { cents: false })} tone="negative" />
			<StatCard label="Recurring income / mo" value={money(inflowMonthly, { cents: false })} tone="positive" />
			<StatCard label="Due next 30 days" value={money(upcomingTotal, { cents: false })} hint="{upcoming.length} payment{upcoming.length === 1 ? '' : 's'}" />
		</section>

		<div class="cols">
			<section class="card">
				<div class="card-header">
					<div class="segmented" role="group" aria-label="Direction">
						<button aria-pressed={show === 'outflow'} onclick={() => (show = 'outflow')}>Bills & subscriptions</button>
						<button aria-pressed={show === 'inflow'} onclick={() => (show = 'inflow')}>Income</button>
					</div>
					<label class="inactive"><input type="checkbox" class="switch" bind:checked={includeInactive} />Show inactive</label>
				</div>
				<table class="table">
					<thead>
						<tr><th>Name</th><th class="hide-sm">Frequency</th><th class="hide-sm">Account</th><th class="right">Amount</th><th class="right">Next</th></tr>
					</thead>
					<tbody>
						{#each list as s (s.id)}
							<tr class:inactive-row={!s.is_active}>
								<td>
									<span class="cell">
										<CategoryIcon icon={iconFor(s.plaid_category_detailed)} slot={s.direction === 'inflow' ? 5 : 0} size={30} />
										<span class="nm">
											<a href="/transactions?q={encodeURIComponent(s.merchant_name ?? s.description)}">{s.merchant_name ?? titleCase(s.description)}</a>
											{#if s.status === 'EARLY_DETECTION'}<span class="badge">New</span>{/if}
											{#if !s.is_active}<span class="badge">Inactive</span>{/if}
										</span>
									</span>
								</td>
								<td class="hide-sm muted">{FREQ[s.frequency] ?? titleCase(s.frequency)}</td>
								<td class="hide-sm muted">{cat.accountName(s.account_id)}</td>
								<td class="right num">
									{money(s.average_amount)}
									{#if Math.abs(Number(s.last_amount) - Number(s.average_amount)) > 1}
										<div class="muted last">last {money(s.last_amount)}</div>
									{/if}
								</td>
								<td class="right muted">{s.is_active && s.predicted_next_date ? shortDate(s.predicted_next_date) : '—'}</td>
							</tr>
						{:else}
							<tr><td colspan="5" class="muted">Nothing here yet.</td></tr>
						{/each}
					</tbody>
				</table>
			</section>

			<section class="card timeline">
				<div class="card-header"><h2>Next 30 days</h2></div>
				<ol>
					{#each upcoming as s (s.id)}
						{@const d = parseDate(s.predicted_next_date!)}
						<li>
							<span class="when">
								<b>{d.getDate()}</b>
								<small>{d.toLocaleDateString('en-US', { weekday: 'short' })}</small>
							</span>
							<span class="what">{s.merchant_name ?? titleCase(s.description)}</span>
							<span class="num">{money(s.average_amount)}</span>
						</li>
					{:else}
						<li class="muted">Nothing due in the next 30 days.</li>
					{/each}
				</ol>
				<p class="muted foot"><Icon name="info" size={14} />Dates are predicted from your payment history.</p>
			</section>
		</div>
	{/if}
</div>

<style>
	.stats.three {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
		gap: 16px;
		margin-top: 16px;
		align-items: start;
	}
	.card-header {
		padding-bottom: 12px;
	}
	.inactive {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--ink-2);
		cursor: pointer;
	}
	.cell {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.nm {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
	}
	.nm a:hover {
		text-decoration: underline;
	}
	.last {
		font-size: 11.5px;
	}
	.inactive-row {
		opacity: 0.55;
	}
	.timeline ol {
		list-style: none;
		margin: 0;
		padding: 8px 20px 4px;
	}
	.timeline li {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 0;
		border-bottom: 1px dashed var(--border-strong);
		font-size: 13.5px;
	}
	.timeline li:last-child {
		border-bottom: 0;
	}
	.when {
		display: grid;
		justify-items: center;
		width: 36px;
		line-height: 1.1;
	}
	.when b {
		font-size: 17px;
	}
	.when small {
		font-size: 10.5px;
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.what {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 20px 18px;
		font-size: 12px;
	}
	@media (max-width: 1000px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 640px) {
		.stats.three {
			grid-template-columns: minmax(0, 1fr);
		}
		.hide-sm {
			display: none;
		}
	}
</style>
