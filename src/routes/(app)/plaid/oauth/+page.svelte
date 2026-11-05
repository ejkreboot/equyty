<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { LINK_TOKEN_KEY, completeLink, openLink, type PendingLink } from '$lib/plaid-link';
	import { toast } from '$lib/toast.svelte';

	/**
	 * Return point for OAuth institutions (PLAID_REDIRECT_URI). Resumes the Link
	 * session that was started before the bank redirect.
	 */
	let message = $state('Finishing your bank connection…');

	onMount(async () => {
		let pending: PendingLink | null = null;
		try {
			pending = JSON.parse(sessionStorage.getItem(LINK_TOKEN_KEY) ?? 'null');
		} catch {
			pending = null;
		}
		if (!pending?.token) {
			message = 'This connection session expired. Please try connecting again.';
			return;
		}
		const result = await openLink(pending, { receivedRedirectUri: window.location.href });
		if ('exited' in result) {
			goto('/accounts');
			return;
		}
		try {
			await completeLink(pending, result.publicToken, result.metadata);
			toast(`Connected ${result.metadata.institution?.name ?? 'your account'}`, 'success');
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Could not finish connecting', 'error');
		}
		goto('/accounts', { invalidateAll: true });
	});
</script>

<div class="wrap">
	<Icon name="sync" size={28} class="spin" />
	<p>{message}</p>
	<a class="btn" href="/accounts">Back to accounts</a>
</div>

<style>
	.wrap {
		display: grid;
		place-items: center;
		gap: 14px;
		min-height: 70dvh;
		align-content: center;
		color: var(--ink-2);
	}
</style>
