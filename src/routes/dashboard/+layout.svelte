<script lang="ts">
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import {
		Layers, LayoutDashboard, Search, ImagePlus,
		Sparkles, Wand2, FlaskConical, BarChart3, Grid3X3,
		CalendarDays, PenSquare
	} from 'lucide-svelte';
	import TwoLevelSidebar from '$lib/components/TwoLevelSidebar.svelte';

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
				{ href: '/dashboard/brand-carousel',  label: 'Brand Carousel',   icon: Wand2 },
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
	let sidebarRailOnly = $derived(
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
	<div class="sidebar-shell">
		<TwoLevelSidebar
			navGroups={navGroups}
			currentPath={currentPath}
			theme={theme}
			railOnly={sidebarRailOnly}
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
		background: var(--app-bg);
		overflow: hidden;
	}

	.sidebar-shell { padding: 0; flex-shrink: 0; }

	/* ── Main ────────────────────────────────────────────────────── */
	.main-area {
		flex: 1; overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--app-scroll-thumb) transparent;
		background: var(--app-bg);
	}
</style>
