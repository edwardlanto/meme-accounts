<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { TrendingUp, ImagePlus, Search, ArrowRight, Zap } from 'lucide-svelte';

	let carousels: any[] = $state([]);
	let creators: any[] = $state([]);
	let loading = $state(true);

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }

		const [{ data: c }, { data: cr }] = await Promise.all([
			supabase.from('carousels').select('*').order('created_at', { ascending: false }).limit(5),
			supabase.from('creators').select('*').order('created_at', { ascending: false }).limit(5),
		]);
		carousels = c ?? [];
		creators = cr ?? [];
		loading = false;
	});
</script>

<div class="p-8 max-w-5xl">
	<div class="mb-8">
		<h1 class="font-display font-bold text-2xl text-white mb-1">Overview</h1>
		<p class="font-body text-sm text-white/40">What's happening with your content pipeline</p>
	</div>

	<!-- Quick actions -->
	<div class="grid grid-cols-3 gap-4 mb-8">
		<a href="/dashboard/discover"
			class="group p-5 rounded-2xl glass border border-white/[0.05] hover:border-violet-500/25 transition-all cursor-pointer">
			<div class="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center mb-4 group-hover:bg-violet-500/25 transition-colors">
				<Search size={16} class="text-violet-400" />
			</div>
			<h3 class="font-display font-semibold text-sm text-white mb-1">Discover viral posts</h3>
			<p class="font-body text-xs text-white/35 leading-relaxed">Add competitor handles and scrape their top posts</p>
			<div class="flex items-center gap-1 mt-3 text-xs font-mono text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
				Open <ArrowRight size={11} />
			</div>
		</a>

		<a href="/dashboard/carousels/new"
			class="group p-5 rounded-2xl glass border border-white/[0.05] hover:border-cyan-500/25 transition-all cursor-pointer">
			<div class="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center mb-4 group-hover:bg-cyan-500/25 transition-colors">
				<ImagePlus size={16} class="text-cyan-400" />
			</div>
			<h3 class="font-display font-semibold text-sm text-white mb-1">New carousel</h3>
			<p class="font-body text-xs text-white/35 leading-relaxed">Start from a viral template or build from scratch</p>
			<div class="flex items-center gap-1 mt-3 text-xs font-mono text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
				Create <ArrowRight size={11} />
			</div>
		</a>

		<a href="/dashboard/analytics"
			class="group p-5 rounded-2xl glass border border-white/[0.05] hover:border-lime-400/25 transition-all cursor-pointer">
			<div class="w-9 h-9 rounded-xl bg-lime-400/10 flex items-center justify-center mb-4 group-hover:bg-lime-400/18 transition-colors">
				<TrendingUp size={16} class="text-lime-300/90" />
			</div>
			<h3 class="font-display font-semibold text-sm text-white mb-1">Analytics</h3>
			<p class="font-body text-xs text-white/35 leading-relaxed">Queue stats and connected accounts per channel</p>
			<div class="flex items-center gap-1 mt-3 text-xs font-mono text-lime-300/80 opacity-0 group-hover:opacity-100 transition-opacity">
				Open <ArrowRight size={11} />
			</div>
		</a>
	</div>

	<div class="grid grid-cols-2 gap-6">
		<!-- Recent carousels -->
		<div>
			<div class="flex items-center justify-between mb-4">
				<h2 class="font-display font-semibold text-sm text-white">Recent carousels</h2>
				<a href="/dashboard/carousels" class="text-xs font-mono text-violet-400 hover:text-violet-300 transition-colors">View all</a>
			</div>
			{#if loading}
				{#each Array(3) as _}
					<div class="h-14 rounded-xl bg-white/[0.03] animate-pulse mb-2"></div>
				{/each}
			{:else if carousels.length === 0}
				<div class="p-6 rounded-xl glass border border-white/[0.05] text-center">
					<p class="text-xs font-body text-white/30">No carousels yet.</p>
					<a href="/dashboard/carousels/new" class="text-xs font-mono text-violet-400 mt-1 block hover:text-violet-300 transition-colors">Create your first →</a>
				</div>
			{:else}
				{#each carousels as c}
					<a href="/dashboard/editor/{c.id}"
						class="flex items-center gap-3 p-3 rounded-xl glass glass-hover border border-white/[0.04] mb-2 transition-all">
						<div class="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 shrink-0 flex items-center justify-center">
							<ImagePlus size={13} class="text-violet-400" />
						</div>
						<div class="flex-1 min-w-0">
							<p class="font-body text-sm text-white truncate">{c.title}</p>
							<p class="font-mono text-[11px] text-white/30 capitalize">{c.status}</p>
						</div>
					</a>
				{/each}
			{/if}
		</div>

		<!-- Tracked creators -->
		<div>
			<div class="flex items-center justify-between mb-4">
				<h2 class="font-display font-semibold text-sm text-white">Tracked creators</h2>
				<a href="/dashboard/discover" class="text-xs font-mono text-violet-400 hover:text-violet-300 transition-colors">Manage</a>
			</div>
			{#if loading}
				{#each Array(3) as _}
					<div class="h-14 rounded-xl bg-white/[0.03] animate-pulse mb-2"></div>
				{/each}
			{:else if creators.length === 0}
				<div class="p-6 rounded-xl glass border border-white/[0.05] text-center">
					<p class="text-xs font-body text-white/30">No competitors tracked yet.</p>
					<a href="/dashboard/discover" class="text-xs font-mono text-violet-400 mt-1 block hover:text-violet-300 transition-colors">Add a competitor →</a>
				</div>
			{:else}
				{#each creators as cr}
					<a href="/dashboard/discover"
						class="flex items-center gap-3 p-3 rounded-xl glass glass-hover border border-white/[0.04] mb-2 transition-all">
						<div class="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-xs font-bold font-mono text-violet-400 shrink-0">
							{cr.instagram_handle.slice(0,2).toUpperCase()}
						</div>
						<div class="flex-1 min-w-0">
							<p class="font-body text-sm text-white">@{cr.instagram_handle}</p>
							<p class="font-mono text-[11px] text-white/30">{cr.niche ?? 'No niche set'}</p>
						</div>
						<Zap size={11} class="text-violet-400 shrink-0" />
					</a>
				{/each}
			{/if}
		</div>
	</div>
</div>
