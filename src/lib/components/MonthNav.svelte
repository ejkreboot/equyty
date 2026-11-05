<script lang="ts">
	import Icon from './Icon.svelte';
	import { monthLabel } from '$lib/format';

	let { month, hrefFor }: { month: string; hrefFor: (month: string) => string } = $props();

	const shift = (m: string, n: number) => {
		const [y, mo] = m.split('-').map(Number);
		const d = new Date(y, mo - 1 + n, 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	};
	const current = new Date();
	const thisMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
</script>

<div class="month-nav">
	<a class="btn ghost icon-only sm" href={hrefFor(shift(month, -1))} aria-label="Previous month" data-sveltekit-noscroll><Icon name="chevron_left" size={20} /></a>
	<span class="label">{monthLabel(month, 'long')}</span>
	<a class="btn ghost icon-only sm" href={hrefFor(shift(month, 1))} aria-label="Next month" data-sveltekit-noscroll><Icon name="chevron_right" size={20} /></a>
	{#if month !== thisMonth}
		<a class="btn sm" href={hrefFor(thisMonth)} data-sveltekit-noscroll>Today</a>
	{/if}
</div>

<style>
	.month-nav {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.label {
		min-width: 132px;
		text-align: center;
		font-weight: 600;
		font-size: 15px;
	}
</style>
