<script lang="ts">
	let { items }: { items: { label: string; color: string; dashed?: boolean }[] } = $props();
</script>

<ul class="legend">
	{#each items as item (item.label)}
		<li>
			{#if item.dashed}
				<svg width="14" height="8" aria-hidden="true"><line x1="0" x2="14" y1="4" y2="4" stroke={item.color} stroke-width="2" stroke-dasharray="3 3" /></svg>
			{:else}
				<span class="sw" style:background={item.color}></span>
			{/if}
			{item.label}
		</li>
	{/each}
</ul>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 12.5px;
		color: var(--ink-2);
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: 7px;
	}
	.sw {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
</style>
