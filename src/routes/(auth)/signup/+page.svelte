<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import '../auth-form.css';

	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Create account · Equyty</title></svelte:head>

{#if form?.sent}
	<div class="auth-form">
		<header>
			<h1>Check your inbox</h1>
			<p>We sent a confirmation link to <strong>{form.email}</strong>. Open it to activate your account.</p>
		</header>
		<a class="btn block" href="/login">Back to sign in</a>
	</div>
{:else}
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
			<h1>Create your account</h1>
			<p>Connect your accounts and get a clear picture in minutes.</p>
		</header>

		{#if form?.message}<div class="error" role="alert"><Icon name="error" size={18} />{form.message}</div>{/if}

		<label class="field">
			<span>Name</span>
			<input class="input" name="name" autocomplete="given-name" value={form?.name ?? ''} />
		</label>
		<label class="field">
			<span>Email</span>
			<input class="input" type="email" name="email" autocomplete="email" required value={form?.email ?? ''} />
		</label>
		<label class="field">
			<span>Password</span>
			<input class="input" type="password" name="password" autocomplete="new-password" minlength="10" required />
		</label>

		<button class="btn primary block" disabled={loading}>
			{#if loading}<Icon name="sync" size={18} class="spin" />{/if}
			Create account
		</button>
		<p class="alt">Already have an account? <a href="/login">Sign in</a></p>
	</form>
{/if}
