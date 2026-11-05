<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import '../auth-form.css';

	let { form } = $props();
	let loading = $state(false);
	const confirmed = page.url.searchParams.get('confirmed') === '1';
	const reset = page.url.searchParams.get('reset') === '1';
</script>

<svelte:head><title>Sign in · Equyty</title></svelte:head>

<form
	method="POST"
	class="auth-form"
	use:enhance={() => {
		loading = true;
		return async ({ update }) => {
			await update({ reset: false });
			loading = false;
		};
	}}
>
	<header>
		<h1>Welcome back</h1>
		<p>Sign in to see where your money is going.</p>
	</header>

	{#if confirmed}<div class="notice"><Icon name="check_circle" size={20} fill />Email confirmed. Sign in to get started.</div>{/if}
	{#if reset}<div class="notice"><Icon name="check_circle" size={20} fill />Password updated. Sign in with your new password.</div>{/if}
	{#if form?.message}<div class="error" role="alert"><Icon name="error" size={18} />{form.message}</div>{/if}

	<label class="field">
		<span>Email</span>
		<input class="input" type="email" name="email" autocomplete="email" required value={form?.email ?? ''} />
	</label>
	<label class="field">
		<span class="row-between">Password <a href="/forgot-password" class="inline-link">Forgot?</a></span>
		<input class="input" type="password" name="password" autocomplete="current-password" required />
	</label>

	<button class="btn primary block" disabled={loading}>
		{#if loading}<Icon name="sync" size={18} class="spin" />{/if}
		Sign in
	</button>
	<p class="alt">New to Equyty? <a href="/signup">Create an account</a></p>
</form>
