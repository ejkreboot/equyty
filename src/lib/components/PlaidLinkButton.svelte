<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from './Icon.svelte';
	import { toast } from '$lib/toast.svelte';
	import { openLink, completeLink } from '$lib/plaid-link';

	let {
		itemId,
		label = 'Connect account',
		variant = 'primary',
		size = ''
	}: { itemId?: string; label?: string; variant?: 'primary' | 'accent' | '' | 'ghost'; size?: 'sm' | '' } = $props();

	let busy = $state<'idle' | 'opening' | 'syncing'>('idle');

	async function start() {
		busy = 'opening';
		try {
			const res = await fetch('/api/plaid/link-token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ itemId: itemId ?? null })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Could not start Plaid Link');

			const pending = { token: body.link_token as string, itemId };
			const result = await openLink(pending);
			if ('exited' in result) {
				if (result.error) toast(result.error.display_message ?? result.error.error_message, 'error');
				return;
			}

			busy = 'syncing';
			const summary = await completeLink(pending, result.publicToken, result.metadata);
			await invalidateAll();
			toast(
				itemId
					? 'Connection repaired and synced'
					: `Connected ${result.metadata.institution?.name ?? 'your account'}${summary?.added ? ` · ${summary.added} transactions imported` : ''}`,
				'success'
			);
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Something went wrong', 'error');
		} finally {
			busy = 'idle';
		}
	}
</script>

<button class="btn {variant} {size}" onclick={start} disabled={busy !== 'idle'}>
	{#if busy === 'idle'}
		<Icon name={itemId ? 'link' : 'add'} size={18} />
		{label}
	{:else}
		<Icon name="sync" size={18} class="spin" />
		{busy === 'opening' ? 'Opening…' : 'Importing…'}
	{/if}
</button>
