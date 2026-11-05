<script lang="ts">
	let { size = 28, wordmark = true }: { size?: number; wordmark?: boolean } = $props();
</script>

<span class="logo">
	<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
		<rect width="32" height="32" rx="7" fill="var(--accent)" />
		<rect x="8" y="17" width="4" height="7" rx="2" fill="#fff" opacity=".7" />
		<rect x="14" y="12" width="4" height="12" rx="2" fill="#fff" opacity=".85" />
		<rect x="20" y="7" width="4" height="17" rx="2" fill="#fff" />
	</svg>
	{#if wordmark}<span class="word">equyty</span>{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.word {
		font-size: 17px;
		font-weight: 650;
		letter-spacing: -0.03em;
	}
</style>
