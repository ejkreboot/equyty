<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from './Icon.svelte';
	import { toast } from '$lib/toast.svelte';

	let { label = 'Refresh', size = '' }: { label?: string; size?: 'sm' | '' } = $props();
	let busy = $state(false);

	async function run() {
		busy = true;
		try {
			const res = await fetch('/api/sync', { method: 'POST' });
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Sync failed');
			await invalidateAll();
			if (body.failed) toast(`${body.failed} connection${body.failed > 1 ? 's' : ''} need attention`, 'error');
			else toast(body.added ? `Synced · ${body.added} new transactions` : 'Everything is up to date', 'success');
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Sync failed', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<button class="btn {size}" onclick={run} disabled={busy} title="Sync all connected accounts">
	<Icon name="sync" size={18} class={busy ? 'spin' : ''} />
	{busy ? 'Syncing…' : label}
</button>
