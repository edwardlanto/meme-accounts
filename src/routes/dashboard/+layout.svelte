<script lang="ts">
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { Layers, LayoutDashboard, Search, ImagePlus, LogOut, Settings, Zap, Newspaper, Video, Sparkles, Bird, Type, FileText } from 'lucide-svelte';

	let { children } = $props();

	const nav = [
		{ href: '/dashboard',                label: 'Overview',      icon: LayoutDashboard },
		{ href: '/dashboard/carousels',      label: 'Carousels',     icon: ImagePlus },
		{ href: '/dashboard/studio',         label: 'News Studio',   icon: Newspaper },
		{ href: '/dashboard/tweet-studio',   label: 'Tweet Studio',  icon: Bird },
		{ href: '/dashboard/text-studio',    label: 'Text Studio',     icon: Type },
		{ href: '/dashboard/article-studio', label: 'Article Studio',  icon: FileText },
		{ href: '/dashboard/discover',       label: 'Discover',        icon: Search },
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
			<div class="logo-mark">
				<Layers size={13} color="#0a0a0a" />
			</div>
			<div class="logo-text">
				<span class="logo-word">Carousel</span><span class="logo-accent">Studio</span>
			</div>
		</div>

		<!-- Create CTA -->
		<div class="create-wrap">
			<a href="/dashboard/carousels/new" class="create-btn">
				<Sparkles size={13} />
				<span>New Carousel</span>
			</a>
		</div>

		<!-- Nav -->
		<nav class="nav-list">
			{#each nav as item}
				{@const active = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))}
				<a
					href={item.href}
					class="nav-item {active ? 'active' : ''}"
				>
					<svelte:component this={item.icon} size={15} />
					<span>{item.label}</span>
					{#if active}<div class="active-bar"></div>{/if}
				</a>
			{/each}
		</nav>

		<!-- Credits -->
		<div class="credits-block">
			<div class="credits-head">
				<span class="credits-label">AI Credits</span>
				<Zap size={10} class="lime" />
			</div>
			<div class="credits-bar">
				<div class="credits-fill" style="width: 67%"></div>
			</div>
			<p class="credits-count">67 / 100 used</p>
		</div>

		<!-- Bottom links -->
		<div class="bottom-links">
			<a href="/dashboard/settings" class="bottom-item">
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
	}

	.shell {
		display: flex;
		height: 100vh;
		background: #080808;
		overflow: hidden;
	}

	/* ── Sidebar ──────────────────────────────────────────────────────────── */
	.sidebar {
		width: 220px;
		flex-shrink: 0;
		border-right: 1px solid rgba(255,255,255,0.05);
		background: #0a0a0a;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.logo-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 20px 18px 16px;
		border-bottom: 1px solid rgba(255,255,255,0.04);
		flex-shrink: 0;
	}

	.logo-mark {
		width: 28px; height: 28px;
		border-radius: 8px;
		background: #E8FF48;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}

	.logo-text {
		font-family: 'Fraunces', serif;
		font-size: 14px;
		font-weight: 900;
		letter-spacing: -0.01em;
	}

	.logo-word { color: rgba(255,255,255,0.8); }
	.logo-accent { color: #E8FF48; }

	.create-wrap {
		padding: 14px 12px 8px;
		flex-shrink: 0;
	}

	.create-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		width: 100%;
		padding: 9px 0;
		border-radius: 10px;
		background: #E8FF48;
		color: #0a0a0a;
		font-family: 'DM Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.15s;
	}
	.create-btn:hover {
		background: #f0ff6e;
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(232,255,72,0.2);
	}

	.nav-list {
		flex: 1;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.nav-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 10px;
		border-radius: 9px;
		font-family: 'DM Sans', sans-serif;
		font-size: 13px;
		font-weight: 400;
		color: rgba(255,255,255,0.35);
		text-decoration: none;
		transition: all 0.15s;
		overflow: hidden;
	}
	.nav-item:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.04); }
	.nav-item.active {
		color: #E8FF48;
		background: rgba(232,255,72,0.07);
		font-weight: 500;
	}

	.active-bar {
		position: absolute;
		left: 0; top: 25%; bottom: 25%;
		width: 2.5px;
		background: #E8FF48;
		border-radius: 0 2px 2px 0;
	}

	/* ── Credits ─────────────────────────────────────────────────────────── */
	.credits-block {
		margin: 0 10px 10px;
		padding: 12px 14px;
		border-radius: 10px;
		background: rgba(232,255,72,0.04);
		border: 1px solid rgba(232,255,72,0.1);
		flex-shrink: 0;
	}

	.credits-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.credits-label {
		font-family: 'Space Mono', monospace;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgba(255,255,255,0.25);
	}

	.credits-bar {
		width: 100%;
		height: 3px;
		background: rgba(255,255,255,0.06);
		border-radius: 100px;
		margin-bottom: 6px;
		overflow: hidden;
	}

	.credits-fill {
		height: 100%;
		background: #E8FF48;
		border-radius: 100px;
	}

	.credits-count {
		font-family: 'Space Mono', monospace;
		font-size: 9px;
		color: rgba(255,255,255,0.2);
		margin: 0;
	}

	/* ── Bottom ──────────────────────────────────────────────────────────── */
	.bottom-links {
		border-top: 1px solid rgba(255,255,255,0.04);
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex-shrink: 0;
	}

	.bottom-item {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 8px 10px;
		border-radius: 8px;
		font-family: 'DM Sans', sans-serif;
		font-size: 13px;
		color: rgba(255,255,255,0.25);
		text-decoration: none;
		background: transparent;
		border: none;
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: all 0.15s;
	}
	.bottom-item:hover { color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.04); }
	.bottom-item.signout:hover { color: #f87171; background: rgba(239,68,68,0.06); }

	/* ── Main ────────────────────────────────────────────────────────────── */
	.main-area {
		flex: 1;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,0.07) transparent;
	}

	:global(.lime) { color: #E8FF48; }
</style>
