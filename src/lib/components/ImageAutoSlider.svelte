<script lang="ts">
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
</script>

<section class="slider-wrap" style={`--duration:${Math.max(6, Number(durationSec) || 40)}s;`}>
	<div class="slider-bg" aria-hidden="true"></div>

	<div class="slider-center">
		<div class="slider-inner">
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

