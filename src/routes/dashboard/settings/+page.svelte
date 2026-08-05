<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { goto, invalidateAll } from '$app/navigation';
	import { PLAN_CATALOG } from '$lib/pricing-catalog';
	import {
		AlertTriangle, CheckCircle2, ExternalLink, KeyRound,
		User, Link2, CreditCard, Settings, Shield, LogOut,
		Globe, Copy, Check, ChevronRight, Mail, Lock,
	} from 'lucide-svelte';

	let { data } = $props();

	type Status = { ok: boolean; missing: string[]; present: string[] };
	let zernioStatus   = $state<Status | null>(null);
	let linkedinStatus = $state<Status | null>(null);
	let gmbStatus      = $state<Status | null>(null);
	let blueskyStatus  = $state<Status | null>(null);
	let snapchatStatus = $state<Status | null>(null);
	let redditStatus   = $state<Status | null>(null);
	let youtubeStatus  = $state<Status | null>(null);
	let loading        = $state(true);
	let copied         = $state<string | null>(null);

	let showBlueskyModal = $state(false);
	let bskyHandle = $state('');
	let bskyAppPassword = $state('');
	let bskyConnecting = $state(false);
	let bskyError = $state<string | null>(null);

	type SettingsTab = 'account' | 'billing' | 'integrations' | 'legal';
	let activeTab = $state<SettingsTab>('account');

	type BillingInfo = {
		plan: 'free' | 'pro' | 'agency';
		planName: string;
		credits: number;
		planStatus: string;
		hasCustomer: boolean;
		hasSubscription: boolean;
		currentPeriodEnd: string | null;
		features: string[];
		monthlyPrice: number;
		yearlyPrice: number;
	};

	const billing = $derived(data.billing as BillingInfo | null);
	const trial = $derived(data.trial);
	const signedIn = $derived(!!data.user);
	const userId = $derived(data.user?.id ?? '');
	const userEmail = $derived(data.user?.email ?? '');
	const userName = $derived(
		(data.user?.user_metadata?.full_name as string | undefined) ?? '',
	);

	let billingBusy = $state(false);
	let billingError = $state<string | null>(null);

	// Sign-in form (shown when signed out)
	let loginEmail = $state('');
	let loginPassword = $state('');
	let loginLoading = $state(false);
	let loginError = $state('');
	let resetSent = $state(false);
	let resetBusy = $state(false);

	const tabs = [
		{ id: 'account' as const,      label: 'Account',      icon: User },
		{ id: 'billing' as const,      label: 'Billing',       icon: CreditCard },
		{ id: 'integrations' as const, label: 'Integrations', icon: Link2 },
		{ id: 'legal' as const,        label: 'Legal',         icon: Shield },
	];

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const tab = params.get('tab');
		if (tab === 'account' || tab === 'billing' || tab === 'integrations' || tab === 'legal') {
			activeTab = tab;
		}
	});

	async function loadIntegrations() {
		loading = true;
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
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!signedIn) return;
		void loadIntegrations();
	});

	async function signIn() {
		loginLoading = true;
		loginError = '';
		const { error } = await supabase.auth.signInWithPassword({
			email: loginEmail.trim(),
			password: loginPassword,
		});
		if (error) {
			loginError = error.message;
			loginLoading = false;
			return;
		}
		await invalidateAll();
		loginLoading = false;
	}

	async function signInWithGoogle() {
		await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent('/dashboard/settings')}`,
			},
		});
	}

	async function sendPasswordReset() {
		const email = loginEmail.trim() || userEmail;
		if (!email) {
			loginError = 'Enter your email above to receive a reset link.';
			return;
		}
		resetBusy = true;
		loginError = '';
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${location.origin}/auth/callback?next=/dashboard/settings`,
		});
		resetBusy = false;
		if (error) {
			loginError = error.message;
			return;
		}
		resetSent = true;
	}

	async function signOut() {
		await supabase.auth.signOut();
		await invalidateAll();
		activeTab = 'account';
	}

	function planStatusLabel(status: string) {
		switch (status) {
			case 'active': return 'Active';
			case 'trialing': return 'Trial';
			case 'past_due': return 'Past due';
			case 'canceled': return 'Canceled';
			default: return 'Free';
		}
	}

	function planStatusClass(status: string) {
		switch (status) {
			case 'active':
			case 'trialing':
				return 'status-pill--ok';
			case 'past_due':
				return 'status-pill--warn';
			case 'canceled':
				return 'status-pill--muted';
			default:
				return 'status-pill--muted';
		}
	}

	async function openPortal() {
		billingBusy = true;
		billingError = null;
		try {
			const res = await fetch('/api/stripe/portal', {
				method: 'POST',
				credentials: 'include',
			});
			const json = await res.json();
			if (!res.ok || !json?.ok || !json?.url) {
				billingError = json?.error ?? 'Could not open billing portal';
				billingBusy = false;
				return;
			}
			window.location.href = json.url;
		} catch {
			billingError = 'Network error';
			billingBusy = false;
		}
	}

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
			<p class="page-sub">Account, billing, integrations, and legal</p>
		</div>
	</div>

	{#if !signedIn}
		<div class="settings-card login-card">
			<h2 class="card-title">Sign in to your account</h2>
			<p class="card-desc">
				Manage your plan, connected accounts, and privacy preferences. Billing is handled securely through Stripe.
			</p>

			<button type="button" class="btn-google" onclick={signInWithGoogle}>
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
				</svg>
				Continue with Google
			</button>

			<div class="login-divider"><span>or</span></div>

			{#if loginError}
				<p class="billing-error" role="alert">{loginError}</p>
			{/if}
			{#if resetSent}
				<p class="login-success" role="status">Password reset link sent — check your inbox.</p>
			{/if}

			<form class="login-form" onsubmit={(e) => { e.preventDefault(); signIn(); }}>
				<div class="form-field">
					<label class="form-label" for="login-email">Email</label>
					<input id="login-email" class="form-input" type="email" bind:value={loginEmail} required autocomplete="email" />
				</div>
				<div class="form-field">
					<label class="form-label" for="login-password">Password</label>
					<input id="login-password" class="form-input" type="password" bind:value={loginPassword} required autocomplete="current-password" />
				</div>
				<button type="submit" class="btn-upgrade" disabled={loginLoading}>
					{loginLoading ? 'Signing in…' : 'Sign in'}
				</button>
			</form>

			<div class="login-footer">
				<a href="/?auth=signup&next=/dashboard/settings" class="inline-link">Create account</a>
				<button type="button" class="link-btn" disabled={resetBusy} onclick={sendPasswordReset}>
					{resetBusy ? 'Sending…' : 'Forgot password?'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Tab navigation -->
	<div class="tab-nav">
		{#each tabs as t}
			{@const Icon = t.icon}
			<button
				type="button"
				class="tab-btn {activeTab === t.id ? 'tab-btn--on' : ''}"
				disabled={!signedIn && t.id !== 'legal'}
				onclick={() => activeTab = t.id}
			>
				<Icon size={14} />
				{t.label}
			</button>
		{/each}
	</div>

	<!-- ── ACCOUNT TAB ─────────────────────────────────────────── -->
	{#if activeTab === 'account'}
		{#if !signedIn}
			<p class="tab-desc">Sign in above to view your account details.</p>
		{:else}
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
					<div class="profile-plan-badge">{billing?.planName ?? 'Free'}</div>
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
					Profile email is managed through your sign-in provider. Contact
					<a href="mailto:support@carouselstudio.app" class="inline-link">support@carouselstudio.app</a>
					to change your email.
				</div>

				<div class="account-actions">
					<button type="button" class="btn-outline-sm" disabled={resetBusy} onclick={sendPasswordReset}>
						<Mail size={13} />
						{resetBusy ? 'Sending…' : 'Send password reset'}
					</button>
					<button type="button" class="btn-outline-sm" onclick={signOut}>
						<LogOut size={13} />
						Sign out
					</button>
				</div>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Session</h2>
				<div class="pref-list">
					<div class="pref-row">
						<div>
							<p class="pref-label">Current plan</p>
							<p class="pref-sub">Synced from Stripe after checkout</p>
						</div>
						<div class="pref-value">{billing?.planName ?? 'Free'}</div>
					</div>
					{#if trial && !trial.isPaid}
						<div class="pref-row">
							<div>
								<p class="pref-label">Free exports used</p>
								<p class="pref-sub">Upgrade for unlimited exports</p>
							</div>
							<div class="pref-value">{trial.used} / {trial.limit}</div>
						</div>
					{/if}
				</div>
				<a href="/dashboard/settings?tab=billing" class="inline-link" onclick={(e) => { e.preventDefault(); activeTab = 'billing'; }}>
					View billing & plans →
				</a>
			</div>

			<div class="settings-card settings-card--danger">
				<h2 class="card-title card-title--danger">Danger Zone</h2>
				<p class="card-desc">
					Permanently delete your account and all data. Email
					<a href="mailto:support@carouselstudio.app" class="inline-link">support@carouselstudio.app</a>
					with your account email to request deletion.
				</p>
			</div>
		</div>
		{/if}

	<!-- ── INTEGRATIONS TAB ────────────────────────────────────── -->
	{:else if activeTab === 'integrations'}
		{#if !signedIn}
			<p class="tab-desc">Sign in to connect social accounts.</p>
		{:else}
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
				<p class="card-desc">Connected accounts publish and schedule from Carousel Studio. OAuth tokens are stored securely server-side.</p>
			</div>
		</div>
		{/if}

	<!-- ── BILLING TAB ─────────────────────────────────────────── -->
	{:else if activeTab === 'billing'}
		{#if !signedIn}
			<p class="tab-desc">Sign in to view your plan and manage billing.</p>
		{:else}
		<div class="tab-content">
			<div class="settings-card">
				<h2 class="card-title">Current Plan</h2>

				{#if billing}
					<div class="plan-row">
						<div class="plan-info">
							<div class="plan-badge">{billing.planName.slice(0, 3)}</div>
							<div>
								<p class="plan-name">{billing.planName} Plan</p>
								<p class="plan-price">
									{#if billing.monthlyPrice === 0}
										$0 <span>/month</span>
									{:else}
										${billing.monthlyPrice} <span>/month</span>
									{/if}
								</p>
								<div class="plan-meta">
									<span class="status-pill {planStatusClass(billing.planStatus)}">
										{planStatusLabel(billing.planStatus)}
									</span>
									{#if billing.currentPeriodEnd && billing.plan !== 'free'}
										<span class="plan-renew">
											Renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}
										</span>
									{/if}
								</div>
							</div>
						</div>
						<div class="plan-features">
							{#each billing.features as f}
								<div class="plan-feature">
									<CheckCircle2 size={13} class="feature-check" />
									{f}
								</div>
							{/each}
						</div>
					</div>

					{#if trial && !trial.isPaid}
						<div class="trial-banner">
							<p class="trial-title">Free trial exports</p>
							<p class="trial-sub">
								{trial.used} of {trial.limit} free export{trial.limit === 1 ? '' : 's'} used.
								{#if trial.remaining === 0}
									Upgrade to Pro or Agency for unlimited exports.
								{:else}
									{trial.remaining} remaining on the Free plan.
								{/if}
							</p>
						</div>
					{/if}
				{:else}
					<p class="card-desc">Could not load billing details. Try refreshing the page.</p>
				{/if}

				{#if billingError}
					<p class="billing-error" role="alert">{billingError}</p>
				{/if}

				<div class="billing-actions">
					{#if billing?.hasCustomer}
						<button type="button" class="btn-outline-sm" disabled={billingBusy} onclick={openPortal}>
							{billingBusy ? 'Opening…' : 'Manage subscription'}
						</button>
						<button type="button" class="btn-outline-sm" disabled={billingBusy} onclick={openPortal}>
							Invoices & payment method
						</button>
					{:else}
						<a href="/pricing" class="btn-outline-sm" style="text-decoration:none;display:inline-flex;align-items:center;">
							View all plans
						</a>
					{/if}
				</div>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Compare plans</h2>
				<p class="card-desc">Plans match our <a href="/pricing" class="inline-link">pricing page</a>. Checkout is secured by Stripe.</p>
				<div class="plan-compare-grid">
					{#each (['free', 'pro', 'agency'] as const) as planId}
						{@const p = PLAN_CATALOG[planId]}
						<div class="plan-compare-card" class:plan-compare-card--current={billing?.plan === planId}>
							<div class="plan-compare-head">
								<p class="plan-compare-name">{p.name}</p>
								{#if billing?.plan === planId}
									<span class="status-pill status-pill--ok">Current</span>
								{/if}
							</div>
							<p class="plan-compare-price">
								{#if planId === 'free'}
									$0<span>/mo</span>
								{:else}
									${p.monthly}<span>/mo</span>
									<span class="plan-compare-year">or ${p.yearly}/yr</span>
								{/if}
							</p>
							<ul class="plan-compare-features">
								{#each p.features.slice(0, 4) as f}
									<li>{f}</li>
								{/each}
							</ul>
							{#if planId !== 'free' && billing?.plan !== planId}
								<a href="/checkout?plan={planId}" class="btn-upgrade plan-compare-cta">
									{planId === 'agency' ? 'Upgrade to Agency' : 'Upgrade to Pro'}
								</a>
							{:else if planId === 'free' && billing?.plan !== 'free'}
								<p class="plan-compare-note">Downgrade via Stripe portal</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			{#if billing?.plan !== 'agency'}
				<div class="settings-card">
					<h2 class="card-title">
						{billing?.plan === 'pro' ? 'Upgrade to Agency' : 'Upgrade to Pro'}
					</h2>
					<p class="card-desc">
						{#if billing?.plan === 'pro'}
							Unlimited accounts, team workspace, white-label export, and API access — ${PLAN_CATALOG.agency.monthly}/mo.
						{:else}
							Unlimited carousels, Claude AI, News-to-Post, and full export — ${PLAN_CATALOG.pro.monthly}/mo.
						{/if}
					</p>
					<a
						href={`/checkout?plan=${billing?.plan === 'pro' ? 'agency' : 'pro'}`}
						class="btn-upgrade"
						style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;"
					>
						{billing?.plan === 'pro' ? 'Upgrade to Agency' : 'Upgrade to Pro'}
					</a>
				</div>
			{/if}

			<div class="settings-card settings-card--info">
				<h2 class="card-title">Billing compliance</h2>
				<p class="card-desc">
					Payments are processed by Stripe. We store your plan and subscription status — not full card numbers.
					See our <a href="/refund-policy" class="inline-link">Refund Policy</a> for cancellations and refunds.
				</p>
			</div>
		</div>
		{/if}

	<!-- ── LEGAL TAB ───────────────────────────────────────────── -->
	{:else if activeTab === 'legal'}
		<div class="tab-content">
			<div class="settings-card">
				<h2 class="card-title">Legal & privacy</h2>
				<p class="card-desc">
					Carousel Studio is operated in compliance with standard SaaS privacy and billing practices.
					Review the documents below for how we handle your data and subscriptions.
				</p>
				<div class="legal-links">
					<a href="/terms" class="legal-link">
						<Shield size={16} />
						<span>
							<strong>Terms of Service</strong>
							<small>Acceptable use, subscriptions, and trials</small>
						</span>
						<ChevronRight size={16} />
					</a>
					<a href="/privacy" class="legal-link">
						<Lock size={16} />
						<span>
							<strong>Privacy Policy</strong>
							<small>What we collect and how we use it</small>
						</span>
						<ChevronRight size={16} />
					</a>
					<a href="/refund-policy" class="legal-link">
						<CreditCard size={16} />
						<span>
							<strong>Refund Policy</strong>
							<small>Cancellations, renewals, and refunds</small>
						</span>
						<ChevronRight size={16} />
					</a>
				</div>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Your data rights</h2>
				<p class="card-desc">
					You may access, correct, or delete your personal data. To export your content or request account
					deletion, email
					<a href="mailto:support@carouselstudio.app" class="inline-link">support@carouselstudio.app</a>
					from the address on your account.
				</p>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Contact</h2>
				<p class="card-desc">
					Billing questions, privacy requests, or compliance inquiries:
					<a href="mailto:support@carouselstudio.app" class="inline-link">support@carouselstudio.app</a>
				</p>
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
	.page { padding: 2rem 2.5rem; max-width: 920px; display: flex; flex-direction: column; gap: 1.5rem; }

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
	.plan-status {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		color: rgba(255,255,255,0.45);
		text-transform: capitalize;
	}
	.billing-error {
		margin: 0 0 0.75rem;
		padding: 0.65rem 0.85rem;
		border-radius: 9px;
		background: rgba(255,80,60,0.12);
		border: 1px solid rgba(255,80,60,0.28);
		color: #ffb4a8;
		font-size: 0.8125rem;
	}

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

	/* ── Login gate ────────────────────────────────────────────── */
	.login-card { max-width: 420px; }
	.btn-google {
		display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem;
		width: 100%; padding: 0.7rem 1rem; border-radius: 10px;
		border: 1px solid var(--panel-border); background: var(--panel-bg-2);
		color: var(--t-strong); font-size: 0.875rem; font-weight: 600;
		font-family: 'Satoshi', sans-serif; cursor: pointer; transition: background 0.15s;
	}
	.btn-google:hover { background: var(--panel-bg); }
	.login-divider {
		display: flex; align-items: center; gap: 0.75rem;
		font-size: 0.75rem; color: var(--t-muted); text-transform: uppercase; letter-spacing: 0.08em;
	}
	.login-divider::before, .login-divider::after {
		content: ''; flex: 1; height: 1px; background: var(--panel-border);
	}
	.login-form { display: flex; flex-direction: column; gap: 0.75rem; }
	.login-footer {
		display: flex; align-items: center; justify-content: space-between; gap: 1rem;
		font-size: 0.8125rem;
	}
	.link-btn {
		border: none; background: transparent; color: var(--t-muted);
		font-family: 'Satoshi', sans-serif; font-size: 0.8125rem; cursor: pointer;
		text-decoration: underline; padding: 0;
	}
	.link-btn:hover { color: var(--t-strong); }
	.login-success {
		margin: 0; padding: 0.65rem 0.85rem; border-radius: 9px;
		background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2);
		color: #34d399; font-size: 0.8125rem;
	}
	.account-actions { display: flex; flex-wrap: wrap; gap: 0.65rem; }

	/* ── Status pills ──────────────────────────────────────────── */
	.status-pill {
		display: inline-flex; align-items: center;
		padding: 0.2rem 0.55rem; border-radius: 999px;
		font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
	}
	.status-pill--ok { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
	.status-pill--warn { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
	.status-pill--muted { background: var(--panel-bg-2); color: var(--t-muted); border: 1px solid var(--panel-border); }
	.plan-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.35rem; }
	.plan-renew { font-size: 0.75rem; color: var(--t-muted); }

	.trial-banner {
		padding: 0.85rem 1rem; border-radius: 10px;
		background: rgba(232,255,72,0.06); border: 1px solid rgba(232,255,72,0.15);
	}
	.trial-title { margin: 0 0 0.25rem; font-size: 0.8125rem; font-weight: 600; color: var(--t-strong); }
	.trial-sub { margin: 0; font-size: 0.75rem; color: var(--t-muted); line-height: 1.5; }

	.plan-compare-grid {
		display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem;
	}
	@media (max-width: 720px) { .plan-compare-grid { grid-template-columns: 1fr; } }
	.plan-compare-card {
		border-radius: 12px; padding: 1rem;
		background: var(--panel-bg-2); border: 1px solid var(--panel-border);
		display: flex; flex-direction: column; gap: 0.65rem;
	}
	.plan-compare-card--current { border-color: rgba(232,255,72,0.35); box-shadow: 0 0 0 1px rgba(232,255,72,0.12); }
	.plan-compare-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
	.plan-compare-name { margin: 0; font-weight: 700; color: var(--t-strong); font-size: 0.9375rem; }
	.plan-compare-price {
		margin: 0; font-family: var(--font-display), var(--font-sans), system-ui, sans-serif;
		font-size: 1.5rem; font-weight: 900; color: var(--t-strong);
	}
	.plan-compare-price span { font-size: 0.8rem; color: var(--t-muted); font-weight: 500; }
	.plan-compare-year { display: block; font-size: 0.7rem; color: var(--t-muted); margin-top: 0.15rem; font-weight: 500; }
	.plan-compare-features {
		margin: 0; padding-left: 1rem; font-size: 0.75rem; color: var(--t-muted); line-height: 1.55;
	}
	.plan-compare-cta { width: 100%; justify-content: center; text-decoration: none; }
	.plan-compare-note { margin: 0; font-size: 0.7rem; color: var(--t-muted); }

	.legal-links { display: flex; flex-direction: column; gap: 0.5rem; }
	.legal-link {
		display: flex; align-items: center; gap: 0.75rem;
		padding: 0.85rem 1rem; border-radius: 10px;
		border: 1px solid var(--panel-border); background: var(--panel-bg-2);
		color: var(--t-strong); text-decoration: none; transition: background 0.15s;
	}
	.legal-link:hover { background: var(--panel-bg); }
	.legal-link span { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; }
	.legal-link strong { font-size: 0.875rem; font-weight: 600; }
	.legal-link small { font-size: 0.75rem; color: var(--t-muted); font-weight: 400; }

	.tab-btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
