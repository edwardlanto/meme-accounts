<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { authFetch } from '$lib/authFetch';
	import { ArrowLeft, Calendar, Plus, X, GripVertical, ChevronLeft, ChevronRight } from 'lucide-svelte';

	type ChannelId = 'x' | 'linkedin' | 'linkedinPage' | 'reddit' | 'instagramBusiness' | 'facebookPage' | 'threads' | 'youtube' | 'gmb' | 'tiktok' | 'pinterest';
	type Channel = { id: ChannelId; label: string; accent: string; kind?: 'business' | 'page' | 'standalone'; icon: (active: boolean) => string };
	type IgContentType = 'post' | 'reel' | 'carousel' | 'story';
	type Draft = { id: string; title: string; channels: ChannelId[]; igType: IgContentType; images?: string[]; imageCaptions?: string[]; video?: string; videoCaption?: string };
	type ScheduledPostStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
	type ScheduledPost = { id: string; title: string; channels: ChannelId[]; igType: IgContentType; startISO: string; durationMin: number; status: ScheduledPostStatus; lastError?: string | null };

	type DbScheduledPost = {
		id: string;
		user_id: string;
		connection_provider: string;
		connection_provider_account_id: string;
		content: any;
		scheduled_at: string;
		status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
		job_id: string | null;
	};

	type DbSocialConnection = {
		id: string;
		user_id: string;
		provider: string;
		provider_account_id: string;
		provider_account_label: string;
		access_token: string;
		meta: any;
	};

	function igTypeLabel(t: IgContentType) {
		if (t === 'post') return 'Post';
		if (t === 'reel') return 'Reel';
		if (t === 'carousel') return 'Carousel';
		return 'Story';
	}
	function igTypePillClass(t: IgContentType) {
		if (t === 'reel') return 'bg-red-500/10 border-red-500/20 text-red-200/70';
		if (t === 'carousel') return 'bg-violet-500/10 border-violet-500/20 text-violet-200/70';
		if (t === 'story') return 'bg-amber-500/10 border-amber-500/20 text-amber-200/70';
		return 'bg-sky-500/10 border-sky-500/20 text-sky-200/70';
	}

	const CHANNELS: Channel[] = [
		{
			id: 'x', label: 'X', accent: 'bg-white/70',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18.2 2H21L14.7 9.2L22.1 22H16.1L11.4 14.7L5.1 22H2.3L9.1 14.2L2 2H8.2L12.4 8.5L18.2 2Z" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}"/>
</svg>`,
		},
		{
			id: 'linkedin', label: 'LinkedIn', accent: 'bg-blue-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? '#3b82f6' : 'rgba(59,130,246,0.55)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
  <rect x="2" y="9" width="4" height="12"/>
  <circle cx="4" cy="4" r="2"/>
</svg>`,
		},
		{
			id: 'linkedinPage', label: 'LinkedIn Page', kind: 'page', accent: 'bg-blue-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? '#3b82f6' : 'rgba(59,130,246,0.55)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 4h16v16H4z" opacity="0.25"/>
  <path d="M7 10h3v9H7zM8.5 6.5A1.5 1.5 0 1 0 8.5 9.5A1.5 1.5 0 0 0 8.5 6.5Z"/>
  <path d="M13 10h-3v9h3v-4.8c0-1.2.7-2.2 1.9-2.2 1.2 0 1.6.8 1.6 2.3V19h3v-5.7c0-2.7-1.3-3.8-3.3-3.8-1.3 0-2.2.7-2.2.7z"/>
</svg>`,
		},
		{
			id: 'reddit', label: 'Reddit', accent: 'bg-orange-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20.8 12.1c0-1-.8-1.8-1.8-1.8-.5 0-1 .2-1.3.6-1.3-.9-3.1-1.5-5-1.6l.9-4.1 2.9.7c0 1 .8 1.7 1.8 1.7 1 0 1.8-.8 1.8-1.8S19.3 3 18.3 3c-.7 0-1.4.4-1.7 1.1L12.7 3.2c-.3-.1-.7.1-.7.5l-1.2 5.5c-2 .1-3.9.7-5.3 1.6-.3-.3-.8-.5-1.3-.5-1 0-1.8.8-1.8 1.8 0 .7.4 1.4 1.1 1.7-.1.4-.1.8-.1 1.2 0 3.1 3.9 5.6 8.7 5.6s8.7-2.5 8.7-5.6c0-.4 0-.8-.1-1.1.6-.3 1.1-1 1.1-1.7z" fill="${active ? '#fb923c' : 'rgba(251,146,60,0.55)'}"/>
  <circle cx="9" cy="14" r="1.2" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'}"/>
  <circle cx="15" cy="14" r="1.2" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'}"/>
  <path d="M9 17.2c.9.8 1.9 1.2 3 1.2s2.1-.4 3-1.2" stroke="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'}" stroke-width="1.4" stroke-linecap="round"/>
</svg>`,
		},
		{
			id: 'instagramBusiness', label: 'Instagram (Business)', kind: 'business', accent: 'bg-pink-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ig" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
      <stop stop-color="${active ? '#ec4899' : 'rgba(236,72,153,0.55)'}"/>
      <stop offset="1" stop-color="${active ? '#a855f7' : 'rgba(168,85,247,0.55)'}"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="18" height="18" rx="5" stroke="url(#ig)" stroke-width="2"/>
  <circle cx="12" cy="12" r="4" stroke="url(#ig)" stroke-width="2"/>
  <circle cx="17.5" cy="6.5" r="1" fill="url(#ig)"/>
</svg>`,
		},
		{
			id: 'facebookPage', label: 'Facebook Page', kind: 'page', accent: 'bg-blue-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? '#60a5fa' : 'rgba(96,165,250,0.55)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.8c0-2.3 1.3-3.6 3.4-3.6 1 0 2 .2 2 .2v2.3H15c-1.1 0-1.5.7-1.5 1.4v1.7h2.6L15.7 15h-2.2v7A10 10 0 0 0 22 12z"/>
</svg>`,
		},
		{
			id: 'threads', label: 'Threads', accent: 'bg-white/60',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2.5c3.9 0 6.8 2.5 7.3 6.2.3 2.4-.7 4.8-2.6 6.2.2 2.3-1.2 4.9-4.2 6.2-4.8 2.1-9.6-1.5-9.6-7.6C2.9 6.9 6.8 2.5 12 2.5Zm3.8 9.7c-.7-2.7-3.6-3.7-6-3.2-2.2.4-3.8 2.1-3.7 4.4.1 2.5 2.1 4 4.5 3.7 1.7-.2 3-1.3 3.4-2.9-.8.2-1.7.2-2.6 0-.6-.1-1-.6-.9-1.2.1-.6.6-1 1.2-.9 1.1.2 2.2.1 3.1-.3Z"/>
</svg>`,
		},
		{
			id: 'youtube', label: 'YouTube', accent: 'bg-red-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21.6 7.3c-.2-1-1-1.8-2-2C17.9 5 12 5 12 5s-5.9 0-7.6.3c-1 .2-1.8 1-2 2C2 9 2 12 2 12s0 3 .4 4.7c.2 1 1 1.8 2 2C6.1 19 12 19 12 19s5.9 0 7.6-.3c1-.2 1.8-1 2-2 .4-1.7.4-4.7.4-4.7s0-3-.4-4.7Z" fill="${active ? '#ef4444' : 'rgba(239,68,68,0.55)'}"/>
  <path d="M10.3 9.5v5l4.7-2.5-4.7-2.5Z" fill="${active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'}"/>
</svg>`,
		},
		{
			id: 'tiktok', label: 'TikTok', accent: 'bg-white/60',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 3c.6 3.4 2.6 5.4 6 6v3.1c-2.2.1-4.1-.6-6-1.9v6.3c0 4-3.3 7.1-7.3 6.5-2.5-.4-4.6-2.4-5-4.9C1.8 14 4.8 10.6 9 10.6c.4 0 .8 0 1.1.1v3.6c-.3-.1-.7-.2-1.1-.2-1.6 0-2.9 1.3-2.9 2.9 0 1.7 1.5 3.1 3.3 2.9 1.3-.2 2.3-1.4 2.3-2.7V3h3.2Z"/>
</svg>`,
		},
		{
			id: 'pinterest', label: 'Pinterest', accent: 'bg-red-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? '#ef4444' : 'rgba(239,68,68,0.55)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 5.1 3.2 9.4 7.6 11.2-.1-.9-.2-2.4 0-3.4.2-.9 1.4-6 1.4-6s-.4-.7-.4-1.8c0-1.7 1-2.9 2.2-2.9 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.2 3.8-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.6-5.4 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.3l-.3 1.4c-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.6 0-3.8 2.8-7.3 7.9-7.3 4.2 0 7.4 3 7.4 6.9 0 4.1-2.6 7.5-6.2 7.5-1.2 0-2.4-.6-2.8-1.4L9 20.1c-.3 1-1 2.3-1.5 3.1.9.3 2 .5 3 .5 6.6 0 12-5.4 12-12S18.6 0 12 0z"/>
</svg>`,
		},
		{
			id: 'gmb', label: 'Google My Business', accent: 'bg-emerald-300',
			icon: (active) => `<div style="width:22px;height:22px;border-radius:8px;background:${active ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.2)'};border:1px solid rgba(16,185,129,0.35);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.7);font-weight:800;font-size:10px;">G</div>`,
		},
	];

	function channelById(id: ChannelId) {
		return CHANNELS.find((c) => c.id === id);
	}

	// ── Channels UI ───────────────────────────────────────────────────────────
	let connected = $state<ChannelId[]>([]);
	let showAddChannel = $state(false);
	let userId = $state('');
	let connections = $state<DbSocialConnection[]>([]);
	let connectionsError = $state('');
	let loadingPosts = $state(false);
	let postsError = $state('');
	type RecentPost = {
		id: string;
		status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
		scheduled_at: string;
		published_at: string | null;
		last_error: string | null;
		title: string;
		channel: ChannelId;
	};
	let recentPosts = $state<RecentPost[]>([]);
	let metaBanner = $state<{ kind: 'error' | 'success'; message: string } | null>(null);
	let studioDraftId = $state<string>('');
	let studioExportPreview = $state<string[]>([]);
	let dismissedDraftIds = $state<string[]>([]);
	let lightbox = $state<{ open: boolean; images: string[]; index: number; title?: string }>({
		open: false,
		images: [],
		index: 0,
	});

	function openLightbox(images: string[], index: number, title?: string) {
		const arr = (images ?? []).map((x) => String(x)).filter(Boolean);
		if (!arr.length) return;
		lightbox = { open: true, images: arr, index: Math.max(0, Math.min(arr.length - 1, index)), title };
	}
	function closeLightbox() { lightbox = { open: false, images: [], index: 0 }; }
	function lbPrev() {
		if (!lightbox.open) return;
		lightbox = { ...lightbox, index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length };
	}
	function lbNext() {
		if (!lightbox.open) return;
		lightbox = { ...lightbox, index: (lightbox.index + 1) % lightbox.images.length };
	}

	const DISMISSED_KEY = 'ssp.dismissedDraftIds.v1';
	function loadDismissed() {
		try {
			const raw = localStorage.getItem(DISMISSED_KEY);
			const arr = raw ? JSON.parse(raw) : [];
			if (Array.isArray(arr)) dismissedDraftIds = arr.map((x) => String(x));
		} catch {
			dismissedDraftIds = [];
		}
	}
	function dismissDraftId(id: string) {
		const next = Array.from(new Set([...dismissedDraftIds, id]));
		dismissedDraftIds = next;
		try {
			localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
		} catch {
			// ignore
		}
	}
	function isDismissed(id: string) {
		return dismissedDraftIds.includes(id);
	}

	onMount(async () => {
		loadDismissed();

		// Surface Zernio OAuth redirect results (callback appends query params).
		const params = new URLSearchParams(window.location.search);
		const zernioError = params.get('zernio_error');
		const zernioConnected = params.get('zernio_connected');
		if (zernioError) {
			metaBanner = {
				kind: 'error',
				message:
					`Zernio connect failed: ${zernioError}` +
					(params.get('desc') ? ` — ${params.get('desc')}` : ''),
			};
		} else if (zernioConnected === '1') {
			metaBanner = {
				kind: 'success',
				message: 'Zernio account synced. Your Facebook, Instagram, or TikTok connection should appear under channels.',
			};
		}

		const { data } = await supabase.auth.getUser();
		userId = data.user?.id ?? '';
		if (!userId) {
			goto('/login');
			return;
		}
		await Promise.all([loadConnections(), loadScheduledPosts()]);
		await loadLatestNewsStudioExports(params);

		// If we came from Studio and export succeeded, show a clear banner so the user posts the right draft.
		if (params.get('from') === 'studio' && params.get('exported') === '1' && studioDraftId) {
			metaBanner = {
				kind: 'success',
				message: 'Studio export ready. Use the top "News Studio: carousel …" draft to post images to Facebook.',
			};
		}

		// If we came from the Post-tests page after scheduling, point the user at the scheduled pill on the calendar.
		if (params.get('from') === 'post-tests' && params.get('scheduled') === '1') {
			const wantId = params.get('postId') ?? '';
			// If we know the exact post id, make sure it's in `posts` (retry reload a couple times in case of replication lag).
			let target = wantId ? posts.find((p) => p.id === wantId) : undefined;
			for (let i = 0; i < 3 && wantId && !target; i++) {
				await new Promise((r) => setTimeout(r, 400));
				await loadScheduledPosts();
				target = posts.find((p) => p.id === wantId);
			}
			// Fall back to newest scheduled row (by insertion order: last in `posts` after ascending sort isn't reliable; use max scheduled_at among status=scheduled).
			if (!target) {
				target = [...posts]
					.filter((p) => p.status === 'scheduled')
					.sort((a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime())[0];
			}
			if (target) {
				const when = new Date(target.startISO);
				anchor = when;
				// Scroll the calendar to the hour of the scheduled post so the pill is visible without scrolling.
				await tick();
				scrollCalendarToHour(when.getHours());
				metaBanner = {
					kind: 'success',
					message: `Scheduled for ${when.toLocaleString()}. Look for the violet "Scheduled" pill on the calendar below.`,
				};
			} else {
				metaBanner = {
					kind: 'error',
					message: 'Scheduled, but the post didn’t appear yet. Try reloading in a few seconds.',
				};
			}
		}

		// Clean URL so refresh doesn't keep showing banners.
		if (metaBanner || params.get('from') === 'studio' || params.get('from') === 'post-tests') {
			await goto('/dashboard/post-scheduler', { replaceState: true });
		}
	});

	async function loadLatestNewsStudioExports(params?: URLSearchParams) {
		// Optional: surface "real" carousel images exported from News Studio (saved in drafts.state.exportedSlides)
		try {
			const { data, error } = await (supabase as any)
				.from('drafts')
				.select('id,kind,state,updated_at')
				.eq('kind', 'news_studio')
				.eq('user_id', userId)
				.order('updated_at', { ascending: false })
				.limit(1);
			if (error) return;
			const row = (data?.[0] ?? null) as any;
			const exported = Array.isArray(row?.state?.exportedSlides) ? row.state.exportedSlides.map((x: any) => String(x)).filter(Boolean) : [];
			if (!exported.length) return;
			// Only show the "Ready to upload" preview when the user just came from Studio.
			const preferStudio = params?.get('from') === 'studio' && params?.get('exported') === '1';
			studioExportPreview = preferStudio ? exported : [];

			// Prepend a draft that actually contains images so Facebook carousel posting works.
			// Use a stable id so it doesn't duplicate across reloads.
			const id = `studio:${String(row.id ?? 'latest')}`;
			if (isDismissed(id)) return;
			if (drafts.some((d) => d.id === id)) return;
			studioDraftId = id;

			// If we explicitly came from Studio export, pin the studio draft and avoid confusing starter drafts.
			drafts = [
				{
					id,
					title: `News Studio: carousel (${exported.length} slides)`,
					channels: ['facebookPage'],
					igType: 'carousel',
					images: exported,
				},
				...(preferStudio ? drafts.filter((d) => d.id.startsWith('studio:')) : drafts),
			];
		} catch {
			// ignore
		}
	}

	async function loadConnections() {
		connectionsError = '';
		const { data, error } = await (supabase as any)
			.from('social_connections')
			.select('id,user_id,provider,provider_account_id,provider_account_label,access_token,meta')
			.eq('user_id', userId)
			.eq('provider', 'zernio');
		if (error) {
			connectionsError = error.message ?? 'Failed to load connections';
			return;
		}
		connections = (data ?? []) as DbSocialConnection[];

		const nextConnected = new Set<ChannelId>();
		for (const c of connections) {
			const p = String(c?.meta?.platform ?? '').toLowerCase();
			if (p === 'instagram') nextConnected.add('instagramBusiness');
			if (p === 'facebook') nextConnected.add('facebookPage');
			if (p === 'tiktok') nextConnected.add('tiktok');
		}
		connected = Array.from(nextConnected);
	}

	async function disconnectChannel(id: ChannelId) {
		if (!userId) return;

		const label =
			id === 'instagramBusiness' ? 'Instagram' :
			id === 'facebookPage' ? 'Facebook Page' :
			id === 'tiktok' ? 'TikTok' :
			id;

		if (!confirm(`Disconnect ${label}? You can reconnect anytime.`)) return;

		const platform =
			id === 'instagramBusiness' ? 'instagram' :
			id === 'facebookPage' ? 'facebook' :
			id === 'tiktok' ? 'tiktok' :
			'';

		try {
			if (!platform) return;
			const { error } = await (supabase as any)
				.from('social_connections')
				.delete()
				.eq('user_id', userId)
				.eq('provider', 'zernio')
				.contains('meta', { platform });
			if (error) throw error;

			// Refresh UI state
			drafts = [];
			await Promise.all([loadConnections(), loadScheduledPosts()]);
		} catch (e: any) {
			alert(`Could not disconnect: ${e?.message ?? 'unknown error'}`);
		}
	}

	function postChannelsFromProvider(provider: string, acct: string, meta: any): ChannelId[] {
		if (provider === 'zernio') {
			const p = String(meta?.platform ?? '').toLowerCase();
			if (p === 'facebook') return ['facebookPage'];
			if (p === 'instagram') return ['instagramBusiness'];
			if (p === 'tiktok') return ['tiktok'];
			return [];
		}
		if (provider === 'gmb') return ['gmb'];
		if (provider === 'linkedin') return ['linkedin'];
		return [];
	}

	function deriveTitle(content: any, provider: string, acct: string) {
		const c = content ?? {};
		const explicit = String(c.title ?? '').trim();
		if (explicit) return explicit.slice(0, 120);

		const msg = String(c.caption ?? c.message ?? '').trim();
		const imgs = Array.isArray(c.images) ? c.images.length : 0;
		const vids = Array.isArray(c.videos) ? c.videos.length : c.video ? 1 : 0;

		// Worker IG content uses `igType` + sometimes `kind: ig_*`.
		const igType = String(c.igType ?? '').toLowerCase();
		const rawKind = String(c.kind ?? '').toLowerCase();
		const zPlatform = String(c?.meta?.platform ?? '').toLowerCase();
		const isIg = provider === 'zernio' && zPlatform === 'instagram';

		let kind = '';
		if (rawKind === 'reel') kind = 'Reel';
		else if (rawKind === 'photo_story') kind = 'Photo Story';
		else if (rawKind === 'video_story') kind = 'Video Story';
		else if (isIg && igType === 'post') kind = 'IG Photo';
		else if (isIg && igType === 'reel') kind = 'IG Reel';
		else if (isIg && igType === 'carousel') {
			const n = Array.isArray(c.children) ? c.children.length : 0;
			kind = n ? `IG Carousel (${n})` : 'IG Carousel';
		}
		else if (isIg && (igType === 'story_image' || igType === 'photo_story')) kind = 'IG Photo Story';
		else if (isIg && (igType === 'story_video' || igType === 'video_story')) kind = 'IG Video Story';
		else if (imgs > 1) kind = `Carousel (${imgs})`;
		else if (imgs === 1) kind = 'Photo';
		else if (vids > 1) kind = `Videos (${vids})`;
		else if (vids === 1) kind = 'Video';
		else kind = provider === 'zernio' && zPlatform === 'facebook' ? 'FB text' : isIg ? 'IG' : provider === 'zernio' && zPlatform === 'tiktok' ? 'TikTok' : 'Post';

		return (msg ? `${kind} — ${msg}` : kind).slice(0, 120);
	}

	async function loadRecentPosts() {
		try {
			const { data, error } = await (supabase as any)
				.from('scheduled_posts')
				.select('id,connection_provider,connection_provider_account_id,content,scheduled_at,status,published_at,last_error')
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
				.limit(10);
			if (error) return;
			const rows = (data ?? []) as any[];
			recentPosts = rows.map((r) => ({
				id: r.id,
				status: r.status,
				scheduled_at: r.scheduled_at,
				published_at: r.published_at,
				last_error: r.last_error,
				title: deriveTitle(r.content, r.connection_provider, r.connection_provider_account_id),
				channel: postChannelsFromProvider(r.connection_provider, r.connection_provider_account_id, r.content?.meta)[0] ?? 'facebookPage',
			}));
		} catch {
			/* no-op */
		}
	}

	async function loadScheduledPosts() {
		loadingPosts = true;
		postsError = '';
		await loadRecentPosts();
		try {
			const { data, error } = await (supabase as any)
				.from('scheduled_posts')
				.select('id,user_id,connection_provider,connection_provider_account_id,content,scheduled_at,status,job_id,last_error')
				.eq('user_id', userId)
				.in('status', ['scheduled', 'publishing', 'published', 'failed'])
				.order('scheduled_at', { ascending: true });
			if (error) throw error;

			const rows = (data ?? []) as (DbScheduledPost & { last_error?: string | null })[];
			posts = rows.map((r) => {
				const content = r.content ?? {};
				const igType = (String(content.igType ?? content.ig_type ?? 'post') as IgContentType) || 'post';
				return {
					id: r.id,
					title: deriveTitle(content, r.connection_provider, r.connection_provider_account_id),
					channels: postChannelsFromProvider(r.connection_provider, r.connection_provider_account_id, content?.meta),
					igType,
					status: r.status,
					lastError: r.last_error ?? null,
					startISO: new Date(r.scheduled_at).toISOString(),
					durationMin: 60,
				} satisfies ScheduledPost;
			});
		} catch (e: any) {
			postsError = e?.message ?? 'Failed to load scheduled posts';
		}
		loadingPosts = false;
	}

	async function connectInstagramBusiness() {
		try {
			const res = await fetch('/api/integrations/zernio/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`Zernio needs: ${st.missing.join(', ')} (set in server env).`);
				goto('/dashboard/settings?integrations=1#instagram');
				return;
			}
		} catch {
			alert('Could not verify Zernio configuration. Open Settings → Integrations.');
			goto('/dashboard/settings?integrations=1#instagram');
			return;
		}

		if (!userId) {
			alert('Please sign in before connecting Instagram.');
			goto('/login');
			return;
		}

		window.location.href = `/api/auth/zernio/start?platform=instagram&userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	async function connectFacebookPages() {
		try {
			const res = await fetch('/api/integrations/zernio/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`Zernio needs: ${st.missing.join(', ')} (set in server env).`);
				goto('/dashboard/settings?integrations=1#instagram');
				return;
			}
		} catch {
			alert('Could not verify Zernio configuration. Open Settings → Integrations.');
			goto('/dashboard/settings?integrations=1#instagram');
			return;
		}

		if (!userId) {
			alert('Please sign in before connecting Facebook.');
			goto('/login');
			return;
		}

		window.location.href = `/api/auth/zernio/start?platform=facebook&userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	async function connectTiktokZernio() {
		try {
			const res = await fetch('/api/integrations/zernio/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`Zernio needs: ${st.missing.join(', ')} (set in server env).`);
				goto('/dashboard/settings?integrations=1');
				return;
			}
		} catch {
			alert('Could not verify Zernio configuration.');
			return;
		}
		if (!userId) {
			goto('/login');
			return;
		}
		window.location.href = `/api/auth/zernio/start?platform=tiktok&userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	async function connectLinkedIn(mode: 'member' | 'org' | 'both') {
		try {
			const res = await fetch('/api/integrations/linkedin/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`LinkedIn connect needs credentials: ${st.missing.join(', ')}.\n\nGo to Settings → Integrations to add them.`);
				goto('/dashboard/settings?integrations=1#linkedin');
				return;
			}
		} catch {
			alert('Could not verify LinkedIn credentials. Open Settings → Integrations.');
			goto('/dashboard/settings?integrations=1#linkedin');
			return;
		}

		if (!userId) {
			alert('Please sign in before connecting LinkedIn.');
			goto('/login');
			return;
		}

		window.location.href =
			`/api/auth/linkedin/start?userId=${encodeURIComponent(userId)}` +
			`&mode=${encodeURIComponent(mode)}` +
			`&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	async function connectGmb() {
		try {
			const res = await fetch('/api/integrations/gmb/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`Google My Business connect needs credentials: ${st.missing.join(', ')}.\n\nGo to Settings → Integrations to add them.`);
				goto('/dashboard/settings?integrations=1#gmb');
				return;
			}
		} catch {
			alert('Could not verify Google My Business credentials. Open Settings → Integrations.');
			goto('/dashboard/settings?integrations=1#gmb');
			return;
		}

		if (!userId) {
			alert('Please sign in before connecting Google My Business.');
			goto('/login');
			return;
		}

		window.location.href = `/api/auth/gmb/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	function toggleConnected(id: ChannelId) {
		connected = connected.includes(id) ? connected.filter((x) => x !== id) : [...connected, id];
	}

	// ── Calendar data ─────────────────────────────────────────────────────────
	function pad2(n: number) { return String(n).padStart(2, '0'); }
	function localIso(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`; }
	function startOfWeek(d: Date) {
		const x = new Date(d);
		const day = x.getDay();
		const diff = (day === 0 ? -6 : 1) - day;
		x.setDate(x.getDate() + diff);
		x.setHours(0, 0, 0, 0);
		return x;
	}
	function startOfMonthGridSunday(d: Date) {
		const first = new Date(d.getFullYear(), d.getMonth(), 1);
		const day = first.getDay(); // 0=Sun
		first.setDate(first.getDate() - day);
		first.setHours(0, 0, 0, 0);
		return first;
	}
	function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
	function fmtDayLabel(d: Date) { return d.toLocaleDateString(undefined, { weekday: 'short' }); }
	function fmtMonth(d: Date) { return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
	function fmtDayNum(d: Date) { return d.getDate(); }

	let view = $state<'day' | 'week' | 'month'>('week');
	let anchor = $state(new Date());
	let calendarScrollEl: HTMLDivElement | null = $state(null);
	const calLine = 'color-mix(in oklab, var(--app-text) 18%, transparent)';
	function scrollCalendarToHour(hr: number) {
		if (!calendarScrollEl) return;
		const HOUR_HEIGHT = 80; // must match h-20 in grid rows
		const HEADER_HEIGHT = 56; // h-14 day header
		const target = Math.max(0, HEADER_HEIGHT + (hr - 1) * HOUR_HEIGHT);
		calendarScrollEl.scrollTo({ top: target, behavior: 'smooth' });
	}
	const weekStart = $derived(startOfWeek(anchor));
	const weekDays = $derived(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
	const dayOnly = $derived(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()));
	const monthGridStart = $derived(startOfMonthGridSunday(anchor));
	const monthDays = $derived(Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i)));
	// Calendar rows span a full 24h so scheduled/published posts never fall
	// outside the visible range regardless of time of day.
	const START_HOUR = 0;
	const END_HOUR = 23;
	const hours = $derived(Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i));

	let drafts = $state<Draft[]>([]);
	let posts = $state<ScheduledPost[]>([]);

	// Minimal starter drafts once connections are available (UI convenience only)
	let seededStarterDrafts = $state(false);
	$effect(() => {
		if (seededStarterDrafts) return;
		if (drafts.length > 0) return;
		const next: Draft[] = [];
		if (connected.includes('facebookPage')) {
			const id = 'starter:facebookPage';
			if (!isDismissed(id)) next.push({ id, title: 'Facebook Page: text post', channels: ['facebookPage'], igType: 'post' });
		}
		if (connected.includes('instagramBusiness')) {
			const id = 'starter:instagramBusiness';
			if (!isDismissed(id)) next.push({ id, title: 'Instagram: post (needs public image URL)', channels: ['instagramBusiness'], igType: 'post' });
		}
		// Avoid infinite loops: don't write drafts back to an empty array.
		if (next.length > 0) {
			drafts = next;
			seededStarterDrafts = true;
		}
	});

	function deleteDraft(draftId: string) {
		dismissDraftId(draftId);
		drafts = drafts.filter((d) => d.id !== draftId);
		// If the user deletes all drafts, don't immediately regenerate starter drafts this session.
		seededStarterDrafts = true;
	}

	function postsForDay(day: Date) {
		const yyyy = day.getFullYear();
		const mm = day.getMonth();
		const dd = day.getDate();
		return posts
			.filter((p) => {
				const d = new Date(p.startISO);
				return d.getFullYear() === yyyy && d.getMonth() === mm && d.getDate() === dd;
			})
			.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
	}

	function dragStartDraft(e: DragEvent, id: string) {
		e.dataTransfer?.setData('application/x-ssp', JSON.stringify({ kind: 'draft', id }));
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
	}
	function dragStartPost(e: DragEvent, id: string) {
		e.dataTransfer?.setData('application/x-ssp', JSON.stringify({ kind: 'post', id }));
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function allowDrop(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}
	function dropToSlot(e: DragEvent, day: Date, hour: number) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData('application/x-ssp');
		if (!raw) return;
		let payload: any;
		try { payload = JSON.parse(raw); } catch { return; }

		const d = new Date(day);
		d.setHours(hour, 0, 0, 0);
		if (payload.kind === 'post') {
			// Rescheduling not wired to backend yet.
			posts = posts.map((p) => (p.id === payload.id ? { ...p, startISO: localIso(d) } : p));
			return;
		}
		if (payload.kind === 'draft') {
			const draft = drafts.find((x) => x.id === payload.id);
			if (!draft) return;
			void scheduleDraft(draft, d);
		}
	}

	function prev() {
		if (view === 'week') { anchor = addDays(anchor, -7); return; }
		if (view === 'month') { anchor = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1); return; }
		anchor = addDays(anchor, -1);
	}
	function next() {
		if (view === 'week') { anchor = addDays(anchor, 7); return; }
		if (view === 'month') { anchor = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1); return; }
		anchor = addDays(anchor, 1);
	}
	function today() { anchor = new Date(); }

	function pickZernioConnectionForChannel(channel: ChannelId): DbSocialConnection | null {
		if (channel === 'facebookPage') {
			return connections.find((c) => String(c?.meta?.platform ?? '') === 'facebook') ?? null;
		}
		if (channel === 'instagramBusiness') {
			return connections.find((c) => String(c?.meta?.platform ?? '') === 'instagram') ?? null;
		}
		if (channel === 'tiktok') {
			return connections.find((c) => String(c?.meta?.platform ?? '') === 'tiktok') ?? null;
		}
		return null;
	}

	async function scheduleDraft(draft: Draft, when: Date) {
		if (!userId) {
			alert('Please sign in.');
			return;
		}

		// Choose first channel in the draft that we can actually schedule
		const target =
			draft.channels.find((c) => c === 'facebookPage' || c === 'instagramBusiness' || c === 'tiktok') ?? null;
		if (!target) {
			alert('This draft has no supported channel yet.');
			return;
		}

		const conn = pickZernioConnectionForChannel(target);
		if (!conn) {
			alert(`No connection found for ${target}. Click "Add Channel" and connect first.`);
			return;
		}

		let content: any = {};
		if (target === 'facebookPage') {
			const message = `Scheduled from Social Poster — ${new Date().toLocaleString()}`;
			if (draft.images?.length) {
				content = { message, images: draft.images, meta: { platform: 'facebook' } };
				if (draft.imageCaptions?.length) content.imageCaptions = draft.imageCaptions;
			} else if (draft.video) {
				content = { message, video: draft.video, meta: { platform: 'facebook' } };
			} else {
				content = { message, meta: { platform: 'facebook' } };
			}
		} else if (target === 'instagramBusiness') {
			const caption = `Scheduled from Social Poster — ${new Date().toLocaleString()}`;
			if (draft.igType === 'carousel' && draft.images && draft.images.length >= 2) {
				content = {
					igType: 'carousel',
					caption,
					children: draft.images.map((url) => ({ imageUrl: url })),
					meta: { platform: 'instagram' },
				};
			} else if (draft.igType === 'reel' && draft.video) {
				content = { igType: 'reel', caption, videoUrl: draft.video, meta: { platform: 'instagram' } };
			} else if (draft.images?.[0]) {
				content = { igType: 'post', caption, imageUrl: draft.images[0], meta: { platform: 'instagram' } };
			} else {
				alert('Instagram scheduling needs at least one public image URL, a carousel (2+ images), or a video URL.');
				return;
			}
		} else if (target === 'tiktok') {
			if (!draft.video) {
				alert('TikTok scheduling needs a public video URL on the draft.');
				return;
			}
			content = {
				videoUrl: draft.video,
				mode: 'direct',
				title: `Scheduled — ${new Date().toLocaleString()}`,
				meta: { platform: 'tiktok' },
			};
		}

		try {
			const res = await authFetch('/api/scheduler/schedule', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userId,
					connectionProvider: 'zernio',
					connectionProviderAccountId: conn.provider_account_id,
					scheduledAt: when.toISOString(),
					content,
				}),
			});
			const data = await res.json();
			if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'Failed to schedule');
			await loadScheduledPosts();
		} catch (e: any) {
			alert(`Could not schedule: ${e?.message ?? 'unknown error'}`);
		}
	}

	async function postNow(draft: Draft) {
		if (!userId) {
			alert('Please sign in.');
			return;
		}

		const target =
			draft.channels.find((c) => c === 'facebookPage' || c === 'instagramBusiness' || c === 'tiktok') ?? null;
		if (!target) {
			alert('This draft has no supported channel yet.');
			return;
		}

		const conn = pickZernioConnectionForChannel(target);
		if (!conn) {
			alert(`No connection found for ${target}. Click "Add Channel" and connect first.`);
			return;
		}

		// Fast path: Facebook Page → Zernio
		if (target === 'facebookPage') {
			metaBanner = { kind: 'success', message: 'Posting to Facebook now…' };
			try {
				const message = `Posted from Social Poster — ${new Date().toLocaleString()}`;
				const content: any = { message };
				if (draft.images?.length) {
					content.images = draft.images;
					if (draft.imageCaptions?.length) content.imageCaptions = draft.imageCaptions;
				} else if (draft.video) content.video = draft.video;

				const res = await authFetch('/api/publish/facebook', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						userId,
						pageProviderAccountId: conn.provider_account_id,
						content,
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Post failed (${res.status})`);
				const zid =
					data?.results?.[0]?.post?._id ??
					data?.results?.[0]?.post?.id ??
					data?.results?.[0]?._id ??
					'';
				metaBanner = {
					kind: 'success',
					message: `Posted via Zernio${zid ? ` (post ${zid})` : ''}. Check your Page.`,
				};
				// Optional: remove the draft from the UI so the user sees it's done.
				dismissDraftId(draft.id);
				drafts = drafts.filter((d) => d.id !== draft.id);
			} catch (e: any) {
				metaBanner = { kind: 'error', message: `Post failed: ${e?.message ?? 'unknown error'}` };
			}
			return;
		}

		// Instagram / TikTok: scheduled-queue path (worker must be running).
		const when = new Date(Date.now() + 2000);
		metaBanner = { kind: 'success', message: 'Posting now via scheduler… (worker must be running)' };
		await scheduleDraft(draft, when);
		for (let i = 0; i < 6; i++) {
			await new Promise((r) => setTimeout(r, 1500));
			await loadScheduledPosts();
		}
	}

	async function pickTimeAndSchedule(draft: Draft) {
		const input = prompt('Schedule time (local) as YYYY-MM-DD HH:MM', '');
		if (!input) return;
		const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
		if (!m) {
			alert('Invalid format. Use YYYY-MM-DD HH:MM');
			return;
		}
		const [_, ys, mos, ds, hs, mis] = m;
		const when = new Date(
			Number(ys),
			Number(mos) - 1,
			Number(ds),
			Number(hs),
			Number(mis),
			0,
			0
		);
		if (Number.isNaN(when.getTime())) {
			alert('Invalid date/time.');
			return;
		}
		await scheduleDraft(draft, when);
	}

	async function unschedulePost(postId: string) {
		if (!userId) return;
		// Remove immediately for responsiveness
		posts = posts.filter((p) => p.id !== postId);

		try {
			const res = await authFetch('/api/scheduler/cancel', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ userId, postId }),
			});
			const data = await res.json();
			if (!res.ok || !data?.ok) {
				throw new Error(data?.error ?? 'Failed to unschedule');
			}
			await loadScheduledPosts();
		} catch (e: any) {
			alert(`Could not unschedule: ${e?.message ?? 'unknown error'}`);
		}
	}
</script>

<div class="scheduler-root h-[calc(100vh-0px)] w-full flex overflow-hidden" style="background: var(--app-bg); color: var(--app-text);">
	<!-- ═══ LEFT SIDEBAR ════════════════════════════════════════════════════ -->
	<aside class="w-72 shrink-0 border-r flex flex-col" style="background: var(--app-surface-2); border-color: var(--app-border);">
		<!-- Header -->
		<div class="px-4 py-3.5 border-b flex items-center gap-2.5" style="border-color: var(--app-border);">
			<button onclick={() => history.length > 1 ? history.back() : goto('/dashboard')}
				class="cal-icon-btn"
				aria-label="Go back">
				<ArrowLeft size={15} />
			</button>
			<div class="min-w-0 flex-1">
				<p class="text-[10px] font-sans uppercase tracking-widest" style="color: var(--app-text-3);">Schedule</p>
				<p class="text-sm font-sans font-semibold leading-tight" style="color: var(--app-text);">Calendar</p>
			</div>
		</div>

		<!-- Channels -->
		<div class="px-4 py-3 border-b" style="border-color: var(--app-border);">
			<div class="flex items-center justify-between mb-2.5">
				<p class="text-[10px] font-sans uppercase tracking-widest font-medium" style="color: var(--app-text-3);">Channels</p>
				<button onclick={() => (showAddChannel = true)}
					class="cal-chip-btn violet flex items-center gap-1">
					<Plus size={11} /> Add
				</button>
			</div>

			{#if connectionsError}
				<div class="rounded-xl border p-2.5 mb-2.5" style="background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.18);">
					<p class="text-[11px] font-sans" style="color: rgba(248,113,113,.9);">{connectionsError}</p>
				</div>
			{/if}

			{#if userId && connected.length === 0 && !connectionsError}
				<div class="rounded-xl border p-2.5 mb-2.5" style="background: var(--app-surface-3); border-color: var(--app-border);">
					<p class="text-xs font-sans" style="color: var(--app-text-2);">No connected channels yet.</p>
					<p class="text-[11px] font-sans mt-1 leading-relaxed" style="color: var(--app-text-3);">
						If you just connected Meta, make sure `SUPABASE_SERVICE_KEY` is valid so the server can save `social_connections`.
					</p>
				</div>
			{/if}

			<div class="flex flex-col gap-1.5">
				{#each connected as id (id)}
					{@const ch = channelById(id)}
					<div
						role="button"
						tabindex="0"
						onclick={() => toggleConnected(id)}
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleConnected(id)}
						class="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors text-left"
						style="border-color: var(--app-border); background: var(--app-surface-3);"
					>
						<div class="w-9 h-9 rounded-xl border flex items-center justify-center" style="background: var(--app-surface-2); border-color: var(--app-border);">
							<div class="opacity-90">{@html ch?.icon(true) ?? ''}</div>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-sans truncate" style="color: var(--app-text);">{ch?.label ?? id}</p>
							<p class="text-[10px] font-sans truncate" style="color: var(--app-text-3);">{ch?.kind ?? 'channel'}</p>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-2 h-2 rounded-full {ch ? ch.accent : 'bg-white/30'}"></div>
							<button
								onclick={(e) => { e.stopPropagation(); void disconnectChannel(id); }}
								class="w-7 h-7 rounded-lg border flex items-center justify-center transition-all"
								style="background: transparent; border-color: var(--app-border); color: var(--app-text-3);"
								aria-label={`Disconnect ${ch?.label ?? id}`}
								title="Disconnect"
							>
								<X size={13} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Drafts -->
		<div class="px-4 py-3 flex-1 overflow-auto">
			<div class="flex items-center justify-between mb-2.5">
				<p class="text-[10px] font-sans uppercase tracking-widest font-medium" style="color: var(--app-text-3);">Drafts</p>
				<p class="text-[10px] font-sans" style="color: var(--app-text-3);">drag to calendar</p>
			</div>
			<div class="flex flex-col gap-2">
				{#if drafts.length === 0}
					<div class="rounded-xl border p-3" style="background: var(--app-surface-3); border-color: var(--app-border);">
						<p class="text-xs font-sans" style="color: var(--app-text-2);">No drafts yet.</p>
						<p class="text-[11px] font-sans mt-1 leading-relaxed" style="color: var(--app-text-3);">
							Connect a channel to generate starter drafts you can drag onto the calendar.
						</p>
						<button
							onclick={() => (showAddChannel = true)}
							class="mt-3 w-full px-3 py-2 rounded-xl text-xs font-sans cal-chip-btn violet"
						>
							Connect channel
						</button>
					</div>
				{/if}

				{#each drafts as d (d.id)}
					<div role="listitem" class="select-none rounded-xl border overflow-hidden transition-colors" style="border-color: var(--app-border); background: var(--app-surface-3);">
						<!-- Drag handle -->
						<div
							role="button"
							tabindex="0"
							draggable="true"
							ondragstart={(e) => dragStartDraft(e, d.id)}
							class="cursor-grab active:cursor-grabbing px-3 py-2 border-b flex items-center gap-2"
							style="border-color: var(--app-border); background: var(--app-surface-2);"
							title="Drag onto a calendar slot to schedule"
						>
							<GripVertical size={13} style="color: var(--app-text-3);" />
							<p class="text-[10px] font-sans uppercase tracking-widest" style="color: var(--app-text-3);">Drag to schedule</p>
						</div>

						<div class="p-3">
							<div class="flex items-start justify-between gap-2 mb-2">
								<p class="text-xs font-sans" style="color: var(--app-text);">{d.title}</p>
								<div class="flex items-center gap-1.5 shrink-0 flex-wrap">
									<button
										onclick={(e) => { e.stopPropagation(); deleteDraft(d.id); }}
										class="w-6 h-6 rounded-lg border flex items-center justify-center transition-all"
										style="background: transparent; border-color: var(--app-border); color: var(--app-text-3);"
										aria-label="Delete draft"
									>
										<X size={12} />
									</button>
									<button
										onclick={(e) => { e.stopPropagation(); void postNow(d); }}
										class="cal-chip-btn green"
										title="Publish immediately"
									>
										Post now
									</button>
									<button
										onclick={(e) => { e.stopPropagation(); void pickTimeAndSchedule(d); }}
										class="cal-chip-btn cyan"
										title="Schedule without dragging"
									>
										Pick time
									</button>
									<span class="text-[9px] font-sans px-2 py-1 rounded-lg border {igTypePillClass(d.igType)}">
										{igTypeLabel(d.igType)}
									</span>
								</div>
							</div>
							{#if (d.images?.length ?? 0) > 0}
								<div class="mb-2">
									<div class="flex items-center justify-between">
										<p class="text-[10px] font-sans uppercase tracking-widest" style="color: var(--app-text-3);">Preview</p>
										<button
											type="button"
											onclick={(e) => { e.stopPropagation(); openLightbox(d.images ?? [], 0, d.title); }}
											class="text-[10px] font-sans transition-colors"
											style="color: var(--color-violet);"
										>
											Open →
										</button>
									</div>
									<div class="mt-2 flex items-center gap-2 overflow-x-auto pb-1" style="scrollbar-width: thin;">
										{#each (d.images ?? []).slice(0, 8) as src, i (src + ':' + i)}
											<button
												type="button"
												onclick={(e) => { e.stopPropagation(); openLightbox(d.images ?? [], i, d.title); }}
												class="shrink-0 relative w-12 h-12 rounded-xl overflow-hidden border hover:opacity-95 transition-opacity"
												style="border-color: var(--app-border); background: var(--app-surface-2);"
												title="Click to preview"
											>
												<img src={src} alt={`Draft image ${i + 1}`} class="w-full h-full object-cover" />
												<div class="absolute bottom-1 left-1 text-[9px] font-sans px-1.5 py-0.5 rounded-md bg-black/55 text-white/80">
													{i + 1}
												</div>
											</button>
										{/each}
										{#if (d.images?.length ?? 0) > 8}
											<div class="shrink-0 text-[10px] font-sans px-2" style="color: var(--app-text-3);">+{(d.images?.length ?? 0) - 8}</div>
										{/if}
									</div>
								</div>
							{/if}
							<div class="flex items-center justify-between gap-2 mb-2">
								<p class="text-[10px] font-sans uppercase tracking-widest" style="color: var(--app-text-3);">IG type</p>
								<select
									value={d.igType}
									onchange={(e) => {
										const v = (e.target as HTMLSelectElement).value as IgContentType;
										drafts = drafts.map((x) => (x.id === d.id ? { ...x, igType: v } : x));
									}}
									class="cal-select"
								>
									<option value="post">Post</option>
									<option value="reel">Reel</option>
									<option value="carousel">Carousel</option>
									<option value="story">Story (manual)</option>
								</select>
							</div>
							<div class="flex items-center gap-1.5 flex-wrap">
								{#each d.channels as cid (cid)}
									{@const c = channelById(cid)}
									<span class="text-[9px] font-sans px-2 py-1 rounded-lg border flex items-center gap-1.5" style="border-color: var(--app-border); color: var(--app-text-2);">
										<span class="w-1.5 h-1.5 rounded-full {c?.accent ?? 'bg-white/30'}"></span>
										{c?.label ?? cid}
									</span>
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</aside>

	<!-- ═══ MAIN CALENDAR AREA ═══════════════════════════════════════════════ -->
	<main class="flex-1 overflow-hidden flex flex-col" style="background: var(--app-bg);">

		<!-- ── Top banners ── -->
		{#if metaBanner}
			<div class="px-5 pt-3 pb-0">
				<div class="rounded-xl border p-3 text-sm font-sans flex items-start justify-between gap-3
					{metaBanner.kind === 'error'
						? 'bg-red-500/8 border-red-500/20 text-red-400'
						: 'bg-emerald-500/8 border-emerald-500/20 text-emerald-500'}">
					<p class="min-w-0 text-[13px]">{metaBanner.message}</p>
					<button
						onclick={() => (metaBanner = null)}
						class="cal-icon-btn shrink-0"
						aria-label="Dismiss"
					>
						<X size={13} />
					</button>
				</div>
			</div>
		{/if}

		{#if studioExportPreview.length > 0}
			<div class="px-5 pt-3">
				<div class="rounded-xl border p-4" style="background: var(--app-surface-2); border-color: var(--app-border);">
					<p class="text-[10px] font-sans uppercase tracking-widest mb-1" style="color: var(--app-text-3);">Ready to upload</p>
					<p class="text-sm font-sans font-semibold" style="color: var(--app-text);">
						{studioExportPreview.length} PNG{studioExportPreview.length === 1 ? '' : 's'} exported from Studio
					</p>
					<div class="mt-3 flex items-center gap-2 overflow-x-auto pb-1" style="scrollbar-width: thin;">
						{#each studioExportPreview as src, i (i)}
							<button
								type="button"
								onclick={() => openLightbox(studioExportPreview, i, 'Studio export')}
								class="shrink-0 relative w-14 h-14 rounded-xl overflow-hidden border hover:opacity-95 transition-opacity"
								style="border-color: var(--app-border);"
								title="Click to preview"
							>
								<img src={src} alt={`Slide ${i + 1}`} class="w-full h-full object-cover" />
								<div class="absolute bottom-1 left-1 text-[9px] font-sans px-1.5 py-0.5 rounded-md bg-black/55 text-white/80">{i + 1}</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		{#if recentPosts.length > 0}
			<div class="px-5 pt-3">
				<details class="rounded-xl border p-3" style="background: var(--app-surface-2); border-color: var(--app-border);">
					<summary class="cursor-pointer text-[10px] font-sans uppercase tracking-widest flex items-center justify-between" style="color: var(--app-text-2);">
						<span>Recent activity (last 10)</span>
						<span class="normal-case" style="color: var(--app-text-3);">click to toggle</span>
					</summary>
					<div class="mt-3 space-y-2">
						{#each recentPosts as r (r.id)}
							<div class="flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-[12px] font-sans" style="border-color: var(--app-border); background: var(--app-surface-3);">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class={
											r.status === 'published' ? 'text-emerald-500' :
											r.status === 'failed' ? 'text-red-500' :
											r.status === 'publishing' ? 'text-amber-500' :
											r.status === 'cancelled' ? 'text-gray-400' :
											'text-sky-500'
										}>● {r.status}</span>
										<span style="color: var(--app-text-3);">·</span>
										<span class="truncate" style="color: var(--app-text);">{r.title}</span>
									</div>
									<p class="text-[11px] mt-0.5" style="color: var(--app-text-3);">
										scheduled: {new Date(r.scheduled_at).toLocaleString()}
										{#if r.published_at} · published: {new Date(r.published_at).toLocaleString()}{/if}
									</p>
									{#if r.last_error}
										<p class="text-[11px] text-red-500 mt-1 whitespace-pre-wrap break-words">error: {r.last_error}</p>
									{/if}
								</div>
								<button
									type="button"
									onclick={async () => {
										const when = new Date(r.scheduled_at);
										anchor = when;
										await tick();
										scrollCalendarToHour(when.getHours());
									}}
									class="cal-chip-btn cyan shrink-0 whitespace-nowrap"
									title="Jump calendar to this time"
								>
									show →
								</button>
							</div>
						{/each}
					</div>
					<button
						type="button"
						onclick={() => loadRecentPosts()}
						class="mt-3 px-3 py-1.5 rounded-lg border text-[11px] font-sans transition-colors"
						style="background: var(--app-surface-3); border-color: var(--app-border); color: var(--app-text-2);"
					>
						Refresh
					</button>
				</details>
			</div>
		{/if}

		<!-- ── Calendar toolbar (Postiz style) ── -->
		<div class="px-5 py-3 flex items-center justify-between border-b shrink-0" style="border-color: var(--app-border);">
			<!-- Left: month + nav -->
			<div class="flex items-center gap-2">
				<div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: var(--app-surface-3);">
					<Calendar size={15} style="color: var(--app-text-2);" />
				</div>
				<span class="text-[15px] font-sans font-semibold" style="color: var(--app-text);">{fmtMonth(anchor)}</span>
				<div class="flex items-center gap-1 ml-2">
					<button onclick={prev} class="cal-icon-btn" aria-label="Previous">
						<ChevronLeft size={15} />
					</button>
					<button onclick={today} class="px-2.5 py-1 rounded-lg text-[11px] font-sans transition-colors" style="background: var(--app-surface-3); color: var(--app-text-2);">Today</button>
					<button onclick={next} class="cal-icon-btn" aria-label="Next">
						<ChevronRight size={15} />
					</button>
				</div>
			</div>

			<!-- Right: view switcher + loading -->
			<div class="flex items-center gap-3">
				{#if loadingPosts}
					<span class="text-[11px] font-sans" style="color: var(--app-text-3);">Loading…</span>
				{/if}
				{#if postsError}
					<span class="text-[11px] font-sans text-red-500">{postsError}</span>
				{/if}
				<div class="flex items-center rounded-lg overflow-hidden border" style="border-color: var(--app-border); background: var(--app-surface-2);">
					<button onclick={() => (view = 'day')} class="px-3 py-1.5 text-[12px] font-sans transition-colors {view === 'day' ? 'cal-view-active' : 'cal-view-inactive'}">Day</button>
					<button onclick={() => (view = 'week')} class="px-3 py-1.5 text-[12px] font-sans transition-colors border-l border-r {view === 'week' ? 'cal-view-active' : 'cal-view-inactive'}" style="border-color: var(--app-border);">Week</button>
					<button onclick={() => (view = 'month')} class="px-3 py-1.5 text-[12px] font-sans transition-colors {view === 'month' ? 'cal-view-active' : 'cal-view-inactive'}">Month</button>
				</div>
			</div>
		</div>

		<!-- ── Calendar body ── -->
		<div bind:this={calendarScrollEl} class="flex-1 overflow-auto">
			<div class="min-w-[860px]">
				<!-- ════ MONTH VIEW ════ -->
				{#if view === 'month'}
					<!-- Day-of-week headers (sticky) -->
					<div class="grid grid-cols-7 sticky top-0 z-20">
						{#each ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as wd (wd)}
							<div class="h-[62px] flex items-center justify-center rounded-lg m-0.5" style="background: var(--app-surface-3);">
								<p class="text-[13px] font-sans font-medium" style="color: var(--app-text-2);">{wd}</p>
							</div>
						{/each}
					</div>
					<!-- Month cells -->
					<div class="grid grid-cols-7">
						{#each monthDays as d (d.toISOString())}
							{@const inMonth = d.getMonth() === anchor.getMonth()}
							{@const isToday = d.toDateString() === new Date().toDateString()}
							{@const dayPosts = postsForDay(d)}
							<div
								role="presentation"
								class="relative border-b border-r min-h-[110px] transition-colors"
								style="
									border-color: {calLine};
									background: {isToday ? 'color-mix(in oklab, var(--color-violet) 5%, var(--app-bg))' : inMonth ? 'var(--app-bg)' : 'var(--app-surface-2)'};
								"
								ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }}
								ondrop={(e) => dropToSlot(e, d, 9)}
							>
								<!-- Day number -->
								<div class="pt-2 px-2 pb-1">
									<span
										class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-sans font-medium"
										style="
											background: {isToday ? 'var(--color-violet)' : 'transparent'};
											color: {isToday ? '#fff' : inMonth ? 'var(--app-text-2)' : 'var(--app-text-3)'};
										"
									>{fmtDayNum(d)}</span>
								</div>
								<!-- Posts -->
								<div class="px-1.5 pb-2 flex flex-col gap-1">
									{#each dayPosts.slice(0, 3) as p (p.id)}
										{@const isDone = p.status === 'published'}
										{@const isFailed = p.status === 'failed'}
										<div
											class="rounded-[6px] overflow-hidden border cursor-pointer group"
											style="border-color: {isDone ? 'rgba(34,197,94,.3)' : isFailed ? 'rgba(239,68,68,.3)' : 'rgba(139,92,246,.3)'};"
											title={p.title}
										>
											<div class="h-1.5 w-full" style="background: {isDone ? 'rgb(34,197,94)' : isFailed ? 'rgb(239,68,68)' : 'var(--color-violet)'};"></div>
											<div class="px-2 py-1" style="background: {isDone ? 'rgba(34,197,94,.06)' : isFailed ? 'rgba(239,68,68,.06)' : 'rgba(139,92,246,.06)'};">
												<p class="text-[11px] font-sans leading-tight line-clamp-1" style="color: var(--app-text);">{p.title}</p>
											</div>
										</div>
									{/each}
									{#if dayPosts.length > 3}
										<p class="text-[10px] font-sans px-1" style="color: var(--app-text-3);">+{dayPosts.length - 3} more</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>

				<!-- ════ DAY VIEW ════ -->
				{:else if view === 'day'}
					{@const isDayToday = dayOnly.toDateString() === new Date().toDateString()}
					<!-- Sticky header -->
					<div class="grid sticky top-0 z-20" style="grid-template-columns: 80px 1fr;">
						<div class="h-[62px]"></div>
						<div class="h-[62px] rounded-lg m-0.5 flex flex-col items-center justify-center" style="background: {isDayToday ? 'color-mix(in oklab, var(--color-violet) 12%, var(--app-surface-3))' : 'var(--app-surface-3)'};">
							<p class="text-[13px] font-sans font-medium" style="color: var(--app-text-2);">{fmtDayLabel(dayOnly)}</p>
							<div class="flex items-center gap-1.5">
								{#if isDayToday}<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-violet);"></div>{/if}
								<p class="text-[14px] font-sans font-semibold" style="color: {isDayToday ? 'var(--color-violet)' : 'var(--app-text)'};">{dayOnly.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
							</div>
						</div>
					</div>
					<!-- Hour rows -->
					<div class="grid" style="grid-template-columns: 80px 1fr;">
						{#each hours as hr (hr)}
							{@const slotPosts = postsForDay(dayOnly)
								.filter(p => new Date(p.startISO).getHours() === hr)
								.sort((a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime())}
							<!-- Time label -->
							<div class="h-20 pr-3 flex items-center justify-end border-b" style="border-color: {calLine};">
								<span class="text-[11px] font-sans" style="color: var(--app-text-3);">{hr === 12 ? '12 PM' : hr < 12 ? `${hr}:00` : `${hr - 12}:00`}</span>
							</div>
							<!-- Slot -->
							<div
								role="presentation"
								class="relative h-20 border-b border-l transition-colors cal-slot"
								style="border-color: {calLine};"
								ondragover={allowDrop}
								ondrop={(e) => dropToSlot(e, dayOnly, hr)}
							>
								<div class="flex flex-col gap-1 p-1.5 h-full">
									{#each slotPosts as p (p.id)}
										{@const isDone = p.status === 'published'}
										{@const isFailed = p.status === 'failed'}
										{@const isPublishing = p.status === 'publishing'}
										{@const accentColor = isDone ? 'rgb(34,197,94)' : isFailed ? 'rgb(239,68,68)' : isPublishing ? 'rgb(245,158,11)' : 'var(--color-violet)'}
										{@const statusLabel = isDone ? 'Posted' : isFailed ? 'Failed' : isPublishing ? 'Publishing…' : 'Scheduled'}
										<div
											role="button"
											tabindex="0"
											draggable={!isDone && !isFailed && !isPublishing}
											ondragstart={(e) => { if (!isDone && !isFailed && !isPublishing) dragStartPost(e, p.id); }}
											class="cal-post-card group {(!isDone && !isFailed && !isPublishing) ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}"
											style="border-color: color-mix(in oklab, {accentColor} 40%, transparent);"
											title={isFailed && p.lastError ? `Failed: ${p.lastError}\n\n${p.title}` : p.title}
										>
											<!-- Colored header bar -->
											<div class="cal-post-header flex items-center justify-between px-2 py-1 gap-2"
												style="background: {accentColor};">
												<span class="text-[10px] font-sans text-white font-medium truncate">{statusLabel}</span>
												<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													{#if !isDone && !isPublishing}
														<button
															onclick={(e) => {
																e.stopPropagation();
																const msg = isFailed ? 'Remove this failed post?' : 'Unschedule this post?';
																if (confirm(msg)) unschedulePost(p.id);
															}}
															class="w-4 h-4 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-black/20 transition-all"
															aria-label={isFailed ? 'Remove failed post' : 'Unschedule post'}
														>
															<X size={10} />
														</button>
													{/if}
												</div>
											</div>
											<!-- Body -->
											<div class="px-2 py-1.5" style="background: color-mix(in oklab, {accentColor} 8%, var(--app-surface-3));">
												<p class="text-[11px] font-sans leading-tight line-clamp-2" style="color: var(--app-text);">{p.title}</p>
												<div class="flex items-center gap-1 flex-wrap mt-1">
													<span class="text-[9px] font-sans px-1.5 py-0.5 rounded border {igTypePillClass(p.igType)}">{igTypeLabel(p.igType)}</span>
													{#each p.channels as cid (cid)}
														{@const c = channelById(cid)}
														<span class="text-[9px] font-sans px-1.5 py-0.5 rounded border flex items-center gap-1" style="border-color: var(--app-border); color: var(--app-text-2);">
															<span class="w-1 h-1 rounded-full {c?.accent ?? 'bg-white/30'}"></span>
															{c?.label ?? cid}
														</span>
													{/each}
												</div>
											</div>
										</div>
									{/each}
									<!-- Drop zone "+" hint -->
									{#if slotPosts.length === 0}
										<div class="cal-plus-hint flex-1 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity"
											style="border-color: var(--app-border);">
											<span class="text-[20px] font-light" style="color: var(--app-text-3);">+</span>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>

				<!-- ════ WEEK VIEW ════ -->
				{:else}
					<!-- Sticky day headers -->
					<div class="grid sticky top-0 z-20" style="grid-template-columns: 80px repeat(7, minmax(0,1fr));">
						<div class="h-[62px]"></div>
						{#each weekDays as d (d.toISOString())}
							{@const isToday = d.toDateString() === new Date().toDateString()}
							<div class="h-[62px] rounded-lg m-0.5 flex flex-col items-center justify-center"
								style="background: {isToday ? 'color-mix(in oklab, var(--color-violet) 12%, var(--app-surface-3))' : 'var(--app-surface-3)'};">
								<p class="text-[12px] font-sans font-medium" style="color: var(--app-text-2);">{fmtDayLabel(d)}</p>
								<div class="flex items-center gap-1.5 mt-0.5">
									{#if isToday}<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-violet);"></div>{/if}
									<p class="text-[13px] font-sans font-semibold" style="color: {isToday ? 'var(--color-violet)' : 'var(--app-text)'};">{fmtDayNum(d)}</p>
								</div>
							</div>
						{/each}
					</div>

					<!-- Hour rows -->
					<div class="grid" style="grid-template-columns: 80px repeat(7, minmax(0,1fr));">
						{#each hours as hr (hr)}
							<!-- Time label -->
							<div class="h-20 pr-3 flex items-center justify-end border-b" style="border-color: {calLine};">
								<span class="text-[11px] font-sans" style="color: var(--app-text-3);">{hr === 12 ? '12 PM' : hr < 12 ? `${hr}:00` : `${hr - 12}:00`}</span>
							</div>
							<!-- Day slots -->
							{#each weekDays as d (d.toISOString() + ':' + hr)}
								{@const slotPosts = postsForDay(d)
									.filter(p => new Date(p.startISO).getHours() === hr)
									.sort((a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime())}
								<div
									role="presentation"
									class="relative h-20 border-b border-l transition-colors cal-slot"
									style="border-color: {calLine};"
									ondragover={allowDrop}
									ondrop={(e) => dropToSlot(e, d, hr)}
								>
									<div class="flex flex-col gap-0.5 p-1 h-full">
										{#each slotPosts as p (p.id)}
											{@const isDone = p.status === 'published'}
											{@const isFailed = p.status === 'failed'}
											{@const isPublishing = p.status === 'publishing'}
											{@const accentColor = isDone ? 'rgb(34,197,94)' : isFailed ? 'rgb(239,68,68)' : isPublishing ? 'rgb(245,158,11)' : 'var(--color-violet)'}
											{@const statusLabel = isDone ? 'Posted' : isFailed ? 'Failed' : isPublishing ? 'Publishing…' : 'Scheduled'}
											<div
												role="button"
												tabindex="0"
												draggable={!isDone && !isFailed && !isPublishing}
												ondragstart={(e) => { if (!isDone && !isFailed && !isPublishing) dragStartPost(e, p.id); }}
												class="cal-post-card group {(!isDone && !isFailed && !isPublishing) ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}"
												style="border-color: color-mix(in oklab, {accentColor} 40%, transparent);"
												title={isFailed && p.lastError ? `Failed: ${p.lastError}\n\n${p.title}` : p.title}
											>
												<!-- Colored header bar -->
												<div class="cal-post-header flex items-center justify-between px-1.5 gap-1"
													style="background: {accentColor};">
													<span class="text-[9px] font-sans text-white font-medium truncate">{statusLabel}</span>
													<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
														{#if !isDone && !isPublishing}
															<button
																onclick={(e) => {
																	e.stopPropagation();
																	const msg = isFailed ? 'Remove this failed post?' : 'Unschedule this post?';
																	if (confirm(msg)) unschedulePost(p.id);
																}}
																class="w-3.5 h-3.5 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-black/20 transition-all"
															>
																<X size={9} />
															</button>
														{/if}
													</div>
												</div>
												<!-- Body -->
												<div class="px-1.5 py-1" style="background: color-mix(in oklab, {accentColor} 8%, var(--app-surface-3));">
													<p class="text-[10px] font-sans leading-tight line-clamp-2" style="color: var(--app-text);">{p.title}</p>
												</div>
											</div>
										{/each}
										<!-- Drop zone hint -->
										{#if slotPosts.length === 0}
											<div class="cal-plus-hint flex-1 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity"
												style="border-color: var(--app-border);">
												<span class="text-lg font-light" style="color: var(--app-text-3);">+</span>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</main>

	<!-- ═══ LIGHTBOX ═══════════════════════════════════════════════════════== -->
	{#if lightbox.open}
		<div
			role="button"
			tabindex="0"
			class="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm"
			onclick={closeLightbox}
			onkeydown={(e) => {
				if (e.key === 'Escape') closeLightbox();
				if (e.key === 'ArrowLeft') lbPrev();
				if (e.key === 'ArrowRight') lbNext();
			}}
			aria-label="Close preview"
		>
			<div class="absolute inset-0 flex items-center justify-center p-6">
				<div
					role="dialog"
					aria-modal="true"
					class="w-full max-w-5xl rounded-2xl overflow-hidden border"
					style="background: var(--app-surface-2); border-color: var(--app-border);"
					tabindex="-1"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					<div class="px-4 py-3 flex items-center justify-between gap-3 border-b" style="border-color: var(--app-border);">
						<div class="min-w-0">
							<p class="text-[10px] font-sans uppercase tracking-widest" style="color: var(--app-text-3);">Preview</p>
							<p class="text-xs font-sans" style="color: var(--app-text);">
								{lightbox.title ?? 'Images'} · {lightbox.index + 1}/{lightbox.images.length}
							</p>
						</div>
						<button type="button" onclick={closeLightbox} class="cal-icon-btn" aria-label="Close"><X size={14} /></button>
					</div>
					<div class="relative" style="background: rgba(0,0,0,.3);">
						<button type="button" onclick={lbPrev}
							class="absolute left-3 top-1/2 -translate-y-1/2 cal-icon-btn" aria-label="Previous image">
							<ChevronLeft size={18} />
						</button>
						<button type="button" onclick={lbNext}
							class="absolute right-3 top-1/2 -translate-y-1/2 cal-icon-btn" aria-label="Next image">
							<ChevronRight size={18} />
						</button>
						<img src={lightbox.images[lightbox.index]} alt="Preview" class="w-full max-h-[78vh] object-contain block" />
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- ═══ ADD CHANNEL MODAL ════════════════════════════════════════════════ -->
	{#if showAddChannel}
		<div
			role="button"
			tabindex="0"
			class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
			onclick={() => (showAddChannel = false)}
			onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showAddChannel = false)}
			aria-label="Close add channel modal"
		>
			<div class="absolute inset-0 flex items-start justify-center pt-24 px-4">
				<div
					role="dialog"
					aria-modal="true"
					class="w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden"
					style="background: var(--app-surface-2); border-color: var(--app-border);"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					tabindex="-1"
				>
					<div class="px-5 py-4 border-b flex items-center justify-between" style="border-color: var(--app-border);">
						<p class="text-sm font-sans font-semibold" style="color: var(--app-text);">Add Channel</p>
						<button onclick={() => (showAddChannel = false)}
							class="cal-icon-btn"
							aria-label="Close">
							<X size={16} />
						</button>
					</div>

					<div class="p-5">
						<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
							{#each CHANNELS as ch (ch.id)}
								<button
									onclick={() =>
										ch.id === 'instagramBusiness'
											? connectInstagramBusiness()
											: ch.id === 'facebookPage'
												? connectFacebookPages()
												: ch.id === 'tiktok'
													? connectTiktokZernio()
											: ch.id === 'linkedin'
												? connectLinkedIn('member')
												: ch.id === 'linkedinPage'
													? connectLinkedIn('org')
													: ch.id === 'gmb'
														? connectGmb()
													: toggleConnected(ch.id)
									}
									class="group rounded-2xl border hover:bg-white/3 transition-colors p-3 flex flex-col items-center gap-2"
									style="background: var(--app-surface-3); border-color: var(--app-border);"
								>
									<div class="w-11 h-11 rounded-2xl border flex items-center justify-center" style="background: var(--app-surface-2); border-color: var(--app-border);">
										<div>{@html ch.icon(connected.includes(ch.id))}</div>
									</div>
									<p class="text-[10px] font-sans text-center leading-tight" style="color: var(--app-text-2);">{ch.label}</p>
									<p class="text-[9px] font-sans" style="color: var(--app-text-3);">{connected.includes(ch.id) ? 'Connected' : 'Connect'}</p>
								</button>
							{/each}
						</div>
						<p class="mt-4 text-[11px] font-sans" style="color: var(--app-text-3);">Facebook, Instagram, and TikTok connect via <a class="underline hover:opacity-80" href="https://docs.zernio.com/" style="color: var(--color-violet);">Zernio</a> (server needs ZERNIO_API_KEY and PUBLIC_APP_URL).</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ── Icon button ── */
	:global(.cal-icon-btn) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid var(--app-border);
		background: var(--app-surface-3);
		color: var(--app-text-2);
		transition: background 0.15s, color 0.15s;
		cursor: pointer;
	}
	:global(.cal-icon-btn:hover) {
		background: color-mix(in oklab, var(--app-text) 8%, transparent);
		color: var(--app-text);
	}

	/* ── Chip buttons ── */
	:global(.cal-chip-btn) {
		padding: 3px 8px;
		border-radius: 8px;
		border: 1px solid var(--app-border);
		font-size: 10px;
		font-family: var(--font-sans);
		background: var(--app-surface-3);
		color: var(--app-text-2);
		cursor: pointer;
		transition: background 0.15s;
		white-space: nowrap;
	}
	:global(.cal-chip-btn.violet) {
		background: rgba(139,92,246,.12);
		border-color: rgba(139,92,246,.25);
		color: #a78bfa;
	}
	:global(.cal-chip-btn.violet:hover) { background: rgba(139,92,246,.18); }
	:global(.cal-chip-btn.green) {
		background: rgba(34,197,94,.10);
		border-color: rgba(34,197,94,.25);
		color: #4ade80;
	}
	:global(.cal-chip-btn.green:hover) { background: rgba(34,197,94,.16); }
	:global(.cal-chip-btn.cyan) {
		background: rgba(6,182,212,.10);
		border-color: rgba(6,182,212,.25);
		color: #22d3ee;
	}
	:global(.cal-chip-btn.cyan:hover) { background: rgba(6,182,212,.16); }

	/* ── Select ── */
	:global(.cal-select) {
		background: var(--app-surface-3);
		border: 1px solid var(--app-border);
		border-radius: 8px;
		padding: 3px 8px;
		font-size: 10px;
		font-family: var(--font-sans);
		color: var(--app-text-2);
		cursor: pointer;
		outline: none;
		transition: border-color 0.15s;
	}
	:global(.cal-select:focus) { border-color: rgba(139,92,246,.5); }

	/* ── View switcher active/inactive ── */
	:global(.cal-view-active) {
		background: rgba(139,92,246,.15);
		color: #a78bfa;
	}
	:global(.cal-view-inactive) {
		background: transparent;
		color: var(--app-text-2);
	}
	:global(.cal-view-inactive:hover) {
		background: color-mix(in oklab, var(--app-text) 5%, transparent);
		color: var(--app-text);
	}

	/* ── Calendar slot hover ── */
	:global(.cal-slot:hover) {
		background: color-mix(in oklab, var(--app-text) 2%, transparent);
	}

	/* ── "+" hint on empty slots ── */
	:global(.cal-plus-hint) {
		border: 1px dashed transparent;
		transition: opacity 0.15s, border-color 0.15s;
	}
	:global(.cal-slot:hover .cal-plus-hint) {
		opacity: 1 !important;
		border-color: var(--app-border-hover);
	}

	/* ── Post card (Postiz style) ── */
	:global(.cal-post-card) {
		border-radius: 8px;
		border: 1px solid transparent;
		overflow: hidden;
		flex-shrink: 0;
	}
	:global(.cal-post-header) {
		min-height: 22px;
	}

	/* Light theme overrides – keep text readable when app-text is dark */
	:global(:root:not([data-theme="dark"]) .scheduler-root) {
		--calLine: rgba(10,10,10,.08);
	}

</style>

