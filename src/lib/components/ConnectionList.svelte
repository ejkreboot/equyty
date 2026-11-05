<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
	import PlaidLinkButton from './PlaidLinkButton.svelte';
	import { relativeTime } from '$lib/format';
	import { toast } from '$lib/toast.svelte';
	import type { ItemStatus } from '$lib/supabase/database.types';

	type Item = {
		id: string;
		institution_name: string | null;
		institution_color: string | null;
		status: ItemStatus;
		error_code: string | null;
		last_synced_at: string | null;
	};

	let { items, accountCounts }: { items: Item[]; accountCounts: Map<string, number> } = $props();

	let syncing = $state<string | null>(null);
	let removing = $state<Item | null>(null);
	let confirmOpen = $state(false);
	let removeBusy = $state(false);

	const STATUS: Record<ItemStatus, { label: string; tone: string; icon: string }> = {
		good: { label: 'Connected', tone: 'positive', icon: 'check_circle' },
		login_required: { label: 'Reconnect needed', tone: 'negative', icon: 'error' },
		pending_expiration: { label: 'Expiring soon', tone: 'accent', icon: 'warning' },
		error: { label: 'Sync error', tone: 'negative', icon: 'error' },
		revoked: { label: 'Access revoked', tone: 'negative', icon: 'link_off' }
	};

	async function sync(item: Item) {
		syncing = item.id;
		try {
			const res = await fetch(`/api/plaid/items/${item.id}/sync`, { method: 'POST' });
			const body = await res.json().catch(() => null);
			if (!res.ok || body?.error) throw new Error(body?.error ?? body?.message ?? 'Sync failed');
			await invalidateAll();
			toast(body.added ? `${body.added} new transactions` : `${item.institution_name ?? 'Account'} is up to date`, 'success');
		} catch (err) {
			await invalidateAll();
			toast(err instanceof Error ? err.message : 'Sync failed', 'error');
		} finally {
			syncing = null;
		}
	}

	async function remove() {
		if (!removing) return;
		removeBusy = true;
		const res = await fetch(`/api/plaid/items/${removing.id}`, { method: 'DELETE' });
		removeBusy = false;
		if (!res.ok) return toast('Could not disconnect', 'error');
		toast(`${removing.institution_name ?? 'Institution'} disconnected`, 'success');
		confirmOpen = false;
		removing = null;
		await invalidateAll();
	}
</script>

<ul class="connections">
	{#each items as item (item.id)}
		{@const st = STATUS[item.status]}
		<li>
			<span class="inst" style:--c={item.institution_color ?? 'var(--ink-2)'}>{(item.institution_name ?? '?').slice(0, 1)}</span>
			<div class="meta">
				<strong>{item.institution_name ?? 'Institution'}</strong>
				<span class="muted">
					{accountCounts.get(item.id) ?? 0} account{accountCounts.get(item.id) === 1 ? '' : 's'} · synced {relativeTime(item.last_synced_at)}
				</span>
			</div>
			<span class="badge {st.tone}"><Icon name={st.icon} size={14} fill />{st.label}</span>
			<div class="acts">
				{#if item.status === 'login_required' || item.status === 'pending_expiration'}
					<PlaidLinkButton itemId={item.id} label="Reconnect" variant="accent" size="sm" />
				{:else}
					<button class="btn sm" onclick={() => sync(item)} disabled={syncing === item.id}>
						<Icon name="sync" size={17} class={syncing === item.id ? 'spin' : ''} />Sync
					</button>
				{/if}
				<button class="btn ghost danger sm" aria-label="Disconnect {item.institution_name ?? 'institution'}" onclick={() => ((removing = item), (confirmOpen = true))}>
					<Icon name="link_off" size={17} />Disconnect
				</button>
			</div>
		</li>
	{/each}
</ul>

<Modal bind:open={confirmOpen} title="Disconnect {removing?.institution_name ?? 'institution'}?" description="This revokes Equyty’s access at Plaid and permanently deletes its data here.">
	{@const n = removing ? (accountCounts.get(removing.id) ?? 0) : 0}
	<p class="secondary">
		{n} account{n === 1 ? '' : 's'} and all of {n === 1 ? 'its' : 'their'} transactions, balance history, holdings and recurring bills will be deleted. Budgets,
		goals, categories and rules are kept.
	</p>
	<p class="muted hint">To use this bank again later, connect it as a new account.</p>
	{#snippet footer()}
		<button class="btn" onclick={() => (confirmOpen = false)}>Cancel</button>
		<button class="btn danger solid" onclick={remove} disabled={removeBusy}>{removeBusy ? 'Disconnecting…' : 'Disconnect'}</button>
	{/snippet}
</Modal>

<style>
	.connections {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 20px;
		border-top: 1px solid var(--border);
		flex-wrap: wrap;
	}
	li:first-child {
		border-top: 0;
	}
	.inst {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 6px;
		background: color-mix(in oklab, var(--c) 16%, var(--surface));
		color: color-mix(in oklab, var(--c) 70%, var(--ink));
		font-weight: 700;
	}
	.meta {
		flex: 1;
		min-width: 160px;
		display: grid;
	}
	.meta .muted {
		font-size: 12.5px;
	}
	.acts {
		display: flex;
		gap: 6px;
	}
	.hint {
		margin-top: 8px;
		font-size: 12.5px;
	}
</style>
