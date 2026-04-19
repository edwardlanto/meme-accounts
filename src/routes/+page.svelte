<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, ChevronRight } from 'lucide-svelte';

	let mounted = $state(false);
	let scrollY = $state(0);

	const words = ['Schedule.', 'Analyze.', 'Discover.', 'Grow.', 'Repeat.'];
	let wordIdx = $state(0);
	let wordVisible = $state(true);

	onMount(() => {
		mounted = true;
		window.addEventListener('scroll', () => scrollY = window.scrollY, { passive: true });

		// Cycle words
		const cycle = setInterval(() => {
			wordVisible = false;
			setTimeout(() => { wordIdx = (wordIdx + 1) % words.length; wordVisible = true; }, 350);
		}, 2200);

		return () => { clearInterval(cycle); };
	});

	const features = [
		{ n: '01', title: 'Viral Discovery', desc: 'Track any creator. Our pipeline scrapes their top posts and AI reverse-engineers exactly what made each one explode.', tag: 'Apify + Claude' },
		{ n: '02', title: 'News to Post', desc: 'Pull breaking news, auto-rewrite into punchy captions, generate editorial images with Vertex AI — in one click.', tag: 'TheNewsAPI + Imagen' },
		{ n: '03', title: 'AI Hook Generator', desc: 'Claude analyzes viral hooks from your niche and generates 10 remixed versions tailored to your brand voice.', tag: 'Claude 3.5 Sonnet' },
		{ n: '04', title: 'Carousel Editor', desc: 'Build multi-slide carousels with a live canvas editor. Export each slide as a 1080×1350 PNG, ready to post.', tag: 'Export-ready' },
	];

	const testimonials = [
		{ name: 'Mia Chen', handle: '@mia.creates', avatar: 'MC', text: 'I went from 200 to 12k followers in 6 weeks. The hook generator alone is worth 10x the price.', niche: 'Finance Creator' },
		{ name: 'Jordan Rivers', handle: '@jordanrivers', avatar: 'JR', text: 'The news-to-post feature is insane. Fresh content every morning in under 2 minutes.', niche: 'Fitness Coach' },
		{ name: 'Priya Sood', handle: '@priyasood.co', avatar: 'PS', text: 'My agency manages 40 accounts. Carousel Studio cut our production time from 3 hours to 20 minutes.', niche: 'Social Media Agency' },
	];

	const marqueeItems = ['Schedule', 'Discover', 'Analyze', 'Create', 'Export', 'Grow', 'Repeat', 'Schedule', 'Discover', 'Analyze', 'Create', 'Export', 'Grow', 'Repeat'];
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,300;1,9..144,700;1,9..144,900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="root" class:mounted>

	<!-- NOISE OVERLAY -->
	<div class="noise"></div>

	<!-- NAV -->
	<nav class="nav">
		<a href="/" class="logo">
			<span class="logo-mark">CS</span>
			<span class="logo-text">Carousel<em>Studio</em></span>
		</a>
		<div class="nav-links">
			<a href="#features">Features</a>
			<a href="#pricing">Pricing</a>
			<a href="#how">How it works</a>
		</div>
		<div class="nav-actions">
			<a href="/login" class="nav-signin">Sign in</a>
			<a href="/signup" class="btn-primary btn-sm">Start free →</a>
		</div>
	</nav>

	<!-- HERO -->
	<section class="hero">
		<div class="hero-inner">
			<div class="hero-left">
				<div class="hero-badge">
					<span class="badge-dot"></span>
					AI-powered · Instagram growth
				</div>

				<h1 class="hero-headline">
					Your content.<br/>
					<span class="word-cycle" class:visible={wordVisible}>
						{words[wordIdx]}
					</span>
					<br/>
					<span class="hero-sub-word">Automated.</span>
				</h1>

				<p class="hero-desc">
					Carousel Studio is the AI toolkit for serious Instagram creators —
					viral post discovery, one-click news posts, and a full carousel editor.
					All in one place.
				</p>

				<div class="hero-ctas">
					<a href="/signup" class="btn-primary">
						Start for free
						<ArrowRight size={16} />
					</a>
					<a href="/login" class="btn-ghost">Already have an account →</a>
				</div>

				<div class="hero-proof">
					<div class="proof-avatars">
						{#each ['MK','SL','JD','AR','TR'] as init}
							<div class="proof-avatar">{init}</div>
						{/each}
					</div>
					<span class="proof-text">Joined by <strong>8,400+</strong> creators</span>
				</div>
			</div>

			<div class="hero-right">
				<!-- Stylised product preview -->
				<div class="product-preview">
					<!-- Card 1: back -->
					<div class="preview-card preview-card--back">
						<div class="pc-header">
							<div class="pc-dot r"></div><div class="pc-dot y"></div><div class="pc-dot g"></div>
							<span class="pc-title">discover.svelte</span>
						</div>
						<div class="pc-body">
							<div class="pc-bar" style="width:70%"></div>
							<div class="pc-bar" style="width:45%"></div>
							<div class="pc-bar" style="width:85%"></div>
							<div class="pc-stat">
								<span class="pc-num">92.1K</span>
								<span class="pc-label">likes</span>
							</div>
						</div>
					</div>

					<!-- Card 2: middle -->
					<div class="preview-card preview-card--mid">
						<div class="pc-hook-label">Hook detected</div>
						<p class="pc-hook-text">"7 habits that changed my life forever. Save this."</p>
						<div class="pc-tags">
							<span class="pc-tag">Listicle</span>
							<span class="pc-tag accent">FOMO</span>
							<span class="pc-tag">Save-bait</span>
						</div>
						<div class="pc-remix-btn">✦ Remix with AI</div>
					</div>

					<!-- Card 3: front (news template preview) -->
					<div class="preview-card preview-card--front">
						<div class="news-card-img"></div>
						<div class="news-card-text">
							<div class="news-source">── Markets ──</div>
							<p class="news-headline">FED CUTS RATES BY <em>50BPS</em> — MARKETS REACT</p>
						</div>
					</div>

					<!-- Floating stat pills -->
					<div class="float-pill float-pill--1">
						<span class="pill-num">+340%</span>
						<span class="pill-label">reach lift</span>
					</div>
					<div class="float-pill float-pill--2">
						<span class="pill-icon">⚡</span>
						<span class="pill-label">Generated in 8s</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- MARQUEE -->
	<div class="marquee-wrap">
		<div class="marquee-track">
			{#each [...marqueeItems, ...marqueeItems] as item, i}
				<span class="marquee-item">
					{item}
					{#if i % 2 === 0}<span class="marquee-dot">✦</span>{/if}
				</span>
			{/each}
		</div>
	</div>

	<!-- FEATURES -->
	<section id="features" class="section">
		<div class="section-inner">
			<div class="section-header">
				<p class="section-eyebrow">The toolkit</p>
				<h2 class="section-title">Everything you need<br/><em>to dominate your niche.</em></h2>
			</div>

			<div class="features-grid">
				{#each features as f}
					<div class="feature-card">
						<div class="feature-num">{f.n}</div>
						<div class="feature-body">
							<div class="feature-top">
								<h3 class="feature-title">{f.title}</h3>
								<span class="feature-tag">{f.tag}</span>
							</div>
							<p class="feature-desc">{f.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- STATS BENTO -->
	<section class="stats-section">
		<div class="section-inner">
			<div class="bento">
				<div class="bento-cell bento-big">
					<p class="bento-label">Posts analyzed by our AI</p>
					<span class="bento-num">2.3M+</span>
					<p class="bento-sub">and counting, every week</p>
				</div>
				<div class="bento-cell">
					<span class="bento-num bento-num--md">94%</span>
					<p class="bento-label">avg engagement lift</p>
				</div>
				<div class="bento-cell">
					<span class="bento-num bento-num--md">12×</span>
					<p class="bento-label">faster than manual creation</p>
				</div>
				<div class="bento-cell bento-wide">
					<p class="bento-quote">"The best investment I made for my content business this year."</p>
					<div class="bento-author">
						<span class="bento-avatar">JR</span>
						<span>Jordan Rivers · @jordanrivers</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS -->
	<section id="how" class="section section--alt">
		<div class="section-inner">
			<div class="section-header">
				<p class="section-eyebrow">The process</p>
				<h2 class="section-title">From zero to viral<br/><em>in three steps.</em></h2>
			</div>

			<div class="steps">
				<div class="steps-line"></div>
				{#each [
					{ n: '01', title: 'Track Competitors', desc: 'Add any Instagram handle. We scrape their top-performing posts automatically and rank them by engagement.' },
					{ n: '02', title: 'AI Deconstruction', desc: 'Claude analyzes each viral post — the hook type, emotional trigger, content structure, and what made it spread.' },
					{ n: '03', title: 'Create & Schedule', desc: 'Open the editor, remix the winning formula for your brand, and export or schedule directly from the app.' },
				] as step}
					<div class="step">
						<div class="step-num">{step.n}</div>
						<h3 class="step-title">{step.title}</h3>
						<p class="step-desc">{step.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- TESTIMONIALS -->
	<section class="section">
		<div class="section-inner">
			<div class="section-header">
				<p class="section-eyebrow">Social proof</p>
				<h2 class="section-title">Creators are<br/><em>already winning.</em></h2>
			</div>
			<div class="testimonials">
				{#each testimonials as t, i}
					<div class="testimonial" style="--delay: {i * 0.1}s">
						<p class="testimonial-text">"{t.text}"</p>
						<div class="testimonial-author">
							<div class="t-avatar">{t.avatar}</div>
							<div>
								<p class="t-name">{t.name}</p>
								<p class="t-meta">{t.niche} · {t.handle}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- PRICING -->
	<section id="pricing" class="section section--alt">
		<div class="section-inner">
			<div class="section-header">
				<p class="section-eyebrow">Pricing</p>
				<h2 class="section-title">Simple,<br/><em>creator-first pricing.</em></h2>
				<p class="section-sub">Start free. Scale when you grow.</p>
			</div>

			<div class="pricing-grid">
				<div class="price-card">
					<p class="price-tier">Free</p>
					<div class="price-amount"><span class="price-num">$0</span><span class="price-period">/mo</span></div>
					<p class="price-note">No card needed. Forever free.</p>
					<ul class="price-features">
						{#each ['5 carousels/month', '3 competitor tracks', 'AI hook suggestions', 'Basic canvas editor'] as item}
							<li><ChevronRight size={12} />{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline">Get started</a>
				</div>

				<div class="price-card price-card--featured">
					<div class="price-badge">Most popular</div>
					<p class="price-tier">Pro</p>
					<div class="price-amount"><span class="price-num">$29</span><span class="price-period">/mo</span></div>
					<p class="price-note">Cancel anytime.</p>
					<ul class="price-features">
						{#each ['Unlimited carousels', '25 competitor tracks', 'Claude 3.5 Sonnet AI', 'News-to-Post (Vertex AI)', 'Full canvas + export', 'Style extraction'] as item}
							<li><ChevronRight size={12} />{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-primary">Start Pro free</a>
				</div>

				<div class="price-card">
					<p class="price-tier">Agency</p>
					<div class="price-amount"><span class="price-num">$99</span><span class="price-period">/mo</span></div>
					<p class="price-note">For teams managing multiple brands.</p>
					<ul class="price-features">
						{#each ['Everything in Pro', 'Unlimited accounts', 'Team workspace', 'White-label export', 'API access'] as item}
							<li><ChevronRight size={12} />{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline">Contact us</a>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section class="cta-section">
		<div class="cta-inner">
			<p class="cta-eyebrow">✦ Ready?</p>
			<h2 class="cta-headline">Stop watching others go viral.<br/><em>Start your free account today.</em></h2>
			<a href="/signup" class="btn-primary btn-lg">
				Get started free — no card needed
				<ArrowRight size={18} />
			</a>
		</div>
	</section>

	<!-- FOOTER -->
	<footer class="footer">
		<div class="footer-inner">
			<a href="/" class="logo">
				<span class="logo-mark">CS</span>
				<span class="logo-text">Carousel<em>Studio</em></span>
			</a>
			<p class="footer-copy">© 2026 Carousel Studio. Built with SvelteKit + Claude AI.</p>
			<div class="footer-links">
				<a href="/privacy">Privacy</a>
				<a href="/terms">Terms</a>
				<a href="/docs">Docs</a>
			</div>
		</div>
	</footer>

</div>

<style>
	/* ── Tokens ─────────────────────────────────────────────────────────── */
	:root {
		--bg: #0A0A0A;
		--surface: #111111;
		--surface-2: #181818;
		--border: rgba(255,255,255,0.07);
		--text: #F0EDE8;
		--text-muted: rgba(240,237,232,0.45);
		--text-dim: rgba(240,237,232,0.22);
		--accent: #E8FF48;
		--accent-dim: rgba(232,255,72,0.12);
		--accent-border: rgba(232,255,72,0.25);
		--font-display: 'Fraunces', Georgia, serif;
		--font-body: 'DM Sans', sans-serif;
		--font-mono: 'Space Mono', monospace;
	}

	/* ── Reset / base ───────────────────────────────────────────────────── */
	.root {
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-body);
		min-height: 100vh;
		position: relative;
		overflow-x: hidden;
	}

	/* Noise texture overlay */
	.noise {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 999;
		opacity: 0.025;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
		background-size: 256px 256px;
	}

	/* Page reveal */
	.root { opacity: 0; transition: opacity 0.6s ease; }
	.root.mounted { opacity: 1; }

	/* ── Nav ────────────────────────────────────────────────────────────── */
	.nav {
		position: fixed;
		top: 0; left: 0; right: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 48px;
		border-bottom: 1px solid var(--border);
		background: rgba(10,10,10,0.85);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
	}
	.logo-mark {
		width: 32px; height: 32px;
		background: var(--accent);
		color: #000;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}
	.logo-text {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.02em;
	}
	.logo-text em { font-style: italic; color: var(--accent); }

	.nav-links {
		display: flex;
		gap: 36px;
	}
	.nav-links a {
		font-size: 14px;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
		font-weight: 400;
	}
	.nav-links a:hover { color: var(--text); }

	.nav-actions { display: flex; align-items: center; gap: 16px; }
	.nav-signin {
		font-size: 14px;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
	}
	.nav-signin:hover { color: var(--text); }

	/* ── Buttons ────────────────────────────────────────────────────────── */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 14px 28px;
		background: var(--accent);
		color: #000;
		border-radius: 12px;
		font-weight: 600;
		font-size: 15px;
		font-family: var(--font-body);
		text-decoration: none;
		transition: all 0.2s;
		border: none;
		cursor: pointer;
	}
	.btn-primary:hover {
		background: #f0ff70;
		transform: translateY(-1px);
		box-shadow: 0 8px 32px rgba(232,255,72,0.3);
	}
	.btn-sm { padding: 10px 20px; font-size: 13px; border-radius: 10px; }
	.btn-lg { padding: 18px 36px; font-size: 17px; border-radius: 14px; }

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
		font-family: var(--font-body);
	}
	.btn-ghost:hover { color: var(--text); }

	.btn-outline {
		display: block;
		text-align: center;
		padding: 12px 24px;
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		font-family: var(--font-body);
		transition: all 0.2s;
	}
	.btn-outline:hover {
		border-color: rgba(255,255,255,0.2);
		color: var(--text);
	}

	/* ── Hero ────────────────────────────────────────────────────────────── */
	.hero {
		min-height: 100vh;
		display: flex;
		align-items: center;
		padding: 120px 48px 80px;
		position: relative;
	}

	/* Gradient orb bg */
	.hero::before {
		content: '';
		position: absolute;
		top: 20%; left: 50%;
		width: 600px; height: 600px;
		transform: translateX(-50%);
		background: radial-gradient(ellipse, rgba(232,255,72,0.06) 0%, transparent 70%);
		pointer-events: none;
	}

	.hero-inner {
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 80px;
		align-items: center;
	}

	.hero-left { display: flex; flex-direction: column; gap: 28px; }

	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border: 1px solid var(--accent-border);
		border-radius: 100px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--accent);
		letter-spacing: 0.08em;
		width: fit-content;
		background: var(--accent-dim);
	}
	.badge-dot {
		width: 6px; height: 6px;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.8); }
	}

	.hero-headline {
		font-family: var(--font-display);
		font-size: clamp(52px, 5.5vw, 80px);
		font-weight: 900;
		line-height: 1.0;
		letter-spacing: -0.03em;
		color: var(--text);
		margin: 0;
	}

	.word-cycle {
		display: inline-block;
		font-style: italic;
		color: var(--accent);
		transition: opacity 0.3s ease, transform 0.3s ease;
		opacity: 0;
		transform: translateY(8px);
	}
	.word-cycle.visible {
		opacity: 1;
		transform: translateY(0);
	}

	.hero-sub-word {
		color: rgba(240,237,232,0.35);
	}

	.hero-desc {
		font-size: 18px;
		line-height: 1.65;
		color: var(--text-muted);
		max-width: 480px;
		margin: 0;
		font-weight: 300;
	}

	.hero-ctas { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }

	.hero-proof {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.proof-avatars { display: flex; }
	.proof-avatar {
		width: 30px; height: 30px;
		border-radius: 50%;
		background: var(--surface-2);
		border: 2px solid var(--bg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--text-dim);
		margin-right: -8px;
	}
	.proof-text {
		font-size: 13px;
		color: var(--text-dim);
		margin-left: 16px;
	}
	.proof-text strong { color: var(--text-muted); }

	/* ── Product preview ─────────────────────────────────────────────────── */
	.hero-right { display: flex; justify-content: center; align-items: center; }

	.product-preview {
		position: relative;
		width: 360px;
		height: 480px;
	}

	.preview-card {
		position: absolute;
		border-radius: 16px;
		border: 1px solid var(--border);
		background: var(--surface);
		overflow: hidden;
	}

	.preview-card--back {
		width: 260px; height: 160px;
		top: 0; right: 0;
		transform: rotate(4deg);
		background: var(--surface-2);
	}
	.preview-card--mid {
		width: 280px; height: 160px;
		top: 80px; left: 0;
		transform: rotate(-2deg);
		padding: 20px;
		z-index: 2;
	}
	.preview-card--front {
		width: 200px; height: 280px;
		bottom: 0; right: 20px;
		z-index: 3;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Back card */
	.pc-header {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
	}
	.pc-dot { width: 8px; height: 8px; border-radius: 50%; }
	.pc-dot.r { background: #ff5f57; }
	.pc-dot.y { background: #ffbd2e; }
	.pc-dot.g { background: #28c840; }
	.pc-title { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); margin-left: 8px; }
	.pc-body { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
	.pc-bar { height: 6px; border-radius: 3px; background: var(--border); }
	.pc-stat { display: flex; align-items: baseline; gap: 4px; margin-top: 4px; }
	.pc-num { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--accent); }
	.pc-label { font-size: 11px; color: var(--text-dim); }

	/* Mid card */
	.pc-hook-label { font-family: var(--font-mono); font-size: 9px; color: var(--accent); letter-spacing: 0.1em; margin-bottom: 8px; }
	.pc-hook-text { font-family: var(--font-display); font-size: 14px; font-weight: 700; font-style: italic; color: var(--text); line-height: 1.3; margin-bottom: 12px; }
	.pc-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
	.pc-tag { font-size: 10px; font-family: var(--font-mono); padding: 3px 8px; border-radius: 100px; border: 1px solid var(--border); color: var(--text-dim); }
	.pc-tag.accent { background: var(--accent-dim); border-color: var(--accent-border); color: var(--accent); }
	.pc-remix-btn { font-size: 11px; font-family: var(--font-mono); color: var(--accent); }

	/* Front card (news template) */
	.news-card-img {
		flex: 1;
		background: linear-gradient(135deg, #1a1a2e 0%, #0c2340 100%);
		position: relative;
	}
	.news-card-img::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%);
	}
	.news-card-text {
		padding: 12px;
		background: #000;
	}
	.news-source {
		font-family: Georgia, serif;
		font-size: 9px;
		font-style: italic;
		color: var(--accent);
		letter-spacing: 2px;
		margin-bottom: 6px;
		text-align: center;
	}
	.news-headline {
		font-family: 'Bebas Neue', Impact, sans-serif;
		font-size: 15px;
		color: #fff;
		line-height: 1.1;
		letter-spacing: 1px;
		margin: 0;
		text-transform: uppercase;
	}
	.news-headline em { color: var(--accent); font-style: normal; }

	/* Floating pills */
	.float-pill {
		position: absolute;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 100px;
		background: var(--surface);
		border: 1px solid var(--border);
		z-index: 10;
	}
	.float-pill--1 { top: 20px; left: 10px; }
	.float-pill--2 { bottom: 50px; left: -10px; }
	.pill-num { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--accent); }
	.pill-label { font-size: 11px; color: var(--text-dim); }
	.pill-icon { font-size: 13px; }

	/* ── Marquee ─────────────────────────────────────────────────────────── */
	.marquee-wrap {
		overflow: hidden;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		padding: 18px 0;
		background: var(--surface);
	}
	.marquee-track {
		display: flex;
		gap: 0;
		width: max-content;
		animation: marquee 25s linear infinite;
	}
	@keyframes marquee {
		0% { transform: translateX(0); }
		100% { transform: translateX(-50%); }
	}
	.marquee-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 0 32px;
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 700;
		font-style: italic;
		color: var(--text-dim);
		white-space: nowrap;
	}
	.marquee-dot { color: var(--accent); font-style: normal; font-size: 14px; }

	/* ── Sections ─────────────────────────────────────────────────────────── */
	.section { padding: 120px 48px; }
	.section--alt { background: var(--surface); }

	.section-inner { max-width: 1100px; margin: 0 auto; }

	.section-header { margin-bottom: 64px; }
	.section-eyebrow {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 16px;
	}
	.section-title {
		font-family: var(--font-display);
		font-size: clamp(36px, 4vw, 56px);
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: -0.03em;
		color: var(--text);
		margin: 0 0 16px;
	}
	.section-title em { font-style: italic; color: rgba(240,237,232,0.45); }
	.section-sub { font-size: 16px; color: var(--text-muted); }

	/* ── Features grid ───────────────────────────────────────────────────── */
	.features-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
		border: 2px solid var(--border);
		border-radius: 20px;
		overflow: hidden;
	}

	.feature-card {
		padding: 40px;
		background: var(--bg);
		display: flex;
		gap: 28px;
		align-items: flex-start;
		border: 1px solid var(--border);
		transition: background 0.2s;
	}
	.feature-card:hover { background: var(--surface); }

	.feature-num {
		font-family: var(--font-display);
		font-size: 48px;
		font-weight: 900;
		font-style: italic;
		color: var(--accent-dim);
		line-height: 1;
		min-width: 60px;
		transition: color 0.2s;
	}
	.feature-card:hover .feature-num { color: var(--accent); }

	.feature-body { flex: 1; }
	.feature-top { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
	.feature-title { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--text); }
	.feature-tag {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 3px 10px;
		border-radius: 100px;
		border: 1px solid var(--border);
		color: var(--text-dim);
		letter-spacing: 0.05em;
	}
	.feature-desc { font-size: 14px; line-height: 1.65; color: var(--text-muted); margin: 0; }

	/* ── Bento ───────────────────────────────────────────────────────────── */
	.stats-section { padding: 80px 48px; }

	.bento {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		grid-template-rows: auto auto;
		gap: 16px;
	}

	.bento-cell {
		padding: 40px;
		border-radius: 20px;
		border: 1px solid var(--border);
		background: var(--bg);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 8px;
	}

	.bento-big { grid-row: span 1; background: var(--surface-2); }
	.bento-wide { grid-column: span 2; }

	.bento-num {
		font-family: var(--font-display);
		font-size: 72px;
		font-weight: 900;
		color: var(--accent);
		line-height: 1;
		display: block;
	}
	.bento-num--md { font-size: 56px; }
	.bento-label { font-size: 14px; color: var(--text-muted); margin: 0; }
	.bento-sub { font-size: 12px; color: var(--text-dim); font-family: var(--font-mono); }

	.bento-quote {
		font-family: var(--font-display);
		font-size: 22px;
		font-style: italic;
		font-weight: 700;
		color: var(--text);
		line-height: 1.4;
		margin: 0 0 20px;
	}
	.bento-author { display: flex; align-items: center; gap: 12px; }
	.bento-avatar {
		width: 36px; height: 36px;
		border-radius: 50%;
		background: var(--surface-2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
		flex-shrink: 0;
	}
	.bento-author span:last-child { font-size: 13px; color: var(--text-dim); }

	/* ── Steps ───────────────────────────────────────────────────────────── */
	.steps {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 40px;
		position: relative;
	}
	.steps-line {
		position: absolute;
		top: 28px;
		left: 15%;
		right: 15%;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--border) 20%, var(--accent-border) 50%, var(--border) 80%, transparent);
	}

	.step { display: flex; flex-direction: column; gap: 16px; }
	.step-num {
		font-family: var(--font-display);
		font-size: 48px;
		font-weight: 900;
		font-style: italic;
		color: var(--accent);
		line-height: 1;
	}
	.step-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--text); }
	.step-desc { font-size: 14px; line-height: 1.65; color: var(--text-muted); margin: 0; }

	/* ── Testimonials ────────────────────────────────────────────────────── */
	.testimonials {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
	}

	.testimonial {
		padding: 36px;
		border-radius: 20px;
		border: 1px solid var(--border);
		background: var(--bg);
		display: flex;
		flex-direction: column;
		gap: 24px;
		transition: border-color 0.2s, transform 0.2s;
	}
	.testimonial:hover { border-color: var(--accent-border); transform: translateY(-4px); }

	.testimonial-text { font-size: 15px; line-height: 1.65; color: var(--text-muted); flex: 1; margin: 0; font-style: italic; }

	.testimonial-author { display: flex; align-items: center; gap: 12px; }
	.t-avatar {
		width: 38px; height: 38px;
		border-radius: 50%;
		background: var(--surface-2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--accent);
		flex-shrink: 0;
		border: 1px solid var(--accent-border);
	}
	.t-name { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text); }
	.t-meta { font-size: 12px; color: var(--text-dim); font-family: var(--font-mono); }

	/* ── Pricing ─────────────────────────────────────────────────────────── */
	.pricing-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
		align-items: start;
	}

	.price-card {
		padding: 36px;
		border-radius: 20px;
		border: 1px solid var(--border);
		background: var(--bg);
		display: flex;
		flex-direction: column;
		gap: 24px;
		position: relative;
	}

	.price-card--featured {
		border-color: var(--accent-border);
		background: linear-gradient(135deg, rgba(232,255,72,0.04) 0%, var(--bg) 100%);
		box-shadow: 0 0 60px rgba(232,255,72,0.08);
	}

	.price-badge {
		position: absolute;
		top: -12px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--accent);
		color: #000;
		font-size: 10px;
		font-family: var(--font-mono);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 4px 14px;
		border-radius: 100px;
		white-space: nowrap;
	}

	.price-tier { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); }
	.price-card--featured .price-tier { color: var(--accent); }

	.price-amount { display: flex; align-items: baseline; gap: 4px; }
	.price-num { font-family: var(--font-display); font-size: 52px; font-weight: 900; color: var(--text); }
	.price-period { font-size: 16px; color: var(--text-dim); }

	.price-note { font-size: 12px; color: var(--text-dim); margin: 0; }

	.price-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; flex: 1; }
	.price-features li { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); }
	.price-card--featured .price-features li { color: rgba(240,237,232,0.7); }

	/* ── CTA ─────────────────────────────────────────────────────────────── */
	.cta-section {
		padding: 120px 48px;
		border-top: 1px solid var(--border);
		position: relative;
		overflow: hidden;
	}
	.cta-section::before {
		content: '';
		position: absolute;
		bottom: -100px; left: 50%;
		transform: translateX(-50%);
		width: 800px; height: 400px;
		background: radial-gradient(ellipse, rgba(232,255,72,0.08) 0%, transparent 70%);
		pointer-events: none;
	}

	.cta-inner {
		max-width: 700px;
		margin: 0 auto;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 32px;
		position: relative;
	}

	.cta-eyebrow { font-family: var(--font-mono); font-size: 13px; color: var(--accent); letter-spacing: 0.1em; }

	.cta-headline {
		font-family: var(--font-display);
		font-size: clamp(36px, 4.5vw, 60px);
		font-weight: 900;
		letter-spacing: -0.03em;
		line-height: 1.05;
		color: var(--text);
		margin: 0;
	}
	.cta-headline em { font-style: italic; color: var(--accent); }

	/* ── Footer ──────────────────────────────────────────────────────────── */
	.footer { border-top: 1px solid var(--border); padding: 32px 48px; }
	.footer-inner {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
	}
	.footer-copy { font-size: 12px; color: var(--text-dim); font-family: var(--font-mono); }
	.footer-links { display: flex; gap: 24px; }
	.footer-links a { font-size: 13px; color: var(--text-dim); text-decoration: none; transition: color 0.2s; }
	.footer-links a:hover { color: var(--text-muted); }
</style>
