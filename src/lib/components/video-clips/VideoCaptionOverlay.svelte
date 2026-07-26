<script lang="ts">
	import type { CaptionTemplate, CaptionAnimation } from '$lib/video-clips/caption-templates';
	import type { CaptionPhrase } from '$lib/video-clips/caption-chunking';
	import { getActiveWordIndex } from '$lib/video-clips/caption-chunking';

	type Props = {
		phrase: CaptionPhrase | null;
		currentTime: number;
		/** Precomputed active word index from parent rAF (avoids laggy recompute) */
		activeWordIndex?: number;
		template: CaptionTemplate;
		enabled: boolean;
		position?: 'top' | 'center' | 'bottom';
		customColor?: string;
		customBgColor?: string;
		customFontSize?: number;
		customHighlightColor?: string;
		animationOverride?: CaptionAnimation | null;
		strokeEnabled?: boolean;
		draggable?: boolean;
		customX?: number | null;
		customY?: number | null;
		oncustomposition?: (x: number, y: number) => void;
	};

	let {
		phrase = null,
		currentTime = 0,
		activeWordIndex: activeWordIndexProp = undefined,
		template,
		enabled = true,
		position = 'bottom',
		customColor,
		customBgColor,
		customFontSize,
		customHighlightColor,
		animationOverride = null,
		strokeEnabled = true,
		draggable = false,
		customX = null,
		customY = null,
		oncustomposition,
	}: Props = $props();

	let isDragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let captionElement: HTMLDivElement | null = $state(null);

	const positionStyles = {
		top: 'top: 10%;',
		center: 'top: 50%; transform: translate(-50%, -50%);',
		bottom: 'bottom: 15%;',
	};

	const textColor = $derived(customColor || template.textColor);
	/** Never treat missing/transparent as a solid fill — that accidentally boxes every word. */
	const bgColor = $derived.by(() => {
		const raw = (customBgColor ?? template.backgroundColor ?? 'transparent').trim();
		if (!raw || raw === 'transparent' || raw === 'none') return 'transparent';
		return raw;
	});
	const hasPhraseBox = $derived(bgColor !== 'transparent');
	const fontSize = $derived(customFontSize || template.fontSize);
	const highlight = $derived(customHighlightColor || template.highlightColor || '#ffeb3b');
	const animation = $derived(animationOverride ?? template.animation);

	const activeWordIndex = $derived(
		activeWordIndexProp != null
			? activeWordIndexProp
			: phrase
				? getActiveWordIndex(phrase, currentTime)
				: -1,
	);
	const phraseKey = $derived(phrase ? `${phrase.startSec}-${phrase.text}` : '');

	function handleMouseDown(e: MouseEvent) {
		if (!draggable || !captionElement) return;
		isDragging = true;
		dragStartX = e.clientX - (customX ?? 0);
		dragStartY = e.clientY - (customY ?? 0);
		e.preventDefault();
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || !draggable) return;
		const newX = e.clientX - dragStartX;
		const newY = e.clientY - dragStartY;
		if (oncustomposition) oncustomposition(newX, newY);
	}

	function handleMouseUp() {
		isDragging = false;
	}

	$effect(() => {
		if (draggable && isDragging) {
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);
			return () => {
				window.removeEventListener('mousemove', handleMouseMove);
				window.removeEventListener('mouseup', handleMouseUp);
			};
		}
	});

	function textStrokeStyle(t: CaptionTemplate): string {
		const useStroke = strokeEnabled || t.textStroke;
		if (!useStroke) {
			// Always keep a readable shadow so white text doesn't vanish on bright frames
			return `text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.55);`;
		}
		const w = t.strokeWidth || 3;
		const c = t.strokeColor || '#000000';
		return `-webkit-text-stroke: ${w}px ${c}; paint-order: stroke fill; text-shadow: 0 3px 8px rgba(0,0,0,0.65);`;
	}
</script>

{#if enabled && phrase}
	<div
		bind:this={captionElement}
		class="caption-overlay"
		class:draggable
		class:dragging={isDragging}
		style="{draggable && customX != null && customY != null
			? `left: ${customX}px; top: ${customY}px; transform: none;`
			: positionStyles[position]}"
		onmousedown={handleMouseDown}
		role="presentation"
	>
		{#key phraseKey}
			<div
				class="caption-text anim-{animation}"
				class:caption-text-boxed={hasPhraseBox}
				style="
					font-family: {template.fontFamily};
					font-size: {fontSize}px;
					font-weight: {template.fontWeight};
					color: {textColor};
					text-transform: {template.textTransform};
					letter-spacing: {template.letterSpacing};
					line-height: {template.lineHeight};
					text-align: {template.textAlign};
					background: {bgColor};
					padding: {hasPhraseBox ? template.padding : '0'};
					border-radius: {hasPhraseBox ? template.borderRadius : '0'};
					{textStrokeStyle(template)}
					max-width: {template.maxWidth};
				"
			>
				{#each phrase.words as word, i (i)}
					{@const isActive = i === activeWordIndex}
					{@const isPast = i < activeWordIndex}
					{@const isKeyword = !!word.keyword}
					<span
						class="caption-word"
						class:active={isActive}
						class:past={isPast}
						class:keyword={isKeyword}
						style="
							--i: {i};
							--delay: {i * 0.06}s;
							{animation === 'karaoke' && isActive ? `color: ${highlight};` : ''}
							{animation === 'karaoke' && isActive && template.highlightBg
								? `background: ${template.highlightBg}; color: #111; padding: 0 6px; border-radius: 4px;`
								: ''}
							{animation === 'word-reveal' && !isActive && !isPast ? 'opacity: 0.15;' : ''}
							{animation === 'bounce' && isActive ? `color: ${highlight};` : ''}
							{animation === 'zoom' && isActive ? `color: ${highlight}; display: inline-block; transform: scale(1.15);` : ''}
							{isKeyword && !isActive
								? `color: ${highlight};`
								: ''}
						"
					>
						{word.text}{#if i < phrase.words.length - 1}&nbsp;{/if}
					</span>
				{/each}
			</div>
		{/key}
	</div>
{/if}

<style>
	.caption-overlay {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		pointer-events: none;
		width: 90%;
		display: flex;
		justify-content: center;
	}

	.caption-overlay.draggable {
		pointer-events: auto;
		cursor: move;
		width: auto;
	}

	.caption-overlay.dragging {
		cursor: grabbing;
	}

	.caption-text {
		display: inline-block;
		word-wrap: break-word;
		white-space: pre-wrap;
		max-width: 95%;
		user-select: none;
	}

	.caption-text-boxed {
		/* padding/background come from inline styles when a real fill is set */
	}

	.caption-word {
		display: inline-block;
		transition:
			color 0.04s linear,
			transform 0.08s ease,
			opacity 0.08s ease,
			background 0.04s linear;
	}

	/* Pop: phrase scale-in */
	.anim-pop {
		animation: pop-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	/* Bounce: each word bounces in sequence */
	.anim-bounce .caption-word {
		animation: bounce-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
		animation-delay: var(--delay);
	}

	/* Slide-up: phrase slides from bottom */
	.anim-slide-up {
		animation: slide-up 0.3s ease-out;
	}

	/* Fade: soft fade in */
	.anim-fade {
		animation: fade-in 0.25s ease;
	}

	/* Zoom: strong scale-in */
	.anim-zoom {
		animation: zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	/* Word-reveal: words become visible as they're spoken (handled by inline style) */
	.anim-word-reveal {
		animation: fade-in 0.2s ease;
	}

	/* Karaoke: whole phrase visible, active word highlighted via inline style */
	.anim-karaoke {
		animation: fade-in 0.2s ease;
	}

	.anim-none {
		animation: none;
	}

	@keyframes pop-in {
		0% {
			opacity: 0;
			transform: scale(0.7);
		}
		60% {
			transform: scale(1.08);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes bounce-in {
		0% {
			opacity: 0;
			transform: translateY(20px) scale(0.6);
		}
		60% {
			transform: translateY(-4px) scale(1.1);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes slide-up {
		0% {
			opacity: 0;
			transform: translateY(30px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes zoom-in {
		0% {
			opacity: 0;
			transform: scale(0.4);
		}
		70% {
			transform: scale(1.15);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
