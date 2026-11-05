<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		title,
		description,
		width = 460,
		children,
		footer
	}: {
		open?: boolean;
		title: string;
		description?: string;
		width?: number;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	style:--w="{width}px"
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
>
	{#if open}
		<div class="body">
			<header>
				<div>
					<h2>{title}</h2>
					{#if description}<p class="muted">{description}</p>{/if}
				</div>
				<button class="btn ghost icon-only sm" aria-label="Close" onclick={() => (open = false)}>
					<Icon name="close" size={18} />
				</button>
			</header>
			<div class="content">{@render children()}</div>
			{#if footer}<footer>{@render footer()}</footer>{/if}
		</div>
	{/if}
</dialog>

<style>
	dialog {
		width: min(var(--w), calc(100vw - 24px));
		max-height: calc(100dvh - 48px);
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow-lg);
		overflow: auto;
	}
	dialog[open] {
		animation: pop 0.2s var(--ease);
	}
	dialog::backdrop {
		background: rgba(10, 10, 9, 0.38);
		backdrop-filter: blur(2px);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.985);
		}
	}
	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding: 20px 20px 0 22px;
	}
	header p {
		margin-top: 4px;
		font-size: 13px;
	}
	.content {
		padding: 18px 22px 22px;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 14px 22px;
		border-top: 1px solid var(--border);
		background: var(--surface-2);
	}
</style>
