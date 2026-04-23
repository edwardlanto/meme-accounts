<script lang="ts">
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import {
		Layers, LayoutDashboard, Search, ImagePlus, LogOut, Settings,
		Zap, Sparkles, Wand2, FlaskConical, BarChart3, Grid3X3,
		CalendarDays, PenSquare, ChevronRight
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
				{ href: '/dashboard/brand-studio', label: 'Brand Studio', icon: Wand2 },
				{ href: '/dashboard/studio',       label: 'News Studio',  icon: Layers },
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
</script>

<div class="shell">
	<!-- Sidebar -->
	<aside class="sidebar">
		<!-- Logo -->
		<div class="logo-row">
			<a href="/" class="logo-link">
				<div class="logo-mark">
					<Layers size={12} color="#0a0a0a" />
				</div>
				<div class="logo-text">
					<span class="logo-word">Carousel</span><span class="logo-accent">Studio</span>
				</div>
			</a>
		</div>

		<!-- Create CTA -->
		<div class="create-wrap">
			<a href="/dashboard/carousels/new" class="create-btn">
				<Sparkles size={12} />
				<span>New Carousel</span>
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
							<span class="nav-icon"><Icon size={14} /></span>
							<span class="nav-label">{item.label}</span>
							{#if active}<ChevronRight size={12} class="nav-chevron" />{/if}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		<!-- Credits -->
		<div class="credits-block">
			<div class="credits-head">
				<div class="credits-icon">
					<Zap size={10} />
				</div>
				<div class="credits-info">
					<span class="credits-label">AI Credits</span>
					<span class="credits-count">67 / 100</span>
				</div>
			</div>
			<div class="credits-bar">
				<div class="credits-fill" style="width: 67%">
					<div class="credits-fill-shine"></div>
				</div>
			</div>
			<a href="/dashboard/settings" class="upgrade-link">
				<Sparkles size={10} />
				Upgrade for unlimited
			</a>
		</div>

		<!-- Bottom -->
		<div class="bottom-links">
			<a href="/dashboard/settings" class="bottom-item {currentPath === '/dashboard/settings' ? 'active' : ''}">
				<Settings size={14} />
				<span>Settings</span>
			</a>
			<button onclick={signOut} class="bottom-item signout">
				<LogOut size={14} />
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
		background: #080808;
		color: #fff;
		font-family: 'DM Sans', sans-serif;
		margin: 0;
	}

	.shell {
		display: flex;
		height: 100vh;
		background: #080808;
		overflow: hidden;
	}

	/* ── Sidebar ──────────────────────────────────────────────────── */
	.sidebar {
		width: 230px;
		flex-shrink: 0;
		border-right: 1px solid rgba(255,255,255,0.05);
		background: #0a0a0a;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Logo */
	.logo-row {
		padding: 18px 16px 14px;
		border-bottom: 1px solid rgba(255,255,255,0.04);
		flex-shrink: 0;
	}
	.logo-link {
		display: flex; align-items: center; gap: 10px; text-decoration: none;
	}
	.logo-mark {
		width: 28px; height: 28px; border-radius: 8px;
		background: #E8FF48;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.logo-text {
		font-family: 'Fraunces', serif; font-size: 14px;
		font-weight: 900; letter-spacing: -0.02em;
	}
	.logo-word  { color: rgba(255,255,255,0.75); }
	.logo-accent{ color: #E8FF48; }

	/* Create CTA */
	.create-wrap { padding: 12px 12px 6px; flex-shrink: 0; }
	.create-btn {
		display: flex; align-items: center; justify-content: center; gap: 7px;
		width: 100%; padding: 9px 0;
		border-radius: 10px; background: #E8FF48; color: #0a0a0a;
		font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
		text-decoration: none; transition: all 0.15s;
	}
	.create-btn:hover { background: #f0ff6e; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(232,255,72,0.2); }

	/* Nav groups */
	.nav-list {
		flex: 1; padding: 8px 10px;
		display: flex; flex-direction: column; gap: 0;
		overflow-y: auto;
		scrollbar-width: none;
	}
	.nav-list::-webkit-scrollbar { display: none; }

	.nav-group { margin-bottom: 4px; }

	.nav-group-label {
		font-family: 'Space Mono', monospace; font-size: 8.5px;
		text-transform: uppercase; letter-spacing: 0.12em;
		color: rgba(255,255,255,0.18); padding: 8px 10px 4px;
		margin: 0;
	}

	.nav-item {
		position: relative;
		display: flex; align-items: center; gap: 9px;
		padding: 8px 10px 8px 12px;
		border-radius: 9px;
		font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 400;
		color: rgba(255,255,255,0.32); text-decoration: none;
		transition: all 0.15s; overflow: hidden; margin-bottom: 1px;
	}
	.nav-item:hover { color: rgba(255,255,255,0.72); background: rgba(255,255,255,0.04); }
	.nav-item.active {
		color: #E8FF48;
		background: rgba(232,255,72,0.07);
		font-weight: 500;
	}

	.active-bar {
		position: absolute; left: 0; top: 28%; bottom: 28%;
		width: 2.5px; background: #E8FF48; border-radius: 0 2px 2px 0;
	}

	.nav-icon { display: flex; align-items: center; flex-shrink: 0; }
	.nav-label { flex: 1; }
	:global(.nav-chevron) { opacity: 0.4; }

	/* Credits */
	.credits-block {
		margin: 6px 10px 10px;
		padding: 12px 14px;
		border-radius: 12px;
		background: rgba(255,255,255,0.02);
		border: 1px solid rgba(255,255,255,0.06);
		flex-shrink: 0;
	}
	.credits-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
	.credits-icon {
		width: 22px; height: 22px; border-radius: 6px;
		background: rgba(232,255,72,0.12); color: #E8FF48;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.credits-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
	.credits-label {
		font-family: 'Space Mono', monospace; font-size: 9px;
		text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.35);
	}
	.credits-count {
		font-family: 'Space Mono', monospace; font-size: 11px;
		font-weight: 700; color: rgba(255,255,255,0.65);
	}
	.credits-bar {
		width: 100%; height: 4px; background: rgba(255,255,255,0.06);
		border-radius: 100px; margin-bottom: 8px; overflow: hidden;
	}
	.credits-fill {
		height: 100%; background: linear-gradient(90deg, #E8FF48, #f0ff70);
		border-radius: 100px; position: relative; overflow: hidden;
	}
	.credits-fill-shine {
		position: absolute; top: 0; left: -100%;
		width: 60%; height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
		animation: shine 2.5s ease-in-out infinite;
	}
	@keyframes shine { 0%{left:-100%} 100%{left:200%} }

	.upgrade-link {
		display: inline-flex; align-items: center; gap: 5px;
		font-family: 'Space Mono', monospace; font-size: 9px;
		color: rgba(255,255,255,0.25); text-decoration: none;
		transition: color 0.15s;
	}
	.upgrade-link:hover { color: #E8FF48; }

	/* Bottom */
	.bottom-links {
		border-top: 1px solid rgba(255,255,255,0.04);
		padding: 8px 10px 14px;
		display: flex; flex-direction: column; gap: 1px;
		flex-shrink: 0;
	}
	.bottom-item {
		display: flex; align-items: center; gap: 9px;
		padding: 8px 10px; border-radius: 8px;
		font-family: 'DM Sans', sans-serif; font-size: 13px;
		color: rgba(255,255,255,0.25); text-decoration: none;
		background: transparent; border: none; cursor: pointer; width: 100%; text-align: left;
		transition: all 0.15s;
	}
	.bottom-item:hover { color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.04); }
	.bottom-item.active { color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.04); }
	.bottom-item.signout:hover { color: #f87171; background: rgba(239,68,68,0.06); }

	/* ── Main ────────────────────────────────────────────────────── */
	.main-area {
		flex: 1; overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,0.07) transparent;
		background: #080808;
	}
</style>
