<script lang="ts">
	import type { Snippet } from 'svelte';
	import { scale } from 'svelte/transition';

	let {
		open = $bindable(false),
		align = 'start',
		width,
		trigger,
		children
	}: {
		open?: boolean;
		align?: 'start' | 'end';
		width?: number;
		trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
		children: Snippet<[{ close: () => void }]>;
	} = $props();

	let root: HTMLDivElement | undefined = $state();
	let panel: HTMLDivElement | undefined = $state();
	let up = $state(false);

	const toggle = () => (open = !open);
	const close = () => (open = false);

	$effect(() => {
		if (!open) return;
		const onPointer = (e: PointerEvent) => {
			if (root && !root.contains(e.target as Node)) close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				close();
			}
		};
		document.addEventListener('pointerdown', onPointer, true);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('pointerdown', onPointer, true);
			document.removeEventListener('keydown', onKey);
		};
	});

	$effect(() => {
		if (!open || !panel || !root) return;
		const r = root.getBoundingClientRect();
		const h = panel.offsetHeight;
		up = r.bottom + h + 16 > window.innerHeight && r.top > h + 16;
	});
</script>

<div class="pop-root" bind:this={root}>
	{@render trigger({ toggle, open })}
	{#if open}
		<div
			bind:this={panel}
			class="panel {align}"
			class:up
			style:width={width ? `${width}px` : undefined}
			transition:scale={{ start: 0.97, duration: 130 }}
		>
			{@render children({ close })}
		</div>
	{/if}
</div>

<style>
	.pop-root {
		position: relative;
		display: inline-flex;
	}
	.panel {
		position: absolute;
		z-index: 40;
		top: calc(100% + 6px);
		min-width: 200px;
		max-width: calc(100vw - 24px);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		transform-origin: top;
	}
	.panel.up {
		top: auto;
		bottom: calc(100% + 6px);
		transform-origin: bottom;
	}
	.start {
		left: 0;
	}
	.end {
		right: 0;
	}
</style>
