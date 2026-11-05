<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Popover from '$lib/components/Popover.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import { slotColor } from '$lib/finance';
	import { longDate, money, percent } from '$lib/format';
	import { parseDate } from '$lib/dates';
	import { supabase } from '$lib/supabase/browser';
	import { toast } from '$lib/toast.svelte';

	let { data } = $props();
	type Goal = (typeof data.goals)[number];

	const GOAL_ICONS = ['savings', 'shield', 'flight', 'home', 'directions_car', 'school', 'beach_access', 'celebration', 'diamond', 'rocket_launch', 'family_restroom', 'trending_up'];

	const active = $derived(data.goals.filter((g) => !g.is_archived));
	const archived = $derived(data.goals.filter((g) => g.is_archived));
	const totalSaved = $derived(active.reduce((s, g) => s + Number(g.current_amount), 0));
	const totalTarget = $derived(active.reduce((s, g) => s + Number(g.target_amount), 0));

	// ---- editor ----
	let editorOpen = $state(false);
	let editing = $state<Goal | null>(null);
	let form = $state({ name: '', target: '', current: '', date: '', icon: 'savings', slot: 0 });

	function openEditor(g: Goal | null) {
		editing = g;
		form = g
			? { name: g.name, target: String(g.target_amount), current: String(g.current_amount), date: g.target_date ?? '', icon: g.icon, slot: g.color_slot }
			: { name: '', target: '', current: '', date: '', icon: 'savings', slot: active.length % 8 };
		editorOpen = true;
	}

	async function saveGoal(e: SubmitEvent) {
		e.preventDefault();
		const target = Number(form.target);
		const current = Number(form.current || 0);
		if (!form.name.trim() || !(target > 0) || current < 0) return toast('Add a name and a target amount', 'error');
		const payload = {
			name: form.name.trim(),
			target_amount: target,
			current_amount: current,
			target_date: form.date || null,
			icon: form.icon,
			color_slot: form.slot
		};
		const sb = supabase();
		const { error } = editing ? await sb.from('goals').update(payload).eq('id', editing.id) : await sb.from('goals').insert(payload);
		if (error) return toast('Could not save the goal', 'error');
		editorOpen = false;
		await invalidate('app:goals');
		toast(editing ? 'Goal updated' : 'Goal created', 'success');
	}

	// ---- contributions ----
	let fundOpen = $state(false);
	let funding = $state<Goal | null>(null);
	let fundAmount = $state('');
	let fundMode = $state<'add' | 'withdraw'>('add');

	async function saveFunds(e: SubmitEvent) {
		e.preventDefault();
		if (!funding) return;
		const amt = Number(fundAmount);
		if (!(amt > 0)) return toast('Enter an amount', 'error');
		const next = Math.max(0, Number(funding.current_amount) + (fundMode === 'add' ? amt : -amt));
		const { error } = await supabase().from('goals').update({ current_amount: next }).eq('id', funding.id);
		if (error) return toast('Could not update the goal', 'error');
		fundOpen = false;
		await invalidate('app:goals');
		toast(next >= Number(funding.target_amount) ? `${funding.name} is fully funded` : `${money(amt)} ${fundMode === 'add' ? 'added to' : 'withdrawn from'} ${funding.name}`, 'success');
	}

	async function archive(g: Goal, value: boolean) {
		const { error } = await supabase().from('goals').update({ is_archived: value }).eq('id', g.id);
		if (error) return toast('Could not update the goal', 'error');
		await invalidate('app:goals');
	}

	async function remove(g: Goal) {
		const { error } = await supabase().from('goals').delete().eq('id', g.id);
		if (error) return toast('Could not delete the goal', 'error');
		await invalidate('app:goals');
		toast('Goal deleted', 'success');
	}

	function plan(g: Goal) {
		const remaining = Number(g.target_amount) - Number(g.current_amount);
		if (remaining <= 0) return { text: 'Fully funded', tone: 'positive' };
		if (!g.target_date) return { text: `${money(remaining, { cents: false })} to go`, tone: '' };
		const now = new Date();
		const end = parseDate(g.target_date);
		const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
		if (months <= 0) return { text: `${money(remaining, { cents: false })} short of target date`, tone: 'negative' };
		return { text: `Save ${money(remaining / months, { cents: false })}/mo to hit ${longDate(g.target_date)}`, tone: '' };
	}
</script>

<svelte:head><title>Goals · Equyty</title></svelte:head>

<div class="page">
	<header class="page-header">
		<div class="title">
			<h1>Goals</h1>
			{#if active.length}<span class="muted">{money(totalSaved, { cents: false })} of {money(totalTarget, { cents: false })} saved</span>{/if}
		</div>
		<div class="actions"><button class="btn primary" onclick={() => openEditor(null)}><Icon name="add" size={18} />New goal</button></div>
	</header>

	{#if active.length === 0 && archived.length === 0}
		<section class="card">
			<EmptyState icon="flag" title="Set your first goal" body="An emergency fund, a trip, a down payment — give your savings a purpose and track progress.">
				<button class="btn primary" onclick={() => openEditor(null)}><Icon name="add" size={18} />Create a goal</button>
			</EmptyState>
		</section>
	{:else}
		<div class="goal-grid">
			{#each active as g (g.id)}
				{@const pct = Math.min(1, Number(g.current_amount) / Number(g.target_amount))}
				{@const p = plan(g)}
				<article class="card goal" style:--c={slotColor(g.color_slot)}>
					<div class="g-top">
						<CategoryIcon icon={g.icon} slot={g.color_slot} size={42} />
						<Popover align="end" width={190}>
							{#snippet trigger({ toggle })}
								<button class="btn ghost icon-only sm" aria-label="Goal options" onclick={toggle}><Icon name="more_horiz" size={19} /></button>
							{/snippet}
							{#snippet children({ close })}
								<div class="menu">
									<button onclick={() => (close(), openEditor(g))}><Icon name="edit" size={17} />Edit</button>
									<button onclick={() => (close(), archive(g, true))}><Icon name="check_circle" size={17} />Archive</button>
									<button class="danger" onclick={() => (close(), remove(g))}><Icon name="delete" size={17} />Delete</button>
								</div>
							{/snippet}
						</Popover>
					</div>
					<h3>{g.name}</h3>
					<div class="amounts">
						<b class="num">{money(g.current_amount, { cents: false })}</b>
						<span class="muted">of {money(g.target_amount, { cents: false })}</span>
					</div>
					<div class="progress" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="{g.name} progress">
						<span style:width="{pct * 100}%"></span>
					</div>
					<div class="g-foot">
						<span class="plan {p.tone}">{p.text}</span>
						<span class="pct num">{percent(pct, 0)}</span>
					</div>
					<button class="btn block sm fund" onclick={() => ((funding = g), (fundAmount = ''), (fundMode = 'add'), (fundOpen = true))}>
						<Icon name="add" size={17} />Add funds
					</button>
				</article>
			{/each}
			<button class="card add-card" onclick={() => openEditor(null)}>
				<Icon name="add" size={26} />
				<span>New goal</span>
			</button>
		</div>

		{#if archived.length}
			<h2 class="arch-title">Archived</h2>
			<ul class="archived card">
				{#each archived as g (g.id)}
					<li>
						<CategoryIcon icon={g.icon} slot={g.color_slot} size={28} />
						<span class="nm">{g.name}</span>
						<span class="muted num">{money(g.current_amount, { cents: false })} / {money(g.target_amount, { cents: false })}</span>
						<button class="btn ghost sm" onclick={() => archive(g, false)}>Restore</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<Modal bind:open={editorOpen} title={editing ? 'Edit goal' : 'New goal'} width={480}>
	<form id="goal-form" class="form" onsubmit={saveGoal}>
		<label class="field"><span>Name</span><input class="input" bind:value={form.name} maxlength="80" placeholder="Emergency fund" required /></label>
		<div class="two">
			<label class="field">
				<span>Target</span>
				<span class="input-group"><span class="prefix">$</span><input class="input num" inputmode="decimal" bind:value={form.target} placeholder="10,000" required /></span>
			</label>
			<label class="field">
				<span>Saved so far</span>
				<span class="input-group"><span class="prefix">$</span><input class="input num" inputmode="decimal" bind:value={form.current} placeholder="0" /></span>
			</label>
		</div>
		<label class="field"><span>Target date <span class="muted">(optional)</span></span><input class="input" type="date" bind:value={form.date} /></label>
		<div class="field">
			<span>Icon</span>
			<div class="icons" role="radiogroup" aria-label="Icon">
				{#each GOAL_ICONS as ic (ic)}
					<button type="button" role="radio" aria-checked={form.icon === ic} class:on={form.icon === ic} onclick={() => (form.icon = ic)} aria-label={ic}>
						<Icon name={ic} size={20} />
					</button>
				{/each}
			</div>
		</div>
		<div class="field">
			<span>Color</span>
			<div class="colors" role="radiogroup" aria-label="Color">
				{#each [0, 1, 2, 3, 4, 5, 6, 7] as slot (slot)}
					<button type="button" role="radio" aria-checked={form.slot === slot} aria-label="Color {slot + 1}" class:on={form.slot === slot} style:background={slotColor(slot)} onclick={() => (form.slot = slot)}></button>
				{/each}
			</div>
		</div>
	</form>
	{#snippet footer()}
		<button class="btn" onclick={() => (editorOpen = false)}>Cancel</button>
		<button class="btn primary" form="goal-form">{editing ? 'Save' : 'Create goal'}</button>
	{/snippet}
</Modal>

<Modal bind:open={fundOpen} title={funding?.name ?? 'Goal'} description="Record money you’ve set aside (or taken out)." width={400}>
	<form id="fund-form" class="form" onsubmit={saveFunds}>
		<div class="segmented" role="group">
			<button type="button" aria-pressed={fundMode === 'add'} onclick={() => (fundMode = 'add')}>Add</button>
			<button type="button" aria-pressed={fundMode === 'withdraw'} onclick={() => (fundMode = 'withdraw')}>Withdraw</button>
		</div>
		<span class="input-group big">
			<span class="prefix">$</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input class="input num" inputmode="decimal" bind:value={fundAmount} placeholder="0.00" autofocus aria-label="Amount" />
		</span>
	</form>
	{#snippet footer()}
		<button class="btn" onclick={() => (fundOpen = false)}>Cancel</button>
		<button class="btn primary" form="fund-form">Save</button>
	{/snippet}
</Modal>

<style>
	.goal-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
		gap: 16px;
	}
	.goal {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 20px;
	}
	.g-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 4px;
	}
	.goal h3 {
		font-size: 15.5px;
	}
	.amounts {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.amounts b {
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.02em;
		font-variant-numeric: proportional-nums;
	}
	.progress {
		height: 8px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--c) 16%, var(--surface));
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		border-radius: 0 4px 4px 0;
		background: var(--c);
		transition: width 0.6s var(--ease);
	}
	.g-foot {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 12.5px;
	}
	.plan {
		color: var(--ink-2);
	}
	.pct {
		font-weight: 600;
	}
	.fund {
		margin-top: auto;
	}
	.add-card {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 6px;
		min-height: 240px;
		border: 1.5px dashed var(--border-strong);
		background: transparent;
		box-shadow: none;
		color: var(--ink-3);
		font-weight: 500;
		transition:
			color 0.15s,
			border-color 0.15s;
	}
	.add-card:hover {
		color: var(--ink);
		border-color: var(--ink-3);
	}
	.menu {
		padding: 6px;
	}
	.menu button {
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
	}
	.menu button:hover {
		background: var(--surface-3);
	}
	.menu .danger {
		color: var(--negative);
	}
	.arch-title {
		margin: 32px 0 12px;
		color: var(--ink-2);
	}
	.archived {
		list-style: none;
		margin: 0;
		padding: 6px 10px;
	}
	.archived li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
		font-size: 13.5px;
	}
	.archived .nm {
		flex: 1;
		font-weight: 500;
	}
	.form {
		display: grid;
		gap: 16px;
	}
	.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.icons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.icons button {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border: 0;
		border-radius: 6px;
		background: var(--surface-2);
		color: var(--ink-2);
	}
	.icons button.on {
		background: var(--ink);
		color: var(--ink-inverse);
	}
	.colors {
		display: flex;
		gap: 8px;
	}
	.colors button {
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: 50%;
		box-shadow: 0 0 0 2px var(--surface);
	}
	.colors button.on {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--ink);
	}
	.big .input {
		height: 52px;
		font-size: 22px;
		font-weight: 600;
	}
	.big .prefix {
		font-size: 20px;
	}
	.big .prefix + .input {
		padding-left: 30px;
	}
</style>
