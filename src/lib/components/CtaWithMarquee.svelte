<script lang="ts">
	type Props = {
		images?: string[];
		images2?: string[];
	};

	let {
		images = [
			'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop',
			'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&h=400&fit=crop',
			'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=400&h=400&fit=crop',
			'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=400&h=400&fit=crop',
		],
		images2 = [
			'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=400&h=400&fit=crop',
			'https://images.unsplash.com/photo-1617791160505-6f00504e3519?w=400&h=400&fit=crop',
			'https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?w=400&h=400&fit=crop',
			'https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?w=400&h=400&fit=crop',
		],
	}: Props = $props();

	let displayText = $state('Read More');
	let isScrambling = $state(false);
	const originalText = 'Read More';
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

	function scramble() {
		if (isScrambling) return;
		isScrambling = true;
		let iteration = 0;
		const maxIterations = originalText.length;

		const id = window.setInterval(() => {
			displayText = originalText
				.split('')
				.map((_, idx) => {
					if (idx < iteration) return originalText[idx];
					return chars[Math.floor(Math.random() * chars.length)];
				})
				.join('');

			if (iteration >= maxIterations) {
				window.clearInterval(id);
				isScrambling = false;
				displayText = originalText;
			}

			iteration += 1 / 3;
		}, 30);
	}
</script>

<section class="cta-wrap">
	<div class="cta-container">
		<div class="cta-grid">
			<!-- Left -->
			<div class="cta-left">
				<h2 class="cta-title">The Future of Creative Design</h2>
				<div class="cta-meta">
					<p>March 2025</p>
					<p>Design Studio</p>
				</div>
				<button class="cta-btn" onmouseenter={scramble} type="button">
					{displayText}
				</button>
			</div>

			<!-- Right -->
			<div class="cta-right">
				<div class="marquee" style="--gap: 1rem; --duration: 30s;">
					<div class="marquee-track reverse">
						{#each images as src, idx (src + ':' + idx)}
							<div class="tile">
								<img src={src} alt={`Image ${idx + 1}`} loading="lazy" />
							</div>
						{/each}
					</div>
					<div class="marquee-track reverse" aria-hidden="true">
						{#each images as src, idx (src + ':' + idx)}
							<div class="tile">
								<img src={src} alt="" loading="lazy" />
							</div>
						{/each}
					</div>
				</div>

				<div class="marquee" style="--gap: 1rem; --duration: 30s;">
					<div class="marquee-track">
						{#each images2 as src, idx (src + ':' + idx)}
							<div class="tile">
								<img src={src} alt={`Image ${idx + 5}`} loading="lazy" />
							</div>
						{/each}
					</div>
					<div class="marquee-track" aria-hidden="true">
						{#each images2 as src, idx (src + ':' + idx)}
							<div class="tile">
								<img src={src} alt="" loading="lazy" />
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.cta-wrap {
		background: #0a0a0a;
		color: #ffffff;
		overflow: hidden;
		padding: 40px 0;
	}
	.cta-container {
		max-width: 1160px;
		margin: 0 auto;
		padding: 0 48px;
	}
	.cta-grid {
		display: flex;
		grid-template-columns: 1fr 1fr;
		gap: 22px;
		align-items: center;
	}
	.cta-left {
		display: flex;
		flex-direction: column;
		gap: 18px;
		width:50%;
	}
	.cta-title {
		font-family: var(--font-display);
		font-weight: 900;
		letter-spacing: -0.04em;
		line-height: 1.05;
		margin: 0;
		font-size: clamp(34px, 4.4vw, 62px);
	}
	.cta-meta {
		color: rgba(255,255,255,0.55);
		font-family: var(--font-body);
	}
	.cta-meta p { margin: 0; font-size: 18px; }
	.cta-btn {
		width: fit-content;
		padding: 12px 28px;
		border-radius: 999px;
		border: none;
		background: #f2f2f2;
		color: #0a0a0a;
		font-weight: 700;
		font-family: var(--font-body);
		transition: background 0.18s ease, transform 0.18s ease;
	}
	.cta-btn:hover { background: #ffffff; transform: translateY(-1px); }

	.cta-right { display: flex; flex-direction: column; gap: 14px; width:50%; }

	.marquee {
		display: flex;
		overflow: hidden;
		gap: var(--gap);
	}
	.marquee-track {
		display: flex;
		min-width: 100%;
		flex-shrink: 0;
		align-items: center;
		justify-content: flex-start;
		gap: var(--gap);
		animation: marquee var(--duration) linear infinite;
	}
	.marquee-track.reverse { animation-direction: reverse; }

	.tile {
		width: 192px;
		height: 192px;
		border-radius: 18px;
		overflow: hidden;
		flex-shrink: 0;
		background: rgba(255,255,255,0.06);
	}
	.tile img { filter: saturate(1.02) contrast(1.02); }
	.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }

	@keyframes marquee {
		0% { transform: translateX(0); }
		100% { transform: translateX(calc(-100% - var(--gap))); }
	}

	@media (max-width: 900px) {
		.cta-container { padding: 0 24px; }
		.cta-grid { grid-template-columns: 1fr; }
		.tile { width: 160px; height: 160px; }
	}
	@media (max-width: 600px) {
		.cta-wrap { padding: 44px 0; }
		.tile { width: 132px; height: 132px; border-radius: 16px; }
	}
</style>

