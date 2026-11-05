<script lang="ts">
	import { goto } from '$app/navigation';
	import StatCard from '$lib/components/StatCard.svelte';
	import DateRangeMenu from '$lib/components/DateRangeMenu.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import ColumnChart from '$lib/components/charts/ColumnChart.svelte';
	import { catalog } from '$lib/catalog';
	import { monthlySeries, summarize } from '$lib/finance';
	import { isoDate, monthEnd, parseDate } from '$lib/dates';
	import { money, monthLabel, percent } from '$lib/format';

	let { data } = $props();

	const cat = $derived(catalog(data));
	const s = $derived(summarize(data.totals, cat.index));
	const series = $derived(monthlySeries(data.totals, cat.index, data.months));
	const monthsWithData = $derived(series.filter((m) => m.income || m.expenses).length || 1);

	const INCOME = 'var(--series-1)';
	const EXPENSES = 'var(--series-2)';

	function openMonth(month: string) {
		const start = `${month}-01`;
		const end = isoDate(monthEnd(parseDate(start)));
		goto(`/reports?range=custom&from=${start}&to=${end}`);
	}
</script>

<svelte:head><title>Cash Flow · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="title"><h1>Cash Flow</h1></div>
		<div class="actions"><DateRangeMenu range={data.range} /></div>
	</header>

	<section class="stats">
		<StatCard label="Total income" value={money(s.income, { cents: false })} tone="positive" hint="{money(s.income / monthsWithData, { cents: false })} / month avg" />
		<StatCard label="Total expenses" value={money(s.expenses, { cents: false })} tone="negative" hint="{money(s.expenses / monthsWithData, { cents: false })} / month avg" />
		<StatCard label="Net income" value={money(s.net, { cents: false })} />
		<StatCard label="Savings rate" value={percent(s.savingsRate)} />
	</section>

	<section class="card chart-card">
		<div class="card-header">
			<div>
				<h2>Income vs. expenses</h2>
				<p class="muted sub">Select a month to see where it went.</p>
			</div>
			<Legend items={[{ label: 'Income', color: INCOME }, { label: 'Expenses', color: EXPENSES }]} />
		</div>
		<div class="chart">
			<ColumnChart
				height={300}
				series={[
					{ key: 'income', label: 'Income', color: INCOME },
					{ key: 'expenses', label: 'Expenses', color: EXPENSES }
				]}
				data={series.map((m) => ({ key: m.month, label: monthLabel(m.month), values: { income: m.income, expenses: m.expenses } }))}
				footer={(d) => {
					const net = (d.values.income ?? 0) - (d.values.expenses ?? 0);
					return [
						{ label: 'Net', value: money(net, { signed: true }), tone: net >= 0 ? 'positive' : 'negative' },
						{ label: 'Saved', value: d.values.income ? percent(net / d.values.income, 0) : '—' }
					];
				}}
				onselect={openMonth}
			/>
		</div>
	</section>

	<section class="card">
		<table class="table">
			<thead>
				<tr>
					<th>Month</th>
					<th class="right">Income</th>
					<th class="right">Expenses</th>
					<th class="right">Net income</th>
					<th class="right hide-sm">Savings rate</th>
				</tr>
			</thead>
			<tbody>
				{#each [...series].reverse() as m (m.month)}
					<tr>
						<td><a href="/reports?range=custom&from={m.month}-01&to={isoDate(monthEnd(parseDate(`${m.month}-01`)))}">{monthLabel(m.month, 'long')}</a></td>
						<td class="right num">{money(m.income)}</td>
						<td class="right num">{money(m.expenses)}</td>
						<td class="right num" class:positive={m.net > 0} class:negative={m.net < 0}>{money(m.net, { signed: true })}</td>
						<td class="right num hide-sm">{m.income > 0 ? percent(m.net / m.income) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>

<style>
	.chart-card {
		margin: 16px 0;
	}
	.sub {
		font-size: 12.5px;
		margin-top: 2px;
	}
	.chart {
		padding: 16px 22px 18px 12px;
	}
	td a:hover {
		text-decoration: underline;
	}
	@media (max-width: 640px) {
		.hide-sm {
			display: none;
		}
		.table td,
		.table th {
			padding-left: 10px;
			padding-right: 10px;
		}
	}
</style>
