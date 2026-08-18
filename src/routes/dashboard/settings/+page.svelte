<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { goto, invalidateAll } from '$app/navigation';
	import { passwordResetRedirectTo } from '$lib/auth-modal';
	import { PLAN_CATALOG } from '$lib/pricing-catalog';
	import { CLIP_FINDER_ENABLED } from '$lib/launch-flags';
	import {
		DEFAULT_BRAND_KIT,
		brandProfile,
		loadBrandKit,
		hydrateBrandKit,
		normalizeBrandHandle,
		normalizeHighlightHex,
		normalizeHighlightStyleKind,
		saveBrandKit,
	} from '$lib/studio/brand-kit';
	import { AVAILABLE_PATTERNS, HIGHLIGHT_SOLID_PRESETS, HIGHLIGHT_GRADIENT_PRESETS, getPatternImage } from '$lib/highlight';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import {
		AlertTriangle, CheckCircle2, ExternalLink, KeyRound,
		User, CreditCard, Shield, LogOut, Palette,
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
	let loading        = $state(false);
	let copied         = $state<string | null>(null);

	let showBlueskyModal = $state(false);
	let bskyHandle = $state('');
	let bskyAppPassword = $state('');
	let bskyConnecting = $state(false);
	let bskyError = $state<string | null>(null);

	type SettingsTab = 'account' | 'branding' | 'billing' | 'integrations' | 'legal';
	let activeTab = $state<SettingsTab>('account');

	type BillingInfo = {
		plan: 'free' | 'hobby' | 'creator' | 'business';
		planName: string;
		credits: number;
		planStatus: string;
		hasCustomer: boolean;
		hasSubscription: boolean;
		currentPeriodEnd: string | null;
		features: string[];
		monthlyPrice: number;
		yearlyPrice: number;
		carouselsPerMonth: number | null;
	};

	type UsageInfo = {
		canGenerate: boolean;
		isPaid: boolean;
		used: number;
		limit: number | null;
		remaining: number | null;
		plan: string;
		periodStart: string;
		aiImagesUsed: number;
		aiImagesLimit: number | null;
		aiImagesRemaining: number | null;
		canGenerateAiImage: boolean;
	};

	const billing = $derived(data.billing as BillingInfo | null);
	const usage = $derived(data.usage as UsageInfo | null);
	const signedIn = $derived(!!data.user);
	const userId = $derived(data.user?.id ?? '');
	const userEmail = $derived(data.user?.email ?? '');
	const userName = $derived(
		(data.profile?.fullName as string | undefined)?.trim() ||
			(data.user?.user_metadata?.full_name as string | undefined) ||
			'',
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
	let accountMsg = $state('');
	let accountErr = $state('');

	let displayNameDraft = $state('');
	let profileBusy = $state(false);

	let marketingEmails = $state(false);
	let marketingBusy = $state(false);

	let newPassword = $state('');
	let confirmPassword = $state('');
	let passwordBusy = $state(false);
	let passwordRecoveryMode = $state(false);

	let deleteConfirm = $state('');
	let deleteBusy = $state(false);
	let deleteErr = $state('');
	let showDeleteConfirm = $state(false);

	let brandDisplayName = $state(DEFAULT_BRAND_KIT.displayName);
	let brandHandle = $state(DEFAULT_BRAND_KIT.handle);
	let brandProfileNote = $state('');
	let textHighlightsEnabled = $state(DEFAULT_BRAND_KIT.textHighlightsEnabled);
	let highlightColor = $state(DEFAULT_BRAND_KIT.highlightColor);
	let highlightStyleKind = $state(DEFAULT_BRAND_KIT.highlightStyleKind);
	let highlightPattern = $state(DEFAULT_BRAND_KIT.highlightPattern);
	let highlightNote = $state('');
	const highlightPatternUrl = $derived(getPatternImage(highlightPattern) ?? '');

	function persistBrandProfile() {
		if (!userId) return;
		const kit = loadBrandKit(userId);
		const next = {
			...kit,
			displayName: brandDisplayName.trim(),
			handle: normalizeBrandHandle(brandHandle),
			textHighlightsEnabled,
			highlightColor,
			highlightStyleKind,
			highlightPattern,
			onboardingComplete: true,
		};
		brandDisplayName = next.displayName;
		brandHandle = next.handle;
		const ok = saveBrandKit(userId, next);
		brandProfileNote = ok ? 'Saved - Studio templates will use this name and handle' : 'Could not save';
		setTimeout(() => (brandProfileNote = ''), 2400);
	}

	function persistHighlightsEnabled(on: boolean) {
		textHighlightsEnabled = on;
		if (!userId) return;
		const kit = loadBrandKit(userId);
		const ok = saveBrandKit(userId, { ...kit, textHighlightsEnabled: on });
		highlightNote = ok
			? on
				? 'Saved - word highlights on in Studio and Bulk'
				: 'Saved - word highlights off in Studio and Bulk'
			: 'Could not save';
		setTimeout(() => (highlightNote = ''), 2400);
	}

	function persistHighlightColor(nextRaw: string) {
		const next = normalizeHighlightHex(nextRaw, highlightColor);
		highlightColor = next;
		highlightStyleKind = 'solid';
		textHighlightsEnabled = true;
		if (!userId) return;
		const kit = loadBrandKit(userId);
		const ok = saveBrandKit(userId, {
			...kit,
			highlightColor: next,
			highlightStyleKind: 'solid',
			textHighlightsEnabled: true,
		});
		highlightNote = ok ? 'Saved - Studio uses this for new highlights' : 'Could not save';
		setTimeout(() => (highlightNote = ''), 2400);
	}

	function persistHighlightPattern(name: string) {
		const next = String(name ?? '').trim().toLowerCase().replace(/\s+/g, '-');
		if (!AVAILABLE_PATTERNS.some((p) => p.name === next)) return;
		highlightPattern = next;
		highlightStyleKind = 'pattern';
		textHighlightsEnabled = true;
		if (!userId) return;
		const kit = loadBrandKit(userId);
		const ok = saveBrandKit(userId, {
			...kit,
			highlightPattern: next,
			highlightStyleKind: 'pattern',
			textHighlightsEnabled: true,
		});
		highlightNote = ok ? 'Saved - Studio uses this pattern for new highlights' : 'Could not save';
		setTimeout(() => (highlightNote = ''), 2400);
	}

	function persistHighlightGradient(from: string, to: string) {
		const a = normalizeHighlightHex(from, highlightColor);
		const b = normalizeHighlightHex(to, DEFAULT_BRAND_KIT.highlightGradientTo);
		highlightColor = a;
		highlightStyleKind = 'gradient';
		textHighlightsEnabled = true;
		if (!userId) return;
		const kit = loadBrandKit(userId);
		const ok = saveBrandKit(userId, {
			...kit,
			highlightColor: a,
			highlightStyleKind: 'gradient',
			highlightGradientFrom: a,
			highlightGradientTo: b,
			textHighlightsEnabled: true,
		});
		highlightNote = ok
			? `Saved - Studio uses ${from} → ${to} for new highlights`
			: 'Could not save';
		setTimeout(() => (highlightNote = ''), 2400);
	}

	const tabs = [
		{ id: 'account' as const, label: 'Account', icon: User },
		{ id: 'branding' as const, label: 'Branding', icon: Palette },
		{ id: 'billing' as const, label: 'Billing', icon: CreditCard },
		// Integrations hidden for now — restore tab + `loadIntegrations` when shipping connect.
		// { id: 'integrations' as const, label: 'Integrations', icon: Link2 },
		{ id: 'legal' as const, label: 'Legal', icon: Shield },
	];

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const tab = params.get('tab');
		if (tab === 'account' || tab === 'branding' || tab === 'billing' || tab === 'legal') {
			activeTab = tab;
		}
		if (params.get('pw') === '1' || params.get('reset') === '1') {
			passwordRecoveryMode = true;
			activeTab = 'account';
		}

		displayNameDraft = userName;
		marketingEmails = data.profile?.marketingEmails === true;

		const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
			if (event === 'PASSWORD_RECOVERY') {
				passwordRecoveryMode = true;
				activeTab = 'account';
			}
		});
		return () => authSub.subscription.unsubscribe();
	});

	$effect(() => {
		displayNameDraft = userName;
		marketingEmails = data.profile?.marketingEmails === true;
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
		if (!signedIn || !userId) return;
		let cancelled = false;
		void (async () => {
			const kit = await hydrateBrandKit(userId);
			if (cancelled) return;
			const p = brandProfile(kit);
			brandDisplayName = p.name;
			brandHandle = p.handle;
			textHighlightsEnabled = kit.textHighlightsEnabled !== false;
			highlightColor = kit.highlightColor || DEFAULT_BRAND_KIT.highlightColor;
			highlightStyleKind = normalizeHighlightStyleKind(kit.highlightStyleKind);
			highlightPattern = kit.highlightPattern || DEFAULT_BRAND_KIT.highlightPattern;
		})();
		return () => {
			cancelled = true;
		};
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
		const email = (signedIn ? userEmail : loginEmail).trim();
		if (!email) {
			if (signedIn) accountErr = 'No email on this account.';
			else loginError = 'Enter your email above to receive a reset link.';
			return;
		}
		resetBusy = true;
		loginError = '';
		accountErr = '';
		accountMsg = '';
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: passwordResetRedirectTo(location.origin),
		});
		resetBusy = false;
		if (error) {
			if (signedIn) accountErr = error.message;
			else loginError = error.message;
			return;
		}
		resetSent = true;
		if (signedIn) accountMsg = 'Password reset link sent — check your inbox.';
	}

	async function saveNewPassword() {
		accountErr = '';
		accountMsg = '';
		const next = newPassword.trim();
		if (next.length < 8) {
			accountErr = 'Password must be at least 8 characters.';
			return;
		}
		if (next !== confirmPassword) {
			accountErr = 'Passwords do not match.';
			return;
		}
		passwordBusy = true;
		const { error } = await supabase.auth.updateUser({ password: next });
		passwordBusy = false;
		if (error) {
			accountErr = error.message;
			return;
		}
		newPassword = '';
		confirmPassword = '';
		passwordRecoveryMode = false;
		accountMsg = 'Password updated.';
		const url = new URL(location.href);
		url.searchParams.delete('pw');
		url.searchParams.delete('reset');
		history.replaceState({}, '', url.pathname + url.search + url.hash);
	}

	async function saveDisplayName() {
		if (!userId) return;
		profileBusy = true;
		accountErr = '';
		accountMsg = '';
		const name = displayNameDraft.trim();
		const { error: authErr } = await supabase.auth.updateUser({
			data: { full_name: name },
		});
		if (authErr) {
			profileBusy = false;
			accountErr = authErr.message;
			return;
		}
		const { error: dbErr } = await supabase
			.from('users')
			.update({ full_name: name || null, updated_at: new Date().toISOString() })
			.eq('id', userId);
		profileBusy = false;
		if (dbErr) {
			accountErr = dbErr.message;
			return;
		}
		accountMsg = 'Display name saved.';
		await invalidateAll();
	}

	async function saveMarketingEmails(on: boolean) {
		if (!userId) return;
		marketingEmails = on;
		marketingBusy = true;
		accountErr = '';
		const { error: dbErr } = await supabase
			.from('users')
			.update({ marketing_emails: on, updated_at: new Date().toISOString() })
			.eq('id', userId);
		if (!dbErr) {
			await supabase.auth.updateUser({
				data: { marketing_emails: on },
			});
		}
		marketingBusy = false;
		if (dbErr) {
			marketingEmails = !on;
			accountErr = dbErr.message;
			return;
		}
		accountMsg = on ? 'Marketing emails enabled.' : 'Marketing emails disabled.';
		await invalidateAll();
	}

	async function deleteAccount() {
		deleteErr = '';
		deleteBusy = true;
		try {
			const res = await fetch('/api/account/delete', {
				method: 'POST',
				credentials: 'include',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ confirm: deleteConfirm.trim() }),
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out?.ok) {
				deleteErr = out?.error ?? 'Could not delete account';
				deleteBusy = false;
				return;
			}
			await supabase.auth.signOut();
			await invalidateAll();
			goto('/?auth=login&deleted=1');
		} catch {
			deleteErr = 'Network error';
			deleteBusy = false;
		}
	}

	async function signOut() {
		await supabase.auth.signOut();
		await invalidateAll();
		activeTab = 'account';
	}

	function planStatusLabel(status: string) {
		switch (status) {
			case 'active': return 'Paid';
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

	const planSummary = $derived.by(() => {
		const name = billing?.planName ?? 'Free';
		const status = billing?.planStatus ?? 'inactive';
		const statusLabel = planStatusLabel(status);
		if (billing?.plan && billing.plan !== 'free') {
			return `${name} · ${statusLabel}`;
		}
		return status === 'inactive' || status === 'canceled' ? 'Free' : `${name} · ${statusLabel}`;
	});

	async function openPortal(flow: 'manage' | 'cancel' = 'manage') {
		billingBusy = true;
		billingError = null;
		try {
			const res = await fetch('/api/stripe/portal', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(flow === 'cancel' ? { flow: 'cancel' } : {}),
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
			desc: 'Post updates to your Google Business locations directly from Meme Accounts.',
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

<div class="page dash-page">
	<header class="page-head">
		<div class="eyebrow">
			<span class="eyebrow-dot"></span>
			<span>Account</span>
		</div>
		<h1 class="page-title dash-page-title">Settings</h1>
	</header>

	{#if !signedIn}
		<div class="settings-card login-card">
			<h2 class="card-title">Sign in to your account</h2>
			<p class="card-desc">
				Manage your plan, connected accounts, and privacy preferences. Billing is handled securely through Stripe.
			</p>

			<Button type="button" variant="outline" class="h-11 w-full justify-center gap-2.5" onclick={signInWithGoogle}>
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
				</svg>
				Continue with Google
			</Button>

			<div class="login-divider"><span>or</span></div>

			{#if loginError}
				<p class="billing-error" role="alert">{loginError}</p>
			{/if}
			{#if resetSent}
				<p class="login-success" role="status">Password reset link sent - check your inbox.</p>
			{/if}

			<form class="login-form" onsubmit={(e) => { e.preventDefault(); signIn(); }}>
				<div class="form-field">
					<label class="form-label" for="login-email">Email</label>
					<Input id="login-email" type="email" bind:value={loginEmail} required autocomplete="email" />
				</div>
				<div class="form-field">
					<label class="form-label" for="login-password">Password</label>
					<Input id="login-password" type="password" bind:value={loginPassword} required autocomplete="current-password" />
				</div>
				<Button type="submit" class="w-fit" disabled={loginLoading}>
					{loginLoading ? 'Signing in…' : 'Sign in'}
				</Button>
			</form>

			<div class="login-footer">
				<a href="/?auth=signup&next=/dashboard/settings" class="inline-link">Create account</a>
				<button type="button" class="link-btn" disabled={resetBusy} onclick={sendPasswordReset}>
					{resetBusy ? 'Sending…' : 'Forgot password?'}
				</button>
			</div>
		</div>
	{/if}

	<Tabs.Root bind:value={activeTab} class="gap-6">
		<div class="max-w-full overflow-x-auto pb-1">
			<Tabs.List class="min-w-max">
			{#each tabs as t (t.id)}
				{@const Icon = t.icon}
				<Tabs.Trigger value={t.id} disabled={!signedIn && t.id !== 'legal'}>
					<Icon data-icon="inline-start" />
					{t.label}
				</Tabs.Trigger>
			{/each}
			</Tabs.List>
		</div>
	</Tabs.Root>

	<!-- ── ACCOUNT TAB ─────────────────────────────────────────── -->
	{#if activeTab === 'account'}
		{#if !signedIn}
			<p class="tab-desc">Sign in above to view your account details.</p>
		{:else}
		<div class="tab-content">
			{#if accountMsg}
				<p class="login-success" role="status">{accountMsg}</p>
			{/if}
			{#if accountErr}
				<p class="billing-error" role="alert">{accountErr}</p>
			{/if}

			<div class="settings-card">
				<h2 class="card-title">Your Account</h2>

				<div class="profile-row">
					<div class="profile-avatar">
						{(displayNameDraft || userName || userEmail || 'U')[0].toUpperCase()}
					</div>
					<div class="profile-info">
						<p class="profile-name">{displayNameDraft || userName || 'Unnamed User'}</p>
						<p class="profile-email">{userEmail}</p>
					</div>
					<div class="profile-plan-badge">{planSummary}</div>
				</div>

				<div class="form-grid">
					<div class="form-field">
						<Label class="form-label" for="acct-name">Display name</Label>
						<Input id="acct-name" type="text" bind:value={displayNameDraft} placeholder="Your name" autocomplete="name" />
					</div>
					<div class="form-field">
						<Label class="form-label" for="acct-email">Email</Label>
						<Input id="acct-email" type="email" value={userEmail} placeholder="you@example.com" readonly />
					</div>
					<div class="form-field form-field--wide">
						<Label class="form-label" for="acct-id">User ID</Label>
						<div class="input-copy-wrap">
							<Input id="acct-id" type="text" value={userId} readonly class="pr-10" />
							<button type="button" class="copy-btn" onclick={() => copyText(userId, 'userid')}>
								{#if copied === 'userid'}<Check size={13}/>{:else}<Copy size={13}/>{/if}
							</button>
						</div>
					</div>
				</div>

				<div class="account-actions">
					<Button type="button" size="sm" disabled={profileBusy} onclick={saveDisplayName}>
						{profileBusy ? 'Saving…' : 'Save name'}
					</Button>
					<Button type="button" variant="outline" size="sm" onclick={signOut}>
						<LogOut />
						Sign out
					</Button>
				</div>

				<div class="card-note">
					Email is managed by your sign-in provider. Contact
					<a href="mailto:support@memeaccounts.com" class="inline-link">support@memeaccounts.com</a>
					to change it.
				</div>
			</div>

			<div class="settings-card">
				<h2 class="card-title">{passwordRecoveryMode ? 'Set a new password' : 'Password'}</h2>
				{#if passwordRecoveryMode}
					<p class="card-desc">Choose a new password for {userEmail || 'your account'}.</p>
				{:else}
					<p class="card-desc">Update your password here, or email yourself a reset link.</p>
				{/if}
				<div class="form-grid">
					<div class="form-field">
						<Label class="form-label" for="new-password">New password</Label>
						<Input
							id="new-password"
							type="password"
							bind:value={newPassword}
							placeholder="At least 8 characters"
							autocomplete="new-password"
						/>
					</div>
					<div class="form-field">
						<Label class="form-label" for="confirm-password">Confirm password</Label>
						<Input
							id="confirm-password"
							type="password"
							bind:value={confirmPassword}
							placeholder="Repeat password"
							autocomplete="new-password"
						/>
					</div>
				</div>
				<div class="account-actions">
					<Button type="button" size="sm" disabled={passwordBusy} onclick={saveNewPassword}>
						{passwordBusy ? 'Saving…' : passwordRecoveryMode ? 'Save new password' : 'Update password'}
					</Button>
					{#if !passwordRecoveryMode}
						<Button type="button" variant="outline" size="sm" disabled={resetBusy} onclick={sendPasswordReset}>
							<Mail />
							{resetBusy ? 'Sending…' : resetSent ? 'Reset link sent' : 'Email reset link'}
						</Button>
					{/if}
				</div>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Email preferences</h2>
				<div class="pref-list">
					<div class="pref-row">
						<div>
							<p class="pref-label">Marketing emails</p>
							<p class="pref-sub">Product updates and tips — not required for your account</p>
						</div>
						<Switch
							id="settings-marketing"
							size="sm"
							checked={marketingEmails}
							disabled={marketingBusy}
							onCheckedChange={(v) => void saveMarketingEmails(!!v)}
						/>
					</div>
					<div class="pref-row">
						<div>
							<p class="pref-label">Current plan</p>
							<p class="pref-sub">Synced from Stripe after checkout</p>
						</div>
						<div class="pref-value pref-value--plan">
							<span>{planSummary}</span>
							{#if billing}
								<span class="status-pill {planStatusClass(billing.planStatus)}">
									{planStatusLabel(billing.planStatus)}
								</span>
							{/if}
						</div>
					</div>
					{#if usage && !usage.isPaid}
						<div class="pref-row">
							<div>
								<p class="pref-label">Carousels this month</p>
								<p class="pref-sub">Free plan allowance</p>
							</div>
							<div class="pref-value">{usage.used} / {usage.limit ?? 5}</div>
						</div>
						<div class="pref-row">
							<div>
								<p class="pref-label">AI images this month</p>
								<p class="pref-sub">Stock only on Free</p>
							</div>
							<div class="pref-value">0 / 0</div>
						</div>
					{:else if usage?.isPaid && usage.limit !== null}
						<div class="pref-row">
							<div>
								<p class="pref-label">Carousels this month</p>
								<p class="pref-sub">{billing?.planName ?? 'Paid'} plan allowance</p>
							</div>
							<div class="pref-value">{usage.used} / {usage.limit}</div>
						</div>
						<div class="pref-row">
							<div>
								<p class="pref-label">AI images this month</p>
								<p class="pref-sub">{billing?.planName ?? 'Paid'} plan allowance</p>
							</div>
							<div class="pref-value">
								{#if usage.aiImagesLimit != null}
									{usage.aiImagesUsed} / {usage.aiImagesLimit}
								{:else}
									{usage.aiImagesUsed} used
								{/if}
							</div>
						</div>
					{:else if usage?.isPaid && usage.limit === null}
						<div class="pref-row">
							<div>
								<p class="pref-label">Carousels this month</p>
								<p class="pref-sub">Unlimited on {billing?.planName ?? 'Business'}</p>
							</div>
							<div class="pref-value">{usage.used} used</div>
						</div>
						<div class="pref-row">
							<div>
								<p class="pref-label">AI images this month</p>
								<p class="pref-sub">{billing?.planName ?? 'Business'} plan allowance</p>
							</div>
							<div class="pref-value">
								{#if usage.aiImagesLimit != null}
									{usage.aiImagesUsed} / {usage.aiImagesLimit}
								{:else}
									{usage.aiImagesUsed} used
								{/if}
							</div>
						</div>
					{/if}
				</div>
				<a href="/dashboard/settings?tab=billing" class="inline-link" onclick={(e) => { e.preventDefault(); activeTab = 'billing'; }}>
					View billing & plans →
				</a>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Danger Zone</h2>
				<p class="card-desc">
					Permanently delete your account, drafts, uploaded media, and connected data. We purge
					files stored for your account and cancel active Stripe subscriptions when possible. This cannot be undone.
				</p>
				{#if !showDeleteConfirm}
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="danger-delete-btn self-start w-auto"
						onclick={() => { showDeleteConfirm = true; deleteErr = ''; }}
					>
						<AlertTriangle />
						Delete account
					</Button>
				{:else}
					<div class="form-field">
						<Label class="form-label" for="delete-confirm">Type {userEmail} to confirm</Label>
						<Input
							id="delete-confirm"
							type="email"
							bind:value={deleteConfirm}
							placeholder={userEmail}
							autocomplete="off"
						/>
					</div>
					{#if deleteErr}
						<p class="billing-error" role="alert">{deleteErr}</p>
					{/if}
					<div class="account-actions">
						<Button
							type="button"
							size="sm"
							variant="destructive"
							class="self-start w-auto"
							disabled={deleteBusy}
							onclick={deleteAccount}
						>
							{deleteBusy ? 'Deleting…' : 'Permanently delete'}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="self-start w-auto"
							disabled={deleteBusy}
							onclick={() => { showDeleteConfirm = false; deleteConfirm = ''; deleteErr = ''; }}
						>
							Cancel
						</Button>
					</div>
				{/if}
			</div>
		</div>
		{/if}

	<!-- ── BRANDING TAB ────────────────────────────────────────── -->
	{:else if activeTab === 'branding'}
		{#if !signedIn}
			<p class="tab-desc">Sign in above to edit slide identity and highlight color.</p>
		{:else}
		<div class="tab-content">
			<div class="settings-card">
				<h2 class="card-title">Identity</h2>
				<p class="card-desc">Shown on Text Carousel and Creator templates. Add a logo in Studio Branding for News.</p>
				<div class="form-grid">
					<div class="form-field">
						<Label class="form-label" for="brand-display-name">Username</Label>
						<Input
							id="brand-display-name"
							type="text"
							bind:value={brandDisplayName}
							placeholder="MEME ACCOUNTS"
							onchange={() => persistBrandProfile()}
						/>
					</div>
					<div class="form-field">
						<Label class="form-label" for="brand-handle">Handle</Label>
						<Input
							id="brand-handle"
							type="text"
							bind:value={brandHandle}
							placeholder="@memeaccounts"
							onchange={() => persistBrandProfile()}
						/>
					</div>
				</div>
				{#if brandProfileNote}
					<div class="card-note">{brandProfileNote}</div>
				{/if}
			</div>

			<div class="settings-card">
				<div class="hl-card-head">
					<div>
						<h2 class="card-title">Highlight</h2>
						<p class="card-desc">Accent color for <span class="mono">[[word]]</span> spans in Studio and Bulk.</p>
					</div>
					<label class="hl-toggle" class:hl-toggle-on={textHighlightsEnabled}>
						<span class="hl-toggle-state" aria-hidden="true">{textHighlightsEnabled ? 'On' : 'Off'}</span>
						<Switch
							id="settings-word-highlights"
							size="sm"
							checked={textHighlightsEnabled}
							onCheckedChange={(v) => persistHighlightsEnabled(!!v)}
							class="shrink-0"
						/>
					</label>
				</div>
				{#if textHighlightsEnabled}
					<div class="hl-preview" style="--hl:{highlightColor}">
						<span class="hl-preview-kicker">Preview</span>
						<p class="hl-preview-line">
							SOFTBANK JUST PUT
							{#if highlightStyleKind === 'pattern' && highlightPatternUrl}
								<em
									class="hl-preview-pattern"
									style="background-image: url('{highlightPatternUrl}');"
								>$40B</em>
							{:else}
								<em>$40B</em>
							{/if}
							INTO OPENAI
						</p>
					</div>
					<div class="hl-palette">
						<div class="hl-group">
							<span class="hl-group-label">Solid</span>
							<div class="hl-swatches" role="listbox" aria-label="Highlight color">
								{#each HIGHLIGHT_SOLID_PRESETS as c (c)}
									<button
										type="button"
										role="option"
										aria-selected={highlightStyleKind === 'solid' && highlightColor.toUpperCase() === c.toUpperCase()}
										class="hl-swatch"
										class:hl-swatch--on={highlightStyleKind === 'solid' && highlightColor.toUpperCase() === c.toUpperCase()}
										style="background: {c};"
										title={c}
										onclick={() => persistHighlightColor(c)}
									></button>
								{/each}
								<label class="hl-custom" title="Custom color">
									<span class="sr-only">Custom highlight color</span>
									<input
										type="color"
										value={highlightColor}
										oninput={(e) => persistHighlightColor((e.currentTarget as HTMLInputElement).value)}
									/>
								</label>
							</div>
						</div>
						<div class="hl-group">
							<span class="hl-group-label">Gradient</span>
							<div class="hl-swatches" role="listbox" aria-label="Highlight gradient">
								{#each HIGHLIGHT_GRADIENT_PRESETS as [from, to] (`${from}-${to}`)}
									<button
										type="button"
										role="option"
										aria-selected={highlightStyleKind === 'gradient' && highlightColor.toUpperCase() === from.toUpperCase()}
										class="hl-swatch hl-swatch--grad"
										class:hl-swatch--on={highlightStyleKind === 'gradient' && highlightColor.toUpperCase() === from.toUpperCase()}
										style="background: linear-gradient(135deg, {from}, {to});"
										title="{from} → {to}"
										onclick={() => persistHighlightGradient(from, to)}
									></button>
								{/each}
							</div>
						</div>
						<div class="hl-group">
							<span class="hl-group-label">Texture</span>
							<div class="hl-swatches" role="listbox" aria-label="Highlight pattern">
								{#each AVAILABLE_PATTERNS as pat (pat.name)}
									<button
										type="button"
										role="option"
										aria-selected={highlightStyleKind === 'pattern' && highlightPattern === pat.name}
										class="hl-swatch hl-swatch--pattern"
										class:hl-swatch--on={highlightStyleKind === 'pattern' && highlightPattern === pat.name}
										style="background-image: url('{pat.url}'); background-size: cover; background-position: center;"
										title={pat.label}
										onclick={() => persistHighlightPattern(pat.name)}
									></button>
								{/each}
							</div>
						</div>
					</div>
				{/if}
				{#if highlightNote}
					<div class="card-note">{highlightNote}</div>
				{/if}
			</div>
		</div>
		{/if}

	<!-- ── INTEGRATIONS TAB ────────────────────────────────────── -->
	{:else if activeTab === 'integrations'}
		{#if !signedIn}
			<p class="tab-desc">Sign in to connect social accounts.</p>
		{:else}
		<div class="tab-content">
			<p class="tab-desc">Connect your social accounts to enable publishing and scheduling from Meme Accounts.</p>

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
									<p class="env-hint">Restart the dev server after adding - this page updates automatically.</p>
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
				<p class="card-desc">Connected accounts publish and schedule from Meme Accounts. OAuth tokens are stored securely server-side.</p>
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
									{#if billing.planStatus === 'trialing'}
										<span class="plan-renew">Stripe trial — converts to paid at period end</span>
									{:else if billing.currentPeriodEnd && billing.plan !== 'free' && billing.planStatus === 'active'}
										<span class="plan-renew">
											Renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}
										</span>
									{:else if billing.currentPeriodEnd && billing.planStatus === 'canceled'}
										<span class="plan-renew">
											Access until {new Date(billing.currentPeriodEnd).toLocaleDateString()}
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

					{#if usage && !usage.isPaid}
						<div class="trial-banner">
							<p class="trial-title">Usage this month</p>
							<p class="trial-sub">
								Carousels: {usage.used} of {usage.limit ?? 5}
								{#if (usage.remaining ?? 0) === 0}
									— limit reached. Upgrade for more.
								{:else}
									· {usage.remaining} remaining.
								{/if}
							</p>
							<p class="trial-sub" style="margin-top:0.35rem">
								AI images: not included on Free (stock photos only). Hobby includes 50/mo.
							</p>
							{#if CLIP_FINDER_ENABLED}
								<p class="trial-sub" style="margin-top:0.35rem">
									Clip minutes: {usage.clipMinutesUsed ?? 0} of {usage.clipMinutesLimit ?? 60}
									· max video {usage.maxClipVideoMinutes ?? 20} min
								</p>
							{/if}
						</div>
					{:else if usage?.isPaid && usage.limit !== null}
						<div class="trial-banner">
							<p class="trial-title">Usage this month</p>
							<p class="trial-sub">
								Carousels: {usage.used} of {usage.limit} · {usage.remaining} remaining
								{#if billing.planStatus === 'trialing'}
									· on trial
								{/if}
							</p>
							<p class="trial-sub" style="margin-top:0.35rem">
								{#if usage.aiImagesLimit === 0}
									AI images: not included on this plan.
								{:else if usage.aiImagesLimit != null}
									AI images: {usage.aiImagesUsed} of {usage.aiImagesLimit} · {usage.aiImagesRemaining} remaining
								{:else}
									AI images: {usage.aiImagesUsed} used · unlimited
								{/if}
							</p>
							{#if CLIP_FINDER_ENABLED}
								<p class="trial-sub" style="margin-top:0.35rem">
									{#if usage.clipMinutesLimit != null}
										Clip minutes: {usage.clipMinutesUsed} of {usage.clipMinutesLimit} · {usage.clipMinutesRemaining} remaining
										· max video {usage.maxClipVideoMinutes} min
									{:else}
										Clip minutes: {usage.clipMinutesUsed} used · unlimited
										· max video {usage.maxClipVideoMinutes} min
									{/if}
								</p>
							{/if}
						</div>
					{:else if usage?.isPaid && usage.limit === null}
						<div class="trial-banner">
							<p class="trial-title">Usage this month</p>
							<p class="trial-sub">
								Carousels: {usage.used} generated · unlimited on {billing.planName}
								{#if billing.planStatus === 'trialing'}
									(trial)
								{/if}
							</p>
							<p class="trial-sub" style="margin-top:0.35rem">
								{#if usage.aiImagesLimit != null}
									AI images: {usage.aiImagesUsed} of {usage.aiImagesLimit} · {usage.aiImagesRemaining} remaining
								{:else}
									AI images: {usage.aiImagesUsed} used · unlimited
								{/if}
							</p>
							{#if CLIP_FINDER_ENABLED}
								<p class="trial-sub" style="margin-top:0.35rem">
									{#if usage.clipMinutesLimit != null}
										Clip minutes: {usage.clipMinutesUsed} of {usage.clipMinutesLimit} · {usage.clipMinutesRemaining} remaining
										· max video {usage.maxClipVideoMinutes} min
									{:else}
										Clip minutes: {usage.clipMinutesUsed} used · unlimited
										· max video {usage.maxClipVideoMinutes} min
									{/if}
								</p>
							{/if}
						</div>
					{/if}
				{:else}
					<p class="card-desc">
						{(data as { billingError?: string }).billingError
							? `Could not load billing: ${(data as { billingError?: string }).billingError}`
							: 'Could not load billing details. Try refreshing the page.'}
					</p>
				{/if}

				{#if billingError}
					<p class="billing-error" role="alert">{billingError}</p>
				{/if}

				<div class="billing-actions">
					{#if billing?.hasCustomer}
						<Button type="button" variant="outline" size="sm" disabled={billingBusy} onclick={() => openPortal('manage')}>
							{billingBusy ? 'Opening…' : 'Manage subscription'}
						</Button>
						<Button type="button" variant="outline" size="sm" disabled={billingBusy} onclick={() => openPortal('manage')}>
							Invoices & payment method
						</Button>
						{#if billing?.plan !== 'free' && billing?.hasSubscription}
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="border-red-300 text-red-700 hover:bg-red-50"
								disabled={billingBusy}
								onclick={() => openPortal('cancel')}
							>
								Cancel subscription
							</Button>
						{/if}
					{:else}
						<Button href="/pricing" variant="outline" size="sm">View all plans</Button>
					{/if}
				</div>
				{#if billing?.plan !== 'free'}
					<p class="card-desc billing-renew-note">
						Subscriptions auto-renew until canceled. Stripe emails receipts and renewal notices to your billing email.
						{#if billing?.currentPeriodEnd}
							Next renewal: <strong>{new Date(billing.currentPeriodEnd).toLocaleDateString()}</strong>.
						{/if}
						Cancel anytime above — same one-click path as upgrading.
					</p>
				{/if}
			</div>

			<div class="settings-card">
				<h2 class="card-title">Compare plans</h2>
				<p class="card-desc">Plans match our <a href="/pricing" class="inline-link">pricing page</a>. Checkout is secured by Stripe.</p>
				<div class="plan-compare-grid">
					{#each (['free', 'hobby', 'creator', 'business'] as const) as planId}
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
								<Button href="/checkout?plan={planId}" class="plan-compare-cta w-full">
									Upgrade to {p.name}
								</Button>
							{:else if planId === 'free' && billing?.plan !== 'free'}
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="plan-compare-cta w-full"
									disabled={billingBusy}
									onclick={() => openPortal('cancel')}
								>
									Cancel / downgrade
								</Button>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			{#if billing?.plan !== 'business'}
				<div class="settings-card">
					<h2 class="card-title">
						{billing?.plan === 'creator' ? 'Upgrade to Business' : 'Upgrade to Creator'}
					</h2>
					<p class="card-desc">
						{#if billing?.plan === 'creator'}
							Unlimited carousels, team workspace, and API access — ${PLAN_CATALOG.business.monthly}/mo.
						{:else}
							{PLAN_CATALOG.creator.carouselsPerMonth} carousels/month, all caption styles, no watermark — ${PLAN_CATALOG.creator.monthly}/mo.
						{/if}
					</p>
					<Button href={`/checkout?plan=${billing?.plan === 'creator' ? 'business' : 'creator'}`}>
						{billing?.plan === 'creator' ? 'Upgrade to Business' : 'Upgrade to Creator'}
					</Button>
				</div>
			{/if}

			<div class="settings-card settings-card--info">
				<h2 class="card-title">Billing compliance</h2>
				<p class="card-desc">
					Payments are processed by Stripe. We store your plan and subscription status - not full card numbers.
					Plans auto-renew until you cancel; Stripe sends renewal receipts to your billing email.
					Cancel anytime from this page. See our <a href="/refund-policy" class="inline-link">Refund Policy</a>.
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
					Meme Accounts is operated in compliance with standard SaaS privacy and billing practices.
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
					You may access or correct your profile in Account settings. To permanently delete your account,
					uploads, and data, use <strong>Danger Zone</strong> on the Account tab, or email
					<a href="mailto:support@memeaccounts.com" class="inline-link">support@memeaccounts.com</a>
					from the address on your account. Residual backups may clear within 30 days.
				</p>
			</div>

			<div class="settings-card">
				<h2 class="card-title">Contact</h2>
				<p class="card-desc">
					Billing questions, privacy requests, or compliance inquiries:
					<a href="mailto:support@memeaccounts.com" class="inline-link">support@memeaccounts.com</a>
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
				Use a Bluesky <span class="mono">App Password</span>. Your password is never stored - only session tokens.
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
	.page {
		--ap-text: #0f0f10;
		--ap-text-2: #5b5b62;
		--ap-text-3: #9a9aa1;
		--ap-line: rgba(15, 15, 16, 0.08);
		--ap-line-2: rgba(15, 15, 16, 0.14);
		--ap-soft: #f6f7f9;
		--ap-soft-2: #eef1f5;
		--ap-bg: #ffffff;
		--ap-accent: #7bf1a8;
		--panel-bg: var(--ap-bg);
		--panel-bg-2: var(--ap-soft);
		--panel-border: var(--ap-line);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--t-muted: var(--ap-text-3);

		font-family: var(--font-body);
		display: flex;
		flex-direction: column;
		gap: 22px;
		letter-spacing: -0.01em;
		-webkit-font-smoothing: antialiased;
		color: var(--ap-text);
	}

	.page-head { display: flex; flex-direction: column; align-items: flex-start; gap: 0; }
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px 5px 10px;
		border-radius: 999px;
		background: var(--ap-soft);
		border: 1px solid var(--ap-line);
		color: var(--ap-text-2);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin-bottom: 16px;
	}
	.eyebrow-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ap-accent);
		box-shadow: 0 0 0 3px rgba(123, 241, 168, 0.22);
	}
	.page-title {
		margin: 0 0 8px;
		color: var(--ap-text);
	}
	.page-sub {
		color: var(--ap-text-2);
	}

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
		font-family: var(--font-display); font-size: 0.8125rem; font-weight: 500;
		cursor: pointer; transition: all 0.15s; white-space: nowrap;
	}
	.tab-btn:hover { color: var(--t-strong); background: var(--panel-bg-2); }
	.tab-btn--on   { color: var(--t-strong); background: var(--panel-bg-2); }

	/* ── Tab content ───────────────────────────────────────────── */
	.tab-content { display: flex; flex-direction: column; gap: 1rem; }
	.tab-desc { font-size: 0.8125rem; color: var(--t); margin: 0; line-height: 1.55; }

	/* ── Settings card ─────────────────────────────────────────── */
	.settings-card {
		border-radius: 22px;
		background: var(--ap-bg);
		border: 1px solid var(--ap-line);
		padding: 22px 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.settings-card--info {
		background: var(--ap-soft);
	}

	.card-title {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--ap-text);
		margin: 0;
	}
	.card-desc  { font-size: 13.5px; line-height: 1.55; color: var(--ap-text-2); margin: 0; max-width: 62ch; }
	.card-note  { font-size: 12.5px; color: var(--ap-text-2); padding: 10px 12px; border-radius: 12px; background: var(--ap-soft); border: 1px solid var(--ap-line); }

	/* Danger delete — hug content (settings-card is column flex + stretch). */
	:global(.danger-delete-btn) {
		align-self: flex-start !important;
		width: auto !important;
		color: #b42318;
		border-color: color-mix(in srgb, #b42318 28%, var(--ap-line));
	}
	:global(.danger-delete-btn:hover) {
		background: color-mix(in srgb, #b42318 6%, var(--ap-bg));
		color: #912018;
	}

	/* ── Profile ───────────────────────────────────────────────── */
	.profile-row { display: flex; align-items: center; gap: 1rem; }
	.profile-avatar {
		width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
		background: var(--ap-soft-2); border: 1px solid var(--ap-line);
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--ap-text);
	}
	.profile-info { flex: 1; }
	.profile-name  { font-size: 0.9375rem; font-weight: 600; color: var(--t-strong); margin: 0 0 0.2rem; }
	.profile-email { font-size: 0.8125rem; color: var(--t-muted); margin: 0; font-family: var(--font-display); }
	.profile-plan-badge {
		padding: 4px 10px; border-radius: 999px;
		background: var(--ap-soft); border: 1px solid var(--ap-line);
		font-size: 11px; font-weight: 700; color: var(--ap-text);
		text-transform: uppercase; letter-spacing: 0.06em;
	}

	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
	.form-field--wide { grid-column: 1 / -1; }
	@media (max-width: 640px) {
		.form-grid { grid-template-columns: 1fr; }
		.form-field--wide { grid-column: auto; }
		.settings-card { padding: 18px 16px; border-radius: 18px; }
	}
	.form-field { display: flex; flex-direction: column; gap: 6px; }
	.form-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ap-text-3);
	}

	.hl-card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}
	.hl-card-head .card-desc { margin-top: 6px; }
	.hl-toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
		padding: 5px 8px 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--ap-line);
		background: var(--ap-soft);
		cursor: pointer;
		user-select: none;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.hl-toggle-on {
		border-color: color-mix(in srgb, var(--ap-text) 16%, var(--ap-line));
		background: color-mix(in srgb, var(--ap-text) 5%, var(--ap-bg));
	}
	.hl-toggle-state {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ap-text-3);
	}
	.hl-toggle-on .hl-toggle-state { color: var(--ap-text); }

	.hl-preview {
		position: relative;
		border-radius: 14px;
		background:
			radial-gradient(120% 80% at 12% 0%, color-mix(in srgb, var(--hl) 18%, transparent), transparent 55%),
			#0e0f12;
		padding: 16px 18px 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		overflow: hidden;
	}
	.hl-preview-kicker {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.4);
	}
	.hl-preview-line {
		margin: 0;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
		letter-spacing: -0.025em;
		line-height: 1.3;
		color: rgba(255, 255, 255, 0.92);
		text-transform: uppercase;
	}
	.hl-preview-line em {
		font-style: normal;
		color: var(--hl);
	}
	.hl-preview-line em.hl-preview-pattern {
		color: transparent;
		background-size: cover;
		background-position: center;
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.hl-palette {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-top: 2px;
	}
	.hl-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.hl-group-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ap-text-3);
	}
	.hl-swatches {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.hl-swatch {
		width: 30px;
		height: 30px;
		border-radius: 999px;
		border: none;
		box-shadow: inset 0 0 0 1px rgba(15, 15, 16, 0.1);
		cursor: pointer;
		padding: 0;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.hl-swatch:hover { transform: scale(1.06); }
	.hl-swatch--on {
		box-shadow:
			0 0 0 2px var(--ap-bg),
			0 0 0 3.5px var(--ap-text);
	}
	.hl-swatch--grad {
		width: 44px;
		border-radius: 999px;
	}
	.hl-swatch--pattern {
		background-color: #1a1a1c;
	}
	.hl-custom {
		width: 30px;
		height: 30px;
		border-radius: 999px;
		overflow: hidden;
		border: 1px dashed var(--ap-line-2);
		background:
			conic-gradient(from 90deg, #f43f5e, #f59e0b, #22c55e, #3b82f6, #a855f7, #f43f5e);
		cursor: pointer;
		position: relative;
		flex-shrink: 0;
	}
	.hl-custom::after {
		content: '';
		position: absolute;
		inset: 4px;
		border-radius: 999px;
		background: var(--ap-bg);
		pointer-events: none;
	}
	.hl-custom input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
		border: none;
		padding: 0;
		z-index: 1;
	}

	.btn-danger {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.55rem 1rem; border-radius: 9px; border: 1px solid rgba(239,68,68,0.3);
		background: rgba(239,68,68,0.08); color: #f87171;
		font-size: 0.8125rem; font-weight: 600; cursor: pointer; font-family: var(--font-display);
		transition: all 0.15s;
	}
	.btn-danger:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.5); }

	/* ── Integrations ──────────────────────────────────────────── */
	.loading-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.8125rem; color: var(--t-muted); }
	.spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); border-top-color: #7bf1a8; animation: spin 0.8s linear infinite; }
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
		font-size: 0.65rem; font-family: var(--font-display); font-weight: 700;
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
		font-size: 0.65rem; font-family: var(--font-display);
		text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.3);
		margin-bottom: 0.6rem;
	}
	.env-code-wrap { position: relative; }
	.env-code {
		font-family: var(--font-display); font-size: 0.7rem;
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
	.env-hint { font-size: 0.7rem; color: rgba(255,255,255,0.28); margin: 0.5rem 0 0; font-family: var(--font-display); }

	.intg-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

	.btn-connect {
		padding: 0.55rem 1.1rem; border-radius: 9px; border: none;
		font-size: 0.8125rem; font-weight: 600; font-family: var(--font-display);
		cursor: pointer; background: var(--c, #7bf1a8); color: white;
		transition: opacity 0.12s, transform 0.12s;
	}
	.btn-connect:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.92; }
	.btn-connect:disabled { opacity: 0.3; cursor: not-allowed; }

	.btn-connect-outline {
		padding: 0.55rem 1rem; border-radius: 9px;
		font-size: 0.8125rem; font-weight: 600; font-family: var(--font-display);
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
	.mono { font-family: var(--font-display); }
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

	.inline-link { color: var(--ap-text); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: var(--ap-line-2); }
	.inline-link:hover { text-decoration-color: var(--ap-text); }

	.btn-secondary-sm {
		display: inline-flex; align-items: center; gap: 0.3rem;
		padding: 0.45rem 0.85rem; border-radius: 8px;
		background: rgba(123,241,168,0.08); border: 1px solid rgba(123,241,168,0.18);
		color: #7bf1a8; font-size: 0.78rem; font-weight: 600; text-decoration: none;
		transition: all 0.15s;
	}
	.btn-secondary-sm:hover { background: rgba(123,241,168,0.12); }

	/* ── Billing ───────────────────────────────────────────────── */
	.plan-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		align-items: flex-start;
	}
	@media (min-width: 768px) {
		.plan-row {
			grid-template-columns: auto 1fr;
			gap: 1.5rem;
		}
	}
	.plan-info { display: flex; align-items: center; gap: 1rem; }
	.plan-badge {
		width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
		background: var(--ap-soft-2); border: 1px solid var(--ap-line);
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-display); font-size: 11px; font-weight: 800;
		color: var(--ap-text); text-transform: uppercase; letter-spacing: 0.08em;
	}
	.plan-name  { font-weight: 700; color: var(--ap-text); margin: 0 0 0.2rem; font-size: 0.9375rem; }
	.plan-price { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--ap-text); margin: 0; letter-spacing: -0.03em; }
	.plan-price span { font-size: 0.875rem; color: var(--ap-text-3); font-weight: 500; }
	.plan-status {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		color: rgba(255,255,255,0.45);
		text-transform: capitalize;
	}
	.billing-error {
		margin: 0;
		padding: 0.65rem 0.85rem;
		border-radius: 9px;
		background: rgba(185, 28, 28, 0.08);
		border: 1px solid rgba(185, 28, 28, 0.22);
		color: #b42318;
		font-size: 0.8125rem;
	}

	.plan-features { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }
	@media (min-width: 480px) {
		.plan-features { grid-template-columns: 1fr 1fr; }
	}
	.plan-feature  { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: var(--ap-text-2); }
	:global(.feature-check) { color: #059669; flex-shrink: 0; }

	.billing-actions { display: flex; flex-wrap: wrap; gap: 0.65rem; }
	.billing-renew-note { margin-top: 0.85rem; }
	.btn-outline-sm {
		padding: 0.5rem 1rem; border-radius: 10px;
		border: 1px solid var(--ap-line);
		background: var(--ap-bg); color: var(--ap-text);
		font-size: 0.8125rem; font-weight: 600; cursor: pointer;
		font-family: var(--font-display); transition: background 0.15s, border-color 0.15s;
	}
	.btn-outline-sm:hover { background: var(--ap-soft); border-color: var(--ap-line-2); }

	.btn-upgrade {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.65rem 1.25rem; border-radius: 10px; border: none;
		background: #111214; color: #fff;
		font-size: 0.875rem; font-weight: 600; cursor: pointer;
		font-family: var(--font-display); width: fit-content;
	}
	.btn-upgrade:hover { background: #2a2b2e; }

	/* ── Login gate ────────────────────────────────────────────── */
	.login-card { max-width: 420px; }
	.btn-google {
		display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem;
		width: 100%; padding: 0.7rem 1rem; border-radius: 10px;
		border: 1px solid var(--panel-border); background: var(--panel-bg-2);
		color: var(--t-strong); font-size: 0.875rem; font-weight: 600;
		font-family: var(--font-display); cursor: pointer; transition: background 0.15s;
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
		font-family: var(--font-display); font-size: 0.8125rem; cursor: pointer;
		text-decoration: underline; padding: 0;
	}
	.link-btn:hover { color: var(--t-strong); }
	.login-success {
		margin: 0; padding: 0.65rem 0.85rem; border-radius: 9px;
		background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2);
		color: #047857; font-size: 0.8125rem;
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
	.pref-value--plan {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.35rem;
		text-align: right;
	}
	.pref-value--plan .status-pill { align-self: flex-end; }

	.trial-banner {
		padding: 0.85rem 1rem; border-radius: 12px;
		background: var(--ap-soft); border: 1px solid var(--ap-line);
	}
	.trial-title { margin: 0 0 0.25rem; font-size: 0.8125rem; font-weight: 600; color: var(--t-strong); }
	.trial-sub { margin: 0; font-size: 0.75rem; color: var(--t-muted); line-height: 1.5; }

	.plan-compare-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	@media (min-width: 640px) {
		.plan-compare-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (min-width: 1100px) {
		.plan-compare-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
	}
	.plan-compare-card {
		border-radius: 12px; padding: 1rem;
		background: var(--panel-bg-2); border: 1px solid var(--panel-border);
		display: flex; flex-direction: column; gap: 0.65rem;
	}
	.plan-compare-card--current { border-color: var(--ap-line-2); background: var(--ap-soft); }
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
