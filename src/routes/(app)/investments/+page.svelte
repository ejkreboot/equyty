<script lang="ts">
	import StatCard from '$lib/components/StatCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PlaidLinkButton from '$lib/components/PlaidLinkButton.svelte';
	import BarList from '$lib/components/charts/BarList.svelte';
	import { catalog } from '$lib/catalog';
	import { money, percent, titleCase } from '$lib/format';

	let { data } = $props();
	const cat = $derived(catalog(data));

	const accounts = $derived(data.accounts.filter((a) => a.type === 'investment' && !a.is_hidden));
	const totalValue = $derived(accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0));
	const withBasis = $derived(data.holdings.filter((h) => h.cost_basis !== null && h.value !== null));
	const basis = $derived(withBasis.reduce((s, h) => s + Number(h.cost_basis), 0));
	const basisValue = $derived(withBasis.reduce((s, h) => s + Number(h.value), 0));
	const gain = $derived(basisValue - basis);

	const TYPE_SLOT: Record<string, number> = { equity: 0, etf: 1, 'mutual fund': 2, 'fixed income': 3, cash: 5, cryptocurrency: 6, derivative: 7 };
	const allocation = $derived.by(() => {
		const by = new Map<string, number>();
		for (const h of data.holdings) by.set(h.security_type ?? 'other', (by.get(h.security_type ?? 'other') ?? 0) + Number(h.value ?? 0));
		const total = [...by.values()].reduce((s, v) => s + v, 0);
		return [...by.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([type, value]) => ({ id: type, label: titleCase(type), slot: TYPE_SLOT[type] ?? 4, amount: value, share: total ? value / total : 0 }));
	});

	let sortBy = $state<'value' | 'gain'>('value');
	const rows = $derived(
		[...data.holdings].sort((a, b) =>
			sortBy === 'value'
				? Number(b.value ?? 0) - Number(a.value ?? 0)
				: Number(b.value ?? 0) - Number(b.cost_basis ?? b.value ?? 0) - (Number(a.value ?? 0) - Number(a.cost_basis ?? a.value ?? 0))
		)
	);
</script>

<svelte:head><title>Investments · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="title"><h1>Investments</h1></div>
	</header>

	{#if accounts.length === 0}
		<section class="card">
			<EmptyState
				icon="trending_up"
				title="No investment accounts connected"
				body="Connect a brokerage or retirement account to see holdings, allocation and performance. (Requires the Plaid Investments product — see the README.)"
			>
				<PlaidLinkButton label="Connect a brokerage" />
			</EmptyState>
		</section>
	{:else}
		<section class="stats three">
			<StatCard label="Total value" value={money(totalValue, { cents: false })} />
			<StatCard label="Cost basis" value={basis ? money(basis, { cents: false }) : '—'} />
			<StatCard
				label="Unrealized gain"
				value={basis ? money(gain, { cents: false, signed: true }) : '—'}
				tone={!basis ? 'default' : gain >= 0 ? 'positive' : 'negative'}
				hint={basis ? percent(gain / basis) : undefined}
			/>
		</section>

		<div class="cols">
			<section class="card">
				<div class="card-header">
					<h2>Holdings</h2>
					<div class="segmented" role="group" aria-label="Sort">
						<button aria-pressed={sortBy === 'value'} onclick={() => (sortBy = 'value')}>Value</button>
						<button aria-pressed={sortBy === 'gain'} onclick={() => (sortBy = 'gain')}>Gain</button>
					</div>
				</div>
				{#if rows.length}
					<table class="table">
						<thead>
							<tr><th>Security</th><th class="right hide-sm">Shares</th><th class="right hide-sm">Price</th><th class="right">Value</th><th class="right">Gain</th></tr>
						</thead>
						<tbody>
							{#each rows as h (h.id)}
								{@const g = h.cost_basis !== null && h.value !== null ? Number(h.value) - Number(h.cost_basis) : null}
								<tr>
									<td>
										<div class="sec">
											<span class="ticker">{h.ticker ?? '—'}</span>
											<span class="muted nm">{h.name ?? 'Unknown'} · {cat.accountName(h.account_id)}</span>
										</div>
									</td>
									<td class="right num hide-sm">{Number(h.quantity).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
									<td class="right num hide-sm">{h.price !== null ? money(h.price) : '—'}</td>
									<td class="right num strong">{money(h.value)}</td>
									<td class="right num" class:positive={g !== null && g > 0} class:negative={g !== null && g < 0}>
										{g !== null ? money(g, { signed: true, cents: false }) : '—'}
										{#if g !== null && Number(h.cost_basis)}<div class="muted small">{percent(g / Number(h.cost_basis))}</div>{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="muted pad">Holdings will appear after the next sync.</p>
				{/if}
			</section>
			<section class="card">
				<div class="card-header"><h2>Allocation</h2></div>
				<div class="card-pad">
					{#if allocation.length}<BarList rows={allocation} />{:else}<p class="muted">No holdings yet.</p>{/if}
				</div>
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
		grid-template-columns: minmax(0, 1.8fr) minmax(260px, 1fr);
		gap: 16px;
		margin-top: 16px;
		align-items: start;
	}
	.card-header {
		padding-bottom: 12px;
	}
	.sec {
		display: grid;
	}
	.ticker {
		font-weight: 600;
	}
	.nm {
		font-size: 12.5px;
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.strong {
		font-weight: 600;
	}
	.small {
		font-size: 11.5px;
	}
	.pad {
		padding: 20px;
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
