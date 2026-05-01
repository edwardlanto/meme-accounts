<script lang="ts">
	/**
	 * WYSIWYG editor for `[[...]]` highlight markup.
	 *
	 * - Accepts a `value` string containing raw markup (`[[WORD]]`, `[[#hex: WORD]]`,
	 *   `[[grad(#a,#b): WORD]]`, `[[pattern(name): WORD]]`).
	 * - Renders it as a contenteditable with styled <span> chips — brackets are
	 *   NEVER visible to the user.
	 * - On every input, serializes the DOM back to raw markup and emits `onChange`.
	 * - Exposes `applyHighlightToSelection(spec)` for the parent toolbar.
	 */
	import { parseHighlightMarkup, segmentText, applyHighlight, AVAILABLE_PATTERNS, type HighlightSpec } from '$lib/highlight';
	import { tick } from 'svelte';

	interface Props {
		value: string;
		placeholder?: string;
		/** Default highlight color used by parseHighlightMarkup (for [[WORD]] without explicit color). */
		defaultColor?: string;
		rows?: number;
		/** Override min-height CSS (e.g. '0px' to remove extra gap). */
		minHeight?: string;
		/** Font used for the editor content. */
		fontFamily?: string;
		fontSize?: number;
		/** If true, renders uppercase (does NOT modify underlying text). */
		uppercase?: boolean;
		/** If true, show a compact built-in highlight toolbar above the field. */
		showToolbar?: boolean;
		/** Passed through to the outer div for styling from the parent. */
		class?: string;
		ariaLabel?: string;
		onChange: (next: string) => void;
		onSelectionChange?: (hasRange: boolean, range?: { start: number; end: number } | null) => void;
		onFocus?: () => void;
		onBlur?: () => void;
	}

	let {
		value,
		placeholder = '',
		defaultColor = '#F59E0B',
		rows = 4,
		minHeight,
		fontFamily,
		fontSize,
		uppercase = false,
		showToolbar = false,
		class: klass = '',
		ariaLabel,
		onChange,
		onSelectionChange,
		onFocus,
		onBlur,
	}: Props = $props();

	let editorEl: HTMLDivElement | null = $state(null);
	// Track the last value we wrote into the DOM so external updates don't blow away
	// the user's caret while typing.
	let lastSyncedValue = $state<string>('');
	let hasRange = $state(false);

	const DEFAULT_SWATCHES = [
		'#F59E0B', '#3B82F6', '#EF4444', '#A855F7', '#10B981', '#EC4899', '#FFFFFF',
	];
	const GRADIENT_PRESETS: [string, string][] = [
		['#F5A623', '#FF3B5C'],
		['#08EBFF', '#A855F7'],
		['#10B981', '#08EBFF'],
		['#FFFFFF', '#F5A623'],
	];
	let patternOpen = $state(false);
	let gradientOpen = $state(false);

	$effect(() => {
		if (!patternOpen && !gradientOpen) return;
		const onDocDown = (e: MouseEvent) => {
			const t = e.target as HTMLElement;
			if (t.closest('[data-hl-popover]') || t.closest('[data-hl-toggle]')) return;
			patternOpen = false;
			gradientOpen = false;
		};
		document.addEventListener('mousedown', onDocDown);
		return () => document.removeEventListener('mousedown', onDocDown);
	});

	// Render raw markup → DOM spans inside `editorEl`.
	function renderMarkupToDom(raw: string) {
		if (!editorEl) return;
		const parsed = parseHighlightMarkup(raw, defaultColor);
		const segs = segmentText(parsed);
		editorEl.innerHTML = '';

		const appendTextWithBreaks = (parent: HTMLElement, text: string) => {
			const parts = text.split('\n');
			for (let i = 0; i < parts.length; i++) {
				if (parts[i]) parent.appendChild(document.createTextNode(parts[i]));
				if (i < parts.length - 1) parent.appendChild(document.createElement('br'));
			}
		};

		const appendHighlightedWithBreaks = (
			baseSpan: HTMLSpanElement,
			text: string,
			apply: (span: HTMLSpanElement) => void
		) => {
			const parts = text.split('\n');
			for (let i = 0; i < parts.length; i++) {
				if (parts[i]) {
					const span = baseSpan.cloneNode(false) as HTMLSpanElement;
					apply(span);
					span.textContent = parts[i];
					editorEl!.appendChild(span);
				}
				if (i < parts.length - 1) editorEl!.appendChild(document.createElement('br'));
			}
		};

		if (segs.length === 0) {
			// Keep a zero-width br so the caret has somewhere to sit.
			editorEl.appendChild(document.createElement('br'));
			return;
		}
		for (const s of segs) {
			if (!s.highlighted) {
				appendTextWithBreaks(editorEl, s.text);
				continue;
			}
			const span = document.createElement('span');
			span.setAttribute('data-hl', '1');
			if (s.markerBg) {
				span.setAttribute('data-hl-kind', 'marker');
				span.setAttribute('data-hl-marker', s.markerBg);
			} else if (s.pattern) {
				span.setAttribute('data-hl-kind', 'pattern');
				span.setAttribute('data-hl-name', s.pattern);
			} else if (s.gradientFrom && s.gradientTo) {
				span.setAttribute('data-hl-kind', 'gradient');
				span.setAttribute('data-hl-from', s.gradientFrom);
				span.setAttribute('data-hl-to', s.gradientTo);
			} else if (s.color && s.color.toLowerCase() !== defaultColor.toLowerCase()) {
				span.setAttribute('data-hl-kind', 'color');
				span.setAttribute('data-hl-color', s.color);
			} else {
				span.setAttribute('data-hl-kind', 'default');
			}
			// Visual style (inside the editor — NOT what the template renders).
			appendHighlightedWithBreaks(span, s.text, (next) => applySpanVisualStyle(next, s));
		}
	}

	function applySpanVisualStyle(span: HTMLSpanElement, s: ReturnType<typeof segmentText>[number]) {
		// Editor-only visual: make highlighted segments reflect THEIR highlight spec,
		// not the editor wrapper color (templates may set red while editing).
		span.style.padding = '0';
		span.style.borderRadius = '0';

		if (s.markerBg) {
			span.style.background = s.markerBg;
			span.style.boxDecorationBreak = 'clone';
			(span.style as any).webkitBoxDecorationBreak = 'clone';
			span.style.padding = '0.08em 0.16em';
			span.style.borderRadius = '0.12em';
			span.style.color = 'inherit';
			return;
		}

		if (s.pattern && s.patternImage) {
			span.style.backgroundImage = `url("${s.patternImage}")`;
			span.style.backgroundSize = 'cover';
			span.style.backgroundPosition = 'center';
			(span.style as any).webkitBackgroundClip = 'text';
			(span.style as any).webkitTextFillColor = 'transparent';
			span.style.backgroundClip = 'text';
			span.style.color = 'transparent';
		} else if (s.gradientFrom && s.gradientTo) {
			span.style.backgroundImage = `linear-gradient(90deg, ${s.gradientFrom}, ${s.gradientTo})`;
			(span.style as any).webkitBackgroundClip = 'text';
			(span.style as any).webkitTextFillColor = 'transparent';
			span.style.backgroundClip = 'text';
			span.style.color = 'transparent';
		} else {
			// Regular color highlight: show colored text (matches template rendering).
			span.style.background = 'transparent';
			span.style.color = s.color ?? defaultColor;
		}
	}

	// Serialize the DOM back to raw markup.
	function serializeDomToMarkup(): string {
		if (!editorEl) return '';
		let out = '';
		for (const node of Array.from(editorEl.childNodes)) {
			out += serializeNode(node);
		}
		// Collapse any stray leftover brackets a user might have pasted.
		return out;
	}

	function serializeNode(node: ChildNode): string {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.textContent ?? '';
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return '';
		const el = node as HTMLElement;
		if (el.tagName === 'BR') return '\n';
		// Highlight span?
		if (el.hasAttribute('data-hl')) {
			const kind = el.getAttribute('data-hl-kind') ?? 'default';
			const inner = (el.textContent ?? '').replace(/\[\[|\]\]/g, '');
			if (!inner) return '';
			switch (kind) {
				case 'marker': {
					const c = el.getAttribute('data-hl-marker') ?? '#FFFFFF';
					return `[[marker(${c}): ${inner}]]`;
				}
				case 'color': {
					const c = el.getAttribute('data-hl-color') ?? defaultColor;
					return `[[${c}: ${inner}]]`;
				}
				case 'gradient': {
					const a = el.getAttribute('data-hl-from') ?? '#000000';
					const b = el.getAttribute('data-hl-to') ?? '#ffffff';
					return `[[grad(${a},${b}): ${inner}]]`;
				}
				case 'pattern': {
					const n = el.getAttribute('data-hl-name') ?? 'dots';
					return `[[pattern(${n}): ${inner}]]`;
				}
				default:
					return `[[${inner}]]`;
			}
		}
		// Unknown element — walk children.
		let s = '';
		for (const child of Array.from(el.childNodes)) s += serializeNode(child);
		return s;
	}

	// Sync external `value` → DOM only when it actually differs from our last emit,
	// so typing doesn't reset the caret.
	$effect(() => {
		if (!editorEl) return;
		if (value === lastSyncedValue) return;
		renderMarkupToDom(value);
		lastSyncedValue = value;
	});

	function handleInput() {
		const next = serializeDomToMarkup();
		lastSyncedValue = next;
		onChange(next);
	}

	// ── Selection → plain-text offsets (for applyHighlight) ────────────────
	function getPlainSelectionRange(): { start: number; end: number } | null {
		if (!editorEl) return null;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return null;
		const range = sel.getRangeAt(0);
		if (!editorEl.contains(range.commonAncestorContainer)) return null;
		if (range.collapsed) return null;

		const start = plainOffsetOf(range.startContainer, range.startOffset);
		const end = plainOffsetOf(range.endContainer, range.endOffset);
		if (start === -1 || end === -1) return null;
		return { start: Math.min(start, end), end: Math.max(start, end) };
	}

	function plainOffsetOf(container: Node, offset: number): number {
		if (!editorEl) return -1;
		let total = 0;
		let found = false;
		const walk = (node: Node) => {
			if (found) return;
			if (node === container && node.nodeType === Node.TEXT_NODE) {
				total += offset;
				found = true;
				return;
			}
			if (node.nodeType === Node.TEXT_NODE) {
				total += (node.textContent ?? '').length;
				return;
			}
			if (node.nodeType === Node.ELEMENT_NODE) {
				// If container IS this element and offset references a child index
				if (node === container) {
					for (let i = 0; i < offset; i++) {
						const child = node.childNodes[i];
						if (child) walkAll(child);
					}
					found = true;
					return;
				}
				for (const child of Array.from(node.childNodes)) {
					if (found) break;
					walk(child);
				}
			}
		};
		const walkAll = (node: Node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				total += (node.textContent ?? '').length;
				return;
			}
			if (node.nodeType === Node.ELEMENT_NODE) {
				for (const child of Array.from(node.childNodes)) walkAll(child);
			}
		};
		walk(editorEl);
		return found ? total : -1;
	}

	function refreshSelectionState() {
		const r = getPlainSelectionRange();
		const next = !!r;
		if (next !== hasRange) {
			hasRange = next;
		}
		onSelectionChange?.(next, r);
	}

	export function applyHighlightToSelection(spec: HighlightSpec): boolean {
		const r = getPlainSelectionRange();
		if (!r) return false;
		const next = applyHighlight(serializeDomToMarkup(), r.start, r.end, spec, defaultColor);
		onChange(next);
		// Re-render from the new markup on next tick so styled spans appear.
		void tick().then(() => {
			renderMarkupToDom(next);
			lastSyncedValue = next;
			// Clear selection after applying for a cleaner UX.
			window.getSelection()?.removeAllRanges();
			hasRange = false;
			onSelectionChange?.(false);
		});
		return true;
	}

	function onToolbarSwatch(color: string) {
		applyHighlightToSelection({ kind: 'color', color });
	}
	function onToolbarClear() {
		applyHighlightToSelection({ kind: 'clear' });
	}
	function onToolbarDefault() {
		applyHighlightToSelection({ kind: 'default' });
	}

	// Strip paste formatting — insert as plain text only.
	function onPaste(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		document.execCommand('insertText', false, text);
	}

	// Show an empty placeholder when content is blank.
	const isEmpty = $derived(!value || value.trim() === '');
</script>

<div class="w-full {klass}">
	{#if showToolbar}
		<div class="flex items-center gap-1 mb-1.5 flex-wrap">
			<span class="text-[9px] font-mono text-white/30 uppercase tracking-wider mr-1">Highlight:</span>
			{#each DEFAULT_SWATCHES as c (c)}
				<button
					type="button"
					onmousedown={(e) => e.preventDefault()}
					onclick={() => onToolbarSwatch(c)}
					disabled={!hasRange}
					class="w-5 h-5 rounded-md border border-white/20 transition-opacity {hasRange ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed'}"
					style="background: {c};"
					title={`Highlight with ${c}`}
					aria-label={`Highlight selection with ${c}`}
				></button>
			{/each}
			<button
				type="button"
				onmousedown={(e) => e.preventDefault()}
				onclick={onToolbarDefault}
				disabled={!hasRange}
				class="px-1.5 h-5 rounded-md border border-white/20 text-[9px] font-mono text-white/70 {hasRange ? 'hover:bg-white/10' : 'opacity-30 cursor-not-allowed'}"
				title="Default highlight"
			>Aa</button>
			<!-- Gradient picker -->
			<div class="relative">
				<button
					type="button"
					data-hl-toggle
					onmousedown={(e) => e.preventDefault()}
					onclick={() => { gradientOpen = !gradientOpen; patternOpen = false; }}
					disabled={!hasRange}
					class="w-5 h-5 rounded-md border border-white/20 {hasRange ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed'}"
					style="background: linear-gradient(90deg, #F5A623, #FF3B5C);"
					title="Gradient highlight"
					aria-label="Apply gradient highlight"
				></button>
				{#if gradientOpen && hasRange}
					<div data-hl-popover class="absolute top-6 left-0 z-50 p-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 shadow-xl flex flex-col gap-1">
						{#each GRADIENT_PRESETS as [from, to] (from + to)}
							<button
								type="button"
								onmousedown={(e) => e.preventDefault()}
								onclick={() => { applyHighlightToSelection({ kind: 'gradient', from, to }); gradientOpen = false; }}
								class="w-24 h-5 rounded border border-white/20 hover:scale-105 transition-transform"
								style="background: linear-gradient(90deg, {from}, {to});"
								title={`${from} → ${to}`}
								aria-label={`Gradient ${from} to ${to}`}
							></button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Pattern picker -->
			{#if AVAILABLE_PATTERNS.length > 0}
				<div class="relative">
					<button
						type="button"
						data-hl-toggle
						onmousedown={(e) => e.preventDefault()}
						onclick={() => { patternOpen = !patternOpen; gradientOpen = false; }}
						disabled={!hasRange}
						class="px-1.5 h-5 rounded-md border border-white/20 text-[9px] font-mono text-white/70 {hasRange ? 'hover:bg-white/10' : 'opacity-30 cursor-not-allowed'}"
						title="Pattern highlight"
						aria-label="Apply pattern highlight"
					>▩</button>
					{#if patternOpen && hasRange}
						<div data-hl-popover class="absolute top-6 left-0 z-50 p-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 shadow-xl flex flex-col gap-1 min-w-[140px]">
							{#each AVAILABLE_PATTERNS as p (p.name)}
								<button
									type="button"
									onmousedown={(e) => e.preventDefault()}
									onclick={() => { applyHighlightToSelection({ kind: 'pattern', name: p.name }); patternOpen = false; }}
									class="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white/10 transition-colors"
									title={p.label}
								>
									<span
										class="w-6 h-4 rounded border border-white/20 shrink-0"
										style="background: url('{p.url}') center/cover;"
									></span>
									<span class="text-[10px] font-mono text-white/70">{p.label}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<button
				type="button"
				onmousedown={(e) => e.preventDefault()}
				onclick={onToolbarClear}
				disabled={!hasRange}
				class="px-1.5 h-5 rounded-md border border-white/20 text-[9px] font-mono text-white/70 {hasRange ? 'hover:bg-white/10' : 'opacity-30 cursor-not-allowed'}"
				title="Clear highlight"
			>✕</button>
		</div>
	{/if}

	<div class="relative">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={editorEl}
			contenteditable="true"
			role="textbox"
			tabindex="0"
			aria-multiline="true"
			aria-label={ariaLabel}
			oninput={handleInput}
			onkeyup={refreshSelectionState}
			onmouseup={refreshSelectionState}
			onselect={refreshSelectionState}
			onpaste={onPaste}
			onfocus={() => onFocus?.()}
			onblur={() => onBlur?.()}
			class="hl-editor w-full outline-none whitespace-pre-wrap break-words"
			style="
				/* Use line-based min-height so large font sizes don't create huge empty gaps. */
				min-height: {minHeight ?? `${Math.max(1, rows)}lh`};
				color: currentColor;
				line-height: 1.12;
				padding: 0;
				{fontFamily ? `font-family: ${fontFamily};` : ''}
				{fontSize ? `font-size: ${fontSize}px;` : ''}
				{uppercase ? 'text-transform: uppercase;' : ''}
			"
		></div>
		{#if isEmpty && placeholder}
			<span
				class="pointer-events-none absolute top-0 left-0 text-white/20"
				style="
					{fontFamily ? `font-family: ${fontFamily};` : ''}
					{fontSize ? `font-size: ${fontSize}px;` : ''}
				"
			>{placeholder}</span>
		{/if}
	</div>
</div>

<style>
	.hl-editor :global(span[data-hl]) {
		font-weight: inherit;
	}
	.hl-editor {
		cursor: text;
		user-select: text;
		caret-color: currentColor;
	}
</style>
