<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import '../auth-form.css';

	let { form } = $props();
</script>

<svelte:head><title>Reset password · Equyty</title></svelte:head>

<form method="POST" class="auth-form" use:enhance>
	<header>
		<h1>Reset your password</h1>
		<p>We’ll email you a secure link to choose a new one.</p>
	</header>
	{#if form?.sent}
		<div class="notice"><Icon name="mail" size={20} />If an account exists for that email, a reset link is on its way.</div>
	{:else}
		{#if form?.message}<div class="error" role="alert"><Icon name="error" size={18} />{form.message}</div>{/if}
		<label class="field">
			<span>Email</span>
			<input class="input" type="email" name="email" autocomplete="email" required />
		</label>
		<button class="btn primary block">Send reset link</button>
	{/if}
	<p class="alt"><a href="/login">Back to sign in</a></p>
</form>
