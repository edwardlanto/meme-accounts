<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';

	type TestImage = { name: string; publicPath: string; dataUrl: string };
	type TestVideo = { name: string; publicPath: string; serverPath: string; sizeBytes: number };
	type DbSocialConnection = {
		id: string;
		user_id: string;
		provider: string;
		provider_account_id: string;
		provider_account_label: string;
		access_token: string;
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
	let images = $state<TestImage[]>([]);
	let videos = $state<TestVideo[]>([]);

	let message = $state(`Carousel test from Social Poster — ${new Date().toLocaleString()}`);
	let imageCaptions = $state<string[]>([]);
	let videoCaptions = $state<string[]>([]);

	// Single-post selections
	let singlePhotoIndex = $state(0);
	let singlePhotoMessage = $state(`Single photo test — ${new Date().toLocaleString()}`);
	let singleVideoIndex = $state(0);
	let singleVideoMessage = $state(`Single video test — ${new Date().toLocaleString()}`);

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
				.select('id,user_id,provider,provider_account_id,provider_account_label,access_token,meta')
				.eq('user_id', userId)
				.eq('provider', 'meta')
				.contains('meta', { kind: 'facebook_page' });
			if (connErr) throw connErr;
			fbConn = (conns?.[0] ?? null) as DbSocialConnection | null;
			if (!fbConn) throw new Error('No Facebook Page connection found. Connect Meta → Facebook Page first.');

			const [imgRes, vidRes] = await Promise.all([
				fetch('/api/post-tests/images').then((r) => r.json()),
				fetch('/api/post-tests/videos').then((r) => r.json()),
			]);
			if (!imgRes?.ok) throw new Error(imgRes?.error ?? 'Failed to load post-test images');
			images = (imgRes.items ?? []) as TestImage[];
			imageCaptions = images.map((img, i) => `Slide ${i + 1} caption — ${img.name}`);

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
			const res = await fetch('/api/scheduler/schedule', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userId,
					connectionProvider: 'meta',
					connectionProviderAccountId: fbConn.provider_account_id,
					scheduledAt: when.toISOString(),
					content: {
						message,
						images: images.map((x) => x.dataUrl),
						imageCaptions,
					},
				}),
			});
			const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
			lastResult = { status: res.status, data };
			if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
			await goto('/dashboard/post-scheduler?from=post-tests&scheduled=1');
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
			const res = await fetch('/api/publish/facebook', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userId,
					pageProviderAccountId: fbConn.provider_account_id,
					content: {
						message,
						images: images.map((x) => x.dataUrl),
						imageCaptions,
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
			const res = await fetch('/api/publish/facebook', {
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
				const res = await fetch('/api/publish/facebook', {
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
				const res = await fetch('/api/scheduler/schedule', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						userId,
						connectionProvider: 'meta',
						connectionProviderAccountId: fbConn.provider_account_id,
						scheduledAt: when.toISOString(),
						content: { message: singlePhotoMessage, images: [pic.dataUrl] },
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
				await goto('/dashboard/post-scheduler?from=post-tests&scheduled=1');
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
				const res = await fetch('/api/publish/facebook', {
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
				const res = await fetch('/api/scheduler/schedule', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						userId,
						connectionProvider: 'meta',
						connectionProviderAccountId: fbConn.provider_account_id,
						scheduledAt: when.toISOString(),
						content: {
							message: singleVideoMessage,
							videos: [{ serverPath: vid.serverPath, description: singleVideoMessage }],
						},
					}),
				});
				const data = await res.json().catch(() => ({ ok: false, error: `Non-JSON (${res.status})` }));
				lastResult = { status: res.status, data };
				if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Schedule failed (${res.status})`);
				await goto('/dashboard/post-scheduler?from=post-tests&scheduled=1');
			}
		} catch (e: any) {
			console.error('[post-tests] single video error', e);
			error = e?.message ?? 'Unknown error';
		} finally {
			postingSingleVideo = false;
		}
	}
</script>

<div class="max-w-4xl mx-auto px-6 py-8">
	<div class="flex items-start justify-between gap-4">
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Post tests</p>
			<h1 class="text-xl font-display font-semibold text-white/90 mt-1">Facebook — post now or schedule</h1>
			<p class="text-sm font-body text-white/45 mt-2 leading-relaxed">
				Posts Facebook Page content <em>immediately</em> (or schedules it) using media from <code class="text-white/70">static/post-tests</code>. Direct Graph API call.
			</p>
		</div>

		<a href="/dashboard/post-scheduler" class="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/60 hover:bg-white/8 transition-colors">
			Open calendar
		</a>
	</div>

	{#if loading}
		<div class="mt-6 rounded-2xl bg-white/3 border border-white/10 p-4 text-sm font-body text-white/60">Loading…</div>
	{:else if error && !fbConn}
		<div class="mt-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-sm font-body text-red-300/80">{error}</div>
	{:else}
		<!-- SHARED STATUS / MESSAGE -->
		<div class="mt-6 rounded-2xl bg-white/3 border border-white/10 p-4">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0">
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Connected page</p>
					<p class="text-sm font-body text-white/80 truncate">{fbConn?.provider_account_label ?? fbConn?.provider_account_id}</p>
					<p class="text-[11px] font-body text-white/35 mt-1">Images: {images.length} · Videos: {videos.length}</p>
				</div>
			</div>

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

		<!-- IMAGES SECTION -->
		<section class="mt-8">
			<div class="flex items-end justify-between gap-4 mb-3">
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Section 1</p>
					<h2 class="text-lg font-display font-semibold text-white/85">Photo carousel</h2>
					<p class="text-[11px] font-body text-white/45 mt-1">One Facebook post containing all images. FB only renders the top-level message for carousels; per-slide captions are stored for reference.</p>
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
					<h2 class="text-lg font-display font-semibold text-white/85">Single photo</h2>
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
					<h2 class="text-lg font-display font-semibold text-white/85">Single video</h2>
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
					<h2 class="text-lg font-display font-semibold text-white/85">Videos (batch)</h2>
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
	{/if}
</div>
