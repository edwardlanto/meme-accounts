<script lang="ts">
	import type { TextStyle } from '$lib/types';
	import type { HighlightSpec } from '$lib/highlight';
	import { AVAILABLE_PATTERNS } from '$lib/highlight';
	import {
		GOOGLE_FONTS,
		CATEGORY_LABELS,
		loadGoogleFont,
		type FontCategory,
	} from '$lib/fonts';
	import {
		Bold, Italic, Underline,
		AlignLeft, AlignCenter, AlignRight,
		ChevronDown, Type, Minus, Plus, RotateCcw, Highlighter,
	} from 'lucide-svelte';

	interface Props {
		/** Screen-space anchor rect (usually getBoundingClientRect of the text element). */
		anchor: DOMRect | null;
		/** Current style for the selected element. */
		style: TextStyle;
		/** The auto-computed font size the template would use when fontSize is undefined. */
		autoFontSize?: number;
		/** Whether the currently-selected element supports [[...]] highlight markup.
		 *  (Headline: yes; source label: no.) */
		supportsHighlights?: boolean;
		/** Whether the user currently has a range of text selected inside the element.
		 *  Disables highlight buttons until they select something. */
		hasRangeSelection?: boolean;
		onChange: (patch: Partial<TextStyle>) => void;
		onHighlight?: (spec: HighlightSpec) => void;
		onReset: () => void;
		onClose: () => void;
	}

	let {
		anchor,
		style,
		autoFontSize = 72,
		supportsHighlights = false,
		hasRangeSelection = false,
		onChange,
		onHighlight,
		onReset,
		onClose,
	}: Props = $props();

	let fontPickerOpen = $state(false);
	let fontSearch = $state('');
	let colorPickerOpen = $state(false);
	let highlightPickerOpen = $state(false);

	// Position the toolbar above the anchored element, clamped to the viewport.
	const TOOLBAR_W = 740;
	const TOOLBAR_H = 48;

	const HIGHLIGHT_PRESETS = [
		'#F5A623', '#08EBFF', '#FF3B5C', '#A855F7',
		'#10B981', '#FFD700', '#FF6B6B', '#4ECDC4',
	];
	const GRADIENT_PRESETS: [string, string][] = [
		['#F5A623', '#FF3B5C'],
		['#08EBFF', '#A855F7'],
		['#10B981', '#08EBFF'],
		['#FFFFFF', '#F5A623'],
	];

	function applyHighlight(spec: HighlightSpec) {
		onHighlight?.(spec);
		highlightPickerOpen = false;
	}

	const pos = $derived.by(() => {
		if (!anchor) return { top: 0, left: 0, show: false };
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		let top = anchor.top - TOOLBAR_H - 12;
		if (top < 12) top = anchor.bottom + 12; // flip below if no room above
		let left = anchor.left + anchor.width / 2 - TOOLBAR_W / 2;
		left = Math.max(12, Math.min(left, vw - TOOLBAR_W - 12));
		return { top, left, show: true };
	});

	const filteredFonts = $derived(
		fontSearch
			? GOOGLE_FONTS.filter((f) => f.family.toLowerCase().includes(fontSearch.toLowerCase()))
			: GOOGLE_FONTS,
	);

	const groupedFonts = $derived.by(() => {
		const g: Record<FontCategory, typeof GOOGLE_FONTS> = {
			sans: [], serif: [], display: [], handwriting: [], mono: [],
		};
		for (const f of filteredFonts) g[f.category].push(f);
		return g;
	});

	const effectiveSize = $derived(style.fontSize ?? autoFontSize);
	const isSizeOverridden = $derived(style.fontSize !== undefined);

	function pickFont(family: string) {
		// Pre-load so preview swaps instantly when user hovers next time.
		void loadGoogleFont(family);
		onChange({ fontFamily: family });
		fontPickerOpen = false;
		fontSearch = '';
	}

	function bumpSize(delta: number) {
		const next = Math.max(12, Math.min(400, effectiveSize + delta));
		onChange({ fontSize: next });
	}

	function setSize(v: number) {
		if (Number.isFinite(v)) onChange({ fontSize: Math.max(12, Math.min(400, v)) });
	}

	// Preload top fonts once mounted so the picker previews render fast.
	$effect(() => {
		if (fontPickerOpen) {
			for (const f of filteredFonts.slice(0, 30)) void loadGoogleFont(f.family);
		}
	});

	function handleDocumentClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('[data-floating-toolbar]')) return;
		if (target.closest('[data-text-selectable]')) return;
		onClose();
	}

	$effect(() => {
		if (pos.show) {
			document.addEventListener('mousedown', handleDocumentClick);
			return () => document.removeEventListener('mousedown', handleDocumentClick);
		}
	});
</script>

{#if pos.show}
	<div
		data-floating-toolbar
		class="fixed z-50 flex items-center gap-1 px-1.5 py-1.5 rounded-xl bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 shadow-2xl"
		style="top: {pos.top}px; left: {pos.left}px; width: {TOOLBAR_W}px; height: {TOOLBAR_H}px;"
		role="toolbar"
		aria-label="Text formatting"
	>
		<!-- Font family -->
		<div class="relative">
			<button
				onclick={() => (fontPickerOpen = !fontPickerOpen)}
				class="flex items-center gap-1.5 px-2.5 h-9 rounded-lg hover:bg-white/5 transition-colors min-w-[160px]"
				title="Font"
			>
				<Type size={13} class="text-white/50" />
				<span
					class="text-xs text-white/90 truncate flex-1 text-left"
					style="font-family: '{style.fontFamily ?? 'Inter'}', sans-serif;"
				>
					{style.fontFamily ?? 'Default'}
				</span>
				<ChevronDown size={12} class="text-white/40" />
			</button>

			{#if fontPickerOpen}
				<div class="absolute top-full left-0 mt-1 w-80 max-h-96 overflow-hidden rounded-xl bg-[#141414] border border-white/10 shadow-2xl flex flex-col">
					<div class="p-2 border-b border-white/[0.06]">
						<input
							bind:value={fontSearch}
							placeholder="Search fonts…"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500/40"
						/>
					</div>
					<div class="overflow-y-auto flex-1">
						{#each (['sans', 'serif', 'display', 'handwriting', 'mono']) as cat}
							{#if groupedFonts[cat as FontCategory].length}
								<div class="px-3 pt-2 pb-1 text-[9px] font-mono text-white/30 uppercase tracking-widest sticky top-0 bg-[#141414]">
									{CATEGORY_LABELS[cat as FontCategory]}
								</div>
								{#each groupedFonts[cat as FontCategory] as f (f.family)}
									<button
										onmouseenter={() => void loadGoogleFont(f.family)}
										onclick={() => pickFont(f.family)}
										class="w-full px-3 py-2 text-left text-sm hover:bg-white/[0.04] transition-colors flex items-center justify-between
											{style.fontFamily === f.family ? 'text-violet-300 bg-violet-500/10' : 'text-white/80'}"
										style="font-family: '{f.family}', sans-serif;"
									>
										<span>{f.family}</span>
										{#if style.fontFamily === f.family}
											<span class="text-violet-400 text-[10px]">✓</span>
										{/if}
									</button>
								{/each}
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="w-px h-6 bg-white/10"></div>

		<!-- Font size -->
		<div class="flex items-center gap-0.5">
			<button
				onclick={() => bumpSize(-4)}
				class="w-7 h-9 rounded-lg hover:bg-white/5 text-white/60 flex items-center justify-center transition-colors"
				title="Decrease size"
			>
				<Minus size={13} />
			</button>
			<input
				type="number"
				value={effectiveSize}
				oninput={(e) => setSize(parseInt((e.target as HTMLInputElement).value, 10))}
				class="w-12 h-9 bg-white/[0.04] border border-white/[0.08] rounded-lg text-center text-xs text-white focus:outline-none focus:border-violet-500/40
					{isSizeOverridden ? 'text-violet-300' : ''}"
				title={isSizeOverridden ? 'Manual size (click reset to re-enable auto-sizing)' : 'Auto-sized'}
			/>
			<button
				onclick={() => bumpSize(4)}
				class="w-7 h-9 rounded-lg hover:bg-white/5 text-white/60 flex items-center justify-center transition-colors"
				title="Increase size"
			>
				<Plus size={13} />
			</button>
		</div>

		<div class="w-px h-6 bg-white/10"></div>

		<!-- Weight toggle (Bold) -->
		<button
			onclick={() => onChange({ fontWeight: (style.fontWeight ?? 400) >= 700 ? 400 : 700 })}
			class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center
				{(style.fontWeight ?? 400) >= 700 ? 'bg-violet-500/20 text-violet-300' : 'text-white/60 hover:bg-white/5'}"
			title="Bold"
		>
			<Bold size={14} />
		</button>

		<!-- Italic -->
		<button
			onclick={() => onChange({ italic: !style.italic })}
			class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center
				{style.italic ? 'bg-violet-500/20 text-violet-300' : 'text-white/60 hover:bg-white/5'}"
			title="Italic"
		>
			<Italic size={14} />
		</button>

		<!-- Underline -->
		<button
			onclick={() => onChange({ underline: !style.underline })}
			class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center
				{style.underline ? 'bg-violet-500/20 text-violet-300' : 'text-white/60 hover:bg-white/5'}"
			title="Underline"
		>
			<Underline size={14} />
		</button>

		<div class="w-px h-6 bg-white/10"></div>

		<!-- Align -->
		{#each [{ v: 'left', Icon: AlignLeft }, { v: 'center', Icon: AlignCenter }, { v: 'right', Icon: AlignRight }] as opt}
			<button
				onclick={() => onChange({ align: opt.v as any })}
				class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center
					{(style.align ?? 'left') === opt.v ? 'bg-violet-500/20 text-violet-300' : 'text-white/60 hover:bg-white/5'}"
				title="Align {opt.v}"
			>
				<opt.Icon size={14} />
			</button>
		{/each}

		<div class="w-px h-6 bg-white/10"></div>

		<!-- Color -->
		<div class="relative">
			<button
				onclick={() => (colorPickerOpen = !colorPickerOpen)}
				class="flex items-center gap-1.5 h-9 px-2 rounded-lg hover:bg-white/5 transition-colors"
				title="Text color"
			>
				<span
					class="w-5 h-5 rounded border border-white/20"
					style="background: {style.color ?? '#FFFFFF'};"
				></span>
				<ChevronDown size={11} class="text-white/40" />
			</button>

			{#if colorPickerOpen}
				<div class="absolute top-full right-0 mt-1 p-3 rounded-xl bg-[#141414] border border-white/10 shadow-2xl w-52">
					<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Presets</p>
					<div class="grid grid-cols-6 gap-1.5 mb-3">
						{#each ['#FFFFFF', '#000000', '#F5A623', '#08EBFF', '#FF3B5C', '#A855F7', '#10B981', '#FFD700', '#FF6B6B', '#4ECDC4', '#FFB347', '#B0A8B9'] as c}
							<button
								onclick={() => { onChange({ color: c }); colorPickerOpen = false; }}
								class="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110
									{style.color === c ? 'border-white' : 'border-white/10'}"
								style="background: {c};"
								aria-label="Set color {c}"
							></button>
						{/each}
					</div>
					<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Custom</p>
					<input
						type="color"
						value={style.color ?? '#FFFFFF'}
						oninput={(e) => onChange({ color: (e.target as HTMLInputElement).value })}
						class="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
					/>
				</div>
			{/if}
		</div>

		{#if supportsHighlights}
			<div class="w-px h-6 bg-white/10"></div>

			<!-- Highlight (word-level color / gradient / pattern via [[...]] markup) -->
			<div class="relative">
				<button
					onclick={() => (highlightPickerOpen = !highlightPickerOpen)}
					disabled={!hasRangeSelection}
					class="flex items-center gap-1.5 h-9 px-2 rounded-lg transition-colors
						{hasRangeSelection ? 'hover:bg-white/5 text-white/80' : 'opacity-40 cursor-not-allowed text-white/50'}"
					title={hasRangeSelection ? 'Highlight selected text' : 'Select text first, then highlight'}
				>
					<Highlighter size={14} />
					<ChevronDown size={11} class="text-white/40" />
				</button>

				{#if highlightPickerOpen && hasRangeSelection}
					<div class="absolute top-full left-1/2 -translate-x-1/2 mt-1 p-3 rounded-xl bg-[#141414] border border-white/10 shadow-2xl w-64 z-10">
						<!-- Solid colors -->
						<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Solid Color</p>
						<div class="grid grid-cols-4 gap-1.5 mb-3">
							{#each HIGHLIGHT_PRESETS as c}
								<button
									onclick={() => applyHighlight({ kind: 'color', color: c })}
									class="h-7 rounded-lg border-2 border-white/10 hover:scale-105 transition-transform"
									style="background: {c};"
									aria-label="Highlight with {c}"
								></button>
							{/each}
						</div>

						<!-- Gradients -->
						<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Gradient</p>
						<div class="grid grid-cols-4 gap-1.5 mb-3">
							{#each GRADIENT_PRESETS as [from, to]}
								<button
									onclick={() => applyHighlight({ kind: 'gradient', from, to })}
									class="h-7 rounded-lg border-2 border-white/10 hover:scale-105 transition-transform"
									style="background: linear-gradient(90deg, {from}, {to});"
									aria-label="Highlight with {from} to {to} gradient"
								></button>
							{/each}
						</div>

						<!-- Patterns -->
						<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Pattern</p>
						<div class="grid grid-cols-2 gap-1.5 mb-3">
							{#each AVAILABLE_PATTERNS as pat}
								<button
									onclick={() => applyHighlight({ kind: 'pattern', name: pat.name })}
									class="h-10 rounded-lg border border-white/10 hover:border-white/40 overflow-hidden relative group transition-all"
									title={pat.label}
								>
									<img src={pat.url} alt={pat.label} class="absolute inset-0 w-full h-full object-cover" />
									<span
										class="absolute inset-0 flex items-center justify-center font-black text-xs tracking-wider"
										style="
											background-image: url('{pat.url}');
											background-size: cover;
											background-position: center;
											-webkit-background-clip: text;
											-webkit-text-fill-color: transparent;
											background-clip: text;
											filter: contrast(1.4) brightness(1.2);
										"
									>{pat.label.toUpperCase()}</span>
								</button>
							{/each}
						</div>

						<!-- Clear highlight -->
						<button
							onclick={() => applyHighlight({ kind: 'clear' })}
							class="w-full py-2 rounded-lg text-[11px] font-mono text-white/60 hover:text-white border border-white/[0.08] hover:border-white/20 transition-colors"
						>
							Clear highlight
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex-1"></div>

		<!-- Reset -->
		<button
			onclick={onReset}
			class="w-9 h-9 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
			title="Reset to template defaults"
		>
			<RotateCcw size={13} />
		</button>
	</div>
{/if}
