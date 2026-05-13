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
		ChevronDown, Type, Minus, Plus, Highlighter, Blend, Trash2,
	} from 'lucide-svelte';

	type PickerKind = 'font' | 'lh' | 'color' | 'bg' | 'highlight' | 'fw';

	function closeOtherPickers(except: PickerKind) {
		if (except !== 'font') fontPickerOpen = false;
		if (except !== 'lh') lineHeightOpen = false;
		if (except !== 'color') colorPickerOpen = false;
		if (except !== 'bg') bgPickerOpen = false;
		if (except !== 'highlight') highlightPickerOpen = false;
		if (except !== 'fw') fontWeightOpen = false;
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
		/** Selection spans multiple foreground colors (show mixed swatch instead of one color). */
		textColorMixed?: boolean;
		onChange: (patch: Partial<TextStyle>) => void;
		onHighlight?: (spec: HighlightSpec) => void;
		/** When set, show delete: remove text overlays or clear the active template text field. */
		onDelete?: () => void;
		onClose: () => void;
		/** Article image/logo: single delete control, no typography chrome. */
		deleteOnly?: boolean;
	}

	let {
		anchor,
		style,
		autoFontSize = 72,
		supportsHighlights = false,
		hasRangeSelection = false,
		textColorMixed = false,
		onChange,
		onHighlight,
		onDelete,
		onClose,
		deleteOnly = false,
	}: Props = $props();

	let fontPickerOpen = $state(false);
	let fontSearch = $state('');
	let colorPickerOpen = $state(false);
	let highlightPickerOpen = $state(false);
	let bgPickerOpen = $state(false);
	let lineHeightOpen = $state(false);
	let fontWeightOpen = $state(false);

	const FONT_WEIGHT_PRESETS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

	// Position the toolbar above the anchored element, clamped to the viewport.
	const TOOLBAR_W_FULL = 740;
	const TOOLBAR_W_DELETE = 52;
	const TOOLBAR_H = 48;

	const toolbarWidth = $derived(deleteOnly ? TOOLBAR_W_DELETE : TOOLBAR_W_FULL);

	/** App default highlight / `[[WORD]]` parse color is #F5A623 — not first in grid so it isn’t mistaken for “primary”. */
	const HIGHLIGHT_PRESETS = [
		'#08EBFF', '#FF3B5C', '#F5A623', '#A855F7',
		'#10B981', '#FFD700', '#FF6B6B', '#4ECDC4',
	];
	const GRADIENT_PRESETS: [string, string][] = [
		['#FFFFFF', '#F5A623'],
		['#F5A623', '#FFB347'],
		['#08EBFF', '#A855F7'],
		['#10B981', '#08EBFF'],
	];

	function applyHighlight(spec: HighlightSpec) {
		onHighlight?.(spec);
		// Keep the highlight popover open so you can try several swatches (close by clicking away).
	}

	/** BG chip: Studio routes selection → `[[marker(...)]]` vs block `bgColor`. */
	function pickBackgroundPreset(c: string) {
		onChange({ bgColor: c === 'transparent' ? undefined : c });
		bgPickerOpen = false;
	}

	function onBgCustomColorInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		onChange({ bgColor: v });
	}

	function clearBackgroundFill() {
		onChange({ bgColor: undefined });
		bgPickerOpen = false;
	}

	const pos = $derived.by(() => {
		if (!anchor) return { top: 0, left: 0, show: false };
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const w = toolbarWidth;
		let top = anchor.top - TOOLBAR_H - 12;
		if (top < 12) top = anchor.bottom + 12; // flip below if no room above
		let left = anchor.left + anchor.width / 2 - w / 2;
		left = Math.max(12, Math.min(left, vw - w - 12));
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

	/** Always route through `onChange` so Studio can sync selection from the DOM / last range before applying block vs [[…]] color. */
	function pickTextColor(c: string) {
		onChange({ color: c });
		colorPickerOpen = false;
	}

	function onTextColorCustomInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		onChange({ color: v });
	}

	// Preload top fonts once mounted so the picker previews render fast.
	$effect(() => {
		if (fontPickerOpen) {
			for (const f of filteredFonts.slice(0, 30)) void loadGoogleFont(f.family);
		}
	});

	function handleDocumentClick(e: MouseEvent) {
		const node = e.target;
		if (node == null) return;
		// Text nodes don't have .closest — clicks on preset labels would wrongly fall through and close the toolbar.
		const target =
			node instanceof Element ? node : (node as Node).parentElement;
		if (!target) return;
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

	/** Keep native text selection when clicking toolbar / popovers (otherwise block color applies to the whole headline). */
	$effect(() => {
		if (!pos.show) return;
		const preserve = (e: PointerEvent | MouseEvent) => {
			const raw = e.target;
			if (raw == null) return;
			const el =
				raw instanceof Element ? raw : (raw as Node).parentElement;
			if (!el) return;
			if (!el.closest('[data-floating-toolbar]') && !el.closest('[data-slot="popover-content"]')) return;
			/* Portaled popover: never suppress default pointer behavior. Gaps, labels, and wrappers are not
			   buttons — preventDefault made relatedTarget null and kept activeElement off toolbar UI. */
			if (el.closest('[data-slot="popover-content"]')) return;
			const tag = el.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el instanceof HTMLElement && el.isContentEditable) return;
			/* Let buttons/links take focus so contenteditable blur gets a real relatedTarget / activeElement
			   inside the toolbar — otherwise preventDefault blocks focus and headline edit exits. */
			if (el.closest('button, a[href], [role="button"], [role="menuitem"]')) return;
			e.preventDefault();
		};
		document.addEventListener('pointerdown', preserve, true);
		document.addEventListener('mousedown', preserve, true);
		return () => {
			document.removeEventListener('pointerdown', preserve, true);
			document.removeEventListener('mousedown', preserve, true);
		};
	});

	/* Don’t force-close highlight/bg popovers when range state flickers — that was closing the
	   highlight menu as soon as you picked a swatch (or when lastCommitted briefly cleared).
	   Bits-ui already closes on outside pointer; disabled triggers handle “no selection”. */
</script>

{#if pos.show}
	<div
		data-floating-toolbar
		class="fixed z-50 flex items-center gap-1 px-1.5 py-1.5 rounded-xl backdrop-blur-md shadow-2xl ftb-shell"
		style="top: {pos.top}px; left: {pos.left}px; width: {toolbarWidth}px; height: {TOOLBAR_H}px;"
		role="toolbar"
		aria-label={deleteOnly ? 'Delete' : 'Text formatting'}
	>
		{#if deleteOnly && onDelete}
			<button
				type="button"
				onclick={() => onDelete()}
				class="w-9 h-9 shrink-0 rounded-lg transition-colors flex items-center justify-center ftb-btn ftb-muted mx-auto"
				title="Delete"
				aria-label="Delete"
			>
				<Trash2 size={13} />
			</button>
		{:else}
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
					style="font-family: '{style.fontFamily ?? 'Satoshi'}', sans-serif;"
				>
					{style.fontFamily ?? 'Satoshi'}
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

		<!-- Font weight (100–900) -->
		<Popover
			bind:open={fontWeightOpen}
			onOpenChange={(o) => {
				if (o) closeOtherPickers('fw');
			}}
		>
			<PopoverTrigger
				class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 transition-colors ftb-btn"
				title="Font weight"
			>
				<Bold size={14} class="ftb-muted" />
				<span class="ftb-strong min-w-[30px] text-center text-xs tabular-nums">
					{style.fontWeight ?? 400}
				</span>
				<ChevronDown size={11} class="ftb-muted" />
			</PopoverTrigger>
			<PopoverContent
				class="z-[70] ftb-pop w-[13.5rem] gap-0 rounded-xl p-2 shadow-2xl"
				align="start"
				side="bottom"
				sideOffset={6}
			>
				<div class="grid grid-cols-3 gap-1.5">
					{#each FONT_WEIGHT_PRESETS as w}
						<button
							type="button"
							onclick={() => {
								onChange({ fontWeight: w });
								fontWeightOpen = false;
							}}
							class="ftb-btn h-8 rounded-lg border font-mono text-[11px] transition-colors
								{(style.fontWeight ?? 400) === w ? 'ftb-on' : 'ftb-muted'}"
							title={`Weight ${w}`}
						>
							{w}
						</button>
					{/each}
				</div>

				<button
					type="button"
					onclick={() => {
						onChange({ fontWeight: undefined });
						fontWeightOpen = false;
					}}
					class="ftb-btn ftb-muted mt-2 w-full rounded-lg border py-2 font-mono text-[11px] transition-colors"
					title="Clear weight override (use template default)"
				>
					Reset
				</button>
			</PopoverContent>
		</Popover>

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
				title={textColorMixed ? 'Multiple text colors in selection' : 'Text color'}
			>
				{#if textColorMixed}
					<span
						class="ftb-chip flex h-5 w-5 items-center justify-center rounded border bg-neutral-100"
						aria-hidden="true"
					>
						<Blend size={14} class="text-neutral-600" strokeWidth={2.2} />
					</span>
				{:else}
					<span
						class="ftb-chip h-5 w-5 rounded border"
						style="background: {style.color ?? '#FFFFFF'};"
					></span>
				{/if}
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
							onclick={() => pickTextColor(c)}
							class="h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110
								{!textColorMixed && style.color === c ? 'border-black/40' : 'border-black/10'}"
							style="background: {c};"
							aria-label="Set color {c}"
						></button>
					{/each}
				</div>
				<p class="mb-2 font-mono text-[9px] uppercase tracking-widest ftb-muted">Custom</p>
				<input
					type="color"
					value={style.color ?? '#FFFFFF'}
					oninput={onTextColorCustomInput}
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

		{#if onDelete && !deleteOnly}
			<div class="w-px h-6 shrink-0 ftb-div"></div>
			<button
				type="button"
				onclick={() => onDelete()}
				class="w-9 h-9 shrink-0 rounded-lg transition-colors flex items-center justify-center ftb-btn ftb-muted"
				title="Delete"
				aria-label="Delete"
			>
				<Trash2 size={13} />
			</button>
		{/if}
		{/if}
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
