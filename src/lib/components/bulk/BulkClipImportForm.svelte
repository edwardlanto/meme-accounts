<script lang="ts">
	import { onMount } from 'svelte';
	import { r2UploadVideo } from '$lib/r2Client';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import { normalizeVideoClips } from '$lib/video-clips/normalize-clips';
	import {
		CLIP_LENGTH_PRESETS,
		applyClipLengthPreset,
		type ClipLengthPresetId,
	} from '$lib/video-clips/clip-presets';
	import {
		loadSavedVideoClips,
		saveVideoClipsToLibrary,
		getSavedVideoClipsEntry,
		type SavedVideoClipsEntry,
	} from '$lib/video-clips/session-cache';
	import type { BulkClipImportResult } from '$lib/studio/bulk-video-clips';
	import type { BulkShow } from '$lib/studio/bulk-to-studio';
	import {
		Link2,
		Upload,
		Sparkles,
		Loader,
		AlertCircle,
		Film,
		Clapperboard,
	} from 'lucide-svelte';

	type Props = {
		userId: string;
		/** `split` = page layout (form + recent side-by-side). `stack` = dialog. */
		layout?: 'stack' | 'split';
		oncomplete?: (result: BulkClipImportResult) => void;
	};

	let { userId, layout = 'stack', oncomplete }: Props = $props();

	let importTab = $state<'youtube' | 'upload'>('youtube');
	let youtubeUrl = $state('');
	let topicHint = $state('');
	let clipMode = $state<'highlights' | 'all'>('highlights');
	let clipCount = $state(3);
	let clipLengthPreset = $state<ClipLengthPresetId>('30to60');
	let clipMinSec = $state(30);
	let clipMaxSec = $state(60);
	let phase = $state<'idle' | 'importing' | 'downloading' | 'analyzing'>('idle');
	let error = $state('');
	let uploadProgress = $state(0);
	let isDragging = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let ytDlpReady = $state(false);
	let toolsWarning = $state('');
	let savedJobs = $state<SavedVideoClipsEntry[]>([]);
	type ApiClipProject = {
		id: string;
		title: string;
		clipCount: number;
		hasBulkShows: boolean;
		thumbnailUrl?: string | null;
		updatedAt?: string;
	};
	let apiProjects = $state<ApiClipProject[]>([]);
	let brokenThumbs = $state<Record<string, true>>({});

	onMount(async () => {
		savedJobs = loadSavedVideoClips();
		try {
			const res = await fetch('/api/videos/clip-projects');
			if (res.ok) {
				const data = (await res.json()) as { projects?: ApiClipProject[] };
				apiProjects = data.projects ?? [];
			}
		} catch {
			/* ignore */
		}
		try {
			const res = await fetch('/api/videos/tools');
			if (res.ok) {
				const t = (await res.json()) as { ytDlp?: boolean; warning?: string };
				ytDlpReady = !!t.ytDlp;
				toolsWarning = String(t.warning ?? '');
			}
		} catch {
			/* ignore */
		}
	});

	function onLengthPresetChange(id: ClipLengthPresetId) {
		clipLengthPreset = id;
		const { minSec, maxSec } = applyClipLengthPreset(id);
		clipMinSec = minSec;
		clipMaxSec = maxSec;
	}

	function analyzePayload(extra: Record<string, unknown>) {
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

	function finish(result: BulkClipImportResult) {
		saveVideoClipsToLibrary({
			youtubeUrl,
			topicHint,
			importTab,
			clipMode,
			clipCount,
			clipMinSec,
			clipMaxSec,
			source: result.source,
			clips: result.clips,
			summary: result.summary,
			demo: result.demo,
			model: result.model,
			selectedClipId: result.clips[0]?.id ?? null,
			workflowStep: 'clips',
		});
		savedJobs = loadSavedVideoClips();
		oncomplete?.(result);
	}

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
				body: JSON.stringify(analyzePayload({ source: 'youtube', youtubeUrl: url })),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			const source = data.source as VideoImportMeta;
			const clips = normalizeVideoClips(
				data.clips ?? [],
				data.source?.durationSec ?? 1,
				clipMinSec,
				clipMaxSec,
			);
			finish({
				source,
				clips,
				summary: data.summary ?? '',
				demo: !!data.demo,
				model: data.model ?? '',
				projectId: data.projectId ?? undefined,
			});
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
					analyzePayload({
						source: 'upload',
						r2Key: up.key,
						title: file.name.replace(/\.[^.]+$/, ''),
						durationSec,
					}),
				),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			const source = data.source as VideoImportMeta;
			const clips = normalizeVideoClips(
				data.clips ?? [],
				data.source?.durationSec ?? durationSec,
				clipMinSec,
				clipMaxSec,
			);
			uploadProgress = 100;
			finish({
				source,
				clips,
				summary: data.summary ?? '',
				demo: !!data.demo,
				model: data.model ?? '',
				projectId: data.projectId ?? undefined,
			});
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : String(err);
			phase = 'idle';
		} finally {
			if (fileInput) fileInput.value = '';
		}
	}

	function openSavedJob(id: string) {
		const entry = getSavedVideoClipsEntry(id);
		if (!entry) return;
		const s = entry.session;
		finish({
			source: s.source,
			clips: s.clips,
			summary: s.summary,
			demo: s.demo,
			model: s.model,
		});
	}

	async function openApiProject(id: string) {
		error = '';
		phase = 'analyzing';
		try {
			const res = await fetch(`/api/videos/clip-projects/${id}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Could not load project');
			const project = data.project as {
				id: string;
				source: VideoImportMeta;
				clips: VideoClip[];
				summary: string;
				demo: boolean;
				model: string;
				bulkShows?: BulkShow[] | null;
			};
			finish({
				source: project.source,
				clips: project.clips,
				summary: project.summary,
				demo: project.demo,
				model: project.model,
				projectId: project.id,
				bulkShows: project.bulkShows ?? undefined,
			});
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'idle';
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
		void onFileChange({ target: { files: [file] } } as unknown as Event);
	}

	function markThumbBroken(key: string) {
		brokenThumbs = { ...brokenThumbs, [key]: true };
	}

	function timeAgo(iso?: string | number) {
		const t = typeof iso === 'number' ? iso : Date.parse(String(iso ?? ''));
		if (!Number.isFinite(t)) return '';
		const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
		if (sec < 60) return 'just now';
		if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
		if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
		if (sec < 86400 * 14) return `${Math.floor(sec / 86400)}d ago`;
		return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	const busy = $derived(phase !== 'idle');
	const statusLabel = $derived(
		phase === 'importing'
			? 'Uploading…'
			: phase === 'downloading'
				? 'Downloading from YouTube…'
				: phase === 'analyzing'
					? 'Finding clips…'
					: '',
	);
	const hasRecent = $derived(apiProjects.length > 0 || savedJobs.length > 0);
	const recentApi = $derived(apiProjects.slice(0, layout === 'split' ? 8 : 4));
	const recentLocal = $derived(savedJobs.slice(0, layout === 'split' ? 4 : 2));
</script>

<div class="import-form" class:layout-split={layout === 'split'}>
	{#if toolsWarning}
		<p class="warn" role="status"><AlertCircle size={14} /> {toolsWarning}</p>
	{/if}

	<div class="compose-col">
		{#if layout === 'stack' && hasRecent}
			{@render recentPanel()}
		{/if}

		<div class="tabs">
			<button type="button" class:tab-on={importTab === 'youtube'} disabled={busy} onclick={() => (importTab = 'youtube')}>
				<Link2 size={14} /> YouTube link
			</button>
			<button type="button" class:tab-on={importTab === 'upload'} disabled={busy} onclick={() => (importTab = 'upload')}>
				<Upload size={14} /> Upload file
			</button>
		</div>

		{#if importTab === 'youtube'}
			<label class="field">
				<span>YouTube URL</span>
				<input
					bind:value={youtubeUrl}
					placeholder="https://youtube.com/watch?v=…"
					disabled={busy}
					onkeydown={(e) => e.key === 'Enter' && void analyzeFromYoutube()}
				/>
			</label>
			<button type="button" class="btn-find" disabled={busy} onclick={() => void analyzeFromYoutube()}>
				{#if busy}
					<Loader size={15} class="spin" />
					{statusLabel}
				{:else}
					<Sparkles size={15} />
					Find clips
				{/if}
			</button>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="dropzone"
				class:drag-on={isDragging}
				ondragover={onDragOver}
				ondragleave={onDragLeave}
				ondrop={onDrop}
				onclick={() => !busy && fileInput?.click()}
			>
				<Upload size={22} />
				<p>Drop video or click to upload</p>
				<span>MP4, WebM, MOV — max 200 MB</span>
				{#if phase === 'importing' || phase === 'analyzing'}
					<span class="upload-pct">{uploadProgress}%</span>
				{/if}
			</div>
			<input
				type="file"
				accept="video/mp4,video/webm,video/quicktime"
				class="hidden-input"
				bind:this={fileInput}
				onchange={(e) => void onFileChange(e)}
			/>
		{/if}

		<div class="prefs">
			<label class="field">
				<span>Mode</span>
				<select bind:value={clipMode} disabled={busy}>
					<option value="highlights">Best highlights</option>
					<option value="all">Split full video</option>
				</select>
			</label>
			{#if clipMode === 'highlights'}
				<label class="field">
					<span>Clips</span>
					<input type="number" min="1" max="40" bind:value={clipCount} disabled={busy} />
				</label>
			{/if}
			<label class="field">
				<span>Length</span>
				<select
					value={clipLengthPreset}
					disabled={busy}
					onchange={(e) => onLengthPresetChange((e.currentTarget as HTMLSelectElement).value as ClipLengthPresetId)}
				>
					{#each CLIP_LENGTH_PRESETS as p}
						<option value={p.id}>{p.label}</option>
					{/each}
				</select>
			</label>
			<label class="field grow">
				<span>Topic hint</span>
				<input bind:value={topicHint} placeholder="e.g. best moments" disabled={busy} />
			</label>
		</div>

		{#if error}
			<p class="err" role="alert">{error}</p>
		{/if}
	</div>

	{#if layout === 'split'}
		<aside class="recent-col" aria-label="Recent clip projects">
			{@render recentPanel()}
		</aside>
	{/if}
</div>

{#snippet recentPanel()}
	<div class="recent" class:recent-empty={!hasRecent}>
		<div class="recent-head">
			<span class="recent-label">Recent</span>
			{#if hasRecent}
				<span class="recent-count">{apiProjects.length + savedJobs.length}</span>
			{/if}
		</div>

		{#if hasRecent}
			<ul class="recent-grid" class:recent-grid-stack={layout === 'stack'}>
				{#each recentApi as project (project.id)}
					{@const thumbKey = `api:${project.id}`}
					{@const thumb = String(project.thumbnailUrl ?? '').trim()}
					<li>
						<button
							type="button"
							class="recent-card"
							disabled={busy}
							onclick={() => openApiProject(project.id)}
						>
							<span class="recent-thumb">
								{#if thumb && !brokenThumbs[thumbKey]}
									<img
										src={thumb}
										alt=""
										loading="lazy"
										referrerpolicy="no-referrer"
										draggable="false"
										onerror={() => markThumbBroken(thumbKey)}
									/>
								{:else}
									<span class="recent-thumb-fallback">
										<Film size={18} strokeWidth={1.6} />
									</span>
								{/if}
								<span class="recent-badge">{project.clipCount}</span>
							</span>
							<span class="recent-copy">
								<span class="recent-title">{project.title}</span>
								<span class="recent-meta">
									{project.clipCount} clip{project.clipCount === 1 ? '' : 's'}
									{#if project.hasBulkShows} · edited{/if}
									{#if project.updatedAt}
										 · {timeAgo(project.updatedAt)}
									{/if}
								</span>
							</span>
						</button>
					</li>
				{/each}
				{#each recentLocal as job (job.id)}
					{@const thumbKey = `local:${job.id}`}
					{@const thumb = String(job.thumbnailUrl ?? job.session.source?.thumbnailUrl ?? '').trim()}
					<li>
						<button
							type="button"
							class="recent-card recent-local"
							disabled={busy}
							onclick={() => openSavedJob(job.id)}
						>
							<span class="recent-thumb">
								{#if thumb && !brokenThumbs[thumbKey]}
									<img
										src={thumb}
										alt=""
										loading="lazy"
										referrerpolicy="no-referrer"
										draggable="false"
										onerror={() => markThumbBroken(thumbKey)}
									/>
								{:else}
									<span class="recent-thumb-fallback">
										<Film size={18} strokeWidth={1.6} />
									</span>
								{/if}
								<span class="recent-badge">{job.clipCount}</span>
							</span>
							<span class="recent-copy">
								<span class="recent-title">{job.title || job.session.source.title}</span>
								<span class="recent-meta">
									{job.clipCount} clips · local
									{#if job.savedAt} · {timeAgo(job.savedAt)}{/if}
								</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else if layout === 'split'}
			<div class="recent-empty-state">
				<span class="empty-icon"><Clapperboard size={28} strokeWidth={1.5} /></span>
				<p class="empty-title">No projects yet</p>
				<p class="empty-sub">
					Find clips from a YouTube link or upload — they’ll land here so you can reopen them fast.
				</p>
			</div>
		{/if}
	</div>
{/snippet}

<style>
	.import-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.import-form.layout-split {
		display: grid;
		grid-template-columns: minmax(300px, 0.92fr) minmax(320px, 1.08fr);
		gap: 1.35rem;
		align-items: start;
	}
	.compose-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.recent-col {
		min-width: 0;
		min-height: 100%;
	}
	.warn {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #b45309;
		margin: 0;
		line-height: 1.35;
		grid-column: 1 / -1;
	}
	.recent-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.55rem;
	}
	.recent-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--app-text-3);
	}
	.recent-count {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--app-text-3);
		background: var(--app-surface-3);
		border-radius: 999px;
		padding: 0.12rem 0.45rem;
	}
	.layout-split .recent {
		height: 100%;
		padding: 0.95rem;
		border: 1px solid var(--app-border);
		border-radius: 16px;
		background: color-mix(in oklab, var(--app-surface) 65%, transparent);
	}
	.recent-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}
	.recent-grid-stack {
		grid-template-columns: 1fr;
		gap: 0.45rem;
	}
	.recent-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0;
		width: 100%;
		padding: 0;
		border: 1px solid var(--bulk-border, #e2e8f0);
		border-radius: 12px;
		background: var(--app-surface-2, #fff);
		cursor: pointer;
		text-align: left;
		overflow: hidden;
		transition:
			border-color 0.18s ease,
			box-shadow 0.18s ease,
			transform 0.18s ease;
	}
	.recent-grid-stack .recent-card {
		flex-direction: row;
		align-items: center;
		gap: 0.65rem;
		padding: 0.35rem 0.45rem 0.35rem 0.35rem;
	}
	.recent-card:hover:not(:disabled) {
		border-color: color-mix(in oklab, var(--app-accent, #7bf1a8) 55%, #c5c9d0);
		box-shadow: 0 6px 18px -10px rgba(15, 15, 16, 0.22);
		transform: translateY(-1px);
	}
	.recent-card:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	.recent-thumb {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		width: 100%;
		background: #111;
		overflow: hidden;
		flex-shrink: 0;
	}
	.recent-grid-stack .recent-thumb {
		width: 72px;
		aspect-ratio: 16 / 9;
		border-radius: 8px;
	}
	.recent-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.recent-thumb-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: rgba(255, 255, 255, 0.55);
		background:
			radial-gradient(120% 90% at 20% 10%, rgba(123, 241, 168, 0.22), transparent 55%),
			linear-gradient(145deg, #1a1a1a, #0d0d0d);
	}
	.recent-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 1;
		padding: 0.12rem 0.4rem;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.72);
		color: #fff;
		font-size: 0.62rem;
		font-weight: 700;
		line-height: 1.2;
		pointer-events: none;
	}
	.recent-copy {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.55rem 0.65rem 0.65rem;
		min-width: 0;
	}
	.recent-grid-stack .recent-copy {
		padding: 0;
		flex: 1;
	}
	.recent-title {
		font-size: 0.78rem;
		font-weight: 650;
		color: var(--app-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.25;
	}
	.recent-meta {
		font-size: 0.66rem;
		color: var(--app-text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.recent-empty-state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 0.4rem;
		min-height: 220px;
		padding: 0.35rem 0.15rem 0.5rem;
	}
	.empty-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 14px;
		margin-bottom: 0.25rem;
		color: #0f0f10;
		background: color-mix(in oklab, var(--app-accent, #7bf1a8) 70%, white);
	}
	.empty-title {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--app-text);
		letter-spacing: -0.01em;
	}
	.empty-sub {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--app-text-2);
		max-width: 32ch;
	}
	.tabs {
		display: flex;
		gap: 0.35rem;
	}
	.tabs button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.5rem 0.55rem;
		border: 1px solid var(--bulk-border, #e2e8f0);
		border-radius: 10px;
		background: var(--app-surface);
		font-size: 0.78rem;
		font-weight: 650;
		color: var(--app-text-2);
		cursor: pointer;
	}
	.tabs button.tab-on {
		border-color: var(--app-accent, #7bf1a8);
		background: color-mix(in oklab, var(--app-accent, #7bf1a8) 18%, transparent);
		color: var(--app-text);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.65rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--app-text-3);
	}
	.field.grow {
		flex: 1;
	}
	.field input,
	.field select {
		font: inherit;
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.82rem;
		font-weight: 550;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--bulk-border, #e2e8f0);
		border-radius: 10px;
		background: var(--app-surface);
		color: var(--app-text);
	}
	.btn-find {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		width: 100%;
		padding: 0.62rem 0.75rem;
		border: none;
		border-radius: 12px;
		background: var(--app-accent, #7bf1a8);
		color: #080808;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}
	.btn-find:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 1.35rem;
		border: 2px dashed var(--bulk-border, #e2e8f0);
		border-radius: 14px;
		color: var(--app-text-2);
		cursor: pointer;
		text-align: center;
	}
	.dropzone.drag-on {
		border-color: var(--app-accent, #7bf1a8);
		background: color-mix(in oklab, var(--app-accent, #7bf1a8) 12%, transparent);
	}
	.dropzone p {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 650;
		color: var(--app-text);
	}
	.dropzone span {
		font-size: 0.72rem;
	}
	.upload-pct {
		font-weight: 700;
		color: var(--app-text);
	}
	.hidden-input {
		display: none;
	}
	.prefs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.5rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--bulk-border, #e2e8f0);
	}
	.err {
		margin: 0;
		font-size: 0.78rem;
		color: #b91c1c;
	}
	:global(.spin) {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 900px) {
		.import-form.layout-split {
			grid-template-columns: 1fr;
		}
		.recent-grid:not(.recent-grid-stack) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.recent-grid:not(.recent-grid-stack) {
			grid-template-columns: 1fr;
		}
	}
</style>
