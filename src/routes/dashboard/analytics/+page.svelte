<script lang="ts">
	import type { AnalyticsPlatform, ConnectionSummary, PostStats } from './+page.server';
	import {
		BarChart3,
		Camera,
		Share2,
		Music2,
		Building2,
		MapPin,
		ArrowRight,
		Link2,
		PlugZap,
	} from 'lucide-svelte';

	let { data } = $props();

	let tab = $state<AnalyticsPlatform>('instagram');

	const platforms: { id: AnalyticsPlatform; label: string; icon: typeof Camera; accent: string }[] = [
		{ id: 'instagram', label: 'Instagram', icon: Camera, accent: 'from-pink-500/20 to-violet-600/20' },
		{ id: 'facebook', label: 'Facebook', icon: Share2, accent: 'from-blue-600/20 to-blue-400/10' },
		{ id: 'tiktok', label: 'TikTok', icon: Music2, accent: 'from-cyan-500/15 to-fuchsia-500/15' },
		{ id: 'linkedin', label: 'LinkedIn', icon: Building2, accent: 'from-sky-600/20 to-blue-800/15' },
		{ id: 'gmb', label: 'Google Business', icon: MapPin, accent: 'from-emerald-500/15 to-teal-600/15' },
	];

	function connectionsFor(tabId: AnalyticsPlatform): ConnectionSummary[] {
		const list = data.connections ?? [];
		if (tabId === 'tiktok') return list.filter((c) => c.provider === 'tiktok');
		if (tabId === 'linkedin') return list.filter((c) => c.provider === 'linkedin');
		if (tabId === 'gmb') return list.filter((c) => c.provider === 'gmb');
		const meta = list.filter((c) => c.provider === 'meta');
		if (tabId === 'facebook') {
			return meta.filter(
				(c) =>
					String(c.provider_account_id ?? '').startsWith('fbpage:') ||
					String((c.meta as { kind?: string } | null)?.kind ?? '') === 'facebook_page'
			);
		}
		// Instagram: Meta rows that are not Facebook pages (skip placeholder `me` if present)
		return meta.filter((c) => {
			const acct = String(c.provider_account_id ?? '');
			const kind = String((c.meta as { kind?: string } | null)?.kind ?? '');
			if (acct.startsWith('fbpage:') || kind === 'facebook_page') return false;
			if (acct === 'me') return false;
			return true;
		});
	}

	function statsFor(tabId: AnalyticsPlatform): PostStats {
		return data.statsByPlatform?.[tabId] ?? {
			published: 0,
			scheduled: 0,
			failed: 0,
			publishing: 0,
			cancelled: 0,
			total: 0,
		};
	}

	const activeConnections = $derived(connectionsFor(tab));
	const activeStats = $derived(statsFor(tab));
	const tabLabel = $derived(platforms.find((x) => x.id === tab)?.label ?? 'Channel');
</script>

<div class="page">
	<header class="head">
		<div class="flex items-center gap-3">
			<div class="icon-wrap">
				<BarChart3 size={20} class="text-[#0a0a0a]" />
			</div>
			<div>
				<h1 class="title">Analytics</h1>
				<p class="sub">Publishing activity and connected accounts across your channels</p>
			</div>
		</div>
		<a href="/dashboard/post-scheduler" class="cta">
			Schedule a post
			<ArrowRight size={14} />
		</a>
	</header>

	<!-- One menu: horizontal channel tabs -->
	<nav class="tabs" aria-label="Social channels">
		{#each platforms as p (p.id)}
			{@const PIcon = p.icon}
			<button
				type="button"
				onclick={() => (tab = p.id)}
				class="tab {tab === p.id ? 'tab-on' : ''}"
				aria-current={tab === p.id ? 'page' : undefined}
			>
				<span class="tab-icon bg-linear-to-br {p.accent}">
					<PIcon size={15} class="text-white/90" />
				</span>
				{p.label}
			</button>
		{/each}
	</nav>

	<section class="panel">
		<div class="panel-head">
			<h2 class="panel-title">{tabLabel}</h2>
			<a href="/dashboard/settings" class="link-muted">
				<PlugZap size={13} />
				Manage connections
			</a>
		</div>

		<!-- KPIs from scheduled_posts -->
		<div class="kpi-grid">
			<div class="kpi">
				<span class="kpi-val">{activeStats.published}</span>
				<span class="kpi-label">Published</span>
			</div>
			<div class="kpi">
				<span class="kpi-val">{activeStats.scheduled}</span>
				<span class="kpi-label">Scheduled</span>
			</div>
			<div class="kpi">
				<span class="kpi-val">{activeStats.publishing}</span>
				<span class="kpi-label">In progress</span>
			</div>
			<div class="kpi kpi-warn">
				<span class="kpi-val">{activeStats.failed}</span>
				<span class="kpi-label">Failed</span>
			</div>
			<div class="kpi kpi-muted">
				<span class="kpi-val">{activeStats.cancelled}</span>
				<span class="kpi-label">Cancelled</span>
			</div>
			<div class="kpi kpi-total">
				<span class="kpi-val">{activeStats.total}</span>
				<span class="kpi-label">Queue total</span>
			</div>
		</div>

		<p class="hint">
			Counts are from your scheduled post queue. Native reach, impressions, and demographics still need each
			network’s analytics APIs — we’ll surface those here as we wire them in.
		</p>

		<hr class="sep" />

		<h3 class="section-label">Connected accounts</h3>
		{#if activeConnections.length === 0}
			<div class="empty">
				<Link2 size={22} class="text-white/15 mb-2" />
				<p class="empty-title">No {tabLabel} accounts linked</p>
				<p class="empty-body">Connect in Settings, then schedule from Post Scheduler.</p>
				<a href="/dashboard/settings" class="cta ghost">Open Settings</a>
			</div>
		{:else}
			<ul class="acct-list">
				{#each activeConnections as c (c.provider + c.provider_account_id)}
					<li class="acct">
						<div>
							<p class="acct-label">{c.provider_account_label ?? c.provider_account_id}</p>
							<p class="acct-meta">
								<span class="mono">{c.provider}</span>
								{#if c.updated_at}
									<span class="dot">·</span>
									<span>Updated {new Date(c.updated_at).toLocaleDateString()}</span>
								{/if}
							</p>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.page {
		padding: 2rem;
		max-width: 960px;
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.75rem;
		flex-wrap: wrap;
	}

	.icon-wrap {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: #e8ff48;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 800;
		color: #fff;
		letter-spacing: -0.02em;
		margin: 0 0 0.2rem;
	}

	.sub {
		margin: 0;
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.38);
		font-family: 'DM Sans', sans-serif;
		max-width: 32rem;
		line-height: 1.45;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 1rem;
		border-radius: 10px;
		background: #e8ff48;
		color: #0a0a0a;
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		font-family: 'DM Sans', sans-serif;
		transition: transform 0.12s, box-shadow 0.12s;
	}
	.cta:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 24px rgba(232, 255, 72, 0.15);
	}

	.cta.ghost {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.cta.ghost:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
		box-shadow: none;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 1.25rem;
		padding: 0.35rem;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 0.85rem;
		border-radius: 10px;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.4);
		font-family: 'DM Sans', sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.12s, background 0.12s;
	}

	.tab:hover {
		color: rgba(255, 255, 255, 0.75);
		background: rgba(255, 255, 255, 0.04);
	}

	.tab-on {
		color: #e8ff48;
		background: rgba(232, 255, 72, 0.08);
	}

	.tab-icon {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		border-radius: 16px;
		padding: 1.35rem 1.5rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.panel-title {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.1rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.92);
	}

	.link-muted {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.35);
		text-decoration: none;
		font-family: 'Space Mono', monospace;
	}
	.link-muted:hover {
		color: #e8ff48;
	}

	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.65rem;
		margin-bottom: 1rem;
	}

	.kpi {
		padding: 0.85rem 1rem;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		text-align: center;
	}

	.kpi-warn .kpi-val {
		color: #fb923c;
	}
	.kpi-muted .kpi-val {
		color: rgba(255, 255, 255, 0.35);
	}
	.kpi-total {
		border-color: rgba(232, 255, 72, 0.2);
		background: rgba(232, 255, 72, 0.04);
	}
	.kpi-total .kpi-val {
		color: #e8ff48;
	}

	.kpi-val {
		display: block;
		font-family: 'Space Mono', monospace;
		font-size: 1.35rem;
		font-weight: 700;
		color: #fff;
		line-height: 1.2;
	}

	.kpi-label {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255, 255, 255, 0.28);
		font-family: 'Space Mono', monospace;
	}

	.hint {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.28);
		font-family: 'DM Sans', sans-serif;
	}

	.sep {
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		margin: 1.35rem 0;
	}

	.section-label {
		margin: 0 0 0.85rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: rgba(255, 255, 255, 0.3);
		font-family: 'Space Mono', monospace;
	}

	.empty {
		text-align: center;
		padding: 2rem 1rem;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px dashed rgba(255, 255, 255, 0.08);
	}

	.empty-title {
		margin: 0 0 0.35rem;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.55);
		font-weight: 600;
	}

	.empty-body {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.32);
	}

	.acct-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.acct {
		padding: 0.85rem 1rem;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.acct-label {
		margin: 0 0 0.2rem;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.85);
		font-weight: 500;
	}

	.acct-meta {
		margin: 0;
		font-size: 0.7rem;
		color: rgba(255, 255, 255, 0.32);
	}

	.mono {
		font-family: 'Space Mono', monospace;
	}

	.dot {
		margin: 0 0.2rem;
	}
</style>
