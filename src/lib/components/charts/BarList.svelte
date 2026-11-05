<script lang="ts" module>
	export interface BarRow {
		id: string;
		label: string;
		icon?: string;
		slot: number;
		amount: number;
		/** Share of the whole, shown as a percentage. */
		share: number;
		sublabel?: string;
		href?: string;
	}
</script>

<script lang="ts">
	import CategoryIcon from '../CategoryIcon.svelte';
	import { slotColor } from '$lib/finance';
	import { money, percent } from '$lib/format';


	let { rows, limit }: { rows: BarRow[]; limit?: number } = $props();

	const shown = $derived(limit ? rows.slice(0, limit) : rows);
	const max = $derived(Math.max(1, ...rows.map((r) => r.amount)));
</script>

<ul class="bars">
	{#each shown as r (r.id)}
		<li>
			<svelte:element this={r.href ? 'a' : 'div'} href={r.href} class="row">
				{#if r.icon}<CategoryIcon icon={r.icon} slot={r.slot} size={30} />{/if}
				<div class="main">
					<div class="top">
						<span class="label">{r.label}</span>
						<span class="amount num">{money(r.amount)}</span>
					</div>
					<div class="track">
						<span class="bar" style:width="{Math.max(0.5, (r.amount / max) * 100)}%" style:background={slotColor(r.slot)}></span>
						<span class="pct num">{percent(r.share, 1)}</span>
					</div>
					{#if r.sublabel}<div class="sub muted">{r.sublabel}</div>{/if}
				</div>
			</svelte:element>
		</li>
	{/each}
</ul>

<style>
	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 10px;
		margin: 0 -10px;
		border-radius: 6px;
		transition: background 0.12s;
	}
	a.row:hover {
		background: var(--surface-2);
	}
	.main {
		flex: 1;
		min-width: 0;
	}
	.top {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 13.5px;
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}
	.amount {
		font-weight: 600;
	}
	.track {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 6px;
	}
	.bar {
		height: 8px;
		border-radius: 0 4px 4px 0;
		transition: width 0.5s var(--ease);
	}
	.pct {
		font-size: 12px;
		color: var(--ink-3);
		margin-left: auto;
		min-width: 42px;
		text-align: right;
	}
	.sub {
		font-size: 12px;
		margin-top: 2px;
	}
</style>
