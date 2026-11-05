<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		icon,
		title,
		body,
		children
	}: { icon: string; title: string; body?: string; children?: Snippet } = $props();
</script>

<div class="empty">
	<div class="halo"><Icon name={icon} size={26} /></div>
	<h3>{title}</h3>
	{#if body}<p class="muted">{body}</p>{/if}
	{#if children}<div class="actions">{@render children()}</div>{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 8px;
		padding: 56px 24px;
	}
	.halo {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		margin-bottom: 6px;
		border-radius: 8px;
		background: var(--surface-3);
		color: var(--ink-2);
	}
	h3 {
		font-size: 15px;
	}
	p {
		max-width: 380px;
		font-size: 13.5px;
	}
	.actions {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}
</style>
