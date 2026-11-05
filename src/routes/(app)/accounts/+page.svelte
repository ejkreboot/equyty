<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import Popover from '$lib/components/Popover.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PlaidLinkButton from '$lib/components/PlaidLinkButton.svelte';
	import SyncButton from '$lib/components/SyncButton.svelte';
	import ConnectionList from '$lib/components/ConnectionList.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import { invalidate } from '$app/navigation';
	import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS, isLiability } from '$lib/finance';
	import { parseDate } from '$lib/dates';
	import { money, relativeTime, titleCase } from '$lib/format';
	import { supabase } from '$lib/supabase/browser';
	import { toast } from '$lib/toast.svelte';

	let { data } = $props();

	type Account = (typeof data.accounts)[number];

	const ORDER = ['depository', 'credit', 'investment', 'loan', 'other'];
	const groups = $derived(
		ORDER.map((type) => {
			const list = data.accounts.filter((a) => (ORDER.includes(a.type) ? a.type : 'other') === type);
			const total = list.filter((a) => !a.is_hidden).reduce((s, a) => s + (a.current_balance ?? 0), 0);
			return { type, list, total };
		}).filter((g) => g.list.length)
	);

	const visible = $derived(data.accounts.filter((a) => !a.is_hidden));
	const assets = $derived(visible.filter((a) => !isLiability(a.type)).reduce((s, a) => s + (a.current_balance ?? 0), 0));
	const liabilities = $derived(visible.filter((a) => isLiability(a.type)).reduce((s, a) => s + (a.current_balance ?? 0), 0));
	const points = $derived(data.history.map((p) => ({ x: parseDate(p.day).getTime(), y: Number(p.assets) - Number(p.liabilities) })));
	const accountCounts = $derived(new Map(data.items.map((i) => [i.id, data.accounts.filter((a) => a.item_id === i.id).length])));
	const itemName = (id: string) => data.items.find((i) => i.id === id)?.institution_name ?? '';

	let renaming = $state<Account | null>(null);
	let renameOpen = $state(false);
	let newName = $state('');

	async function save(a: Account, patch: { display_name?: string | null; is_hidden?: boolean }) {
		const { error } = await supabase().from('accounts').update(patch).eq('id', a.id);
		if (error) return toast('Could not update the account', 'error');
		await invalidate('app:catalog');
		toast(patch.is_hidden !== undefined ? (patch.is_hidden ? 'Account hidden from totals' : 'Account visible again') : 'Account renamed', 'success');
	}
</script>

<svelte:head><title>Accounts · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="title"><h1>Accounts</h1></div>
		<div class="actions">
			{#if data.items.length}<SyncButton label="Refresh all" />{/if}
			<PlaidLinkButton label="Add account" />
		</div>
	</header>

	{#if data.accounts.length === 0}
		<section class="card">
			<EmptyState icon="account_balance" title="No accounts yet" body="Connect your bank, credit cards, loans and investment accounts to see your full net worth.">
				<PlaidLinkButton label="Connect an account" variant="accent" />
			</EmptyState>
		</section>
	{:else}
		<section class="card summary">
			<div class="nw">
				<span class="eyebrow">Net worth</span>
				<div class="figure">{money(assets - liabilities, { cents: false })}</div>
				<div class="bar" aria-hidden="true">
					<span class="a" style:flex={Math.max(assets, 1)}></span>
					<span class="l" style:flex={Math.max(liabilities, 0.0001)}></span>
				</div>
				<div class="al">
					<span><i class="dot a"></i>Assets <b class="num">{money(assets, { cents: false })}</b></span>
					<span><i class="dot l"></i>Liabilities <b class="num">{money(liabilities, { cents: false })}</b></span>
				</div>
			</div>
			<div class="trend">
				{#if points.length > 1}
					<LineChart
						height={180}
						series={[{ key: 'nw', label: 'Net worth', color: 'var(--series-1)', points, area: true }]}
						xFormat={(x) => new Date(x).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
						zeroBaseline={false}
					/>
				{:else}
					<p class="muted">Net worth history starts building after your first daily syncs.</p>
				{/if}
			</div>
		</section>

		<div class="columns">
			<div class="groups">
				{#each groups as g (g.type)}
					<section class="card">
						<div class="g-head">
							<span class="g-title"><Icon name={ACCOUNT_TYPE_ICONS[g.type]} size={20} />{ACCOUNT_TYPE_LABELS[g.type]}</span>
							<span class="num g-total">{money(isLiability(g.type) ? -g.total : g.total)}</span>
						</div>
						<ul>
							{#each g.list as a (a.id)}
								<li class:hidden-acct={a.is_hidden}>
									<div class="a-meta">
										<strong>{a.display_name ?? a.name}{#if a.mask}<span class="mask">&nbsp;••{a.mask}</span>{/if}</strong>
										<span class="muted">{itemName(a.item_id)}{a.subtype ? ` · ${titleCase(a.subtype)}` : ''} · {relativeTime(a.updated_at)}</span>
									</div>
									<div class="a-bal">
										<span class="num">{money(isLiability(a.type) ? -(a.current_balance ?? 0) : a.current_balance)}</span>
										{#if a.type === 'credit' && a.credit_limit}
											<span class="muted util">{Math.round(((a.current_balance ?? 0) / a.credit_limit) * 100)}% of {money(a.credit_limit, { cents: false })}</span>
										{:else if a.available_balance !== null && a.available_balance !== a.current_balance && a.type === 'depository'}
											<span class="muted util">{money(a.available_balance)} available</span>
										{/if}
									</div>
									<Popover align="end" width={200}>
										{#snippet trigger({ toggle })}
											<button class="btn ghost icon-only sm" aria-label="Account options" onclick={toggle}><Icon name="more_horiz" size={19} /></button>
										{/snippet}
										{#snippet children({ close })}
											<div class="menu">
												<button onclick={() => (close(), (renaming = a), (newName = a.display_name ?? a.name), (renameOpen = true))}><Icon name="edit" size={17} />Rename</button>
												<button onclick={() => (close(), save(a, { is_hidden: !a.is_hidden }))}>
													<Icon name={a.is_hidden ? 'visibility' : 'visibility_off'} size={17} />{a.is_hidden ? 'Show in totals' : 'Hide from totals'}
												</button>
												<a href="/transactions?account={a.id}"><Icon name="receipt_long" size={17} />Transactions</a>
											</div>
										{/snippet}
									</Popover>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>

			<section class="card connections">
				<div class="card-header"><h2>Connections</h2></div>
				<div class="conn-wrap">
					<ConnectionList items={data.items} {accountCounts} />
				</div>
			</section>
		</div>
	{/if}
</div>

<Modal bind:open={renameOpen} title="Rename account" width={400}>
	<form
		id="rename"
		onsubmit={(e) => {
			e.preventDefault();
			if (renaming) save(renaming, { display_name: newName.trim() || null });
			renameOpen = false;
		}}
	>
		<label class="field"><span>Display name</span><input class="input" bind:value={newName} maxlength="80" /></label>
	</form>
	{#snippet footer()}
		<button class="btn" onclick={() => (renameOpen = false)}>Cancel</button>
		<button class="btn primary" form="rename">Save</button>
	{/snippet}
</Modal>

<style>
	.summary {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.6fr);
		gap: 24px;
		padding: 22px;
		align-items: center;
	}
	.figure {
		font-size: 38px;
		font-weight: 600;
		letter-spacing: -0.035em;
		margin: 4px 0 16px;
	}
	.bar {
		display: flex;
		gap: 2px;
		height: 10px;
		border-radius: 999px;
		overflow: hidden;
	}
	.bar .a,
	.dot.a {
		background: var(--series-1);
	}
	.bar .l,
	.dot.l {
		background: var(--series-2);
	}
	.al {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 20px;
		margin-top: 12px;
		font-size: 13px;
		color: var(--ink-2);
	}
	.al b {
		color: var(--ink);
		margin-left: 4px;
	}
	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		margin-right: 6px;
	}
	.trend p {
		font-size: 13px;
	}
	.columns {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr);
		gap: 16px;
		margin-top: 16px;
		align-items: start;
	}
	.groups {
		display: grid;
		gap: 16px;
	}
	.g-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px 10px;
	}
	.g-title {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
	}
	.g-title :global(.icon) {
		color: var(--ink-3);
	}
	.g-total {
		font-weight: 600;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0 8px 8px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 6px;
	}
	li:hover {
		background: var(--surface-2);
	}
	.hidden-acct {
		opacity: 0.5;
	}
	.a-meta {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.a-meta strong {
		font-weight: 500;
		font-size: 14px;
	}
	.mask {
		color: var(--ink-3);
		font-weight: 400;
	}
	.a-meta .muted {
		font-size: 12.5px;
	}
	.a-bal {
		display: grid;
		justify-items: end;
		font-weight: 600;
	}
	.util {
		font-size: 12px;
		font-weight: 400;
	}
	.menu {
		padding: 6px;
	}
	.menu button,
	.menu a {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 34px;
		padding: 0 10px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		font-size: 13.5px;
		text-align: left;
	}
	.menu button:hover,
	.menu a:hover {
		background: var(--surface-3);
	}
	.conn-wrap {
		padding: 8px 0 4px;
	}
	@media (max-width: 1000px) {
		.summary,
		.columns {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
