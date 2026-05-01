<script lang="ts">
	import { onMount } from 'svelte';

	let mounted = $state(false);
	let scrollY = $state(0);

	/** Phone marquee — replace with your own image/video assets when ready. */
	const phoneMarqueePlaceholder = '/placeholders/marquee/news-template-placeholder.png';
	const phoneScreens = [phoneMarqueePlaceholder];

	const phoneLabels = [
		{ tint: '#FFB4A2', tag: 'Carousel' },
		{ tint: '#B5E48C', tag: 'Reel' },
		{ tint: '#A0C4FF', tag: 'Story' },
		{ tint: '#FFC8DD', tag: 'Post' },
		{ tint: '#FFD6A5', tag: 'Schedule' },
	];

	const featured = [
		{ title: 'Morning Hooks', creator: 'Maya Carter', initials: 'MC',
		  bg: '#7B2D26', img: '/placeholders/placeholder-square.jpeg' },
		{ title: 'Reel Lab',      creator: 'Avery James', initials: 'AJ',
		  bg: '#D67862', img: '/placeholders/placeholder-square.jpeg' },
		{ title: 'Story Boost',   creator: 'Sienna Cole', initials: 'SC',
		  bg: '#3D6B8C', img: '/placeholders/placeholder-square.jpeg' },
		{ title: 'Caption Co.',   creator: 'Devin Park',  initials: 'DP',
		  bg: '#A6B4C4', img: '/placeholders/placeholder-square.jpeg' },
	];

	onMount(() => {
		mounted = true;
		const onScroll = () => { scrollY = window.scrollY; };
		window.addEventListener('scroll', onScroll, { passive: true });

		const io = new IntersectionObserver((entries) => {
			entries.forEach((e) => {
				if (e.isIntersecting) {
					(e.target as HTMLElement).classList.add('in');
					io.unobserve(e.target);
				}
			});
		}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

		const revealEls = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
		revealEls.forEach((el) => io.observe(el));

		// Above-the-fold fallback — show anything already in view immediately.
		requestAnimationFrame(() => {
			for (const el of revealEls) {
				const r = el.getBoundingClientRect();
				if (r.top < window.innerHeight * 0.95 && r.bottom > 0) {
					el.classList.add('in');
					io.unobserve(el);
				}
			}
		});

		return () => {
			window.removeEventListener('scroll', onScroll);
			io.disconnect();
		};
	});
</script>

<svelte:head>
	<title>Carousel Studio — Posting Made Easy</title>
	<meta name="description" content="Pick a template. Connect your account. Auto-post on schedule." />
</svelte:head>

<div class="page" class:mounted>
	<!-- NAV -->
	<nav class="nav" class:scrolled={scrollY > 24}>
		<a href="/" class="brand">
			<span class="brand-mark"></span>
			<span class="brand-name">CarouselStudio</span>
		</a>
		<div class="nav-actions">
			<a href="/dashboard" class="btn btn-ghost">Launch a Studio</a>
			<a href="/signup" class="btn btn-dark">Get CarouselStudio</a>
		</div>
	</nav>

	<!-- HERO -->
	<section class="hero">
		<div class="hero-inner">
			<div class="hero-app">
				<div class="hero-icon" aria-hidden="true">
					<svg viewBox="0 0 64 64" width="44" height="44" fill="none">
						<rect x="14" y="10" width="36" height="44" rx="6" fill="#fff" opacity="0.18"/>
						<rect x="10" y="14" width="36" height="44" rx="6" fill="#fff" opacity="0.55"/>
						<rect x="6" y="18" width="36" height="44" rx="6" fill="#fff"/>
						<circle cx="14" cy="28" r="3" fill="#0f0f10"/>
						<rect x="22" y="26" width="14" height="3" rx="1.5" fill="#0f0f10"/>
						<rect x="22" y="32" width="10" height="3" rx="1.5" fill="#0f0f10" opacity="0.5"/>
					</svg>
				</div>
				<p class="hero-app-name">CarouselStudio</p>
			</div>
			<h1 class="hero-title">Posting Made Easy</h1>
			<p class="hero-sub">Pick a Template. Connect your Account. That's it.</p>
			<div class="hero-ctas">
				<a href="/signup" class="btn btn-dark btn-cta">
					Explore Templates
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
						<line x1="5" y1="12" x2="19" y2="12"/>
						<polyline points="12 5 19 12 12 19"/>
					</svg>
				</a>
			</div>
		</div>

		<!-- Phone marquee -->
		<div class="phone-stage">
			<div class="phone-track">
				{#each [...phoneLabels, ...phoneLabels] as p, i}
					<div class="phone" style="--tint:{p.tint}; --i:{i}">
						<div class="phone-frame">
							<div class="phone-notch"></div>
							<div class="phone-screen" style="background:{p.tint}">
								<img src={phoneScreens[i % phoneScreens.length]} alt="" />
								<div class="phone-overlay">
									<div class="phone-pill">{p.tag}</div>
								</div>
							</div>
							<div class="phone-bar"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FEATURED -->
	<section class="featured">
		<div class="container">
			<h2 class="featured-h reveal">Featured</h2>
			<div class="featured-grid">
				{#each featured as f, i}
					<a href="/dashboard" class="feat-card reveal" style="background:{f.bg}; --d:{i * 0.08}s">
						<img class="feat-img" src={f.img} alt="" />
						<span class="feat-badge">Featured</span>
						<div class="feat-info">
							<h3 class="feat-title">{f.title}</h3>
							<p class="feat-by">
								by
								<span class="feat-avatar">{f.initials}</span>
								<span class="feat-creator">{f.creator}</span>
							</p>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS (floating cards) -->
	<section class="how">
		<div class="container">
			<h2 class="how-title reveal">How it works.</h2>

			<div class="how-row">
				<!-- Step 1: pick a template card -->
				<div class="how-col reveal" style="--d:0s">
					<div class="float-card fc-template">
						<div class="fc-thumb" aria-hidden="true">
							<svg viewBox="0 0 40 40" width="22" height="22" fill="none">
								<rect x="6" y="6" width="28" height="28" rx="6" fill="#0f0f10"/>
								<rect x="11" y="11" width="18" height="3" rx="1.5" fill="#E8FF48"/>
								<rect x="11" y="17" width="14" height="3" rx="1.5" fill="#fff" opacity=".55"/>
								<rect x="11" y="23" width="10" height="3" rx="1.5" fill="#fff" opacity=".25"/>
							</svg>
						</div>
						<div class="fc-text">
							<p class="fc-title">Studio Pack</p>
							<div class="fc-by">
								<span class="fc-dot"></span>
								<span>Maya Carter</span>
							</div>
						</div>
					</div>
					<h3 class="how-step-title">Pick your Template</h3>
					<p class="how-step-desc">Choose from any of our templates to post with.</p>
				</div>

				<!-- Step 2: connect account card -->
				<div class="how-col reveal" style="--d:0.08s">
					<div class="float-card fc-account">
						<div class="fc-platform">
							<svg viewBox="0 0 40 40" width="22" height="22" aria-hidden="true">
								<circle cx="20" cy="20" r="20" fill="#0f0f10"/>
								<path d="M14 26 L18 14 L20 22 L26 12 L26 26" stroke="#E8FF48" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<div class="fc-text">
							<p class="fc-title">12,400 followers</p>
							<p class="fc-handle">@yourbrand</p>
						</div>
					</div>
					<h3 class="how-step-title">Connect your Account</h3>
					<p class="how-step-desc">Link directly to your favorite social platform.</p>
				</div>

				<!-- Step 3: auto-post chips -->
				<div class="how-col reveal" style="--d:0.16s">
					<div class="float-card fc-chips">
						<span class="chip" style="background:#0f0f10">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8FF48" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
						</span>
						<span class="chip" style="background:#3D6B8C">
							<span class="chip-letter">IG</span>
						</span>
						<span class="chip" style="background:#E8B4B8">
							<span class="chip-letter">TT</span>
						</span>
					</div>
					<h3 class="how-step-title">Auto-Post Daily</h3>
					<p class="how-step-desc">CarouselStudio automatically schedules posts across your accounts.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA STRIP -->
	<section class="cta-strip">
		<div class="container cta-row reveal">
			<div>
				<h3 class="cta-h">Ready to put posting on autopilot?</h3>
				<p class="cta-p">Free to start. No credit card. Cancel anytime.</p>
			</div>
			<a href="/signup" class="btn btn-dark btn-lg">Get CarouselStudio</a>
		</div>
	</section>

	<!-- FOOTER -->
	<footer class="footer">
		<div class="container footer-grid">
			<div class="footer-brand">
				<a href="/" class="brand">
					<span class="brand-mark"></span>
					<span class="brand-name">CarouselStudio</span>
				</a>
				<p class="footer-tag">Schedule. Post. Grow. From one calm studio.</p>
			</div>

			<div class="footer-col">
				<p class="footer-h">Company</p>
				<a href="/about">About</a>
				<a href="/careers">Careers</a>
				<a href="/contact">Contact</a>
				<a href="/faq">FAQs</a>
			</div>

			<div class="footer-col">
				<p class="footer-h">Legal</p>
				<a href="/privacy">Privacy</a>
				<a href="/terms">Terms</a>
				<a href="/disclaimer">Disclaimer</a>
			</div>
		</div>

		<div class="container footer-bottom">
			<p>© 2026 CarouselStudio. All rights reserved.</p>
			<p class="footer-fine">
				CarouselStudio is a content scheduling tool. Brand names belong to their respective owners.
			</p>
		</div>
	</footer>
</div>

<style>
	/* ─── tokens ──────────────────────────────────────────── */
	.page {
		--ap-bg: #ffffff;
		--ap-soft: #f6f5f1;
		--ap-text: #0f0f10;
		--ap-text-2: #5b5b62;
		--ap-text-3: #9a9aa1;
		--ap-line: rgba(15, 15, 16, 0.08);
		--ap-line-2: rgba(15, 15, 16, 0.14);
		--ap-accent: #0f0f10;

		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		color: var(--ap-text);
		background: var(--ap-bg);
		min-height: 100vh;
		overflow-x: hidden;
		-webkit-font-smoothing: antialiased;
		letter-spacing: -0.01em;
	}

	.container {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 32px;
	}

	/* ─── reveal animation ────────────────────────────────── */
	.reveal {
		opacity: 1;
		transform: none;
		transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s),
		            transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
		will-change: opacity, transform;
	}
	.page.mounted .reveal:not(.in) {
		opacity: 0;
		transform: translateY(24px);
	}
	.page.mounted .reveal.in {
		opacity: 1;
		transform: translateY(0);
	}

	/* ─── nav ─────────────────────────────────────────────── */
	.nav {
		position: fixed;
		top: 0; left: 0; right: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 32px;
		transition: background 0.35s ease, backdrop-filter 0.35s ease,
		            border-color 0.35s ease, padding 0.35s ease;
		border-bottom: 1px solid transparent;
	}
	.nav.scrolled {
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: saturate(180%) blur(18px);
		-webkit-backdrop-filter: saturate(180%) blur(18px);
		border-bottom-color: var(--ap-line);
		padding: 14px 32px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: inherit;
	}
	.brand-mark {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		background:
			radial-gradient(circle at 30% 30%, #fff 0%, #fff 30%, transparent 31%) 0 0/100% 100% no-repeat,
			conic-gradient(from 220deg, #1c1c1c, #3a3a3a, #1c1c1c);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.4) inset, 0 1px 2px rgba(0, 0, 0, 0.15);
	}
	.brand-name {
		font-weight: 700;
		font-size: 17px;
		letter-spacing: -0.02em;
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	/* ─── buttons ─────────────────────────────────────────── */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 11px 22px;
		border-radius: 999px;
		font-family: inherit;
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
		border: 1px solid transparent;
		transition: transform 0.25s ease, background 0.25s ease,
		            border-color 0.25s ease, color 0.25s ease,
		            box-shadow 0.25s ease;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-ghost {
		color: var(--ap-text);
		background: transparent;
		border-color: var(--ap-line-2);
	}
	.btn-ghost:hover {
		background: rgba(0, 0, 0, 0.04);
	}
	.btn-light-outline {
		color: var(--ap-text);
		background: #fff;
		border-color: var(--ap-line-2);
	}
	.btn-light-outline:hover {
		border-color: var(--ap-text);
		transform: translateY(-1px);
	}
	.btn-dark {
		color: #fff;
		background: var(--ap-accent);
		border-color: var(--ap-accent);
	}
	.btn-dark:hover {
		background: #2a2a2a;
		border-color: #2a2a2a;
		transform: translateY(-1px);
		box-shadow: 0 8px 24px rgba(15, 15, 16, 0.18);
	}
	.btn-lg {
		padding: 16px 32px;
		font-size: 15px;
	}

	/* ─── hero ────────────────────────────────────────────── */
	.hero {
		position: relative;
		padding: clamp(110px, 14vh, 160px) 24px 60px;
		text-align: center;
		overflow: hidden;
		background:
			radial-gradient(ellipse 70% 50% at 50% 0%, rgba(15, 15, 16, 0.04) 0%, transparent 70%),
			#fff;
	}

	.hero-inner {
		max-width: 880px;
		margin: 0 auto;
	}

	/* App icon block + brand name (above title) */
	.hero-app {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin-bottom: 36px;
	}
	.hero-icon {
		width: 76px;
		height: 76px;
		border-radius: 18px;
		background: linear-gradient(180deg, #1f1f22 0%, #0a0a0c 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.08) inset,
			0 0 0 1px rgba(0, 0, 0, 0.5),
			0 18px 40px -12px rgba(15, 15, 16, 0.45),
			0 6px 14px -6px rgba(15, 15, 16, 0.3);
		transform-origin: center;
		animation: hero-icon-pop 1100ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
		will-change: transform, opacity;
	}
	.hero-app-name {
		font-weight: 700;
		font-size: 16px;
		letter-spacing: -0.01em;
		color: var(--ap-text);
		margin: 0;
		opacity: 0;
		animation: hero-fade-up 700ms cubic-bezier(0.16, 1, 0.3, 1) 380ms both;
	}

	@keyframes hero-icon-pop {
		0%   { opacity: 0; transform: scale(0.4) rotate(-14deg) translateY(8px); }
		55%  { opacity: 1; transform: scale(1.08) rotate(3deg) translateY(0); }
		78%  { transform: scale(0.97) rotate(-1deg); }
		100% { opacity: 1; transform: scale(1) rotate(0deg); }
	}
	@keyframes hero-fade-up {
		from { opacity: 0; transform: translateY(14px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.hero-title {
		font-family: 'Satoshi', sans-serif;
		font-weight: 900;
		font-size: clamp(44px, 7.4vw, 92px);
		line-height: 0.98;
		letter-spacing: -0.04em;
		margin: 0 0 22px;
		color: var(--ap-text);
		opacity: 0;
		animation: hero-fade-up 800ms cubic-bezier(0.16, 1, 0.3, 1) 520ms both;
	}
	.hero-sub {
		font-size: clamp(17px, 1.6vw, 21px);
		line-height: 1.5;
		color: var(--ap-text-2);
		margin: 0 auto 36px;
		max-width: 620px;
		font-weight: 400;
		opacity: 0;
		animation: hero-fade-up 800ms cubic-bezier(0.16, 1, 0.3, 1) 660ms both;
	}
	.hero-ctas {
		display: inline-flex;
		gap: 12px;
		flex-wrap: wrap;
		justify-content: center;
		opacity: 0;
		animation: hero-fade-up 800ms cubic-bezier(0.16, 1, 0.3, 1) 800ms both;
	}
	.btn-cta {
		padding: 14px 26px;
		font-size: 15px;
	}
	.btn-cta svg {
		transition: transform 0.25s ease;
	}
	.btn-cta:hover svg {
		transform: translateX(3px);
	}

	/* ─── phone marquee ───────────────────────────────────── */
	.phone-stage {
		margin-top: 80px;
		padding: 20px 0;
		mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
		-webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
	}
	.phone-track {
		display: flex;
		gap: 28px;
		width: max-content;
		animation: phone-scroll 38s linear infinite;
		padding: 0 14px;
	}
	@keyframes phone-scroll {
		0%   { transform: translateX(0); }
		100% { transform: translateX(-50%); }
	}
	.phone-stage:hover .phone-track { animation-play-state: paused; }

	.phone {
		flex: 0 0 auto;
		transform: translateY(calc(sin(var(--i) * 1.1) * 12px));
		transition: transform 0.4s ease;
	}
	.phone:nth-child(odd)  { transform: translateY(8px); }
	.phone:nth-child(even) { transform: translateY(-8px); }
	.phone:hover { transform: translateY(-14px) scale(1.02); }

	.phone-frame {
		position: relative;
		width: 220px;
		height: 460px;
		background: #0f0f10;
		border-radius: 38px;
		padding: 10px;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.18) inset,
			0 0 0 1px rgba(0, 0, 0, 0.2),
			0 30px 60px -20px rgba(15, 15, 16, 0.35),
			0 12px 24px -10px rgba(15, 15, 16, 0.25);
	}
	.phone-notch {
		position: absolute;
		top: 18px; left: 50%;
		width: 70px; height: 18px;
		background: #0f0f10;
		border-radius: 12px;
		transform: translateX(-50%);
		z-index: 2;
	}
	.phone-screen {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 30px;
		overflow: hidden;
		background: var(--tint);
	}
	.phone-screen img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		mix-blend-mode: luminosity;
		opacity: 0.92;
	}
	.phone-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 18px;
		background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.35) 100%);
	}
	.phone-pill {
		align-self: flex-start;
		padding: 6px 12px;
		background: rgba(255, 255, 255, 0.92);
		color: #111;
		border-radius: 999px;
		font-weight: 700;
		font-size: 11px;
		letter-spacing: 0.02em;
		backdrop-filter: blur(8px);
	}
	.phone-bar {
		position: absolute;
		bottom: 6px; left: 50%;
		width: 110px; height: 4px;
		background: rgba(255, 255, 255, 0.55);
		border-radius: 2px;
		transform: translateX(-50%);
	}

	/* ─── featured ────────────────────────────────────────── */
	.featured {
		padding: 100px 24px 40px;
	}
	.featured-h {
		font-weight: 800;
		font-size: clamp(28px, 3vw, 36px);
		letter-spacing: -0.025em;
		margin: 0 0 28px;
	}
	.featured-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 18px;
	}
	.feat-card {
		position: relative;
		display: block;
		aspect-ratio: 1 / 1;
		border-radius: 22px;
		overflow: hidden;
		text-decoration: none;
		color: #fff;
		isolation: isolate;
		transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
		            box-shadow 0.45s ease;
	}
	.feat-card:hover {
		transform: translateY(-6px);
		box-shadow: 0 24px 50px -20px rgba(15, 15, 16, 0.35);
	}
	.feat-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		mix-blend-mode: overlay;
		opacity: 0.85;
		z-index: -1;
	}
	.feat-card::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 35%, rgba(0, 0, 0, 0.55) 100%);
		pointer-events: none;
	}
	.feat-badge {
		position: absolute;
		top: 16px;
		left: 16px;
		padding: 5px 12px;
		border-radius: 6px;
		background: rgba(15, 15, 16, 0.78);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.02em;
		backdrop-filter: blur(8px);
		z-index: 2;
	}
	.feat-info {
		position: absolute;
		left: 22px;
		right: 22px;
		bottom: 18px;
		z-index: 2;
	}
	.feat-title {
		font-weight: 800;
		font-size: 22px;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
		color: #fff;
		text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
	}
	.feat-by {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.85);
		margin: 0;
	}
	.feat-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.92);
		color: #0f0f10;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.02em;
	}
	.feat-creator { font-weight: 600; }

	/* ─── how it works (floating cards) ───────────────────── */
	.how {
		padding: 100px 24px 110px;
		background: var(--ap-bg);
	}
	.how-title {
		font-weight: 900;
		font-size: clamp(40px, 5.4vw, 72px);
		line-height: 1;
		letter-spacing: -0.035em;
		text-align: center;
		margin: 0 0 80px;
	}
	.how-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 40px;
	}
	.how-col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.how-col .float-card {
		margin-bottom: 28px;
	}

	.float-card {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px 14px 14px;
		background: #fff;
		border-radius: 18px;
		box-shadow:
			0 1px 0 rgba(15, 15, 16, 0.04) inset,
			0 1px 2px rgba(15, 15, 16, 0.05),
			0 22px 44px -16px rgba(15, 15, 16, 0.18),
			0 8px 16px -8px rgba(15, 15, 16, 0.10);
		transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
		            box-shadow 0.4s ease;
	}
	.how-col:hover .float-card {
		transform: translateY(-4px);
	}

	.fc-thumb,
	.fc-platform {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background:
			conic-gradient(from 220deg, #1c1c1c, #3a3a3a, #1c1c1c);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}
	.fc-platform { background: #E8FF48; }

	.fc-text { display: flex; flex-direction: column; gap: 3px; }
	.fc-title {
		font-weight: 800;
		font-size: 15px;
		letter-spacing: -0.01em;
		margin: 0;
		color: var(--ap-text);
	}
	.fc-by {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--ap-text-2);
	}
	.fc-dot {
		width: 14px; height: 14px;
		border-radius: 50%;
		background: linear-gradient(135deg, #E8B4B8, #A6B4C4);
	}
	.fc-handle {
		font-size: 12px;
		color: var(--ap-text-2);
		margin: 0;
	}

	.fc-chips {
		gap: 10px;
		padding: 16px 18px;
	}
	.chip {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}
	.chip-letter {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.how-step-title {
		font-weight: 800;
		font-size: 17px;
		letter-spacing: -0.01em;
		margin: 0 0 10px;
		color: var(--ap-text);
	}
	.how-step-desc {
		font-size: 14px;
		line-height: 1.55;
		color: var(--ap-text-2);
		margin: 0;
		max-width: 280px;
	}

	/* ─── cta strip ───────────────────────────────────────── */
	.cta-strip {
		padding: 60px 24px 100px;
	}
	.cta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 32px;
		padding: 40px 48px;
		background: var(--ap-soft);
		border: 1px solid var(--ap-line);
		border-radius: 28px;
	}
	.cta-h {
		font-weight: 800;
		font-size: clamp(22px, 2.4vw, 30px);
		letter-spacing: -0.02em;
		margin: 0 0 6px;
	}
	.cta-p {
		font-size: 15px;
		color: var(--ap-text-2);
		margin: 0;
	}

	/* ─── footer ──────────────────────────────────────────── */
	.footer {
		background: var(--ap-bg);
		padding: 64px 0 40px;
		border-top: 1px solid var(--ap-line);
	}
	.footer-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 48px;
		padding-bottom: 48px;
	}
	.footer-brand .brand { margin-bottom: 14px; }
	.footer-tag {
		font-size: 14px;
		color: var(--ap-text-2);
		max-width: 280px;
		line-height: 1.55;
		margin: 0;
	}
	.footer-col { display: flex; flex-direction: column; gap: 10px; }
	.footer-h {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ap-text-3);
		margin: 0 0 6px;
	}
	.footer-col a {
		font-size: 14px;
		color: var(--ap-text-2);
		text-decoration: none;
		transition: color 0.2s;
	}
	.footer-col a:hover { color: var(--ap-text); }

	.footer-bottom {
		padding-top: 24px;
		border-top: 1px solid var(--ap-line);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.footer-bottom p {
		font-size: 12px;
		color: var(--ap-text-3);
		margin: 0;
	}
	.footer-fine {
		max-width: 520px;
		text-align: right;
	}

	/* ─── responsive ──────────────────────────────────────── */
	@media (max-width: 880px) {
		.nav { padding: 16px 20px; }
		.nav.scrolled { padding: 12px 20px; }
		.btn-ghost { display: none; }

		.hero { padding-top: 100px; }
		.phone-stage { margin-top: 56px; }
		.phone-frame { width: 180px; height: 380px; border-radius: 32px; }

		.featured { padding: 80px 20px 20px; }
		.featured-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }

		.how { padding: 80px 20px; }
		.how-title { margin-bottom: 56px; }
		.how-row { grid-template-columns: 1fr; gap: 48px; }

		.cta-row { flex-direction: column; text-align: center; padding: 32px 28px; }

		.footer-grid { grid-template-columns: 1fr; gap: 32px; }
		.footer-bottom { flex-direction: column; }
		.footer-fine { text-align: center; }
	}

	@media (prefers-reduced-motion: reduce) {
		.reveal { opacity: 1; transform: none; transition: none; }
		.phone-track { animation: none; }
	}
</style>
