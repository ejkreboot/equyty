<script lang="ts">
	import { page } from '$app/state';
	import { fade, fly } from 'svelte/transition';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Popover from '$lib/components/Popover.svelte';
	import { theme } from '$lib/theme.svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'space_dashboard' },
		{ href: '/accounts', label: 'Accounts', icon: 'account_balance_wallet' },
		{ href: '/transactions', label: 'Transactions', icon: 'receipt_long' },
		{ href: '/cash-flow', label: 'Cash Flow', icon: 'bar_chart' },
		{ href: '/reports', label: 'Reports', icon: 'pie_chart' },
		{ href: '/budget', label: 'Budget', icon: 'donut_large' },
		{ href: '/recurring', label: 'Recurring', icon: 'event_repeat' },
		{ href: '/goals', label: 'Goals', icon: 'flag' },
		{ href: '/investments', label: 'Investments', icon: 'trending_up' },
		{ href: '/advice', label: 'Advice', icon: 'tips_and_updates' }
	];

	let collapsed = $state(false);
	let drawer = $state(false);
	let menuOpen = $state(false);

	$effect(() => {
		try {
			collapsed = localStorage.getItem('sidebar') === 'collapsed';
		} catch {
			/* ignore */
		}
	});
	function toggleCollapsed() {
		collapsed = !collapsed;
		try {
			localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'open');
		} catch {
			/* ignore */
		}
	}

	// Close the mobile drawer on navigation.
	$effect(() => {
		void page.url.pathname;
		drawer = false;
	});

	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	const needsAttention = $derived(data.items.filter((i) => i.status !== 'good').length);
	const name = $derived(data.displayName || data.email.split('@')[0] || 'You');
	const initials = $derived(
		name
			.split(/\s+/)
			.map((p: string) => p[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);
</script>

{#snippet sidebar(mobile: boolean)}
	<div class="sb-top">
		{#if !collapsed || mobile}
			<a href="/dashboard" class="brand"><Logo size={26} /></a>
		{:else}
			<a href="/dashboard" class="brand"><Logo size={26} wordmark={false} /></a>
		{/if}
		<div class="sb-tools">
			<a href="/transactions?focus=search" class="btn ghost icon-only sm" aria-label="Search transactions" title="Search"><Icon name="search" size={19} /></a>
			{#if mobile}
				<button class="btn ghost icon-only sm" aria-label="Close menu" onclick={() => (drawer = false)}><Icon name="close" size={19} /></button>
			{:else}
				<button class="btn ghost icon-only sm" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand' : 'Collapse'} onclick={toggleCollapsed}>
					<Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} size={19} />
				</button>
			{/if}
		</div>
	</div>

	<nav aria-label="Main">
		{#each nav as item (item.href)}
			<a href={item.href} class="nav-item" aria-current={isActive(item.href) ? 'page' : undefined} title={collapsed && !mobile ? item.label : undefined}>
				<Icon name={item.icon} size={21} fill={isActive(item.href)} weight={isActive(item.href) ? 500 : 400} />
				<span class="label">{item.label}</span>
				{#if item.href === '/accounts' && needsAttention}<span class="dot" title="A connection needs attention"></span>{/if}
			</a>
		{/each}
	</nav>

	<div class="sb-bottom">
		<a href="/settings" class="nav-item" aria-current={isActive('/settings') ? 'page' : undefined} title={collapsed && !mobile ? 'Settings' : undefined}>
			<Icon name="settings" size={21} fill={isActive('/settings')} />
			<span class="label">Settings</span>
		</a>
		<Popover bind:open={menuOpen} width={240}>
			{#snippet trigger({ toggle })}
				<button class="nav-item user" onclick={toggle} aria-haspopup="menu" aria-expanded={menuOpen}>
					<span class="avatar">{initials}</span>
					<span class="label user-meta">
						<span class="user-name">{name}</span>
						<span class="user-email">{data.email}</span>
					</span>
				</button>
			{/snippet}
			{#snippet children({ close })}
				<div class="menu" role="menu">
					<div class="theme-row">
						<span>Theme</span>
						<div class="segmented" role="group" aria-label="Theme">
							<button aria-pressed={theme.value === 'light'} onclick={() => theme.set('light')} aria-label="Light"><Icon name="light_mode" size={17} /></button>
							<button aria-pressed={theme.value === 'system'} onclick={() => theme.set('system')}>Auto</button>
							<button aria-pressed={theme.value === 'dark'} onclick={() => theme.set('dark')} aria-label="Dark"><Icon name="dark_mode" size={17} /></button>
						</div>
					</div>
					<a href="/settings" role="menuitem" onclick={close}><Icon name="person" size={18} />Profile & settings</a>
					<form method="POST" action="/auth/signout">
						<button role="menuitem"><Icon name="logout" size={18} />Sign out</button>
					</form>
				</div>
			{/snippet}
		</Popover>
	</div>
{/snippet}

<div class="shell" class:collapsed>
	<aside class="sidebar">{@render sidebar(false)}</aside>

	<header class="mobile-bar">
		<button class="btn ghost icon-only" aria-label="Open menu" onclick={() => (drawer = true)}><Icon name="menu" size={22} /></button>
		<a href="/dashboard"><Logo size={24} /></a>
		<a href="/transactions?focus=search" class="btn ghost icon-only" aria-label="Search"><Icon name="search" size={21} /></a>
	</header>

	{#if drawer}
		<div class="scrim" transition:fade={{ duration: 150 }} onclick={() => (drawer = false)} role="presentation"></div>
		<aside class="sidebar drawer" transition:fly={{ x: -280, duration: 220 }}>{@render sidebar(true)}</aside>
	{/if}

	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	.shell {
		--sb: var(--sidebar-w);
		display: grid;
		grid-template-columns: var(--sb) minmax(0, 1fr);
		min-height: 100dvh;
		transition: grid-template-columns 0.25s var(--ease);
	}
	.shell.collapsed {
		--sb: 72px;
	}
	.sidebar {
		position: sticky;
		top: 0;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px 12px 14px;
		overflow: hidden auto;
		border-right: 1px solid var(--border);
	}
	.sb-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		height: 44px;
		padding: 0 4px 0 8px;
		margin-bottom: 10px;
	}
	.sb-tools {
		display: flex;
		gap: 2px;
	}
	.collapsed .sidebar:not(.drawer) .sb-top {
		flex-direction: column;
		height: auto;
		padding: 0;
		gap: 10px;
	}
	.collapsed .sidebar:not(.drawer) .sb-tools {
		flex-direction: column;
	}
	nav {
		display: grid;
		gap: 2px;
	}
	.nav-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		height: 42px;
		padding: 0 12px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--ink-2);
		font-size: 14.5px;
		font-weight: 500;
		text-align: left;
		width: 100%;
		transition:
			background 0.12s,
			color 0.12s;
	}
	.nav-item:hover {
		background: color-mix(in oklab, var(--ink) 5%, transparent);
		color: var(--ink);
	}
	.nav-item[aria-current='page'] {
		background: var(--surface-3);
		color: var(--ink);
	}
	.nav-item :global(.icon) {
		color: var(--ink-3);
	}
	.nav-item[aria-current='page'] :global(.icon) {
		color: var(--accent);
	}
	.dot {
		width: 7px;
		height: 7px;
		margin-left: auto;
		border-radius: 50%;
		background: var(--status-critical);
	}
	.collapsed .sidebar:not(.drawer) .label {
		display: none;
	}
	.collapsed .sidebar:not(.drawer) .nav-item {
		justify-content: center;
		padding: 0;
	}
	.collapsed .sidebar:not(.drawer) .dot {
		position: absolute;
		top: 9px;
		right: 12px;
	}
	.sb-bottom {
		margin-top: auto;
		display: grid;
		gap: 2px;
	}
	.sb-bottom :global(.pop-root) {
		display: block;
	}
	.sb-bottom :global(.panel) {
		top: auto;
		bottom: calc(100% + 6px);
	}
	.user {
		height: 52px;
		padding: 0 8px;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		flex: none;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 50%, var(--series-5)));
		color: #fff;
		font-size: 12px;
		font-weight: 600;
	}
	.user-meta {
		display: grid;
		min-width: 0;
		line-height: 1.25;
	}
	.user-name,
	.user-email {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.user-name {
		color: var(--ink);
		font-size: 13.5px;
	}
	.user-email {
		color: var(--ink-3);
		font-size: 12px;
		font-weight: 400;
	}
	.menu {
		padding: 6px;
	}
	.menu a,
	.menu button[role='menuitem'] {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 36px;
		padding: 0 10px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		font-size: 13.5px;
		text-align: left;
		color: var(--ink);
	}
	.menu a:hover,
	.menu button[role='menuitem']:hover {
		background: var(--surface-3);
	}
	.menu form {
		margin: 0;
	}
	.theme-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 6px 10px 10px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--border);
		font-size: 13.5px;
	}
	.theme-row .segmented button {
		height: 26px;
		padding: 0 8px;
		font-size: 12.5px;
	}
	.content {
		min-width: 0;
	}
	.mobile-bar,
	.scrim {
		display: none;
	}

	@media (max-width: 900px) {
		.shell,
		.shell.collapsed {
			grid-template-columns: minmax(0, 1fr);
		}
		.sidebar:not(.drawer) {
			display: none;
		}
		.mobile-bar {
			position: sticky;
			top: 0;
			z-index: 20;
			display: flex;
			align-items: center;
			justify-content: space-between;
			height: 56px;
			padding: 0 8px;
			background: color-mix(in oklab, var(--bg) 85%, transparent);
			backdrop-filter: saturate(1.4) blur(12px);
			border-bottom: 1px solid var(--border);
		}
		.scrim {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 50;
			background: rgba(10, 10, 9, 0.35);
		}
		.drawer {
			position: fixed;
			z-index: 51;
			left: 0;
			top: 0;
			width: min(290px, 86vw);
			background: var(--bg);
			box-shadow: var(--shadow-lg);
		}
	}
</style>
