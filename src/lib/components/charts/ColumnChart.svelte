<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import Tooltip from './Tooltip.svelte';
	import { money, moneyCompact } from '$lib/format';

	interface Series {
		key: string;
		label: string;
		color: string;
	}
	interface Datum {
		key: string;
		label: string;
		values: Record<string, number>;
	}

	let {
		series,
		data,
		height = 260,
		activeKey = null,
		footer,
		onselect
	}: {
		series: Series[];
		data: Datum[];
		height?: number;
		activeKey?: string | null;
		/** Extra tooltip rows, e.g. net income. */
		footer?: (d: Datum) => { label: string; value: string; tone?: 'positive' | 'negative' }[];
		onselect?: (key: string) => void;
	} = $props();

	const M = { top: 12, right: 4, bottom: 28, left: 52 };
	const GAP = 2;

	let width = $state(0);
	let hoverIndex = $state<number | null>(null);
	let pointerY = $state(0);

	const innerW = $derived(Math.max(0, width - M.left - M.right));
	const innerH = $derived(height - M.top - M.bottom);
	const band = $derived(data.length ? innerW / data.length : 0);
	const barW = $derived(Math.max(4, Math.min(24, (band * 0.62 - GAP * (series.length - 1)) / series.length)));
	const groupW = $derived(barW * series.length + GAP * (series.length - 1));

	const y = $derived.by(() => {
		const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
		return scaleLinear().domain([0, max]).nice(4).range([innerH, 0]);
	});
	const ticks = $derived(y.ticks(4));
	const labelEvery = $derived(band < 38 ? Math.ceil(38 / Math.max(band, 1)) : 1);

	function column(x: number, top: number, w: number, h: number) {
		if (h <= 0) return '';
		const r = Math.min(4, h, w / 2);
		return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + h}Z`;
	}

	function track(e: PointerEvent, i: number) {
		hoverIndex = i;
		pointerY = e.clientY - (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect().top;
	}

	const hovered = $derived(hoverIndex !== null ? data[hoverIndex] : null);
</script>

<div class="wrap" bind:clientWidth={width}>
	{#if width > 0}
		<svg {width} {height} role="img" aria-label="Column chart">
			<g transform="translate({M.left},{M.top})">
				{#each ticks as t (t)}
					<line class="grid" x1="0" x2={innerW} y1={y(t)} y2={y(t)} />
					<text class="tick" x="-10" y={y(t)} dy="0.32em" text-anchor="end">{moneyCompact(t)}</text>
				{/each}

				{#each data as d, i (d.key)}
					{@const x0 = i * band + (band - groupW) / 2}
					{@const faded = (hoverIndex !== null && hoverIndex !== i) || (activeKey !== null && activeKey !== d.key && hoverIndex === null)}
					{#if hoverIndex === i}
						<rect class="hover-band" x={i * band + 2} y="0" width={band - 4} height={innerH} rx="6" />
					{/if}
					<g class:faded>
						{#each series as s, j (s.key)}
							{@const v = Math.max(0, d.values[s.key] ?? 0)}
							<path d={column(x0 + j * (barW + GAP), y(v), barW, innerH - y(v))} fill={s.color} />
						{/each}
					</g>
					{#if i % labelEvery === 0}
						<text class="tick" class:active={activeKey === d.key} x={i * band + band / 2} y={innerH + 18} text-anchor="middle">{d.label}</text>
					{/if}
					{#if onselect}
						<rect
							class="hit"
							x={i * band}
							y="0"
							width={band}
							height={innerH + M.bottom}
							role="button"
							tabindex="0"
							aria-label="Select {d.label}"
							style:cursor="pointer"
							onpointermove={(e) => track(e, i)}
							onpointerleave={() => (hoverIndex = null)}
							onclick={() => onselect(d.key)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onselect(d.key);
								}
							}}
						/>
					{:else}
						<rect
							class="hit"
							x={i * band}
							y="0"
							width={band}
							height={innerH + M.bottom}
							role="presentation"
							onpointermove={(e) => track(e, i)}
							onpointerleave={() => (hoverIndex = null)}
						/>
					{/if}
				{/each}
				<line class="axis" x1="0" x2={innerW} y1={innerH} y2={innerH} />
			</g>
		</svg>

		{#if hovered && hoverIndex !== null}
			<Tooltip x={M.left + hoverIndex * band + band / 2 + groupW / 2} y={Math.max(40, Math.min(pointerY, height - 40))} containerWidth={width}>
				<div class="tt-title">{hovered.label}</div>
				{#each series as s (s.key)}
					<div class="tt-row"><span class="tt-swatch" style:background={s.color}></span>{s.label}<b>{money(hovered.values[s.key] ?? 0)}</b></div>
				{/each}
				{#if footer}
					<div class="tt-divider"></div>
					{#each footer(hovered) as row (row.label)}
						<div class="tt-row">{row.label}<b class={row.tone}>{row.value}</b></div>
					{/each}
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
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--grid);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}
	.axis {
		stroke: var(--axis);
		shape-rendering: crispEdges;
	}
	.tick {
		fill: var(--ink-3);
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
	}
	.tick.active {
		fill: var(--ink);
		font-weight: 600;
	}
	.hover-band {
		fill: var(--surface-3);
		opacity: 0.7;
	}
	g {
		transition: opacity 0.15s;
	}
	.faded {
		opacity: 0.4;
	}
	.hit {
		fill: transparent;
		outline: none;
	}
	.hit:focus-visible {
		stroke: var(--accent);
		stroke-width: 2;
	}
</style>
