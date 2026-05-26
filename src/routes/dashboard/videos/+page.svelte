<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { r2UploadVideo } from '$lib/r2Client';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import { formatClipDuration, formatTimestamp } from '$lib/video-clips/export-clip';
	import { clipDisplayQuote } from '$lib/video-clips/clip-template-copy';
	import { normalizeVideoClips } from '$lib/video-clips/normalize-clips';
	import ClipTemplatePreviews from '$lib/components/video-clips/ClipTemplatePreviews.svelte';
	import {
		Link2,
		Upload,
		Sparkles,
		Play,
		Download,
		Loader,
		Scissors,
		Tv,
		Film,
		ChevronRight,
		Zap,
		FileVideo,
		AlertCircle,
		CheckCircle2,
		RotateCcw,
	} from 'lucide-svelte';

	type Phase = 'idle' | 'importing' | 'downloading' | 'analyzing' | 'ready' | 'exporting';

	let userId = $state('');
	let phase = $state<Phase>('idle');
	let error = $state('');
	let toolsWarning = $state('');
	let ytDlpReady = $state(false);
	let ffmpegReady = $state(false);
	let youtubeUrl = $state('');
	let topicHint = $state('');
	let source = $state<VideoImportMeta | null>(null);
	let clips = $state<VideoClip[]>([]);
	let summary = $state('');
	let demo = $state(false);
	let model = $state('');
	let selectedClipId = $state<string | null>(null);
	let uploadProgress = $state(0);
	let fileInput = $state<HTMLInputElement | null>(null);
	let playerVideo = $state<HTMLVideoElement | null>(null);
	let importTab = $state<'youtube' | 'upload'>('youtube');
	let isDragging = $state(false);

	let clipMode = $state<'highlights' | 'all'>('highlights');
	let clipCount = $state(8);
	let clipMinSec = $state(10);
	let clipMaxSec = $state(60);

	const selectedClip = $derived(clips.find((c) => c.id === selectedClipId) ?? clips[0] ?? null);
	const hasStoredVideo = $derived(!!source?.r2Key);
	const isBusy = $derived(
		phase === 'analyzing' || phase === 'importing' || phase === 'downloading',
	);
	const isExporting = $derived((phase as string) === 'exporting');

	const clipMaxLabel = $derived(
		clipMaxSec >= 180
			? '3 min'
			: clipMaxSec >= 60
				? `${Math.round(clipMaxSec / 60)} min`
				: `${clipMaxSec}s`,
	);

	$effect(() => {
		if (clipMaxSec < clipMinSec) clipMaxSec = clipMinSec;
	});

	function scoreColor(score: number) {
		if (score >= 80) return '#22c55e';
		if (score >= 60) return '#f59e0b';
		if (score >= 40) return '#f97316';
		return '#ef4444';
	}

	function playClipSegment(clip: VideoClip) {
		const v = playerVideo;
		if (!v) return;
		v.currentTime = clip.startSec;
		void v.play().catch(() => {});
	}

	function onPlayerTimeUpdate() {
		const v = playerVideo;
		const clip = selectedClip;
		if (!v || !clip) return;
		if (v.currentTime >= clip.endSec - 0.08) {
			v.pause();
			v.currentTime = clip.startSec;
		}
	}

	function syncClipsToPlayerDuration(v: HTMLVideoElement) {
		const d = v.duration;
		if (!source || !Number.isFinite(d) || d <= 0) return;
		const realDur = Math.round(d * 10) / 10;
		if (Math.abs(realDur - source.durationSec) <= 0.5) return;
		source = { ...source, durationSec: realDur };
		clips = normalizeVideoClips(clips, realDur, clipMinSec, clipMaxSec);
		if (selectedClipId && !clips.some((c) => c.id === selectedClipId)) {
			selectedClipId = clips[0]?.id ?? null;
		}
	}

	function selectClip(clip: VideoClip) {
		selectedClipId = clip.id;
		playClipSegment(clip);
	}

	$effect(() => {
		const clip = selectedClip;
		const v = playerVideo;
		if (!clip || !v || phase !== 'ready') return;
		if (v.readyState >= 1) playClipSegment(clip);
	});

	function analyzeClipPayload(extra: Record<string, unknown>) {
		return {
			...extra,
			topicHint: topicHint.trim() || undefined,
			clipMinSec,
			clipMaxSec,
			segmentAll: clipMode === 'all',
			...(clipMode === 'highlights'
				? { clipCount: Math.max(1, Math.min(40, Math.round(Number(clipCount)) || 1)) }
				: {}),
		};
	}

	onMount(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		userId = user?.id ?? '';
		try {
			const res = await fetch('/api/videos/tools');
			const t = await res.json();
			ytDlpReady = !!t.ytDlp;
			ffmpegReady = !!t.ffmpeg;
			if (!t.ytDlp) {
				toolsWarning = 'Install yt-dlp for YouTube download + MP4 clips: brew install yt-dlp';
			} else if (!t.ffmpeg) {
				toolsWarning = 'Install ffmpeg for MP4 export: brew install ffmpeg';
			} else if (!t.ytDlpCookiesFile && !t.ytDlpCookiesBrowser) {
				toolsWarning =
					'YouTube may return HTTP 403 without cookies. Log into YouTube in Chrome, add YT_DLP_COOKIES_BROWSER=chrome to .env, and restart the server.';
			}
		} catch {
			toolsWarning = 'Could not check video tools (yt-dlp / ffmpeg).';
		}
	});

	async function analyzeFromYoutube() {
		const url = youtubeUrl.trim();
		if (!url) {
			error = 'Paste a YouTube URL first';
			return;
		}
		error = '';
		phase = ytDlpReady ? 'downloading' : 'analyzing';
		try {
			const res = await fetch('/api/videos/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(analyzeClipPayload({ source: 'youtube', youtubeUrl: url })),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			source = data.source;
			clips = normalizeVideoClips(
				data.clips ?? [],
				data.source?.durationSec ?? 1,
				clipMinSec,
				clipMaxSec,
			);
			summary = data.summary ?? '';
			demo = !!data.demo;
			model = data.model ?? '';
			toolsWarning = String(data.warning ?? toolsWarning);
			selectedClipId = clips[0]?.id ?? null;
			phase = 'ready';
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'idle';
		}
	}

	async function onFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file || !userId) return;
		error = '';
		phase = 'importing';
		uploadProgress = 10;
		try {
			const key = `${userId}/videos/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
			uploadProgress = 30;
			const up = await r2UploadVideo({ key, blob: file, filename: file.name });
			uploadProgress = 70;

			const video = document.createElement('video');
			video.preload = 'metadata';
			const objectUrl = URL.createObjectURL(file);
			const durationSec = await new Promise<number>((resolve) => {
				video.onloadedmetadata = () => {
					const d = Number(video.duration);
					URL.revokeObjectURL(objectUrl);
					resolve(Number.isFinite(d) && d > 0 ? d : 1);
				};
				video.onerror = () => {
					URL.revokeObjectURL(objectUrl);
					resolve(1);
				};
				video.src = objectUrl;
			});

			phase = 'analyzing';
			uploadProgress = 85;
			const res = await fetch('/api/videos/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					analyzeClipPayload({
						source: 'upload',
						r2Key: up.key,
						title: file.name.replace(/\.[^.]+$/, ''),
						durationSec,
					}),
				),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			source = data.source;
			clips = normalizeVideoClips(
				data.clips ?? [],
				data.source?.durationSec ?? durationSec,
				clipMinSec,
				clipMaxSec,
			);
			summary = data.summary ?? '';
			demo = !!data.demo;
			model = data.model ?? '';
			selectedClipId = clips[0]?.id ?? null;
			uploadProgress = 100;
			phase = 'ready';
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : String(err);
			phase = 'idle';
		} finally {
			if (fileInput) fileInput.value = '';
		}
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}
	function onDragLeave() {
		isDragging = false;
	}
	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (!file) return;
		const fakeEvent = { target: { files: [file] } } as unknown as Event;
		void onFileChange(fakeEvent);
	}

	async function downloadClip(clip: VideoClip) {
		if (!source?.r2Key) {
			error = 'Full download requires yt-dlp. Run: brew install yt-dlp, then analyze again.';
			return;
		}
		if (!ffmpegReady) {
			error = 'ffmpeg is required for MP4 export. Run: brew install ffmpeg';
			return;
		}
		error = '';
		phase = 'exporting';
		try {
			const res = await fetch('/api/videos/export-clip', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					r2Key: source.r2Key,
					startSec: clip.startSec,
					endSec: clip.endSec,
					filename: clip.title,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Export failed');
			const a = document.createElement('a');
			a.href = data.downloadUrl;
			a.download = data.filename ?? 'clip.mp4';
			a.rel = 'noopener';
			a.click();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			phase = 'ready';
		}
	}

	function reset() {
		phase = 'idle';
		source = null;
		clips = [];
		summary = '';
		selectedClipId = null;
		error = '';
		demo = false;
	}
</script>

<div class="videos-page">
	<!-- ── HERO / IMPORT ── -->
	<header class="videos-hero">
		<div class="hero-glow" aria-hidden="true"></div>
		<div class="videos-hero-inner">
			<div class="videos-hero-badge">
				<Scissors size={13} />
				AI clip finder
			</div>

			<h1 class="videos-title">
				Turn long videos into<br /><span class="title-accent">viral clips</span>
			</h1>
			<p class="videos-sub">
				Paste a YouTube link or upload a file — Vertex Gemini finds the best moments, ffmpeg
				exports the MP4s.
			</p>

			{#if toolsWarning}
				<div class="tools-warn" role="status">
					<AlertCircle size={14} />
					<span>{toolsWarning}</span>
				</div>
			{/if}

			<div class="import-card">
				<!-- Functional tabs -->
				<div class="import-tabs" role="tablist">
					<button
						role="tab"
						aria-selected={importTab === 'youtube'}
						class="import-tab"
						class:import-tab-on={importTab === 'youtube'}
						onclick={() => (importTab = 'youtube')}
					>
						<Tv size={14} /> YouTube
					</button>
					<button
						role="tab"
						aria-selected={importTab === 'upload'}
						class="import-tab"
						class:import-tab-on={importTab === 'upload'}
						onclick={() => (importTab = 'upload')}
					>
						<FileVideo size={14} /> Upload file
					</button>
				</div>

				{#if importTab === 'youtube'}
					<div class="import-row">
						<Link2 size={16} class="import-icon" />
						<input
							type="url"
							class="import-input"
							placeholder="https://www.youtube.com/watch?v=…"
							bind:value={youtubeUrl}
							disabled={isBusy}
							onkeydown={(e) => e.key === 'Enter' && void analyzeFromYoutube()}
						/>
						<button
							type="button"
							class="btn-primary"
							disabled={isBusy}
							onclick={() => void analyzeFromYoutube()}
						>
							{#if phase === 'downloading'}
								<Loader size={15} class="spin" /> Downloading…
							{:else if phase === 'analyzing'}
								<Loader size={15} class="spin" /> Analyzing…
							{:else}
								<Sparkles size={15} /> Find clips
							{/if}
						</button>
					</div>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<label
						class="upload-zone"
						class:upload-zone-drag={isDragging}
						class:upload-zone-busy={isBusy}
						ondragover={onDragOver}
						ondragleave={onDragLeave}
						ondrop={onDrop}
					>
						<input
							bind:this={fileInput}
							type="file"
							accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
							class="sr-only"
							disabled={!userId || isBusy}
							onchange={onFileChange}
						/>
						{#if phase === 'importing'}
							<Loader size={28} class="spin upload-loader" />
							<span class="upload-title">Uploading…</span>
							<div class="upload-bar">
								<div class="upload-bar-fill" style="width: {uploadProgress}%"></div>
							</div>
							<span class="upload-pct">{Math.round(uploadProgress)}%</span>
						{:else if phase === 'analyzing'}
							<Sparkles size={28} class="upload-pulse" />
							<span class="upload-title">Analyzing with Gemini…</span>
						{:else}
							<FileVideo size={28} class="upload-icon" />
							<span class="upload-title"
								>{isDragging ? 'Drop to analyze' : 'Drop a video or click to upload'}</span
							>
							<span class="upload-hint">MP4 · WebM · MOV · up to 200 MB</span>
						{/if}
					</label>
				{/if}

				<!-- Clip settings -->
				<fieldset class="clip-settings">
					<legend class="clip-settings-legend">Clip settings</legend>

					<div class="clip-mode-row" role="radiogroup" aria-label="Clip mode">
						<label class="clip-mode-opt" class:clip-mode-opt-on={clipMode === 'highlights'}>
							<input type="radio" name="clip-mode" value="highlights" bind:group={clipMode} />
							<Zap size={13} /> Best highlights
						</label>
						<label class="clip-mode-opt" class:clip-mode-opt-on={clipMode === 'all'}>
							<input type="radio" name="clip-mode" value="all" bind:group={clipMode} />
							<Film size={13} /> Clip entire video
						</label>
					</div>

					{#if clipMode === 'highlights'}
						<label class="clip-field">
							<span class="clip-field-label">Number of clips</span>
							<input
								type="number"
								class="clip-number"
								min={1}
								max={40}
								step={1}
								bind:value={clipCount}
								disabled={isBusy}
							/>
						</label>
					{:else}
						<p class="clip-mode-hint">
							Splits the full video into back-to-back segments using the length range below.
						</p>
					{/if}

					<div class="clip-field">
						<span class="clip-field-label">
							Clip length: <strong>{clipMinSec}s</strong> – <strong>{clipMaxLabel}</strong>
						</span>
						<div class="clip-range-pair">
							<label class="clip-range">
								<span>Min</span>
								<input
									type="range"
									min={10}
									max={180}
									step={5}
									bind:value={clipMinSec}
									disabled={isBusy}
								/>
							</label>
							<label class="clip-range">
								<span>Max</span>
								<input
									type="range"
									min={10}
									max={180}
									step={5}
									bind:value={clipMaxSec}
									disabled={isBusy}
								/>
							</label>
						</div>
						<div class="clip-range-ticks">
							<span>10s</span><span>1 min</span><span>3 min</span>
						</div>
					</div>
				</fieldset>

				<div class="hint-row">
					<Sparkles size={13} class="hint-icon" />
					<input
						type="text"
						class="hint-input"
						placeholder="Topic or angle hint — e.g. motivation, startup advice"
						bind:value={topicHint}
					/>
				</div>
			</div>

			{#if error}
				<div class="videos-error" role="alert">
					<AlertCircle size={14} />
					{error}
				</div>
			{/if}
		</div>
	</header>

	<!-- ── RESULTS ── -->
	{#if phase === 'ready' && source}
		<section class="results" aria-label="Analysis results">
			<div class="results-head">
				<div class="results-head-info">
					<h2 class="results-title">{source.title}</h2>
					<div class="results-meta">
						<span>{clips.length} clips found</span>
						<span class="meta-sep">·</span>
						<span>{formatTimestamp(source.durationSec)} total</span>
						{#if demo}<span class="demo-pill">Demo AI</span>{/if}
						{#if model}<span class="model-pill">{model}</span>{/if}
					</div>
					{#if summary}<p class="results-summary">{summary}</p>{/if}
				</div>
				<button type="button" class="btn-ghost" onclick={reset}>
					<RotateCcw size={13} /> New video
				</button>
			</div>

			<div class="results-grid">
				<!-- Player -->
				<div class="player-panel">
					{#if hasStoredVideo}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							bind:this={playerVideo}
							class="native-player"
							controls
							src={source.playbackUrl}
							ontimeupdate={onPlayerTimeUpdate}
							onloadedmetadata={(e) => {
								const v = e.currentTarget;
								syncClipsToPlayerDuration(v);
								if (selectedClip) playClipSegment(selectedClip);
							}}
						></video>
						<p class="player-note">
							<CheckCircle2 size={12} /> Full video stored — export downloads MP4 via ffmpeg.
						</p>
					{:else if source.youtubeId}
						<div class="yt-wrap">
							{#key `${selectedClipId}-${selectedClip?.startSec}-${selectedClip?.endSec}`}
								<iframe
									title="YouTube preview"
									src="https://www.youtube.com/embed/{source.youtubeId}?start={Math.floor(selectedClip?.startSec ?? 0)}&end={Math.ceil(selectedClip?.endSec ?? 0)}&autoplay=0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowfullscreen
								></iframe>
							{/key}
						</div>
						<p class="player-note">Install yt-dlp to download the full video and enable MP4 export.</p>
					{/if}

					{#if selectedClip}
						<div class="now-playing">
							<span class="now-playing-dot" aria-hidden="true"></span>
							<span>
								{selectedClip.title} · {formatTimestamp(selectedClip.startSec)}–{formatTimestamp(selectedClip.endSec)}
								<span class="now-playing-dur"
									>({formatClipDuration(selectedClip.startSec, selectedClip.endSec)})</span
								>
							</span>
						</div>
					{/if}
				</div>

				<!-- Clips list -->
				<div class="clips-panel">
					<h3 class="clips-heading">
						<Zap size={12} /> Ranked by virality
					</h3>
					<ul class="clips-list">
						{#each clips as clip, i (clip.id)}
							<li class="clip-item" style="--i: {i}">
								<button
									type="button"
									class="clip-card"
									class:clip-card-on={selectedClipId === clip.id}
									onclick={() => selectClip(clip)}
									style="--score-color: {scoreColor(clip.viralityScore)}"
								>
									<div
										class="clip-score"
										aria-label="Virality score {clip.viralityScore}"
									>
										<span class="score-num">{clip.viralityScore}</span>
									</div>
									<div class="clip-body">
										<div class="clip-title">{clip.title}</div>
										<div class="clip-hook">{clipDisplayQuote(clip, source ?? undefined)}</div>
										<div class="clip-times">
											{formatTimestamp(clip.startSec)} – {formatTimestamp(clip.endSec)}
											· {formatClipDuration(clip.startSec, clip.endSec)}
										</div>
									</div>
									<ChevronRight size={15} class="clip-chevron" />
								</button>
								<div class="clip-actions">
									<button
										type="button"
										class="btn-small btn-export"
										disabled={isExporting || !source?.r2Key}
										onclick={() => void downloadClip(clip)}
										title={source?.r2Key ? 'Download MP4 clip' : 'Requires yt-dlp download'}
									>
										{#if isExporting}
											<Loader size={13} class="spin" />
										{:else}
											<Download size={13} />
										{/if}
										Export MP4
									</button>
									<a
										class="btn-small btn-studio"
										href="/dashboard/studio?blank=1"
										title="Design a post around this clip"
									>
										<Film size={13} />
										Open in Studio
									</a>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</div>

			{#if selectedClip && source}
				<ClipTemplatePreviews
					clip={selectedClip}
					{source}
					watermark={topicHint.trim() || 'VIRAL CLIP'}
					topicHint={topicHint.trim()}
				/>
			{/if}
		</section>
	{/if}
</div>

<style>
	/* ── Base ── */
	.videos-page {
		min-height: 100%;
		background: var(--app-bg);
		color: var(--app-text);
	}

	/* ── Hero — clean white professional ── */
	.videos-hero {
		position: relative;
		background: #fff;
		color: #0f172a;
		padding: 3rem 1.5rem 3.5rem;
		border-bottom: 1px solid #e8edf2;
	}

	.hero-glow {
		display: none;
	}

	.videos-hero-inner {
		position: relative;
		max-width: 680px;
		margin: 0 auto;
	}

	.videos-hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.67rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #7c3aed;
		background: #f5f3ff;
		border: 1px solid #ddd6fe;
		padding: 0.28rem 0.65rem 0.28rem 0.5rem;
		border-radius: 999px;
		margin-bottom: 1rem;
		animation: badge-in 0.45s ease both;
	}

	@keyframes badge-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.videos-title {
		font-size: clamp(1.85rem, 4.5vw, 2.6rem);
		font-weight: 900;
		letter-spacing: -0.04em;
		line-height: 1.08;
		color: #0f172a;
		margin: 0 0 0.75rem;
		animation: slide-up 0.5s 0.05s ease both;
	}

	.title-accent {
		color: #7c3aed;
		background: none;
		-webkit-text-fill-color: #7c3aed;
	}

	.videos-sub {
		margin: 0 0 1.75rem;
		color: #64748b;
		font-size: 0.975rem;
		line-height: 1.65;
		max-width: 34rem;
		animation: slide-up 0.5s 0.09s ease both;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ── Warning ── */
	.tools-warn {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin: 0 0 1.25rem;
		padding: 0.65rem 0.9rem;
		border-radius: 0.6rem;
		background: #fffbeb;
		border: 1px solid #fcd34d;
		color: #92400e;
		font-size: 0.78rem;
		line-height: 1.5;
	}

	.tools-warn :global(svg) {
		flex-shrink: 0;
		margin-top: 1px;
		color: #d97706;
	}

	/* ── Import card ── */
	.import-card {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.35rem;
		box-shadow:
			0 1px 3px rgba(15, 23, 42, 0.06),
			0 4px 16px rgba(15, 23, 42, 0.04);
		animation: slide-up 0.55s 0.12s ease both;
	}

	/* ── Tabs ── */
	.import-tabs {
		display: flex;
		gap: 0.2rem;
		margin-bottom: 1.1rem;
		background: #f1f5f9;
		border-radius: 0.6rem;
		padding: 0.2rem;
	}

	.import-tab {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: #94a3b8;
		padding: 0.48rem 0.75rem;
		border-radius: 0.45rem;
		border: none;
		background: transparent;
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s,
			box-shadow 0.15s;
	}

	.import-tab:hover {
		color: #475569;
	}

	.import-tab-on {
		color: #0f172a;
		background: #fff;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
	}

	/* ── URL row ── */
	.import-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.import-icon) {
		flex-shrink: 0;
		color: #94a3b8;
	}

	.import-input {
		flex: 1;
		min-width: 0;
		height: 2.7rem;
		border-radius: 0.6rem;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		color: #0f172a;
		padding: 0 0.85rem;
		font-size: 0.875rem;
		transition:
			border-color 0.15s,
			background 0.15s,
			box-shadow 0.15s;
	}

	.import-input:focus {
		outline: none;
		border-color: #a78bfa;
		background: #fff;
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
	}

	.import-input::placeholder {
		color: #b0bac5;
	}

	/* ── Primary CTA ── */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 2.7rem;
		padding: 0 1.15rem;
		border-radius: 0.6rem;
		border: none;
		background: #7c3aed;
		color: #fff;
		font-weight: 700;
		font-size: 0.82rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 0.15s,
			transform 0.12s,
			box-shadow 0.15s;
		box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
	}

	.btn-primary:hover:not(:disabled) {
		background: #6d28d9;
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
	}

	.btn-primary:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		box-shadow: none;
	}

	/* ── Upload zone ── */
	.upload-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 2.25rem 1.5rem;
		border: 2px dashed #cbd5e1;
		border-radius: 0.85rem;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s;
		color: #475569;
		min-height: 10.5rem;
		text-align: center;
	}

	.upload-zone:hover {
		border-color: #a78bfa;
		background: #faf5ff;
	}

	.upload-zone-drag {
		border-color: #7c3aed !important;
		border-style: solid !important;
		background: #f5f3ff !important;
	}

	.upload-zone-busy {
		pointer-events: none;
		opacity: 0.7;
	}

	.upload-title {
		font-weight: 700;
		font-size: 0.9rem;
		margin-top: 0.15rem;
		color: #1e293b;
	}

	.upload-hint {
		font-size: 0.72rem;
		color: #94a3b8;
		letter-spacing: 0.03em;
	}

	.upload-bar {
		width: 100%;
		max-width: 9rem;
		height: 3px;
		background: #e2e8f0;
		border-radius: 999px;
		margin-top: 0.65rem;
		overflow: hidden;
	}

	.upload-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #7c3aed, #a78bfa);
		border-radius: 999px;
		transition: width 0.25s ease;
	}

	.upload-pct {
		font-size: 0.71rem;
		color: #64748b;
		font-variant-numeric: tabular-nums;
	}

	:global(.upload-loader) {
		color: #7c3aed;
	}

	:global(.upload-pulse) {
		animation: pulse 1.6s ease-in-out infinite;
		color: #7c3aed;
	}

	:global(.upload-icon) {
		transition: transform 0.2s;
		color: #94a3b8;
	}

	.upload-zone:hover :global(.upload-icon) {
		transform: translateY(-3px);
		color: #7c3aed;
	}

	/* ── Clip settings ── */
	.clip-settings {
		margin-top: 1.1rem;
		padding: 1rem 1rem 0.8rem;
		border-radius: 0.7rem;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.clip-settings-legend {
		font-size: 0.67rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #94a3b8;
		padding: 0 0.1rem;
	}

	.clip-mode-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.clip-mode-opt {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #64748b;
		cursor: pointer;
		padding: 0.38rem 0.72rem;
		border-radius: 0.48rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		transition:
			color 0.15s,
			background 0.15s,
			border-color 0.15s;
	}

	.clip-mode-opt input {
		display: none;
	}

	.clip-mode-opt-on {
		color: #7c3aed;
		background: #f5f3ff;
		border-color: #c4b5fd;
	}

	.clip-mode-hint {
		margin: 0;
		font-size: 0.76rem;
		color: #94a3b8;
		line-height: 1.5;
	}

	.clip-field {
		display: flex;
		flex-direction: column;
		gap: 0.42rem;
	}

	.clip-field-label {
		font-size: 0.76rem;
		color: #475569;
	}

	.clip-field-label strong {
		color: #7c3aed;
		font-weight: 700;
	}

	.clip-number {
		height: 2.1rem;
		width: 5.5rem;
		border-radius: 0.45rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		color: #0f172a;
		padding: 0 0.6rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.clip-number:disabled {
		opacity: 0.42;
	}

	.clip-range-pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.clip-range {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.67rem;
		color: #94a3b8;
	}

	.clip-range input {
		width: 100%;
		accent-color: #7c3aed;
	}

	.clip-range-ticks {
		display: flex;
		justify-content: space-between;
		font-size: 0.63rem;
		color: #b0bac5;
	}

	/* ── Topic hint ── */
	.hint-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.85rem;
	}

	:global(.hint-icon) {
		color: #b0bac5;
		flex-shrink: 0;
	}

	.hint-input {
		flex: 1;
		height: 2.25rem;
		border-radius: 0.52rem;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		color: #0f172a;
		padding: 0 0.65rem;
		font-size: 0.8rem;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.hint-input:focus {
		outline: none;
		border-color: #a78bfa;
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
	}

	.hint-input::placeholder {
		color: #b0bac5;
	}

	/* ── Error ── */
	.videos-error {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.65rem 0.9rem;
		border-radius: 0.55rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #b91c1c;
		font-size: 0.8rem;
		line-height: 1.4;
	}

	/* ── Results section ── */
	.results {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2.25rem 1.5rem 3.5rem;
		animation: slide-up 0.4s ease both;
	}

	.results-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.75rem;
		padding-bottom: 1.35rem;
		border-bottom: 1px solid var(--app-border);
	}

	.results-title {
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		margin: 0 0 0.4rem;
	}

	.results-meta {
		font-size: 0.78rem;
		color: var(--app-text-2);
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.meta-sep {
		opacity: 0.38;
	}

	.demo-pill,
	.model-pill {
		font-size: 0.63rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in oklab, #f472b6 14%, transparent);
		color: #be185d;
	}

	.results-summary {
		margin: 0.65rem 0 0;
		font-size: 0.875rem;
		line-height: 1.62;
		color: var(--app-text-2);
		max-width: 44rem;
	}

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--app-border);
		background: var(--app-surface);
		border-radius: 0.55rem;
		padding: 0.5rem 0.9rem;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--app-text);
		white-space: nowrap;
		transition: background 0.15s;
	}

	.btn-ghost:hover {
		background: var(--app-surface-2);
	}

	/* ── Results grid ── */
	.results-grid {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.15fr);
		gap: 1.75rem;
		align-items: start;
	}

	@media (max-width: 900px) {
		.results-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ── Player ── */
	.player-panel {
		position: sticky;
		top: 1.25rem;
	}

	.yt-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 9 / 16;
		max-height: 70vh;
		border-radius: 1rem;
		overflow: hidden;
		background: #000;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
	}

	.yt-wrap iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.native-player {
		width: 100%;
		max-height: 70vh;
		border-radius: 1rem;
		background: #000;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
	}

	.player-note {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.71rem;
		color: var(--app-text-3);
		margin: 0.6rem 0 0;
	}

	.now-playing {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.8rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--app-text-2);
	}

	.now-playing-dot {
		display: block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #f43f5e;
		flex-shrink: 0;
		animation: pulse 1.8s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.7);
		}
	}

	.now-playing-dur {
		color: var(--app-text-3);
		font-weight: 400;
	}

	/* ── Clips panel ── */
	.clips-heading {
		display: flex;
		align-items: center;
		gap: 0.38rem;
		font-size: 0.67rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--app-text-3);
		margin: 0 0 0.85rem;
		font-weight: 700;
	}

	.clips-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.clip-item {
		animation: clip-enter 0.35s calc(var(--i, 0) * 0.045s) ease both;
	}

	@keyframes clip-enter {
		from {
			opacity: 0;
			transform: translateX(10px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.clip-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		text-align: left;
		padding: 0.85rem 0.75rem;
		border-radius: 0.85rem;
		border: 1px solid var(--app-border);
		background: var(--app-surface);
		cursor: pointer;
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			transform 0.12s,
			background 0.15s;
	}

	.clip-card:hover {
		border-color: color-mix(in oklab, var(--score-color, #e11d48) 38%, var(--app-border));
		transform: translateX(2px);
	}

	.clip-card-on {
		border-color: #e11d48;
		box-shadow:
			0 0 0 1px rgba(225, 29, 72, 0.2),
			0 4px 18px rgba(225, 29, 72, 0.1);
		background: color-mix(in oklab, #e11d48 3.5%, var(--app-surface));
	}

	.clip-score {
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 0.6rem;
		background: color-mix(in oklab, var(--score-color) 14%, transparent);
		border: 1.5px solid color-mix(in oklab, var(--score-color) 35%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.15s;
	}

	.clip-card:hover .clip-score {
		transform: scale(1.05);
	}

	.score-num {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--score-color);
		font-variant-numeric: tabular-nums;
	}

	.clip-body {
		flex: 1;
		min-width: 0;
	}

	.clip-title {
		font-weight: 700;
		font-size: 0.875rem;
		margin-bottom: 0.2rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.clip-hook {
		font-size: 0.775rem;
		color: var(--app-text-2);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.clip-times {
		font-size: 0.69rem;
		color: var(--app-text-3);
		margin-top: 0.3rem;
		font-variant-numeric: tabular-nums;
	}

	:global(.clip-chevron) {
		opacity: 0.2;
		flex-shrink: 0;
		transition:
			opacity 0.15s,
			transform 0.15s;
	}

	.clip-card:hover :global(.clip-chevron),
	.clip-card-on :global(.clip-chevron) {
		opacity: 0.55;
		transform: translateX(2px);
	}

	.clip-actions {
		display: flex;
		gap: 0.35rem;
		padding: 0.25rem 0.5rem 0.45rem 4.1rem;
	}

	.btn-small {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.32rem 0.6rem;
		border-radius: 0.45rem;
		border: 1px solid var(--app-border);
		background: var(--app-surface-2);
		font-size: 0.71rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--app-text);
		text-decoration: none;
		transition:
			background 0.12s,
			border-color 0.12s,
			color 0.12s;
	}

	.btn-small:hover {
		background: var(--app-surface);
	}

	.btn-export:not(:disabled):hover {
		border-color: color-mix(in oklab, #22c55e 35%, var(--app-border));
		color: #16a34a;
	}

	.btn-studio {
		border-color: color-mix(in oklab, #7c3aed 28%, var(--app-border));
	}

	.btn-studio:hover {
		border-color: color-mix(in oklab, #7c3aed 52%, var(--app-border));
		color: #7c3aed;
	}

	.btn-small:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}

	/* ── Animations ── */
	:global(.spin) {
		animation: spin 0.75s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Responsive ── */
	@media (max-width: 600px) {
		.videos-hero {
			padding: 2rem 1rem 2.5rem;
		}

		.import-card {
			padding: 1rem;
		}

		.clip-actions {
			padding-left: 0.75rem;
		}

		.results {
			padding: 1.5rem 1rem 2.5rem;
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
