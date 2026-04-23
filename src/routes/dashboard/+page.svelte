<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		TrendingUp, ImagePlus, Search, ArrowRight, Zap, Plus,
		Clock, BarChart3, Wand2, CalendarDays, Layers, Sparkles,
		Eye, Heart, ChevronRight
	} from 'lucide-svelte';

	let carousels: any[] = $state([]);
	let creators: any[] = $state([]);
	let loading = $state(true);

	const quickActions = [
		{
			href: '/dashboard/carousels/new',
			icon: ImagePlus,
			label: 'New Carousel',
			desc: 'Start from a viral template or build from scratch',
			color: '#E8FF48',
			bg: 'rgba(232,255,72,0.08)',
			border: 'rgba(232,255,72,0.15)',
		},
		{
			href: '/dashboard/discover',
			icon: Search,
			label: 'Discover Viral',
			desc: 'Track competitor accounts and reverse-engineer their hooks',
			color: '#8B5CF6',
			bg: 'rgba(139,92,246,0.08)',
			border: 'rgba(139,92,246,0.15)',
		},
		{
			href: '/dashboard/slideshows',
			icon: Wand2,
			label: 'Slideshows',
			desc: 'Upload brand images → AI extracts style → 7-slide carousel',
			color: '#06B6D4',
			bg: 'rgba(6,182,212,0.08)',
			border: 'rgba(6,182,212,0.15)',
		},
		{
			href: '/dashboard/studio',
			icon: Layers,
			label: 'News Studio',
			desc: 'Turn breaking news into branded posts in one click',
			color: '#F97316',
			bg: 'rgba(249,115,22,0.08)',
			border: 'rgba(249,115,22,0.15)',
		},
		{
			href: '/dashboard/analytics',
			icon: BarChart3,
			label: 'Analytics',
			desc: 'Publishing stats, engagement rates, and top performers',
			color: '#10B981',
			bg: 'rgba(16,185,129,0.08)',
			border: 'rgba(16,185,129,0.15)',
		},
		{
			href: '/dashboard/post-scheduler',
			icon: CalendarDays,
			label: 'Scheduler',
			desc: 'Queue posts for Instagram, TikTok, Facebook, and LinkedIn',
			color: '#E1306C',
			bg: 'rgba(225,48,108,0.08)',
			border: 'rgba(225,48,108,0.15)',
		},
	];

	// Dummy performance stats
	const stats = [
		{ label: 'Published this month', value: '24', delta: '+8 vs last', up: true },
		{ label: 'Avg. engagement', value: '6.1%', delta: '+0.8%',     up: true },
		{ label: 'Avg. reach',      value: '4.2K', delta: '+31%',      up: true },
		{ label: 'Scheduled queue', value: '7',    delta: '3 platforms', up: true },
	];

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }

		const [{ data: c }, { data: cr }] = await Promise.all([
			supabase.from('carousels').select('*').order('created_at', { ascending: false }).limit(6),
			supabase.from('creators').select('*').order('created_at', { ascending: false }).limit(5),
		]);
		carousels = c ?? [];
		creators  = cr ?? [];
		loading   = false;
	});

	function timeAgo(dateStr: string): string {
		const d = new Date(dateStr);
		const diff = Date.now() - d.getTime();
		const m = Math.floor(diff / 60000);
		if (m < 1)   return 'just now';
		if (m < 60)  return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24)  return `${h}h ago`;
		const days = Math.floor(h / 24);
		return `${days}d ago`;
	}
</script>

<div class="page">
	<!-- Header -->
	<div class="page-header">
		<div>
			<h1 class="page-title">Good morning ✦</h1>
			<p class="page-sub">Here's your content pipeline at a glance</p>
		</div>
		<a href="/dashboard/carousels/new" class="btn-primary">
			<Plus size={15} />
			New Carousel
		</a>
	</div>

	<!-- Stats row -->
	<div class="stats-row">
		{#each stats as s}
			<div class="stat-card">
				<div class="stat-value">{s.value}</div>
				<div class="stat-label">{s.label}</div>
				<div class="stat-delta {s.up ? 'delta-up' : 'delta-dn'}">
					{#if s.up}<TrendingUp size={10}/>{/if}
					{s.delta}
				</div>
			</div>
		{/each}
	</div>

	<!-- Quick Actions -->
	<div class="section">
		<div class="section-head">
			<h2 class="section-title">Quick Actions</h2>
		</div>
		<div class="actions-grid">
			{#each quickActions as a}
				{@const Icon = a.icon}
				<a
					href={a.href}
					class="action-card"
					style="--color:{a.color}; --bg:{a.bg}; --border:{a.border}"
				>
					<div class="action-icon">
						<Icon size={18} />
					</div>
					<div class="action-body">
						<h3 class="action-label">{a.label}</h3>
						<p class="action-desc">{a.desc}</p>
					</div>
					<div class="action-arrow">
						<ArrowRight size={14} />
					</div>
				</a>
			{/each}
		</div>
	</div>

	<!-- Two column: Recent carousels + Tracked creators -->
	<div class="two-col">
		<!-- Recent carousels -->
		<div class="col-section">
			<div class="section-head">
				<h2 class="section-title">Recent Carousels</h2>
				<a href="/dashboard/carousels" class="view-all">View all <ChevronRight size={12}/></a>
			</div>

			{#if loading}
				<div class="skeleton-list">
					{#each Array(4) as _}
						<div class="skeleton-row"></div>
					{/each}
				</div>
			{:else if carousels.length === 0}
				<div class="empty-state">
					<div class="empty-icon-wrap">
						<ImagePlus size={20} />
					</div>
					<p class="empty-title">No carousels yet</p>
					<p class="empty-desc">Create your first carousel to get started</p>
					<a href="/dashboard/carousels/new" class="btn-sm-primary">
						<Plus size={13} />
						Create carousel
					</a>
				</div>
			{:else}
				<div class="item-list">
					{#each carousels as c}
						<a href="/dashboard/editor/{c.id}" class="list-item">
							<div class="item-thumb">
								<ImagePlus size={14} />
							</div>
							<div class="item-body">
								<p class="item-title">{c.title}</p>
								<div class="item-meta">
									<span class="status-badge status-{c.status}">{c.status}</span>
									<span class="item-time"><Clock size={10}/>{timeAgo(c.updated_at ?? c.created_at)}</span>
								</div>
							</div>
							<ArrowRight size={13} class="item-arrow" />
						</a>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Tracked creators + suggestion panel -->
		<div class="col-section">
			<div class="section-head">
				<h2 class="section-title">Tracked Creators</h2>
				<a href="/dashboard/discover" class="view-all">Manage <ChevronRight size={12}/></a>
			</div>

			{#if loading}
				<div class="skeleton-list">
					{#each Array(3) as _}
						<div class="skeleton-row"></div>
					{/each}
				</div>
			{:else if creators.length === 0}
				<div class="empty-state">
					<div class="empty-icon-wrap">
						<Search size={20} />
					</div>
					<p class="empty-title">No competitors tracked</p>
					<p class="empty-desc">Add handles to start discovering viral content</p>
					<a href="/dashboard/discover" class="btn-sm-primary">
						<Plus size={13} />
						Add competitor
					</a>
				</div>
			{:else}
				<div class="item-list">
					{#each creators as cr}
						<a href="/dashboard/discover" class="list-item">
							<div class="creator-avatar">
								{cr.instagram_handle.slice(0,2).toUpperCase()}
							</div>
							<div class="item-body">
								<p class="item-title">@{cr.instagram_handle}</p>
								<div class="item-meta">
									{#if cr.niche}<span class="niche-tag">{cr.niche}</span>{/if}
									{#if cr.followers}<span class="item-time"><Eye size={10}/>{(cr.followers / 1000).toFixed(0)}K</span>{/if}
								</div>
							</div>
							<div class="zap-icon"><Zap size={11}/></div>
						</a>
					{/each}
				</div>
			{/if}

			<!-- AI tip card -->
			<div class="tip-card">
				<div class="tip-icon"><Sparkles size={14}/></div>
				<div class="tip-body">
					<p class="tip-title">AI Tip of the Day</p>
					<p class="tip-text">Posts with numbered lists get <strong>3.4×</strong> more saves. Try a listicle carousel this week.</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.page {
		padding: 2rem 2.5rem;
		max-width: 1100px;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* ── Header ────────────────────────────────────────────────── */
	.page-header {
		display: flex; align-items: flex-start; justify-content: space-between;
		gap: 1rem; flex-wrap: wrap;
	}
	.page-title {
		font-family: 'Fraunces', serif; font-size: 1.75rem;
		font-weight: 900; letter-spacing: -0.03em;
		color: #fff; margin: 0 0 0.3rem;
	}
	.page-sub { font-size: 0.8125rem; color: rgba(255,255,255,0.38); margin: 0; }

	.btn-primary {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.6rem 1.1rem; border-radius: 10px;
		background: #E8FF48; color: #0a0a0a;
		font-size: 0.8125rem; font-weight: 600; text-decoration: none;
		font-family: 'DM Sans', sans-serif; transition: transform 0.12s, box-shadow 0.12s;
	}
	.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(232,255,72,0.25); }

	/* ── Stats row ─────────────────────────────────────────────── */
	.stats-row {
		display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;
	}
	.stat-card {
		padding: 1.1rem 1.25rem; border-radius: 14px;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
		display: flex; flex-direction: column; gap: 0.3rem;
		transition: border-color 0.2s, background 0.2s;
	}
	.stat-card:hover { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); }
	.stat-value {
		font-family: 'Fraunces', serif; font-size: 1.8rem;
		font-weight: 900; color: #fff; line-height: 1; letter-spacing: -0.03em;
	}
	.stat-label { font-size: 0.75rem; color: rgba(255,255,255,0.38); }
	.stat-delta {
		display: inline-flex; align-items: center; gap: 0.25rem;
		font-size: 0.65rem; font-family: 'Space Mono', monospace;
		padding: 2px 7px; border-radius: 4px; width: fit-content; font-weight: 700;
	}
	.delta-up { background: rgba(16,185,129,0.12); color: #34d399; }
	.delta-dn { background: rgba(239,68,68,0.1);   color: #f87171; }

	/* ── Sections ──────────────────────────────────────────────── */
	.section { display: flex; flex-direction: column; gap: 1rem; }
	.section-head {
		display: flex; align-items: center; justify-content: space-between;
	}
	.section-title {
		font-family: 'Fraunces', serif; font-size: 1rem;
		font-weight: 700; color: rgba(255,255,255,0.9); margin: 0;
	}
	.view-all {
		display: inline-flex; align-items: center; gap: 0.2rem;
		font-size: 0.75rem; color: rgba(255,255,255,0.35); text-decoration: none;
		font-family: 'Space Mono', monospace; transition: color 0.15s;
	}
	.view-all:hover { color: #E8FF48; }

	/* ── Quick actions grid ────────────────────────────────────── */
	.actions-grid {
		display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;
	}
	.action-card {
		display: flex; align-items: center; gap: 0.9rem;
		padding: 1.1rem 1.1rem;
		border-radius: 14px;
		background: var(--bg); border: 1px solid var(--border);
		text-decoration: none; cursor: pointer;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		position: relative; overflow: hidden;
	}
	.action-card:hover {
		transform: translateY(-2px);
		border-color: var(--color);
		box-shadow: 0 8px 32px rgba(0,0,0,0.2);
	}
	.action-icon {
		width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
		background: rgba(255,255,255,0.06);
		display: flex; align-items: center; justify-content: center;
		color: var(--color);
		transition: background 0.2s;
	}
	.action-card:hover .action-icon { background: var(--bg); }

	.action-body { flex: 1; min-width: 0; }
	.action-label { font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.88); margin: 0 0 0.2rem; }
	.action-desc  { font-size: 0.72rem; color: rgba(255,255,255,0.35); margin: 0; line-height: 1.4; }
	.action-arrow { color: rgba(255,255,255,0.2); flex-shrink: 0; transition: color 0.2s, transform 0.2s; }
	.action-card:hover .action-arrow { color: var(--color); transform: translateX(3px); }

	/* ── Two column layout ─────────────────────────────────────── */
	.two-col {
		display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;
	}
	.col-section { display: flex; flex-direction: column; gap: 0.85rem; }

	/* ── Skeletons ─────────────────────────────────────────────── */
	.skeleton-list { display: flex; flex-direction: column; gap: 0.5rem; }
	.skeleton-row {
		height: 54px; border-radius: 10px;
		background: rgba(255,255,255,0.03);
		animation: skeleton-pulse 1.5s ease-in-out infinite;
	}
	@keyframes skeleton-pulse {
		0%,100%{opacity:0.5} 50%{opacity:1}
	}

	/* ── Empty states ──────────────────────────────────────────── */
	.empty-state {
		display: flex; flex-direction: column; align-items: center;
		text-align: center; padding: 2rem 1rem; gap: 0.6rem;
		border-radius: 14px; border: 1px dashed rgba(255,255,255,0.07);
		background: rgba(255,255,255,0.01);
	}
	.empty-icon-wrap {
		width: 44px; height: 44px; border-radius: 12px;
		background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
		display: flex; align-items: center; justify-content: center;
		color: rgba(255,255,255,0.2); margin-bottom: 0.25rem;
	}
	.empty-title { font-size: 0.875rem; color: rgba(255,255,255,0.5); font-weight: 600; margin: 0; }
	.empty-desc  { font-size: 0.78rem; color: rgba(255,255,255,0.3); margin: 0; }
	.btn-sm-primary {
		display: inline-flex; align-items: center; gap: 0.3rem;
		padding: 0.45rem 0.9rem; border-radius: 8px;
		background: rgba(232,255,72,0.1); color: #E8FF48;
		border: 1px solid rgba(232,255,72,0.2);
		font-size: 0.78rem; font-weight: 600; text-decoration: none;
		transition: all 0.15s;
	}
	.btn-sm-primary:hover { background: rgba(232,255,72,0.15); }

	/* ── List items ────────────────────────────────────────────── */
	.item-list { display: flex; flex-direction: column; gap: 0.4rem; }

	.list-item {
		display: flex; align-items: center; gap: 0.85rem;
		padding: 0.75rem 0.9rem; border-radius: 12px;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
		text-decoration: none; transition: all 0.15s;
	}
	.list-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.09); transform: translateX(2px); }

	.item-thumb {
		width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
		background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.1));
		display: flex; align-items: center; justify-content: center;
		color: rgba(139,92,246,0.8);
	}
	.creator-avatar {
		width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
		background: rgba(232,255,72,0.1); border: 1px solid rgba(232,255,72,0.2);
		display: flex; align-items: center; justify-content: center;
		font-family: 'Space Mono', monospace; font-size: 11px;
		color: #E8FF48; font-weight: 700;
	}

	.item-body { flex: 1; min-width: 0; }
	.item-title {
		font-size: 0.8125rem; color: rgba(255,255,255,0.82); font-weight: 500;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0 0 0.2rem;
	}
	.item-meta { display: flex; align-items: center; gap: 0.5rem; }

	.status-badge {
		font-family: 'Space Mono', monospace; font-size: 0.6rem;
		font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
		padding: 1px 6px; border-radius: 4px;
	}
	.status-draft     { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.4); }
	.status-published { background: rgba(16,185,129,0.12); color: #34d399; }
	.status-scheduled { background: rgba(232,255,72,0.1); color: #E8FF48; }

	.niche-tag {
		font-size: 0.65rem; padding: 1px 7px; border-radius: 4px;
		background: rgba(139,92,246,0.1); color: rgba(139,92,246,0.8);
		font-family: 'Space Mono', monospace;
	}
	.item-time {
		display: inline-flex; align-items: center; gap: 3px;
		font-size: 0.65rem; color: rgba(255,255,255,0.25); font-family: 'Space Mono', monospace;
	}
	:global(.item-arrow) { color: rgba(255,255,255,0.18); flex-shrink: 0; }
	.list-item:hover :global(.item-arrow) { color: rgba(255,255,255,0.4); }
	.zap-icon { color: rgba(232,255,72,0.5); flex-shrink: 0; }

	/* ── Tip card ──────────────────────────────────────────────── */
	.tip-card {
		display: flex; align-items: flex-start; gap: 0.75rem;
		padding: 1rem; border-radius: 12px;
		background: rgba(232,255,72,0.03); border: 1px solid rgba(232,255,72,0.1);
		margin-top: 0.25rem;
	}
	.tip-icon {
		width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
		background: rgba(232,255,72,0.12); color: #E8FF48;
		display: flex; align-items: center; justify-content: center;
	}
	.tip-body { flex: 1; }
	.tip-title { font-size: 0.75rem; font-weight: 700; color: #E8FF48; margin: 0 0 0.3rem; font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.07em; }
	.tip-text  { font-size: 0.78rem; line-height: 1.55; color: rgba(255,255,255,0.45); margin: 0; }
	.tip-text strong { color: rgba(255,255,255,0.75); }
</style>
