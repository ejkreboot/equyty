<script lang="ts">
	import Icon from './Icon.svelte';
	import { slotColor } from '$lib/finance';

	let {
		icon,
		slot = -1,
		size = 32
	}: { icon: string; slot?: number; size?: number } = $props();
</script>

<span class="tile" style:--c={slotColor(slot)} style:width="{size}px" style:height="{size}px" style:border-radius="{Math.round(size * 0.2)}px">
	<Icon name={icon} size={Math.round(size * 0.56)} />
</span>

<style>
	.tile {
		display: inline-grid;
		place-items: center;
		flex: none;
		background: color-mix(in oklab, var(--c) 15%, var(--surface));
		color: color-mix(in oklab, var(--c) 55%, var(--ink));
	}
</style>
