<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';

	let { form } = $props();
</script>

<svelte:head><title>Change password · Equyty</title></svelte:head>

<div class="page narrow">
	<header class="page-header">
		<div class="title">
			<a href="/settings" class="btn ghost icon-only sm" aria-label="Back to settings"><Icon name="arrow_back" size={20} /></a>
			<h1>Change password</h1>
		</div>
	</header>
	<form method="POST" class="card box" use:enhance>
		{#if form?.message}<p class="err" role="alert"><Icon name="error" size={18} />{form.message}</p>{/if}
		<label class="field"><span>New password</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="10" required /></label>
		<label class="field"><span>Confirm new password</span><input class="input" type="password" name="confirm" autocomplete="new-password" minlength="10" required /></label>
		<p class="muted hint">Other signed-in devices will be signed out.</p>
		<button class="btn primary">Update password</button>
	</form>
</div>

<style>
	.narrow {
		max-width: 520px;
	}
	.page-header .title {
		gap: 10px;
	}
	.box {
		display: grid;
		gap: 16px;
		padding: 24px;
	}
	.hint {
		font-size: 12.5px;
	}
	.err {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--negative);
		font-size: 13px;
	}
</style>
