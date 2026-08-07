<script lang="ts">
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import {
		LayoutDashboard, ImagePlus, Settings,
		// Search, FlaskConical, BarChart3, CalendarDays, Plug,
		Rows3,
		Video,
		LayoutTemplate,
	} from 'lucide-svelte';
	import TwoLevelSidebar from '$lib/components/TwoLevelSidebar.svelte';

	let { children, data } = $props();

	const navGroups = [
		{
			label: 'Create',
			items: [
				{ href: '/dashboard',              label: 'Overview',     icon: LayoutDashboard },
				{ href: '/dashboard/templates',    label: 'Templates',    icon: LayoutTemplate },
				{ href: '/dashboard/carousels',    label: 'Carousels',    icon: ImagePlus },
				{ href: '/dashboard/bulk',         label: 'Bulk',         icon: Rows3 },
				{ href: '/dashboard/videos',       label: 'Videos',       icon: Video },
			]
		},
		{
			label: 'Account',
			items: [
				{ href: '/dashboard/settings',      label: 'Settings',      icon: Settings },
				// { href: '/dashboard/integrations',  label: 'Integrations',  icon: Plug },
			]
		},
		// {
		// 	label: 'Grow',
		// 	items: [
		// 		{ href: '/dashboard/discover',     label: 'Discover',     icon: Search },
		// 		{ href: '/dashboard/analytics',    label: 'Analytics',    icon: BarChart3 },
		// 		{ href: '/dashboard/post-scheduler', label: 'Scheduler',  icon: CalendarDays },
		// 		{ href: '/dashboard/post-tests',   label: 'Post Tests',   icon: FlaskConical },
		// 	]
		// },
	];

	async function signOut() {
		if (!data.user) {
			goto('/login?next=/dashboard/settings');
			return;
		}
		await supabase.auth.signOut();
		goto('/login?next=/dashboard/settings');
	}

	const signedIn = $derived(!!data.user);

	let currentPath = $derived($page.url.pathname);
	let sidebarRailOnly = $derived(
		currentPath.startsWith('/dashboard/editor/')
	);

	type ThemeMode = 'light' | 'dark';
	let theme = $state<ThemeMode>('light');
	function applyTheme(next: ThemeMode) {
		// Product is light-only — ignore dark requests and clear any stale preference.
		theme = 'light';
		document.documentElement.dataset.theme = 'light';
		try { localStorage.setItem('theme', 'light'); } catch { /* ignore */ }
		void next;
	}
	if (typeof window !== 'undefined') {
		applyTheme('light');
	}
</script>

<div class="shell">
	<!-- Sidebar -->
	<div class="sidebar-shell">
		<TwoLevelSidebar
			navGroups={navGroups}
			currentPath={currentPath}
			theme={theme}
			railOnly={sidebarRailOnly}
			signedIn={signedIn}
			onThemeToggle={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
			onSignOut={signOut}
		/>
	</div>

	<!-- Main -->
	<main class="main-area">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		background: var(--app-bg);
		color: var(--app-text);
		font-family: var(--font-sans);
		margin: 0;
	}

	.shell {
		display: flex;
		height: 100vh;
		background: var(--app-surface);
		overflow: hidden;
	}

	.sidebar-shell { padding: 0; flex-shrink: 0; }

	/* ── Main ────────────────────────────────────────────────────── */
	.main-area {
		flex: 1; overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--app-scroll-thumb) transparent;
		background: var(--app-surface);
	}
</style>
