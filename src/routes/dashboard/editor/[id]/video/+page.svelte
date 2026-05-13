<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { wizardStore } from '$lib/stores/wizard';
	import SlideCard from '$lib/components/SlideCard.svelte';
	import { toPng } from 'html-to-image';
	import {
		ChevronLeft, Play, Pause, Upload, Music, Video, Download,
		Loader, Check, AlertCircle, X, Volume2, Clock, Zap
	} from 'lucide-svelte';

	const carouselId = $derived($page.params.id);

	// ── Data ──────────────────────────────────────────────────────────────
	let slides = $state<any[]>([]);
	let images = $state<string[]>([]);
	let brandColor = $state('#E8FF48');
	let brandName = $state('Your Brand');
	let loading = $state(true);

	// ── Slide timing ──────────────────────────────────────────────────────
	let durations = $state<number[]>([]); // seconds per slide
	let defaultDuration = $state(3);

	// ── Audio ─────────────────────────────────────────────────────────────
	let audioFile = $state<File | null>(null);
	let audioUrl = $state('');
	let audioDuration = $state(0);
	let audioEl = $state<HTMLAudioElement | null>(null);
	let audioDropping = $state(false);
	let audioInputEl = $state<HTMLInputElement | null>(null);

	// ── Playback preview ──────────────────────────────────────────────────
	let playing = $state(false);
	let previewIdx = $state(0);
	let previewTimer: ReturnType<typeof setTimeout>;
	let previewProgress = $state(0); // 0–100

	// ── Slide export refs (off-screen renders) ────────────────────────────
	let exportRefs = $state<(HTMLElement | null)[]>([]);

	// ── Rendering ─────────────────────────────────────────────────────────
	let rendering = $state(false);
	let renderPct = $state(0);
	let renderPhase = $state('');
	let renderDone = $state(false);
	let renderError = $state('');

	// ── Active preview slide ──────────────────────────────────────────────
	let activeSlide = $state(0);

	const totalDuration = $derived(durations.reduce((a, b) => a + b, 0));
	const totalWithAudio = $derived(audioDuration > 0 ? Math.max(totalDuration, audioDuration) : totalDuration);

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }

		// 1. Try wizard store first (fresh from generator)
		const ws = $wizardStore;
		if (ws.slides.length > 0) {
			slides = ws.slides;
			images = ws.images;
			brandColor = ws.brandColor;
			brandName = ws.brandName;
		}

		// 2. Always load from Supabase to get latest
		if (carouselId) {
			const { data } = await (supabase as any)
				.from('carousels')
				.select('*')
				.eq('id', carouselId)
				.single();

			if (data) {
				if (!slides.length) {
					slides = typeof data.slides === 'string' ? JSON.parse(data.slides) : (data.slides ?? []);
				}
				const cfg = typeof data.style_config === 'string'
					? JSON.parse(data.style_config)
					: (data.style_config ?? {});
				if (!images.length && cfg.images) images = cfg.images;
				if (cfg.brandColor) brandColor = cfg.brandColor;
				if (cfg.brandName)  brandName  = cfg.brandName;
			}
		}

		durations = slides.map(() => defaultDuration);
		exportRefs = new Array(slides.length).fill(null);
		loading = false;
	});

	onDestroy(() => { clearTimeout(previewTimer); });

	// ── Audio handling ────────────────────────────────────────────────────
	async function loadAudio(file: File) {
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		audioFile = file;
		audioUrl = URL.createObjectURL(file);

		// Get duration
		const tmp = new Audio(audioUrl);
		await new Promise<void>(r => { tmp.onloadedmetadata = () => { audioDuration = tmp.duration; r(); }; });
	}

	function onAudioDrop(e: DragEvent) {
		e.preventDefault();
		audioDropping = false;
		const file = e.dataTransfer?.files[0];
		if (file && file.type.startsWith('audio/')) loadAudio(file);
	}

	function removeAudio() {
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		audioFile = null;
		audioUrl = '';
		audioDuration = 0;
	}

	function setDuration(i: number, val: number) {
		durations = durations.map((d, idx) => idx === i ? val : d);
	}

	function applyAll() {
		durations = durations.map(() => defaultDuration);
	}

	// ── Preview playback ──────────────────────────────────────────────────
	function togglePlay() {
		if (playing) {
			stopPlay();
		} else {
			startPlay();
		}
	}

	function startPlay() {
		playing = true;
		previewIdx = 0;
		activeSlide = 0;
		if (audioEl && audioUrl) {
			audioEl.currentTime = 0;
			audioEl.play();
		}
		advancePreview();
	}

	function stopPlay() {
		playing = false;
		clearTimeout(previewTimer);
		previewProgress = 0;
		if (audioEl) audioEl.pause();
	}

	function advancePreview() {
		if (!playing) return;
		activeSlide = previewIdx;
		const dur = durations[previewIdx] * 1000;
		const start = Date.now();

		function tick() {
			if (!playing) return;
			const elapsed = Date.now() - start;
			previewProgress = Math.min((elapsed / dur) * 100, 100);
			if (elapsed < dur) {
				previewTimer = setTimeout(tick, 50);
			} else {
				previewProgress = 0;
				if (previewIdx < slides.length - 1) {
					previewIdx++;
					advancePreview();
				} else {
					stopPlay();
				}
			}
		}
		previewTimer = setTimeout(tick, 50);
	}

	// ── Video export ──────────────────────────────────────────────────────
	async function exportVideo() {
		rendering = true;
		renderPct = 0;
		renderDone = false;
		renderError = '';

		try {
			// Phase 1: export slide PNGs
			renderPhase = 'Capturing slides…';
			const slideImages: string[] = [];

			for (let i = 0; i < exportRefs.length; i++) {
				const el = exportRefs[i];
				if (!el) continue;
				const png = await toPng(el, { width: 1080, height: 1350, pixelRatio: 1 });
				slideImages.push(png);
				renderPct = Math.round(((i + 1) / exportRefs.length) * 35);
			}

			renderPhase = 'Setting up canvas…';

			// Phase 2: set up canvas
			const canvas = document.createElement('canvas');
			canvas.width = 1080;
			canvas.height = 1350;
			const ctx = canvas.getContext('2d')!;

			// Phase 3: set up audio
			let audioBuffer: AudioBuffer | null = null;
			let audioCtx: AudioContext | null = null;
			let audioSource: AudioBufferSourceNode | null = null;
			let audioDestination: MediaStreamAudioDestinationNode | null = null;

			if (audioFile) {
				renderPhase = 'Loading audio…';
				audioCtx = new AudioContext();
				const arrayBuffer = await audioFile.arrayBuffer();
				audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
				audioDestination = audioCtx.createMediaStreamDestination();
				audioSource = audioCtx.createBufferSource();
				audioSource.buffer = audioBuffer;

				// Volume node
				const gainNode = audioCtx.createGain();
				gainNode.gain.value = 1.0;
				audioSource.connect(gainNode);
				gainNode.connect(audioDestination);
			}

			// Phase 4: set up MediaRecorder
			renderPhase = 'Starting recorder…';
			const videoStream = canvas.captureStream(30);
			const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
			if (audioDestination) tracks.push(...audioDestination.stream.getAudioTracks());

			const combinedStream = new MediaStream(tracks);

			// Find best supported format
			const mimeTypes = [
				'video/webm;codecs=vp9,opus',
				'video/webm;codecs=vp8,opus',
				'video/webm',
			];
			const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';

			const recorder = new MediaRecorder(combinedStream, {
				mimeType,
				videoBitsPerSecond: 6_000_000,
			});

			const chunks: Blob[] = [];
			recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

			const recorderDone = new Promise<void>(resolve => {
				recorder.onstop = () => resolve();
			});

			recorder.start(100);
			if (audioSource) audioSource.start(0);

			// Phase 5: draw slides
			renderPhase = 'Rendering frames…';
			const totalMs = totalDuration * 1000;
			let elapsed = 0;

			for (let i = 0; i < slideImages.length; i++) {
				const img = new Image();
				img.src = slideImages[i];
				await new Promise<void>(r => { img.onload = () => r(); });
				ctx.drawImage(img, 0, 0, 1080, 1350);

				const dur = (durations[i] ?? defaultDuration) * 1000;
				const frameStart = Date.now();

				await new Promise<void>(resolve => {
					function waitFrame() {
						const now = Date.now();
						const sinceStart = now - frameStart;
						elapsed += sinceStart;
						renderPct = 35 + Math.round((elapsed / totalMs) * 60);
						if (sinceStart < dur) {
							setTimeout(waitFrame, 50);
						} else {
							resolve();
						}
					}
					setTimeout(waitFrame, 50);
				});
			}

			recorder.stop();
			if (audioCtx) audioCtx.close();

			await recorderDone;

			// Phase 6: download
			renderPhase = 'Packaging video…';
			renderPct = 98;
			const blob = new Blob(chunks, { type: mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `carousel-${Date.now()}.webm`;
			a.click();
			URL.revokeObjectURL(url);

			renderPct = 100;
			renderDone = true;
			renderPhase = 'Done!';

		} catch (err: any) {
			renderError = err.message;
			console.error('[video-export]', err);
		} finally {
			rendering = false;
		}
	}

	function fmtTime(s: number) {
		const m = Math.floor(s / 60);
		const sec = Math.round(s % 60);
		return `${m}:${String(sec).padStart(2, '0')}`;
	}
</script>

<!-- Hidden audio element for preview -->
{#if audioUrl}
	<audio bind:this={audioEl} src={audioUrl} preload="auto"></audio>
{/if}

<!-- Off-screen slide renders for export -->
<div style="position: fixed; left: -9999px; top: 0; pointer-events: none; opacity: 0;">
	{#each slides as slide, i}
		<SlideCard
			{slide}
			{images}
			{brandColor}
			{brandName}
			total={slides.length}
			scale={1}
			bind:exportRef={exportRefs[i]}
		/>
	{/each}
</div>

<div class="vpage">

	<!-- ── Header ──────────────────────────────────────────────────────── -->
	<div class="vheader">
		<a href="/dashboard/editor/{carouselId}" class="back-link">
			<ChevronLeft size={15} /> Back to editor
		</a>
		<div class="vheader-center">
			<Video size={14} class="lime" />
			<span class="vheader-title">Video Burner</span>
		</div>
		<div class="vheader-right">
			{#if !rendering}
				<button
					class="export-btn"
					onclick={exportVideo}
					disabled={slides.length === 0 || rendering}
				>
					<Zap size={14} /> Export Video
				</button>
			{:else}
				<div class="export-progress">
					<div class="progress-bar">
						<div class="progress-fill" style="width: {renderPct}%"></div>
					</div>
					<span class="progress-label">{renderPhase}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="loading-center">
			<Loader size={24} class="spin lime" />
			<p>Loading carousel…</p>
		</div>
	{:else}
		<div class="vlayout">

			<!-- ── Left: Slide timeline ──────────────────────────────────── -->
			<div class="vtimeline">
				<div class="panel-head">
					<Clock size={13} />
					<span>Slide Timing</span>
					<span class="total-dur">{fmtTime(totalDuration)}</span>
				</div>

				<!-- Default duration -->
				<div class="default-dur-row">
					<label class="tiny-label">Default (sec)</label>
					<div class="dur-stepper">
						<button onclick={() => defaultDuration = Math.max(1, defaultDuration - 1)}>−</button>
						<span>{defaultDuration}s</span>
						<button onclick={() => defaultDuration = Math.min(15, defaultDuration + 1)}>+</button>
					</div>
					<button class="apply-all" onclick={applyAll}>Apply all</button>
				</div>

				<!-- Slide list -->
				<div class="slide-list">
					{#each slides as slide, i}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="slide-row {activeSlide === i ? 'active' : ''}"
							onclick={() => { activeSlide = i; if (playing) stopPlay(); }}
							role="button"
							tabindex="0"
						>
							<!-- Mini thumb -->
							<div class="mini-thumb">
								<SlideCard
									{slide}
									{images}
									{brandColor}
									{brandName}
									total={slides.length}
									scale={0.055}
								/>
							</div>

							<!-- Slide info + duration -->
							<div class="slide-row-info">
								<p class="slide-row-headline">{slide.headline}</p>
								<p class="slide-row-type">{slide.type} · {slide.layout}</p>
							</div>

							<!-- Duration control -->
							<div class="dur-mini">
								<button onclick={(e) => { e.stopPropagation(); setDuration(i, Math.max(1, durations[i] - 1)); }}>−</button>
								<span>{durations[i]}s</span>
								<button onclick={(e) => { e.stopPropagation(); setDuration(i, Math.min(15, durations[i] + 1)); }}>+</button>
							</div>
						</div>

						<!-- Progress bar (active during playback) -->
						{#if playing && activeSlide === i}
							<div class="slide-progress">
								<div class="slide-progress-fill" style="width: {previewProgress}%"></div>
							</div>
						{/if}
					{/each}
				</div>
			</div>

			<!-- ── Center: Preview ───────────────────────────────────────── -->
			<div class="vpreview">
				<!-- Slide preview -->
				<div class="preview-stage">
					{#if slides[activeSlide]}
						<SlideCard
							slide={slides[activeSlide]}
							{images}
							{brandColor}
							{brandName}
							total={slides.length}
							scale={0.36}
						/>
					{/if}

					<!-- Play overlay -->
					<button class="play-btn" onclick={togglePlay}>
						{#if playing}
							<Pause size={22} />
						{:else}
							<Play size={22} />
						{/if}
					</button>

					<!-- Slide counter -->
					<div class="slide-counter">
						{activeSlide + 1} / {slides.length}
					</div>
				</div>

				<!-- Filmstrip -->
				<div class="filmstrip">
					{#each slides as slide, i}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="film-chip {activeSlide === i ? 'active' : ''}"
							onclick={() => { activeSlide = i; if (playing) stopPlay(); }}
							role="button"
							tabindex="0"
						>
							<SlideCard
								{slide}
								{images}
								{brandColor}
								{brandName}
								total={slides.length}
								scale={0.085}
							/>
						</div>
					{/each}
				</div>

				<!-- Total time info -->
				<div class="time-info">
					<span class="time-stat">
						<Clock size={11} /> {fmtTime(totalDuration)} slides
					</span>
					{#if audioDuration > 0}
						<span class="time-stat">
							<Music size={11} /> {fmtTime(audioDuration)} audio
						</span>
						<span class="time-stat {totalDuration < audioDuration ? 'warn' : ''}">
							Total: {fmtTime(totalWithAudio)}
							{#if totalDuration < audioDuration}· audio longer than slides{/if}
						</span>
					{/if}
				</div>
			</div>

			<!-- ── Right: Audio ──────────────────────────────────────────── -->
			<div class="vaudio">
				<div class="panel-head">
					<Music size={13} />
					<span>Audio Track</span>
				</div>

				{#if !audioFile}
					<!-- Drop zone -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="audio-drop {audioDropping ? 'dropping' : ''}"
						role="button"
						tabindex="0"
						onclick={() => audioInputEl?.click()}
						ondragover={(e) => { e.preventDefault(); audioDropping = true; }}
						ondragleave={() => audioDropping = false}
						ondrop={onAudioDrop}
					>
						<input
							bind:this={audioInputEl}
							type="file"
							accept="audio/*"
							class="hidden-input"
							onchange={(e) => {
								const f = e.currentTarget.files?.[0];
								if (f) loadAudio(f);
							}}
						/>
						<div class="audio-drop-icon">
							<Music size={24} />
						</div>
						<p class="audio-drop-text">Drop audio here</p>
						<p class="audio-drop-sub">MP3, WAV, M4A, AAC</p>
						<button class="browse-btn">Browse files</button>
					</div>

					<div class="audio-tips">
						<p class="tip-head">Tips for best results</p>
						<ul class="tip-list">
							<li>Match audio length to your total slide duration</li>
							<li>Use upbeat background music for engagement</li>
							<li>Avoid tracks with lyrics if you want clear voiceover</li>
						</ul>
					</div>
				{:else}
					<!-- Audio loaded -->
					<div class="audio-loaded">
						<div class="audio-info">
							<div class="audio-icon-wrap">
								<Music size={18} />
							</div>
							<div class="audio-meta">
								<p class="audio-filename">{audioFile.name}</p>
								<p class="audio-dur">{fmtTime(audioDuration)}</p>
							</div>
							<button class="remove-audio" onclick={removeAudio}>
								<X size={14} />
							</button>
						</div>

						<!-- Waveform placeholder (visual) -->
						<div class="waveform">
							{#each Array(40) as _, i}
								<div
									class="wave-bar"
									style="height: {20 + Math.sin(i * 0.8) * 15 + Math.random() * 20}px; animation-delay: {i * 0.05}s"
								></div>
							{/each}
						</div>

						<!-- Volume -->
						<div class="vol-row">
							<Volume2 size={13} class="muted" />
							<input type="range" min="0" max="100" value="80" class="vol-slider" />
							<span class="vol-label">80%</span>
						</div>

						<!-- Audio player -->
						<audio
							src={audioUrl}
							controls
							class="audio-player"
						></audio>
					</div>
				{/if}

				<!-- Export section -->
				<div class="export-section">
					<div class="export-head">
						<Video size={13} />
						<span>Export</span>
					</div>

					{#if renderDone}
						<div class="export-done">
							<Check size={18} />
							<p>Video downloaded!</p>
							<p class="export-done-sub">Check your downloads folder for the .webm file</p>
						</div>
					{:else if renderError}
						<div class="export-error">
							<AlertCircle size={16} />
							<p>{renderError}</p>
						</div>
					{:else if rendering}
						<div class="rendering-state">
							<div class="render-progress-bar">
								<div class="render-progress-fill" style="width: {renderPct}%"></div>
							</div>
							<p class="render-phase">{renderPhase}</p>
							<p class="render-pct">{renderPct}%</p>
						</div>
					{:else}
						<div class="export-info">
							<div class="export-stat">
								<span class="ekey">Format</span>
								<span class="eval">WebM (VP9)</span>
							</div>
							<div class="export-stat">
								<span class="ekey">Resolution</span>
								<span class="eval">1080 × 1350</span>
							</div>
							<div class="export-stat">
								<span class="ekey">Slides</span>
								<span class="eval">{slides.length}</span>
							</div>
							<div class="export-stat">
								<span class="ekey">Duration</span>
								<span class="eval">{fmtTime(totalDuration)}</span>
							</div>
						</div>
						<button
							class="big-export-btn"
							onclick={exportVideo}
							disabled={slides.length === 0}
						>
							<Zap size={16} /> Burn to Video
						</button>
						<p class="export-note">Video is generated in your browser — no uploads needed.</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.vpage {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #070707;
		overflow: hidden;
		font-family: 'Satoshi', sans-serif;
	}

	/* ── Header ──────────────────────────────────────────────────────────── */
	.vheader {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		height: 56px;
		border-bottom: 1px solid rgba(255,255,255,0.05);
		flex-shrink: 0;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: rgba(255,255,255,0.3);
		text-decoration: none;
		transition: color 0.15s;
	}
	.back-link:hover { color: rgba(255,255,255,0.7); }

	.vheader-center {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: 'Satoshi', sans-serif;
		font-size: 12px;
		color: rgba(255,255,255,0.5);
	}

	.vheader-title {
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.vheader-right { display: flex; align-items: center; gap: 12px; }

	.export-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #E8FF48;
		color: #0a0a0a;
		border: none;
		border-radius: 8px;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		font-family: 'Satoshi', sans-serif;
	}
	.export-btn:hover:not(:disabled) { background: #f0ff6e; }
	.export-btn:disabled { opacity: 0.3; cursor: not-allowed; }

	.export-progress {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.progress-bar {
		width: 120px;
		height: 4px;
		background: rgba(255,255,255,0.08);
		border-radius: 100px;
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: #E8FF48;
		border-radius: 100px;
		transition: width 0.3s;
	}
	.progress-label {
		font-family: 'Satoshi', sans-serif;
		font-size: 11px;
		color: rgba(255,255,255,0.3);
	}

	/* ── Layout ──────────────────────────────────────────────────────────── */
	.loading-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: rgba(255,255,255,0.3);
		font-size: 14px;
	}

	.vlayout {
		flex: 1;
		display: grid;
		grid-template-columns: 260px 1fr 240px;
		overflow: hidden;
	}

	/* ── Timeline ────────────────────────────────────────────────────────── */
	.vtimeline {
		border-right: 1px solid rgba(255,255,255,0.05);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.panel-head {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 14px 16px;
		border-bottom: 1px solid rgba(255,255,255,0.04);
		font-family: 'Satoshi', sans-serif;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255,255,255,0.25);
		flex-shrink: 0;
	}

	.total-dur {
		margin-left: auto;
		color: #E8FF48;
		font-size: 11px;
	}

	.default-dur-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-bottom: 1px solid rgba(255,255,255,0.04);
		flex-shrink: 0;
	}

	.tiny-label {
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(255,255,255,0.2);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		flex: 1;
	}

	.dur-stepper {
		display: flex;
		align-items: center;
		gap: 0;
		background: rgba(255,255,255,0.05);
		border: 1px solid rgba(255,255,255,0.07);
		border-radius: 6px;
		overflow: hidden;
	}
	.dur-stepper button {
		width: 24px; height: 24px;
		background: transparent;
		border: none;
		color: rgba(255,255,255,0.4);
		cursor: pointer;
		font-size: 14px;
		transition: background 0.1s;
	}
	.dur-stepper button:hover { background: rgba(255,255,255,0.08); }
	.dur-stepper span {
		font-family: 'Satoshi', sans-serif;
		font-size: 11px;
		color: rgba(255,255,255,0.5);
		min-width: 28px;
		text-align: center;
	}

	.apply-all {
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(232,255,72,0.5);
		background: transparent;
		border: none;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}
	.apply-all:hover { color: #E8FF48; }

	.slide-list {
		flex: 1;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,0.08) transparent;
	}

	.slide-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid rgba(255,255,255,0.03);
		cursor: pointer;
		transition: background 0.1s;
	}
	.slide-row:hover { background: rgba(255,255,255,0.03); }
	.slide-row.active { background: rgba(232,255,72,0.04); }

	.mini-thumb {
		width: 59px;
		height: 74px;
		border-radius: 4px;
		overflow: hidden;
		flex-shrink: 0;
		border: 1px solid rgba(255,255,255,0.06);
	}

	.slide-row-info {
		flex: 1;
		min-width: 0;
	}
	.slide-row-headline {
		font-size: 11px;
		color: rgba(255,255,255,0.6);
		margin: 0 0 3px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.slide-row-type {
		font-family: 'Satoshi', sans-serif;
		font-size: 9px;
		color: rgba(255,255,255,0.2);
		text-transform: uppercase;
		margin: 0;
	}

	.dur-mini {
		display: flex;
		align-items: center;
		gap: 0;
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 5px;
		overflow: hidden;
		flex-shrink: 0;
	}
	.dur-mini button {
		width: 20px; height: 20px;
		background: transparent;
		border: none;
		color: rgba(255,255,255,0.3);
		cursor: pointer;
		font-size: 13px;
	}
	.dur-mini button:hover { background: rgba(255,255,255,0.07); }
	.dur-mini span {
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(255,255,255,0.4);
		min-width: 22px;
		text-align: center;
	}

	.slide-progress {
		height: 2px;
		background: rgba(255,255,255,0.05);
		margin: 0 14px;
	}
	.slide-progress-fill {
		height: 100%;
		background: #E8FF48;
		transition: width 0.05s linear;
	}

	/* ── Preview ─────────────────────────────────────────────────────────── */
	.vpreview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 24px;
		overflow: hidden;
	}

	.preview-stage {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 24px 60px rgba(0,0,0,0.6);
	}

	.play-btn {
		position: absolute;
		bottom: 12px;
		right: 12px;
		width: 44px; height: 44px;
		border-radius: 50%;
		background: rgba(0,0,0,0.7);
		backdrop-filter: blur(8px);
		border: 1.5px solid rgba(255,255,255,0.15);
		color: #fff;
		display: flex; align-items: center; justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
	}
	.play-btn:hover { background: rgba(232,255,72,0.15); border-color: rgba(232,255,72,0.4); }

	.slide-counter {
		position: absolute;
		top: 10px;
		left: 10px;
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(255,255,255,0.5);
		background: rgba(0,0,0,0.6);
		padding: 4px 8px;
		border-radius: 4px;
		backdrop-filter: blur(4px);
	}

	.filmstrip {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding: 4px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,0.08) transparent;
		max-width: 100%;
	}

	.film-chip {
		flex-shrink: 0;
		border-radius: 4px;
		overflow: hidden;
		cursor: pointer;
		opacity: 0.45;
		transition: opacity 0.15s;
		border: 2px solid transparent;
	}
	.film-chip:hover { opacity: 0.7; }
	.film-chip.active {
		opacity: 1;
		border-color: #E8FF48;
	}

	.time-info {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.time-stat {
		display: flex;
		align-items: center;
		gap: 5px;
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(255,255,255,0.25);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.time-stat.warn { color: #f59e0b; }

	/* ── Audio panel ─────────────────────────────────────────────────────── */
	.vaudio {
		border-left: 1px solid rgba(255,255,255,0.05);
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,0.06) transparent;
	}

	.audio-drop {
		margin: 12px;
		border: 1.5px dashed rgba(255,255,255,0.08);
		border-radius: 12px;
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		transition: all 0.15s;
		text-align: center;
	}
	.audio-drop:hover, .audio-drop.dropping {
		border-color: rgba(232,255,72,0.35);
		background: rgba(232,255,72,0.03);
	}
	.hidden-input { display: none; }

	.audio-drop-icon {
		width: 44px; height: 44px;
		border-radius: 10px;
		background: rgba(255,255,255,0.04);
		display: flex; align-items: center; justify-content: center;
		color: rgba(255,255,255,0.25);
	}

	.audio-drop-text {
		font-size: 13px;
		font-weight: 500;
		color: rgba(255,255,255,0.5);
		margin: 0;
	}

	.audio-drop-sub {
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(255,255,255,0.2);
		margin: 0;
	}

	.browse-btn {
		margin-top: 4px;
		padding: 6px 14px;
		border-radius: 6px;
		background: rgba(255,255,255,0.06);
		border: 1px solid rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.5);
		font-size: 12px;
		cursor: pointer;
		font-family: 'Satoshi', sans-serif;
		transition: all 0.15s;
	}
	.browse-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }

	.audio-tips {
		padding: 0 14px 14px;
	}
	.tip-head {
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255,255,255,0.2);
		margin: 0 0 8px;
	}
	.tip-list {
		list-style: none;
		padding: 0; margin: 0;
		display: flex; flex-direction: column; gap: 6px;
	}
	.tip-list li {
		font-size: 11px;
		color: rgba(255,255,255,0.25);
		padding-left: 12px;
		position: relative;
		line-height: 1.5;
	}
	.tip-list li::before {
		content: '→';
		position: absolute; left: 0;
		color: rgba(232,255,72,0.4);
	}

	/* ── Audio loaded ────────────────────────────────────────────────────── */
	.audio-loaded {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.audio-info {
		display: flex;
		align-items: center;
		gap: 10px;
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(255,255,255,0.07);
		border-radius: 10px;
		padding: 10px 12px;
	}

	.audio-icon-wrap {
		width: 34px; height: 34px;
		border-radius: 8px;
		background: rgba(232,255,72,0.1);
		border: 1px solid rgba(232,255,72,0.2);
		display: flex; align-items: center; justify-content: center;
		color: #E8FF48;
		flex-shrink: 0;
	}

	.audio-meta { flex: 1; min-width: 0; }
	.audio-filename {
		font-size: 12px;
		color: rgba(255,255,255,0.6);
		margin: 0 0 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.audio-dur {
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(255,255,255,0.3);
		margin: 0;
	}

	.remove-audio {
		width: 26px; height: 26px;
		border-radius: 6px;
		background: rgba(255,255,255,0.05);
		border: none;
		color: rgba(255,255,255,0.3);
		cursor: pointer;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.remove-audio:hover { background: rgba(239,68,68,0.15); color: #f87171; }

	/* ── Waveform ────────────────────────────────────────────────────────── */
	.waveform {
		height: 48px;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 0 4px;
		background: rgba(255,255,255,0.03);
		border-radius: 8px;
		overflow: hidden;
	}

	.wave-bar {
		flex: 1;
		background: rgba(232,255,72,0.35);
		border-radius: 2px;
		min-height: 4px;
		animation: wavePulse 2s ease-in-out infinite alternate;
	}
	@keyframes wavePulse {
		from { opacity: 0.3; }
		to { opacity: 0.8; }
	}

	.vol-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.vol-slider {
		flex: 1;
		height: 3px;
		accent-color: #E8FF48;
		cursor: pointer;
	}

	.vol-label {
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(255,255,255,0.3);
	}

	.audio-player {
		width: 100%;
		height: 32px;
		filter: invert(1) hue-rotate(200deg) brightness(0.7);
	}

	/* ── Export section ──────────────────────────────────────────────────── */
	.export-section {
		margin-top: auto;
		border-top: 1px solid rgba(255,255,255,0.05);
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.export-head {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255,255,255,0.2);
	}

	.export-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.export-stat {
		display: flex;
		justify-content: space-between;
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
	}
	.ekey { color: rgba(255,255,255,0.2); text-transform: uppercase; }
	.eval { color: rgba(255,255,255,0.5); }

	.big-export-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		border-radius: 10px;
		background: #E8FF48;
		color: #0a0a0a;
		font-weight: 700;
		font-size: 14px;
		border: none;
		cursor: pointer;
		transition: all 0.15s;
		font-family: 'Satoshi', sans-serif;
	}
	.big-export-btn:hover:not(:disabled) {
		background: #f0ff6e;
		transform: translateY(-1px);
		box-shadow: 0 8px 24px rgba(232,255,72,0.25);
	}
	.big-export-btn:disabled { opacity: 0.3; cursor: not-allowed; }

	.export-note {
		font-size: 10px;
		color: rgba(255,255,255,0.2);
		text-align: center;
		margin: 0;
	}

	.export-done {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		color: #E8FF48;
		text-align: center;
	}
	.export-done p { font-size: 13px; font-weight: 600; margin: 0; color: #E8FF48; }
	.export-done-sub { font-size: 11px; color: rgba(255,255,255,0.3) !important; }

	.export-error {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #f87171;
		font-size: 12px;
		background: rgba(239,68,68,0.08);
		border: 1px solid rgba(239,68,68,0.15);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.rendering-state {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.render-progress-bar {
		width: 100%;
		height: 4px;
		background: rgba(255,255,255,0.07);
		border-radius: 100px;
		overflow: hidden;
	}
	.render-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #E8FF48, #a3ff00);
		border-radius: 100px;
		transition: width 0.4s ease;
	}
	.render-phase {
		font-family: 'Satoshi', sans-serif;
		font-size: 10px;
		color: rgba(255,255,255,0.3);
		margin: 0;
	}
	.render-pct {
		font-family: 'Satoshi', sans-serif;
		font-size: 13px;
		color: #E8FF48;
		margin: 0;
	}

	/* ── Utility ─────────────────────────────────────────────────────────── */
	:global(.lime) { color: #E8FF48; }
	:global(.muted) { color: rgba(255,255,255,0.25); }
	:global(.spin) { animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
