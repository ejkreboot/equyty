<script lang="ts" module>
	export interface Point {
		x: number;
		y: number;
	}
</script>

<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { area as d3area, line as d3line, curveMonotoneX } from 'd3-shape';
	import Tooltip from './Tooltip.svelte';
	import { moneyCompact, money } from '$lib/format';

	interface Series {
		key: string;
		label: string;
		color: string;
		points: Point[];
		area?: boolean;
		dashed?: boolean;
	}

	let {
		series,
		height = 220,
		xFormat,
		xTicks,
		yFormat = moneyCompact,
		compact = false,
		zeroBaseline = true
	}: {
		series: Series[];
		height?: number;
		xFormat: (x: number) => string;
		xTicks?: number[];
		yFormat?: (y: number) => string;
		/** Sparkline mode: no axes or grid. */
		compact?: boolean;
		zeroBaseline?: boolean;
	} = $props();

	const M = $derived(compact ? { top: 6, right: 6, bottom: 6, left: 6 } : { top: 12, right: 12, bottom: 28, left: 52 });

	let width = $state(0);
	let hoverX = $state<number | null>(null);

	const innerW = $derived(Math.max(0, width - M.left - M.right));
	const innerH = $derived(height - M.top - M.bottom);
	const allPoints = $derived(series.flatMap((s) => s.points));

	const x = $derived.by(() => {
		const xs = allPoints.map((p) => p.x);
		return scaleLinear()
			.domain([Math.min(...xs), Math.max(...xs)])
			.range([0, innerW]);
	});
	const y = $derived.by(() => {
		const ys = allPoints.map((p) => p.y);
		const lo = Math.min(...ys);
		const hi = Math.max(...ys);
		const min = zeroBaseline ? Math.min(0, lo) : lo - (hi - lo) * 0.1;
		const max = hi === min ? min + 1 : hi;
		return scaleLinear().domain([min, max]).nice(4).range([innerH, 0]);
	});

	const lineGen = $derived(
		d3line<Point>()
			.x((p) => x(p.x))
			.y((p) => y(p.y))
			.curve(curveMonotoneX)
	);
	const areaGen = $derived(
		d3area<Point>()
			.x((p) => x(p.x))
			.y0(() => y(Math.max(y.domain()[0], 0)))
			.y1((p) => y(p.y))
			.curve(curveMonotoneX)
	);

	const ticks = $derived(y.ticks(4));
	const xs = $derived([...new Set(allPoints.map((p) => p.x))].sort((a, b) => a - b));
	const shownXTicks = $derived(xTicks ?? (xs.length > 1 ? [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]] : xs));

	function onmove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left - M.left;
		const target = x.invert(px);
		let best = xs[0];
		for (const v of xs) if (Math.abs(v - target) < Math.abs(best - target)) best = v;
		hoverX = best;
	}

	const hoverRows = $derived(
		hoverX === null
			? []
			: series
					.map((s) => ({ s, p: s.points.find((p) => p.x === hoverX) }))
					.filter((r): r is { s: Series; p: Point } => !!r.p)
	);
	const gid = `lc-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="wrap" bind:clientWidth={width}>
	{#if width > 0 && allPoints.length > 0}
		<svg
			{width}
			{height}
			role="img"
			aria-label="Line chart"
			onpointermove={onmove}
			onpointerleave={() => (hoverX = null)}
		>
			<defs>
				{#each series as s, i (s.key)}
					{#if s.area}
						<linearGradient id="{gid}-{i}" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stop-color={s.color} stop-opacity="0.16" />
							<stop offset="100%" stop-color={s.color} stop-opacity="0.01" />
						</linearGradient>
					{/if}
				{/each}
			</defs>
			<g transform="translate({M.left},{M.top})">
				{#if !compact}
					{#each ticks as t (t)}
						<line class="grid" x1="0" x2={innerW} y1={y(t)} y2={y(t)} />
						<text class="tick" x="-10" y={y(t)} dy="0.32em" text-anchor="end">{yFormat(t)}</text>
					{/each}
					{#each shownXTicks as t, i (t)}
						<text
							class="tick"
							x={x(t)}
							y={innerH + 18}
							text-anchor={i === 0 && shownXTicks.length > 1 ? 'start' : i === shownXTicks.length - 1 && shownXTicks.length > 1 ? 'end' : 'middle'}
							>{xFormat(t)}</text
						>
					{/each}
				{/if}

				{#each series as s, i (s.key)}
					{#if s.area && s.points.length > 1}
						<path d={areaGen(s.points)} fill="url(#{gid}-{i})" />
					{/if}
					{#if s.points.length > 1}
						<path d={lineGen(s.points)} fill="none" stroke={s.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={s.dashed ? '4 4' : undefined} />
					{/if}
				{/each}

				{#if !compact}
					{#each series as s (s.key)}
						{@const last = s.points.at(-1)}
						{#if last && hoverX === null && !s.dashed}
							<circle cx={x(last.x)} cy={y(last.y)} r="4" fill={s.color} stroke="var(--surface)" stroke-width="2" />
						{/if}
					{/each}
				{/if}

				{#if hoverX !== null}
					<line class="crosshair" x1={x(hoverX)} x2={x(hoverX)} y1="0" y2={innerH} />
					{#each hoverRows as r (r.s.key)}
						<circle cx={x(r.p.x)} cy={y(r.p.y)} r="4.5" fill={r.s.color} stroke="var(--surface)" stroke-width="2" />
					{/each}
				{/if}
			</g>
		</svg>

		{#if hoverX !== null && hoverRows.length}
			<Tooltip x={M.left + x(hoverX)} y={M.top + y(hoverRows[0].p.y)} containerWidth={width}>
				<div class="tt-title">{xFormat(hoverX)}</div>
				{#each hoverRows as r (r.s.key)}
					<div class="tt-row"><span class="tt-swatch" style:background={r.s.color}></span>{r.s.label}<b>{money(r.p.y)}</b></div>
				{/each}
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
		touch-action: pan-y;
	}
	.grid {
		stroke: var(--grid);
		shape-rendering: crispEdges;
	}
	.tick {
		fill: var(--ink-3);
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
	}
	.crosshair {
		stroke: var(--axis);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}
</style>
