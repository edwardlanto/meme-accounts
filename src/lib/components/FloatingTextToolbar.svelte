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
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import {
		Bold, Italic, Underline,
		AlignLeft, AlignCenter, AlignRight,
		ChevronDown, Type, Minus, Plus, RotateCcw, Highlighter,
	} from 'lucide-svelte';

	type PickerKind = 'font' | 'lh' | 'color' | 'bg' | 'highlight';

	function closeOtherPickers(except: PickerKind) {
		if (except !== 'font') fontPickerOpen = false;
		if (except !== 'lh') lineHeightOpen = false;
		if (except !== 'color') colorPickerOpen = false;
		if (except !== 'bg') bgPickerOpen = false;
		if (except !== 'highlight') highlightPickerOpen = false;
	}

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
	let bgPickerOpen = $state(false);
	let lineHeightOpen = $state(false);

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

	/** BG chip: with markup + selection → inline `[[marker(...)]]`; else block `bgColor`. */
	function pickBackgroundPreset(c: string) {
		if (supportsHighlights && hasRangeSelection) {
			if (c === 'transparent') applyHighlight({ kind: 'clear' });
			else applyHighlight({ kind: 'marker', color: c });
		} else {
			onChange({ bgColor: c === 'transparent' ? undefined : c });
		}
		bgPickerOpen = false;
	}

	function onBgCustomColorInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		if (supportsHighlights && hasRangeSelection) {
			applyHighlight({ kind: 'marker', color: v });
		} else {
			onChange({ bgColor: v });
		}
	}

	function clearBackgroundFill() {
		if (supportsHighlights && hasRangeSelection) {
			applyHighlight({ kind: 'clear' });
		} else {
			onChange({ bgColor: undefined });
		}
		bgPickerOpen = false;
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
		/* Popover panels render in a portal — keep toolbar open while using them */
		if (target.closest('[data-slot="popover-content"]')) return;
		onClose();
	}

	$effect(() => {
		if (pos.show) {
			document.addEventListener('mousedown', handleDocumentClick);
			return () => document.removeEventListener('mousedown', handleDocumentClick);
		}
	});

	$effect(() => {
		if (!hasRangeSelection) {
			highlightPickerOpen = false;
			bgPickerOpen = false;
		}
	});
</script>

{#if pos.show}
	<div
		data-floating-toolbar
		class="fixed z-50 flex items-center gap-1 px-1.5 py-1.5 rounded-xl backdrop-blur-md shadow-2xl ftb-shell"
		style="top: {pos.top}px; left: {pos.left}px; width: {TOOLBAR_W}px; height: {TOOLBAR_H}px;"
		role="toolbar"
		aria-label="Text formatting"
	>
		<!-- Font family -->
		<Popover
			bind:open={fontPickerOpen}
			onOpenChange={(o) => {
				if (o) closeOtherPickers('font');
			}}
		>
			<PopoverTrigger
				class="flex h-9 min-w-[160px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 transition-colors ftb-btn"
				title="Font"
			>
				<Type size={13} class="ftb-muted" />
				<span
					class="ftb-strong flex-1 truncate text-left text-xs"
					style="font-family: '{style.fontFamily ?? 'Inter'}', sans-serif;"
				>
					{style.fontFamily ?? 'Default'}
				</span>
				<ChevronDown size={12} class="ftb-muted" />
			</PopoverTrigger>
			<PopoverContent
				class="z-[70] ftb-pop flex max-h-96 w-80 flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-2xl"
				align="start"
				side="bottom"
				sideOffset={6}
			>
				<div class="ftb-pop-head p-2">
					<input
						bind:value={fontSearch}
						placeholder="Search fonts…"
						class="ftb-input w-full rounded-lg px-2.5 py-1.5 text-xs focus:border-violet-500/40 focus:outline-none"
					/>
				</div>
				<div class="flex-1 overflow-y-auto">
					{#each ['sans', 'serif', 'display', 'handwriting', 'mono'] as cat}
						{#if groupedFonts[cat as FontCategory].length}
							<div class="ftb-pop-sticky sticky top-0 px-3 pt-2 pb-1 text-[9px] font-mono uppercase tracking-widest">
								{CATEGORY_LABELS[cat as FontCategory]}
							</div>
							{#each groupedFonts[cat as FontCategory] as f (f.family)}
								<button
									type="button"
									onmouseenter={() => void loadGoogleFont(f.family)}
									onclick={() => pickFont(f.family)}
									class="ftb-row flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors
										{style.fontFamily === f.family ? 'ftb-row-on' : ''}"
									style="font-family: '{f.family}', sans-serif;"
								>
									<span>{f.family}</span>
									{#if style.fontFamily === f.family}
										<span class="text-[10px] text-violet-500">✓</span>
									{/if}
								</button>
							{/each}
						{/if}
					{/each}
				</div>
			</PopoverContent>
		</Popover>

		<div class="w-px h-6 ftb-div"></div>

		<!-- Font size -->
		<div class="flex items-center gap-0.5">
			<button
				onclick={() => bumpSize(-4)}
				class="w-7 h-9 rounded-lg flex items-center justify-center transition-colors ftb-btn ftb-muted"
				title="Decrease size"
			>
				<Minus size={13} />
			</button>
			<input
				type="number"
				value={effectiveSize}
				oninput={(e) => setSize(parseInt((e.target as HTMLInputElement).value, 10))}
				class="w-12 h-9 rounded-lg text-center text-xs focus:outline-none focus:border-violet-500/40 ftb-input
					{isSizeOverridden ? 'text-violet-500' : ''}"
				title={isSizeOverridden ? 'Manual size (click reset to re-enable auto-sizing)' : 'Auto-sized'}
			/>
			<button
				onclick={() => bumpSize(4)}
				class="w-7 h-9 rounded-lg flex items-center justify-center transition-colors ftb-btn ftb-muted"
				title="Increase size"
			>
				<Plus size={13} />
			</button>
		</div>

		<div class="w-px h-6 ftb-div"></div>

		<!-- Line height -->
		<Popover
			bind:open={lineHeightOpen}
			onOpenChange={(o) => {
				if (o) closeOtherPickers('lh');
			}}
		>
			<PopoverTrigger
				class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 transition-colors ftb-btn"
				title="Line height"
			>
				<span class="font-mono text-[10px] ftb-muted">LH</span>
				<span class="ftb-strong min-w-[34px] text-center text-xs tabular-nums">
					{(style.lineHeight ?? 1.12).toFixed(2)}
				</span>
				<ChevronDown size={11} class="ftb-muted" />
			</PopoverTrigger>
			<PopoverContent
				class="z-[70] ftb-pop w-44 gap-0 rounded-xl p-2 shadow-2xl"
				align="start"
				side="bottom"
				sideOffset={6}
			>
				<div class="grid grid-cols-4 gap-1.5">
					{#each [0.9, 1.0, 1.06, 1.12, 1.2, 1.3, 1.4, 1.6] as lh}
						<button
							type="button"
							onclick={() => {
								onChange({ lineHeight: lh });
								lineHeightOpen = false;
							}}
							class="ftb-btn h-8 rounded-lg border font-mono text-[11px] transition-colors
								{Math.abs((style.lineHeight ?? 1.12) - lh) < 0.001 ? 'ftb-on' : 'ftb-muted'}"
							title={`Line height ${lh}`}
						>
							{lh}
						</button>
					{/each}
				</div>

				<button
					type="button"
					onclick={() => {
						onChange({ lineHeight: undefined });
						lineHeightOpen = false;
					}}
					class="ftb-btn ftb-muted mt-2 w-full rounded-lg border py-2 font-mono text-[11px] transition-colors"
					title="Reset line height"
				>
					Reset
				</button>
			</PopoverContent>
		</Popover>

		<div class="w-px h-6 ftb-div"></div>

		<!-- Weight toggle (Bold) -->
		<button
			onclick={() => onChange({ fontWeight: (style.fontWeight ?? 400) >= 700 ? 400 : 700 })}
			class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center ftb-btn
				{(style.fontWeight ?? 400) >= 700 ? 'ftb-on' : 'ftb-muted'}"
			title="Bold"
		>
			<Bold size={14} />
		</button>

		<!-- Italic -->
		<button
			onclick={() => onChange({ italic: !style.italic })}
			class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center ftb-btn
				{style.italic ? 'ftb-on' : 'ftb-muted'}"
			title="Italic"
		>
			<Italic size={14} />
		</button>

		<!-- Underline -->
		<button
			onclick={() => onChange({ underline: !style.underline })}
			class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center ftb-btn
				{style.underline ? 'ftb-on' : 'ftb-muted'}"
			title="Underline"
		>
			<Underline size={14} />
		</button>

		<div class="w-px h-6 ftb-div"></div>

		<!-- Align -->
		{#each [{ v: 'left', Icon: AlignLeft }, { v: 'center', Icon: AlignCenter }, { v: 'right', Icon: AlignRight }] as opt}
			<button
				onclick={() => onChange({ align: opt.v as any })}
				class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center ftb-btn
					{(style.align ?? 'left') === opt.v ? 'ftb-on' : 'ftb-muted'}"
				title="Align {opt.v}"
			>
				<opt.Icon size={14} />
			</button>
		{/each}

		<div class="w-px h-6 ftb-div"></div>

		<!-- Color -->
		<Popover
			bind:open={colorPickerOpen}
			onOpenChange={(o) => {
				if (o) closeOtherPickers('color');
			}}
		>
			<PopoverTrigger
				class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 transition-colors ftb-btn"
				title="Text color"
			>
				<span
					class="ftb-chip h-5 w-5 rounded border"
					style="background: {style.color ?? '#FFFFFF'};"
				></span>
				<ChevronDown size={11} class="ftb-muted" />
			</PopoverTrigger>
			<PopoverContent
				class="z-[70] ftb-pop w-52 gap-0 rounded-xl p-3 shadow-2xl"
				align="end"
				side="bottom"
				sideOffset={6}
			>
				<p class="mb-2 font-mono text-[9px] uppercase tracking-widest ftb-muted">Presets</p>
				<div class="mb-3 grid grid-cols-6 gap-1.5">
					{#each ['#FFFFFF', '#000000', '#F5A623', '#08EBFF', '#FF3B5C', '#A855F7', '#10B981', '#FFD700', '#FF6B6B', '#4ECDC4', '#FFB347', '#B0A8B9'] as c}
						<button
							type="button"
							onclick={() => {
								onChange({ color: c });
								colorPickerOpen = false;
							}}
							class="h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110
								{style.color === c ? 'border-black/40' : 'border-black/10'}"
							style="background: {c};"
							aria-label="Set color {c}"
						></button>
					{/each}
				</div>
				<p class="mb-2 font-mono text-[9px] uppercase tracking-widest ftb-muted">Custom</p>
				<input
					type="color"
					value={style.color ?? '#FFFFFF'}
					oninput={(e) => onChange({ color: (e.target as HTMLInputElement).value })}
					class="h-8 w-full cursor-pointer rounded-lg border border-black/10 bg-transparent"
				/>
			</PopoverContent>
		</Popover>

		<!-- Background (selection → inline marker markup when supportsHighlights) -->
		<Popover
			bind:open={bgPickerOpen}
			onOpenChange={(o) => {
				if (o) closeOtherPickers('bg');
			}}
		>
			<PopoverTrigger
				disabled={supportsHighlights && !hasRangeSelection}
				class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 transition-colors ftb-btn
					{supportsHighlights && !hasRangeSelection ? 'cursor-not-allowed opacity-40' : ''}"
				title={supportsHighlights && !hasRangeSelection
					? 'Select part of the text first, then pick a background color'
					: supportsHighlights
						? 'Background on selected text'
						: 'Block background'}
			>
				<span
					class="ftb-chip h-5 w-5 rounded border"
					style="background: {style.bgColor ?? 'transparent'};"
				></span>
				<span class="font-mono text-[10px] ftb-muted">BG</span>
				<ChevronDown size={11} class="ftb-muted" />
			</PopoverTrigger>
			<PopoverContent
				class="z-[70] ftb-pop w-52 gap-0 rounded-xl p-3 shadow-2xl"
				align="end"
				side="bottom"
				sideOffset={6}
			>
				<p class="mb-2 font-mono text-[9px] uppercase tracking-widest ftb-muted">Presets</p>
				<div class="mb-3 grid grid-cols-6 gap-1.5">
					{#each ['transparent', '#000000', '#FFFFFF', '#F5A623', '#08EBFF', '#FF3B5C', '#A855F7', '#10B981', '#FFD700', '#FF6B6B', '#4ECDC4', '#111827'] as c}
						<button
							type="button"
							onclick={() => pickBackgroundPreset(c)}
							class="h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110
								{style.bgColor === c ? 'border-black/40' : 'border-black/10'}"
							style="background: {c === 'transparent'
								? 'linear-gradient(135deg, transparent 0 42%, rgba(255,59,92,0.95) 42% 52%, transparent 52% 100%), linear-gradient(135deg, rgba(0,0,0,0.10), rgba(0,0,0,0.02))'
								: c};"
							aria-label="Set background {c === 'transparent' ? 'none' : c}"
							title={c === 'transparent' ? 'Transparent' : c}
						></button>
					{/each}
				</div>
				<p class="mb-2 font-mono text-[9px] uppercase tracking-widest ftb-muted">Custom</p>
				<input
					type="color"
					value={style.bgColor ?? '#000000'}
					oninput={onBgCustomColorInput}
					disabled={supportsHighlights && !hasRangeSelection}
					class="h-8 w-full cursor-pointer rounded-lg border border-black/10 bg-transparent"
				/>
				<button
					type="button"
					onclick={clearBackgroundFill}
					disabled={supportsHighlights && !hasRangeSelection}
					class="ftb-btn ftb-muted mt-2 w-full rounded-lg border py-2 font-mono text-[11px] transition-colors"
					title="Clear background on selection"
				>
					Clear background
				</button>
			</PopoverContent>
		</Popover>

		{#if supportsHighlights}
			<div class="w-px h-6 ftb-div"></div>

			<!-- Highlight (word-level color / gradient / pattern via [[...]] markup) -->
			<Popover
				bind:open={highlightPickerOpen}
				onOpenChange={(o) => {
					if (o) closeOtherPickers('highlight');
				}}
			>
				<PopoverTrigger
					disabled={!hasRangeSelection}
					class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 transition-colors ftb-btn
						{hasRangeSelection ? 'ftb-strong' : 'ftb-muted cursor-not-allowed opacity-40'}"
					title={hasRangeSelection ? 'Highlight selected text' : 'Select text first, then highlight'}
				>
					<Highlighter size={14} />
					<ChevronDown size={11} class="ftb-muted" />
				</PopoverTrigger>
				<PopoverContent
					class="z-[70] ftb-pop w-64 gap-0 rounded-xl p-3 shadow-2xl"
					align="center"
					side="bottom"
					sideOffset={6}
				>
					<!-- Solid colors -->
					<p class="mb-2 font-mono text-[9px] uppercase tracking-widest ftb-muted">Solid Color</p>
					<div class="mb-3 grid grid-cols-4 gap-1.5">
						{#each HIGHLIGHT_PRESETS as c}
							<button
								type="button"
								onclick={() => applyHighlight({ kind: 'color', color: c })}
								class="h-7 rounded-lg border-2 border-white/10 transition-transform hover:scale-105"
								style="background: {c};"
								aria-label="Highlight with {c}"
							></button>
						{/each}
					</div>

					<!-- Gradients -->
					<p class="mb-2 font-mono text-[9px] uppercase tracking-widest ftb-muted">Gradient</p>
					<div class="mb-3 grid grid-cols-4 gap-1.5">
						{#each GRADIENT_PRESETS as [from, to]}
							<button
								type="button"
								onclick={() => applyHighlight({ kind: 'gradient', from, to })}
								class="h-7 rounded-lg border-2 border-white/10 transition-transform hover:scale-105"
								style="background: linear-gradient(90deg, {from}, {to});"
								aria-label="Highlight with {from} to {to} gradient"
							></button>
						{/each}
					</div>

					<!-- Patterns -->
					<p class="mb-2 font-mono text-[9px] uppercase tracking-widest ftb-muted">Pattern</p>
					<div class="group relative mb-3 grid grid-cols-2 gap-1.5">
						{#each AVAILABLE_PATTERNS as pat}
							<button
								type="button"
								onclick={() => applyHighlight({ kind: 'pattern', name: pat.name })}
								class="relative h-10 overflow-hidden rounded-lg border border-white/10 transition-all hover:border-white/40"
								title={pat.label}
							>
								<img src={pat.url} alt={pat.label} class="absolute inset-0 h-full w-full object-cover" />
								<span
									class="absolute inset-0 flex items-center justify-center text-xs font-black tracking-wider"
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

					<button
						type="button"
						onclick={() => applyHighlight({ kind: 'clear' })}
						class="ftb-btn ftb-muted w-full rounded-lg border py-2 font-mono text-[11px] transition-colors"
					>
						Clear highlight
					</button>
				</PopoverContent>
			</Popover>
		{/if}

		<div class="flex-1"></div>

		<!-- Reset -->
		<button
			onclick={onReset}
			class="w-9 h-9 rounded-lg transition-colors flex items-center justify-center ftb-btn ftb-muted"
			title="Reset to template defaults"
		>
			<RotateCcw size={13} />
		</button>
	</div>
{/if}

<style>
	.ftb-shell {
		background: var(--app-surface-2);
		border: 1px solid var(--app-border);
	}
	:root[data-theme="dark"] .ftb-shell {
		background: rgba(26,26,26,0.95);
		border-color: rgba(255,255,255,0.10);
	}
	.ftb-div { background: color-mix(in oklab, var(--app-text) 12%, transparent); }
	:root[data-theme="dark"] .ftb-div { background: rgba(255,255,255,0.10); }

	.ftb-btn:hover { background: color-mix(in oklab, var(--app-text) 6%, transparent); }
	:root[data-theme="dark"] .ftb-btn:hover { background: rgba(255,255,255,0.05); }

	.ftb-strong { color: var(--app-text); }
	.ftb-muted { color: var(--app-text-2); }
	:root[data-theme="dark"] .ftb-strong { color: rgba(255,255,255,0.92); }
	:root[data-theme="dark"] .ftb-muted { color: rgba(255,255,255,0.55); }

	.ftb-on {
		background: color-mix(in oklab, var(--color-violet) 18%, transparent);
		color: var(--color-violet);
	}
	:root[data-theme="dark"] .ftb-on {
		background: rgba(139,92,246,0.20);
		color: rgba(167,139,250,1);
	}

	.ftb-input {
		background: color-mix(in oklab, var(--app-text) 4%, transparent);
		border: 1px solid var(--app-border);
		color: var(--app-text);
	}
	.ftb-input::placeholder { color: var(--app-text-3); }
	:root[data-theme="dark"] .ftb-input {
		background: rgba(255,255,255,0.04);
		border-color: rgba(255,255,255,0.08);
		color: #fff;
	}
	:root[data-theme="dark"] .ftb-input::placeholder { color: rgba(255,255,255,0.30); }

	/* Popover panels portal to body — target by slot + marker class */
	:global([data-slot="popover-content"].ftb-pop) {
		background: var(--app-surface-2) !important;
		border: 1px solid var(--app-border) !important;
	}
	:global(:root[data-theme="dark"] [data-slot="popover-content"].ftb-pop) {
		background: #141414 !important;
		border-color: rgba(255, 255, 255, 0.1) !important;
	}
	.ftb-pop-head { border-bottom: 1px solid var(--app-border); }
	:root[data-theme="dark"] .ftb-pop-head { border-bottom-color: rgba(255,255,255,0.06); }
	.ftb-pop-sticky { background: var(--app-surface-2); color: var(--app-text-3); }
	:root[data-theme="dark"] .ftb-pop-sticky { background: #141414; color: rgba(255,255,255,0.30); }

	.ftb-row { color: var(--app-text); }
	.ftb-row:hover { background: color-mix(in oklab, var(--app-text) 4%, transparent); }
	:root[data-theme="dark"] .ftb-row { color: rgba(255,255,255,0.80); }
	:root[data-theme="dark"] .ftb-row:hover { background: rgba(255,255,255,0.04); }
	.ftb-row-on { background: color-mix(in oklab, var(--color-violet) 12%, transparent); color: var(--color-violet); }
	:root[data-theme="dark"] .ftb-row-on { background: rgba(139,92,246,0.10); color: rgba(196,181,253,1); }

	.ftb-chip { border-color: color-mix(in oklab, var(--app-text) 20%, transparent); }
	:root[data-theme="dark"] .ftb-chip { border-color: rgba(255,255,255,0.20); }
</style>
