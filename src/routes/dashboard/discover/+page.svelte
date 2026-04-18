<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Search, Plus, Zap, Trash2, RefreshCw, ExternalLink, Heart, MessageCircle, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-svelte';

	let creators: any[] = $state([]);
	let viralPosts: any[] = $state([]);
	let loading = $state(true);
	let addHandle = $state('');
	let addNiche = $state('');
	let adding = $state(false);
	let addError = $state('');
	let scrapingId = $state<string | null>(null);
	let analyzingPostId = $state<string | null>(null);
	let expandedCreator = $state<string | null>(null);
	let showAddForm = $state(false);
	let userId = $state('');

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;
		await loadData();
	});

	async function loadData() {
		loading = true;
		const [{ data: c }, { data: p }] = await Promise.all([
			supabase.from('creators').select('*').order('created_at', { ascending: false }),
			supabase.from('viral_posts').select('*, creators(instagram_handle)').order('likes', { ascending: false }).limit(50),
		]);
		creators = c ?? [];
		viralPosts = p ?? [];
		loading = false;
	}

	async function addCreator() {
		if (!addHandle.trim()) return;
		adding = true;
		addError = '';
		const handle = addHandle.trim().replace('@', '');
		const { error } = await supabase.from('creators').insert({
			user_id: userId,
			instagram_handle: handle,
			niche: addNiche || null,
		});
		if (error) { addError = error.message; adding = false; return; }
		addHandle = '';
		addNiche = '';
		showAddForm = false;
		adding = false;
		await loadData();
	}

	async function scrapeCreator(creatorId: string) {
		scrapingId = creatorId;
		try {
			const res = await fetch('/api/scrape', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ creatorId }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Scrape failed');
			await loadData();
		} catch (e: any) {
			alert(e.message);
		}
		scrapingId = null;
	}

	async function deleteCreator(creatorId: string) {
		if (!confirm('Remove this creator and all their scraped posts?')) return;
		await supabase.from('viral_posts').delete().eq('creator_id', creatorId);
		await supabase.from('creators').delete().eq('id', creatorId);
		await loadData();
	}

	async function analyzePost(postId: string) {
		analyzingPostId = postId;
		try {
			const res = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ postId }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			await loadData();
		} catch (e: any) {
			alert(e.message);
		}
		analyzingPostId = null;
	}

	async function remixPost(post: any) {
		// Create a new carousel from this post's analysis
		const title = post.hook ? `Remix: ${post.hook.slice(0, 40)}...` : `Remix of @${post.creators?.instagram_handle}`;
		const { data, error } = await supabase.from('carousels').insert({
			user_id: userId,
			title,
			status: 'draft',
			slides: JSON.stringify([
				{ id: '1', text: post.hook ?? 'Your hook here', type: 'hook', bg: '#111111', textColor: '#ffffff' },
				{ id: '2', text: 'Slide 2', type: 'body', bg: '#111111', textColor: '#ffffff' },
				{ id: '3', text: 'Slide 3', type: 'body', bg: '#111111', textColor: '#ffffff' },
				{ id: '4', text: 'Follow for more!', type: 'cta', bg: '#111111', textColor: '#8B5CF6' },
			]),
			source_post_id: post.id,
		}).select().single();
		if (!error && data) goto(`/dashboard/editor/${data.id}`);
	}

	function postsForCreator(creatorId: string) {
		return viralPosts.filter(p => p.creator_id === creatorId);
	}

	function fmtNum(n: number) {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return String(n);
	}
</script>

<div class="p-8 max-w-5xl">
	<!-- Header -->
	<div class="flex items-start justify-between mb-8">
		<div>
			<h1 class="font-display font-bold text-2xl text-white mb-1">Discover</h1>
			<p class="font-body text-sm text-white/40">Track competitors, scrape viral posts, generate AI hooks</p>
		</div>
		<button onclick={() => showAddForm = !showAddForm}
			class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all">
			<Plus size={14} />
			Add creator
		</button>
	</div>

	<!-- Add creator form -->
	{#if showAddForm}
		<div class="glass border border-violet-500/20 rounded-2xl p-6 mb-6">
			<h3 class="font-display font-semibold text-sm text-white mb-4">Track a new creator</h3>
			{#if addError}
				<div class="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
					<AlertCircle size={13} class="text-red-400" />
					<p class="text-xs font-body text-red-400">{addError}</p>
				</div>
			{/if}
			<form onsubmit={(e) => { e.preventDefault(); addCreator(); }} class="flex gap-3 items-end">
				<div class="flex-1 flex flex-col gap-1.5">
					<label class="text-xs font-mono text-white/40 uppercase tracking-wider">Instagram handle</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-mono">@</span>
						<input bind:value={addHandle} required placeholder="garyvee"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-7 pr-4 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
					</div>
				</div>
				<div class="w-40 flex flex-col gap-1.5">
					<label class="text-xs font-mono text-white/40 uppercase tracking-wider">Niche (optional)</label>
					<input bind:value={addNiche} placeholder="Marketing"
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-4 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
				</div>
				<button type="submit" disabled={adding}
					class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-50 shrink-0">
					{adding ? 'Adding...' : 'Track'}
				</button>
				<button type="button" onclick={() => showAddForm = false}
					class="px-4 py-2.5 rounded-xl text-sm font-body text-white/40 hover:text-white glass glass-hover transition-all shrink-0">
					Cancel
				</button>
			</form>
		</div>
	{/if}

	{#if loading}
		<div class="flex flex-col gap-3">
			{#each Array(3) as _}
				<div class="h-20 rounded-2xl bg-white/[0.03] animate-pulse"></div>
			{/each}
		</div>
	{:else if creators.length === 0}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-5">
				<Search size={22} class="text-violet-400" />
			</div>
			<h3 class="font-display font-semibold text-base text-white mb-2">No creators tracked yet</h3>
			<p class="font-body text-sm text-white/35 max-w-sm mb-6">Add an Instagram handle to start scraping their viral posts and extracting what makes them work.</p>
			<button onclick={() => showAddForm = true}
				class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]">
				<Plus size={14} /> Add your first creator
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each creators as creator}
				{@const posts = postsForCreator(creator.id)}
				{@const isExpanded = expandedCreator === creator.id}
				{@const isScraping = scrapingId === creator.id}

				<div class="rounded-2xl glass border border-white/[0.05] overflow-hidden">
					<!-- Creator row -->
					<div class="flex items-center gap-4 p-4">
						<div class="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/25 to-cyan-500/25 border border-white/10 flex items-center justify-center font-bold font-mono text-sm text-violet-300 shrink-0">
							{creator.instagram_handle.slice(0,2).toUpperCase()}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<p class="font-display font-semibold text-sm text-white">@{creator.instagram_handle}</p>
								{#if creator.niche}
									<span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/15">{creator.niche}</span>
								{/if}
							</div>
							<p class="font-mono text-[11px] text-white/30 mt-0.5">
								{posts.length} post{posts.length !== 1 ? 's' : ''} scraped
								{#if creator.last_scraped_at} · Last scraped {new Date(creator.last_scraped_at).toLocaleDateString()}{/if}
							</p>
						</div>

						<div class="flex items-center gap-2 shrink-0">
							<button onclick={() => scrapeCreator(creator.id)} disabled={!!scrapingId}
								class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-body text-white bg-violet-600/80 hover:bg-violet-500 transition-colors disabled:opacity-50">
								<RefreshCw size={11} class={isScraping ? 'animate-spin' : ''} />
								{isScraping ? 'Scraping...' : 'Scrape'}
							</button>
							{#if posts.length > 0}
								<button onclick={() => expandedCreator = isExpanded ? null : creator.id}
									class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-body text-white/50 glass glass-hover transition-all">
									{isExpanded ? 'Hide' : 'View posts'}
									{#if isExpanded}<ChevronUp size={11} />{:else}<ChevronDown size={11} />{/if}
								</button>
							{/if}
							<button onclick={() => deleteCreator(creator.id)}
								class="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
								<Trash2 size={13} />
							</button>
						</div>
					</div>

					<!-- Posts panel -->
					{#if isExpanded && posts.length > 0}
						<div class="border-t border-white/[0.04] p-4 pt-3">
							<div class="grid grid-cols-1 gap-2">
								{#each posts as post}
									{@const isAnalyzing = analyzingPostId === post.id}
									<div class="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.07] transition-all">
										<!-- Stats -->
										<div class="flex flex-col gap-1 shrink-0 w-20">
											<div class="flex items-center gap-1 text-[11px] font-mono text-white/40">
												<Heart size={9} class="text-pink-400" /> {fmtNum(post.likes)}
											</div>
											<div class="flex items-center gap-1 text-[11px] font-mono text-white/40">
												<MessageCircle size={9} class="text-cyan-400" /> {fmtNum(post.comments)}
											</div>
											{#if post.engagement_rate}
												<div class="flex items-center gap-1 text-[11px] font-mono text-white/40">
													<TrendingUp size={9} class="text-violet-400" /> {post.engagement_rate.toFixed(1)}%
												</div>
											{/if}
										</div>

										<!-- Content -->
										<div class="flex-1 min-w-0">
											{#if post.hook}
												<p class="font-body text-xs text-cyan-300 mb-1 font-medium">Hook: {post.hook}</p>
											{/if}
											{#if post.caption}
												<p class="font-body text-xs text-white/40 leading-relaxed line-clamp-2">{post.caption}</p>
											{/if}
											{#if post.ai_analysis}
												<div class="mt-2 p-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
													<p class="text-[10px] font-mono text-violet-400 mb-1">AI Analysis</p>
													<p class="text-[11px] font-body text-white/50 leading-relaxed">
														{typeof post.ai_analysis === 'string' ? post.ai_analysis : JSON.stringify(post.ai_analysis)?.slice(0,200)}...
													</p>
												</div>
											{/if}
										</div>

										<!-- Actions -->
										<div class="flex flex-col gap-1.5 shrink-0">
											{#if !post.ai_analysis}
												<button onclick={() => analyzePost(post.id)} disabled={!!analyzingPostId}
													class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-body text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/15 transition-all disabled:opacity-40">
													<Sparkles size={10} class={isAnalyzing ? 'animate-pulse' : ''} />
													{isAnalyzing ? 'Analyzing...' : 'AI Analyze'}
												</button>
											{/if}
											<button onclick={() => remixPost(post)}
												class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-body text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/15 transition-all">
												<Zap size={10} />
												Remix
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
