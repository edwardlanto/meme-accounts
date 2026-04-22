<script lang="ts">
	import type { AnalyticsPlatform, ConnectionSummary, PostStats } from './+page.server';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
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
		AlertTriangle,
		CheckCircle2,
		ExternalLink,
		X,
	} from 'lucide-svelte';

	type Status = { ok: boolean; missing: string[]; present: string[] };

	let { data } = $props();

	let tab = $state<AnalyticsPlatform>('instagram');

	const platforms: { id: AnalyticsPlatform; label: string; icon: typeof Camera; accent: string }[] = [
		{ id: 'instagram', label: 'Instagram', icon: Camera, accent: 'from-pink-500/20 to-violet-600/20' },
		{ id: 'facebook', label: 'Facebook', icon: Share2, accent: 'from-blue-600/20 to-blue-400/10' },
		{ id: 'tiktok', label: 'TikTok', icon: Music2, accent: 'from-cyan-500/15 to-fuchsia-500/15' },
		{ id: 'linkedin', label: 'LinkedIn', icon: Building2, accent: 'from-sky-600/20 to-blue-800/15' },
		{ id: 'gmb', label: 'Google Business', icon: MapPin, accent: 'from-emerald-500/15 to-teal-600/15' },
	];

	let metaStatus = $state<Status | null>(null);
	let linkedinStatus = $state<Status | null>(null);
	let gmbStatus = $state<Status | null>(null);
	let statusLoading = $state(true);
	let userId = $state('');
	let banner = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

	function oauthNext(channel: AnalyticsPlatform): string {
		return `/dashboard/analytics?channel=${encodeURIComponent(channel)}`;
	}

	async function loadIntegrationStatuses() {
		statusLoading = true;
		try {
			const [mr, lr, gr] = await Promise.all([
				fetch('/api/integrations/meta/status'),
				fetch('/api/integrations/linkedin/status'),
				fetch('/api/integrations/gmb/status'),
			]);
			metaStatus = await mr.json();
			linkedinStatus = await lr.json();
			gmbStatus = await gr.json();
		} catch {
			metaStatus = { ok: false, missing: ['(failed to load status)'], present: [] };
			linkedinStatus = { ok: false, missing: ['(failed to load status)'], present: [] };
			gmbStatus = { ok: false, missing: ['(failed to load status)'], present: [] };
		}
		statusLoading = false;
	}

	function isChannel(s: string | null): s is AnalyticsPlatform {
		return (
			s === 'instagram' ||
			s === 'facebook' ||
			s === 'tiktok' ||
			s === 'linkedin' ||
			s === 'gmb'
		);
	}

	onMount(async () => {
		const { data: auth } = await supabase.auth.getUser();
		userId = auth.user?.id ?? '';

		if (browser) {
			const sp = new URLSearchParams(window.location.search);
			const ch = sp.get('channel');
			if (isChannel(ch)) tab = ch;

			const err =
				sp.get('meta_error') ??
				sp.get('linkedin_error') ??
				sp.get('gmb_error') ??
				sp.get('tiktok_error');
			const errDesc = sp.get('desc');
			if (err) {
				let t = decodeURIComponent(err.replace(/\+/g, ' '));
				if (errDesc) t += ` — ${decodeURIComponent(errDesc.replace(/\+/g, ' '))}`;
				banner = { kind: 'err', text: t };
			}

			if (
				sp.get('meta_connected') ||
				sp.get('linkedin_connected') ||
				sp.get('gmb_connected') ||
				sp.get('tiktok_connected')
			) {
				await invalidateAll();
				if (!err) {
					const ig = sp.get('ig_found');
					const loc = sp.get('locations');
					let msg = 'Connected successfully.';
					if (sp.get('meta_connected')) msg = ig === '1' ? 'Meta connected — Instagram account saved.' : 'Meta connected.';
					if (sp.get('linkedin_connected')) msg = 'LinkedIn connected.';
					if (sp.get('gmb_connected')) msg = loc ? `Google Business Profile connected (${loc} locations).` : 'Google Business Profile connected.';
					if (sp.get('tiktok_connected')) msg = 'TikTok connected.';
					banner = { kind: 'ok', text: msg };
				}
			}

			if (window.location.search) {
				const keep = ch && isChannel(ch) ? `?channel=${encodeURIComponent(ch)}` : '';
				window.history.replaceState({}, '', `/dashboard/analytics${keep}`);
			}
		}

		await loadIntegrationStatuses();
	});

	async function ensureMetaOk(): Promise<boolean> {
		try {
			const res = await fetch('/api/integrations/meta/status');
			const st = (await res.json()) as Status;
			if (!st.ok) {
				banner = { kind: 'err', text: `Meta is not configured yet. Missing: ${st.missing.join(', ')}` };
				return false;
			}
			return true;
		} catch {
			banner = { kind: 'err', text: 'Could not verify Meta credentials.' };
			return false;
		}
	}

	async function ensureLinkedinOk(): Promise<boolean> {
		try {
			const res = await fetch('/api/integrations/linkedin/status');
			const st = (await res.json()) as Status;
			if (!st.ok) {
				banner = { kind: 'err', text: `LinkedIn is not configured yet. Missing: ${st.missing.join(', ')}` };
				return false;
			}
			return true;
		} catch {
			banner = { kind: 'err', text: 'Could not verify LinkedIn credentials.' };
			return false;
		}
	}

	async function ensureGmbOk(): Promise<boolean> {
		try {
			const res = await fetch('/api/integrations/gmb/status');
			const st = (await res.json()) as Status;
			if (!st.ok) {
				banner = { kind: 'err', text: `Google Business is not configured yet. Missing: ${st.missing.join(', ')}` };
				return false;
			}
			return true;
		} catch {
			banner = { kind: 'err', text: 'Could not verify Google Business credentials.' };
			return false;
		}
	}

	async function connectInstagram() {
		if (!(await ensureMetaOk())) return;
		if (!userId) {
			goto('/login');
			return;
		}
		const next = oauthNext('instagram');
		window.location.href = `/api/auth/meta/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent(next)}`;
	}

	async function connectFacebook() {
		if (!(await ensureMetaOk())) return;
		if (!userId) {
			goto('/login');
			return;
		}
		const next = oauthNext('facebook');
		window.location.href = `/api/auth/meta/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent(next)}`;
	}

	function connectTiktok() {
		if (!userId) {
			goto('/login');
			return;
		}
		const next = oauthNext('tiktok');
		window.location.href = `/api/auth/tiktok/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent(next)}`;
	}

	async function connectLinkedin(mode: 'member' | 'org' | 'both') {
		if (!(await ensureLinkedinOk())) return;
		if (!userId) {
			goto('/login');
			return;
		}
		const next = oauthNext('linkedin');
		window.location.href =
			`/api/auth/linkedin/start?userId=${encodeURIComponent(userId)}` +
			`&mode=${encodeURIComponent(mode)}` +
			`&next=${encodeURIComponent(next)}`;
	}

	async function connectGmb() {
		if (!(await ensureGmbOk())) return;
		if (!userId) {
			goto('/login');
			return;
		}
		const next = oauthNext('gmb');
		window.location.href = `/api/auth/gmb/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent(next)}`;
	}

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

	const metaReady = $derived(!!metaStatus?.ok);
	const linkedinReady = $derived(!!linkedinStatus?.ok);
	const gmbReady = $derived(!!gmbStatus?.ok);
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

	{#if banner}
		<div class="banner {banner.kind === 'ok' ? 'banner-ok' : 'banner-err'}">
			{#if banner.kind === 'ok'}
				<CheckCircle2 size={16} class="shrink-0 mt-0.5" />
			{:else}
				<AlertTriangle size={16} class="shrink-0 mt-0.5" />
			{/if}
			<p class="banner-text">{banner.text}</p>
			<button type="button" class="banner-dismiss" onclick={() => (banner = null)} aria-label="Dismiss">
				<X size={14} />
			</button>
		</div>
	{/if}

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
				Env / advanced
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

		<h3 class="section-label">Connect</h3>
		{#if statusLoading}
			<p class="status-loading">Checking platform credentials…</p>
		{:else if tab === 'instagram'}
			<div class="connect-card">
				<p class="connect-desc">
					Sign in with Meta to link an Instagram Business account to your Facebook Page. You can add more
					accounts anytime.
				</p>
				{#if metaReady}
					<div class="cred-ok">
						<CheckCircle2 size={14} class="text-emerald-400 shrink-0" />
						<span>Meta app credentials look good.</span>
					</div>
				{:else}
					<div class="cred-bad">
						<AlertTriangle size={14} class="text-amber-400 shrink-0" />
						<span>Server env missing: <span class="mono">{metaStatus?.missing?.join(', ') ?? 'unknown'}</span></span>
					</div>
				{/if}
				<div class="btn-row">
					<button type="button" class="btn-primary" disabled={!metaReady} onclick={() => void connectInstagram()}>
						Connect Instagram
					</button>
					<a href="/dashboard/docs/instagram" class="btn-link">Setup guide</a>
				</div>
			</div>
		{:else if tab === 'facebook'}
			<div class="connect-card">
				<p class="connect-desc">
					Uses the same Meta login as Instagram. After authorizing, we save Facebook Pages you manage so you can
					schedule posts to them.
				</p>
				{#if metaReady}
					<div class="cred-ok">
						<CheckCircle2 size={14} class="text-emerald-400 shrink-0" />
						<span>Meta app credentials look good.</span>
					</div>
				{:else}
					<div class="cred-bad">
						<AlertTriangle size={14} class="text-amber-400 shrink-0" />
						<span>Server env missing: <span class="mono">{metaStatus?.missing?.join(', ') ?? 'unknown'}</span></span>
					</div>
				{/if}
				<div class="btn-row">
					<button type="button" class="btn-primary" disabled={!metaReady} onclick={() => void connectFacebook()}>
						Connect Facebook Page
					</button>
					<a
						href="https://developers.facebook.com/docs/graph-api/reference/page"
						target="_blank"
						rel="noreferrer"
						class="btn-link"
					>
						Page API docs <ExternalLink size={11} class="inline opacity-60" />
					</a>
				</div>
			</div>
		{:else if tab === 'tiktok'}
			<div class="connect-card">
				<p class="connect-desc">
					OAuth opens TikTok’s consent screen. For local dev you need HTTPS (for example ngrok) and matching
					redirect URIs in the TikTok developer portal.
				</p>
				<div class="btn-row">
					<button type="button" class="btn-primary" onclick={connectTiktok}>Connect TikTok</button>
					<a href="/dashboard/post-tests" class="btn-link">Test posting</a>
				</div>
			</div>
		{:else if tab === 'linkedin'}
			<div class="connect-card">
				<p class="connect-desc">
					Choose a personal profile, organization pages you admin, or both. Tokens are stored like other
					channels.
				</p>
				{#if linkedinReady}
					<div class="cred-ok">
						<CheckCircle2 size={14} class="text-emerald-400 shrink-0" />
						<span>LinkedIn app credentials look good.</span>
					</div>
				{:else}
					<div class="cred-bad">
						<AlertTriangle size={14} class="text-amber-400 shrink-0" />
						<span>Server env missing: <span class="mono">{linkedinStatus?.missing?.join(', ') ?? 'unknown'}</span></span>
					</div>
				{/if}
				<div class="btn-row flex-wrap">
					<button type="button" class="btn-primary" disabled={!linkedinReady} onclick={() => void connectLinkedin('member')}>
						Connect profile
					</button>
					<button
						type="button"
						class="btn-secondary"
						disabled={!linkedinReady}
						onclick={() => void connectLinkedin('org')}
					>
						Connect pages
					</button>
					<button
						type="button"
						class="btn-secondary"
						disabled={!linkedinReady}
						onclick={() => void connectLinkedin('both')}
					>
						Connect both
					</button>
				</div>
			</div>
		{:else if tab === 'gmb'}
			<div class="connect-card">
				<p class="connect-desc">
					Connect your Google Business Profile to list locations and schedule Google posts from the scheduler.
				</p>
				{#if gmbReady}
					<div class="cred-ok">
						<CheckCircle2 size={14} class="text-emerald-400 shrink-0" />
						<span>Google Business OAuth credentials look good.</span>
					</div>
				{:else}
					<div class="cred-bad">
						<AlertTriangle size={14} class="text-amber-400 shrink-0" />
						<span>Server env missing: <span class="mono">{gmbStatus?.missing?.join(', ') ?? 'unknown'}</span></span>
					</div>
				{/if}
				<div class="btn-row">
					<button type="button" class="btn-primary" disabled={!gmbReady} onclick={() => void connectGmb()}>
						Connect Google Business Profile
					</button>
				</div>
			</div>
		{/if}

		<hr class="sep" />

		<h3 class="section-label">Connected accounts</h3>
		{#if activeConnections.length === 0}
			<div class="empty">
				<Link2 size={22} class="text-white/15 mb-2" />
				<p class="empty-title">No {tabLabel} accounts linked yet</p>
				<p class="empty-body">Use Connect above — you can link multiple accounts by running through OAuth again.</p>
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
			<p class="after-list">Need another workspace? Run <strong>Connect</strong> again for this channel.</p>
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

	.banner {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.75rem 1rem;
		border-radius: 12px;
		margin-bottom: 1rem;
		font-size: 0.8125rem;
		line-height: 1.45;
	}
	.banner-ok {
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		color: rgba(167, 243, 208, 0.95);
	}
	.banner-err {
		background: rgba(251, 146, 60, 0.08);
		border: 1px solid rgba(251, 146, 60, 0.25);
		color: rgba(254, 215, 170, 0.95);
	}
	.banner-text {
		margin: 0;
		flex: 1;
		font-family: 'DM Sans', sans-serif;
	}
	.banner-dismiss {
		flex-shrink: 0;
		padding: 0.2rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		opacity: 0.6;
		cursor: pointer;
	}
	.banner-dismiss:hover {
		opacity: 1;
		background: rgba(0, 0, 0, 0.15);
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

	.status-loading {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.35);
		margin: 0 0 1rem;
	}

	.connect-card {
		padding: 1rem 1.1rem;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.22);
		border: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 0.5rem;
	}

	.connect-desc {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.45);
		font-family: 'DM Sans', sans-serif;
	}

	.cred-ok,
	.cred-bad {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.75rem;
		margin-bottom: 0.85rem;
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
	}
	.cred-ok {
		background: rgba(16, 185, 129, 0.08);
		color: rgba(167, 243, 208, 0.88);
	}
	.cred-bad {
		background: rgba(245, 158, 11, 0.08);
		color: rgba(253, 230, 138, 0.9);
	}

	.btn-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.btn-primary {
		padding: 0.55rem 1.1rem;
		border-radius: 10px;
		border: none;
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: 'DM Sans', sans-serif;
		cursor: pointer;
		background: #e8ff48;
		color: #0a0a0a;
		transition: opacity 0.12s, transform 0.12s;
	}
	.btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
	}
	.btn-primary:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: 0.55rem 1rem;
		border-radius: 10px;
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: 'DM Sans', sans-serif;
		cursor: pointer;
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.12);
		transition: opacity 0.12s, background 0.12s;
	}
	.btn-secondary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.12);
	}
	.btn-secondary:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.btn-link {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.4);
		text-decoration: none;
		font-family: 'DM Sans', sans-serif;
	}
	.btn-link:hover {
		color: #e8ff48;
	}

	.empty {
		text-align: center;
		padding: 1.5rem 1rem;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.2);
		border: 1px dashed rgba(255, 255, 255, 0.08);
	}

	.empty-title {
		margin: 0 0 0.35rem;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.55);
		font-weight: 600;
	}

	.empty-body {
		margin: 0;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.32);
	}

	.after-list {
		margin: 0.85rem 0 0;
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.28);
		font-family: 'DM Sans', sans-serif;
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
