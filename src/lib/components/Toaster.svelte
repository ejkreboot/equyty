<script lang="ts">
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import Icon from './Icon.svelte';
	import { toasts, dismiss } from '$lib/toast.svelte';

	const ICON = { info: 'info', success: 'check_circle', error: 'error' } as const;
</script>

<div class="toaster" role="status" aria-live="polite">
	{#each toasts as t (t.id)}
		<div class="toast {t.kind}" in:fly={{ y: 12, duration: 220 }} out:fly={{ y: 8, duration: 160 }} animate:flip={{ duration: 200 }}>
			<Icon name={ICON[t.kind]} size={18} fill />
			<span>{t.message}</span>
			{#if t.action}
				<button
					class="action"
					onclick={() => {
						t.action?.run();
						dismiss(t.id);
					}}>{t.action.label}</button
				>
			{/if}
			<button class="close" aria-label="Dismiss" onclick={() => dismiss(t.id)}><Icon name="close" size={16} /></button>
		</div>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		z-index: 100;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: grid;
		gap: 8px;
		width: min(440px, calc(100vw - 32px));
		pointer-events: none;
	}
	.toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 10px 10px 14px;
		border-radius: 8px;
		background: var(--ink);
		color: var(--ink-inverse);
		box-shadow: var(--shadow-lg);
		font-size: 13.5px;
	}
	.toast span:not(.icon) {
		flex: 1;
	}
	.toast.success :global(.icon:first-child) {
		color: var(--status-good);
	}
	.toast.error :global(.icon:first-child) {
		color: var(--status-critical);
	}
	button {
		border: 0;
		background: transparent;
		color: inherit;
		opacity: 0.75;
		display: grid;
		place-items: center;
		padding: 4px;
		border-radius: 4px;
	}
	button:hover {
		opacity: 1;
	}
	.action {
		font-weight: 600;
		opacity: 1;
		padding: 4px 8px;
	}
</style>
