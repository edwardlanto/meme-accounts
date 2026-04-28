<script lang="ts">
	import {
		Scissors,
		VolumeX,
		Sparkles,
		Circle,
		Type,
		Image as ImageIcon,
		Palette,
		Undo2,
		Redo2,
	} from 'lucide-svelte';

	type Props = {
		images?: string[];
		durationSec?: number;
		heading?: string;
		paragraph?: string;
	};

	let {
		images = [
			'https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
			'https://images.unsplash.com/photo-1472396961693-142e6e269027?q=80&w=2152&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
			'https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=2126&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
			'https://images.unsplash.com/photo-1482881497185-d4a9ddbe4151?q=80&w=1965&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
			'https://plus.unsplash.com/premium_photo-1673264933212-d78737f38e48?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
			'https://plus.unsplash.com/premium_photo-1711434824963-ca894373272e?q=80&w=2030&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
			'https://plus.unsplash.com/premium_photo-1675705721263-0bbeec261c49?q=80&w=1940&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
			'https://images.unsplash.com/photo-1524799526615-766a9833dec0?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
		],
		durationSec = 40,
		heading = 'A feed that never stops moving',
		paragraph = 'Fresh visuals, smooth motion, and an always-on sense of momentum—built for creators who ship daily.',
	}: Props = $props();

	const duplicated = $derived([...(images ?? []), ...(images ?? [])]);

	const dockItems = [
		{ icon: Scissors, label: 'Trim' },
		{ icon: VolumeX, label: 'Mute' },
		{ icon: Sparkles, label: 'AI' },
		{ icon: Circle, label: 'Shape' },
		{ icon: Type, label: 'Text' },
		{ icon: ImageIcon, label: 'Image' },
		{ icon: Palette, label: 'Colors' },
		{ icon: Undo2, label: 'Undo' },
		{ icon: Redo2, label: 'Redo' },
	] as const;
</script>

<section class="slider-wrap" style={`--duration:${Math.max(6, Number(durationSec) || 40)}s;`}>
	<div class="slider-bg" aria-hidden="true"></div>

	<div class="slider-center">
		<div class="slider-inner">
			<div class="dock-shell" aria-label="Editor dock">
				<div class="dock-float">
					{#each dockItems as item (item.label)}
						<button type="button" class="dock-btn" aria-label={item.label} title={item.label}>
							<item.icon size={18} class="dock-ico" />
							<span class="dock-tip" aria-hidden="true">{item.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="slider-copy">
				<h2 class="slider-h">{heading}</h2>
				<p class="slider-p">{paragraph}</p>
			</div>

			<div class="scroll-container">
				<div class="infinite-scroll">
					{#each duplicated as image, index (image + ':' + index)}
						<div class="image-item">
							<img
								src={image}
								alt={`Gallery image ${(index % Math.max(1, (images ?? []).length)) + 1}`}
								loading="lazy"
								decoding="async"
							/>
						</div>
					{/each}
				</div>
			</div>

			<div class="scroll-container scroll-container--second" aria-hidden="true">
				<div class="infinite-scroll infinite-scroll--reverse">
					{#each duplicated as image, index ('rev:' + image + ':' + index)}
						<div class="image-item">
							<img
								src={image}
								alt=""
								loading="lazy"
								decoding="async"
							/>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<div class="slider-bottom" aria-hidden="true"></div>
</section>

<style>
	@keyframes dock-float {
		0% { transform: translateY(0); }
		50% { transform: translateY(4px); }
		100% { transform: translateY(0); }
	}

	@keyframes scroll-right {
		0% { transform: translateX(0); }
		100% { transform: translateX(-50%); }
	}

	.slider-wrap {
		width: 100%;
		/* min-height: 100vh; */
		background: #f8f8f8;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.slider-bg {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			#f8f8f8 0%,
			rgba(248,248,248,0.96) 40%,
			rgba(248,248,248,1) 100%
		);
		z-index: 0;
	}

	.slider-center {
		position: relative;
		z-index: 10;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 56px 0 32px;
	}

	.slider-inner {
		width: 100%;
		/* Almost full-width, but keep a small safe gutter */
		max-width: min(1440px, calc(100vw - 48px));
		padding: 0 16px;
	}

	.dock-shell {
		width: 100%;
		display: flex;
		justify-content: center;
		margin: 0 auto 18px;
	}

	.dock-float {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px;
		border-radius: 16px;
		background: rgba(255,255,255,0.78);
		border: 1px solid rgba(10,10,10,0.08);
		box-shadow: 0 14px 44px rgba(0,0,0,0.10);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		animation: dock-float 4s ease-in-out infinite;
	}

	.dock-btn {
		position: relative;
		border: none;
		background: transparent;
		padding: 10px;
		border-radius: 12px;
		cursor: pointer;
		transition: transform 160ms ease, background-color 160ms ease;
	}

	.dock-btn:hover {
		transform: translateY(-2px) scale(1.08);
		background: rgba(10,10,10,0.06);
	}

	.dock-btn:active {
		transform: translateY(-1px) scale(0.98);
	}

	.dock-btn :global(svg) {
		color: rgba(10,10,10,0.9);
	}

	.dock-tip {
		position: absolute;
		left: 50%;
		top: -8px;
		transform: translate(-50%, -100%);
		padding: 4px 8px;
		border-radius: 10px;
		font-size: 12px;
		line-height: 1;
		white-space: nowrap;
		background: rgba(10,10,10,0.92);
		color: rgba(255,255,255,0.92);
		opacity: 0;
		pointer-events: none;
		transition: opacity 160ms ease;
	}

	.dock-btn:hover .dock-tip {
		opacity: 1;
	}

	.slider-copy {
		max-width: 42rem;
		margin: 0 auto 22px;
		text-align: center;
	}

	.slider-h {
		margin: 0 0 10px;
		font-family: var(--font-display, var(--font-sans, system-ui));
		font-size: clamp(26px, 2.6vw, 36px);
		line-height: 1.08;
		letter-spacing: -0.03em;
		font-weight: 900;
		color: rgba(10,10,10,0.92);
	}

	.slider-p {
		margin: 0;
		font-size: 15px;
		line-height: 1.6;
		color: rgba(10,10,10,0.56);
	}

	.scroll-container {
		width: 100%;
		/* soft edge fade */
		mask: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
		-webkit-mask: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
	}

	.scroll-container--second {
		margin-top: 18px;
	}

	.infinite-scroll {
		display: flex;
		gap: 24px;
		width: max-content;
		animation: scroll-right var(--duration) linear infinite;
		will-change: transform;
	}

	.infinite-scroll--reverse {
		animation-direction: reverse;
	}

	.image-item {
		flex-shrink: 0;
		width: 192px;
		height: 192px;
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 22px 60px rgba(0,0,0,0.18);
		transition: transform 0.3s ease, filter 0.3s ease;
	}

	.image-item:hover {
		transform: scale(1.05);
		filter: brightness(1.1);
	}

	.image-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.slider-bottom {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 96px;
		background: linear-gradient(to top, #f8f8f8, transparent);
		z-index: 20;
	}

	@media (min-width: 768px) {
		.image-item { width: 256px; height: 256px; border-radius: 16px; }
	}
	@media (min-width: 1024px) {
		.image-item { width: 320px; height: 320px; border-radius: 18px; }
	}
</style>

