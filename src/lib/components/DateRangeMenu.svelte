<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from './Icon.svelte';
	import Popover from './Popover.svelte';
	import { RANGE_PRESETS, type DateRange } from '$lib/dates';
	import { longDate } from '$lib/format';

	let { range, allowAll = false }: { range: DateRange | null; allowAll?: boolean } = $props();

	let open = $state(false);
	let from = $state('');
	let to = $state('');

	$effect(() => {
		if (open) {
			from = range?.start ?? '';
			to = range?.end ?? '';
		}
	});

	function apply(params: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(params)) {
			if (v === null) url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		open = false;
		goto(url, { keepFocus: true, noScroll: true });
	}

	const label = $derived(
		!range ? 'All time' : range.preset === 'custom' ? `${longDate(range.start)} – ${longDate(range.end)}` : range.label
	);
</script>

<Popover bind:open align="end" width={260}>
	{#snippet trigger({ toggle, open })}
		<button class="btn" onclick={toggle} aria-expanded={open} aria-haspopup="menu">
			<Icon name="calendar_month" size={18} />
			{label}
			<Icon name="expand_more" size={18} />
		</button>
	{/snippet}
	{#snippet children()}
		<div class="menu" role="menu">
			{#if allowAll}
				<button role="menuitemradio" aria-checked={!range} onclick={() => apply({ range: null, from: null, to: null })}>
					<span>All time</span>
					{#if !range}<Icon name="check" size={18} weight={600} />{/if}
				</button>
			{/if}
			{#each RANGE_PRESETS as preset (preset.value)}
				<button
					role="menuitemradio"
					aria-checked={range?.preset === preset.value}
					onclick={() => apply({ range: preset.value, from: null, to: null })}
				>
					<span>{preset.label}</span>
					{#if range?.preset === preset.value}<Icon name="check" size={18} weight={600} />{/if}
				</button>
			{/each}
		</div>
		<form
			class="custom"
			onsubmit={(e) => {
				e.preventDefault();
				if (from && to && from <= to) apply({ range: 'custom', from, to });
			}}
		>
			<span class="eyebrow">Custom range</span>
			<div class="dates">
				<input class="input" type="date" bind:value={from} aria-label="From" max={to} />
				<input class="input" type="date" bind:value={to} aria-label="To" min={from} />
			</div>
			<button class="btn primary sm block" disabled={!from || !to || from > to}>Apply</button>
		</form>
	{/snippet}
</Popover>

<style>
	.menu {
		padding: 6px;
	}
	.menu button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 34px;
		padding: 0 10px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		font-size: 13.5px;
		text-align: left;
	}
	.menu button:hover {
		background: var(--surface-3);
	}
	.custom {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-top: 1px solid var(--border);
	}
	.dates {
		display: grid;
		gap: 6px;
	}
	.dates .input {
		height: 34px;
		font-size: 13px;
	}
</style>
