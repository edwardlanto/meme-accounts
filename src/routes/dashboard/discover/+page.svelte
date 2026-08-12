<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Search, Plus, Zap, Trash2, RefreshCw, Heart, MessageCircle, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Sparkles, Users } from 'lucide-svelte';

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
		adding = true; addError = '';
		const handle = addHandle.trim().replace('@', '');
		const { error } = await supabase.from('creators').insert({
			user_id: userId, instagram_handle: handle, niche: addNiche || null,
		});
		if (error) { addError = error.message; adding = false; return; }
		addHandle = ''; addNiche = ''; showAddForm = false; adding = false;
		await loadData();
	}

	async function scrapeCreator(creatorId: string) {
		scrapingId = creatorId;
		try {
			const res = await fetch('/api/scrape', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ creatorId }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Scrape failed');
			await loadData();
		} catch (e: any) { alert(e.message); }
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
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ postId }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			await loadData();
		} catch (e: any) { alert(e.message); }
		analyzingPostId = null;
	}

	async function remixPost(post: any) {
		const title = post.hook ? `Remix: ${post.hook.slice(0, 40)}...` : `Remix of @${post.creators?.instagram_handle}`;
		const { data, error } = await supabase.from('carousels').insert({
			user_id: userId, title, status: 'draft',
			slides: JSON.stringify([
				{ id: '1', text: post.hook ?? 'Your hook here', type: 'hook', bg: '#111111', textColor: '#ffffff' },
				{ id: '2', text: 'Slide 2', type: 'body', bg: '#111111', textColor: '#ffffff' },
				{ id: '3', text: 'Slide 3', type: 'body', bg: '#111111', textColor: '#ffffff' },
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

	function initials(handle: string) {
		return handle.slice(0, 2).toUpperCase();
	}
</script>

<div class="page dash-page">
	<!-- Header -->
	<div class="page-head">
		<div class="head-left">
			<div class="head-icon">
				<Search size={16} />
			</div>
			<div>
				<h1 class="page-title dash-page-title">Discover</h1>
			</div>
		</div>
		<button onclick={() => showAddForm = !showAddForm} class="add-btn">
			<Plus size={14} />
			Track creator
		</button>
	</div>

	<!-- Add creator form -->
	{#if showAddForm}
		<div class="add-form-panel">
			<div class="add-form-header">
				<div class="add-form-title">
					<Users size={14} />
					Track a new creator
				</div>
				<button onclick={() => showAddForm = false} class="close-btn">✕</button>
			</div>

			{#if addError}
				<div class="err-row">
					<AlertCircle size={13} />
					<p>{addError}</p>
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); addCreator(); }} class="add-form-body">
				<div class="add-field">
					<label class="add-label">Instagram handle</label>
					<div class="at-wrap">
						<span class="at-sign">@</span>
						<input bind:value={addHandle} required placeholder="garyvee" class="add-input" />
					</div>
				</div>
				<div class="add-field add-field--sm">
					<label class="add-label">Niche (optional)</label>
					<input bind:value={addNiche} placeholder="Marketing" class="add-input" />
				</div>
				<div class="add-actions">
					<button type="submit" disabled={adding} class="track-btn">
						{adding ? 'Adding…' : 'Track'}
					</button>
					<button type="button" onclick={() => showAddForm = false} class="cancel-btn">Cancel</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Content -->
	{#if loading}
		<div class="skeleton-list">
			{#each Array(3) as _}
				<div class="skeleton-row sk-shimmer"></div>
			{/each}
		</div>

	{:else if creators.length === 0}
		<div class="empty-state">
			<div class="empty-icon">
				<Search size={24} />
			</div>
			<h3 class="empty-title">No creators tracked yet</h3>
			<p class="empty-sub">Add an Instagram handle to start scraping their viral posts and extracting what makes them go viral.</p>
			<button onclick={() => showAddForm = true} class="add-btn">
				<Plus size={14} />
				Add your first creator
			</button>
		</div>

	{:else}
		<!-- Stats bar -->
		<div class="stats-bar">
			<div class="stat-chip">
				<span class="stat-n">{creators.length}</span>
				<span class="stat-l">Creators tracked</span>
			</div>
			<div class="stat-chip">
				<span class="stat-n">{viralPosts.length}</span>
				<span class="stat-l">Posts scraped</span>
			</div>
			<div class="stat-chip">
				<span class="stat-n">{viralPosts.filter(p => p.ai_analysis).length}</span>
				<span class="stat-l">AI analyzed</span>
			</div>
		</div>

		<div class="creator-list">
			{#each creators as creator}
				{@const posts = postsForCreator(creator.id)}
				{@const isExpanded = expandedCreator === creator.id}
				{@const isScraping = scrapingId === creator.id}

				<div class="creator-card {isExpanded ? 'creator-card--open' : ''}">
					<!-- Creator row -->
					<div class="creator-row">
						<div class="creator-av">
							{initials(creator.instagram_handle)}
						</div>

						<div class="creator-info">
							<div class="creator-name-row">
								<span class="creator-name">@{creator.instagram_handle}</span>
								{#if creator.niche}
									<span class="niche-chip">{creator.niche}</span>
								{/if}
							</div>
							<p class="creator-meta">
								{posts.length} post{posts.length !== 1 ? 's' : ''} scraped
								{#if creator.last_scraped_at} · Last scraped {new Date(creator.last_scraped_at).toLocaleDateString()}{/if}
							</p>
						</div>

						<div class="creator-actions">
							<button onclick={() => scrapeCreator(creator.id)} disabled={!!scrapingId} class="scrape-btn">
								<RefreshCw size={11} class={isScraping ? 'spin' : ''} />
								{isScraping ? 'Scraping…' : 'Scrape'}
							</button>

							{#if posts.length > 0}
								<button onclick={() => expandedCreator = isExpanded ? null : creator.id} class="expand-btn">
									{isExpanded ? 'Hide' : `${posts.length} posts`}
									{#if isExpanded}<ChevronUp size={11} />{:else}<ChevronDown size={11} />{/if}
								</button>
							{/if}

							<button onclick={() => deleteCreator(creator.id)} class="delete-btn" title="Remove creator">
								<Trash2 size={13} />
							</button>
						</div>
					</div>

					<!-- Posts panel -->
					{#if isExpanded && posts.length > 0}
						<div class="posts-panel">
							<div class="posts-grid">
								{#each posts as post}
									{@const isAnalyzing = analyzingPostId === post.id}
									<div class="post-card">
										<div class="post-stats">
											<div class="post-stat">
												<Heart size={9} class="stat-icon stat-icon--heart" />
												<span>{fmtNum(post.likes)}</span>
											</div>
											<div class="post-stat">
												<MessageCircle size={9} class="stat-icon stat-icon--comment" />
												<span>{fmtNum(post.comments)}</span>
											</div>
											{#if post.engagement_rate}
												<div class="post-stat">
													<TrendingUp size={9} class="stat-icon stat-icon--trend" />
													<span>{post.engagement_rate.toFixed(1)}%</span>
												</div>
											{/if}
										</div>

										<div class="post-content">
											{#if post.hook}
												<p class="post-hook">"{post.hook}"</p>
											{/if}
											{#if post.caption}
												<p class="post-caption">{post.caption}</p>
											{/if}
											{#if post.ai_analysis}
												<div class="ai-analysis">
													<p class="ai-label"><Sparkles size={9} /> AI Analysis</p>
													<p class="ai-text">
														{typeof post.ai_analysis === 'string' ? post.ai_analysis : JSON.stringify(post.ai_analysis)?.slice(0,200)}…
													</p>
												</div>
											{/if}
										</div>

										<div class="post-actions">
											{#if !post.ai_analysis}
												<button onclick={() => analyzePost(post.id)} disabled={!!analyzingPostId} class="analyze-btn">
													<Sparkles size={10} class={isAnalyzing ? 'pulse' : ''} />
													{isAnalyzing ? 'Analyzing…' : 'AI Analyze'}
												</button>
											{/if}
											<button onclick={() => remixPost(post)} class="remix-btn">
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

<style>
	/* ── Layout (theme-aware: uses global --app-* from app.css) ── */
	.page {
		display: flex;
		flex-direction: column;
		gap: 24px;
		font-family: var(--font-body), var(--font-sans), system-ui, sans-serif;
		color: var(--app-text);
	}

	.page-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.head-left { display: flex; align-items: center; gap: 14px; }
	.head-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		background: color-mix(in oklab, var(--color-violet) 14%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-violet) 42%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-violet);
		flex-shrink: 0;
	}
	.page-title {
		color: var(--app-text);
	}
	.page-sub {
		color: var(--app-text-3);
		margin-top: 2px;
	}

	.add-btn {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 9px 18px;
		border-radius: 10px;
		border: none;
		background: var(--color-lime);
		color: #0a0a0a;
		font-size: 13px;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
		white-space: nowrap;
	}
	.add-btn:hover {
		background: var(--color-lime-bright);
		box-shadow: 0 6px 22px color-mix(in oklab, var(--color-lime) 42%, transparent);
		transform: translateY(-1px);
	}

	.add-form-panel {
		background: var(--app-surface-2);
		border: 1px solid var(--app-border);
		border-radius: 14px;
		padding: 20px 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: 0 1px 2px color-mix(in oklab, var(--app-text) 4%, transparent);
	}
	.add-form-header { display: flex; align-items: center; justify-content: space-between; }
	.add-form-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--app-text-2);
		font-family: var(--font-mono), ui-monospace, monospace;
	}
	.close-btn {
		width: 28px;
		height: 28px;
		border-radius: 7px;
		background: color-mix(in oklab, var(--app-text) 5%, var(--app-bg));
		border: 1px solid var(--app-border);
		color: var(--app-text-3);
		cursor: pointer;
		font-size: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.close-btn:hover {
		color: var(--app-text-2);
		background: color-mix(in oklab, var(--app-text) 8%, var(--app-bg));
	}

	.err-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 9px;
		background: color-mix(in oklab, rgb(239, 68, 68) 10%, transparent);
		border: 1px solid color-mix(in oklab, rgb(239, 68, 68) 32%, transparent);
		font-size: 12px;
		color: #dc2626;
	}
	:root[data-theme='dark'] .err-row {
		color: #f87171;
	}
	.err-row p { margin: 0; }

	.add-form-body { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
	.add-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 160px; }
	.add-field--sm { flex: 0 0 140px; min-width: 0; }
	.add-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--app-text-3);
		font-family: var(--font-mono), ui-monospace, monospace;
	}
	.at-wrap { position: relative; }
	.at-sign {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 13px;
		color: var(--app-text-3);
		font-family: var(--font-mono), ui-monospace, monospace;
		pointer-events: none;
	}
	.add-input {
		width: 100%;
		background: var(--app-surface-3);
		border: 1px solid var(--app-border);
		border-radius: 9px;
		padding: 9px 12px 9px 28px;
		font-size: 13px;
		font-family: inherit;
		color: var(--app-text);
		outline: none;
		transition: border-color 0.15s ease;
		box-sizing: border-box;
	}
	.add-field--sm .add-input { padding-left: 12px; }
	.add-input::placeholder { color: var(--app-text-3); }
	.add-input:focus {
		border-color: color-mix(in oklab, var(--color-violet) 58%, transparent);
	}

	.add-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
	.track-btn {
		padding: 9px 20px;
		border-radius: 9px;
		border: none;
		background: var(--color-violet);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: filter 0.15s ease, opacity 0.15s ease;
	}
	.track-btn:hover:not(:disabled) { filter: brightness(1.06); }
	.track-btn:disabled { opacity: 0.55; cursor: not-allowed; }

	.cancel-btn {
		padding: 9px 16px;
		border-radius: 9px;
		background: color-mix(in oklab, var(--app-text) 5%, var(--app-bg));
		border: 1px solid var(--app-border);
		font-size: 13px;
		font-family: inherit;
		color: var(--app-text-2);
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.cancel-btn:hover {
		background: color-mix(in oklab, var(--app-text) 9%, var(--app-bg));
		color: var(--app-text);
	}

	.skeleton-list { display: flex; flex-direction: column; gap: 10px; }
	.skeleton-row {
		height: 72px;
		border-radius: 14px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 12px;
		padding: 80px 0;
	}
	.empty-icon {
		width: 56px;
		height: 56px;
		border-radius: 16px;
		background: color-mix(in oklab, var(--color-violet) 12%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-violet) 28%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-violet-bright);
		margin-bottom: 4px;
	}
	.empty-title {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-size: 18px;
		font-weight: 900;
		letter-spacing: -0.02em;
		color: var(--app-text);
		margin: 0;
	}
	.empty-sub {
		font-size: 13px;
		color: var(--app-text-3);
		max-width: 360px;
		line-height: 1.65;
		margin: 0;
	}

	.stats-bar { display: flex; gap: 12px; flex-wrap: wrap; }
	.stat-chip {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: 10px;
		background: var(--app-surface-2);
		border: 1px solid var(--app-border);
	}
	.stat-n {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-size: 18px;
		font-weight: 900;
		color: #7c6b00;
	}
	:root[data-theme='dark'] .stat-n {
		color: var(--color-lime);
	}
	.stat-l { font-size: 12px; color: var(--app-text-3); }

	.creator-list { display: flex; flex-direction: column; gap: 10px; }

	.creator-card {
		border-radius: 14px;
		overflow: hidden;
		background: var(--app-surface-2);
		border: 1px solid var(--app-border);
		transition: border-color 0.2s ease;
	}
	.creator-card--open {
		border-color: color-mix(in oklab, var(--color-violet) 40%, transparent);
	}

	.creator-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
	}

	.creator-av {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		flex-shrink: 0;
		background: color-mix(in oklab, var(--color-violet) 14%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-violet) 38%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono), ui-monospace, monospace;
		font-size: 11px;
		font-weight: 700;
		color: var(--color-violet-bright);
	}

	.creator-info { flex: 1; min-width: 0; }
	.creator-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.creator-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--app-text);
	}
	.niche-chip {
		font-family: var(--font-mono), ui-monospace, monospace;
		font-size: 9px;
		padding: 3px 8px;
		border-radius: 100px;
		background: color-mix(in oklab, var(--color-violet) 12%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-violet) 34%, transparent);
		color: var(--color-violet);
	}
	.creator-meta {
		font-size: 11px;
		color: var(--app-text-3);
		font-family: var(--font-mono), ui-monospace, monospace;
		margin: 3px 0 0;
	}

	.creator-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

	.scrape-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 8px;
		background: color-mix(in oklab, var(--color-lime) 14%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-lime) 36%, transparent);
		font-size: 11px;
		font-weight: 600;
		font-family: inherit;
		color: #5c5610;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}
	:root[data-theme='dark'] .scrape-btn {
		color: var(--color-lime);
	}
	.scrape-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--color-lime) 22%, transparent);
	}
	.scrape-btn:disabled { opacity: 0.45; cursor: not-allowed; }

	.expand-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 10px;
		border-radius: 8px;
		background: color-mix(in oklab, var(--app-text) 5%, var(--app-bg));
		border: 1px solid var(--app-border);
		font-size: 11px;
		font-family: inherit;
		color: var(--app-text-2);
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.expand-btn:hover {
		background: color-mix(in oklab, var(--app-text) 9%, var(--app-bg));
		color: var(--app-text);
	}

	.delete-btn {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: transparent;
		border: 1px solid var(--app-border);
		color: var(--app-text-3);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}
	.delete-btn:hover {
		background: color-mix(in oklab, rgb(239, 68, 68) 10%, transparent);
		border-color: color-mix(in oklab, rgb(239, 68, 68) 35%, transparent);
		color: #dc2626;
	}
	:root[data-theme='dark'] .delete-btn:hover {
		color: #f87171;
	}

	.posts-panel {
		border-top: 1px solid var(--app-border);
		padding: 16px 18px;
		background: color-mix(in oklab, var(--app-text) 3%, var(--app-bg));
	}
	.posts-grid { display: flex; flex-direction: column; gap: 10px; }

	.post-card {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		padding: 14px;
		border-radius: 11px;
		background: var(--app-surface-2);
		border: 1px solid var(--app-border);
		transition: border-color 0.15s ease;
	}
	.post-card:hover {
		border-color: var(--app-border-hover);
	}

	.post-stats {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex-shrink: 0;
		width: 68px;
	}
	.post-stat {
		display: flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono), ui-monospace, monospace;
		font-size: 11px;
		color: var(--app-text-3);
	}
	:global(.stat-icon) { flex-shrink: 0; }
	:global(.stat-icon--heart) { color: #db2777; }
	:global(.stat-icon--comment) { color: var(--color-cyan); }
	:global(.stat-icon--trend) { color: var(--color-violet-bright); }

	.post-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
	.post-hook {
		font-size: 12px;
		font-weight: 500;
		color: #0e7490;
		font-style: italic;
		margin: 0;
		line-height: 1.5;
	}
	:root[data-theme='dark'] .post-hook {
		color: var(--color-cyan-bright);
	}
	.post-caption {
		font-size: 12px;
		color: var(--app-text-2);
		line-height: 1.6;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.ai-analysis {
		padding: 10px 12px;
		border-radius: 8px;
		background: color-mix(in oklab, var(--color-violet) 8%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-violet) 26%, transparent);
	}
	.ai-label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono), ui-monospace, monospace;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-violet);
		margin: 0 0 6px;
	}
	:root[data-theme='dark'] .ai-label {
		color: var(--color-violet-bright);
	}
	.ai-text {
		font-size: 11px;
		color: var(--app-text-2);
		line-height: 1.6;
		margin: 0;
	}

	.post-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }

	.analyze-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 10px;
		border-radius: 7px;
		background: color-mix(in oklab, var(--color-violet) 12%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-violet) 38%, transparent);
		font-size: 11px;
		font-weight: 600;
		font-family: inherit;
		color: var(--color-violet);
		cursor: pointer;
		transition: background 0.15s ease;
		white-space: nowrap;
	}
	:root[data-theme='dark'] .analyze-btn {
		color: var(--color-violet-bright);
	}
	.analyze-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--color-violet) 20%, transparent);
	}
	.analyze-btn:disabled { opacity: 0.45; cursor: not-allowed; }

	.remix-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 10px;
		border-radius: 7px;
		background: color-mix(in oklab, var(--color-lime) 14%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-lime) 42%, transparent);
		font-size: 11px;
		font-weight: 600;
		font-family: inherit;
		color: #5c5610;
		cursor: pointer;
		transition: background 0.15s ease;
		white-space: nowrap;
	}
	:root[data-theme='dark'] .remix-btn {
		color: var(--color-lime);
	}
	.remix-btn:hover {
		background: color-mix(in oklab, var(--color-lime) 24%, transparent);
	}

	:global(.spin) { animation: spin 1s linear infinite; }
	:global(.pulse) { animation: pulse-anim 1s ease-in-out infinite; }
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes pulse-anim {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}
</style>
