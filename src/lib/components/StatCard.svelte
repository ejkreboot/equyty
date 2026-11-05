<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		label,
		value,
		tone = 'default',
		delta,
		deltaGood = true,
		hint
	}: {
		label: string;
		value: string;
		tone?: 'default' | 'positive' | 'negative';
		/** e.g. "+12% vs last month" */
		delta?: string | null;
		/** Whether the delta direction is favorable (drives color). */
		deltaGood?: boolean;
		hint?: string;
	} = $props();
</script>

<div class="card stat">
	<div class="value num {tone === 'default' ? '' : tone}">{value}</div>
	<div class="label">{label}</div>
	{#if delta}
		<div class="delta" class:good={deltaGood} class:bad={!deltaGood}>
			<Icon name={deltaGood ? 'trending_up' : 'trending_down'} size={16} />
			{delta}
		</div>
	{:else if hint}
		<div class="delta">{hint}</div>
	{/if}
</div>

<style>
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 118px;
		padding: 20px 16px;
		text-align: center;
	}
	.value {
		font-size: 26px;
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.1;
		font-variant-numeric: proportional-nums;
	}
	.label {
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.delta {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12.5px;
		color: var(--ink-3);
	}
	.delta.good {
		color: var(--positive);
	}
	.delta.bad {
		color: var(--negative);
	}
	@media (max-width: 720px) {
		.stat {
			min-height: 96px;
			padding: 14px 10px;
		}
		.value {
			font-size: 20px;
		}
		.label {
			font-size: 10.5px;
		}
	}
</style>
