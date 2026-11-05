<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import Icon from '$lib/components/Icon.svelte';
	import MerchantLogo from '$lib/components/MerchantLogo.svelte';
	import Popover from '$lib/components/Popover.svelte';
	import CategoryPicker from '$lib/components/CategoryPicker.svelte';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import DateRangeMenu from '$lib/components/DateRangeMenu.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PlaidLinkButton from '$lib/components/PlaidLinkButton.svelte';
	import TransactionDetail, { type Txn } from './TransactionDetail.svelte';
	import { catalog } from '$lib/catalog';
	import type { CategoryMeta } from '$lib/finance';
	import { dayHeading, money } from '$lib/format';
	import { normalizeMerchant } from '$lib/merchant';
	import { supabase } from '$lib/supabase/browser';
	import { toast } from '$lib/toast.svelte';

	let { data } = $props();

	const cat = $derived(catalog(data));

	let rows = $state<Txn[]>([]);
	$effect.pre(() => {
		rows = data.transactions.map((t) => ({ ...t }));
	});

	let search = $state('');
	$effect.pre(() => {
		search = data.filters.q;
	});
	let searchInput: HTMLInputElement | undefined = $state();
	let selected = $state(new Set<string>());
	let detailId = $state<string | null>(null);
	let bulkPicker = $state(false);
	let categorizing = $state(false);

	const detail = $derived(rows.find((r) => r.id === detailId) ?? null);

	onMount(() => {
		if (page.url.searchParams.get('focus') === 'search') searchInput?.focus();
	});

	const days = $derived.by(() => {
		const out: { date: string; items: Txn[]; total: number }[] = [];
		for (const t of rows) {
			const last = out.at(-1);
			if (last && last.date === t.date) {
				last.items.push(t);
				if (!t.is_excluded) last.total += t.amount;
			} else out.push({ date: t.date, items: [t], total: t.is_excluded ? 0 : t.amount });
		}
		return out;
	});

	// ---- URL filters --------------------------------------------------------
	function setParams(params: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(params)) {
			if (v === null || v === '') url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		url.searchParams.delete('limit');
		url.searchParams.delete('focus');
		selected = new Set();
		goto(url, { keepFocus: true, noScroll: true, replaceState: true });
	}

	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => setParams({ q: search.trim() }), 280);
	}

	const activeCategory = $derived(
		data.filters.category === 'none' ? 'Uncategorized' : data.filters.category ? (cat.index.get(data.filters.category)?.name ?? 'Category') : null
	);
	const hasFilters = $derived(
		!!(data.filters.q || data.filters.account || data.filters.category || data.filters.review || data.filters.range)
	);

	// ---- Mutations (browser client, constrained by RLS + column grants) -----
	async function updateRows(ids: string[], patch: Partial<Txn>, undoable = true) {
		const before = new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, { ...r }]));
		for (const r of rows) if (ids.includes(r.id)) Object.assign(r, patch);

		const { error } = await supabase()
			.from('transactions')
			.update(patch as never)
			.in('id', ids);
		if (error) {
			for (const r of rows) if (before.has(r.id)) Object.assign(r, before.get(r.id));
			toast('Could not save that change', 'error');
			return false;
		}
		return undoable;
	}

	async function recategorize(t: Txn, c: CategoryMeta) {
		if (t.category_id === c.id && !t.needs_review) return;
		const ok = await updateRows([t.id], { category_id: c.id, category_source: 'user', needs_review: false });
		if (!ok) return;
		const merchant = t.merchant_name ?? t.name;
		toast(`Moved to ${c.name}`, 'success', { label: `Always for ${truncate(merchant, 18)}`, run: () => createRule(t, c) }, 6500);
	}

	async function createRule(t: Txn, c: CategoryMeta) {
		const pattern = normalizeMerchant(t.merchant_name ?? t.name);
		if (pattern.length < 2) return toast('That description is too generic for a rule', 'error');

		const sb = supabase();
		const { error } = await sb
			.from('categorization_rules')
			.upsert({ merchant_pattern: pattern, category_id: c.id }, { onConflict: 'user_id,merchant_pattern' });
		if (error) return toast('Could not save the rule', 'error');

		// Apply to past transactions from the same merchant that you haven't set by hand.
		const column = t.merchant_name ? 'merchant_name' : 'name';
		const { data: updated } = await sb
			.from('transactions')
			.update({ category_id: c.id, category_source: 'rule', needs_review: false })
			.eq(column, t.merchant_name ?? t.name)
			.or('category_source.is.null,category_source.neq.user')
			.select('id');
		await invalidateAll();
		toast(`Rule saved${updated?.length ? ` · ${updated.length} past transaction${updated.length === 1 ? '' : 's'} updated` : ''}`, 'success');
	}

	async function bulkCategorize(c: CategoryMeta) {
		bulkPicker = false;
		const ids = [...selected];
		if (await updateRows(ids, { category_id: c.id, category_source: 'user', needs_review: false })) {
			toast(`${ids.length} transactions moved to ${c.name}`, 'success');
			selected = new Set();
		}
	}

	async function bulkReviewed() {
		const ids = [...selected];
		if (await updateRows(ids, { needs_review: false })) {
			toast(`Marked ${ids.length} as reviewed`, 'success');
			selected = new Set();
			if (data.filters.review) invalidateAll();
		}
	}

	async function autoCategorize() {
		categorizing = true;
		try {
			const res = await fetch('/api/categorize', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({})
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body?.message ?? 'Categorization failed');
			const total = body.byRule + body.byAi + body.byPlaid;
			toast(total ? `Categorized ${total} transaction${total === 1 ? '' : 's'}` : 'Nothing left to categorize', 'success');
			await invalidateAll();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Categorization failed', 'error');
		} finally {
			categorizing = false;
		}
	}

	function toggleSelect(id: string, e?: MouseEvent) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
		e?.stopPropagation();
	}

	const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
	const moreUrl = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.set('limit', String(data.limit + 100));
		return `${url.pathname}${url.search}`;
	});
</script>

<svelte:head><title>Transactions · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="title">
			<h1>Transactions</h1>
			<span class="muted count">{data.total.toLocaleString()} {data.total === 1 ? 'result' : 'results'}</span>
		</div>
		<div class="actions">
			<button class="btn" onclick={autoCategorize} disabled={categorizing} title="Categorize uncategorized transactions with AI">
				<Icon name="auto_awesome" size={18} class={categorizing ? 'spin' : ''} />
				{categorizing ? 'Categorizing…' : 'Auto-categorize'}
			</button>
		</div>
	</header>

	<div class="toolbar">
		<div class="input-group search">
			<Icon name="search" size={18} />
			<input
				bind:this={searchInput}
				class="input"
				type="search"
				placeholder="Search merchants or descriptions"
				bind:value={search}
				oninput={onSearch}
				aria-label="Search transactions"
			/>
		</div>

		<select class="select account" value={data.filters.account ?? ''} onchange={(e) => setParams({ account: e.currentTarget.value })} aria-label="Filter by account">
			<option value="">All accounts</option>
			{#each data.accounts as a (a.id)}
				<option value={a.id}>{a.display_name ?? a.name}{a.mask ? ` ••${a.mask}` : ''}</option>
			{/each}
		</select>

		<Popover width={290}>
			{#snippet trigger({ toggle, open })}
				<button class="btn" class:on={!!activeCategory} onclick={toggle} aria-expanded={open}>
					<Icon name="sell" size={18} />
					{activeCategory ?? 'All categories'}
					<Icon name="expand_more" size={18} />
				</button>
			{/snippet}
			{#snippet children({ close })}
				<div class="quick">
					<button onclick={() => (close(), setParams({ category: null }))}>All categories</button>
					<button onclick={() => (close(), setParams({ category: 'none' }))}>Uncategorized</button>
				</div>
				<CategoryPicker categories={cat.ordered} value={data.filters.category} onselect={(c) => (close(), setParams({ category: c.id }))} />
			{/snippet}
		</Popover>

		<DateRangeMenu range={data.filters.range} allowAll />

		<button class="btn" class:on={data.filters.review} aria-pressed={data.filters.review} onclick={() => setParams({ review: data.filters.review ? null : '1' })}>
			<Icon name="rule" size={18} />
			Needs review
		</button>

		{#if hasFilters}
			<a class="btn ghost" href="/transactions" data-sveltekit-noscroll>Clear</a>
		{/if}
	</div>

	{#if selected.size > 0}
		<div class="bulk card" transition:slide={{ duration: 160 }}>
			<strong>{selected.size} selected</strong>
			<Popover bind:open={bulkPicker} width={290}>
				{#snippet trigger({ toggle })}
					<button class="btn sm" onclick={toggle}><Icon name="sell" size={17} />Set category</button>
				{/snippet}
				{#snippet children()}
					<CategoryPicker categories={cat.ordered} onselect={bulkCategorize} />
				{/snippet}
			</Popover>
			<button class="btn sm" onclick={bulkReviewed}><Icon name="check" size={17} />Mark reviewed</button>
			<button class="btn ghost sm" onclick={() => (selected = new Set())}>Deselect</button>
		</div>
	{/if}

	<div class="layout" class:with-detail={!!detail}>
		<div class="list card">
			{#if rows.length === 0}
				{#if data.items.length === 0}
					<EmptyState icon="account_balance" title="No accounts connected" body="Connect a bank or card to import your transactions.">
						<PlaidLinkButton />
					</EmptyState>
				{:else}
					<EmptyState icon="search" title="No transactions found" body={hasFilters ? 'Try adjusting your search or filters.' : 'New transactions appear here after each sync.'} />
				{/if}
			{:else}
				{#each days as day (day.date)}
					<div class="day">
						<span>{dayHeading(day.date)}</span>
						<span class="num">{money(day.total, { signed: true })}</span>
					</div>
					{#each day.items as t (t.id)}
						{@const c = t.category_id ? cat.index.get(t.category_id) : undefined}
						<div class="row" class:active={detailId === t.id} class:excluded={t.is_excluded} class:selecting={selected.size > 0}>
							<label class="check" aria-label="Select transaction">
								<input type="checkbox" checked={selected.has(t.id)} onclick={(e) => toggleSelect(t.id, e)} />
							</label>
							<button class="main" onclick={() => (detailId = detailId === t.id ? null : t.id)}>
								<MerchantLogo src={t.logo_url} icon={c?.icon ?? 'receipt_long'} slot={c?.group.color_slot ?? -1} />
								<span class="names">
									<span class="merchant">{t.merchant_name ?? t.name}</span>
									<span class="sub muted">
										{cat.accountName(t.account_id)}
										{#if t.pending}<span class="badge">Pending</span>{/if}
										{#if t.notes}<Icon name="notes" size={14} />{/if}
									</span>
								</span>
							</button>

							<Popover width={290} align="end">
								{#snippet trigger({ toggle })}
									<button
										class="chip"
										class:uncat={!c}
										class:review={t.needs_review}
										onclick={toggle}
										title={t.category_source === 'ai' ? `Categorized by AI (${t.ai_confidence ?? 'unknown'} confidence)` : undefined}
									>
										{#if c}
											<CategoryIcon icon={c.icon} slot={c.group.color_slot} size={20} />
											<span>{c.name}</span>
										{:else}
											<Icon name="help" size={17} />
											<span>Uncategorized</span>
										{/if}
										{#if t.category_source === 'ai'}<Icon name="auto_awesome" size={13} class="ai" />{/if}
									</button>
								{/snippet}
								{#snippet children({ close })}
									<CategoryPicker categories={cat.ordered} value={t.category_id} onselect={(cm) => (close(), recategorize(t, cm))} />
								{/snippet}
							</Popover>

							<span class="amount num" class:positive={t.amount > 0}>{money(t.amount, { signed: t.amount > 0 })}</span>
						</div>
					{/each}
				{/each}
				{#if rows.length < data.total}
					<div class="more">
						<a class="btn" href={moreUrl} data-sveltekit-noscroll>Load more</a>
					</div>
				{/if}
			{/if}
		</div>

		{#if detail}
			<div class="detail-col">
				<TransactionDetail
					txn={detail}
					category={detail.category_id ? cat.index.get(detail.category_id) : undefined}
					accountName={cat.accountName(detail.account_id)}
					onclose={() => (detailId = null)}
					categories={cat.ordered}
					onrecategorize={(cm) => recategorize(detail, cm)}
					onsave={async (patch) => {
						if (await updateRows([detail.id], patch)) toast('Saved', 'success');
					}}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.count {
		font-size: 13.5px;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 16px;
	}
	.search {
		flex: 1 1 260px;
	}
	.search .input,
	.account {
		height: 36px;
	}
	.account {
		width: auto;
		max-width: 220px;
		font-size: 13.5px;
		box-shadow: var(--shadow-sm);
		border: 0;
	}
	.btn.on {
		box-shadow: inset 0 0 0 1.5px var(--ink);
	}
	.quick {
		display: flex;
		gap: 6px;
		padding: 10px 12px 0;
	}
	.quick button {
		height: 28px;
		padding: 0 10px;
		border: 0;
		border-radius: 999px;
		background: var(--surface-3);
		font-size: 12.5px;
	}
	.quick button:hover {
		background: var(--border-strong);
	}
	.bulk {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		padding: 10px 14px;
		margin-bottom: 12px;
		font-size: 13.5px;
	}
	.bulk strong {
		margin-right: 8px;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
		align-items: start;
	}
	.layout.with-detail {
		grid-template-columns: minmax(0, 1fr) 360px;
	}
	.detail-col {
		position: sticky;
		top: 16px;
	}
	.list {
		padding-bottom: 6px;
	}
	.list > .day:first-child {
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}
	.day {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		justify-content: space-between;
		padding: 10px 20px;
		background: color-mix(in oklab, var(--surface-2) 92%, transparent);
		backdrop-filter: blur(6px);
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-3);
	}
	.row {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr) auto 110px;
		align-items: center;
		gap: 10px;
		padding: 6px 20px 6px 10px;
		border-bottom: 1px solid var(--border);
		transition: background 0.12s;
	}
	.row:last-of-type {
		border-bottom: 0;
	}
	.row:hover,
	.row.active {
		background: var(--surface-2);
	}
	.row.excluded .names,
	.row.excluded .amount {
		opacity: 0.45;
	}
	.check {
		display: grid;
		place-items: center;
		height: 100%;
		opacity: 0;
		transition: opacity 0.12s;
	}
	.row:hover .check,
	.row.selecting .check,
	.check:focus-within {
		opacity: 1;
	}
	.check input {
		width: 15px;
		height: 15px;
		accent-color: var(--ink);
	}
	.main {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		padding: 4px 0;
		border: 0;
		background: transparent;
		text-align: left;
	}
	.names {
		display: grid;
		min-width: 0;
	}
	.merchant {
		font-weight: 500;
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		white-space: nowrap;
		overflow: hidden;
	}
	.sub .badge {
		height: 18px;
		font-size: 11px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		max-width: 220px;
		height: 30px;
		padding: 0 10px 0 5px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		font-size: 13px;
		color: var(--ink-2);
		transition: background 0.12s;
	}
	.chip span:not(.icon) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip:hover {
		background: var(--surface-3);
		color: var(--ink);
	}
	.chip.uncat {
		padding-left: 9px;
		color: var(--ink-3);
		box-shadow: inset 0 0 0 1px var(--border-strong);
		border-radius: 999px;
	}
	.chip.review {
		box-shadow: inset 0 0 0 1.5px color-mix(in oklab, var(--status-warning) 70%, transparent);
	}
	.chip :global(.ai) {
		color: var(--accent);
	}
	.amount {
		text-align: right;
		font-weight: 600;
		font-size: 14px;
	}
	.more {
		display: flex;
		justify-content: center;
		padding: 16px;
	}
	@media (max-width: 1100px) {
		.layout.with-detail {
			grid-template-columns: minmax(0, 1fr);
		}
		.detail-col {
			position: fixed;
			z-index: 45;
			inset: auto 12px 12px 12px;
			max-height: 80dvh;
		}
	}
	@media (max-width: 640px) {
		.row {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas: 'main amount' 'chip chip';
			padding: 8px 14px;
			row-gap: 2px;
		}
		.check {
			display: none;
		}
		.main {
			grid-area: main;
		}
		.amount {
			grid-area: amount;
		}
		.row :global(.pop-root) {
			grid-area: chip;
			margin-left: 38px;
		}
		.account {
			max-width: none;
			flex: 1;
		}
	}
</style>
