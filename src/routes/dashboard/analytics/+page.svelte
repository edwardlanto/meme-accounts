<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { AnalyticsPlatform, ConnectionSummary, PostStats } from './+page.server';
	import {
		BarChart3, Camera, Share2, Music2, Building2, MapPin, ArrowRight,
		Link2, PlugZap, AlertTriangle, CheckCircle2, ExternalLink, X,
		TrendingUp, TrendingDown, Eye, Heart, Repeat2, Users, Calendar,
		Clock, Zap, Award
	} from 'lucide-svelte';

	type Status = { ok: boolean; missing: string[]; present: string[] };

	let { data } = $props();

	let tab = $state<AnalyticsPlatform>('instagram');
	let chartTab = $state<'overview'|'engagement'|'content'|'timing'>('overview');
	let animateChart = $state(false);

	const platforms: { id: AnalyticsPlatform; label: string; icon: typeof Camera; color: string }[] = [
		{ id: 'instagram', label: 'Instagram', icon: Camera,   color: '#E1306C' },
		{ id: 'facebook',  label: 'Facebook',  icon: Share2,   color: '#1877F2' },
		{ id: 'tiktok',    label: 'TikTok',    icon: Music2,   color: '#010101' },
		{ id: 'linkedin',  label: 'LinkedIn',  icon: Building2,color: '#0A66C2' },
		{ id: 'gmb',       label: 'Google Biz',icon: MapPin,   color: '#4285F4' },
	];

	// ── Dummy analytics data ──────────────────────────────────────
	const weeklyPublished = [4, 7, 5, 9, 12, 8, 11, 15, 10, 13, 16, 14];
	const weeklyReach     = [1200, 2100, 1800, 3400, 4200, 2900, 4800, 6200, 4100, 5500, 7100, 6400];
	const weekLabels      = ['Jan W1','Jan W2','Jan W3','Jan W4','Feb W1','Feb W2','Feb W3','Feb W4','Mar W1','Mar W2','Mar W3','Mar W4'];

	const engagementByPlatform = [
		{ platform: 'Instagram', rate: 6.8, color: '#E1306C', posts: 47 },
		{ platform: 'TikTok',    rate: 9.2, color: '#010101', posts: 23 },
		{ platform: 'Facebook',  rate: 3.1, color: '#1877F2', posts: 31 },
		{ platform: 'LinkedIn',  rate: 4.4, color: '#0A66C2', posts: 18 },
		{ platform: 'YouTube',   rate: 5.7, color: '#FF0000', posts: 12 },
	];

	const contentTypes = [
		{ label: 'Carousels', pct: 34, color: '#8B5CF6' },
		{ label: 'News Template',  pct: 22, color: '#06B6D4' },
		{ label: 'Tweet Carousel', pct: 18, color: '#E8FF48' },
		{ label: 'Text Carousel',  pct: 14, color: '#F97316' },
		{ label: 'Article',        pct: 12, color: '#10B981' },
	];

	// Best posting times heatmap (hour 6–22, days 0=Mon..6=Sun)
	const heatmapData: number[][] = [
		[1,2,3,4,5,6,5,4,3,2,1,1,1,2,3,4,5],// Mon
		[1,2,4,6,8,9,8,7,5,4,3,2,2,3,4,6,7],// Tue
		[1,2,3,5,7,8,7,6,4,3,2,2,2,3,5,7,8],// Wed
		[2,3,5,7,9,9,8,7,5,4,3,2,3,4,6,8,9],// Thu
		[1,2,4,6,7,8,7,6,5,4,3,3,4,5,7,9,9],// Fri
		[1,1,2,3,4,4,4,5,6,7,7,6,5,5,5,6,6],// Sat
		[1,1,2,2,3,4,4,4,5,5,5,4,4,3,3,4,5],// Sun
	];
	const heatHours = ['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm'];
	const heatDays  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

	// Top posts dummy
	const topPosts = [
		{ title: '5 AI Tools That Changed My Workflow',    platform: 'Instagram', likes: 4820, comments: 312, shares: 891, reach: '42.1K', status: 'published' },
		{ title: 'Breaking: Fed Rate Decision Explained',   platform: 'TikTok',    likes: 9200, comments: 743, shares: 2100,reach: '89.3K', status: 'published' },
		{ title: 'Morning Routine That 10x\'d My Output',   platform: 'Instagram', likes: 3100, comments: 208, shares: 567, reach: '28.7K', status: 'published' },
		{ title: 'Why Most People Fail at Content (Thread)',platform: 'LinkedIn',  likes: 1840, comments: 431, shares: 289, reach: '16.2K', status: 'published' },
		{ title: 'Q1 Recap: What Actually Worked',         platform: 'Facebook',  likes: 920,  comments: 87,  shares: 134, reach: '9.8K',  status: 'published' },
	];

	const kpis = [
		{ label: 'Total Published',   value: '124',   change: '+18%',  up: true,  icon: Zap,       color: '#E8FF48' },
		{ label: 'Avg. Reach',        value: '4.2K',  change: '+31%',  up: true,  icon: Eye,       color: '#8B5CF6' },
		{ label: 'Avg. Engagement',   value: '6.1%',  change: '+0.8%', up: true,  icon: Heart,     color: '#E1306C' },
		{ label: 'Scheduled Queue',   value: '23',    change: '-2',    up: false, icon: Calendar,  color: '#06B6D4' },
		{ label: 'Accounts Connected',value: '6',     change: '+1',    up: true,  icon: Users,     color: '#F97316' },
		{ label: 'Best Day',          value: 'Thu',   change: '9.2% eng', up: true, icon: Award,   color: '#10B981' },
	];

	// SVG chart helpers
	function linePoints(data: number[], w: number, h: number, pad = 20): string {
		const max = Math.max(...data);
		return data.map((v, i) => {
			const x = pad + (i / (data.length - 1)) * (w - pad * 2);
			const y = h - pad - (v / max) * (h - pad * 2);
			return `${x},${y}`;
		}).join(' ');
	}
	function areaPath(data: number[], w: number, h: number, pad = 20): string {
		const pts = linePoints(data, w, h, pad);
		const first = pts.split(' ')[0];
		const last  = pts.split(' ').slice(-1)[0];
		const [lx] = last.split(',');
		const [fx] = first.split(',');
		return `M ${pts.split(' ').join(' L ')} L ${lx},${h - pad} L ${fx},${h - pad} Z`;
	}

	// Donut chart
	function donutSegments(data: {pct:number; color:string; label:string}[], r = 60, cx = 80, cy = 80) {
		let cumAngle = -90;
		return data.map(d => {
			const angle = (d.pct / 100) * 360;
			const startRad = (cumAngle * Math.PI) / 180;
			const endRad   = ((cumAngle + angle) * Math.PI) / 180;
			const x1 = cx + r * Math.cos(startRad);
			const y1 = cy + r * Math.sin(startRad);
			const x2 = cx + r * Math.cos(endRad);
			const y2 = cy + r * Math.sin(endRad);
			const large = angle > 180 ? 1 : 0;
			const pathData = `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${large},1 ${x2},${y2} Z`;
			cumAngle += angle;
			return { ...d, path: pathData };
		});
	}

	// Connection & status
	let zernioStatus      = $state<Status | null>(null);
	let linkedinStatus  = $state<Status | null>(null);
	let gmbStatus       = $state<Status | null>(null);
	let statusLoading   = $state(true);
	let userId          = $state('');
	let banner          = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

	function oauthNext(channel: AnalyticsPlatform): string {
		return `/dashboard/analytics?channel=${encodeURIComponent(channel)}`;
	}

	async function loadIntegrationStatuses() {
		statusLoading = true;
		try {
			const [zr, lr, gr] = await Promise.all([
				fetch('/api/integrations/zernio/status'),
				fetch('/api/integrations/linkedin/status'),
				fetch('/api/integrations/gmb/status'),
			]);
			zernioStatus     = await zr.json();
			linkedinStatus = await lr.json();
			gmbStatus      = await gr.json();
		} catch {
			zernioStatus     = { ok: false, missing: ['(failed to load status)'], present: [] };
			linkedinStatus = { ok: false, missing: ['(failed to load status)'], present: [] };
			gmbStatus      = { ok: false, missing: ['(failed to load status)'], present: [] };
		}
		statusLoading = false;
	}

	function isChannel(s: string | null): s is AnalyticsPlatform {
		return s === 'instagram' || s === 'facebook' || s === 'tiktok' || s === 'linkedin' || s === 'gmb';
	}

	onMount(async () => {
		const { data: auth } = await supabase.auth.getUser();
		userId = auth.user?.id ?? '';

		if (browser) {
			const sp = new URLSearchParams(window.location.search);
			const ch = sp.get('channel');
			if (isChannel(ch)) tab = ch;

			const err = sp.get('zernio_error') ?? sp.get('linkedin_error') ?? sp.get('gmb_error') ?? sp.get('tiktok_error');
			const errDesc = sp.get('desc');
			if (err) {
				let t = decodeURIComponent(err.replace(/\+/g, ' '));
				if (errDesc) t += ` — ${decodeURIComponent(errDesc.replace(/\+/g, ' '))}`;
				banner = { kind: 'err', text: t };
			}
			if (sp.get('zernio_connected') || sp.get('linkedin_connected') || sp.get('gmb_connected') || sp.get('tiktok_connected')) {
				await invalidateAll();
				if (!err) {
					const loc = sp.get('locations');
					let msg = 'Connected successfully.';
					if (sp.get('zernio_connected')) msg = 'Zernio connected — accounts synced.';
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
		setTimeout(() => { animateChart = true; }, 100);
	});

	async function ensureZernioOk(): Promise<boolean> {
		try {
			const res = await fetch('/api/integrations/zernio/status');
			const st = (await res.json()) as Status;
			if (!st.ok) { banner = { kind: 'err', text: `Zernio is not configured yet. Missing: ${st.missing.join(', ')}` }; return false; }
			return true;
		} catch { banner = { kind: 'err', text: 'Could not verify Zernio credentials.' }; return false; }
	}
	async function ensureLinkedinOk(): Promise<boolean> {
		try {
			const res = await fetch('/api/integrations/linkedin/status');
			const st = (await res.json()) as Status;
			if (!st.ok) { banner = { kind: 'err', text: `LinkedIn is not configured yet. Missing: ${st.missing.join(', ')}` }; return false; }
			return true;
		} catch { banner = { kind: 'err', text: 'Could not verify LinkedIn credentials.' }; return false; }
	}
	async function ensureGmbOk(): Promise<boolean> {
		try {
			const res = await fetch('/api/integrations/gmb/status');
			const st = (await res.json()) as Status;
			if (!st.ok) { banner = { kind: 'err', text: `Google Business is not configured yet. Missing: ${st.missing.join(', ')}` }; return false; }
			return true;
		} catch { banner = { kind: 'err', text: 'Could not verify Google Business credentials.' }; return false; }
	}

	async function connectInstagram() { if (!(await ensureZernioOk())) return; if (!userId) { goto('/login'); return; } window.location.href = `/api/auth/zernio/start?platform=instagram&userId=${encodeURIComponent(userId)}&next=${encodeURIComponent(oauthNext('instagram'))}`; }
	async function connectFacebook()  { if (!(await ensureZernioOk())) return; if (!userId) { goto('/login'); return; } window.location.href = `/api/auth/zernio/start?platform=facebook&userId=${encodeURIComponent(userId)}&next=${encodeURIComponent(oauthNext('facebook'))}`; }
	async function connectTiktok() { if (!(await ensureZernioOk())) return; if (!userId) { goto('/login'); return; } window.location.href = `/api/auth/zernio/start?platform=tiktok&userId=${encodeURIComponent(userId)}&next=${encodeURIComponent(oauthNext('tiktok'))}`; }
	async function connectLinkedin(mode: 'member'|'org'|'both') { if (!(await ensureLinkedinOk())) return; if (!userId) { goto('/login'); return; } window.location.href = `/api/auth/linkedin/start?userId=${encodeURIComponent(userId)}&mode=${encodeURIComponent(mode)}&next=${encodeURIComponent(oauthNext('linkedin'))}`; }
	async function connectGmb() { if (!(await ensureGmbOk())) return; if (!userId) { goto('/login'); return; } window.location.href = `/api/auth/gmb/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent(oauthNext('gmb'))}`; }

	function connectionsFor(tabId: AnalyticsPlatform): ConnectionSummary[] {
		const list = data.connections ?? [];
		if (tabId === 'tiktok') return list.filter((c) => c.provider === 'zernio' && String((c.meta as { platform?: string } | null)?.platform) === 'tiktok');
		if (tabId === 'linkedin') return list.filter((c) => c.provider === 'linkedin');
		if (tabId === 'gmb') return list.filter((c) => c.provider === 'gmb');
		const z = list.filter((c) => c.provider === 'zernio');
		if (tabId === 'facebook') return z.filter((c) => String((c.meta as { platform?: string } | null)?.platform) === 'facebook');
		if (tabId === 'instagram') return z.filter((c) => String((c.meta as { platform?: string } | null)?.platform) === 'instagram');
		return [];
	}

	function statsFor(tabId: AnalyticsPlatform): PostStats {
		return data.statsByPlatform?.[tabId] ?? { published: 0, scheduled: 0, failed: 0, publishing: 0, cancelled: 0, total: 0 };
	}

	const activeConnections = $derived(connectionsFor(tab));
	const activeStats       = $derived(statsFor(tab));
	const tabLabel          = $derived(platforms.find((x) => x.id === tab)?.label ?? 'Channel');
	const zernioReady         = $derived(!!zernioStatus?.ok);
	const linkedinReady     = $derived(!!linkedinStatus?.ok);
	const gmbReady          = $derived(!!gmbStatus?.ok);

	const donutParts = donutSegments(contentTypes);
	const maxEng = Math.max(...engagementByPlatform.map(e => e.rate));
</script>

<div class="page">

	<!-- Page header -->
	<div class="page-head">
		<div class="page-head-left">
			<div class="page-icon">
				<BarChart3 size={20} />
			</div>
			<div>
				<h1 class="page-title">Analytics</h1>
				<p class="page-sub">Publishing performance across all your channels</p>
			</div>
		</div>
		<div class="page-head-right">
			<div class="date-range">
				<Calendar size={13} />
				<span>Last 90 days</span>
			</div>
			<a href="/dashboard/post-scheduler" class="btn-primary-sm">
				Schedule a post
				<ArrowRight size={14} />
			</a>
		</div>
	</div>

	{#if banner}
		<div class="banner {banner.kind === 'ok' ? 'banner-ok' : 'banner-err'}">
			{#if banner.kind === 'ok'}<CheckCircle2 size={15} class="shrink-0" />{:else}<AlertTriangle size={15} class="shrink-0" />{/if}
			<p class="banner-text">{banner.text}</p>
			<button type="button" class="banner-x" onclick={() => (banner = null)}><X size={13} /></button>
		</div>
	{/if}

	<!-- ── KPI Summary Row ───────────────────────────────────────── -->
	<div class="kpi-row">
		{#each kpis as kpi}
			{@const Icon = kpi.icon}
			<div class="kpi-card" style="--accent: {kpi.color}">
				<div class="kpi-top">
					<div class="kpi-icon-wrap" style="background:{kpi.color}18;color:{kpi.color}">
						<Icon size={15} />
					</div>
					<div class="kpi-change {kpi.up ? 'kpi-change--up' : 'kpi-change--down'}">
						{#if kpi.up}<TrendingUp size={11}/>{:else}<TrendingDown size={11}/>{/if}
						{kpi.change}
					</div>
				</div>
				<div class="kpi-value">{kpi.value}</div>
				<div class="kpi-label">{kpi.label}</div>
			</div>
		{/each}
	</div>

	<!-- ── Chart tabs ───────────────────────────────────────────── -->
	<div class="chart-section">
		<div class="chart-tabs">
			{#each [
				{id: 'overview',    label: 'Posts Over Time'},
				{id: 'engagement',  label: 'Engagement by Platform'},
				{id: 'content',     label: 'Content Mix'},
				{id: 'timing',      label: 'Best Times to Post'},
			] as t}
				<button
					type="button"
					class="chart-tab {chartTab === t.id ? 'chart-tab--on' : ''}"
					onclick={() => { chartTab = t.id as typeof chartTab; animateChart = false; setTimeout(() => animateChart = true, 50); }}
				>
					{t.label}
				</button>
			{/each}
		</div>

		<div class="chart-body">

			<!-- Overview: Line chart -->
			{#if chartTab === 'overview'}
				<div class="chart-line-wrap">
					<div class="chart-legend">
						<span class="legend-dot" style="background:#E8FF48"></span><span class="legend-label">Posts Published</span>
						<span class="legend-dot" style="background:#8B5CF6"></span><span class="legend-label">Reach (hundreds)</span>
					</div>
					<div class="chart-area">
						<svg width="100%" height="220" viewBox="0 0 740 220" preserveAspectRatio="none" class:chart-visible={animateChart}>
							<defs>
								<linearGradient id="lime-grad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stop-color="#E8FF48" stop-opacity="0.25"/>
									<stop offset="100%" stop-color="#E8FF48" stop-opacity="0"/>
								</linearGradient>
								<linearGradient id="violet-grad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.2"/>
									<stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/>
								</linearGradient>
							</defs>

							<!-- Grid lines -->
							{#each [0, 55, 110, 165, 220] as y}
								<line x1="40" y1={y} x2="740" y2={y} stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
							{/each}

							<!-- Y labels -->
							{#each [0, 5, 10, 15, 20] as v, i}
								<text x="32" y={220 - i * 55 + 4} font-size="10" fill="rgba(255,255,255,0.25)" text-anchor="end" font-family="Satoshi, sans-serif">{v}</text>
							{/each}

							<!-- Reach area (scaled) -->
							<path
								d={areaPath(weeklyReach.map(v => v/500), 740, 220)}
								fill="url(#violet-grad)"
								class="chart-path-area"
							/>
							<polyline
								points={linePoints(weeklyReach.map(v => v/500), 740, 220)}
								fill="none" stroke="#8B5CF6" stroke-width="2"
								stroke-dasharray="4 3" opacity="0.7"
								class="chart-line"
							/>

							<!-- Posts area -->
							<path
								d={areaPath(weeklyPublished, 740, 220)}
								fill="url(#lime-grad)"
								class="chart-path-area"
							/>
							<polyline
								points={linePoints(weeklyPublished, 740, 220)}
								fill="none" stroke="#E8FF48" stroke-width="2.5"
								class="chart-line"
							/>

							<!-- Data points -->
							{#each weeklyPublished as v, i}
								{@const x = 40 + (i / (weeklyPublished.length - 1)) * (740 - 80)}
								{@const y = 220 - 20 - (v / Math.max(...weeklyPublished)) * (220 - 40)}
								<circle cx={x} cy={y} r="4" fill="#E8FF48" stroke="#080808" stroke-width="2" class="chart-dot"/>
							{/each}

							<!-- X labels -->
							{#each weekLabels as label, i}
								{#if i % 2 === 0}
									{@const x = 40 + (i / (weekLabels.length - 1)) * (740 - 80)}
									<text x={x} y="215" font-size="9" fill="rgba(255,255,255,0.2)" text-anchor="middle" font-family="Satoshi, sans-serif">{label}</text>
								{/if}
							{/each}
						</svg>
					</div>

					<div class="insight-row">
						<div class="insight-chip">
							<TrendingUp size={12} class="text-lime-400" />
							<span>Peak week: <strong>Mar W3</strong> with 16 posts</span>
						</div>
						<div class="insight-chip">
							<Eye size={12} class="text-violet-400" />
							<span>Best reach: <strong>Mar W3</strong> — 7,100 avg</span>
						</div>
						<div class="insight-chip">
							<Repeat2 size={12} class="text-cyan-400" />
							<span>Consistency: <strong>+250%</strong> over 12 weeks</span>
						</div>
					</div>
				</div>

			<!-- Engagement by Platform: Bar chart -->
			{:else if chartTab === 'engagement'}
				<div class="chart-bar-wrap">
					<p class="chart-label">Average Engagement Rate by Platform (%)</p>
					<div class="bar-chart">
						{#each engagementByPlatform as p}
							<div class="bar-row">
								<div class="bar-platform">{p.platform}</div>
								<div class="bar-track">
									<div
										class="bar-fill {animateChart ? 'bar-fill--animated' : ''}"
										style="width: {animateChart ? (p.rate / maxEng) * 100 : 0}%; background: {p.color}; transition-delay: {engagementByPlatform.indexOf(p) * 0.08}s"
									>
										<span class="bar-value">{p.rate}%</span>
									</div>
								</div>
								<div class="bar-posts">{p.posts} posts</div>
							</div>
						{/each}
					</div>
					<div class="insight-row">
						<div class="insight-chip">
							<Award size={12} class="text-yellow-400" />
							<span>TikTok leads engagement at <strong>9.2%</strong> avg</span>
						</div>
						<div class="insight-chip">
							<TrendingUp size={12} class="text-lime-400" />
							<span>Instagram growing <strong>+1.2%</strong> per month</span>
						</div>
					</div>
				</div>

			<!-- Content type: Donut chart -->
			{:else if chartTab === 'content'}
				<div class="chart-donut-wrap">
					<div class="donut-chart-area">
						<svg width="160" height="160" viewBox="0 0 160 160">
							{#each donutParts as seg}
								<path d={seg.path} fill={seg.color} opacity="0.9" class="donut-seg"/>
							{/each}
							<circle cx="80" cy="80" r="40" fill="#111111"/>
							<text x="80" y="76" font-size="22" font-weight="700" fill="white" text-anchor="middle" font-family="Satoshi, system-ui, sans-serif">124</text>
							<text x="80" y="93" font-size="9" fill="rgba(255,255,255,0.4)" text-anchor="middle" font-family="Satoshi, sans-serif">POSTS</text>
						</svg>
					</div>
					<div class="donut-legend">
						{#each contentTypes as ct}
							<div class="donut-item">
								<div class="donut-dot" style="background:{ct.color}"></div>
								<span class="donut-label">{ct.label}</span>
								<span class="donut-pct">{ct.pct}%</span>
								<div class="donut-bar-track">
									<div class="donut-bar-fill {animateChart ? 'donut-bar-fill--on' : ''}" style="width:{ct.pct}%; background:{ct.color}; transition-delay:{contentTypes.indexOf(ct)*0.1}s"></div>
								</div>
							</div>
						{/each}
					</div>
				</div>

			<!-- Heatmap -->
			{:else if chartTab === 'timing'}
				<div class="heatmap-wrap">
					<p class="chart-label">Engagement heatmap by posting hour and day — darker = higher engagement</p>
					<div class="heatmap">
						<div class="heat-col heat-col--labels">
							<div class="heat-hour-spacer"></div>
							{#each heatDays as day}
								<div class="heat-day-label">{day}</div>
							{/each}
						</div>
						{#each heatHours as hour, hi}
							<div class="heat-col">
								<div class="heat-hour-label">{hour}</div>
								{#each heatmapData as row}
									{@const val = row[hi]}
									<div
										class="heat-cell"
										title="{heatDays[heatmapData.indexOf(row)]} {hour}: {val}/10"
										style="background: rgba(232,255,72,{val / 10 * 0.9}); border-color: rgba(232,255,72,{val/10*0.15})"
									></div>
								{/each}
							</div>
						{/each}
					</div>
					<div class="heat-legend">
						<span class="heat-legend-label">Low</span>
						<div class="heat-legend-bar">
							{#each [0.05, 0.15, 0.3, 0.5, 0.7, 0.9] as o}
								<div style="background:rgba(232,255,72,{o}); flex:1; height:100%"></div>
							{/each}
						</div>
						<span class="heat-legend-label">High</span>
					</div>
					<div class="insight-row">
						<div class="insight-chip">
							<Clock size={12} class="text-lime-400" />
							<span>Best window: <strong>Thu 9–11am</strong></span>
						</div>
						<div class="insight-chip">
							<Award size={12} class="text-orange-400" />
							<span>Worst: <strong>Sun 6–8am</strong> — avoid</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- ── Top Performing Posts ──────────────────────────────────── -->
	<div class="top-posts-section">
		<div class="top-posts-head">
			<h2 class="section-title">Top Performing Posts</h2>
			<span class="section-badge">Last 90 days</span>
		</div>

		<div class="posts-table">
			<div class="posts-table-head">
				<div class="col-wide">Post</div>
				<div class="col">Platform</div>
				<div class="col">Reach</div>
				<div class="col">Likes</div>
				<div class="col">Comments</div>
				<div class="col">Shares</div>
			</div>

			{#each topPosts as post, i}
				<div class="post-row" style="animation-delay: {i * 0.07}s" class:row-visible={animateChart}>
					<div class="col-wide">
						<div class="post-num">#{i + 1}</div>
						<span class="post-title">{post.title}</span>
					</div>
					<div class="col">
						<span class="platform-badge platform-badge--{post.platform.toLowerCase()}">{post.platform}</span>
					</div>
					<div class="col col-stat">{post.reach}</div>
					<div class="col col-stat">
						<Heart size={11} class="stat-icon" />
						{post.likes.toLocaleString()}
					</div>
					<div class="col col-stat">{post.comments.toLocaleString()}</div>
					<div class="col col-stat">
						<Repeat2 size={11} class="stat-icon" />
						{post.shares.toLocaleString()}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- ── Channel tabs + Connect section ───────────────────────── -->
	<div class="connect-section">
		<div class="connect-head">
			<h2 class="section-title">Connected Channels</h2>
			<a href="/dashboard/settings" class="link-muted">
				<PlugZap size={13} />
				Environment settings
			</a>
		</div>

		<nav class="platform-tabs" aria-label="Social channels">
			{#each platforms as p (p.id)}
				{@const PIcon = p.icon}
				<button
					type="button"
					onclick={() => (tab = p.id)}
					class="ptab {tab === p.id ? 'ptab--on' : ''}"
					style="--c: {p.color}"
					aria-current={tab === p.id ? 'page' : undefined}
				>
					<span class="ptab-icon" style="background:{p.color}18">
						<PIcon size={14} />
					</span>
					{p.label}
				</button>
			{/each}
		</nav>

		<!-- Live stats from queue -->
		<div class="queue-kpis">
			<div class="qkpi"><span class="qkpi-val">{activeStats.published}</span><span class="qkpi-label">Published</span></div>
			<div class="qkpi"><span class="qkpi-val">{activeStats.scheduled}</span><span class="qkpi-label">Scheduled</span></div>
			<div class="qkpi"><span class="qkpi-val">{activeStats.publishing}</span><span class="qkpi-label">In progress</span></div>
			<div class="qkpi qkpi--warn"><span class="qkpi-val">{activeStats.failed}</span><span class="qkpi-label">Failed</span></div>
			<div class="qkpi qkpi--muted"><span class="qkpi-val">{activeStats.cancelled}</span><span class="qkpi-label">Cancelled</span></div>
			<div class="qkpi qkpi--total"><span class="qkpi-val">{activeStats.total}</span><span class="qkpi-label">Total queue</span></div>
		</div>

		<!-- Connect card -->
		{#if statusLoading}
			<div class="status-loading">
				<div class="spinner"></div>
				<span>Checking platform credentials…</span>
			</div>
		{:else if tab === 'instagram'}
			<div class="conn-card">
				<p class="conn-desc">Connect Instagram through <a href="https://docs.zernio.com/" target="_blank" rel="noreferrer" class="underline">Zernio</a> (Business/Creator). Requires <code>ZERNIO_API_KEY</code> and <code>PUBLIC_APP_URL</code> on the server.</p>
				{#if zernioReady}
					<div class="cred-ok"><CheckCircle2 size={14}/><span>Zernio configuration looks good.</span></div>
				{:else}
					<div class="cred-bad"><AlertTriangle size={14}/><span>Server env missing: <code>{zernioStatus?.missing?.join(', ') ?? 'unknown'}</code></span></div>
				{/if}
				<div class="conn-btns">
					<button type="button" class="btn-connect" disabled={!zernioReady} onclick={() => void connectInstagram()}>Connect Instagram</button>
					<a href="https://docs.zernio.com/platforms/instagram" target="_blank" rel="noreferrer" class="btn-link">Zernio Instagram <ExternalLink size={11}/></a>
				</div>
			</div>
		{:else if tab === 'facebook'}
			<div class="conn-card">
				<p class="conn-desc">Connect a Facebook Page via Zernio. After OAuth, pick your Page in Zernio’s flow; we sync the account into Carousel Studio.</p>
				{#if zernioReady}
					<div class="cred-ok"><CheckCircle2 size={14}/><span>Zernio configuration looks good.</span></div>
				{:else}
					<div class="cred-bad"><AlertTriangle size={14}/><span>Server env missing: <code>{zernioStatus?.missing?.join(', ') ?? 'unknown'}</code></span></div>
				{/if}
				<div class="conn-btns">
					<button type="button" class="btn-connect" disabled={!zernioReady} onclick={() => void connectFacebook()}>Connect Facebook Page</button>
					<a href="https://docs.zernio.com/platforms/facebook" target="_blank" rel="noreferrer" class="btn-link">Zernio Facebook <ExternalLink size={11}/></a>
				</div>
			</div>
		{:else if tab === 'tiktok'}
			<div class="conn-card">
				<p class="conn-desc">TikTok uses the same Zernio OAuth flow. Direct posts require the consent flags Zernio sends on your behalf.</p>
				{#if zernioReady}
					<div class="cred-ok"><CheckCircle2 size={14}/><span>Zernio configuration looks good.</span></div>
				{:else}
					<div class="cred-bad"><AlertTriangle size={14}/><span>Server env missing: <code>{zernioStatus?.missing?.join(', ') ?? 'unknown'}</code></span></div>
				{/if}
				<div class="conn-btns">
					<button type="button" class="btn-connect" disabled={!zernioReady} onclick={() => void connectTiktok()}>Connect TikTok</button>
					<a href="/dashboard/post-tests" class="btn-link">Test posting</a>
				</div>
			</div>
		{:else if tab === 'linkedin'}
			<div class="conn-card">
				<p class="conn-desc">Connect a personal profile, organization pages, or both.</p>
				{#if linkedinReady}
					<div class="cred-ok"><CheckCircle2 size={14}/><span>LinkedIn credentials look good.</span></div>
				{:else}
					<div class="cred-bad"><AlertTriangle size={14}/><span>Missing: <code>{linkedinStatus?.missing?.join(', ') ?? 'unknown'}</code></span></div>
				{/if}
				<div class="conn-btns">
					<button type="button" class="btn-connect" disabled={!linkedinReady} onclick={() => void connectLinkedin('member')}>Connect profile</button>
					<button type="button" class="btn-secondary" disabled={!linkedinReady} onclick={() => void connectLinkedin('org')}>Connect pages</button>
					<button type="button" class="btn-secondary" disabled={!linkedinReady} onclick={() => void connectLinkedin('both')}>Connect both</button>
				</div>
			</div>
		{:else if tab === 'gmb'}
			<div class="conn-card">
				<p class="conn-desc">Connect your Google Business Profile to list locations and schedule posts.</p>
				{#if gmbReady}
					<div class="cred-ok"><CheckCircle2 size={14}/><span>Google Business credentials look good.</span></div>
				{:else}
					<div class="cred-bad"><AlertTriangle size={14}/><span>Missing: <code>{gmbStatus?.missing?.join(', ') ?? 'unknown'}</code></span></div>
				{/if}
				<div class="conn-btns">
					<button type="button" class="btn-connect" disabled={!gmbReady} onclick={() => void connectGmb()}>Connect Google Business Profile</button>
				</div>
			</div>
		{/if}

		<!-- Connected accounts list -->
		<div class="accounts-section">
			<p class="accounts-title">Connected accounts</p>
			{#if activeConnections.length === 0}
				<div class="empty-accounts">
					<Link2 size={20} class="empty-icon" />
					<p class="empty-title">No {tabLabel} accounts linked yet</p>
					<p class="empty-body">Use Connect above — you can link multiple accounts by running through OAuth again.</p>
				</div>
			{:else}
				<ul class="acct-list">
					{#each activeConnections as c (c.provider + c.provider_account_id)}
						<li class="acct-item">
							<div class="acct-avatar">{(c.provider_account_label ?? c.provider_account_id ?? '?')[0].toUpperCase()}</div>
							<div>
								<p class="acct-label">{c.provider_account_label ?? c.provider_account_id}</p>
								<p class="acct-meta">{c.provider}{c.updated_at ? ` · Updated ${new Date(c.updated_at).toLocaleDateString()}` : ''}</p>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<style>
	:root:not([data-theme="dark"]) {
		--panel-bg: color-mix(in oklab, var(--app-text) 3%, transparent);
		--panel-bg-2: color-mix(in oklab, var(--app-text) 4%, transparent);
		--panel-border: var(--app-border);
		--panel-border-hover: var(--app-border-hover);
		--t-strong: var(--app-text);
		--t: var(--app-text-2);
		--t-muted: var(--app-text-3);
	}
	:root[data-theme="dark"] {
		--panel-bg: rgba(255,255,255,0.02);
		--panel-bg-2: rgba(255,255,255,0.04);
		--panel-border: rgba(255,255,255,0.06);
		--panel-border-hover: rgba(255,255,255,0.10);
		--t-strong: rgba(255,255,255,0.92);
		--t: rgba(255,255,255,0.55);
		--t-muted: rgba(255,255,255,0.38);
	}

	.page { color: var(--app-text); }
	.page { padding: 2rem 2.5rem; max-width: 1100px; display: flex; flex-direction: column; gap: 2rem; }

	/* ── Page header ────────────────────────────────────────────── */
	.page-head {
		display: flex; align-items: center; justify-content: space-between;
		gap: 1rem; flex-wrap: wrap;
	}
	.page-head-left { display: flex; align-items: center; gap: 1rem; }
	.page-head-right { display: flex; align-items: center; gap: 0.75rem; }

	.page-icon {
		width: 44px; height: 44px; border-radius: 12px;
		background: #E8FF48;
		display: flex; align-items: center; justify-content: center;
		color: #0a0a0a; flex-shrink: 0;
	}
	.page-title {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1.6rem;
		font-weight: 900; letter-spacing: -0.03em; color: var(--t-strong); margin: 0 0 0.2rem;
	}
	.page-sub { font-size: 0.8125rem; color: var(--t-muted); margin: 0; }

	.date-range {
		display: flex; align-items: center; gap: 0.4rem;
		padding: 0.45rem 0.85rem; border-radius: 8px;
		background: var(--panel-bg-2); border: 1px solid var(--panel-border);
		font-size: 0.75rem; color: var(--t); font-family: 'Satoshi', sans-serif;
	}

	.btn-primary-sm {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.55rem 1rem; border-radius: 10px;
		background: #E8FF48; color: #0a0a0a;
		font-size: 0.8125rem; font-weight: 600; text-decoration: none;
		font-family: 'Satoshi', sans-serif;
		transition: transform 0.12s, box-shadow 0.12s;
	}
	.btn-primary-sm:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(232,255,72,0.2); }

	/* ── Banner ────────────────────────────────────────────────── */
	.banner { display: flex; align-items: center; gap: 0.65rem; padding: 0.75rem 1rem; border-radius: 12px; font-size: 0.8125rem; }
	.banner-ok { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: rgba(167,243,208,0.95); }
	.banner-err { background: rgba(251,146,60,0.08); border: 1px solid rgba(251,146,60,0.25); color: rgba(254,215,170,0.95); }
	.banner-text { margin: 0; flex: 1; }
	.banner-x { border: none; background: transparent; color: inherit; opacity: 0.6; cursor: pointer; padding: 0.2rem; border-radius: 4px; }
	.banner-x:hover { opacity: 1; }

	/* ── KPI row ───────────────────────────────────────────────── */
	.kpi-row {
		display: grid; grid-template-columns: repeat(6, 1fr);
		gap: 0.75rem;
	}
	.kpi-card {
		padding: 1.1rem; border-radius: 14px;
		background: var(--panel-bg);
		border: 1px solid var(--panel-border);
		display: flex; flex-direction: column; gap: 0.5rem;
		transition: border-color 0.2s, background 0.2s;
		position: relative; overflow: hidden;
	}
	.kpi-card::before {
		content: ''; position: absolute;
		top: -30px; right: -30px;
		width: 80px; height: 80px; border-radius: 50%;
		background: var(--accent, transparent); opacity: 0.05;
	}
	.kpi-card:hover { border-color: var(--panel-border-hover); background: var(--panel-bg-2); }

	.kpi-top { display: flex; align-items: center; justify-content: space-between; }
	.kpi-icon-wrap {
		width: 30px; height: 30px; border-radius: 8px;
		display: flex; align-items: center; justify-content: center;
	}
	.kpi-change {
		display: inline-flex; align-items: center; gap: 3px;
		font-size: 0.65rem; font-family: 'Satoshi', sans-serif;
		padding: 2px 6px; border-radius: 4px; font-weight: 700;
	}
	.kpi-change--up   { background: rgba(16,185,129,0.12); color: #34d399; }
	.kpi-change--down { background: rgba(239,68,68,0.1);   color: #f87171; }
	.kpi-value {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1.6rem;
		font-weight: 900; color: var(--t-strong); line-height: 1;
	}
	.kpi-label { font-size: 0.7rem; color: var(--t-muted); font-family: 'Satoshi', sans-serif; text-transform: uppercase; letter-spacing: 0.07em; }

	/* ── Chart section ─────────────────────────────────────────── */
	.chart-section {
		border-radius: 18px;
		background: var(--panel-bg);
		border: 1px solid var(--panel-border);
		overflow: hidden;
	}
	.chart-tabs {
		display: flex; gap: 0; border-bottom: 1px solid var(--panel-border);
		overflow-x: auto;
	}
	.chart-tab {
		padding: 0.85rem 1.25rem; border: none; background: transparent;
		color: var(--t-muted); font-size: 0.8125rem; font-family: 'Satoshi', sans-serif;
		font-weight: 500; cursor: pointer; white-space: nowrap;
		border-bottom: 2px solid transparent; transition: all 0.15s;
	}
	.chart-tab:hover { color: var(--t-strong); }
	.chart-tab--on { color: #E8FF48; border-bottom-color: #E8FF48; background: rgba(232,255,72,0.03); }

	.chart-body { padding: 1.5rem 1.75rem; }

	/* Line chart */
	.chart-line-wrap { display: flex; flex-direction: column; gap: 1rem; }
	.chart-legend { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 0.25rem; }
	.legend-dot { width: 8px; height: 8px; border-radius: 2px; }
	.legend-label { font-size: 0.75rem; color: var(--t); font-family: 'Satoshi', sans-serif; }
	.chart-area { width: 100%; overflow: hidden; }

	:global(.chart-line) { stroke-dashoffset: 1000; transition: stroke-dashoffset 1.5s ease; }
	:global(.chart-visible .chart-line) { stroke-dashoffset: 0; }
	:global(.chart-path-area) { opacity: 0; transition: opacity 0.8s ease 0.3s; }
	:global(.chart-visible .chart-path-area) { opacity: 1; }
	:global(.chart-dot) { opacity: 0; transition: opacity 0.3s ease; }
	:global(.chart-visible .chart-dot) { opacity: 1; }

	/* Bar chart */
	.chart-bar-wrap { display: flex; flex-direction: column; gap: 1rem; }
	.chart-label { font-size: 0.75rem; color: var(--t-muted); font-family: 'Satoshi', sans-serif; text-transform: uppercase; letter-spacing: 0.08em; }
	.bar-chart { display: flex; flex-direction: column; gap: 0.85rem; }
	.bar-row { display: grid; grid-template-columns: 110px 1fr 70px; align-items: center; gap: 1rem; }
	.bar-platform { font-size: 0.8125rem; font-weight: 500; color: var(--t-strong); }
	.bar-track { height: 32px; background: var(--panel-bg-2); border-radius: 6px; overflow: hidden; position: relative; }
	.bar-fill {
		height: 100%; border-radius: 6px; display: flex; align-items: center;
		min-width: 2px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); position: relative;
	}
	.bar-value { position: absolute; right: 8px; font-size: 0.75rem; font-family: 'Satoshi', sans-serif; font-weight: 700; color: rgba(0,0,0,0.7); white-space: nowrap; }
	.bar-posts { font-size: 0.7rem; color: var(--t-muted); font-family: 'Satoshi', sans-serif; text-align: right; }

	/* Donut chart */
	.chart-donut-wrap { display: grid; grid-template-columns: 200px 1fr; gap: 2.5rem; align-items: center; }
	.donut-chart-area { display: flex; justify-content: center; }
	.donut-seg { transition: opacity 0.3s; cursor: default; }
	.donut-seg:hover { opacity: 0.8; }
	.donut-legend { display: flex; flex-direction: column; gap: 0.9rem; }
	.donut-item { display: grid; grid-template-columns: 10px 1fr 40px 120px; align-items: center; gap: 0.65rem; }
	.donut-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
	.donut-label { font-size: 0.8125rem; color: var(--t); }
	.donut-pct { font-size: 0.75rem; font-family: 'Satoshi', sans-serif; color: var(--t-strong); font-weight: 700; text-align: right; }
	.donut-bar-track { height: 4px; background: color-mix(in oklab, var(--app-text) 10%, transparent); border-radius: 2px; overflow: hidden; }
	.donut-bar-fill { height: 100%; border-radius: 2px; width: 0; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
	.donut-bar-fill--on { }

	/* Heatmap */
	.heatmap-wrap { display: flex; flex-direction: column; gap: 1rem; }
	.heatmap { display: flex; gap: 4px; overflow-x: auto; }
	.heat-col { display: flex; flex-direction: column; gap: 4px; }
	.heat-col--labels { }
	.heat-hour-spacer { height: 20px; }
	.heat-hour-label { font-size: 9px; color: var(--t-muted); font-family: 'Satoshi', sans-serif; height: 24px; display: flex; align-items: center; white-space: nowrap; }
	.heat-day-label { font-size: 9px; color: var(--t-muted); font-family: 'Satoshi', sans-serif; height: 24px; display: flex; align-items: center; padding-right: 8px; }
	.heat-cell {
		width: 32px; height: 24px; border-radius: 4px;
		border: 1px solid;
		transition: transform 0.2s, opacity 0.2s;
		cursor: default;
	}
	.heat-cell:hover { transform: scale(1.15); opacity: 0.9; }
	.heat-legend { display: flex; align-items: center; gap: 8px; margin-top: 0.5rem; }
	.heat-legend-label { font-size: 9px; color: var(--t-muted); font-family: 'Satoshi', sans-serif; }
	.heat-legend-bar { width: 120px; height: 8px; border-radius: 4px; display: flex; overflow: hidden; }

	/* Insight chips */
	.insight-row { display: flex; gap: 0.65rem; flex-wrap: wrap; }
	.insight-chip {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.4rem 0.75rem; border-radius: 8px;
		background: var(--panel-bg); border: 1px solid var(--panel-border);
		font-size: 0.75rem; color: var(--t);
	}
	.insight-chip strong { color: var(--t-strong); }

	/* ── Top posts ─────────────────────────────────────────────── */
	.top-posts-section {
		border-radius: 18px;
		background: var(--panel-bg);
		border: 1px solid var(--panel-border);
		overflow: hidden;
	}
	.top-posts-head {
		display: flex; align-items: center; gap: 0.75rem;
		padding: 1.1rem 1.5rem;
		border-bottom: 1px solid var(--panel-border);
	}
	.section-title {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1rem;
		font-weight: 700; color: var(--t-strong); margin: 0;
	}
	.section-badge {
		font-size: 0.65rem; font-family: 'Satoshi', sans-serif;
		padding: 2px 8px; border-radius: 4px;
		background: var(--panel-bg-2); color: var(--t-muted);
	}

	.posts-table { width: 100%; }
	.posts-table-head {
		display: grid; grid-template-columns: 1fr 120px 80px 90px 90px 80px;
		padding: 0.6rem 1.5rem;
		font-size: 0.65rem; font-family: 'Satoshi', sans-serif;
		text-transform: uppercase; letter-spacing: 0.08em;
		color: var(--t-muted);
		border-bottom: 1px solid var(--panel-border);
	}
	.post-row {
		display: grid; grid-template-columns: 1fr 120px 80px 90px 90px 80px;
		padding: 0.85rem 1.5rem; align-items: center;
		border-bottom: 1px solid var(--panel-border);
		opacity: 0; transform: translateY(8px);
		transition: opacity 0.4s ease, transform 0.4s ease, background 0.15s;
	}
	.post-row.row-visible { opacity: 1; transform: translateY(0); }
	.post-row:hover { background: var(--panel-bg-2); }
	.post-row:last-child { border-bottom: none; }

	.col-wide { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
	.col { display: flex; align-items: center; gap: 0.3rem; }
	.col-stat { font-size: 0.8125rem; color: rgba(255,255,255,0.6); font-family: 'Satoshi', sans-serif; }
	.post-num {
		width: 22px; height: 22px; border-radius: 6px;
		background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
		display: flex; align-items: center; justify-content: center;
		font-size: 0.65rem; font-family: 'Satoshi', sans-serif; color: rgba(255,255,255,0.3);
		flex-shrink: 0;
	}
	.post-title {
		font-size: 0.8125rem; color: rgba(255,255,255,0.82);
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}

	.platform-badge {
		display: inline-flex; padding: 2px 8px; border-radius: 5px;
		font-size: 0.65rem; font-family: 'Satoshi', sans-serif; font-weight: 600;
	}
	.platform-badge--instagram { background: rgba(225,48,108,0.15); color: #f472b6; }
	.platform-badge--tiktok   { background: rgba(0,0,0,0.3); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.08); }
	.platform-badge--facebook { background: rgba(24,119,242,0.15); color: #60a5fa; }
	.platform-badge--linkedin { background: rgba(10,102,194,0.15); color: #38bdf8; }
	.platform-badge--youtube  { background: rgba(255,0,0,0.12); color: #f87171; }
	.stat-icon { color: rgba(255,255,255,0.25); flex-shrink: 0; }

	/* ── Connect section ───────────────────────────────────────── */
	.connect-section {
		border-radius: 18px;
		background: rgba(255,255,255,0.02);
		border: 1px solid rgba(255,255,255,0.06);
		padding: 1.5rem;
		display: flex; flex-direction: column; gap: 1.25rem;
	}
	.connect-head {
		display: flex; align-items: center; justify-content: space-between;
	}
	.link-muted {
		display: inline-flex; align-items: center; gap: 0.35rem;
		font-size: 0.75rem; color: rgba(255,255,255,0.3); text-decoration: none;
		font-family: 'Satoshi', sans-serif;
	}
	.link-muted:hover { color: #E8FF48; }

	.platform-tabs {
		display: flex; flex-wrap: wrap; gap: 0.35rem;
		padding: 0.4rem; border-radius: 12px;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
	}
	.ptab {
		display: inline-flex; align-items: center; gap: 0.45rem;
		padding: 0.5rem 0.85rem; border-radius: 8px; border: none;
		background: transparent; color: rgba(255,255,255,0.38);
		font-family: 'Satoshi', sans-serif; font-size: 0.8125rem; font-weight: 500;
		cursor: pointer; transition: all 0.12s;
	}
	.ptab:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.04); }
	.ptab--on { color: var(--c, #E8FF48); background: rgba(255,255,255,0.05); }
	.ptab-icon { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; }

	.queue-kpis {
		display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem;
	}
	.qkpi {
		text-align: center; padding: 0.75rem 0.5rem; border-radius: 10px;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
	}
	.qkpi-val {
		display: block; font-family: 'Satoshi', sans-serif;
		font-size: 1.2rem; font-weight: 700; color: #fff; line-height: 1.2;
	}
	.qkpi-label { display: block; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.28); font-family: 'Satoshi', sans-serif; margin-top: 0.2rem; }
	.qkpi--warn .qkpi-val { color: #fb923c; }
	.qkpi--muted .qkpi-val { color: rgba(255,255,255,0.3); }
	.qkpi--total { border-color: rgba(232,255,72,0.18); background: rgba(232,255,72,0.03); }
	.qkpi--total .qkpi-val { color: #E8FF48; }

	.status-loading { display: flex; align-items: center; gap: 0.6rem; font-size: 0.8125rem; color: rgba(255,255,255,0.35); }
	.spinner {
		width: 16px; height: 16px; border-radius: 50%;
		border: 2px solid rgba(255,255,255,0.1); border-top-color: #E8FF48;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.conn-card {
		padding: 1.1rem 1.25rem; border-radius: 12px;
		background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06);
	}
	.conn-desc { margin: 0 0 0.85rem; font-size: 0.8125rem; line-height: 1.55; color: rgba(255,255,255,0.45); }
	.cred-ok, .cred-bad {
		display: flex; align-items: center; gap: 0.5rem;
		font-size: 0.75rem; padding: 0.5rem 0.65rem; border-radius: 8px; margin-bottom: 0.85rem;
	}
	.cred-ok  { background: rgba(16,185,129,0.08); color: rgba(167,243,208,0.9); }
	.cred-bad { background: rgba(245,158,11,0.08); color: rgba(253,230,138,0.9); }
	.conn-btns { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }

	.btn-connect {
		padding: 0.55rem 1.1rem; border-radius: 10px; border: none;
		font-size: 0.8125rem; font-weight: 600; font-family: 'Satoshi', sans-serif;
		cursor: pointer; background: #E8FF48; color: #0a0a0a; transition: opacity 0.12s, transform 0.12s;
	}
	.btn-connect:hover:not(:disabled) { transform: translateY(-1px); }
	.btn-connect:disabled { opacity: 0.35; cursor: not-allowed; }

	.btn-secondary {
		padding: 0.55rem 1rem; border-radius: 10px;
		font-size: 0.8125rem; font-weight: 600; font-family: 'Satoshi', sans-serif;
		cursor: pointer; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8);
		border: 1px solid rgba(255,255,255,0.1); transition: background 0.12s;
	}
	.btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.11); }
	.btn-secondary:disabled { opacity: 0.35; cursor: not-allowed; }
	.btn-link { font-size: 0.75rem; color: rgba(255,255,255,0.38); text-decoration: none; }
	.btn-link:hover { color: #E8FF48; }

	.accounts-section { display: flex; flex-direction: column; gap: 0.65rem; }
	.accounts-title {
		font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em;
		color: rgba(255,255,255,0.28); font-family: 'Satoshi', sans-serif; font-weight: 600;
	}
	.empty-accounts {
		text-align: center; padding: 1.5rem;
		border-radius: 12px; background: rgba(0,0,0,0.15);
		border: 1px dashed rgba(255,255,255,0.07);
	}
	.empty-icon { display: block; margin: 0 auto 0.5rem; color: rgba(255,255,255,0.15); }
	.empty-title { font-size: 0.875rem; color: rgba(255,255,255,0.5); font-weight: 600; margin: 0 0 0.3rem; }
	.empty-body  { font-size: 0.78rem; color: rgba(255,255,255,0.3); margin: 0; }

	.acct-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
	.acct-item {
		display: flex; align-items: center; gap: 0.75rem;
		padding: 0.75rem 1rem; border-radius: 10px;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
	}
	.acct-avatar {
		width: 34px; height: 34px; border-radius: 50%;
		background: rgba(232,255,72,0.1); border: 1px solid rgba(232,255,72,0.2);
		display: flex; align-items: center; justify-content: center;
		font-family: 'Satoshi', sans-serif; font-size: 12px; color: #E8FF48;
		flex-shrink: 0; font-weight: 700;
	}
	.acct-label { font-size: 0.875rem; color: rgba(255,255,255,0.82); margin: 0 0 0.15rem; font-weight: 500; }
	.acct-meta { font-size: 0.7rem; color: rgba(255,255,255,0.3); margin: 0; font-family: 'Satoshi', sans-serif; }
</style>
