<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { MorphingCardData, MorphingCardStackProps } from './morphing-card-stack-types.js';

	let {
		cards = [],
		class: className,
		onCardClick,
	}: MorphingCardStackProps = $props();

	const SWIPE_THRESHOLD = 56;

	/** Portrait story slides (1080×1350 → 4:5) */
	const SLIDE_W = 300;
	const SLIDE_H = Math.round((SLIDE_W * 5) / 4);
	const STACK_STEP = 36;

	let activeIndex = $state(0);
	let expandedId = $state<string | null>(null);
	let dragX = $state(0);
	let dragging = $state(false);
	let pointerId: number | null = null;
	let startX = 0;
	let moved = false;

	const n = $derived(cards.length);
	const hasImages = $derived(cards.some((c) => !!c.image));

	const stackCards = $derived.by(() => {
		if (!n) return [] as (MorphingCardData & { stackPosition: number })[];
		const ordered: (MorphingCardData & { stackPosition: number })[] = [];
		for (let i = 0; i < n; i++) {
			const index = (activeIndex + i) % n;
			ordered.push({ ...cards[index], stackPosition: i });
		}
		return ordered.slice().reverse();
	});

	const stageW = $derived(
		hasImages ? SLIDE_W + Math.max(0, n - 1) * STACK_STEP + 12 : 256,
	);
	const stageH = $derived(hasImages ? SLIDE_H + Math.max(0, n - 1) * STACK_STEP + 12 : 256);

	function goTo(index: number) {
		if (!n) return;
		activeIndex = ((index % n) + n) % n;
		dragX = 0;
		expandedId = null;
	}

	function next() {
		goTo(activeIndex + 1);
	}

	function prev() {
		goTo(activeIndex - 1);
	}

	function onPointerDown(e: PointerEvent, isTop: boolean) {
		if (!isTop) return;
		pointerId = e.pointerId;
		startX = e.clientX;
		moved = false;
		dragging = true;
		dragX = 0;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || pointerId !== e.pointerId) return;
		const dx = e.clientX - startX;
		if (Math.abs(dx) > 6) moved = true;
		dragX = dx;
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging || pointerId !== e.pointerId) return;
		dragging = false;
		pointerId = null;
		const dx = dragX;
		dragX = 0;
		if (dx < -SWIPE_THRESHOLD) {
			next();
			return;
		}
		if (dx > SWIPE_THRESHOLD) {
			prev();
			return;
		}
		if (!moved) {
			const card = cards[activeIndex];
			if (!card) return;
			expandedId = expandedId === card.id ? null : card.id;
			onCardClick?.(card);
		}
	}

	function onPointerCancel() {
		dragging = false;
		pointerId = null;
		dragX = 0;
	}
</script>

{#if n > 0}
	<div
		class={cn('morph-stack flex flex-col items-center gap-4', className)}
		data-slot="morphing-card-stack"
	>
		<div class="morph-stack-stage relative" style="width: {stageW}px; height: {stageH}px;">
			{#each stackCards as card (card.id)}
				{@const isTop = card.stackPosition === 0}
				{@const Icon = card.icon}
				{@const offset = card.stackPosition * STACK_STEP}
				{@const rotate = (card.stackPosition - 1) * 3.5}
				{@const expanded = expandedId === card.id}
				<div
					role="button"
					tabindex={isTop ? 0 : -1}
					aria-label={card.title}
					class={cn(
						'morph-card absolute left-0 top-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm',
						'transition-[box-shadow,transform] duration-300 ease-out',
						'hover:border-primary/40',
						isTop && 'cursor-grab touch-pan-y active:cursor-grabbing',
						!isTop && 'pointer-events-none',
						expanded && 'ring-2 ring-primary',
						!card.image && 'h-48 w-56 p-4 sm:h-52 sm:w-60',
					)}
					style="
						z-index: {n - card.stackPosition};
						background-color: {card.color ?? ''};
						{card.image
							? `width: ${SLIDE_W}px; height: ${SLIDE_H}px; aspect-ratio: 4 / 5;`
							: ''}
						transform:
							translate({isTop ? dragX : 0}px, {offset}px)
							translateX({offset}px)
							rotate({isTop ? dragX * 0.04 + rotate : rotate}deg)
							scale({expanded ? 1.03 : 1});
						opacity: {isTop && dragging ? 0.96 : 1};
						transition: {dragging && isTop
							? 'none'
							: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease'};
					"
					onpointerdown={(e) => onPointerDown(e, isTop)}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerCancel}
					onkeydown={(e) => {
						if (!isTop) return;
						if (e.key === 'ArrowLeft') {
							e.preventDefault();
							prev();
						} else if (e.key === 'ArrowRight') {
							e.preventDefault();
							next();
						} else if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							expandedId = expandedId === card.id ? null : card.id;
							onCardClick?.(card);
						}
					}}
				>
					{#if card.image}
						<img
							src={card.image}
							alt={card.title}
							width="1080"
							height="1350"
							class="h-full w-full object-cover object-top"
							draggable="false"
						/>
						{#if isTop && n > 1}
							<div
								class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2.5 pt-8 text-center"
							>
								<span class="text-[11px] font-medium text-white/75">Swipe to navigate</span>
							</div>
						{/if}
					{:else}
						<div class="flex items-start gap-3">
							{#if Icon}
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"
								>
									<Icon class="h-5 w-5" />
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<h3 class="truncate font-semibold text-card-foreground">{card.title}</h3>
								{#if card.description}
									<p class="mt-1 line-clamp-3 text-sm text-muted-foreground">{card.description}</p>
								{/if}
							</div>
						</div>
						{#if isTop && n > 1}
							<div class="pointer-events-none absolute bottom-2 left-0 right-0 text-center">
								<span class="text-xs text-muted-foreground/50">Swipe to navigate</span>
							</div>
						{/if}
					{/if}
				</div>
			{/each}
		</div>

		{#if n > 1}
			<div class="flex justify-center gap-1.5">
				{#each cards as _, index (index)}
					<button
						type="button"
						onclick={() => goTo(index)}
						class={cn(
							'h-1.5 rounded-full transition-all',
							index === activeIndex
								? 'w-4 bg-primary'
								: 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
						)}
						aria-label={`Go to card ${index + 1}`}
						aria-current={index === activeIndex ? 'true' : undefined}
					></button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
