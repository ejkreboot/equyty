<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Popover from '$lib/components/Popover.svelte';
	import IconPicker from '$lib/components/IconPicker.svelte';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import ConnectionList from '$lib/components/ConnectionList.svelte';
	import PlaidLinkButton from '$lib/components/PlaidLinkButton.svelte';
	import { catalog } from '$lib/catalog';
	import { slotColor, type CategoryMeta } from '$lib/finance';
	import { supabase } from '$lib/supabase/browser';
	import { toast } from '$lib/toast.svelte';
	import type { CategoryKind } from '$lib/supabase/database.types';

	let { data, form } = $props();

	const cat = $derived(catalog(data));
	const accountCounts = $derived(new Map(data.items.map((i) => [i.id, data.accounts.filter((a) => a.item_id === i.id).length])));
	const KIND_LABEL: Record<CategoryKind, string> = { income: 'Income', expense: 'Expense', transfer: 'Transfer (excluded from totals)' };

	$effect(() => {
		if (form?.profileSaved) toast('Profile saved', 'success');
	});

	const refresh = () => invalidate('app:catalog');

	// ---- categories ----
	let drafts = $state<Record<string, string>>({});

	async function addCategory(groupId: string) {
		const name = (drafts[groupId] ?? '').trim();
		if (!name) return;
		const { error } = await supabase()
			.from('categories')
			.insert({ group_id: groupId, name, icon: 'category', sort_order: 100 });
		if (error) return toast(error.code === '23505' ? 'A category with that name already exists' : 'Could not add the category', 'error');
		drafts[groupId] = '';
		await refresh();
	}

	async function renameCategory(c: CategoryMeta, name: string) {
		name = name.trim();
		if (!name || name === c.name) return;
		const { error } = await supabase().from('categories').update({ name }).eq('id', c.id);
		if (error) toast(error.code === '23505' ? 'That name is already in use' : 'Could not rename', 'error');
		await refresh();
	}

	async function setIcon(c: CategoryMeta, icon: string) {
		const { error } = await supabase().from('categories').update({ icon }).eq('id', c.id);
		if (error) return toast('Could not update the icon', 'error');
		await refresh();
	}

	let deleting = $state<CategoryMeta | null>(null);
	let deleteOpen = $state(false);
	async function deleteCategory() {
		if (!deleting) return;
		const { error } = await supabase().from('categories').delete().eq('id', deleting.id);
		deleteOpen = false;
		if (error) return toast('Could not delete the category', 'error');
		toast(`Deleted ${deleting.name}. Its transactions are now uncategorized.`, 'success');
		await refresh();
	}

	// ---- groups ----
	let groupOpen = $state(false);
	let groupForm = $state({ name: '', kind: 'expense' as CategoryKind, slot: 0 });
	async function addGroup(e: SubmitEvent) {
		e.preventDefault();
		if (!groupForm.name.trim()) return;
		const { error } = await supabase()
			.from('category_groups')
			.insert({ name: groupForm.name.trim(), kind: groupForm.kind, color_slot: groupForm.slot, sort_order: data.groups.length + 1 });
		if (error) return toast(error.code === '23505' ? 'A group with that name exists' : 'Could not add the group', 'error');
		groupOpen = false;
		groupForm = { name: '', kind: 'expense', slot: 0 };
		await refresh();
	}

	async function setGroupColor(groupId: string, slot: number) {
		const { error } = await supabase().from('category_groups').update({ color_slot: slot }).eq('id', groupId);
		if (error) return toast('Could not update the color', 'error');
		await refresh();
	}

	// ---- rules ----
	async function deleteRule(id: string) {
		const { error } = await supabase().from('categorization_rules').delete().eq('id', id);
		if (error) return toast('Could not delete the rule', 'error');
		await invalidate('app:rules');
		toast('Rule removed', 'success');
	}
</script>

<svelte:head><title>Settings · Equyty</title></svelte:head>

<div class="page narrow">
	<header class="page-header">
		<div class="title"><h1>Settings</h1></div>
	</header>

	<nav class="jump" aria-label="Settings sections">
		<a href="#profile">Profile</a><a href="#connections">Connections</a><a href="#categories">Categories</a><a href="#rules">Rules</a><a href="#security">Security</a>
	</nav>

	<section class="card block" id="profile">
		<div class="block-head"><h2>Profile</h2><p class="muted">How Equyty greets you.</p></div>
		<form method="POST" action="?/profile" use:enhance={() => async ({ update }) => update({ reset: false })} class="row-form">
			<label class="field grow"><span>Display name</span><input class="input" name="display_name" value={data.displayName ?? ''} maxlength="80" /></label>
			<label class="field grow"><span>Email</span><input class="input" value={data.email} disabled /></label>
			<button class="btn primary">Save</button>
		</form>
	</section>

	<section class="card block" id="connections">
		<div class="block-head row">
			<div><h2>Connections</h2><p class="muted">Institutions linked through Plaid (read-only).</p></div>
			<PlaidLinkButton label="Add" size="sm" variant="" />
		</div>
		{#if data.items.length}
			<div class="flush"><ConnectionList items={data.items} {accountCounts} /></div>
		{:else}
			<p class="muted">No institutions connected yet.</p>
		{/if}
	</section>

	<section class="card block" id="categories">
		<div class="block-head row">
			<div><h2>Categories</h2><p class="muted">Rename, re-icon or add categories. The AI uses exactly this list.</p></div>
			<button class="btn sm" onclick={() => (groupOpen = true)}><Icon name="add" size={17} />Group</button>
		</div>
		<div class="groups">
			{#each data.groups as g (g.id)}
				<div class="group">
					<div class="g-head">
						<Popover width={180}>
							{#snippet trigger({ toggle })}
								<button class="swatch" style:background={slotColor(g.color_slot)} aria-label="Change {g.name} color" onclick={toggle}></button>
							{/snippet}
							{#snippet children({ close })}
								<div class="colors">
									{#each [0, 1, 2, 3, 4, 5, 6, 7] as slot (slot)}
										<button aria-label="Color {slot + 1}" style:background={slotColor(slot)} class:on={g.color_slot === slot} onclick={() => (close(), setGroupColor(g.id, slot))}></button>
									{/each}
								</div>
							{/snippet}
						</Popover>
						<strong>{g.name}</strong>
						<span class="badge">{KIND_LABEL[g.kind]}</span>
					</div>
					<ul>
						{#each cat.ordered.filter((c) => c.group.id === g.id) as c (c.id)}
							<li>
								<Popover width={340}>
									{#snippet trigger({ toggle })}
										<button class="icon-btn" onclick={toggle} aria-label="Change icon for {c.name}"><CategoryIcon icon={c.icon} slot={g.color_slot} size={30} /></button>
									{/snippet}
									{#snippet children({ close })}
										<IconPicker value={c.icon} onselect={(ic) => (close(), setIcon(c, ic))} />
									{/snippet}
								</Popover>
								<input
									class="inline"
									value={c.name}
									aria-label="Category name"
									maxlength="60"
									onchange={(e) => renameCategory(c, e.currentTarget.value)}
									onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
								/>
								<button class="btn ghost icon-only sm" aria-label="Delete {c.name}" onclick={() => ((deleting = c), (deleteOpen = true))}><Icon name="delete" size={18} /></button>
							</li>
						{/each}
						<li class="add">
							<span class="plus"><Icon name="add" size={18} /></span>
							<input
								class="inline"
								placeholder="Add a category"
								bind:value={drafts[g.id]}
								maxlength="60"
								onkeydown={(e) => e.key === 'Enter' && addCategory(g.id)}
								aria-label="New category in {g.name}"
							/>
							{#if drafts[g.id]?.trim()}<button class="btn sm" onclick={() => addCategory(g.id)}>Add</button>{/if}
						</li>
					</ul>
				</div>
			{/each}
		</div>
	</section>

	<section class="card block" id="rules">
		<div class="block-head">
			<h2>Rules</h2>
			<p class="muted">Created when you choose “Always for…” after recategorizing. Rules run before AI on every new transaction.</p>
		</div>
		{#if data.rules.length}
			<ul class="rules">
				{#each data.rules as r (r.id)}
					{@const c = cat.index.get(r.category_id)}
					<li>
						<span class="pattern">Merchant contains <code>{r.merchant_pattern}</code></span>
						<Icon name="arrow_forward" size={16} class="muted" />
						{#if c}<span class="to"><CategoryIcon icon={c.icon} slot={c.group.color_slot} size={24} />{c.name}</span>{/if}
						<button class="btn ghost icon-only sm" aria-label="Delete rule" onclick={() => deleteRule(r.id)}><Icon name="delete" size={18} /></button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">No rules yet.</p>
		{/if}
	</section>

	<section class="card block" id="security">
		<div class="block-head"><h2>Security</h2></div>
		<ul class="security">
			<li><Icon name="lock" size={20} /><span>Bank credentials are handled entirely by Plaid and never touch our servers.</span></li>
			<li><Icon name="lock" size={20} /><span>Plaid access tokens are encrypted (AES-256-GCM) and readable only by server code.</span></li>
			<li><Icon name="lock" size={20} /><span>Every row of your data is protected by Postgres row-level security.</span></li>
		</ul>
		<div class="sec-actions">
			<a class="btn" href="/settings/password"><Icon name="lock" size={18} />Change password</a>
			<form method="POST" action="/auth/signout"><button class="btn ghost"><Icon name="logout" size={18} />Sign out</button></form>
		</div>
	</section>
</div>

<Modal bind:open={deleteOpen} title="Delete {deleting?.name}?" description="Transactions in this category become uncategorized. Budgets and rules for it are removed.">
	{#snippet children()}<p class="secondary">You can re-run Auto-categorize afterwards to sort them again.</p>{/snippet}
	{#snippet footer()}
		<button class="btn" onclick={() => (deleteOpen = false)}>Cancel</button>
		<button class="btn danger solid" onclick={deleteCategory}>Delete</button>
	{/snippet}
</Modal>

<Modal bind:open={groupOpen} title="New category group" width={420}>
	<form id="group-form" class="gform" onsubmit={addGroup}>
		<label class="field"><span>Name</span><input class="input" bind:value={groupForm.name} maxlength="60" required /></label>
		<label class="field">
			<span>Type</span>
			<select class="select" bind:value={groupForm.kind}>
				<option value="expense">Expense</option>
				<option value="income">Income</option>
				<option value="transfer">Transfer (excluded from totals)</option>
			</select>
		</label>
		<div class="field">
			<span>Color</span>
			<div class="colors inline-colors">
				{#each [0, 1, 2, 3, 4, 5, 6, 7] as slot (slot)}
					<button type="button" aria-label="Color {slot + 1}" style:background={slotColor(slot)} class:on={groupForm.slot === slot} onclick={() => (groupForm.slot = slot)}></button>
				{/each}
			</div>
		</div>
	</form>
	{#snippet footer()}
		<button class="btn" onclick={() => (groupOpen = false)}>Cancel</button>
		<button class="btn primary" form="group-form">Create group</button>
	{/snippet}
</Modal>

<style>
	.narrow {
		max-width: 880px;
	}
	.jump {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.jump a {
		padding: 6px 12px;
		border-radius: 999px;
		font-size: 13px;
		color: var(--ink-2);
	}
	.jump a:hover {
		background: var(--surface-3);
		color: var(--ink);
	}
	.block {
		padding: 22px;
		margin-bottom: 16px;
		scroll-margin-top: 16px;
	}
	.block-head {
		margin-bottom: 16px;
	}
	.block-head p {
		margin-top: 2px;
		font-size: 13px;
	}
	.block-head.row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.row-form {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		flex-wrap: wrap;
	}
	.grow {
		flex: 1 1 220px;
	}
	.flush {
		margin: 0 -22px -22px;
		border-top: 1px solid var(--border);
	}
	.groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}
	.group {
		padding: 12px;
		border-radius: 8px;
		background: var(--surface-2);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.g-head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 2px 4px 8px;
	}
	.g-head .badge {
		margin-left: auto;
		font-size: 11px;
	}
	.swatch {
		width: 14px;
		height: 14px;
		border: 0;
		border-radius: 4px;
	}
	.group ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.group li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 0;
	}
	.icon-btn {
		border: 0;
		padding: 0;
		background: transparent;
		border-radius: 5px;
	}
	.inline {
		flex: 1;
		min-width: 0;
		height: 32px;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: 5px;
		background: transparent;
		font-size: 13.5px;
	}
	.inline:hover {
		border-color: var(--border-strong);
	}
	.inline:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--surface);
	}
	.add .plus {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 5px;
		border: 1.5px dashed var(--border-strong);
		color: var(--ink-3);
	}
	.colors {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		padding: 12px;
	}
	.colors button {
		width: 28px;
		height: 28px;
		border: 0;
		border-radius: 50%;
	}
	.colors button.on {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--ink);
	}
	.inline-colors {
		display: flex;
		padding: 0;
	}
	.rules {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rules li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
		font-size: 13.5px;
	}
	.rules li:last-child {
		border-bottom: 0;
	}
	.pattern {
		color: var(--ink-2);
	}
	code {
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--surface-3);
		color: var(--ink);
		font-size: 12.5px;
	}
	.to {
		flex: 1;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
	}
	.security {
		list-style: none;
		margin: 0 0 18px;
		padding: 0;
		display: grid;
		gap: 10px;
		font-size: 13.5px;
		color: var(--ink-2);
	}
	.security li {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.security :global(.icon) {
		color: var(--positive);
	}
	.sec-actions {
		display: flex;
		gap: 8px;
	}
	.sec-actions form {
		margin: 0;
	}
	.gform {
		display: grid;
		gap: 16px;
	}
	@media (max-width: 720px) {
		.groups {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
