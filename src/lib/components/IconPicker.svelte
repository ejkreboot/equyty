<script lang="ts">
	import Icon from './Icon.svelte';
	import { PICKER_ICONS } from '$lib/icons';

	let { value, onselect }: { value: string; onselect: (icon: string) => void } = $props();
</script>

<div class="grid" role="listbox" aria-label="Choose an icon">
	{#each PICKER_ICONS as ic (ic)}
		<button role="option" aria-selected={value === ic} class:on={value === ic} onclick={() => onselect(ic)} title={ic.replaceAll('_', ' ')}>
			<Icon name={ic} size={20} />
		</button>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 4px;
		padding: 10px;
		max-height: 260px;
		overflow-y: auto;
	}
	button {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--ink-2);
	}
	button:hover {
		background: var(--surface-3);
		color: var(--ink);
	}
	button.on {
		background: var(--ink);
		color: var(--ink-inverse);
	}
</style>
