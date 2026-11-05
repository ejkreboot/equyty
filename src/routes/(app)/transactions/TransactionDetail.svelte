<script lang="ts" module>
	export interface Txn {
		id: string;
		date: string;
		name: string;
		merchant_name: string | null;
		amount: number;
		category_id: string | null;
		category_source: string | null;
		ai_confidence: string | null;
		needs_review: boolean;
		account_id: string;
		pending: boolean;
		logo_url: string | null;
		notes: string | null;
		is_excluded: boolean;
		plaid_category_detailed: string | null;
		payment_channel: string | null;
		website: string | null;
	}
</script>

<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import MerchantLogo from '$lib/components/MerchantLogo.svelte';
	import Popover from '$lib/components/Popover.svelte';
	import CategoryPicker from '$lib/components/CategoryPicker.svelte';
	import type { CategoryMeta } from '$lib/finance';
	import { longDate, money, titleCase } from '$lib/format';


	let {
		txn,
		category,
		accountName,
		onclose,
		onsave,
		categories,
		onrecategorize
	}: {
		txn: Txn;
		category: CategoryMeta | undefined;
		accountName: string;
		onclose: () => void;
		onsave: (patch: { notes?: string | null; is_excluded?: boolean }) => void;
		categories: CategoryMeta[];
		onrecategorize: (c: CategoryMeta) => void;
	} = $props();

	let notes = $state('');
	$effect(() => {
		notes = txn.notes ?? '';
	});

	const SOURCE: Record<string, string> = {
		ai: 'Categorized by AI',
		rule: 'Matched one of your rules',
		plaid: 'Bank-provided category',
		user: 'Set by you'
	};
</script>

<aside class="detail" aria-label="Transaction details">
	<header>
		<button class="btn ghost icon-only sm" aria-label="Close details" onclick={onclose}><Icon name="close" size={19} /></button>
	</header>
	<div class="top">
		<MerchantLogo src={txn.logo_url} icon={category?.icon ?? 'receipt_long'} slot={category?.group.color_slot ?? -1} size={48} />
		<h2>{txn.merchant_name ?? txn.name}</h2>
		<div class="amount num" class:positive={txn.amount > 0}>{money(txn.amount, { signed: txn.amount > 0 })}</div>
		<div class="muted">{longDate(txn.date)}{txn.pending ? ' · Pending' : ''}</div>
	</div>

	<div class="section">
		<span class="eyebrow">Category</span>
		<Popover width={290}>
			{#snippet trigger({ toggle, open })}
				<button class="cat-btn" onclick={toggle} aria-expanded={open}>
					<span>{category?.name ?? 'Uncategorized'}</span>
					<Icon name="expand_more" size={18} />
				</button>
			{/snippet}
			{#snippet children({ close })}
				<CategoryPicker {categories} value={txn.category_id} onselect={(c) => (close(), onrecategorize(c))} />
			{/snippet}
		</Popover>
		{#if txn.category_source}
			<p class="source muted">
				{#if txn.category_source === 'ai'}<Icon name="auto_awesome" size={14} />{/if}
				{SOURCE[txn.category_source]}{txn.category_source === 'ai' && txn.ai_confidence ? ` · ${txn.ai_confidence} confidence` : ''}
			</p>
		{/if}
	</div>

	<div class="section">
		<label class="field">
			<span class="eyebrow">Notes</span>
			<textarea class="textarea" bind:value={notes} maxlength="1000" placeholder="Add a note…" onblur={() => notes !== (txn.notes ?? '') && onsave({ notes: notes || null })}></textarea>
		</label>
	</div>

	<label class="toggle">
		<div>
			<strong>Exclude from reports</strong>
			<p class="muted">Hide from budgets, cash flow and reports.</p>
		</div>
		<input type="checkbox" class="switch" checked={txn.is_excluded} onchange={(e) => onsave({ is_excluded: e.currentTarget.checked })} />
	</label>

	<dl>
		<dt>Account</dt>
		<dd>{accountName}</dd>
		<dt>Description</dt>
		<dd>{txn.name}</dd>
		{#if txn.plaid_category_detailed}<dt>Bank category</dt><dd>{titleCase(txn.plaid_category_detailed)}</dd>{/if}
		{#if txn.payment_channel}<dt>Channel</dt><dd>{titleCase(txn.payment_channel)}</dd>{/if}
		{#if txn.website}<dt>Website</dt><dd>{txn.website}</dd>{/if}
	</dl>
</aside>

<style>
	.detail {
		position: sticky;
		top: 16px;
		display: grid;
		gap: 18px;
		padding: 12px 20px 22px;
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-md);
		max-height: calc(100dvh - 32px);
		overflow-y: auto;
	}
	header {
		display: flex;
		justify-content: flex-end;
		margin-bottom: -18px;
	}
	.top {
		display: grid;
		justify-items: center;
		gap: 6px;
		text-align: center;
	}
	.top h2 {
		margin-top: 6px;
		font-size: 17px;
	}
	.amount {
		font-size: 28px;
		font-weight: 600;
		letter-spacing: -0.03em;
	}
	.section {
		display: grid;
		gap: 8px;
	}
	.section :global(.pop-root) {
		display: block;
	}
	.cat-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 38px;
		padding: 0 10px 0 12px;
		border-radius: 6px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		font-size: 14px;
	}
	.source {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12.5px;
	}
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 8px;
		background: var(--surface-2);
		cursor: pointer;
	}
	.toggle strong {
		font-size: 13.5px;
	}
	.toggle p {
		font-size: 12.5px;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 16px;
		margin: 0;
		font-size: 13px;
	}
	dt {
		color: var(--ink-3);
	}
	dd {
		margin: 0;
		text-align: right;
		overflow-wrap: anywhere;
	}
</style>
