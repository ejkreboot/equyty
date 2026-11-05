<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import Toaster from '$lib/components/Toaster.svelte';
	import { ICON_FONT_URL } from '$lib/icons';
	import { supabase } from '$lib/supabase/browser';

	let { data, children } = $props();

	onMount(() => {
		// Keep server-rendered data in sync when the session changes (sign-out in
		// another tab, token refresh, etc.).
		const {
			data: { subscription }
		} = supabase().auth.onAuthStateChange((_event, session) => {
			if (session?.expires_at !== data.session?.expires_at) invalidate('supabase:auth');
		});
		return () => subscription.unsubscribe();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="stylesheet" href={ICON_FONT_URL} />
	<title>Equyty</title>
</svelte:head>

{@render children()}
<Toaster />
