<script lang="ts">
	import {
		CAPTION_TEMPLATES,
		getCaptionTemplate,
		ANIMATION_OPTIONS,
		CHUNK_SIZE_OPTIONS,
		type CaptionAnimation,
	} from '$lib/video-clips/caption-templates';
	import type { CaptionSegment } from '$lib/video-clips/caption-sync';
	import { formatTranscriptTimestamp } from '$lib/video-clips/transcript-segments';
	import { Switch } from '$lib/components/ui/switch';
	import { Slider } from '$lib/components/ui/slider';
	import { Label } from '$lib/components/ui/label';
	import { Type, Sparkles, Pencil, Trash2, RotateCcw } from 'lucide-svelte';

	type Props = {
		enabled: boolean;
		selectedTemplateId: string;
		fontSize: number;
		position: 'top' | 'center' | 'bottom';
		customColor?: string;
		customBgColor?: string;
		customHighlightColor?: string;
		draggable?: boolean;
		selectedFont?: string;
		strokeEnabled?: boolean;
		animationOverride?: CaptionAnimation | null;
		wordsPerChunkOverride?: number | null;
		/** Editable caption segments (word/phrase cues with timing) */
		segments?: CaptionSegment[];
		/** Jump player to a cue when its row is clicked */
		onseek?: (sec: number) => void;
		/** Reset segments to original transcript for this clip */
		onreset?: () => void;
		/** Fired when Top/Center/Bottom preset is chosen — clears free-drag coords */
		onpositionpreset?: () => void;
	};

	let {
		enabled = $bindable(false),
		selectedTemplateId = $bindable('capcut-pop'),
		fontSize = $bindable(40),
		position = $bindable('bottom'),
		customColor = $bindable('#ffffff'),
		customBgColor = $bindable('transparent'),
		customHighlightColor = $bindable('#ffeb3b'),
		draggable = $bindable(false),
		selectedFont = $bindable('Inter'),
		strokeEnabled = $bindable(true),
		animationOverride = $bindable(null),
		wordsPerChunkOverride = $bindable(null),
		segments = $bindable([] as CaptionSegment[]),
		onseek,
		onreset,
		onpositionpreset,
	}: Props = $props();

	let selectedTemplate = $derived(getCaptionTemplate(selectedTemplateId));
	let effectiveAnimation = $derived(animationOverride ?? selectedTemplate.animation);
	let effectiveChunkSize = $derived(
		wordsPerChunkOverride ?? selectedTemplate.wordsPerChunk,
	);
	let showEditor = $state(true);

	/** <input type="color"> cannot hold "transparent" — keep a separate picker value. */
	const bgColorPickerValue = $derived(
		customBgColor && /^#[0-9a-fA-F]{6}$/.test(customBgColor) ? customBgColor : '#000000',
	);
	const hasCustomBg = $derived(
		!!customBgColor && customBgColor !== 'transparent' && customBgColor !== 'none',
	);

	function setBackgroundFromPicker(value: string) {
		customBgColor = value;
	}

	function clearBackground() {
		customBgColor = 'transparent';
	}

	function handleTemplateClick(id: string) {
		selectedTemplateId = id;
		// Reset forced bg when switching to a transparent template so boxes don't stick
		const next = getCaptionTemplate(id);
		if (next.backgroundColor === 'transparent' || next.backgroundColor === 'none') {
			customBgColor = 'transparent';
		} else {
			customBgColor = next.backgroundColor;
		}
	}

	function handleFontSizeChange(values: number[]) {
		fontSize = values[0] ?? 28;
	}

	function updateSegmentText(index: number, text: string) {
		segments = segments.map((s, i) => (i === index ? { ...s, text } : s));
	}

	function deleteSegment(index: number) {
		segments = segments.filter((_, i) => i !== index);
	}

	function seekTo(sec: number) {
		onseek?.(sec);
	}
</script>

<div class="caption-controls">
	<div class="controls-header">
		<div class="header-title">
			<Type size={16} />
			<h3>Subtitle</h3>
		</div>
		<div class="enable-toggle">
			<Label for="caption-enabled" class="toggle-label">Enable Caption</Label>
			<Switch id="caption-enabled" bind:checked={enabled} />
		</div>
	</div>

	{#if enabled}
		<div class="controls-body">
			<!-- Edit Caption Text -->
			<div class="control-section settings-panel">
				<div class="section-header-row">
					<Label class="section-label">
						<Pencil size={12} />
						Edit Caption Text
						{#if segments.length}
							<span class="count-badge">{segments.length}</span>
						{/if}
					</Label>
					<div class="editor-actions">
						{#if onreset}
							<button
								type="button"
								class="icon-btn"
								onclick={() => onreset?.()}
								title="Reset to original transcript"
							>
								<RotateCcw size={13} />
								Reset
							</button>
						{/if}
						<button
							type="button"
							class="icon-btn"
							onclick={() => (showEditor = !showEditor)}
						>
							{showEditor ? 'Hide' : 'Show'}
						</button>
					</div>
				</div>

				{#if showEditor}
					{#if segments.length === 0}
						<p class="editor-empty">No caption cues for this clip yet.</p>
					{:else}
						<p class="editor-hint">
							Edit any word — changes show live on the video. Click a time to jump there.
						</p>
						<ul class="caption-edit-list">
							{#each segments as seg, i (i)}
								<li class="caption-edit-row">
									<button
										type="button"
										class="cue-time"
										onclick={() => seekTo(seg.startSec)}
										title="Jump to this cue"
									>
										{formatTranscriptTimestamp(seg.startSec)}
									</button>
									<input
										type="text"
										class="cue-text"
										value={seg.text}
										oninput={(e) => updateSegmentText(i, e.currentTarget.value)}
										aria-label="Caption text at {formatTranscriptTimestamp(seg.startSec)}"
									/>
									<button
										type="button"
										class="cue-delete"
										onclick={() => deleteSegment(i)}
										aria-label="Delete caption cue"
										title="Delete"
									>
										<Trash2 size={14} />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>

			<!-- Template Selection -->
			<div class="control-section">
				<div class="section-header-row">
					<Label class="section-label">
						<Sparkles size={12} />
						Style Preset
					</Label>
					<div class="drag-toggle" title="Drag captions on the video preview">
						<Label for="drag-caption" class="toggle-label-small">Move on preview</Label>
						<Switch id="drag-caption" bind:checked={draggable} />
					</div>
				</div>
				<div class="template-grid">
					{#each CAPTION_TEMPLATES as template (template.id)}
						<button
							type="button"
							class="template-card"
							class:template-card-active={selectedTemplateId === template.id}
							onclick={() => handleTemplateClick(template.id)}
						>
							<div
								class="template-preview"
								style="
									font-family: {template.fontFamily};
									font-size: 11px;
									font-weight: {template.fontWeight};
									color: {template.textColor};
									background: {template.backgroundColor === 'transparent' ? '#222' : template.backgroundColor};
									text-transform: {template.textTransform};
									padding: 6px 10px;
									border-radius: {template.borderRadius};
									{template.textStroke ? `
										-webkit-text-stroke: 1px ${template.strokeColor};
										paint-order: stroke fill;
									` : ''}
								"
							>
								{template.name}
							</div>
							<div class="template-meta">
								<span class="meta-chip">{template.animation}</span>
								{#if template.wordsPerChunk > 0}
									<span class="meta-chip">{template.wordsPerChunk}w</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- CapCut Style Panel -->
			<div class="control-section settings-panel">
				<Label class="section-label">
					<Sparkles size={12} />
					Motion & Chunking
				</Label>

				<!-- Animation Style -->
				<div class="setting-row">
					<Label for="animation-select" class="setting-label">
						Animation ({effectiveAnimation})
					</Label>
					<div class="chip-grid">
						{#each ANIMATION_OPTIONS as opt (opt.value)}
							<button
								type="button"
								class="chip"
								class:chip-active={effectiveAnimation === opt.value}
								onclick={() => (animationOverride = opt.value)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Words per chunk -->
				<div class="setting-row">
					<Label class="setting-label">
						Words per line
						({effectiveChunkSize === 0 ? 'full line' : `${effectiveChunkSize} word${effectiveChunkSize > 1 ? 's' : ''}`})
					</Label>
					<div class="chip-grid">
						{#each CHUNK_SIZE_OPTIONS as opt (opt.value)}
							<button
								type="button"
								class="chip"
								class:chip-active={effectiveChunkSize === opt.value}
								onclick={() => (wordsPerChunkOverride = opt.value)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Highlight Color (for karaoke / active word) -->
				<div class="setting-row">
					<Label for="highlight-color" class="setting-label">
						Highlight Color (active word)
					</Label>
					<div class="color-input-group">
						<input
							id="highlight-color"
							type="color"
							bind:value={customHighlightColor}
							class="color-picker"
						/>
						<input
							type="text"
							bind:value={customHighlightColor}
							class="color-hex-input"
							placeholder="#ffeb3b"
						/>
					</div>
				</div>
			</div>

			<!-- Settings Panel -->
			<div class="control-section settings-panel">
				<Label class="section-label">Setting</Label>
				
				<!-- Font Selector -->
				<div class="setting-row">
					<Label for="font-select" class="setting-label">Font</Label>
					<select
						id="font-select"
						bind:value={selectedFont}
						class="font-select"
					>
						<option value="Inter">Inter</option>
						<option value="Bangers">Bangers</option>
						<option value="Impact">Impact</option>
						<option value="Arial Black">Arial Black</option>
						<option value="Georgia">Georgia</option>
						<option value="Helvetica">Helvetica</option>
					</select>
				</div>

				<!-- Font Size -->
				<div class="setting-row">
					<Label class="setting-label">Font Size</Label>
					<Slider
						value={[fontSize]}
						onValueChange={handleFontSizeChange}
						min={16}
						max={72}
						step={2}
						class="font-size-slider"
					/>
				</div>

				<!-- Stroke -->
				<div class="setting-row">
					<Label class="setting-label">Stroke</Label>
					<div class="stroke-buttons">
						<button
							type="button"
							class="stroke-btn"
							class:stroke-btn-active={strokeEnabled}
							onclick={() => (strokeEnabled = true)}
							aria-label="Fill stroke"
						>
							<div class="stroke-circle filled"></div>
						</button>
						<button
							type="button"
							class="stroke-btn"
							class:stroke-btn-active={!strokeEnabled}
							onclick={() => (strokeEnabled = false)}
							aria-label="Outline stroke"
						>
							<div class="stroke-circle outline"></div>
						</button>
					</div>
				</div>

				<!-- Background Color -->
				<div class="setting-row">
					<Label for="bg-color-setting" class="setting-label">Background Color</Label>
					<div class="color-input-group">
						<input
							id="bg-color-setting"
							type="color"
							value={bgColorPickerValue}
							class="color-picker"
							onchange={(e) => setBackgroundFromPicker(e.currentTarget.value)}
						/>
						<input
							type="text"
							value={hasCustomBg ? customBgColor : 'transparent'}
							class="color-hex-input"
							placeholder="transparent"
							oninput={(e) => {
								const v = e.currentTarget.value.trim();
								customBgColor = v || 'transparent';
							}}
						/>
						<button
							type="button"
							class="bg-clear-btn"
							class:bg-clear-on={!hasCustomBg}
							onclick={clearBackground}
						>
							None
						</button>
					</div>
				</div>

				<!-- Subtitle Position -->
				<div class="setting-row">
					<Label for="position-select" class="setting-label">Subtitle Position</Label>
					<select
						id="position-select"
						value={position}
						class="position-select"
						onchange={(e) => {
							position = (e.currentTarget as HTMLSelectElement).value as
								| 'top'
								| 'center'
								| 'bottom';
							onpositionpreset?.();
						}}
					>
						<option value="top">Top</option>
						<option value="center">Center</option>
						<option value="bottom">Bottom</option>
					</select>
				</div>
			</div>

		</div>
	{/if}
</div>

<style>
	.caption-controls {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem;
		margin-top: 1.5rem;
		color: #0f172a;
	}

	.controls-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #0f172a;
	}

	.header-title h3 {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0;
		color: #0f172a;
	}

	.enable-toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.controls-body {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.control-section {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.section-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.drag-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.caption-controls .section-label),
	:global(.caption-controls .toggle-label),
	:global(.caption-controls .toggle-label-small) {
		font-size: 0.8rem;
		font-weight: 600;
		color: #334155 !important;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
	}

	:global(.caption-controls .toggle-label-small) {
		font-size: 0.75rem;
		font-weight: 500;
	}

	.settings-panel {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem;
		gap: 1rem;
	}

	.setting-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	:global(.caption-controls .setting-label) {
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569 !important;
		margin: 0;
	}

	.font-select,
	.position-select {
		width: 100%;
		padding: 0.6rem 0.8rem;
		background: #fff;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		color: #0f172a;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.font-select:hover,
	.position-select:hover {
		background: #f8fafc;
		border-color: #94a3b8;
	}

	.font-select:focus,
	.position-select:focus {
		outline: none;
		border-color: #7c3aed;
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
	}

	.stroke-buttons {
		display: flex;
		gap: 0.75rem;
	}

	.stroke-btn {
		background: #fff;
		border: 1.5px solid #cbd5e1;
		border-radius: 6px;
		padding: 0.7rem;
		cursor: pointer;
		transition: all 0.2s ease;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.stroke-btn:hover {
		background: #f8fafc;
		border-color: #94a3b8;
	}

	.stroke-btn-active {
		background: #f5f3ff;
		border-color: #7c3aed;
	}

	.stroke-circle {
		width: 24px;
		height: 24px;
		border-radius: 50%;
	}

	.stroke-circle.filled {
		background: #0f172a;
	}

	.stroke-circle.outline {
		background: transparent;
		border: 2px solid #0f172a;
	}

	.color-input-group {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.bg-clear-btn {
		padding: 0.3rem 0.55rem;
		border-radius: 0.4rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		color: #64748b;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
	}

	.bg-clear-btn:hover {
		background: #f8fafc;
		color: #334155;
	}

	.bg-clear-on {
		border-color: #93c5fd;
		background: #eff6ff;
		color: #1d4ed8;
	}

	.color-hex-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		background: #fff;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		color: #0f172a;
		font-size: 0.8rem;
		font-family: 'SF Mono', Monaco, monospace;
	}

	.color-hex-input:focus {
		outline: none;
		border-color: #7c3aed;
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
	}

	.template-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.6rem;
		max-height: 280px;
		overflow-y: auto;
		padding: 0.25rem;
	}

	.template-card {
		background: #fff;
		border: 1.5px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.7rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 60px;
	}

	.template-card:hover {
		background: #f8fafc;
		border-color: #cbd5e1;
		transform: translateY(-2px);
	}

	.template-card-active {
		background: #f5f3ff;
		border-color: #7c3aed;
	}

	.template-preview {
		text-align: center;
		width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.template-meta {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.meta-chip {
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #475569;
		background: #f1f5f9;
		border: 1px solid #e2e8f0;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.chip-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip {
		background: #fff;
		border: 1px solid #cbd5e1;
		color: #334155;
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.chip:hover {
		background: #f8fafc;
		border-color: #94a3b8;
		color: #0f172a;
	}

	.chip-active {
		background: #7c3aed;
		border-color: #7c3aed;
		color: #fff;
	}

	.color-picker {
		width: 48px;
		height: 32px;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		cursor: pointer;
		background: #fff;
	}

	.count-badge {
		font-size: 0.65rem;
		font-weight: 700;
		background: #ede9fe;
		color: #6d28d9;
		padding: 2px 7px;
		border-radius: 999px;
	}

	.editor-actions {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: #fff;
		border: 1px solid #cbd5e1;
		color: #475569;
		padding: 0.3rem 0.6rem;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.icon-btn:hover {
		background: #f8fafc;
		border-color: #94a3b8;
		color: #0f172a;
	}

	.editor-hint {
		margin: 0;
		font-size: 0.72rem;
		color: #64748b;
		line-height: 1.4;
	}

	.editor-empty {
		margin: 0;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.caption-edit-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 260px;
		overflow-y: auto;
	}

	.caption-edit-row {
		display: grid;
		grid-template-columns: 52px 1fr 32px;
		gap: 0.4rem;
		align-items: center;
	}

	.cue-time {
		background: #f1f5f9;
		border: 1px solid #e2e8f0;
		color: #7c3aed;
		font-size: 0.7rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		padding: 0.4rem 0.35rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.cue-time:hover {
		background: #ede9fe;
		border-color: #c4b5fd;
	}

	.cue-text {
		width: 100%;
		padding: 0.4rem 0.6rem;
		background: #fff;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		color: #0f172a;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.cue-text:focus {
		outline: none;
		border-color: #7c3aed;
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
	}

	.cue-delete {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid transparent;
		color: #94a3b8;
		border-radius: 6px;
		padding: 0.35rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.cue-delete:hover {
		background: #fef2f2;
		border-color: #fecaca;
		color: #dc2626;
	}

	.template-grid::-webkit-scrollbar,
	.caption-edit-list::-webkit-scrollbar {
		width: 6px;
	}

	.template-grid::-webkit-scrollbar-track,
	.caption-edit-list::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 3px;
	}

	.template-grid::-webkit-scrollbar-thumb,
	.caption-edit-list::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 3px;
	}

	.template-grid::-webkit-scrollbar-thumb:hover,
	.caption-edit-list::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>
