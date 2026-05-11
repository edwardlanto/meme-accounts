<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { authFetch } from '$lib/authFetch';

	type TestImage = { name: string; publicPath: string; publicUrl?: string; dataUrl: string };
	type TestVideo = { name: string; publicPath: string; publicUrl?: string; serverPath: string; sizeBytes: number };
	type DbSocialConnection = {
		id: string;
		user_id: string;
		provider: string;
		provider_account_id: string;
		provider_account_label: string;
		access_token: string;
		scopes?: string[] | null;
		meta: any;
	};

	let loading = $state(true);
	let error = $state('');
	let info = $state('');
	let posting = $state(false);
	let postingVideos = $state(false);
	let postingSinglePhoto = $state(false);
	let postingSingleVideo = $state(false);
	let lastResult = $state<any>(null);

	let userId = $state('');
	let fbConn = $state<DbSocialConnection | null>(null);
	let igConn = $state<DbSocialConnection | null>(null);
	let ttConn = $state<DbSocialConnection | null>(null);
	let images = $state<TestImage[]>([]);
	let videos = $state<TestVideo[]>([]);
	let publicBaseUrl = $state('');
	let publicBaseReady = $state(false);

	let message = $state(`Carousel test from Social Poster — ${new Date().toLocaleString()}`);
	let imageCaptions = $state<string[]>([]);
	let videoCaptions = $state<string[]>([]);
	// How to publish the multi-image set:
	//   'carousel'   = single FB post, slide captions merged into the post message
	//   'individual' = N separate FB posts, each photo with its own caption in the feed
	let imagesMode = $state<'carousel' | 'individual'>('carousel');

	// Single-post selections
	let singlePhotoIndex = $state(0);
	let singlePhotoMessage = $state(`Single photo test — ${new Date().toLocaleString()}`);
	let singleVideoIndex = $state(0);
	let singleVideoMessage = $state(`Single video test — ${new Date().toLocaleString()}`);

	// Reel / Story selections
	let reelVideoIndex = $state(0);
	let reelDescription = $state(`Reel test — ${new Date().toLocaleString()}`);
	let storyPhotoIndex = $state(0);
	let storyVideoIndex = $state(0);
	let postingReel = $state(false);
	let postingPhotoStory = $state(false);
	let postingVideoStory = $state(false);

	// --- Instagram selections ---
	let igImageIndex = $state(0);
	let igImageCaption = $state(`IG photo test — ${new Date().toLocaleString()}`);
	let igCarouselCaption = $state(`IG carousel test — ${new Date().toLocaleString()}`);
	// which test images to include in IG carousel (defaults to all)
	let igCarouselSelected = $state<Record<string, boolean>>({});
	let igReelVideoIndex = $state(0);
	let igReelCaption = $state(`IG reel test — ${new Date().toLocaleString()}`);
	let igStoryImageIndex = $state(0);
	let igStoryVideoIndex = $state(0);
	let postingIgImage = $state(false);
	let postingIgCarousel = $state(false);
	let postingIgReel = $state(false);
	let postingIgStoryImage = $state(false);
	let postingIgStoryVideo = $state(false);

	// --- TikTok state ---
	let ttVideoIndex = $state(0);
	let ttTitle = $state(`TikTok test — ${new Date().toLocaleString()}`);
	let ttPrivacy = $state<'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'>('SELF_ONLY');
	let postingTikTok = $state(false);
	let ttLastPublishId = $state('');

	function formatBytes(n: number) {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}

	onMount(async () => {
		error = '';
		loading = true;
		try {
			const { data } = await supabase.auth.getUser();
			userId = data.user?.id ?? '';
			if (!userId) {
				goto('/login');
				return;
			}

			const { data: conns, error: connErr } = await (supabase as any)
				.from('social_connections')
				.select('id,user_id,provider,provider_account_id,provider_account_label,access_token,scopes,meta')
				.eq('user_id', userId)
				.eq('provider', 'zernio');
			if (connErr) throw connErr;
			const all = (conns ?? []) as DbSocialConnection[];
			fbConn = all.find((c) => String(c.meta?.platform ?? '') === 'facebook') ?? null;
			igConn = all.find((c) => String(c.meta?.platform ?? '') === 'instagram') ?? null;
			ttConn = all.find((c) => String(c.meta?.platform ?? '') === 'tiktok') ?? null;

			const [imgRes, vidRes] = await Promise.all([
				fetch('/api/post-tests/images').then((r) => r.json()),
				fetch('/api/post-tests/videos').then((r) => r.json()),
			]);
			if (!imgRes?.ok) throw new Error(imgRes?.error ?? 'Failed to load post-test images');
			images = (imgRes.items ?? []) as TestImage[];
			imageCaptions = images.map((img, i) => `Slide ${i + 1} caption — ${img.name}`);
			publicBaseUrl = String(imgRes.publicBaseUrl ?? '');
			publicBaseReady = Boolean(imgRes.publicBaseReady);
			// default IG carousel selection: all images
			igCarouselSelected = Object.fromEntries(images.map((im) => [im.name, true]));

			if (vidRes?.ok) {
				videos = (vidRes.items ?? []) as TestVideo[];
				videoCaptions = videos.map((v, i) => `Video ${i + 1} caption — ${v.name}`);
			}
		} catch (e: any) {
			error = e?.message ?? 'Unknown error';
		} finally {
			loading = false;
		}
	});

	async function schedulePost() {
		error = '';
		info = '';
		lastResult = null;
		if (!userId || !fbConn) {
			error = 'Not signed in or no Facebook Page connection.';
			return;
		}
		if (!images.length) {
			error = 'No images loaded.';
			return;
		}
		posting = true;
		info = 'Scheduling…';
		try {
			const when = new Date(Date.now() + 60_000);
			const res = await authFetch('/api/scheduler/schedule', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userId,
					connectionProvider: 'zernio',
					connectionProviderAccountId: fbConn.provider_account_id,
					scheduledAt: when.toISOString(),
					content: {
						title: imagesMode === 'individual'
							? `Carousel (individual) — ${images.length} posts · ${new Date().toLocaleTimeString()}`
							: `Carousel (one post) — ${images.length} slides · ${new Date().toLocaleTimeString()}`,
						message,
						images: images.map((x) => x.dataUrl),
						imageCaptions,
						imagesMode,
					},
				}),
			});
			const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
			lastResult = { status: res.status, data };
			if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
			const newId = String(data?.post?.id ?? '');
			await goto(`/dashboard/post-scheduler?from=post-tests&scheduled=1${newId ? `&postId=${encodeURIComponent(newId)}` : ''}`);
		} catch (e: any) {
			console.error('[post-tests] schedule error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			posting = false;
		}
	}

	async function postNow() {
		error = '';
		info = '';
		lastResult = null;
		if (!userId || !fbConn) {
			error = 'Not signed in or no Facebook Page connection.';
			return;
		}
		if (!images.length) {
			error = 'No images loaded.';
			return;
		}
		posting = true;
		info = `Posting ${images.length} image(s) to Facebook…`;
		try {
			const res = await authFetch('/api/publish/facebook', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userId,
					pageProviderAccountId: fbConn.provider_account_id,
					content: {
						message,
						images: images.map((x) => x.dataUrl),
						imageCaptions,
						imagesMode,
					},
				}),
			});
			const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
			lastResult = { status: res.status, data };
			if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Post failed (${res.status})`);
			const postId = data?.result?.id ?? data?.result?.post_id ?? '';
			info = `Posted to Facebook. ${postId ? `post_id=${postId}` : ''}`;
		} catch (e: any) {
			console.error('[post-tests] post error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			posting = false;
		}
	}

	async function postVideosNow() {
		error = '';
		info = '';
		lastResult = null;
		if (!userId || !fbConn) {
			error = 'Not signed in or no Facebook Page connection.';
			return;
		}
		if (!videos.length) {
			error = 'No videos loaded from static/post-tests/video.';
			return;
		}
		postingVideos = true;
		info = `Uploading ${videos.length} video(s) to Facebook (one post each)…`;
		try {
			const res = await authFetch('/api/publish/facebook', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userId,
					pageProviderAccountId: fbConn.provider_account_id,
					content: {
						message,
						videos: videos.map((v, i) => ({
							serverPath: v.serverPath,
							description: videoCaptions[i] || '',
						})),
					},
				}),
			});
			const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
			lastResult = { status: res.status, data };
			if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Video post failed (${res.status})`);
			info = `Uploaded ${data.count ?? videos.length} video(s). Note: Facebook does not support video carousels — each video is its own post.`;
		} catch (e: any) {
			console.error('[post-tests] video post error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingVideos = false;
		}
	}

	async function postSinglePhoto(mode: 'now' | 'schedule') {
		error = '';
		info = '';
		lastResult = null;
		if (!userId || !fbConn) {
			error = 'Not signed in or no Facebook Page connection.';
			return;
		}
		const pic = images[singlePhotoIndex];
		if (!pic) {
			error = 'No image selected.';
			return;
		}
		postingSinglePhoto = true;
		info = mode === 'now' ? 'Posting single photo to Facebook…' : 'Scheduling single photo…';
		try {
			if (mode === 'now') {
				const res = await authFetch('/api/publish/facebook', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						userId,
						pageProviderAccountId: fbConn.provider_account_id,
						content: { message: singlePhotoMessage, images: [pic.dataUrl] },
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Post failed (${res.status})`);
				const postId = data?.result?.id ?? data?.result?.post_id ?? '';
				info = `Posted single photo to Facebook. ${postId ? `post_id=${postId}` : ''}`;
			} else {
				const when = new Date(Date.now() + 60_000);
				const res = await authFetch('/api/scheduler/schedule', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						userId,
						connectionProvider: 'zernio',
						connectionProviderAccountId: fbConn.provider_account_id,
						scheduledAt: when.toISOString(),
					content: {
						title: `Single photo — ${pic.name} · ${new Date().toLocaleTimeString()}`,
						message: singlePhotoMessage,
						images: [pic.dataUrl],
					},
				}),
			});
			const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
			lastResult = { status: res.status, data };
			if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
			const newId = String(data?.post?.id ?? '');
			await goto(`/dashboard/post-scheduler?from=post-tests&scheduled=1${newId ? `&postId=${encodeURIComponent(newId)}` : ''}`);
		}
		} catch (e: any) {
			console.error('[post-tests] single photo error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingSinglePhoto = false;
		}
	}

	async function postSingleVideo(mode: 'now' | 'schedule') {
		error = '';
		info = '';
		lastResult = null;
		if (!userId || !fbConn) {
			error = 'Not signed in or no Facebook Page connection.';
			return;
		}
		const vid = videos[singleVideoIndex];
		if (!vid) {
			error = 'No video selected.';
			return;
		}
		postingSingleVideo = true;
		info = mode === 'now' ? 'Uploading single video to Facebook…' : 'Scheduling single video…';
		try {
			if (mode === 'now') {
				const res = await authFetch('/api/publish/facebook', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						userId,
						pageProviderAccountId: fbConn.provider_account_id,
						content: {
							message: singleVideoMessage,
							videos: [{ serverPath: vid.serverPath, description: singleVideoMessage }],
						},
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Post failed (${res.status})`);
				info = 'Uploaded single video to Facebook. It may take a minute to process before it appears on the Page.';
			} else {
				// Scheduler worker reads the content payload and publishes on time.
				// The worker needs a serverPath relative to `static/`, which we pass through.
				const when = new Date(Date.now() + 60_000);
				const res = await authFetch('/api/scheduler/schedule', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						userId,
						connectionProvider: 'zernio',
						connectionProviderAccountId: fbConn.provider_account_id,
						scheduledAt: when.toISOString(),
						content: {
							title: `Single video — ${vid.name} · ${new Date().toLocaleTimeString()}`,
							message: singleVideoMessage,
							videos: [{ serverPath: vid.serverPath, description: singleVideoMessage }],
						},
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
				const newId = String(data?.post?.id ?? '');
				await goto(`/dashboard/post-scheduler?from=post-tests&scheduled=1${newId ? `&postId=${encodeURIComponent(newId)}` : ''}`);
			}
		} catch (e: any) {
			console.error('[post-tests] single video error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingSingleVideo = false;
		}
	}

	// --- Reel ---
	async function postReel(mode: 'now' | 'schedule') {
		error = '';
		info = '';
		lastResult = null;
		if (!userId || !fbConn) {
			error = 'Not signed in or no Facebook Page connection.';
			return;
		}
		const vid = videos[reelVideoIndex];
		if (!vid) { error = 'No video selected.'; return; }
		postingReel = true;
		info = mode === 'now' ? 'Publishing Reel…' : 'Scheduling Reel…';
		try {
			const content = {
				kind: 'reel',
				title: `Reel — ${vid.name} · ${new Date().toLocaleTimeString()}`,
				reelVideo: { serverPath: vid.serverPath },
				reelDescription,
			};
			if (mode === 'now') {
				const res = await authFetch('/api/publish/facebook', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ pageProviderAccountId: fbConn.provider_account_id, content }),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Reel failed (${res.status})`);
				info = `Reel published. video_id=${data?.videoId ?? ''}`;
			} else {
				const when = new Date(Date.now() + 60_000);
				const res = await authFetch('/api/scheduler/schedule', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						connectionProvider: 'zernio',
						connectionProviderAccountId: fbConn.provider_account_id,
						scheduledAt: when.toISOString(),
						content,
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
				const newId = String(data?.post?.id ?? '');
				await goto(`/dashboard/post-scheduler?from=post-tests&scheduled=1${newId ? `&postId=${encodeURIComponent(newId)}` : ''}`);
			}
		} catch (e: any) {
			console.error('[post-tests] reel error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingReel = false;
		}
	}

	// --- Photo Story ---
	async function postPhotoStory(mode: 'now' | 'schedule') {
		error = '';
		info = '';
		lastResult = null;
		if (!userId || !fbConn) { error = 'Not signed in or no Facebook Page connection.'; return; }
		const pic = images[storyPhotoIndex];
		if (!pic) { error = 'No image selected.'; return; }
		postingPhotoStory = true;
		info = mode === 'now' ? 'Publishing Photo Story…' : 'Scheduling Photo Story…';
		try {
			const content = {
				kind: 'photo_story',
				title: `Photo Story — ${pic.name} · ${new Date().toLocaleTimeString()}`,
				storyPhoto: pic.dataUrl,
			};
			if (mode === 'now') {
				const res = await authFetch('/api/publish/facebook', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ pageProviderAccountId: fbConn.provider_account_id, content }),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Photo Story failed (${res.status})`);
				info = `Photo Story published.`;
			} else {
				const when = new Date(Date.now() + 60_000);
				const res = await authFetch('/api/scheduler/schedule', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						connectionProvider: 'zernio',
						connectionProviderAccountId: fbConn.provider_account_id,
						scheduledAt: when.toISOString(),
						content,
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
				const newId = String(data?.post?.id ?? '');
				await goto(`/dashboard/post-scheduler?from=post-tests&scheduled=1${newId ? `&postId=${encodeURIComponent(newId)}` : ''}`);
			}
		} catch (e: any) {
			console.error('[post-tests] photo story error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingPhotoStory = false;
		}
	}

	// --- Video Story ---
	async function postVideoStory(mode: 'now' | 'schedule') {
		error = '';
		info = '';
		lastResult = null;
		if (!userId || !fbConn) { error = 'Not signed in or no Facebook Page connection.'; return; }
		const vid = videos[storyVideoIndex];
		if (!vid) { error = 'No video selected.'; return; }
		postingVideoStory = true;
		info = mode === 'now' ? 'Publishing Video Story…' : 'Scheduling Video Story…';
		try {
			const content = {
				kind: 'video_story',
				title: `Video Story — ${vid.name} · ${new Date().toLocaleTimeString()}`,
				storyVideo: { serverPath: vid.serverPath },
			};
			if (mode === 'now') {
				const res = await authFetch('/api/publish/facebook', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ pageProviderAccountId: fbConn.provider_account_id, content }),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Video Story failed (${res.status})`);
				info = `Video Story published. video_id=${data?.videoId ?? ''}`;
			} else {
				const when = new Date(Date.now() + 60_000);
				const res = await authFetch('/api/scheduler/schedule', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						connectionProvider: 'zernio',
						connectionProviderAccountId: fbConn.provider_account_id,
						scheduledAt: when.toISOString(),
						content,
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
				const newId = String(data?.post?.id ?? '');
				await goto(`/dashboard/post-scheduler?from=post-tests&scheduled=1${newId ? `&postId=${encodeURIComponent(newId)}` : ''}`);
			}
		} catch (e: any) {
			console.error('[post-tests] video story error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingVideoStory = false;
		}
	}

	function connectZernio(platform: 'facebook' | 'instagram' | 'tiktok') {
		if (!userId) return;
		window.location.href = `/api/auth/zernio/start?platform=${platform}&userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-tests')}`;
	}

	let debugLoading = $state(false);
	let debugData = $state<any>(null);
	let debugError = $state<string | null>(null);

	async function debugMeta() {
		debugLoading = true;
		debugError = null;
		debugData = { note: 'Meta Graph debug was removed. Manage accounts in the Zernio dashboard.' };
		debugLoading = false;
	}

	function connectTikTok() {
		connectZernio('tiktok');
	}

	function ttCanDirectPost(): boolean {
		return true;
	}

	async function postTikTok() {
		error = ''; info = ''; lastResult = null;
		if (!userId) { error = 'Not signed in.'; return; }
		if (!ttConn) { error = 'No TikTok connection. Click "Connect TikTok" above.'; return; }
		if (!publicBaseReady) {
			error = 'PUBLIC_APP_URL is not set to a public HTTPS URL. TikTok cannot fetch localhost — set PUBLIC_APP_URL in your .env (e.g. an ngrok URL) and reload.';
			return;
		}
		const vid = videos[ttVideoIndex];
		if (!vid?.publicUrl) { error = 'Selected video has no public URL.'; return; }

		postingTikTok = true;
		const direct = ttCanDirectPost();
		info = direct
			? 'Uploading to TikTok (direct post)…'
			: 'Uploading to TikTok drafts inbox (open TikTok app → Inbox → Drafts to finish)…';
		try {
			const res = await authFetch('/api/publish/tiktok', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					openId: ttConn.provider_account_id,
					content: {
						videoUrl: vid.publicUrl,
						mode: direct ? 'direct' : 'inbox',
						title: ttTitle,
						privacy: ttPrivacy,
					},
				}),
			});
			const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
			lastResult = { status: res.status, data };
			if (!res.ok || !data?.ok) throw new Error(data?.error ?? `TikTok publish failed (${res.status})`);
			ttLastPublishId = String(data?.result?.post?._id ?? data?.result?.post?.id ?? '');
			info = `TikTok request sent via Zernio (${data?.mode ?? 'direct'}). Check Zernio dashboard for status.`;
		} catch (e: any) {
			console.error('[post-tests] tiktok error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingTikTok = false;
		}
	}

	async function refreshTikTokStatus() {
		info = 'TikTok publish status is tracked in Zernio; local polling was removed.';
	}

	// =========================================================================
	// INSTAGRAM
	// =========================================================================
	// IG Graph API requires public HTTPS URLs for all media — it cannot fetch
	// localhost or accept data URLs. Set PUBLIC_APP_URL in your .env (or use an
	// ngrok tunnel) before running these tests locally.

	function requireIgReady(): string | null {
		if (!userId) return 'Not signed in.';
		if (!igConn) return 'No Instagram connection found. Connect Instagram via Zernio (Business/Creator).';
		if (!publicBaseReady) return 'PUBLIC_APP_URL is not set to a public HTTPS URL. IG Graph API cannot fetch localhost media — set PUBLIC_APP_URL in your .env (e.g. an ngrok URL) and reload.';
		return null;
	}

	async function callIgPublish(content: Record<string, any>) {
		if (!igConn) throw new Error('No IG connection');
		const res = await authFetch('/api/publish/instagram', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ igUserId: igConn.provider_account_id, content }),
		});
		const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
		lastResult = { status: res.status, data };
		if (!res.ok || !data?.ok) throw new Error(data?.error ?? `IG publish failed (${res.status})`);
		return data;
	}

	async function scheduleIg(kind: string, title: string, content: Record<string, any>) {
		if (!igConn) throw new Error('No IG connection');
		const when = new Date(Date.now() + 60_000);
		// Worker expects content.igType + flat imageUrl/videoUrl/children fields.
		// We build that shape here from the richer `/api/publish/instagram` shape.
		const workerContent = buildWorkerIgContent(kind, title, content);
		const res = await authFetch('/api/scheduler/schedule', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				connectionProvider: 'zernio',
				connectionProviderAccountId: igConn.provider_account_id,
				scheduledAt: when.toISOString(),
				content: workerContent,
			}),
		});
		const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
		lastResult = { status: res.status, data };
		if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
		const newId = String(data?.post?.id ?? '');
		await goto(`/dashboard/post-scheduler?from=post-tests&scheduled=1${newId ? `&postId=${encodeURIComponent(newId)}` : ''}`);
	}

	function buildWorkerIgContent(kind: string, title: string, c: Record<string, any>) {
		const base: Record<string, any> = { title, kind: `ig_${kind}` };
		if (kind === 'image') {
			return { ...base, igType: 'post', imageUrl: c.imageUrl, caption: c.caption };
		}
		if (kind === 'reel') {
			return { ...base, igType: 'reel', videoUrl: c.videoUrl, caption: c.caption };
		}
		if (kind === 'carousel') {
			return { ...base, igType: 'carousel', children: c.items ?? [], caption: c.caption };
		}
		if (kind === 'story_image') {
			return { ...base, igType: 'story_image', imageUrl: c.imageUrl };
		}
		if (kind === 'story_video') {
			return { ...base, igType: 'story_video', videoUrl: c.videoUrl };
		}
		return base;
	}

	async function postIgImage(mode: 'now' | 'schedule') {
		error = ''; info = ''; lastResult = null;
		const err = requireIgReady(); if (err) { error = err; return; }
		const img = images[igImageIndex];
		if (!img?.publicUrl) { error = 'Selected image has no public URL.'; return; }
		postingIgImage = true;
		info = mode === 'now' ? 'Publishing IG photo…' : 'Scheduling IG photo…';
		try {
			const content = { kind: 'image', imageUrl: img.publicUrl, caption: igImageCaption };
			if (mode === 'now') {
				const data = await callIgPublish(content);
				info = `IG photo published. media_id=${data?.mediaId ?? ''}`;
			} else {
				await scheduleIg('image', `IG photo — ${img.name}`, content);
			}
		} catch (e: any) {
			console.error('[post-tests] IG image error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingIgImage = false;
		}
	}

	async function postIgCarousel(mode: 'now' | 'schedule') {
		error = ''; info = ''; lastResult = null;
		const err = requireIgReady(); if (err) { error = err; return; }
		const items = images
			.filter((im) => igCarouselSelected[im.name])
			.map((im) => ({ imageUrl: im.publicUrl || '' }))
			.filter((it) => !!it.imageUrl);
		if (items.length < 2 || items.length > 10) {
			error = `IG carousel requires 2–10 items (you have ${items.length}).`;
			return;
		}
		postingIgCarousel = true;
		info = mode === 'now' ? `Publishing IG carousel (${items.length})…` : `Scheduling IG carousel (${items.length})…`;
		try {
			const content = { kind: 'carousel', items, caption: igCarouselCaption };
			if (mode === 'now') {
				const data = await callIgPublish(content);
				info = `IG carousel published. media_id=${data?.mediaId ?? ''}`;
			} else {
				await scheduleIg('carousel', `IG carousel — ${items.length} items`, content);
			}
		} catch (e: any) {
			console.error('[post-tests] IG carousel error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingIgCarousel = false;
		}
	}

	async function postIgReel(mode: 'now' | 'schedule') {
		error = ''; info = ''; lastResult = null;
		const err = requireIgReady(); if (err) { error = err; return; }
		const vid = videos[igReelVideoIndex];
		if (!vid?.publicUrl) { error = 'Selected video has no public URL.'; return; }
		postingIgReel = true;
		info = mode === 'now' ? 'Publishing IG Reel (video may take 30–60s to process)…' : 'Scheduling IG Reel…';
		try {
			const content = { kind: 'reel', videoUrl: vid.publicUrl, caption: igReelCaption, shareToFeed: true };
			if (mode === 'now') {
				const data = await callIgPublish(content);
				info = `IG Reel published. media_id=${data?.mediaId ?? ''}`;
			} else {
				await scheduleIg('reel', `IG reel — ${vid.name}`, content);
			}
		} catch (e: any) {
			console.error('[post-tests] IG reel error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingIgReel = false;
		}
	}

	async function postIgStoryImage(mode: 'now' | 'schedule') {
		error = ''; info = ''; lastResult = null;
		const err = requireIgReady(); if (err) { error = err; return; }
		const img = images[igStoryImageIndex];
		if (!img?.publicUrl) { error = 'Selected image has no public URL.'; return; }
		postingIgStoryImage = true;
		info = mode === 'now' ? 'Publishing IG photo story…' : 'Scheduling IG photo story…';
		try {
			const content = { kind: 'story_image', imageUrl: img.publicUrl };
			if (mode === 'now') {
				const data = await callIgPublish(content);
				info = `IG photo story published. media_id=${data?.mediaId ?? ''}`;
			} else {
				await scheduleIg('story_image', `IG photo story — ${img.name}`, content);
			}
		} catch (e: any) {
			console.error('[post-tests] IG story image error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingIgStoryImage = false;
		}
	}

	async function postIgStoryVideo(mode: 'now' | 'schedule') {
		error = ''; info = ''; lastResult = null;
		const err = requireIgReady(); if (err) { error = err; return; }
		const vid = videos[igStoryVideoIndex];
		if (!vid?.publicUrl) { error = 'Selected video has no public URL.'; return; }
		postingIgStoryVideo = true;
		info = mode === 'now' ? 'Publishing IG video story…' : 'Scheduling IG video story…';
		try {
			const content = { kind: 'story_video', videoUrl: vid.publicUrl };
			if (mode === 'now') {
				const data = await callIgPublish(content);
				info = `IG video story published. media_id=${data?.mediaId ?? ''}`;
			} else {
				await scheduleIg('story_video', `IG video story — ${vid.name}`, content);
			}
		} catch (e: any) {
			console.error('[post-tests] IG story video error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingIgStoryVideo = false;
		}
	}
</script>

<div class="max-w-4xl mx-auto px-6 py-8">
	<div class="flex items-start justify-between gap-4">
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Post tests</p>
			<h1 class="text-xl font-display font-semibold text-white/90 mt-1">Instagram · Facebook · TikTok — post now or schedule</h1>
			<p class="text-sm font-body text-white/45 mt-2 leading-relaxed">
				Posts Instagram, Facebook Page, or TikTok content <em>immediately</em> (or schedules it) using media from <code class="text-white/70">static/post-tests</code>. Direct Graph / Content Posting API calls.
			</p>
		</div>

		<a href="/dashboard/post-scheduler" class="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/60 hover:bg-white/8 transition-colors">
			Open calendar
		</a>
	</div>

	{#if loading}
		<div class="mt-6 rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/60">Loading…</div>
	{:else}
		<!-- SHARED STATUS / MESSAGE -->
		<div class="mt-6 rounded-2xl bg-white/3 border border-white/10 p-4">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0">
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Connections</p>
					<p class="text-sm font-body text-white/80 truncate">
						FB: <span class="text-white/60">{fbConn?.provider_account_label ?? fbConn?.provider_account_id ?? '— not connected'}</span>
					</p>
					<p class="text-sm font-body text-white/80 truncate">
						IG: <span class="text-white/60">{igConn?.provider_account_label ?? igConn?.provider_account_id ?? '— not connected'}</span>
					</p>
					<p class="text-sm font-body text-white/80 truncate">
						TikTok: <span class="text-white/60">{ttConn?.provider_account_label ?? ttConn?.provider_account_id ?? '— not connected'}</span>
					</p>
					<p class="text-[11px] font-body text-white/35 mt-1">Images: {images.length} · Videos: {videos.length}</p>
				</div>
				<button
					type="button"
					onclick={debugMeta}
					disabled={debugLoading || !userId}
					class="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-mono text-white/80 hover:bg-white/10 disabled:opacity-50 transition-colors"
				>
					{debugLoading ? 'Checking…' : 'Debug Meta connection'}
				</button>
			</div>

			{#if debugError}
				<div class="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-mono text-red-300/90 whitespace-pre-wrap wrap-break-word">{debugError}</div>
			{/if}
			{#if debugData}
				<div class="mt-3 rounded-xl bg-white/3 border border-white/10 p-3 space-y-3">
					{#if debugData.hint}
						<p class="text-xs font-body text-amber-200/90">{debugData.hint}</p>
					{/if}
					{#each (debugData.connections ?? []) as c}
						<div class="rounded-xl bg-black/30 border border-white/5 p-3 space-y-2">
							<p class="text-[11px] font-mono text-white/60">
								<span class="text-white/40">Meta user:</span>
								{c.me?.name ?? c.me?.error ?? '—'} <span class="text-white/30">({c.me?.id ?? '—'})</span>
							</p>
							<p class="text-[11px] font-mono text-white/50">
								Stored: <span class="text-white/70">{c.label ?? c.providerAccountId}</span> · kind: <span class="text-white/70">{c.metaKind ?? '—'}</span>
							</p>
							<p class="text-[11px] font-mono text-white/50">
								Scopes (Graph): <span class="text-white/70">{Array.isArray(c.scopesFromGraph) ? c.scopesFromGraph.join(', ') : '—'}</span>
							</p>
							<p class="text-[11px] font-mono text-white/50">
								Pages: <span class="text-white/80">{c.pagesCount ?? 0}</span> · with IG linked: <span class="text-white/80">{c.pagesWithIg ?? 0}</span>
							</p>
							{#if c.pagesError}
								<p class="text-[11px] font-mono text-red-300/80">Pages error: {c.pagesError}</p>
							{/if}
							{#if (c.pages ?? []).length > 0}
								<div class="space-y-1.5">
									{#each c.pages as p}
										<div class="rounded-lg bg-white/3 border border-white/5 p-2">
											<p class="text-[11px] font-mono text-white/80">{p.name} <span class="text-white/40">({p.id})</span></p>
											<p class="text-[10px] font-mono text-white/50">
												IG business: <span class={p.igBusiness ? 'text-emerald-300' : 'text-white/40'}>{p.igBusiness ? `@${p.igBusiness.username} · ${p.igBusiness.account_type ?? '?'} · ${p.igBusiness.id}` : '— none'}</span>
											</p>
											<p class="text-[10px] font-mono text-white/50">
												IG connected: <span class={p.igConnected ? 'text-emerald-300' : 'text-white/40'}>{p.igConnected ? `@${p.igConnected.username} · ${p.igConnected.account_type ?? '?'} · ${p.igConnected.id}` : '— none'}</span>
											</p>
											{#if p.igError}
												<p class="text-[10px] font-mono text-red-300/80">IG lookup error: {p.igError}</p>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
					<details>
						<summary class="text-[10px] font-mono text-white/40 uppercase tracking-widest cursor-pointer">Raw JSON</summary>
						<pre class="text-[11px] font-mono text-white/60 mt-2 overflow-auto max-h-64">{JSON.stringify(debugData, null, 2)}</pre>
					</details>
				</div>
			{/if}

			<div class="mt-4">
				<label for="post-tests-message" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Post message (caption for the whole post)</label>
				<textarea
					id="post-tests-message"
					bind:value={message}
					rows="2"
					class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-body text-white/80 placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark"
				></textarea>
			</div>

			{#if info}
				<div class="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-mono text-emerald-200/90">{info}</div>
			{/if}
			{#if error}
				<div class="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-mono text-red-300/90 whitespace-pre-wrap wrap-break-word">{error}</div>
			{/if}
			{#if lastResult}
				<details class="mt-3 rounded-xl bg-white/3 border border-white/10 p-3">
					<summary class="text-[10px] font-mono text-white/40 uppercase tracking-widest cursor-pointer">Last response (status {lastResult.status})</summary>
					<pre class="text-[11px] font-mono text-white/60 mt-2 overflow-auto max-h-64">{JSON.stringify(lastResult.data, null, 2)}</pre>
				</details>
			{/if}
		</div>

		<!-- =================================================================== -->
		<!-- INSTAGRAM (shown first)                                              -->
		<!-- =================================================================== -->
		<div class="mt-10 mb-6 flex items-center gap-4">
			<div class="h-px flex-1 bg-linear-to-r from-transparent via-fuchsia-500/40 to-fuchsia-500/40"></div>
			<div class="flex items-center gap-3">
				<span class="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-linear-to-br from-fuchsia-500/25 via-pink-500/20 to-amber-400/20 border border-fuchsia-500/30 text-fuchsia-200 font-display font-bold text-lg">IG</span>
				<h2 class="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">Instagram</h2>
			</div>
			<div class="h-px flex-1 bg-linear-to-l from-transparent via-fuchsia-500/40 to-fuchsia-500/40"></div>
		</div>

		{#if !igConn}
			<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 space-y-3">
				<div>
					<p class="font-semibold text-sm font-body text-amber-100">No Instagram Business/Creator connection detected.</p>
					<p class="text-xs font-body text-amber-200/70 mt-1">Connect Meta and make sure your Facebook Page is linked to an IG Business or Creator account. Personal IG accounts cannot be used.</p>
				</div>
				<button
					type="button"
					onclick={() => connectZernio('instagram')}
					disabled={!userId}
					class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-fuchsia-500/30 via-pink-500/25 to-amber-400/25 border border-fuchsia-500/40 text-sm font-mono text-fuchsia-50 hover:from-fuchsia-500/40 hover:via-pink-500/35 hover:to-amber-400/35 disabled:opacity-50 transition-all shadow-[0_4px_20px_-4px_rgba(232,121,249,0.35)]"
				>
					Connect Instagram →
				</button>
			</div>
		{:else if !publicBaseReady}
			<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs font-mono text-amber-200/90 space-y-2">
				<p class="font-semibold">IG needs a public HTTPS URL for media.</p>
				<p class="text-amber-200/70">Instagram's Graph API cannot fetch <code class="text-amber-100">localhost</code> or accept data URLs. Set <code class="text-amber-100">PUBLIC_APP_URL</code> in your <code class="text-amber-100">.env</code> to a public HTTPS URL (e.g. an <code>ngrok</code> tunnel) and reload. In production, this should be your deployed domain.</p>
				<p class="text-amber-200/60 text-[10px]">Current PUBLIC_APP_URL: {publicBaseUrl || '(not set)'}</p>
			</div>
		{/if}

		<!-- IG IMAGE -->
		<section class="mt-6">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-fuchsia-300/50 uppercase tracking-widest">IG · Section 1</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Photo post</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">Single image to the IG feed. Two-step create/publish.</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingIgImage || !images.length || !igConn || !publicBaseReady} onclick={() => postIgImage('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingIgImage ? 'Working…' : 'Post now'}
					</button>
					<button type="button" disabled={postingIgImage || !images.length || !igConn || !publicBaseReady} onclick={() => postIgImage('schedule')}
						class="px-4 py-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 text-xs font-mono text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50 transition-colors">
						Schedule →
					</button>
				</div>
			</div>
			{#if !images.length}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-xs font-mono text-white/50">No images loaded.</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-4">
					<div class="rounded-xl overflow-hidden bg-black/20 border border-white/10">
						<img src={images[igImageIndex]?.dataUrl} alt={images[igImageIndex]?.name} class="w-full h-56 object-contain bg-black" />
						<div class="p-2 border-t border-white/10">
							<p class="text-[10px] font-mono text-white/45 truncate">{images[igImageIndex]?.name}</p>
							{#if images[igImageIndex]?.publicUrl}
								<p class="text-[10px] font-mono text-emerald-300/60 truncate">public: {images[igImageIndex].publicUrl}</p>
							{/if}
						</div>
					</div>
					<div class="flex flex-col gap-3">
						<div>
							<label for="ig-image-picker" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Pick image</label>
							<select id="ig-image-picker" bind:value={igImageIndex}
								class="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs font-mono text-white/80 focus:outline-none focus:border-fuchsia-500/40 scheme-dark">
								{#each images as img, i (img.name)}
									<option value={i}>{img.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="ig-image-caption" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Caption</label>
							<textarea id="ig-image-caption" bind:value={igImageCaption} rows="4"
								placeholder="Caption for this IG photo…"
								class="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm font-body text-white/80 placeholder-white/25 focus:outline-none focus:border-fuchsia-500/40 transition-colors scheme-dark"
							></textarea>
						</div>
					</div>
				</div>
			{/if}
		</section>

		<!-- IG CAROUSEL -->
		<section class="mt-10">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-fuchsia-300/50 uppercase tracking-widest">IG · Section 2</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Carousel</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">2–10 images and/or reels in a single IG carousel. Each child is created as an unpublished container, then combined into a CAROUSEL parent.</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingIgCarousel || !igConn || !publicBaseReady} onclick={() => postIgCarousel('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingIgCarousel ? 'Working…' : 'Post now'}
					</button>
					<button type="button" disabled={postingIgCarousel || !igConn || !publicBaseReady} onclick={() => postIgCarousel('schedule')}
						class="px-4 py-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 text-xs font-mono text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50 transition-colors">
						Schedule →
					</button>
				</div>
			</div>
			<div class="mb-3">
				<label for="ig-carousel-caption" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Caption</label>
				<textarea id="ig-carousel-caption" bind:value={igCarouselCaption} rows="2"
					class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-body text-white/80 focus:outline-none focus:border-fuchsia-500/40 transition-colors scheme-dark"
				></textarea>
			</div>
			{#if !images.length}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-xs font-mono text-white/50">No images loaded.</div>
			{:else}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
					{#each images as img, i (img.name)}
						<label class="relative rounded-2xl overflow-hidden bg-white/3 border {igCarouselSelected[img.name] ? 'border-fuchsia-500/50' : 'border-white/10'} cursor-pointer block">
							<input
								type="checkbox"
								bind:checked={igCarouselSelected[img.name]}
								class="absolute top-2 left-2 z-10 accent-fuchsia-500"
								aria-label={`Include ${img.name} in IG carousel`}
							/>
							<img src={img.dataUrl} alt={img.name} class="w-full h-32 object-cover {igCarouselSelected[img.name] ? '' : 'opacity-40'}" />
							<div class="p-2">
								<p class="text-[10px] font-mono text-white/55 truncate">{img.name}</p>
							</div>
						</label>
					{/each}
				</div>
			{/if}
		</section>

		<!-- IG REEL -->
		<section class="mt-10">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-fuchsia-300/50 uppercase tracking-widest">IG · Section 3</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Reel</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">Vertical video as an IG Reel (9:16, MP4, ≥3s). Container is created, then polled until <code class="text-white/60">status_code=FINISHED</code>, then published.</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingIgReel || !videos.length || !igConn || !publicBaseReady} onclick={() => postIgReel('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingIgReel ? 'Working…' : 'Post now'}
					</button>
					<button type="button" disabled={postingIgReel || !videos.length || !igConn || !publicBaseReady} onclick={() => postIgReel('schedule')}
						class="px-4 py-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 text-xs font-mono text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50 transition-colors">
						Schedule →
					</button>
				</div>
			</div>
			{#if videos.length === 0}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/40">No videos in <code>static/post-tests/video</code>.</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 space-y-3">
					<div>
						<label for="ig-reel-video-select" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Video</label>
						<select id="ig-reel-video-select" bind:value={igReelVideoIndex}
							class="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm font-body text-white/80 focus:outline-none focus:border-fuchsia-500/40 transition-colors scheme-dark">
							{#each videos as v, i (v.serverPath)}
								<option value={i}>{v.name} · {formatBytes(v.sizeBytes)}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="ig-reel-caption" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Caption</label>
						<textarea id="ig-reel-caption" bind:value={igReelCaption} rows="2"
							class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-body text-white/80 focus:outline-none focus:border-fuchsia-500/40 transition-colors scheme-dark"
						></textarea>
					</div>
					{#if videos[igReelVideoIndex]}
						<video src={videos[igReelVideoIndex].publicPath} controls muted class="w-full max-h-72 rounded-xl bg-black"></video>
					{/if}
				</div>
			{/if}
		</section>

		<!-- IG PHOTO STORY -->
		<section class="mt-10">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-fuchsia-300/50 uppercase tracking-widest">IG · Section 4</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Photo Story</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">Single image as an IG Story (24h expiry). No caption supported — text must be baked into the image.</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingIgStoryImage || !images.length || !igConn || !publicBaseReady} onclick={() => postIgStoryImage('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingIgStoryImage ? 'Working…' : 'Post now'}
					</button>
					<button type="button" disabled={postingIgStoryImage || !images.length || !igConn || !publicBaseReady} onclick={() => postIgStoryImage('schedule')}
						class="px-4 py-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 text-xs font-mono text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50 transition-colors">
						Schedule →
					</button>
				</div>
			</div>
			{#if images.length === 0}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/40">No images loaded.</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 space-y-3">
					<div>
						<label for="ig-story-photo-select" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Image</label>
						<select id="ig-story-photo-select" bind:value={igStoryImageIndex}
							class="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm font-body text-white/80 focus:outline-none focus:border-fuchsia-500/40 transition-colors scheme-dark">
							{#each images as im, i (im.publicPath)}
								<option value={i}>{im.name}</option>
							{/each}
						</select>
					</div>
					{#if images[igStoryImageIndex]}
						<img src={images[igStoryImageIndex].dataUrl} alt={images[igStoryImageIndex].name} class="w-full max-h-72 rounded-xl bg-black object-contain" />
					{/if}
				</div>
			{/if}
		</section>

		<!-- IG VIDEO STORY -->
		<section class="mt-10">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-fuchsia-300/50 uppercase tracking-widest">IG · Section 5</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Video Story</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">Vertical video as an IG Story (24h expiry, ≤60s). Container is polled until ready, then published.</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingIgStoryVideo || !videos.length || !igConn || !publicBaseReady} onclick={() => postIgStoryVideo('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingIgStoryVideo ? 'Working…' : 'Post now'}
					</button>
					<button type="button" disabled={postingIgStoryVideo || !videos.length || !igConn || !publicBaseReady} onclick={() => postIgStoryVideo('schedule')}
						class="px-4 py-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 text-xs font-mono text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50 transition-colors">
						Schedule →
					</button>
				</div>
			</div>
			{#if videos.length === 0}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/40">No videos in <code>static/post-tests/video</code>.</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 space-y-3">
					<div>
						<label for="ig-story-video-select" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Video</label>
						<select id="ig-story-video-select" bind:value={igStoryVideoIndex}
							class="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm font-body text-white/80 focus:outline-none focus:border-fuchsia-500/40 transition-colors scheme-dark">
							{#each videos as v, i (v.serverPath)}
								<option value={i}>{v.name} · {formatBytes(v.sizeBytes)}</option>
							{/each}
						</select>
					</div>
					{#if videos[igStoryVideoIndex]}
						<video src={videos[igStoryVideoIndex].publicPath} controls muted class="w-full max-h-72 rounded-xl bg-black"></video>
					{/if}
				</div>
			{/if}
		</section>

		<!-- =================================================================== -->
		<!-- FACEBOOK                                                             -->
		<!-- =================================================================== -->
		<div class="mt-16 mb-6 flex items-center gap-4">
			<div class="h-px flex-1 bg-linear-to-r from-transparent via-sky-500/40 to-sky-500/40"></div>
			<div class="flex items-center gap-3">
				<span class="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-linear-to-br from-sky-500/25 via-blue-500/20 to-indigo-500/20 border border-sky-500/30 text-sky-200 font-display font-bold text-lg">f</span>
				<h2 class="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">Facebook</h2>
			</div>
			<div class="h-px flex-1 bg-linear-to-l from-transparent via-sky-500/40 to-sky-500/40"></div>
		</div>

		{#if !fbConn}
			<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 space-y-3">
				<div>
					<p class="font-semibold text-sm font-body text-amber-100">No Facebook Page connection detected.</p>
					<p class="text-xs font-body text-amber-200/70 mt-1">Connect Meta and pick a Facebook Page you manage to enable these tests.</p>
				</div>
				<button
					type="button"
					onclick={() => connectZernio('facebook')}
					disabled={!userId}
					class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-sky-500/30 via-blue-500/25 to-indigo-500/25 border border-sky-500/40 text-sm font-mono text-sky-50 hover:from-sky-500/40 hover:via-blue-500/35 hover:to-indigo-500/35 disabled:opacity-50 transition-all shadow-[0_4px_20px_-4px_rgba(56,189,248,0.35)]"
				>
					Connect Facebook →
				</button>
			</div>
		{/if}

		<!-- IMAGES SECTION -->
		<section class="mt-8">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Section 1</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Photo carousel</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">
						{imagesMode === 'carousel'
							? 'One Facebook post with all images. Per-slide captions are concatenated into the post message so they show in the feed.'
							: 'N separate Facebook posts — one per image. Each post shows its own caption in the feed.'}
					</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button
						type="button"
						disabled={posting || !images.length}
						onclick={postNow}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
					>
						{posting ? 'Posting…' : 'Post now'}
					</button>
					<button
						type="button"
						disabled={posting || !images.length}
						onclick={schedulePost}
						class="px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-xs font-mono text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
					>
						Schedule →
					</button>
				</div>
			</div>

			<!-- Carousel mode toggle -->
			<div class="mb-4 flex items-center gap-2 text-[11px] font-mono">
				<span class="text-white/30 uppercase tracking-widest mr-2">Mode</span>
				<button
					type="button"
					onclick={() => (imagesMode = 'carousel')}
					class="px-3 py-1.5 rounded-lg border transition-colors {imagesMode === 'carousel' ? 'bg-violet-500/20 border-violet-500/40 text-violet-100' : 'bg-white/3 border-white/10 text-white/50 hover:bg-white/5'}"
				>
					Carousel (1 post)
				</button>
				<button
					type="button"
					onclick={() => (imagesMode = 'individual')}
					class="px-3 py-1.5 rounded-lg border transition-colors {imagesMode === 'individual' ? 'bg-violet-500/20 border-violet-500/40 text-violet-100' : 'bg-white/3 border-white/10 text-white/50 hover:bg-white/5'}"
				>
					Individual ({images.length} posts)
				</button>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each images as img, i (img.name)}
					<div class="rounded-2xl overflow-hidden bg-white/3 border border-white/10 flex flex-col">
						<img src={img.dataUrl} alt={img.name} class="w-full h-44 object-cover" />
						<div class="p-3 flex-1">
							<p class="text-[10px] font-mono text-white/45 truncate">{img.name}</p>
							<label for={`img-caption-${i}`} class="sr-only">Caption for {img.name}</label>
							<textarea
								id={`img-caption-${i}`}
								bind:value={imageCaptions[i]}
								rows="2"
								placeholder={`Caption for slide ${i + 1}…`}
								class="mt-2 w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[12px] font-body text-white/80 placeholder-white/30 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark"
							></textarea>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- SINGLE PHOTO SECTION -->
		<section class="mt-10">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Section 2</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Single photo</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">Pick one image and post it as a single-photo Facebook Page post.</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button
						type="button"
						disabled={postingSinglePhoto || !images.length}
						onclick={() => postSinglePhoto('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
					>
						{postingSinglePhoto ? 'Posting…' : 'Post now'}
					</button>
					<button
						type="button"
						disabled={postingSinglePhoto || !images.length}
						onclick={() => postSinglePhoto('schedule')}
						class="px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-xs font-mono text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
					>
						Schedule →
					</button>
				</div>
			</div>

			{#if !images.length}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-xs font-mono text-white/50">
					No images loaded.
				</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-4">
					<div class="rounded-xl overflow-hidden bg-black/20 border border-white/10">
						<img src={images[singlePhotoIndex]?.dataUrl} alt={images[singlePhotoIndex]?.name} class="w-full h-56 object-contain bg-black" />
						<div class="p-2 border-t border-white/10">
							<p class="text-[10px] font-mono text-white/45 truncate">{images[singlePhotoIndex]?.name}</p>
						</div>
					</div>
					<div class="flex flex-col gap-3">
						<div>
							<label for="single-photo-picker" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Pick image</label>
							<select
								id="single-photo-picker"
								bind:value={singlePhotoIndex}
								class="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs font-mono text-white/80 focus:outline-none focus:border-violet-500/40 scheme-dark"
							>
								{#each images as img, i (img.name)}
									<option value={i}>{img.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="single-photo-caption" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Caption</label>
							<textarea
								id="single-photo-caption"
								bind:value={singlePhotoMessage}
								rows="4"
								placeholder="Caption for this single-photo post…"
								class="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm font-body text-white/80 placeholder-white/25 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark"
							></textarea>
						</div>
					</div>
				</div>
			{/if}
		</section>

		<!-- SINGLE VIDEO SECTION -->
		<section class="mt-10">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Section 3</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Single video</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">Pick one video and post it as a single-video Facebook Page post.</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button
						type="button"
						disabled={postingSingleVideo || !videos.length}
						onclick={() => postSingleVideo('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
					>
						{postingSingleVideo ? 'Uploading…' : 'Post now'}
					</button>
					<button
						type="button"
						disabled={postingSingleVideo || !videos.length}
						onclick={() => postSingleVideo('schedule')}
						class="px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-xs font-mono text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
					>
						Schedule →
					</button>
				</div>
			</div>

			{#if !videos.length}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-xs font-mono text-white/50">
					No videos loaded.
				</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-4">
					<div class="rounded-xl overflow-hidden bg-black/20 border border-white/10">
						<video src={videos[singleVideoIndex]?.publicPath} controls muted class="w-full h-56 bg-black object-contain"></video>
						<div class="p-2 border-t border-white/10 flex items-center justify-between gap-2">
							<p class="text-[10px] font-mono text-white/45 truncate">{videos[singleVideoIndex]?.name}</p>
							<p class="text-[10px] font-mono text-white/30 shrink-0">{videos[singleVideoIndex] ? formatBytes(videos[singleVideoIndex].sizeBytes) : ''}</p>
						</div>
					</div>
					<div class="flex flex-col gap-3">
						<div>
							<label for="single-video-picker" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Pick video</label>
							<select
								id="single-video-picker"
								bind:value={singleVideoIndex}
								class="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs font-mono text-white/80 focus:outline-none focus:border-violet-500/40 scheme-dark"
							>
								{#each videos as v, i (v.name)}
									<option value={i}>{v.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="single-video-caption" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Description</label>
							<textarea
								id="single-video-caption"
								bind:value={singleVideoMessage}
								rows="4"
								placeholder="Description for this single-video post…"
								class="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm font-body text-white/80 placeholder-white/25 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark"
							></textarea>
						</div>
					</div>
				</div>
			{/if}
		</section>

		<!-- VIDEOS SECTION -->
		<section class="mt-10">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Section 4</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Videos (batch)</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">
						Facebook does not support video carousels via the API. Each video is published as its own Page post. Captions below become each video's description.
					</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button
						type="button"
						disabled={postingVideos || !videos.length}
						onclick={postVideosNow}
						class="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-xs font-mono text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
					>
						{postingVideos ? 'Uploading…' : `Post ${videos.length || ''} video${videos.length === 1 ? '' : 's'} now`}
					</button>
				</div>
			</div>

			{#if !videos.length}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-xs font-mono text-white/50">
					No videos found in <code class="text-white/70">static/post-tests/video</code>.
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{#each videos as vid, i (vid.name)}
						<div class="rounded-2xl overflow-hidden bg-white/3 border border-white/10 flex flex-col">
							<video
								src={vid.publicPath}
								controls
								muted
								class="w-full h-44 bg-black object-cover"
							></video>
							<div class="p-3 flex-1">
								<div class="flex items-center justify-between gap-2">
									<p class="text-[10px] font-mono text-white/45 truncate">{vid.name}</p>
									<p class="text-[10px] font-mono text-white/30 shrink-0">{formatBytes(vid.sizeBytes)}</p>
								</div>
								<label for={`vid-caption-${i}`} class="sr-only">Caption for {vid.name}</label>
								<textarea
									id={`vid-caption-${i}`}
									bind:value={videoCaptions[i]}
									rows="2"
									placeholder={`Caption for video ${i + 1}…`}
									class="mt-2 w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[12px] font-body text-white/80 placeholder-white/30 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark"
								></textarea>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- REEL SECTION -->
		<section class="mt-8">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Section 5</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Reel</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">
						Publishes a single vertical video as a Facebook Reel via the 3-phase resumable upload (<code class="text-white/60">/video_reels</code>). Works best with 9:16 MP4.
					</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingReel || !videos.length} onclick={() => postReel('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingReel ? 'Working…' : 'Post now'}
					</button>
					<button type="button" disabled={postingReel || !videos.length} onclick={() => postReel('schedule')}
						class="px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-xs font-mono text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition-colors">
						Schedule →
					</button>
				</div>
			</div>
			{#if videos.length === 0}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/40">No videos in <code>static/post-tests/video</code>.</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 space-y-3">
					<div>
						<label for="reel-video-select" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Video</label>
						<select id="reel-video-select" bind:value={reelVideoIndex}
							class="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm font-body text-white/80 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark">
							{#each videos as v, i (v.serverPath)}
								<option value={i}>{v.name} · {formatBytes(v.sizeBytes)}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="reel-description" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Description</label>
						<textarea id="reel-description" bind:value={reelDescription} rows="2"
							class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-body text-white/80 placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark"
						></textarea>
					</div>
					{#if videos[reelVideoIndex]}
						<video src={videos[reelVideoIndex].publicPath} controls muted class="w-full max-h-72 rounded-xl bg-black"></video>
					{/if}
				</div>
			{/if}
		</section>

		<!-- PHOTO STORY SECTION -->
		<section class="mt-8">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Section 6</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Photo Story</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">
						Publishes a single image as a Facebook Page Story (auto-expires after 24 hours). Uses <code class="text-white/60">/photos</code> + <code class="text-white/60">/photo_stories</code>.
					</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingPhotoStory || !images.length} onclick={() => postPhotoStory('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingPhotoStory ? 'Working…' : 'Post now'}
					</button>
					<button type="button" disabled={postingPhotoStory || !images.length} onclick={() => postPhotoStory('schedule')}
						class="px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-xs font-mono text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition-colors">
						Schedule →
					</button>
				</div>
			</div>
			{#if images.length === 0}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/40">No images in <code>static/post-tests/pictures</code>.</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 space-y-3">
					<div>
						<label for="story-photo-select" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Image</label>
						<select id="story-photo-select" bind:value={storyPhotoIndex}
							class="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm font-body text-white/80 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark">
							{#each images as im, i (im.publicPath)}
								<option value={i}>{im.name}</option>
							{/each}
						</select>
					</div>
					{#if images[storyPhotoIndex]}
						<img src={images[storyPhotoIndex].publicPath} alt={images[storyPhotoIndex].name} class="w-full max-h-72 rounded-xl bg-black object-contain" />
					{/if}
				</div>
			{/if}
		</section>

		<!-- VIDEO STORY SECTION -->
		<section class="mt-8">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Section 7</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Video Story</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">
						Publishes a single vertical video as a Page Story (auto-expires after 24 hours). Uses <code class="text-white/60">/video_stories</code> 3-phase upload.
					</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingVideoStory || !videos.length} onclick={() => postVideoStory('now')}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingVideoStory ? 'Working…' : 'Post now'}
					</button>
					<button type="button" disabled={postingVideoStory || !videos.length} onclick={() => postVideoStory('schedule')}
						class="px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-xs font-mono text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition-colors">
						Schedule →
					</button>
				</div>
			</div>
			{#if videos.length === 0}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/40">No videos in <code>static/post-tests/video</code>.</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 space-y-3">
					<div>
						<label for="story-video-select" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Video</label>
						<select id="story-video-select" bind:value={storyVideoIndex}
							class="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm font-body text-white/80 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark">
							{#each videos as v, i (v.serverPath)}
								<option value={i}>{v.name} · {formatBytes(v.sizeBytes)}</option>
							{/each}
						</select>
					</div>
					{#if videos[storyVideoIndex]}
						<video src={videos[storyVideoIndex].publicPath} controls muted class="w-full max-h-72 rounded-xl bg-black"></video>
					{/if}
				</div>
			{/if}
		</section>

		<!-- =================================================================== -->
		<!-- TIKTOK                                                               -->
		<!-- =================================================================== -->
		<div class="mt-16 mb-6 flex items-center gap-4">
			<div class="h-px flex-1 bg-linear-to-r from-transparent via-rose-500/40 to-rose-500/40"></div>
			<div class="flex items-center gap-3">
				<span class="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-linear-to-br from-rose-500/25 via-fuchsia-500/20 to-cyan-400/20 border border-rose-500/30 text-rose-200 font-display font-bold text-lg">TT</span>
				<h2 class="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">TikTok</h2>
			</div>
			<div class="h-px flex-1 bg-linear-to-l from-transparent via-rose-500/40 to-rose-500/40"></div>
		</div>

		{#if !ttConn}
			<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 space-y-3">
				<div>
					<p class="font-semibold text-sm font-body text-amber-100">No TikTok connection detected.</p>
					<p class="text-xs font-body text-amber-200/70 mt-1 leading-relaxed">
						In TikTok's sandbox mode (no app audit required) you can add yourself as a tester in the Developer Portal and authorize the app.
						Without <code class="text-amber-100">video.publish</code> scope (which requires audit), videos land in your TikTok <b>Drafts inbox</b> — you then open the app and tap Post to finish.
						The code path shipped is identical to the post-approval flow.
					</p>
				</div>
				<button
					type="button"
					onclick={connectTikTok}
					disabled={!userId}
					class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-rose-500/30 via-fuchsia-500/25 to-cyan-400/25 border border-rose-500/40 text-sm font-mono text-rose-50 hover:from-rose-500/40 hover:via-fuchsia-500/35 hover:to-cyan-400/35 disabled:opacity-50 transition-all shadow-[0_4px_20px_-4px_rgba(244,63,94,0.35)]"
				>
					Connect TikTok →
				</button>
			</div>
		{:else if !publicBaseReady}
			<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs font-mono text-amber-200/90 space-y-2">
				<p class="font-semibold">TikTok needs a public HTTPS URL for media.</p>
				<p class="text-amber-200/70">TikTok's Content Posting API fetches videos via <code class="text-amber-100">PULL_FROM_URL</code> and cannot reach <code class="text-amber-100">localhost</code>. Set <code class="text-amber-100">PUBLIC_APP_URL</code> in your <code class="text-amber-100">.env</code> (ngrok/cloudflared in dev; your domain in prod) and reload.</p>
				<p class="text-amber-200/60 text-[10px]">Current PUBLIC_APP_URL: {publicBaseUrl || '(not set)'}</p>
			</div>
		{:else if !ttCanDirectPost()}
			<div class="rounded-2xl bg-sky-500/10 border border-sky-500/20 p-4 text-xs font-mono text-sky-200/90 space-y-1">
				<p class="font-semibold">Sandbox / pre-audit mode.</p>
				<p class="text-sky-200/70">This TikTok connection doesn't have <code class="text-sky-100">video.publish</code>. Uploads will land in the user's <b>TikTok Drafts inbox</b> — open the TikTok app → Inbox → Drafts → tap Post to finish. Once your app passes TikTok's audit, re-connect to grant <code class="text-sky-100">video.publish</code> and direct posts will work automatically.</p>
			</div>
		{/if}

		<!-- TIKTOK VIDEO -->
		<section class="mt-6 mb-8">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-rose-300/50 uppercase tracking-widest">TT · Section 1</p>
					<h3 class="text-lg font-display font-semibold text-white/85">Video upload</h3>
					<p class="text-[11px] font-body text-white/45 mt-1">
						{ttCanDirectPost()
							? 'Direct-post a video via /v2/post/publish/video/init/ (video.publish granted).'
							: 'Push a video into the user\'s TikTok Drafts inbox via /v2/post/publish/inbox/video/init/. No approval required.'}
					</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button type="button" disabled={postingTikTok || !videos.length || !ttConn || !publicBaseReady} onclick={postTikTok}
						class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
						{postingTikTok ? 'Uploading…' : ttCanDirectPost() ? 'Post now' : 'Send to drafts'}
					</button>
					{#if ttLastPublishId}
						<button type="button" onclick={refreshTikTokStatus}
							class="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/60 hover:bg-white/8 transition-colors"
							title="Fetch current upload status">
							Status
						</button>
					{/if}
				</div>
			</div>
			{#if videos.length === 0}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/40">No videos in <code>static/post-tests/video</code>.</div>
			{:else}
				<div class="rounded-2xl bg-white/3 border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-4">
					<div class="rounded-xl overflow-hidden bg-black/20 border border-white/10">
						{#if videos[ttVideoIndex]}
							<video src={videos[ttVideoIndex].publicPath} controls muted class="w-full h-56 bg-black object-contain"></video>
							<div class="p-2 border-t border-white/10">
								<p class="text-[10px] font-mono text-white/45 truncate">{videos[ttVideoIndex].name}</p>
								{#if videos[ttVideoIndex].publicUrl}
									<p class="text-[10px] font-mono text-emerald-300/60 truncate">public: {videos[ttVideoIndex].publicUrl}</p>
								{/if}
							</div>
						{/if}
					</div>
					<div class="flex flex-col gap-3">
						<div>
							<label for="tt-video-select" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Pick video</label>
							<select id="tt-video-select" bind:value={ttVideoIndex}
								class="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs font-mono text-white/80 focus:outline-none focus:border-rose-500/40 scheme-dark">
								{#each videos as v, i (v.serverPath)}
									<option value={i}>{v.name} · {formatBytes(v.sizeBytes)}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="tt-title" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Title / caption</label>
							<textarea id="tt-title" bind:value={ttTitle} rows="3"
								placeholder={ttCanDirectPost() ? 'TikTok caption (direct post)…' : 'Title used when you finish the draft in the TikTok app'}
								class="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm font-body text-white/80 placeholder-white/25 focus:outline-none focus:border-rose-500/40 transition-colors scheme-dark"
							></textarea>
						</div>
						{#if ttCanDirectPost()}
							<div>
								<label for="tt-privacy" class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Privacy</label>
								<select id="tt-privacy" bind:value={ttPrivacy}
									class="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs font-mono text-white/80 focus:outline-none focus:border-rose-500/40 scheme-dark">
									<option value="SELF_ONLY">Only me</option>
									<option value="MUTUAL_FOLLOW_FRIENDS">Friends (mutual follow)</option>
									<option value="FOLLOWER_OF_CREATOR">Followers</option>
									<option value="PUBLIC_TO_EVERYONE">Public</option>
								</select>
							</div>
						{/if}
						{#if ttLastPublishId}
							<p class="text-[10px] font-mono text-white/40">publish_id: <span class="text-white/70">{ttLastPublishId}</span></p>
						{/if}
					</div>
				</div>
			{/if}
		</section>

	{/if}
</div>
