<script lang="ts">
	import CategoryIcon from './CategoryIcon.svelte';

	let {
		src,
		icon = 'receipt_long',
		slot = -1,
		size = 34
	}: { src: string | null; icon?: string; slot?: number; size?: number } = $props();

	// Remember which URL failed, so a new src automatically gets a fresh try.
	let failedSrc = $state<string | null>(null);
	const failed = $derived(!!src && failedSrc === src);

	// An image that 404s during SSR fails before hydration attaches onerror.
	function detectEarlyFailure(node: HTMLImageElement) {
		if (node.complete && node.naturalWidth === 0) failedSrc = node.getAttribute('src');
	}
</script>

{#if src && !failed}
	<img
		{src}
		alt=""
		width={size}
		height={size}
		loading="lazy"
		referrerpolicy="no-referrer"
		style:border-radius="{Math.round(size * 0.2)}px"
		use:detectEarlyFailure
		onerror={() => (failedSrc = src)}
	/>
{:else}
	<CategoryIcon {icon} {slot} {size} />
{/if}

<style>
	img {
		flex: none;
		object-fit: cover;
		background: var(--surface-3);
		box-shadow: 0 0 0 1px var(--border);
	}
</style>
