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
	import { parseHighlightMarkup, segmentText, applyHighlight, type HighlightSpec } from '$lib/highlight';
	import { tick } from 'svelte';

	interface Props {
		value: string;
		placeholder?: string;
		/** Default highlight color used by parseHighlightMarkup (for [[WORD]] without explicit color). */
		defaultColor?: string;
		rows?: number;
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
		onSelectionChange?: (hasRange: boolean) => void;
		onFocus?: () => void;
		onBlur?: () => void;
	}

	let {
		value,
		placeholder = '',
		defaultColor = '#F59E0B',
		rows = 4,
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

	// Render raw markup → DOM spans inside `editorEl`.
	function renderMarkupToDom(raw: string) {
		if (!editorEl) return;
		const parsed = parseHighlightMarkup(raw, defaultColor);
		const segs = segmentText(parsed);
		editorEl.innerHTML = '';
		if (segs.length === 0) {
			// Keep a zero-width br so the caret has somewhere to sit.
			editorEl.appendChild(document.createElement('br'));
			return;
		}
		for (const s of segs) {
			if (!s.highlighted) {
				editorEl.appendChild(document.createTextNode(s.text));
				continue;
			}
			const span = document.createElement('span');
			span.setAttribute('data-hl', '1');
			if (s.pattern) {
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
			applySpanVisualStyle(span, s);
			span.textContent = s.text;
			editorEl.appendChild(span);
		}
	}

	function applySpanVisualStyle(span: HTMLSpanElement, s: ReturnType<typeof segmentText>[number]) {
		span.style.padding = '0 0.15em';
		span.style.borderRadius = '3px';
		span.style.color = '#000';
		if (s.pattern) {
			span.style.background = s.patternImage
				? `url("${s.patternImage}") center/cover`
				: '#F59E0B';
		} else if (s.gradientFrom && s.gradientTo) {
			span.style.background = `linear-gradient(90deg, ${s.gradientFrom}, ${s.gradientTo})`;
		} else {
			span.style.background = s.color ?? '#F59E0B';
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
			onSelectionChange?.(next);
		}
	}

	export function applyHighlightToSelection(spec: HighlightSpec): boolean {
		const r = getPlainSelectionRange();
		if (!r) return false;
		const next = applyHighlight(serializeDomToMarkup(), r.start, r.end, spec);
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
				min-height: {rows * 1.5}em;
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
</style>
