<script lang="ts">
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { Layers, LayoutDashboard, Search, ImagePlus, LogOut, Settings, ChevronRight, Zap } from 'lucide-svelte';

	let { children } = $props();

	const nav = [
		{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
		{ href: '/dashboard/discover', label: 'Discover', icon: Search },
		{ href: '/dashboard/carousels', label: 'Carousels', icon: ImagePlus },
	];

	async function signOut() {
		await supabase.auth.signOut();
		goto('/login');
	}

	let currentPath = $derived($page.url.pathname);
</script>

<div class="flex h-screen bg-[#0a0a0a] overflow-hidden">
	<!-- Sidebar -->
	<aside class="w-56 flex flex-col shrink-0 border-r border-white/[0.05] bg-[#0d0d0d]">
		<!-- Logo -->
		<div class="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.04]">
			<div class="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
				<Layers size={13} color="white" />
			</div>
			<span class="font-display font-bold text-sm text-white">Carousel<span class="gradient-text">Studio</span></span>
		</div>

		<!-- Nav -->
		<nav class="flex-1 px-3 py-4 flex flex-col gap-0.5">
			{#each nav as item}
				{@const active = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))}
				<a href={item.href}
					class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body transition-all duration-150
						{active ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20' : 'text-white/40 hover:text-white hover:bg-white/[0.04]'}">
					<svelte:component this={item.icon} size={15} />
					{item.label}
					{#if active}<ChevronRight size={12} class="ml-auto opacity-60" />{/if}
				</a>
			{/each}
		</nav>

		<!-- Credits pill -->
		<div class="mx-3 mb-3 p-3 rounded-xl glass border border-violet-500/10">
			<div class="flex items-center justify-between mb-1.5">
				<span class="text-[11px] font-mono text-white/30 uppercase tracking-wider">AI Credits</span>
				<Zap size={11} class="text-violet-400" />
			</div>
			<div class="w-full h-1 bg-white/[0.06] rounded-full mb-1.5">
				<div class="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"></div>
			</div>
			<p class="text-[11px] font-mono text-white/30">67 / 100 used</p>
		</div>

		<!-- Bottom -->
		<div class="px-3 pb-4 flex flex-col gap-0.5 border-t border-white/[0.04] pt-3">
			<a href="/dashboard/settings"
				class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body text-white/40 hover:text-white hover:bg-white/[0.04] transition-all">
				<Settings size={15} />
				Settings
			</a>
			<button onclick={signOut}
				class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body text-white/40 hover:text-red-400 hover:bg-red-500/[0.06] transition-all w-full text-left">
				<LogOut size={15} />
				Sign out
			</button>
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex-1 overflow-y-auto">
		{@render children()}
	</main>
</div>
