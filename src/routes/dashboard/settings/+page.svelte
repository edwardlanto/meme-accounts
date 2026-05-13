<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import {
		AlertTriangle, CheckCircle2, ExternalLink, KeyRound,
		User, Link2, CreditCard, Settings,
		Building2, Globe, Copy, Check, ChevronRight
	} from 'lucide-svelte';

	type Status = { ok: boolean; missing: string[]; present: string[] };
	let zernioStatus   = $state<Status | null>(null);
	let linkedinStatus = $state<Status | null>(null);
	let gmbStatus      = $state<Status | null>(null);
	let blueskyStatus  = $state<Status | null>(null);
	let snapchatStatus = $state<Status | null>(null);
	let redditStatus   = $state<Status | null>(null);
	let youtubeStatus  = $state<Status | null>(null);
	let loading        = $state(true);
	let userId         = $state<string>('');
	let userEmail      = $state<string>('');
	let userName       = $state<string>('');
	let copied         = $state<string | null>(null);

	let showBlueskyModal = $state(false);
	let bskyHandle = $state('');
	let bskyAppPassword = $state('');
	let bskyConnecting = $state(false);
	let bskyError = $state<string | null>(null);

	let activeTab = $state<'profile' | 'integrations' | 'billing'>('integrations');

	const tabs = [
		{ id: 'profile',      label: 'Profile',      icon: User },
		{ id: 'integrations', label: 'Integrations', icon: Link2 },
		{ id: 'billing',      label: 'Billing',       icon: CreditCard },
	];

	onMount(async () => {
		const { data } = await supabase.auth.getUser();
		userId    = data.user?.id ?? '';
		userEmail = data.user?.email ?? '';
		userName  = data.user?.user_metadata?.full_name ?? '';

		try {
			const [zernioRes, liRes, gmbRes, bskyRes, snapRes, redditRes, ytRes] = await Promise.all([
				fetch('/api/integrations/zernio/status'),
				fetch('/api/integrations/linkedin/status'),
				fetch('/api/integrations/gmb/status'),
				fetch('/api/integrations/bluesky/status'),
				fetch('/api/integrations/snapchat/status'),
				fetch('/api/integrations/reddit/status'),
				fetch('/api/integrations/youtube/status'),
			]);
			zernioStatus   = await zernioRes.json();
			linkedinStatus = await liRes.json();
			gmbStatus      = await gmbRes.json();
			blueskyStatus  = await bskyRes.json();
			snapchatStatus = await snapRes.json();
			redditStatus   = await redditRes.json();
			youtubeStatus  = await ytRes.json();
		} catch {
			zernioStatus   = { ok: false, missing: ['(failed)'], present: [] };
			linkedinStatus = { ok: false, missing: ['(failed)'], present: [] };
			gmbStatus      = { ok: false, missing: ['(failed)'], present: [] };
			blueskyStatus  = { ok: false, missing: ['(failed)'], present: [] };
			snapchatStatus = { ok: false, missing: ['(failed)'], present: [] };
			redditStatus   = { ok: false, missing: ['(failed)'], present: [] };
			youtubeStatus  = { ok: false, missing: ['(failed)'], present: [] };
		}
		loading = false;
	});

	async function copyText(text: string, key: string) {
		await navigator.clipboard.writeText(text);
		copied = key;
		setTimeout(() => { copied = null; }, 2000);
	}

	function connectZernio(platform: 'instagram' | 'facebook' | 'tiktok') {
		if (!userId) { goto('/login'); return; }
		if (!zernioStatus?.ok) return;
		window.location.href = `/api/auth/zernio/start?platform=${platform}&userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}
	function connectLinkedIn(mode: 'member' | 'org' | 'both') {
		if (!userId) { goto('/login'); return; }
		if (!linkedinStatus?.ok) return;
		window.location.href = `/api/auth/linkedin/start?userId=${encodeURIComponent(userId)}&mode=${encodeURIComponent(mode)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}
	function connectGmb() {
		if (!userId) { goto('/login'); return; }
		if (!gmbStatus?.ok) return;
		window.location.href = `/api/auth/gmb/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}
	function connectSnapchat() {
		if (!userId) { goto('/login'); return; }
		if (!snapchatStatus?.ok) return;
		window.location.href = `/api/auth/snapchat/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}
	function connectReddit() {
		if (!userId) { goto('/login'); return; }
		if (!redditStatus?.ok) return;
		window.location.href = `/api/auth/reddit/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}
	function connectYouTube() {
		if (!userId) { goto('/login'); return; }
		if (!youtubeStatus?.ok) return;
		window.location.href = `/api/auth/youtube/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}
	function openBlueskyModal() {
		if (!userId) { goto('/login'); return; }
		if (!blueskyStatus?.ok) return;
		bskyError = null;
		showBlueskyModal = true;
	}
	async function connectBluesky() {
		if (!userId) { goto('/login'); return; }
		if (!blueskyStatus?.ok) return;
		if (!bskyHandle.trim() || !bskyAppPassword.trim()) {
			bskyError = 'Enter your handle and an app password.';
			return;
		}
		bskyConnecting = true;
		bskyError = null;
		try {
			const res = await fetch('/api/integrations/bluesky/connect', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ userId, handle: bskyHandle.trim(), appPassword: bskyAppPassword.trim() }),
			});
			const out = await res.json();
			if (!res.ok || !out?.ok) throw new Error(out?.error ?? 'Bluesky connect failed');
			showBlueskyModal = false;
			bskyAppPassword = '';
		} catch (e: any) {
			bskyError = e?.message ?? 'Bluesky connect failed';
		} finally {
			bskyConnecting = false;
		}
	}

	const zernioEnvSnippet = `ZERNIO_API_KEY=\nPUBLIC_APP_URL=https://your-domain.com`;
	const linkedinEnvSnippet = `LINKEDIN_CLIENT_ID=\nLINKEDIN_CLIENT_SECRET=\nLINKEDIN_REDIRECT_URI=`;
	const gmbEnvSnippet = `GMB_CLIENT_ID=\nGMB_CLIENT_SECRET=\nGMB_REDIRECT_URI=`;
	const snapchatEnvSnippet = `SNAPCHAT_CLIENT_ID=\nSNAPCHAT_CLIENT_SECRET=\nSNAPCHAT_REDIRECT_URI=\nSNAPCHAT_SCOPES=snapchat-profile-api`;
	const redditEnvSnippet = `REDDIT_CLIENT_ID=\nREDDIT_CLIENT_SECRET=\nREDDIT_REDIRECT_URI=\nREDDIT_SCOPES=identity submit\nREDDIT_USER_AGENT=yourappname/1.0 (by u/yourusername)`;
	const youtubeEnvSnippet = `YOUTUBE_CLIENT_ID=\nYOUTUBE_CLIENT_SECRET=\nYOUTUBE_REDIRECT_URI=\nYOUTUBE_SCOPES=https://www.googleapis.com/auth/youtube.upload openid email profile`;

	const zernioStatusDerived    = $derived(zernioStatus);
	const linkedinStatusDerived = $derived(linkedinStatus);
	const gmbStatusDerived      = $derived(gmbStatus);
	const blueskyStatusDerived  = $derived(blueskyStatus);
	const snapchatStatusDerived = $derived(snapchatStatus);
	const redditStatusDerived   = $derived(redditStatus);
	const youtubeStatusDerived  = $derived(youtubeStatus);

	const integrations = $derived([
		{
			id: 'zernio',
			title: 'Instagram · Facebook · TikTok',
			desc: 'OAuth and posting run through Zernio. Use the buttons below or Analytics → channel tabs.',
			color: '#7C3AED',
			bg: 'rgba(124,58,237,0.10)',
			status: zernioStatusDerived,
			snippet: zernioEnvSnippet,
			onConnect: () => connectZernio('instagram'),
			btnLabel: 'Connect Instagram',
			btnColor: '#7C3AED',
			docs: 'https://docs.zernio.com/',
			docsLabel: 'Zernio docs',
		},
		{
			id: 'linkedin',
			title: 'LinkedIn',
			desc: 'Schedule posts to your personal profile, company pages, or both.',
			color: '#0A66C2',
			bg: 'rgba(10,102,194,0.08)',
			status: linkedinStatusDerived,
			snippet: linkedinEnvSnippet,
			onConnect: () => connectLinkedIn('member'),
			btnLabel: 'Connect profile',
			btnColor: '#0A66C2',
			docs: 'https://docs.microsoft.com/en-us/linkedin/',
			docsLabel: 'LinkedIn API docs',
		},
		{
			id: 'gmb',
			title: 'Google Business Profile',
			desc: 'Post updates to your Google Business locations directly from Carousel Studio.',
			color: '#4285F4',
			bg: 'rgba(66,133,244,0.08)',
			status: gmbStatusDerived,
			snippet: gmbEnvSnippet,
			onConnect: connectGmb,
			btnLabel: 'Connect Google Business',
			btnColor: '#4285F4',
			docs: 'https://developers.google.com/my-business',
			docsLabel: 'GMB API docs',
		},
		{
			id: 'bluesky',
			title: 'Bluesky',
			desc: 'Connect your Bluesky account for posting via the AT Protocol.',
			color: '#0085FF',
			bg: 'rgba(0,133,255,0.10)',
			status: blueskyStatusDerived,
			snippet: `SUPABASE_URL=\nSUPABASE_SERVICE_KEY=`,
			onConnect: openBlueskyModal,
			btnLabel: 'Connect Bluesky',
			btnColor: '#0085FF',
			docs: 'https://docs.bsky.app/',
			docsLabel: 'Bluesky docs',
		},
		{
			id: 'snapchat',
			title: 'Snapchat (Public Profile API)',
			desc: 'OAuth connect for Snap Public Profile API (allowlist required).',
			color: '#FFFC00',
			bg: 'rgba(255,252,0,0.10)',
			status: snapchatStatusDerived,
			snippet: snapchatEnvSnippet,
			onConnect: connectSnapchat,
			btnLabel: 'Connect Snapchat',
			btnColor: '#FFFC00',
			docs: 'https://developers.snap.com/api/marketing-api/Public-Profile-API/GetStarted',
			docsLabel: 'Snap docs',
		},
		{
			id: 'reddit',
			title: 'Reddit',
			desc: 'OAuth connect to post to Reddit (requires a User Agent).',
			color: '#FF4500',
			bg: 'rgba(255,69,0,0.10)',
			status: redditStatusDerived,
			snippet: redditEnvSnippet,
			onConnect: connectReddit,
			btnLabel: 'Connect Reddit',
			btnColor: '#FF4500',
			docs: 'https://github.com/reddit-archive/reddit/wiki/OAuth2',
			docsLabel: 'Reddit OAuth docs',
		},
		{
			id: 'youtube',
			title: 'YouTube',
			desc: 'Connect your YouTube channel to enable uploads and scheduling.',
			color: '#FF0000',
			bg: 'rgba(255,0,0,0.10)',
			status: youtubeStatusDerived,
			snippet: youtubeEnvSnippet,
			onConnect: connectYouTube,
			btnLabel: 'Connect YouTube',
			btnColor: '#FF0000',
			docs: 'https://developers.google.com/youtube/v3/guides/authentication',
			docsLabel: 'YouTube OAuth docs',
		},
	]);
</script>

<div class="page">
	<!-- Page header -->
	<div class="page-head">
		<div class="page-icon">
			<Settings size={20} />
		</div>
		<div>
			<h1 class="page-title">Settings</h1>
			<p class="page-sub">Manage your profile, integrations, and billing</p>
		</div>
	</div>

	<!-- Tab navigation -->
	<div class="tab-nav">
		{#each tabs as t}
			{@const Icon = t.icon}
			<button
				type="button"
				class="tab-btn {activeTab === t.id ? 'tab-btn--on' : ''}"
				onclick={() => activeTab = t.id as typeof activeTab}
			>
				<Icon size={14} />
				{t.label}
			</button>
		{/each}
	</div>

	<!-- ── PROFILE TAB ─────────────────────────────────────────── -->
	{#if activeTab === 'profile'}
		<div class="tab-content">
			<div class="settings-card">
				<h2 class="card-title">Your Account</h2>

				<div class="profile-row">
					<div class="profile-avatar">
						{(userName || userEmail || 'U')[0].toUpperCase()}
					</div>
					<div class="profile-info">
						<p class="profile-name">{userName || 'Unnamed User'}</p>
						<p class="profile-email">{userEmail}</p>
					</div>
					<div class="profile-plan-badge">Pro</div>
				</div>

				<div class="form-grid">
					<div class="form-field">
						<label class="form-label">Display Name</label>
						<input class="form-input" type="text" value={userName} placeholder="Your name" readonly />
					</div>
					<div class="form-field">
						<label class="form-label">Email Address</label>
						<input class="form-input" type="email" value={userEmail} placeholder="you@example.com" readonly />
					</div>
					<div class="form-field">
						<label class="form-label">User ID</label>
						<div class="input-copy-wrap">
							<input class="form-input" type="text" value={userId} readonly />
							<button type="button" class="copy-btn" onclick={() => copyText(userId, 'userid')}>
								{#if copied === 'userid'}<Check size={13}/>{:else}<Copy size={13}/>{/if}
							</button>
						</div>
					</div>
				</div>

				<div class="card-note">
					Profile info is managed through Supabase Auth. Contact support to update your email.
				</div>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Preferences</h2>
				<div class="pref-list">
					<div class="pref-row">
						<div>
							<p class="pref-label">Default export format</p>
							<p class="pref-sub">PNG 1080×1350 (Instagram-optimized)</p>
						</div>
						<div class="pref-value">PNG · 1080px</div>
					</div>
					<div class="pref-row">
						<div>
							<p class="pref-label">AI model</p>
							<p class="pref-sub">Used for hook generation and content analysis</p>
						</div>
						<div class="pref-value">Claude 3.5 Sonnet</div>
					</div>
					<div class="pref-row">
						<div>
							<p class="pref-label">Default timezone</p>
							<p class="pref-sub">Used for scheduling posts</p>
						</div>
						<div class="pref-value">UTC · System</div>
					</div>
				</div>
			</div>

			<div class="settings-card settings-card--danger">
				<h2 class="card-title card-title--danger">Danger Zone</h2>
				<p class="card-desc">Permanently delete your account and all data. This cannot be undone.</p>
				<button type="button" class="btn-danger">Delete Account</button>
			</div>
		</div>

	<!-- ── INTEGRATIONS TAB ────────────────────────────────────── -->
	{:else if activeTab === 'integrations'}
		<div class="tab-content">
			<p class="tab-desc">Connect your social accounts to enable publishing and scheduling from Carousel Studio.</p>

			{#if loading}
				<div class="loading-row">
					<div class="spinner"></div>
					<span>Checking platform credentials…</span>
				</div>
			{:else}
				<div class="integrations-list">
					{#each integrations as intg}
						{@const st = intg.status}
						<div class="intg-card" style="--color: {intg.color}; --bg: {intg.bg}">
							<div class="intg-header">
								<div class="intg-icon-wrap" style="background:{intg.bg}; color:{intg.color}">
									<Globe size={18} />
								</div>
								<div class="intg-info">
									<h3 class="intg-title">{intg.title}</h3>
									<p class="intg-desc">{intg.desc}</p>
								</div>
								<div class="intg-status-badge {st?.ok ? 'status-ok' : 'status-fail'}">
									{#if st?.ok}
										<CheckCircle2 size={12} />
										Configured
									{:else}
										<AlertTriangle size={12} />
										Not set up
									{/if}
								</div>
							</div>

							{#if !st?.ok && st?.missing?.length}
								<div class="intg-env-block">
									<div class="env-block-head">
										<KeyRound size={12} />
										<span>Add these to your .env file</span>
									</div>
									<div class="env-code-wrap">
										<pre class="env-code">{intg.snippet}</pre>
										<button type="button" class="env-copy" onclick={() => copyText(intg.snippet, intg.id)}>
											{#if copied === intg.id}<Check size={12}/>{:else}<Copy size={12}/>{/if}
										</button>
									</div>
									<p class="env-hint">Restart the dev server after adding — this page updates automatically.</p>
								</div>
							{/if}

							<div class="intg-actions">
								{#if intg.id === 'linkedin'}
									<div style="display:flex;gap:0.5rem;flex-wrap:wrap">
										<button
											type="button"
											class="btn-connect"
											style="--c:{intg.btnColor}"
											disabled={!st?.ok}
											onclick={() => connectLinkedIn('member')}
										>
											Connect profile
										</button>
										<button
											type="button"
											class="btn-connect-outline"
											disabled={!st?.ok}
											onclick={() => connectLinkedIn('org')}
										>
											Connect pages
										</button>
										<button
											type="button"
											class="btn-connect-outline"
											disabled={!st?.ok}
											onclick={() => connectLinkedIn('both')}
										>
											Connect both
										</button>
									</div>
								{:else if intg.id === 'zernio'}
									<div style="display:flex;gap:0.5rem;flex-wrap:wrap">
										<button
											type="button"
											class="btn-connect"
											style="--c:{intg.btnColor}"
											disabled={!st?.ok}
											onclick={() => connectZernio('instagram')}
										>
											Instagram
										</button>
										<button
											type="button"
											class="btn-connect-outline"
											disabled={!st?.ok}
											onclick={() => connectZernio('facebook')}
										>
											Facebook
										</button>
										<button
											type="button"
											class="btn-connect-outline"
											disabled={!st?.ok}
											onclick={() => connectZernio('tiktok')}
										>
											TikTok
										</button>
									</div>
								{:else}
									<button
										type="button"
										class="btn-connect"
										style="--c:{intg.btnColor}"
										disabled={!st?.ok}
										onclick={intg.onConnect}
									>
										{intg.btnLabel}
									</button>
								{/if}
								<a href={intg.docs} target="_blank" rel="noreferrer" class="btn-docs">
									{intg.docsLabel}
									<ExternalLink size={11} />
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="settings-card settings-card--info">
				<h2 class="card-title">Channel overview</h2>
				<p class="card-desc">Use <a href="/dashboard/analytics" class="inline-link">Analytics</a> to connect from channel tabs, or the Zernio card above.</p>
			</div>
		</div>

	<!-- ── BILLING TAB ─────────────────────────────────────────── -->
	{:else if activeTab === 'billing'}
		<div class="tab-content">
			<div class="settings-card">
				<h2 class="card-title">Current Plan</h2>

				<div class="plan-row">
					<div class="plan-info">
						<div class="plan-badge">Pro</div>
						<div>
							<p class="plan-name">Pro Plan</p>
							<p class="plan-price">$29 <span>/month</span></p>
						</div>
					</div>
					<div class="plan-features">
						{#each ['Unlimited carousels', '25 competitor tracks', 'Claude 3.5 Sonnet AI', 'News-to-Post (Vertex AI)', 'Full canvas + export', 'Style extraction'] as f}
							<div class="plan-feature">
								<CheckCircle2 size={13} class="feature-check" />
								{f}
							</div>
						{/each}
					</div>
				</div>

				<div class="billing-actions">
					<button type="button" class="btn-outline-sm">Manage subscription</button>
					<button type="button" class="btn-outline-sm">Download invoices</button>
				</div>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Upgrade to Agency</h2>
				<p class="card-desc">Get unlimited accounts, team workspace, white-label export, and API access.</p>
				<div class="upgrade-price">$99<span>/month</span></div>
				<button type="button" class="btn-upgrade">Upgrade to Agency</button>
			</div>
		</div>
	{/if}
</div>

{#if showBlueskyModal}
	<div class="modal-backdrop" role="presentation" onclick={() => showBlueskyModal = false}>
		<div class="modal" role="dialog" aria-modal="true" aria-label="Connect Bluesky" onclick={(e) => e.stopPropagation()}>
			<div class="modal-head">
				<h3 class="modal-title">Connect Bluesky</h3>
				<button type="button" class="modal-close" onclick={() => showBlueskyModal = false}>✕</button>
			</div>
			<p class="modal-sub">
				Use a Bluesky <span class="mono">App Password</span>. Your password is never stored — only session tokens.
			</p>

			<div class="modal-grid">
				<div class="form-field">
					<label class="form-label" for="bsky-handle">Handle</label>
					<input
						id="bsky-handle"
						class="form-input"
						type="text"
						placeholder="you.bsky.social"
						bind:value={bskyHandle}
					/>
				</div>
				<div class="form-field">
					<label class="form-label" for="bsky-pass">App Password</label>
					<input
						id="bsky-pass"
						class="form-input"
						type="password"
						placeholder="xxxx-xxxx-xxxx-xxxx"
						bind:value={bskyAppPassword}
					/>
				</div>
			</div>

			{#if bskyError}
				<div class="modal-error" role="alert">
					<AlertTriangle size={14} />
					<span>{bskyError}</span>
				</div>
			{/if}

			<div class="modal-actions">
				<button type="button" class="btn-connect-outline" onclick={() => showBlueskyModal = false} disabled={bskyConnecting}>
					Cancel
				</button>
				<button type="button" class="btn-connect" style="--c:#0085FF" onclick={connectBluesky} disabled={bskyConnecting}>
					{bskyConnecting ? 'Connecting…' : 'Connect'}
				</button>
			</div>
		</div>
	</div>
{/if}

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
		--panel-bg-2: rgba(255,255,255,0.05);
		--panel-border: rgba(255,255,255,0.06);
		--panel-border-hover: rgba(255,255,255,0.10);
		--t-strong: rgba(255,255,255,0.92);
		--t: rgba(255,255,255,0.55);
		--t-muted: rgba(255,255,255,0.38);
	}

	.page { color: var(--app-text); }
	.page { padding: 2rem 2.5rem; max-width: 860px; display: flex; flex-direction: column; gap: 1.5rem; }

	/* ── Header ────────────────────────────────────────────────── */
	.page-head { display: flex; align-items: center; gap: 1rem; }
	.page-icon {
		width: 44px; height: 44px; border-radius: 12px;
		background: var(--panel-bg-2); border: 1px solid var(--panel-border);
		display: flex; align-items: center; justify-content: center;
		color: var(--t); flex-shrink: 0;
	}
	.page-title { font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1.6rem; font-weight: 900; letter-spacing: -0.03em; color: var(--t-strong); margin: 0 0 0.2rem; }
	.page-sub   { font-size: 0.8125rem; color: var(--t-muted); margin: 0; }

	/* ── Tab nav ───────────────────────────────────────────────── */
	.tab-nav {
		display: flex; gap: 0.25rem; padding: 0.3rem;
		background: var(--panel-bg); border: 1px solid var(--panel-border);
		border-radius: 12px; width: fit-content;
	}
	.tab-btn {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.5rem 1rem; border-radius: 9px; border: none;
		background: transparent; color: var(--t-muted);
		font-family: 'Satoshi', sans-serif; font-size: 0.8125rem; font-weight: 500;
		cursor: pointer; transition: all 0.15s; white-space: nowrap;
	}
	.tab-btn:hover { color: var(--t-strong); background: var(--panel-bg-2); }
	.tab-btn--on   { color: var(--t-strong); background: var(--panel-bg-2); }

	/* ── Tab content ───────────────────────────────────────────── */
	.tab-content { display: flex; flex-direction: column; gap: 1rem; }
	.tab-desc { font-size: 0.8125rem; color: var(--t); margin: 0; line-height: 1.55; }

	/* ── Settings card ─────────────────────────────────────────── */
	.settings-card {
		border-radius: 16px;
		background: var(--panel-bg);
		border: 1px solid var(--panel-border);
		padding: 1.5rem;
		display: flex; flex-direction: column; gap: 1.1rem;
	}
	.settings-card--danger { border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.03); }
	.settings-card--info   { border-color: rgba(232,255,72,0.1); background: rgba(232,255,72,0.02); }

	.card-title { font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1rem; font-weight: 700; color: var(--t-strong); margin: 0; }
	.card-title--danger { color: #f87171; }
	.card-desc  { font-size: 0.8125rem; line-height: 1.55; color: var(--t); margin: 0; }
	.card-note  { font-size: 0.75rem; color: var(--t-muted); font-family: 'Satoshi', sans-serif; padding: 0.65rem 0.85rem; border-radius: 8px; background: var(--panel-bg); border: 1px solid var(--panel-border); }

	/* ── Profile ───────────────────────────────────────────────── */
	.profile-row { display: flex; align-items: center; gap: 1rem; }
	.profile-avatar {
		width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
		background: rgba(232,255,72,0.12); border: 2px solid rgba(232,255,72,0.25);
		display: flex; align-items: center; justify-content: center;
		font-family: 'Satoshi', sans-serif; font-size: 18px; font-weight: 700; color: #E8FF48;
	}
	.profile-info { flex: 1; }
	.profile-name  { font-size: 0.9375rem; font-weight: 600; color: var(--t-strong); margin: 0 0 0.2rem; }
	.profile-email { font-size: 0.8125rem; color: var(--t-muted); margin: 0; font-family: 'Satoshi', sans-serif; }
	.profile-plan-badge {
		padding: 3px 10px; border-radius: 6px;
		background: rgba(232,255,72,0.12); border: 1px solid rgba(232,255,72,0.2);
		font-size: 0.7rem; font-family: 'Satoshi', sans-serif; font-weight: 700; color: #E8FF48;
		text-transform: uppercase; letter-spacing: 0.07em;
	}

	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
	.form-field { display: flex; flex-direction: column; gap: 0.4rem; }
	.form-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--t-muted); font-family: 'Satoshi', sans-serif; }
	.form-input {
		padding: 0.55rem 0.85rem; border-radius: 9px;
		background: var(--panel-bg-2); border: 1px solid var(--panel-border);
		color: var(--t-strong); font-size: 0.8125rem;
		font-family: 'Satoshi', sans-serif; outline: none; width: 100%;
	}
	.input-copy-wrap { position: relative; }
	.input-copy-wrap .form-input { padding-right: 2.5rem; }
	.copy-btn {
		position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
		padding: 0.25rem; border: none; background: transparent;
		color: var(--t-muted); cursor: pointer; transition: color 0.15s; border-radius: 4px;
	}
	.copy-btn:hover { color: var(--t-strong); }

	.pref-list { display: flex; flex-direction: column; gap: 0; }
	.pref-row {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0.85rem 0; border-bottom: 1px solid var(--panel-border); gap: 1rem;
	}
	.pref-row:last-child { border-bottom: none; }
	.pref-label { font-size: 0.875rem; color: var(--t-strong); font-weight: 500; margin: 0 0 0.2rem; }
	.pref-sub   { font-size: 0.75rem; color: var(--t-muted); margin: 0; }
	.pref-value { font-size: 0.75rem; font-family: 'Satoshi', sans-serif; color: var(--t); white-space: nowrap; }

	.btn-danger {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.55rem 1rem; border-radius: 9px; border: 1px solid rgba(239,68,68,0.3);
		background: rgba(239,68,68,0.08); color: #f87171;
		font-size: 0.8125rem; font-weight: 600; cursor: pointer; font-family: 'Satoshi', sans-serif;
		transition: all 0.15s;
	}
	.btn-danger:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.5); }

	/* ── Integrations ──────────────────────────────────────────── */
	.loading-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.8125rem; color: var(--t-muted); }
	.spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); border-top-color: #E8FF48; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.integrations-list { display: flex; flex-direction: column; gap: 1rem; }

	.intg-card {
		border-radius: 16px;
		background: rgba(255,255,255,0.02);
		border: 1px solid rgba(255,255,255,0.07);
		padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;
		transition: border-color 0.2s;
	}
	.intg-card:hover { border-color: rgba(255,255,255,0.1); }

	.intg-header { display: flex; align-items: flex-start; gap: 1rem; }
	.intg-icon-wrap {
		width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0;
		display: flex; align-items: center; justify-content: center;
	}
	.intg-info { flex: 1; min-width: 0; }
	.intg-title { font-size: 0.9375rem; font-weight: 600; color: rgba(255,255,255,0.88); margin: 0 0 0.25rem; }
	.intg-desc  { font-size: 0.78rem; color: rgba(255,255,255,0.38); margin: 0; line-height: 1.5; }

	.intg-status-badge {
		display: inline-flex; align-items: center; gap: 0.3rem;
		padding: 4px 10px; border-radius: 6px;
		font-size: 0.65rem; font-family: 'Satoshi', sans-serif; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.06em;
		white-space: nowrap; flex-shrink: 0;
	}
	.status-ok   { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
	.status-fail { background: rgba(245,158,11,0.1);  color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }

	.intg-env-block {
		border-radius: 10px; background: rgba(0,0,0,0.2);
		border: 1px solid rgba(255,255,255,0.06); padding: 0.85rem;
	}
	.env-block-head {
		display: flex; align-items: center; gap: 0.4rem;
		font-size: 0.65rem; font-family: 'Satoshi', sans-serif;
		text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.3);
		margin-bottom: 0.6rem;
	}
	.env-code-wrap { position: relative; }
	.env-code {
		font-family: 'Satoshi', sans-serif; font-size: 0.7rem;
		color: rgba(255,255,255,0.5); line-height: 1.7;
		background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.07);
		border-radius: 8px; padding: 0.75rem 2.5rem 0.75rem 0.85rem;
		overflow-x: auto; margin: 0;
	}
	.env-copy {
		position: absolute; top: 0.5rem; right: 0.5rem;
		padding: 0.25rem; border: none; background: rgba(255,255,255,0.07);
		color: rgba(255,255,255,0.4); cursor: pointer; border-radius: 5px; transition: all 0.15s;
	}
	.env-copy:hover { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); }
	.env-hint { font-size: 0.7rem; color: rgba(255,255,255,0.28); margin: 0.5rem 0 0; font-family: 'Satoshi', sans-serif; }

	.intg-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

	.btn-connect {
		padding: 0.55rem 1.1rem; border-radius: 9px; border: none;
		font-size: 0.8125rem; font-weight: 600; font-family: 'Satoshi', sans-serif;
		cursor: pointer; background: var(--c, #E8FF48); color: white;
		transition: opacity 0.12s, transform 0.12s;
	}
	.btn-connect:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.92; }
	.btn-connect:disabled { opacity: 0.3; cursor: not-allowed; }

	.btn-connect-outline {
		padding: 0.55rem 1rem; border-radius: 9px;
		font-size: 0.8125rem; font-weight: 600; font-family: 'Satoshi', sans-serif;
		cursor: pointer; background: rgba(255,255,255,0.06);
		color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1);
		transition: background 0.12s;
	}
	.btn-connect-outline:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
	.btn-connect-outline:disabled { opacity: 0.3; cursor: not-allowed; }

	/* ── Modal ─────────────────────────────────────────────────── */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.62);
		backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 60;
	}
	.modal {
		width: 100%;
		max-width: 520px;
		border-radius: 16px;
		background: rgba(20,20,20,0.92);
		border: 1px solid rgba(255,255,255,0.10);
		box-shadow: 0 30px 80px rgba(0,0,0,0.55);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
	.modal-title {
		margin: 0;
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-weight: 800;
		font-size: 1.05rem;
		letter-spacing: -0.02em;
		color: #fff;
	}
	.modal-close {
		border: 1px solid rgba(255,255,255,0.10);
		background: rgba(255,255,255,0.04);
		color: rgba(255,255,255,0.7);
		border-radius: 10px;
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.modal-close:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }
	.modal-sub { margin: 0; font-size: 0.8125rem; line-height: 1.5; color: rgba(255,255,255,0.45); }
	.mono { font-family: 'Satoshi', sans-serif; }
	.modal-grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
	@media (min-width: 640px) { .modal-grid { grid-template-columns: 1fr 1fr; } }
	.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem; }
	.modal-error {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0.8rem;
		border-radius: 12px;
		border: 1px solid rgba(248,113,113,0.22);
		background: rgba(248,113,113,0.08);
		color: rgba(255,255,255,0.85);
		font-size: 0.8125rem;
	}

	.btn-docs {
		display: inline-flex; align-items: center; gap: 0.3rem;
		font-size: 0.75rem; color: rgba(255,255,255,0.3); text-decoration: none;
		transition: color 0.15s;
	}
	.btn-docs:hover { color: rgba(255,255,255,0.7); }

	.inline-link { color: #E8FF48; text-decoration: none; }
	.inline-link:hover { text-decoration: underline; }

	.btn-secondary-sm {
		display: inline-flex; align-items: center; gap: 0.3rem;
		padding: 0.45rem 0.85rem; border-radius: 8px;
		background: rgba(232,255,72,0.08); border: 1px solid rgba(232,255,72,0.18);
		color: #E8FF48; font-size: 0.78rem; font-weight: 600; text-decoration: none;
		transition: all 0.15s;
	}
	.btn-secondary-sm:hover { background: rgba(232,255,72,0.12); }

	/* ── Billing ───────────────────────────────────────────────── */
	.plan-row {
		display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: flex-start;
	}
	.plan-info { display: flex; align-items: center; gap: 1rem; }
	.plan-badge {
		width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
		background: rgba(232,255,72,0.12); border: 1px solid rgba(232,255,72,0.25);
		display: flex; align-items: center; justify-content: center;
		font-family: 'Satoshi', sans-serif; font-size: 11px; font-weight: 700;
		color: #E8FF48; text-transform: uppercase; letter-spacing: 0.08em;
	}
	.plan-name  { font-weight: 600; color: rgba(255,255,255,0.88); margin: 0 0 0.2rem; font-size: 0.9375rem; }
	.plan-price { font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1.5rem; font-weight: 900; color: #fff; margin: 0; }
	.plan-price span { font-size: 0.875rem; color: rgba(255,255,255,0.4); font-family: 'Satoshi', sans-serif; }

	.plan-features { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
	.plan-feature  { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: rgba(255,255,255,0.6); }
	:global(.feature-check) { color: #34d399; flex-shrink: 0; }

	.billing-actions { display: flex; gap: 0.65rem; }
	.btn-outline-sm {
		padding: 0.5rem 1rem; border-radius: 9px;
		border: 1px solid rgba(255,255,255,0.1);
		background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.65);
		font-size: 0.8125rem; font-weight: 500; cursor: pointer;
		font-family: 'Satoshi', sans-serif; transition: all 0.15s;
	}
	.btn-outline-sm:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }

	.upgrade-price {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 2rem; font-weight: 900;
		color: #fff; letter-spacing: -0.03em;
	}
	.upgrade-price span { font-size: 1rem; color: rgba(255,255,255,0.4); font-family: 'Satoshi', sans-serif; font-weight: 400; }
	.btn-upgrade {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.65rem 1.25rem; border-radius: 10px; border: none;
		background: #E8FF48; color: #0a0a0a;
		font-size: 0.875rem; font-weight: 600; cursor: pointer;
		font-family: 'Satoshi', sans-serif; transition: all 0.15s; width: fit-content;
	}
	.btn-upgrade:hover { background: #f0ff70; transform: translateY(-1px); }
</style>
