<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight } from 'lucide-svelte';
	import {
		STARTER_TEMPLATES,
		starterArrowClass,
		starterHoverClass,
		type StarterTemplate,
	} from '$lib/templates';

	interface Props {
		templates?: StarterTemplate[];
	}

	let { templates = STARTER_TEMPLATES }: Props = $props();

	let gridEl = $state<HTMLDivElement | null>(null);
	let templateCols = $state(5);
	let templateCardW = $state(220);

	let uiTheme = $state<'light' | 'dark'>('light');

	onMount(() => {
		const readTheme = (): 'light' | 'dark' =>
			document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
		uiTheme = readTheme();
		const themeObs = new MutationObserver(() => {
			uiTheme = readTheme();
		});
		themeObs.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme'],
		});

		const el = gridEl;
		if (!el) return () => themeObs.disconnect();

		const GAP = 16;
		const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

		const compute = (w: number) => {
			const cols = w >= 1560 ? 6 : w >= 1240 ? 5 : w >= 980 ? 4 : w >= 720 ? 3 : 2;
			templateCols = cols;
			const card = (w - GAP * (cols - 1)) / cols;
			templateCardW = Math.round(clamp(card, 180, 260));
		};

		const ro = new ResizeObserver((entries) => {
			const cr = entries[0]?.contentRect;
			if (!cr) return;
			compute(cr.width);
		});
		ro.observe(el);
		compute(el.getBoundingClientRect().width);

		return () => {
			themeObs.disconnect();
			ro.disconnect();
		};
	});

	function previewHeight(cardW: number): number {
		return Math.round(cardW * (1350 / 1080));
	}
</script>

<div
	bind:this={gridEl}
	class="templates-grid"
	style="--cols:{templateCols}; --cardw:{templateCardW}px;"
>
	{#each templates as tmpl, i (tmpl.id)}
		<a
			href={tmpl.href}
			class="tmpl-card group flex flex-col rounded-2xl overflow-hidden shrink-0 {starterHoverClass(tmpl.id)}"
			style="width: 100%; --d:{0.06 + i * 0.04}s"
		>
			<div
				class="tmpl-preview"
				style="height: {previewHeight(templateCardW)}px;"
			>
				{#if tmpl.id === 'empty'}
					<div
						class="blank-preview"
						style="background: {uiTheme === 'dark' ? 'rgba(23,23,23,0.92)' : '#fafafa'}; border-color: {uiTheme === 'dark' ? 'rgba(163,163,163,0.35)' : 'rgba(163,163,163,0.55)'};"
					>
						<span
							class="blank-label"
							style="color: {uiTheme === 'dark' ? 'rgba(163,163,163,0.65)' : 'rgba(115,115,115,0.85)'};"
						>Blank canvas</span>
						<span
							class="blank-sub"
							style="color: {uiTheme === 'dark' ? 'rgba(163,163,163,0.45)' : 'rgba(115,115,115,0.55)'};"
						>Opens Studio with no placeholder copy or media</span>
					</div>
				{:else if tmpl.previewBg}
					<img
						src={tmpl.previewBg}
						alt=""
						class="preview-img"
						loading="lazy"
						draggable="false"
					/>
				{/if}
			</div>

			<div class="tmpl-footer px-3 py-2.5 flex items-center justify-between gap-2 border-t">
				<div class="min-w-0">
					<p class="tmpl-title text-xs font-display font-semibold truncate">{tmpl.name}</p>
					<p class="tmpl-desc text-[10px] font-body truncate leading-tight">{tmpl.description}</p>
				</div>
				<ArrowRight
					size={13}
					class="tmpl-arrow {starterArrowClass(tmpl.id)} group-hover:translate-x-0.5 transition-all shrink-0"
				/>
			</div>
		</a>
	{/each}
</div>

<style>
	.templates-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols, 5), minmax(0, 1fr));
		gap: 16px;
		align-items: start;
	}

	.tmpl-card {
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
		box-shadow: var(--shadow-soft);
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.25s ease,
			box-shadow 0.32s ease;
	}

	.tmpl-card:hover {
		transform: translateY(-3px);
		border-color: var(--panel-border-hover);
		box-shadow: var(--shadow-pop);
	}

	.tmpl-preview {
		width: 100%;
		overflow: hidden;
		flex-shrink: 0;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0a0a0c;
	}

	.preview-img {
		position: absolute;
		inset: 0;
		height: 100%;
		width: 100%;
		object-fit: cover;
		object-position: top center;
		pointer-events: none;
		user-select: none;
	}

	.blank-preview {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		pointer-events: none;
		user-select: none;
		border: 2px dashed;
	}

	.blank-label {
		font-size: 9px;
		font-family: ui-monospace, monospace;
		text-transform: uppercase;
		letter-spacing: 0.2em;
	}

	.blank-sub {
		font-size: 8px;
		max-width: 75%;
		text-align: center;
		line-height: 1.35;
	}

	:global(.tmpl-footer) {
		background: var(--panel-bg);
		border-color: var(--panel-border) !important;
	}

	:global(.tmpl-title) {
		color: var(--t-strong) !important;
		font-family: 'Satoshi', sans-serif;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	:global(.tmpl-desc) {
		color: var(--t-muted) !important;
	}

	:global(.tmpl-arrow) {
		color: var(--t-muted) !important;
		transition: transform 0.22s ease, color 0.22s ease;
	}

	.tmpl-card:hover :global(.tmpl-arrow) {
		color: var(--t-strong) !important;
		transform: translateX(2px);
	}
</style>
