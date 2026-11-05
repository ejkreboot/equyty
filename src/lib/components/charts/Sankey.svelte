<script lang="ts" module>
	export type SankeyMode = 'category-group' | 'group' | 'category';
</script>

<script lang="ts">
	import { sankey, sankeyLeft, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from 'd3-sankey';
	import Tooltip from './Tooltip.svelte';
	import { slotColor, type Summary } from '$lib/finance';
	import { money, percent } from '$lib/format';

	let { summary, mode = 'category-group' }: { summary: Summary; mode?: SankeyMode } = $props();

	interface N {
		id: string;
		name: string;
		color: string;
		/** denominator for the percentage shown in the label */
		base: number;
	}
	interface L {
		source: string;
		target: string;
		value: number;
	}
	type LN = SankeyNode<N, L>;
	type LL = SankeyLink<N, L>;

	let width = $state(0);
	let hover = $state<{ kind: 'node' | 'link'; id: string; x: number; y: number } | null>(null);

	const graph = $derived.by(() => {
		const nodes: N[] = [];
		const links: L[] = [];
		const income = summary.income;
		const expenses = summary.expenses;
		const incomeColor = slotColor(summary.incomeCategories[0]?.category.group.color_slot ?? 5);

		for (const c of summary.incomeCategories) {
			if (c.amount <= 0) continue;
			nodes.push({ id: `in:${c.category.id}`, name: c.category.name, color: incomeColor, base: income });
			links.push({ source: `in:${c.category.id}`, target: 'income', value: c.amount });
		}
		if (summary.net < 0) {
			nodes.push({ id: 'deficit', name: 'From savings', color: 'var(--status-critical)', base: expenses });
			links.push({ source: 'deficit', target: 'income', value: -summary.net });
		}
		nodes.push({ id: 'income', name: 'Income', color: incomeColor, base: Math.max(income, 1) });
		if (summary.net > 0) {
			nodes.push({ id: 'savings', name: 'Savings', color: 'var(--positive)', base: income });
			links.push({ source: 'income', target: 'savings', value: summary.net });
		}

		if (mode === 'category') {
			for (const c of summary.expenseCategories) {
				if (c.amount <= 0) continue;
				nodes.push({ id: `c:${c.category.id}`, name: c.category.name, color: slotColor(c.category.group.color_slot), base: income || expenses });
				links.push({ source: 'income', target: `c:${c.category.id}`, value: c.amount });
			}
		} else {
			for (const g of summary.expenseGroups) {
				const cats = g.categories.filter((c) => c.amount > 0);
				const total = cats.reduce((s, c) => s + c.amount, 0);
				if (total <= 0) continue;
				const color = slotColor(g.group.color_slot);
				nodes.push({ id: `g:${g.group.id}`, name: g.group.name, color, base: income || expenses });
				links.push({ source: 'income', target: `g:${g.group.id}`, value: total });
				if (mode === 'category-group') {
					for (const c of cats) {
						nodes.push({ id: `c:${c.category.id}`, name: c.category.name, color, base: expenses });
						links.push({ source: `g:${g.group.id}`, target: `c:${c.category.id}`, value: c.amount });
					}
				}
			}
		}
		return { nodes, links };
	});

	const lastColumnCount = $derived(
		graph.nodes.filter((n) => (mode === 'category-group' ? n.id.startsWith('c:') : n.id.startsWith('g:') || n.id.startsWith('c:')) || n.id === 'savings').length
	);
	const height = $derived(Math.max(440, Math.min(1400, lastColumnCount * 44 + 40)));
	const chartWidth = $derived(Math.max(width, 720));

	const layout = $derived.by(() => {
		if (!chartWidth || graph.links.length === 0) return null;
		const generator = sankey<N, L>()
			.nodeId((d) => d.id)
			.nodeAlign(sankeyLeft)
			.nodeSort(null)
			.nodeWidth(12)
			.nodePadding(Math.max(10, Math.min(22, height / (lastColumnCount + 1) / 2.4)))
			.extent([
				[1, 8],
				[chartWidth - 1, height - 8]
			]);
		return generator({
			nodes: graph.nodes.map((n) => ({ ...n })),
			links: graph.links.map((l) => ({ ...l }))
		});
	});

	const maxDepth = $derived(layout ? Math.max(...layout.nodes.map((n) => n.depth ?? 0)) : 0);
	const path = sankeyLinkHorizontal<N, L>();

	const nodeId = (n: LN | string | number) => (typeof n === 'object' ? n.id : String(n));
	const linkId = (l: LL) => `${nodeId(l.source)}→${nodeId(l.target)}`;

	function isLit(l: LL): boolean {
		if (!hover) return false;
		if (hover.kind === 'link') return linkId(l) === hover.id;
		return nodeId(l.source) === hover.id || nodeId(l.target) === hover.id;
	}

	const hoveredNode = $derived(hover?.kind === 'node' ? layout?.nodes.find((n) => n.id === hover!.id) : undefined);
	const hoveredLink = $derived(hover?.kind === 'link' ? layout?.links.find((l) => linkId(l) === hover!.id) : undefined);

	function pointer(e: PointerEvent, kind: 'node' | 'link', id: string) {
		const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
		hover = { kind, id, x: e.clientX - rect.left, y: e.clientY - rect.top };
	}
</script>

<div class="wrap" bind:clientWidth={width}>
	{#if layout}
		<div class="scroller">
			<svg width={chartWidth} {height} role="img" aria-label="Cash flow Sankey diagram">
				<defs>
					{#each layout.links as l, i (linkId(l))}
						{@const s = l.source as LN}
						{@const t = l.target as LN}
						<linearGradient id="sk-grad-{i}" gradientUnits="userSpaceOnUse" x1={s.x1} x2={t.x0}>
							<stop offset="0%" stop-color={s.color} />
							<stop offset="100%" stop-color={t.color} />
						</linearGradient>
					{/each}
				</defs>

				<g class="links" class:dim={hover !== null}>
					{#each layout.links as l, i (linkId(l))}
						<path
							d={path(l)}
							stroke="url(#sk-grad-{i})"
							stroke-width={Math.max(1, l.width ?? 1)}
							class:lit={isLit(l)}
							role="presentation"
							onpointermove={(e) => pointer(e, 'link', linkId(l))}
							onpointerleave={() => (hover = null)}
						/>
					{/each}
				</g>

				<g class="nodes">
					{#each layout.nodes as n (n.id)}
						{@const h = (n.y1 ?? 0) - (n.y0 ?? 0)}
						{@const right = (n.depth ?? 0) < Math.min(2, maxDepth)}
						{@const lx = right ? (n.x1 ?? 0) + 10 : (n.x0 ?? 0) - 10}
						{@const cy = ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2}
						<rect
							x={n.x0}
							y={n.y0}
							width={(n.x1 ?? 0) - (n.x0 ?? 0)}
							height={Math.max(1, h)}
							rx="2"
							fill={n.color}
							role="presentation"
							onpointermove={(e) => pointer(e, 'node', n.id)}
							onpointerleave={() => (hover = null)}
						/>
						{#if h >= 26}
							<text x={lx} y={cy - 3} text-anchor={right ? 'start' : 'end'} class="name">{n.name}</text>
							<text x={lx} y={cy + 14} text-anchor={right ? 'start' : 'end'} class="value">
								{money(n.value ?? 0)} ({percent((n.value ?? 0) / n.base, 2)})
							</text>
						{:else if h >= 11}
							<text x={lx} y={cy + 4} text-anchor={right ? 'start' : 'end'} class="name small">
								{n.name} · {money(n.value ?? 0, { cents: false })}
							</text>
						{/if}
					{/each}
				</g>
			</svg>
		</div>

		{#if hover && (hoveredNode || hoveredLink)}
			<Tooltip x={hover.x} y={hover.y} containerWidth={width}>
				{#if hoveredNode}
					<div class="tt-title">{hoveredNode.name}</div>
					<div class="tt-row">
						<span class="tt-swatch" style:background={hoveredNode.color}></span>Amount<b>{money(hoveredNode.value ?? 0)}</b>
					</div>
					<div class="tt-row">Share<b>{percent((hoveredNode.value ?? 0) / hoveredNode.base, 1)}</b></div>
				{:else if hoveredLink}
					{@const s = hoveredLink.source as LN}
					{@const t = hoveredLink.target as LN}
					<div class="tt-title">{s.name} → {t.name}</div>
					<div class="tt-row">
						<span class="tt-swatch" style:background={t.color}></span>Amount<b>{money(hoveredLink.value)}</b>
					</div>
					<div class="tt-row">Share of {s.name}<b>{percent(hoveredLink.value / Math.max(s.value ?? 1, 1), 1)}</b></div>
				{/if}
			</Tooltip>
		{/if}
	{/if}
</div>

<style>
	.wrap {
		position: relative;
		width: 100%;
		min-width: 0;
	}
	.scroller {
		overflow-x: auto;
		overscroll-behavior-x: contain;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.links path {
		fill: none;
		stroke-opacity: 0.26;
		transition: stroke-opacity 0.18s var(--ease);
	}
	.links.dim path {
		stroke-opacity: 0.1;
	}
	.links path.lit {
		stroke-opacity: 0.5;
	}
	.nodes rect {
		cursor: default;
	}
	text {
		font-size: 13px;
		pointer-events: none;
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 2.5px;
		stroke-opacity: 0.85;
		stroke-linejoin: round;
	}
	.name {
		fill: var(--ink-2);
		font-weight: 500;
	}
	.name.small {
		font-size: 11.5px;
	}
	.value {
		fill: var(--ink);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
