<script lang="ts">
	import Icon from './Icon.svelte';
	import CategoryIcon from './CategoryIcon.svelte';
	import type { CategoryMeta } from '$lib/finance';

	let {
		categories,
		value = null,
		onselect
	}: {
		categories: CategoryMeta[];
		value?: string | null;
		onselect: (category: CategoryMeta) => void;
	} = $props();

	let query = $state('');
	let active = $state(0);
	let list: HTMLDivElement | undefined = $state();

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return q
			? categories.filter((c) => c.name.toLowerCase().includes(q) || c.group.name.toLowerCase().includes(q))
			: categories;
	});

	const sections = $derived.by(() => {
		const out: { group: CategoryMeta['group']; items: { c: CategoryMeta; i: number }[] }[] = [];
		filtered.forEach((c, i) => {
			const last = out.at(-1);
			if (last && last.group.id === c.group.id) last.items.push({ c, i });
			else out.push({ group: c.group, items: [{ c, i }] });
		});
		return out;
	});

	$effect(() => {
		void query;
		active = 0;
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = Math.min(active + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === 'Enter' && filtered[active]) {
			e.preventDefault();
			onselect(filtered[active]);
		}
		requestAnimationFrame(() => list?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }));
	}
</script>

<div class="picker">
	<div class="search">
		<Icon name="search" size={18} />
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:value={query}
			{onkeydown}
			autofocus
			placeholder="Search categories"
			aria-label="Search categories"
			role="combobox"
			aria-expanded="true"
			aria-controls="category-options"
		/>
	</div>
	<div class="list" bind:this={list} id="category-options" role="listbox">
		{#each sections as section (section.group.id)}
			<div class="group eyebrow">{section.group.name}</div>
			{#each section.items as { c, i } (c.id)}
				<button
					role="option"
					aria-selected={c.id === value}
					data-active={i === active}
					onmouseenter={() => (active = i)}
					onclick={() => onselect(c)}
				>
					<CategoryIcon icon={c.icon} slot={c.group.color_slot} size={26} />
					<span>{c.name}</span>
					{#if c.id === value}<Icon name="check" size={18} class="check" />{/if}
				</button>
			{/each}
		{:else}
			<p class="empty muted">No categories match “{query}”</p>
		{/each}
	</div>
</div>

<style>
	.picker {
		width: 280px;
		max-width: 100%;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
		color: var(--ink-3);
	}
	.search input {
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		font-size: 14px;
		color: var(--ink);
	}
	.list {
		max-height: 340px;
		overflow-y: auto;
		padding: 4px 6px 8px;
		overscroll-behavior: contain;
	}
	.group {
		padding: 12px 8px 4px;
		font-size: 10.5px;
	}
	button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 6px 8px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		text-align: left;
		font-size: 13.5px;
	}
	button span {
		flex: 1;
	}
	button[data-active='true'] {
		background: var(--surface-3);
	}
	button :global(.check) {
		color: var(--accent);
	}
	.empty {
		padding: 20px 10px;
		text-align: center;
		font-size: 13px;
	}
</style>
