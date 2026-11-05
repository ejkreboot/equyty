<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { children } = $props();

	const features = [
		{ icon: 'account_tree', title: 'See where it all goes', body: 'Income to spending in one clear flow, down to the category.' },
		{ icon: 'auto_awesome', title: 'Categorization that learns', body: 'AI sorts every transaction and adapts to your corrections.' },
		{ icon: 'lock', title: 'Private by design', body: 'Read-only bank access, encrypted tokens, row-level security.' }
	];
</script>

<div class="auth">
	<main>
		<a href="/" class="brand"><Logo /></a>
		<div class="form-wrap">{@render children()}</div>
		<p class="legal muted">Bank connections powered by Plaid. We never see or store your bank credentials.</p>
	</main>
	<aside aria-hidden="true">
		<div class="panel">
			<div class="preview">
				<div class="row">
					<span class="eyebrow">Cash flow · This month</span>
				</div>
				<div class="kpis">
					<div><b>$8,420</b><span>Income</span></div>
					<div><b>$5,913</b><span>Spending</span></div>
					<div><b>29.8%</b><span>Saved</span></div>
				</div>
				<svg viewBox="0 0 360 150" class="flow">
					<rect x="0" y="10" width="8" height="130" rx="2" fill="var(--series-6)" />
					<path d="M8 10 C 120 10, 120 10, 176 10 L176 48 C120 48,120 48,8 48Z" fill="var(--series-6)" opacity=".18" />
					<path d="M8 48 C 120 48, 120 60, 176 60 L176 100 C120 100,120 88,8 88Z" fill="var(--series-4)" opacity=".2" />
					<path d="M8 88 C 120 88, 120 108, 176 108 L176 128 C120 128,120 112,8 112Z" fill="var(--series-1)" opacity=".2" />
					<path d="M8 112 C 120 112, 120 134, 176 134 L176 146 C120 146,120 140,8 140Z" fill="var(--series-2)" opacity=".2" />
					<rect x="176" y="10" width="8" height="38" rx="2" fill="var(--positive)" />
					<rect x="176" y="60" width="8" height="40" rx="2" fill="var(--series-4)" />
					<rect x="176" y="108" width="8" height="20" rx="2" fill="var(--series-1)" />
					<rect x="176" y="134" width="8" height="12" rx="2" fill="var(--series-2)" />
					<text x="196" y="33">Savings</text>
					<text x="196" y="84">Housing</text>
					<text x="196" y="122">Bills</text>
					<text x="196" y="144">Food</text>
				</svg>
			</div>
			<ul>
				{#each features as f (f.title)}
					<li>
						<span class="ic"><Icon name={f.icon} size={20} /></span>
						<div>
							<strong>{f.title}</strong>
							<p>{f.body}</p>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</aside>
</div>

<style>
	.auth {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
		min-height: 100dvh;
	}
	main {
		display: flex;
		flex-direction: column;
		padding: 28px 40px;
		background: var(--surface);
	}
	.form-wrap {
		flex: 1;
		display: grid;
		place-items: center;
		padding: 40px 0;
	}
	.legal {
		font-size: 12px;
		text-align: center;
	}
	aside {
		position: relative;
		display: grid;
		place-items: center;
		padding: 48px;
		overflow: hidden;
		background:
			radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 60%),
			radial-gradient(90% 70% at 0% 100%, color-mix(in oklab, var(--series-1) 12%, transparent), transparent 60%),
			var(--bg);
	}
	.panel {
		width: min(440px, 100%);
		display: grid;
		gap: 36px;
	}
	.preview {
		padding: 22px;
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		transform: rotate(-1.2deg);
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin: 14px 0 18px;
	}
	.kpis div {
		display: grid;
		gap: 2px;
	}
	.kpis b {
		font-size: 20px;
		letter-spacing: -0.02em;
	}
	.kpis span {
		font-size: 11px;
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.flow text {
		font-size: 12px;
		fill: var(--ink-2);
		font-weight: 500;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 18px;
	}
	li {
		display: flex;
		gap: 14px;
	}
	.ic {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		flex: none;
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		color: var(--accent);
	}
	strong {
		font-size: 14px;
	}
	li p {
		font-size: 13.5px;
		color: var(--ink-2);
		margin-top: 2px;
	}
	@media (max-width: 900px) {
		.auth {
			grid-template-columns: minmax(0, 1fr);
		}
		aside {
			display: none;
		}
		main {
			padding: 20px;
		}
	}
</style>
