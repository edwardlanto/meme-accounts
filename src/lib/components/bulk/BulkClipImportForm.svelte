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
	import {
		Link2,
		Upload,
		Sparkles,
		Loader,
		AlertCircle,
		Film,
	} from 'lucide-svelte';

	type Props = {
		userId: string;
		oncomplete?: (result: BulkClipImportResult) => void;
	};

	let { userId, oncomplete }: Props = $props();

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
		updatedAt?: string;
	};
	let apiProjects = $state<ApiClipProject[]>([]);

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
</script>

<div class="import-form">
	{#if toolsWarning}
		<p class="warn" role="status"><AlertCircle size={14} /> {toolsWarning}</p>
	{/if}

	{#if apiProjects.length || savedJobs.length}
		<div class="recent">
			<span class="recent-label">Recent</span>
			<ul class="recent-list">
				{#each apiProjects.slice(0, 4) as project (project.id)}
					<li>
						<button
							type="button"
							class="recent-item"
							disabled={busy}
							onclick={() => openApiProject(project.id)}
						>
							<Film size={14} />
							<span class="recent-title">{project.title}</span>
							<span class="recent-meta">
								{project.clipCount} clips
								{#if project.hasBulkShows}· edited{/if}
							</span>
						</button>
					</li>
				{/each}
				{#each savedJobs.slice(0, 2) as job (job.id)}
					<li>
						<button type="button" class="recent-item recent-local" disabled={busy} onclick={() => openSavedJob(job.id)}>
							<Film size={14} />
							<span class="recent-title">{job.title || job.session.source.title}</span>
							<span class="recent-meta">{job.clipCount} clips · local</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
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

<style>
	.import-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.warn {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #b45309;
		margin: 0;
		line-height: 1.35;
	}
	.recent-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--app-text-3);
	}
	.recent-list {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.recent-item {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--bulk-border, #e2e8f0);
		border-radius: 8px;
		background: var(--app-surface);
		cursor: pointer;
		font-size: 0.78rem;
		color: var(--app-text);
		text-align: left;
	}
	.recent-item:hover:not(:disabled) {
		border-color: var(--app-accent, #7bf1a8);
	}
	.recent-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.recent-meta {
		font-size: 0.68rem;
		color: var(--app-text-3);
		flex-shrink: 0;
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
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--bulk-border, #e2e8f0);
		border-radius: 8px;
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
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--bulk-border, #e2e8f0);
		border-radius: 8px;
		background: var(--app-surface);
		color: var(--app-text);
	}
	.btn-find {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		width: 100%;
		padding: 0.55rem 0.75rem;
		border: none;
		border-radius: 10px;
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
		padding: 1.25rem;
		border: 2px dashed var(--bulk-border, #e2e8f0);
		border-radius: 12px;
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
		padding-top: 0.25rem;
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
</style>
