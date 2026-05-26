<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { r2UploadVideo } from '$lib/r2Client';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import { formatClipDuration, formatTimestamp } from '$lib/video-clips/export-clip';
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

	const selectedClip = $derived(clips.find((c) => c.id === selectedClipId) ?? clips[0] ?? null);
	const hasStoredVideo = $derived(!!source?.r2Key);

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		userId = user?.id ?? '';
		try {
			const res = await fetch('/api/videos/tools');
			const t = await res.json();
			ytDlpReady = !!t.ytDlp;
			ffmpegReady = !!t.ffmpeg;
			if (!t.ytDlp) {
				toolsWarning =
					'Install yt-dlp for YouTube download + MP4 clips: brew install yt-dlp';
			} else if (!t.ffmpeg) {
				toolsWarning = 'Install ffmpeg for MP4 export: brew install ffmpeg';
			}
		} catch {
			toolsWarning = 'Could not check video tools (yt-dlp / ffmpeg).';
		}
	});

	async function analyzeFromYoutube() {
		const url = youtubeUrl.trim();
		if (!url) {
			error = 'Paste a YouTube URL';
			return;
		}
		error = '';
		phase = ytDlpReady ? 'downloading' : 'analyzing';
		try {
			const res = await fetch('/api/videos/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'youtube',
					youtubeUrl: url,
					topicHint: topicHint.trim() || undefined,
					clipCount: 8,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			source = data.source;
			clips = data.clips ?? [];
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
					resolve(Number.isFinite(d) && d > 0 ? d : 600);
				};
				video.onerror = () => {
					URL.revokeObjectURL(objectUrl);
					resolve(600);
				};
				video.src = objectUrl;
			});

			phase = 'analyzing';
			uploadProgress = 85;
			const res = await fetch('/api/videos/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'upload',
					r2Key: up.key,
					title: file.name.replace(/\.[^.]+$/, ''),
					durationSec,
					topicHint: topicHint.trim() || undefined,
					clipCount: 8,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			source = data.source;
			clips = data.clips ?? [];
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
	<header class="videos-hero">
		<div class="videos-hero-inner">
			<div class="videos-hero-badge">
				<Scissors size={14} />
				AI clip finder
			</div>
			<h1 class="videos-title">Turn long videos into viral clips</h1>
			<p class="videos-sub">
				Paste a YouTube link or upload a file. We download with yt-dlp, find clips with Vertex Gemini, and export MP4s with ffmpeg.
			</p>

			{#if toolsWarning}
				<p class="tools-warn" role="status">{toolsWarning}</p>
			{/if}

			<div class="import-card">
				<div class="import-tabs">
					<span class="import-tab import-tab-on"><Tv size={16} /> YouTube</span>
					<span class="import-tab"><Upload size={16} /> Upload</span>
				</div>

				<div class="import-row">
					<Link2 size={18} class="import-icon" />
					<input
						type="url"
						class="import-input"
						placeholder="https://www.youtube.com/watch?v=…"
						bind:value={youtubeUrl}
						disabled={phase === 'analyzing' || phase === 'importing' || phase === 'downloading'}
						onkeydown={(e) => e.key === 'Enter' && void analyzeFromYoutube()}
					/>
					<button
						type="button"
						class="btn-primary"
						disabled={phase === 'analyzing' || phase === 'importing' || phase === 'downloading'}
						onclick={() => void analyzeFromYoutube()}
					>
						{#if phase === 'downloading'}
							<Loader size={16} class="spin" />
							Downloading…
						{:else if phase === 'analyzing'}
							<Loader size={16} class="spin" />
							Analyzing…
						{:else}
							<Sparkles size={16} />
							Get clips
						{/if}
					</button>
				</div>

				<div class="import-divider"><span>or</span></div>

				<label class="upload-zone">
					<input
						bind:this={fileInput}
						type="file"
						accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
						class="sr-only"
						disabled={!userId || phase === 'analyzing' || phase === 'importing'}
						onchange={onFileChange}
					/>
					<Upload size={28} />
					<span class="upload-title">Drop a video or click to upload</span>
					<span class="upload-hint">MP4, WebM, or MOV · up to 200MB</span>
					{#if phase === 'importing'}
						<div class="upload-bar"><div class="upload-bar-fill" style="width: {uploadProgress}%"></div></div>
					{/if}
				</label>

				<input
					type="text"
					class="hint-input"
					placeholder="Optional: topic or angle (e.g. motivation, startup advice)"
					bind:value={topicHint}
				/>
			</div>

			{#if error}
				<p class="videos-error" role="alert">{error}</p>
			{/if}
		</div>
	</header>

	{#if phase === 'ready' && source}
		<section class="results">
			<div class="results-head">
				<div>
					<h2>{source.title}</h2>
					<p class="results-meta">
						{clips.length} clips · {formatTimestamp(source.durationSec)} total
						{#if demo}<span class="demo-pill">Demo AI</span>{/if}
						{#if model}<span class="model-pill">{model}</span>{/if}
					</p>
					{#if summary}<p class="results-summary">{summary}</p>{/if}
				</div>
				<button type="button" class="btn-ghost" onclick={reset}>New video</button>
			</div>

			<div class="results-grid">
				<div class="player-panel">
					{#if hasStoredVideo}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							class="native-player"
							controls
							src={source.playbackUrl}
							onloadedmetadata={(e) => {
								const v = e.currentTarget;
								if (selectedClip) v.currentTime = selectedClip.startSec;
							}}
						></video>
						<p class="yt-note">Full video stored — export downloads MP4 clips via ffmpeg.</p>
					{:else if source.youtubeId}
						<div class="yt-wrap">
							<iframe
								title="YouTube preview"
								src="https://www.youtube.com/embed/{source.youtubeId}?start={Math.floor(selectedClip?.startSec ?? 0)}&autoplay=0"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowfullscreen
							></iframe>
						</div>
						<p class="yt-note">Install yt-dlp to download the full video and enable MP4 export.</p>
					{/if}

					{#if selectedClip}
						<div class="now-playing">
							<Play size={14} />
							<span>
								{selectedClip.title} · {formatTimestamp(selectedClip.startSec)} – {formatTimestamp(selectedClip.endSec)}
								({formatClipDuration(selectedClip.startSec, selectedClip.endSec)})
							</span>
						</div>
					{/if}
				</div>

				<div class="clips-panel">
					<h3 class="clips-heading">Clips ranked by virality</h3>
					<ul class="clips-list">
						{#each clips as clip (clip.id)}
							<li>
								<button
									type="button"
									class="clip-card"
									class:clip-card-on={selectedClipId === clip.id}
									onclick={() => {
										selectedClipId = clip.id;
										const v = document.querySelector<HTMLVideoElement>('.native-player');
										if (v) {
											v.currentTime = clip.startSec;
											void v.play();
										}
									}}
								>
									<div class="clip-score" style="--score: {clip.viralityScore}%">
										<span>{clip.viralityScore}</span>
									</div>
									<div class="clip-body">
										<div class="clip-title">{clip.title}</div>
										<div class="clip-hook">{clip.hook}</div>
										<div class="clip-times">
											{formatTimestamp(clip.startSec)} – {formatTimestamp(clip.endSec)}
											· {formatClipDuration(clip.startSec, clip.endSec)}
										</div>
									</div>
									<ChevronRight size={16} class="clip-chevron" />
								</button>
								<div class="clip-actions">
									<button
										type="button"
										class="btn-small"
										disabled={phase === 'exporting' || !source?.r2Key}
										onclick={() => void downloadClip(clip)}
										title={source?.r2Key ? 'Download MP4 clip' : 'Requires yt-dlp download'}
									>
										{#if phase === 'exporting'}
											<Loader size={14} class="spin" />
										{:else}
											<Download size={14} />
										{/if}
										Export
									</button>
									<a
										class="btn-small btn-studio"
										href="/dashboard/studio?blank=1"
										title="Open blank canvas to design a post around this clip"
									>
										<Film size={14} />
										Studio
									</a>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.videos-page {
		min-height: 100%;
		background: var(--app-bg);
		color: var(--app-text);
	}

	.videos-hero {
		background: linear-gradient(165deg, #0c0c10 0%, #1a1028 45%, #0f172a 100%);
		color: #f8fafc;
		padding: 2.5rem 1.5rem 3rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.videos-hero-inner {
		max-width: 720px;
		margin: 0 auto;
	}

	.videos-hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #f9a8d4;
		margin-bottom: 0.75rem;
	}

	.videos-title {
		font-size: clamp(1.75rem, 4vw, 2.35rem);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.1;
		margin: 0 0 0.5rem;
	}

	.tools-warn {
		margin: 0 0 1rem;
		padding: 0.6rem 0.85rem;
		border-radius: 0.5rem;
		background: rgba(251, 191, 36, 0.15);
		border: 1px solid rgba(251, 191, 36, 0.35);
		color: #fde68a;
		font-size: 0.78rem;
		line-height: 1.45;
	}

	.videos-sub {
		margin: 0 0 1.75rem;
		color: rgba(248, 250, 252, 0.72);
		font-size: 0.95rem;
		line-height: 1.5;
		max-width: 36rem;
	}

	.import-card {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 1rem;
		padding: 1.25rem;
		backdrop-filter: blur(12px);
	}

	.import-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.import-tab {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.45);
	}

	.import-tab-on {
		color: #fff;
	}

	.import-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.import-icon {
		flex-shrink: 0;
		opacity: 0.5;
	}

	.import-input {
		flex: 1;
		min-width: 0;
		height: 2.5rem;
		border-radius: 0.65rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: rgba(0, 0, 0, 0.35);
		color: #fff;
		padding: 0 0.75rem;
		font-size: 0.875rem;
	}

	.import-input::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 2.5rem;
		padding: 0 1rem;
		border-radius: 0.65rem;
		border: none;
		background: linear-gradient(135deg, #f472b6, #e11d48);
		color: #fff;
		font-weight: 700;
		font-size: 0.8rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-primary:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.import-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1rem 0;
		color: rgba(255, 255, 255, 0.35);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.import-divider::before,
	.import-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(255, 255, 255, 0.1);
	}

	.upload-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 1.5rem;
		border: 2px dashed rgba(255, 255, 255, 0.18);
		border-radius: 0.75rem;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		color: rgba(255, 255, 255, 0.85);
	}

	.upload-zone:hover {
		border-color: rgba(244, 114, 182, 0.55);
		background: rgba(244, 114, 182, 0.06);
	}

	.upload-title {
		font-weight: 700;
		font-size: 0.875rem;
	}

	.upload-hint {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.45);
	}

	.upload-bar {
		width: 100%;
		max-width: 12rem;
		height: 4px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		margin-top: 0.5rem;
		overflow: hidden;
	}

	.upload-bar-fill {
		height: 100%;
		background: #f472b6;
		border-radius: 999px;
		transition: width 0.2s;
	}

	.hint-input {
		width: 100%;
		margin-top: 0.75rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(0, 0, 0, 0.25);
		color: #fff;
		padding: 0 0.65rem;
		font-size: 0.8rem;
	}

	.videos-error {
		margin-top: 1rem;
		padding: 0.65rem 0.85rem;
		border-radius: 0.5rem;
		background: rgba(239, 68, 68, 0.15);
		color: #fecaca;
		font-size: 0.8rem;
	}

	.results {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem 3rem;
	}

	.results-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.results-head h2 {
		font-size: 1.35rem;
		font-weight: 800;
		margin: 0 0 0.35rem;
	}

	.results-meta {
		font-size: 0.8rem;
		color: var(--app-text-2);
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.demo-pill,
	.model-pill {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		background: color-mix(in oklab, #f472b6 18%, transparent);
		color: #be185d;
	}

	.results-summary {
		margin: 0.75rem 0 0;
		font-size: 0.875rem;
		line-height: 1.55;
		color: var(--app-text-2);
		max-width: 42rem;
	}

	.btn-ghost {
		border: 1px solid var(--app-border);
		background: var(--app-surface);
		border-radius: 0.5rem;
		padding: 0.45rem 0.85rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--app-text);
	}

	.results-grid {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.1fr);
		gap: 1.5rem;
		align-items: start;
	}

	@media (max-width: 900px) {
		.results-grid {
			grid-template-columns: 1fr;
		}
	}

	.player-panel {
		position: sticky;
		top: 1rem;
	}

	.yt-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 9 / 16;
		max-height: 70vh;
		border-radius: 0.75rem;
		overflow: hidden;
		background: #000;
	}

	.yt-wrap iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.yt-note {
		font-size: 0.72rem;
		color: var(--app-text-3);
		margin: 0.5rem 0 0;
	}

	.native-player {
		width: 100%;
		max-height: 70vh;
		border-radius: 0.75rem;
		background: #000;
	}

	.now-playing {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.65rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--app-text-2);
	}

	.clips-heading {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--app-text-3);
		margin: 0 0 0.75rem;
		font-weight: 700;
	}

	.clips-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.clip-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		text-align: left;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid var(--app-border);
		background: var(--app-surface);
		cursor: pointer;
		transition: border-color 0.12s, box-shadow 0.12s;
	}

	.clip-card-on {
		border-color: #e11d48;
		box-shadow: 0 0 0 1px rgba(225, 29, 72, 0.25);
	}

	.clip-score {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		background: linear-gradient(
			180deg,
			rgba(225, 29, 72, 0.9) 0%,
			rgba(225, 29, 72, 0.9) var(--score),
			rgba(0, 0, 0, 0.06) var(--score)
		);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 800;
		color: #fff;
		flex-shrink: 0;
	}

	.clip-body {
		flex: 1;
		min-width: 0;
	}

	.clip-title {
		font-weight: 700;
		font-size: 0.875rem;
		margin-bottom: 0.2rem;
	}

	.clip-hook {
		font-size: 0.78rem;
		color: var(--app-text-2);
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.clip-times {
		font-size: 0.7rem;
		color: var(--app-text-3);
		margin-top: 0.25rem;
		font-variant-numeric: tabular-nums;
	}

	.clip-chevron {
		opacity: 0.25;
		flex-shrink: 0;
	}

	.clip-actions {
		display: flex;
		gap: 0.35rem;
		padding: 0 0.75rem 0.5rem 4.25rem;
	}

	.btn-small {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.55rem;
		border-radius: 0.4rem;
		border: 1px solid var(--app-border);
		background: var(--app-surface-2);
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--app-text);
		text-decoration: none;
	}

	.btn-studio {
		border-color: color-mix(in oklab, #7c3aed 35%, var(--app-border));
	}

	:global(.spin) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
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
