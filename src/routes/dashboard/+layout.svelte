<script lang="ts">
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import {
		Layers, LayoutDashboard, Search, ImagePlus, LogOut, Settings,
		Sparkles, Wand2, FlaskConical, BarChart3, Grid3X3,
		CalendarDays, PenSquare, ChevronRight, ArrowUpRight, Sun, Moon
	} from 'lucide-svelte';

	let { children } = $props();

	const navGroups = [
		{
			label: 'Create',
			items: [
				{ href: '/dashboard',              label: 'Overview',     icon: LayoutDashboard },
				{ href: '/dashboard/carousels',    label: 'Carousels',    icon: ImagePlus },
				{ href: '/dashboard/composer',     label: 'Composer',     icon: PenSquare },
				{ href: '/dashboard/grid',         label: 'Grid',         icon: Grid3X3 },
			]
		},
		{
			label: 'Studios',
			items: [
				{ href: '/dashboard/slideshows',  label: 'Slideshows',   icon: Wand2 },
				{ href: '/dashboard/studio?template=news',       label: 'News Studio',  icon: Layers },
			]
		},
		{
			label: 'Brand',
			items: [
				{ href: '/dashboard/branding',   label: 'Branding',     icon: Layers },
			]
		},
		{
			label: 'Grow',
			items: [
				{ href: '/dashboard/discover',     label: 'Discover',     icon: Search },
				{ href: '/dashboard/analytics',    label: 'Analytics',    icon: BarChart3 },
				{ href: '/dashboard/post-scheduler', label: 'Scheduler',  icon: CalendarDays },
				{ href: '/dashboard/post-tests',   label: 'Post Tests',   icon: FlaskConical },
			]
		},
	];

	async function signOut() {
		await supabase.auth.signOut();
		goto('/login');
	}

	let currentPath = $derived($page.url.pathname);
	let sidebarCollapsed = $derived(
		currentPath === '/dashboard/studio' || currentPath.startsWith('/dashboard/editor/')
	);

	type ThemeMode = 'light' | 'dark';
	let theme = $state<ThemeMode>('light');
	function applyTheme(next: ThemeMode) {
		theme = next;
		document.documentElement.dataset.theme = next;
		try { localStorage.setItem('theme', next); } catch { /* ignore */ }
	}
	// Initialize from already-applied theme (app.html sets it before paint)
	if (typeof window !== 'undefined') {
		const t = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
		theme = t;
	}
</script>

<div class="shell">
	<!-- Sidebar -->
	<aside class="sidebar" class:collapsed={sidebarCollapsed}>
		<!-- Logo -->
		<div class="logo-row">
			<a href="/" class="logo-link" title="Carousel Studio">
				<div class="logo-mark">
					<span class="logo-initials">CS</span>
				</div>
				<div class="logo-text">
					<span class="logo-word">Carousel</span><span class="logo-accent">Studio</span>
				</div>
			</a>
		</div>

		<!-- Nav groups -->
		<nav class="nav-list">
			{#each navGroups as group}
				<div class="nav-group">
					<p class="nav-group-label">{group.label}</p>
					{#each group.items as item}
						{@const active = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))}
						{@const Icon = item.icon}
						<a
							href={item.href}
							class="nav-item {active ? 'active' : ''}"
						>
							{#if active}<div class="active-bar"></div>{/if}
							<span class="nav-icon"><Icon size={20} /></span>
							<span class="nav-label">{item.label}</span>
							{#if active}<ChevronRight size={12} class="nav-chevron" />{/if}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		<!-- Upgrade block -->
		<div class="upgrade-block">
			<p class="upgrade-kicker">Earn 3,000 credits</p>
			<a href="/dashboard/settings" class="upgrade-btn">
				<span class="upgrade-btn-label">Upgrade</span>
				<ArrowUpRight size={14} />
			</a>
			<a href="/signup" class="upgrade-link">Sign in</a>
		</div>

		<!-- Bottom -->
		<div class="bottom-links">
			<button
				type="button"
				onclick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
				class="bottom-item"
				title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
			>
				{#if theme === 'dark'}
					<Sun size={20} />
					<span>Light</span>
				{:else}
					<Moon size={20} />
					<span>Dark</span>
				{/if}
			</button>
			<a href="/dashboard/settings" class="bottom-item {currentPath === '/dashboard/settings' ? 'active' : ''}">
				<Settings size={20} />
				<span>Settings</span>
			</a>
			<button onclick={signOut} class="bottom-item signout">
				<LogOut size={20} />
				<span>Sign out</span>
			</button>
		</div>
	</aside>

	<!-- Main -->
	<main class="main-area">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		background: var(--app-bg);
		color: var(--app-text);
		font-family: 'DM Sans', sans-serif;
		margin: 0;
	}

	.shell {
		display: flex;
		height: 100vh;
		background: var(--app-bg);
		overflow: hidden;
	}

	/* ── Sidebar ──────────────────────────────────────────────────── */
	.sidebar {
		width: 260px;
		flex-shrink: 0;
		border-right: 1px solid var(--app-border);
		background: var(--app-surface-2);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.sidebar.collapsed { width: 92px; }

	/* Logo */
	.logo-row {
		padding: 16px 10px 12px;
		border-bottom: 1px solid var(--app-border);
		flex-shrink: 0;
	}
	.logo-link {
		display: flex; align-items: center; justify-content: flex-start; gap: 10px; text-decoration: none;
		padding: 0 8px;
	}
	.logo-mark {
		width: 30px; height: 30px; border-radius: 10px;
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
		border: 1px solid var(--app-border);
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.logo-initials {
		font-family: 'Space Mono', monospace;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: var(--app-text-2);
	}
	.logo-text {
		font-family: 'Fraunces', serif; font-size: 14px;
		font-weight: 900; letter-spacing: -0.02em;
	}
	.logo-word  { color: var(--app-text-2); }
	.logo-accent{ color: #E8FF48; }

	/* Nav groups */
	.nav-list {
		flex: 1; padding: 10px 10px;
		display: flex; flex-direction: column; gap: 0;
		overflow-y: auto;
		scrollbar-width: none;
	}
	.nav-list::-webkit-scrollbar { display: none; }

	.nav-group { margin-bottom: 4px; }

	.nav-group-label {
		font-family: 'Space Mono', monospace; font-size: 8.5px;
		text-transform: uppercase; letter-spacing: 0.12em;
		color: var(--app-text-3); padding: 10px 10px 6px;
		margin: 0;
	}

	.nav-item {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 12px;
		font-family: 'DM Sans', sans-serif;
		font-size: 11px;
		font-weight: 500;
		color: var(--app-text-2); text-decoration: none;
		transition: transform 0.15s, background 0.15s, color 0.15s;
		overflow: hidden;
		margin-bottom: 4px;
	}
	.nav-item:hover {
		color: var(--app-text);
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
		transform: translateY(-1px);
	}
	.nav-item.active {
		color: var(--app-text);
		background: color-mix(in oklab, var(--app-text) 8%, transparent);
		font-weight: 500;
	}

	.active-bar {
		position: absolute;
		left: 6px;
		top: 10px;
		bottom: 10px;
		width: 3px;
		background: color-mix(in oklab, var(--app-text) 70%, transparent);
		border-radius: 999px;
	}

	.nav-icon { display: flex; align-items: center; flex-shrink: 0; }
	.nav-label { text-align: left; line-height: 1.05; }
	:global(.nav-chevron) { display: none; }

	/* Collapsed rail tweaks */
	.sidebar.collapsed .logo-link { justify-content: center; padding: 0; }
	.sidebar.collapsed .logo-text { display: none; }
	.sidebar.collapsed .nav-group-label { display: none; }
	.sidebar.collapsed .nav-item {
		flex-direction: column;
		justify-content: center;
		gap: 6px;
		padding: 10px 8px;
	}
	.sidebar.collapsed .nav-label { text-align: center; }
	.sidebar.collapsed .active-bar {
		left: 18%;
		right: 18%;
		top: auto;
		bottom: 6px;
		width: auto;
		height: 2px;
	}

	/* Upgrade */
	.upgrade-block {
		margin: 8px 10px 10px;
		padding: 10px;
		border-radius: 14px;
		background: linear-gradient(180deg, color-mix(in oklab, var(--app-text) 6%, transparent), color-mix(in oklab, var(--app-text) 3%, transparent));
		border: 1px solid var(--app-border);
		flex-shrink: 0;
	}
	.upgrade-kicker {
		display: block;
		margin: 0 0 10px;
		font-family: 'Space Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.08em;
		color: var(--app-text-3);
	}
	.upgrade-btn {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 10px;
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(99,102,241,0.85), rgba(59,130,246,0.85));
		border: 1px solid rgba(255,255,255,0.12);
		color: #fff;
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
		transition: transform 0.15s, filter 0.15s;
	}
	.upgrade-btn:hover { transform: translateY(-1px); filter: brightness(1.05); }
	.upgrade-btn-label { display: none; }
	.sidebar:not(.collapsed) .upgrade-btn-label { display: inline; }
	.upgrade-link {
		display: block;
		margin-top: 8px;
		text-align: center;
		font-family: 'Space Mono', monospace;
		font-size: 10px;
		color: rgba(255,255,255,0.28);
		text-decoration: none;
	}
	.upgrade-link:hover { color: rgba(255,255,255,0.55); }
	.sidebar:not(.collapsed) .upgrade-link { display: block; }

	/* Bottom */
	.bottom-links {
		border-top: 1px solid var(--app-border);
		padding: 8px 10px 14px;
		display: flex; flex-direction: column; gap: 1px;
		flex-shrink: 0;
	}
	.bottom-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 12px;
		font-family: 'DM Sans', sans-serif;
		font-size: 11px;
		font-weight: 500;
		color: var(--app-text-2); text-decoration: none;
		background: transparent; border: none; cursor: pointer; width: 100%; text-align: left;
		transition: all 0.15s;
	}
	.sidebar.collapsed .bottom-item {
		flex-direction: column;
		justify-content: center;
		gap: 6px;
		padding: 10px 8px;
	}
	.bottom-item:hover { color: var(--app-text); background: color-mix(in oklab, var(--app-text) 6%, transparent); transform: translateY(-1px); }
	.bottom-item.active { color: var(--app-text); background: color-mix(in oklab, var(--app-text) 6%, transparent); }
	.bottom-item.signout:hover { color: #f87171; background: rgba(239,68,68,0.06); }

	/* ── Main ────────────────────────────────────────────────────── */
	.main-area {
		flex: 1; overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--app-scroll-thumb) transparent;
		background: var(--app-bg);
	}
</style>
