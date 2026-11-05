<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		x,
		y,
		containerWidth,
		children
	}: { x: number; y: number; containerWidth: number; children: Snippet } = $props();

	// Flip to the left of the pointer near the right edge.
	const flip = $derived(x > containerWidth - 220);
</script>

<div class="tip" class:flip style:left="{x}px" style:top="{y}px">
	{@render children()}
</div>

<style>
	.tip {
		position: absolute;
		z-index: 5;
		pointer-events: none;
		transform: translate(14px, -50%);
		min-width: 160px;
		max-width: 260px;
		padding: 10px 12px;
		border-radius: 6px;
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		font-size: 12.5px;
		line-height: 1.5;
		white-space: nowrap;
	}
	.tip.flip {
		transform: translate(calc(-100% - 14px), -50%);
	}
	.tip :global(.tt-title) {
		font-weight: 600;
		margin-bottom: 4px;
		color: var(--ink);
	}
	.tip :global(.tt-row) {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ink-2);
	}
	.tip :global(.tt-row b) {
		margin-left: auto;
		padding-left: 12px;
		color: var(--ink);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.tip :global(.tt-swatch) {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex: none;
	}
	.tip :global(.tt-divider) {
		height: 1px;
		margin: 6px 0;
		background: var(--border);
	}
</style>
