<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Check, Zap, TrendingUp, Globe, Sparkles } from 'lucide-svelte';

	let mounted = $state(false);
	let scrollY = $state(0);
	let fanAngle = $state(0);
	let carouselOffset = $state(0);

	const words = ['Schedule.', 'Analyze.', 'Discover.', 'Grow.', 'Repeat.'];
	let wordIdx = $state(0);
	let wordVisible = $state(true);

	const galleryCards = [
		{ img: '/placeholders/placeholder-square.jpeg',    label: 'Brand Identity',    num: '01' },
		{ img: '/placeholders/placeholder-vertical.jpeg',  label: 'News Template',     num: '02' },
		{ img: '/placeholders/placeholder-horizontal.jpeg',label: 'Tweet Carousel',    num: '03' },
		{ img: '/placeholders/placeholder-square.jpeg',    label: 'Text Carousel',     num: '04' },
		{ img: '/placeholders/placeholder-vertical.jpeg',  label: 'Article Breakdown', num: '05' },
		{ img: '/placeholders/placeholder-horizontal.jpeg',label: 'Slideshows',        num: '06' },
		{ img: '/placeholders/placeholder-square.jpeg',    label: 'Image Quote',       num: '07' },
	];

	const platforms = [
		{ name: 'Instagram',   color: '#E1306C', icon: 'instagram' },
		{ name: 'TikTok',      color: '#010101', icon: 'tiktok'    },
		{ name: 'Facebook',    color: '#1877F2', icon: 'facebook'  },
		{ name: 'LinkedIn',    color: '#0A66C2', icon: 'linkedin'  },
		{ name: 'X / Twitter', color: '#000000', icon: 'x'         },
		{ name: 'YouTube',     color: '#FF0000', icon: 'youtube'   },
	];

	const features = [
		{ n: '01', title: 'Viral Discovery',    desc: 'Track any creator. AI reverse-engineers exactly what made each post explode.',  tag: 'Apify + Claude'      },
		{ n: '02', title: 'News to Post',        desc: 'Pull breaking news, rewrite into punchy captions, generate images — one click.', tag: 'TheNewsAPI + Imagen' },
		{ n: '03', title: 'AI Hook Generator',   desc: 'Claude analyzes viral hooks from your niche and generates 10 remixed versions.', tag: 'Claude 3.5 Sonnet'   },
		{ n: '04', title: 'Carousel Editor',     desc: 'Build multi-slide carousels with a live canvas editor. Export 1080×1350 PNGs.',  tag: 'Export-ready'        },
	];

	const testimonials = [
		{ name: 'Mia Chen',      handle: '@mia.creates',  initials: 'MC', text: 'I went from 200 to 12k followers in 6 weeks. The hook generator alone is worth 10× the price.', niche: 'Finance Creator',     color: '#8B5CF6' },
		{ name: 'Jordan Rivers', handle: '@jordanrivers', initials: 'JR', text: 'The news-to-post feature is insane. Fresh content every morning in under 2 minutes.',            niche: 'Fitness Coach',       color: '#06B6D4' },
		{ name: 'Priya Sood',    handle: '@priyasood.co', initials: 'PS', text: 'My agency manages 40 accounts. Cut our production time from 3 hours to 20 minutes.',             niche: 'Social Media Agency', color: '#E8FF48' },
	];

	const marqueeItems = ['Schedule', 'Discover', 'Analyze', 'Create', 'Export', 'Grow', 'Repeat'];

	const steps = [
		{ n: '01', title: 'Track Competitors', desc: 'Add any Instagram handle. We scrape their top-performing posts and rank by engagement.' },
		{ n: '02', title: 'AI Deconstruction', desc: 'Claude analyzes each viral post — hook type, emotional trigger, content structure.' },
		{ n: '03', title: 'Create & Schedule', desc: 'Remix the winning formula for your brand and export or schedule directly from the app.' },
	];

	// Hero rainbow arc — all cards share one pivot; rotate: 2D Z rotation
	const hwFanPositions = [
		{ rotate: -54, scale: 0.76, zIndex: 4 },
		{ rotate: -36, scale: 0.86, zIndex: 5 },
		{ rotate: -18, scale: 0.94, zIndex: 6 },
		{ rotate:   0, scale: 1.00, zIndex: 7 },
		{ rotate:  18, scale: 0.94, zIndex: 6 },
		{ rotate:  36, scale: 0.86, zIndex: 5 },
		{ rotate:  54, scale: 0.76, zIndex: 4 },
	];

	onMount(() => {
		mounted = true;
		window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

		const cycle = setInterval(() => {
			wordVisible = false;
			setTimeout(() => { wordIdx = (wordIdx + 1) % words.length; wordVisible = true; }, 350);
		}, 2400);

		// Scroll-reveal — only on .reveal elements, not section wrappers
		const io = new IntersectionObserver((entries) => {
			entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
		}, { threshold: 0.06, rootMargin: '0px 0px -20px 0px' });
		const revealEls = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
		revealEls.forEach((el) => io.observe(el));
		// Ensure above-the-fold hero content is visible immediately even if
		// IntersectionObserver callbacks are delayed (Safari/WebKit can be flaky on first paint).
		requestAnimationFrame(() => {
			for (const el of revealEls) {
				const r = el.getBoundingClientRect();
				if (r.top < window.innerHeight * 0.92 && r.bottom > 0) el.classList.add('visible');
			}
		});

		// Cinematic float + sweep
		let t = 0;
		let raf: number;
		function animateFan() {
			t += 0.003;
			fanAngle = Math.sin(t) * 5;
			carouselOffset = Math.sin(t * 2.0) * 8;
			raf = requestAnimationFrame(animateFan);
		}
		raf = requestAnimationFrame(animateFan);

		return () => { clearInterval(cycle); cancelAnimationFrame(raf); io.disconnect(); };
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,700;1,9..144,900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="root" class:mounted>
	<div class="noise"></div>

	<!-- NAV -->
	<nav class="nav" class:scrolled={scrollY > 40}>
		<a href="/" class="logo">
			<span class="logo-mark">CS</span>
			<span class="logo-text">Carousel<em>Studio</em></span>
		</a>
		<div class="nav-links">
			<a href="#features">Features</a>
			<a href="#how">How it works</a>
			<a href="#pricing">Pricing</a>
		</div>
		<div class="nav-actions">
			<a href="/login" class="nav-signin">Sign in</a>
			<a href="/signup" class="btn-cta-nav">Start free →</a>
		</div>
	</nav>

	<!-- ═══════════════════════════════════════════════════════
	     ACT 1 — HERO  (Rocket.com-style)
	═══════════════════════════════════════════════════════ -->
	<section class="hero-white">
		<div class="hero-wrap">
			<div class="hero-grid">
				<div class="hero-left">
					<div class="hero-kicker reveal visible">
						<span class="hero-kicker-dot"></span>
						Brand-consistent carousels in minutes
					</div>

					<h1 class="hero-title reveal visible">
						Create <span class="hero-title-em">branded</span> Instagram carousels that look like a design team made them.
					</h1>

					<p class="hero-sub reveal visible">
						Upload a style reference, type a topic, and generate a visually consistent slideshow—ready to post.
					</p>

					<div class="hero-actions reveal visible">
						<a href="/signup" class="hero-primary">
							Get started free
							<ArrowRight size={16} />
						</a>
						<a href="/dashboard" class="hero-secondary">Explore the app</a>
					</div>

					<div class="hero-form reveal visible" aria-label="Build your guide (demo)">
						<p class="hero-form-title">Build your custom guide</p>
						<div class="hero-form-row">
							<span class="hero-form-label">I’m</span>
							<select class="hero-select" aria-label="Persona">
								<option>creating content</option>
								<option>running an agency</option>
								<option>building a brand</option>
							</select>
							<span class="hero-form-label">and I need help with</span>
							<select class="hero-select" aria-label="Goal">
								<option>designing carousels</option>
								<option>writing hooks</option>
								<option>publishing & scheduling</option>
							</select>
						</div>
						<div class="hero-form-actions">
							<button type="button" class="hero-form-btn">
								Review my guide
							</button>
							<a href="#features" class="hero-form-link">Not ready? Browse features</a>
						</div>
					</div>
				</div>

				<div class="hero-right reveal visible" aria-label="Preview (placeholders)">
					<div class="hero-preview">
						<div class="hero-preview-top">
							<div class="hero-preview-pill">Instagram Preview</div>
							<div class="hero-preview-meta">1080×1350 · Placeholder</div>
						</div>
						<div class="hero-preview-canvas">
							<div class="hero-preview-stack" style="transform: translateY({fanAngle * 0.8}px)">
								{#each galleryCards.slice(0, 3) as card, i (card.num)}
									<div class="hero-preview-card" style="--i:{i}">
										<img src={card.img} alt={card.label} />
									</div>
								{/each}
							</div>
							<div class="hero-preview-shadow"></div>
						</div>
						<div class="hero-preview-bottom">
							<div class="hero-stat">
								<span class="hero-stat-num">10 mins</span>
								<span class="hero-stat-label">to first draft</span>
							</div>
							<div class="hero-stat">
								<span class="hero-stat-num">3 presets</span>
								<span class="hero-stat-label">image sizes</span>
							</div>
							<div class="hero-stat">
								<span class="hero-stat-num">Drag</span>
								<span class="hero-stat-label">reorder slides</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- MARQUEE — chapter break -->
	<div class="marquee-wrap">
		<div class="marquee-track">
			{#each [...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems] as item, i}
				<span class="marquee-item">
					{item}
					{#if i % 2 === 0}<span class="marquee-dot">✦</span>{/if}
				</span>
			{/each}
		</div>
	</div>

	<!-- ═══════════════════════════════════════════════════════
	     ACT 2 — DARK  (Krea.ai: glassmorphism, bento, depth)
	═══════════════════════════════════════════════════════ -->

	<!-- PLATFORMS -->
	<section class="section-dark platforms-section">
		<div class="container">
			<div class="section-header center reveal">
				<span class="eyebrow-mono">Supported Platforms</span>
				<h2 class="title-dark">One workflow.<br/><em>Every platform.</em></h2>
				<p class="body-muted">Schedule, publish, and analyze across all major social networks from one dashboard.</p>
			</div>
			<div class="platforms-grid">
				{#each platforms as p, i}
					<div class="platform-card reveal" style="--accent: {p.color}; --delay:{i * 0.07}s">
						<div class="platform-icon-wrap">
							{#if p.icon === 'instagram'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="none">
									<rect width="24" height="24" rx="6" fill="url(#ig-g)"/>
									<defs><linearGradient id="ig-g" x1="0" y1="24" x2="24" y2="0">
										<stop stop-color="#f09433"/><stop offset=".25" stop-color="#e6683c"/>
										<stop offset=".5" stop-color="#dc2743"/><stop offset=".75" stop-color="#cc2366"/>
										<stop offset="1" stop-color="#bc1888"/>
									</linearGradient></defs>
									<circle cx="12" cy="12" r="4.5" stroke="white" stroke-width="1.5" fill="none"/>
									<circle cx="17" cy="7" r="1" fill="white"/>
									<rect x="3" y="3" width="18" height="18" rx="5" stroke="white" stroke-width="1.5" fill="none"/>
								</svg>
							{:else if p.icon === 'tiktok'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="white">
									<path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.73a4.85 4.85 0 01-1-.04z"/>
								</svg>
							{:else if p.icon === 'facebook'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="#1877F2">
									<path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
								</svg>
							{:else if p.icon === 'linkedin'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="#0A66C2">
									<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
								</svg>
							{:else if p.icon === 'x'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="white">
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
								</svg>
							{:else if p.icon === 'youtube'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="#FF0000">
									<path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
								</svg>
							{/if}
						</div>
						<span class="platform-name">{p.name}</span>
						<div class="platform-check"><Check size={10}/></div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FEATURES BENTO -->
	<section id="features" class="section-dark section-pad">
		<div class="container">
			<div class="section-header reveal">
				<span class="eyebrow-lime">The Toolkit</span>
				<h2 class="title-dark">Everything you need<br/><em>to dominate your niche.</em></h2>
			</div>
			<div class="bento-features">
				{#each features as f, i}
					<div class="bento-feat reveal" style="--delay:{i * 0.1}s">
						<div class="bf-accent"></div>
						<div class="bf-num">{f.n}</div>
						<div class="bf-body">
							<div class="bf-top">
								<h3 class="bf-title">{f.title}</h3>
								<span class="bf-tag">{f.tag}</span>
							</div>
							<p class="bf-desc">{f.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- STATS BENTO -->
	<section class="section-surface section-pad">
		<div class="container">
			<div class="stats-bento">
				<div class="stat-cell stat-big reveal">
					<p class="stat-eyebrow">Posts analyzed by AI</p>
					<span class="stat-num">2.3M+</span>
					<p class="stat-sub">and counting, every week</p>
				</div>
				<div class="stat-cell reveal" style="--delay:0.08s">
					<span class="stat-num stat-md">94%</span>
					<p class="stat-label">avg engagement lift</p>
				</div>
				<div class="stat-cell reveal" style="--delay:0.16s">
					<span class="stat-num stat-md">12×</span>
					<p class="stat-label">faster than manual creation</p>
				</div>
				<div class="stat-cell stat-quote-cell reveal" style="--delay:0.1s">
					<div class="stat-stars">★★★★★</div>
					<p class="stat-quote">"The best investment I made for my content business this year."</p>
					<div class="stat-author">
						<div class="stat-avatar">JR</div>
						<div>
							<p class="stat-name">Jordan Rivers</p>
							<p class="stat-handle">@jordanrivers · Fitness Coach</p>
						</div>
					</div>
				</div>
				<div class="stat-cell stat-platforms-cell reveal" style="--delay:0.18s">
					<p class="stat-label" style="margin-bottom:14px">Platforms supported</p>
					<div class="stat-platform-pills">
						{#each ['IG', 'TK', 'FB', 'LI', 'YT', 'X'] as p}
							<span class="stat-pill">{p}</span>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS -->
	<section id="how" class="section-dark section-pad">
		<div class="container">
			<div class="section-header center reveal">
				<span class="eyebrow-mono">The Process</span>
				<h2 class="title-dark">From zero to viral<br/><em>in three steps.</em></h2>
			</div>
			<div class="steps-row">
				{#each steps as step, i}
					<div class="step-card reveal" style="--delay:{i * 0.12}s">
						<div class="step-num-wrap">
							<span class="step-num">{step.n}</span>
						</div>
						{#if i < steps.length - 1}
							<div class="step-arrow">→</div>
						{/if}
						<h3 class="step-title">{step.title}</h3>
						<p class="step-desc">{step.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- TESTIMONIALS -->
	<section class="section-surface section-pad">
		<div class="container">
			<div class="section-header center reveal">
				<span class="eyebrow-lime">Social Proof</span>
				<h2 class="title-dark">Creators are<br/><em>already winning.</em></h2>
			</div>
			<div class="testimonials-grid">
				{#each testimonials as t, i}
					<div class="t-card reveal" style="--color:{t.color}; --delay:{i * 0.1}s">
						<div class="t-quote-glyph">"</div>
						<p class="t-text">{t.text}</p>
						<div class="t-author">
							<div class="t-avatar" style="background:{t.color}22; border-color:{t.color}55; color:{t.color}">{t.initials}</div>
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
	<section id="pricing" class="section-dark section-pad">
		<div class="container">
			<div class="section-header center reveal">
				<span class="eyebrow-mono">Pricing</span>
				<h2 class="title-dark">Simple,<br/><em>creator-first pricing.</em></h2>
				<p class="body-muted">Start free. Scale when you grow.</p>
			</div>
			<div class="pricing-grid">
				<div class="price-card reveal">
					<div class="price-tier">Free</div>
					<div class="price-amount">
						<span class="price-num">$0</span>
						<span class="price-per">/mo</span>
					</div>
					<p class="price-note">No card needed. Forever free.</p>
					<ul class="price-list">
						{#each ['5 carousels/month', '3 competitor tracks', 'AI hook suggestions', 'Basic canvas editor'] as item}
							<li><span class="price-check">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline-glass">Get started</a>
				</div>

				<div class="price-card price-featured reveal" style="--delay:0.08s">
					<div class="price-badge">Most popular</div>
					<div class="price-tier" style="color:#0a0a0a">Pro</div>
					<div class="price-amount">
						<span class="price-num" style="color:#0a0a0a">$29</span>
						<span class="price-per" style="color:rgba(10,10,10,0.45)">/mo</span>
					</div>
					<p class="price-note" style="color:rgba(10,10,10,0.5)">Cancel anytime.</p>
					<ul class="price-list price-list--dark">
						{#each ['Unlimited carousels', '25 competitor tracks', 'Claude 3.5 Sonnet AI', 'News-to-Post (Vertex AI)', 'Full canvas + export', 'Style extraction'] as item}
							<li><span class="price-check" style="color:#0a0a0a">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-dark-solid">Start Pro free</a>
				</div>

				<div class="price-card reveal" style="--delay:0.16s">
					<div class="price-tier">Agency</div>
					<div class="price-amount">
						<span class="price-num">$99</span>
						<span class="price-per">/mo</span>
					</div>
					<p class="price-note">For teams managing multiple brands.</p>
					<ul class="price-list">
						{#each ['Everything in Pro', 'Unlimited accounts', 'Team workspace', 'White-label export', 'API access'] as item}
							<li><span class="price-check">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline-glass">Contact us</a>
				</div>
			</div>
		</div>
	</section>

	<!-- FINAL CTA -->
	<section class="cta-section">
		<div class="cta-orb"></div>
		<div class="cta-inner reveal">
			<span class="eyebrow-lime">✦ Ready?</span>
			<h2 class="cta-headline">
				Stop watching others go viral.<br/>
				<em>Start your free account today.</em>
			</h2>
			<a href="/signup" class="btn-lime-xl">
				Get started free — no card needed
				<ArrowRight size={20} />
			</a>
			<div class="cta-platforms">
				<span class="cta-label">Works with</span>
				<div class="cta-platform-tags">
					{#each ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'YouTube'] as name}
						<span class="cta-tag">{name}</span>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- FOOTER -->
	<footer class="footer">
		<div class="footer-inner">
			<div class="footer-brand">
				<a href="/" class="logo">
					<span class="logo-mark">CS</span>
					<span class="logo-text" style="color:var(--d-text)">Carousel<em style="color:var(--lime)">Studio</em></span>
				</a>
				<p class="footer-tag">AI-powered content for serious social creators.</p>
			</div>
			<div class="footer-cols">
				<div class="footer-col">
					<p class="footer-col-title">Product</p>
					<a href="#features">Features</a>
					<a href="#pricing">Pricing</a>
					<a href="/dashboard">Dashboard</a>
				</div>
				<div class="footer-col">
					<p class="footer-col-title">Platforms</p>
					<a href="#">Instagram</a>
					<a href="#">TikTok</a>
					<a href="#">LinkedIn</a>
				</div>
				<div class="footer-col">
					<p class="footer-col-title">Legal</p>
					<a href="/privacy">Privacy</a>
					<a href="/terms">Terms</a>
				</div>
			</div>
		</div>
		<div class="footer-bottom">
			<p>© 2026 Carousel Studio. Built with SvelteKit + Claude AI.</p>
			<p>Made with ♥ for creators worldwide.</p>
		</div>
	</footer>
</div>

<style>
/* ════════════════════════════════════════════════════════════
   TOKENS
════════════════════════════════════════════════════════════ */
:root {
	--lime:    #E8FF48;
	--orange:  #FF6B35;
	--dark:    #080808;
	--surface: #0f0f0f;
	--s2:      #1a1a1a;
	--cream:   #F5F0E6;

	--d-text:   #F0EDE8;
	--d-muted:  rgba(240,237,232,0.55);
	--d-dim:    rgba(240,237,232,0.28);
	--d-border: rgba(255,255,255,0.07);

	--l-text:   #0a0505;
	--l-muted:  rgba(10,5,5,0.5);
	--l-dim:    rgba(10,5,5,0.28);

	--font-display: 'Fraunces', Georgia, serif;
	--font-body:    'DM Sans', sans-serif;
	--font-mono:    'Space Mono', monospace;

	--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

/* ════════════════════════════════════════════════════════════
   BASE
════════════════════════════════════════════════════════════ */
.root {
	font-family: var(--font-body);
	overflow-x: hidden;
	/* Don't hide the entire page before hydration. */
	opacity: 1;
}
.root.mounted { opacity: 1; }

.noise {
	position: fixed; inset: 0; pointer-events: none; z-index: 900; opacity: 0.02;
	background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
	background-size: 256px;
}

.container { max-width: 1160px; margin: 0 auto; padding: 0 48px; }

/* ════════════════════════════════════════════════════════════
   SCROLL REVEAL  — only on child elements, never section wrappers
════════════════════════════════════════════════════════════ */
.reveal {
	opacity: 0;
	transform: translateY(24px);
	transition: opacity 0.7s var(--ease-out-expo), transform 0.7s var(--ease-out-expo);
	transition-delay: var(--delay, 0s);
}
.reveal.visible {
	opacity: 1;
	transform: translateY(0);
}

/* ════════════════════════════════════════════════════════════
   NAV
════════════════════════════════════════════════════════════ */
.nav {
	position: fixed; top: 0; left: 0; right: 0; z-index: 200;
	display: flex; align-items: center; justify-content: space-between;
	padding: 20px 48px;
	transition: all 0.3s ease;
}
.nav.scrolled {
	background: rgba(255,255,255,0.88);
	backdrop-filter: blur(24px);
	-webkit-backdrop-filter: blur(24px);
	border-bottom: 1px solid rgba(0,0,0,0.07);
	padding: 14px 48px;
	box-shadow: 0 1px 0 rgba(0,0,0,0.04);
}

.logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.logo-mark {
	width: 32px; height: 32px; background: var(--dark); color: #fff;
	border-radius: 8px; display: flex; align-items: center; justify-content: center;
	font-family: var(--font-mono); font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.logo-text {
	font-family: var(--font-display); font-size: 17px; font-weight: 700;
	color: var(--l-text); letter-spacing: -0.02em;
}
.logo-text em { font-style: italic; color: var(--orange); }

.nav-links { display: flex; gap: 36px; }
.nav-links a {
	font-size: 14px; color: var(--l-muted); text-decoration: none;
	font-weight: 500; transition: color 0.2s;
}
.nav-links a:hover { color: var(--l-text); }

.nav-actions { display: flex; align-items: center; gap: 16px; }
.nav-signin { font-size: 14px; color: var(--l-muted); text-decoration: none; transition: color 0.2s; }
.nav-signin:hover { color: var(--l-text); }
.btn-cta-nav {
	display: inline-flex; align-items: center;
	padding: 9px 22px; background: var(--dark); color: #fff;
	border-radius: 100px; font-size: 13px; font-weight: 600;
	font-family: var(--font-body); text-decoration: none; transition: all 0.2s;
}
.btn-cta-nav:hover { background: #222; transform: translateY(-1px); }

/* ════════════════════════════════════════════════════════════
   ACT 1 — WHITE HERO  (Rocket.com-style)
════════════════════════════════════════════════════════════ */
.hero-white {
	background: #fff;
	padding-top: 70px; /* nav height */
	overflow: visible;
	position: relative;
}

/* Subtle grid texture */
.hero-white::before {
	content: '';
	position: absolute; inset: 0; pointer-events: none; z-index: 0;
	background-image:
		linear-gradient(rgba(0,0,0,0.022) 1px, transparent 1px),
		linear-gradient(90deg, rgba(0,0,0,0.022) 1px, transparent 1px);
	background-size: 40px 40px;
	mask-image: radial-gradient(ellipse 80% 70% at 50% 0%, black 20%, transparent 100%);
}

/* ── Rocket-style hero layout ───────────────────────────── */
.hero-wrap {
	position: relative;
	z-index: 1;
	max-width: 1120px;
	margin: 0 auto;
	padding: 56px 28px 56px;
}
.hero-grid {
	display: grid;
	grid-template-columns: 1.15fr 0.85fr;
	gap: 42px;
	align-items: start;
}

.hero-kicker {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	padding: 6px 12px;
	border-radius: 999px;
	border: 1px solid rgba(10,10,10,0.10);
	background: rgba(255,255,255,0.72);
	font-family: var(--font-mono);
	font-size: 11px;
	letter-spacing: 0.06em;
	color: rgba(10,10,10,0.55);
}
.hero-kicker-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: #22c55e;
	box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
}

.hero-title {
	margin: 16px 0 0;
	font-family: var(--font-display);
	font-weight: 900;
	letter-spacing: -0.04em;
	line-height: 1.02;
	color: #0a0a0a;
	font-size: clamp(44px, 5.4vw, 68px);
}
.hero-title-em {
	font-style: italic;
	text-decoration: underline;
	text-decoration-thickness: 6px;
	text-underline-offset: 6px;
	text-decoration-color: rgba(232,255,72,0.55);
}
.hero-sub {
	margin: 14px 0 0;
	font-family: var(--font-body);
	font-size: 16px;
	line-height: 1.65;
	color: rgba(10,10,10,0.55);
	max-width: 56ch;
}

.hero-actions {
	margin-top: 20px;
	display: flex;
	gap: 12px;
	align-items: center;
	flex-wrap: wrap;
}
.hero-primary {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	padding: 14px 22px;
	border-radius: 999px;
	background: #0a0a0a;
	color: #fff;
	font-family: var(--font-body);
	font-weight: 700;
	text-decoration: none;
	transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}
.hero-primary:hover {
	transform: translateY(-1px);
	background: #161616;
	box-shadow: 0 10px 24px rgba(0,0,0,0.18);
}
.hero-secondary {
	display: inline-flex;
	align-items: center;
	padding: 14px 18px;
	border-radius: 999px;
	border: 1px solid rgba(10,10,10,0.12);
	background: rgba(255,255,255,0.6);
	color: rgba(10,10,10,0.7);
	font-family: var(--font-body);
	font-weight: 600;
	text-decoration: none;
	transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}
.hero-secondary:hover {
	background: rgba(255,255,255,0.9);
	border-color: rgba(10,10,10,0.18);
	color: rgba(10,10,10,0.9);
}

.hero-form {
	margin-top: 22px;
	border-radius: 20px;
	border: 1px solid rgba(10,10,10,0.12);
	background: rgba(255,255,255,0.75);
	box-shadow: 0 10px 30px rgba(10,10,10,0.08);
	padding: 16px;
}
.hero-form-title {
	margin: 0 0 10px;
	font-family: var(--font-body);
	font-weight: 700;
	color: rgba(10,10,10,0.75);
	font-size: 13px;
}
.hero-form-row {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: center;
	color: rgba(10,10,10,0.6);
	font-family: var(--font-body);
	font-size: 13px;
}
.hero-form-label { white-space: nowrap; }
.hero-select {
	appearance: none;
	padding: 10px 12px;
	border-radius: 999px;
	border: 1px solid rgba(10,10,10,0.12);
	background: #fff;
	font-family: var(--font-body);
	font-weight: 600;
	color: rgba(10,10,10,0.75);
}
.hero-form-actions {
	margin-top: 12px;
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: wrap;
}
.hero-form-btn {
	padding: 12px 16px;
	border-radius: 999px;
	border: 0;
	background: #0a0a0a;
	color: #fff;
	font-family: var(--font-body);
	font-weight: 700;
	cursor: pointer;
	transition: transform 0.18s ease, background 0.18s ease;
}
.hero-form-btn:hover { transform: translateY(-1px); background: #161616; }
.hero-form-link {
	font-family: var(--font-body);
	font-size: 13px;
	color: rgba(10,10,10,0.55);
	text-decoration: none;
}
.hero-form-link:hover { color: rgba(10,10,10,0.85); text-decoration: underline; }

.hero-preview {
	border-radius: 26px;
	border: 1px solid rgba(10,10,10,0.10);
	background: #fff;
	box-shadow: 0 18px 60px rgba(10,10,10,0.12);
	overflow: hidden;
}
.hero-preview-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 16px;
	border-bottom: 1px solid rgba(10,10,10,0.06);
	background: rgba(255,255,255,0.8);
}
.hero-preview-pill {
	font-family: var(--font-mono);
	font-size: 10px;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: rgba(10,10,10,0.55);
}
.hero-preview-meta {
	font-family: var(--font-mono);
	font-size: 10px;
	color: rgba(10,10,10,0.35);
}
.hero-preview-canvas {
	position: relative;
	height: 420px;
	background: linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.00));
}
.hero-preview-stack {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}
.hero-preview-card {
	position: absolute;
	width: 240px;
	height: 300px;
	border-radius: 22px;
	overflow: hidden;
	border: 1px solid rgba(10,10,10,0.10);
	box-shadow: 0 18px 50px rgba(10,10,10,0.14);
	transform: translateX(calc((var(--i) - 1) * 86px)) rotate(calc((var(--i) - 1) * 5deg));
	background: #f4f4f4;
}
.hero-preview-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-preview-shadow {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 120px;
	background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1));
	pointer-events: none;
}
.hero-preview-bottom {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 10px;
	padding: 14px 16px 16px;
	border-top: 1px solid rgba(10,10,10,0.06);
}
.hero-stat-num {
	display: block;
	font-family: var(--font-display);
	font-weight: 900;
	letter-spacing: -0.02em;
	color: rgba(10,10,10,0.82);
	font-size: 18px;
}
.hero-stat-label {
	display: block;
	margin-top: 2px;
	font-family: var(--font-body);
	color: rgba(10,10,10,0.45);
	font-size: 12px;
}

@media (max-width: 920px) {
	.hero-grid { grid-template-columns: 1fr; }
	.hero-preview-canvas { height: 360px; }
}

/* ════════════════════════════════════════════════════════════
   MARQUEE — chapter break
════════════════════════════════════════════════════════════ */
.marquee-wrap {
	overflow: hidden; background: var(--dark);
	border-top: 1px solid rgba(255,255,255,0.05);
	border-bottom: 1px solid rgba(255,255,255,0.05);
	padding: 18px 0;
}
.marquee-track {
	display: flex; width: max-content;
	animation: marquee 28s linear infinite;
}
@keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-25%)} }
.marquee-item {
	display: flex; align-items: center; gap: 18px;
	padding: 0 32px;
	font-family: var(--font-display); font-size: 18px;
	font-weight: 700; font-style: italic;
	color: rgba(240,237,232,0.22); white-space: nowrap;
}
.marquee-dot { color: var(--lime); font-style: normal; font-size: 11px; }

/* ════════════════════════════════════════════════════════════
   SHARED DARK UTILITIES
════════════════════════════════════════════════════════════ */
.section-dark    { background: var(--dark); color: var(--d-text); }
.section-surface { background: var(--surface); color: var(--d-text); }
.section-pad     { padding: 100px 48px; }

.section-header { margin-bottom: 60px; }
.section-header.center { text-align: center; }
.section-header.center .body-muted { margin: 0 auto; }

.eyebrow-lime {
	display: inline-block; font-family: var(--font-mono);
	font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
	color: var(--lime); margin-bottom: 14px;
}
.eyebrow-mono {
	display: inline-block; font-family: var(--font-mono);
	font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
	color: var(--d-dim); margin-bottom: 14px;
}
.title-dark {
	font-family: var(--font-display);
	font-size: clamp(36px, 4.2vw, 56px);
	font-weight: 900; line-height: 1.05;
	letter-spacing: -0.03em; color: var(--d-text); margin: 0 0 20px;
}
.title-dark em { font-style: italic; color: var(--d-muted); }
.body-muted { font-size: 16px; line-height: 1.65; color: var(--d-muted); max-width: 480px; }

/* ════════════════════════════════════════════════════════════
   PLATFORMS
════════════════════════════════════════════════════════════ */
.platforms-section { padding: 80px 48px; }
.platforms-grid {
	display: grid; grid-template-columns: repeat(6,1fr); gap: 12px;
}
.platform-card {
	display: flex; flex-direction: column; align-items: center; gap: 10px;
	padding: 28px 16px; border-radius: 18px;
	background: rgba(255,255,255,0.03);
	border: 1px solid rgba(255,255,255,0.07);
	transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
	position: relative; overflow: hidden; cursor: default;
}
.platform-card::after {
	content: ''; position: absolute; inset: 0;
	background: radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%);
	opacity: 0; transition: opacity 0.3s;
}
.platform-card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,0.13); }
.platform-card:hover::after { opacity: 1; }
.platform-icon-wrap { position: relative; z-index: 1; }
.platform-name { font-size: 11px; font-weight: 600; color: var(--d-muted); z-index: 1; }
.platform-check {
	width: 18px; height: 18px; border-radius: 50%;
	background: rgba(34,197,94,0.15); color: #22c55e;
	display: flex; align-items: center; justify-content: center; z-index: 1;
}

/* ════════════════════════════════════════════════════════════
   FEATURES BENTO
════════════════════════════════════════════════════════════ */
.bento-features {
	display: grid;
	grid-template-columns: 1.15fr 1fr;
	grid-template-rows: 1fr 1fr;
	gap: 14px;
}
.bento-feat:nth-child(1) { grid-row: span 2; }
.bento-feat:nth-child(4) { grid-column: span 2; }

.bento-feat {
	padding: 40px; border-radius: 22px;
	background: rgba(255,255,255,0.03);
	border: 1px solid rgba(255,255,255,0.07);
	display: flex; gap: 24px; align-items: flex-start;
	position: relative; overflow: hidden;
	transition: background 0.25s, border-color 0.25s;
}
.bento-feat:hover { background: rgba(255,255,255,0.055); border-color: rgba(255,255,255,0.12); }

.bf-accent {
	position: absolute; top: -60px; right: -60px;
	width: 160px; height: 160px; border-radius: 50%;
	background: radial-gradient(circle, rgba(232,255,72,0.06) 0%, transparent 70%);
	pointer-events: none;
}
.bf-num {
	font-family: var(--font-display); font-size: 56px; font-weight: 900; font-style: italic;
	color: rgba(232,255,72,0.07); line-height: 1; min-width: 68px;
	transition: color 0.2s; flex-shrink: 0;
}
.bento-feat:hover .bf-num { color: rgba(232,255,72,0.3); }
.bf-body { flex: 1; }
.bf-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.bf-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--d-text); }
.bf-tag {
	font-family: var(--font-mono); font-size: 10px;
	padding: 3px 10px; border-radius: 100px;
	border: 1px solid var(--d-border); color: var(--d-dim);
}
.bf-desc { font-size: 14px; line-height: 1.7; color: var(--d-muted); margin: 0; }

/* ════════════════════════════════════════════════════════════
   STATS BENTO
════════════════════════════════════════════════════════════ */
.stats-bento {
	display: grid;
	grid-template-columns: 2fr 1fr 1fr;
	grid-template-rows: auto auto;
	gap: 14px;
}
.stat-cell {
	padding: 40px; border-radius: 22px;
	border: 1px solid var(--d-border);
	background: rgba(255,255,255,0.02);
	display: flex; flex-direction: column; gap: 8px;
}
.stat-big { background: rgba(255,255,255,0.04); }
.stat-quote-cell { grid-column: span 2; }

.stat-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--d-dim); margin: 0; }
.stat-num {
	font-family: var(--font-display); font-size: 72px; font-weight: 900;
	color: var(--lime); line-height: 1; display: block;
}
.stat-md { font-size: 56px; }
.stat-sub { font-size: 12px; color: var(--d-dim); font-family: var(--font-mono); margin: 0; }
.stat-label { font-size: 14px; color: var(--d-muted); margin: 0; }
.stat-stars { font-size: 14px; color: #FBBF24; letter-spacing: 2px; margin-bottom: 12px; }
.stat-quote {
	font-family: var(--font-display); font-size: 20px; font-style: italic;
	font-weight: 700; color: var(--d-text); line-height: 1.45; margin: 0 0 24px;
}
.stat-author { display: flex; align-items: center; gap: 12px; }
.stat-avatar {
	width: 36px; height: 36px; border-radius: 50%;
	background: var(--s2); display: flex; align-items: center; justify-content: center;
	font-family: var(--font-mono); font-size: 11px; color: var(--d-dim);
	border: 1px solid var(--d-border); flex-shrink: 0;
}
.stat-name { font-size: 13px; font-weight: 600; color: var(--d-muted); margin: 0 0 2px; }
.stat-handle { font-size: 11px; color: var(--d-dim); margin: 0; font-family: var(--font-mono); }
.stat-platform-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.stat-pill {
	padding: 4px 10px; border-radius: 6px;
	background: rgba(255,255,255,0.04); border: 1px solid var(--d-border);
	font-family: var(--font-mono); font-size: 10px; color: var(--d-dim);
}

/* ════════════════════════════════════════════════════════════
   HOW IT WORKS
════════════════════════════════════════════════════════════ */
.steps-row {
	display: grid; grid-template-columns: repeat(3,1fr);
	gap: 0; position: relative;
}
.step-card {
	padding: 48px 36px 48px 40px;
	border: 1px solid var(--d-border);
	border-right: none; position: relative;
	transition: background 0.2s;
}
.step-card:last-child { border-right: 1px solid var(--d-border); }
.step-card:hover { background: rgba(255,255,255,0.03); }
.step-arrow {
	position: absolute; top: 50%; right: -16px;
	font-size: 20px; color: var(--d-dim);
	transform: translateY(-50%); z-index: 2;
}
.step-num-wrap {
	width: 48px; height: 48px; border-radius: 12px;
	background: rgba(255,255,255,0.06); border: 1px solid var(--d-border);
	display: flex; align-items: center; justify-content: center;
	margin-bottom: 24px;
}
.step-num { font-family: var(--font-display); font-size: 16px; font-weight: 900; color: var(--d-muted); }
.step-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--d-text); margin-bottom: 12px; }
.step-desc { font-size: 14px; line-height: 1.7; color: var(--d-muted); margin: 0; }

/* ════════════════════════════════════════════════════════════
   TESTIMONIALS
════════════════════════════════════════════════════════════ */
.testimonials-grid {
	display: grid; grid-template-columns: repeat(3,1fr); gap: 16px;
}
.t-card {
	padding: 40px; border-radius: 22px;
	border: 1px solid var(--d-border);
	background: rgba(255,255,255,0.025);
	display: flex; flex-direction: column; gap: 20px;
	transition: border-color 0.25s, transform 0.25s, background 0.25s;
	position: relative; overflow: hidden;
}
.t-card::before {
	content: ''; position: absolute; top: -50px; right: -50px;
	width: 120px; height: 120px; border-radius: 50%;
	background: var(--color, transparent); opacity: 0.08;
}
.t-card:hover {
	border-color: color-mix(in srgb, var(--color) 30%, transparent);
	transform: translateY(-4px); background: rgba(255,255,255,0.04);
}
.t-quote-glyph {
	font-family: var(--font-display); font-size: 64px;
	font-weight: 900; line-height: 1; color: var(--color, var(--d-border));
	opacity: 0.35; height: 36px; display: block; margin-bottom: -14px;
}
.t-text { font-size: 15px; line-height: 1.7; color: var(--d-muted); flex: 1; margin: 0; }
.t-author { display: flex; align-items: center; gap: 12px; }
.t-avatar {
	width: 40px; height: 40px; border-radius: 50%;
	display: flex; align-items: center; justify-content: center;
	font-family: var(--font-mono); font-size: 12px; font-weight: 700;
	flex-shrink: 0; border: 1px solid;
}
.t-name { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--d-text); margin: 0 0 2px; }
.t-meta { font-size: 11px; color: var(--d-dim); font-family: var(--font-mono); margin: 0; }

/* ════════════════════════════════════════════════════════════
   PRICING
════════════════════════════════════════════════════════════ */
.pricing-grid {
	display: grid; grid-template-columns: repeat(3,1fr);
	gap: 16px; align-items: start;
}
.price-card {
	padding: 36px; border-radius: 22px;
	border: 1px solid var(--d-border);
	background: rgba(255,255,255,0.03);
	display: flex; flex-direction: column; gap: 20px;
	position: relative; transition: box-shadow 0.25s, transform 0.25s;
}
.price-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
.price-featured {
	background: var(--lime); border-color: transparent;
	box-shadow: 0 8px 40px rgba(232,255,72,0.25);
}
.price-badge {
	position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
	background: #0a0a0a; color: var(--lime);
	font-size: 10px; font-family: var(--font-mono); font-weight: 700;
	letter-spacing: 0.08em; text-transform: uppercase;
	padding: 4px 14px; border-radius: 100px; white-space: nowrap;
}
.price-tier {
	font-family: var(--font-mono); font-size: 11px;
	letter-spacing: 0.1em; text-transform: uppercase; color: var(--d-muted);
}
.price-amount { display: flex; align-items: baseline; gap: 4px; }
.price-num {
	font-family: var(--font-display); font-size: 52px; font-weight: 900;
	color: var(--d-text); letter-spacing: -0.03em;
}
.price-per { font-size: 16px; color: var(--d-dim); }
.price-note { font-size: 12px; color: var(--d-dim); margin: 0; }
.price-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.price-list li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--d-muted); }
.price-list--dark li { color: rgba(10,10,10,0.75); }
.price-check { font-size: 12px; font-weight: 700; color: var(--d-dim); flex-shrink: 0; }
.btn-outline-glass {
	display: block; text-align: center; padding: 13px 24px;
	border: 1px solid var(--d-border); border-radius: 12px;
	color: var(--d-muted); text-decoration: none;
	font-size: 14px; font-weight: 600;
	background: rgba(255,255,255,0.04); transition: all 0.2s;
}
.btn-outline-glass:hover { border-color: rgba(255,255,255,0.2); color: var(--d-text); }
.btn-dark-solid {
	display: block; text-align: center; padding: 13px 24px;
	background: #0a0a0a; color: #fff;
	border-radius: 12px; font-size: 14px; font-weight: 600;
	text-decoration: none; transition: all 0.2s;
}
.btn-dark-solid:hover { background: #1a1a1a; }

/* ════════════════════════════════════════════════════════════
   FINAL CTA
════════════════════════════════════════════════════════════ */
.cta-section {
	background: var(--dark); padding: 140px 48px;
	position: relative; overflow: hidden; text-align: center;
}
.cta-orb {
	position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
	width: 800px; height: 420px; border-radius: 50%;
	background: radial-gradient(ellipse, rgba(232,255,72,0.07), transparent 65%);
	pointer-events: none;
}
.cta-inner {
	max-width: 760px; margin: 0 auto; position: relative; z-index: 1;
	display: flex; flex-direction: column; align-items: center; gap: 32px;
}
.cta-headline {
	font-family: var(--font-display);
	font-size: clamp(36px, 4.5vw, 64px);
	font-weight: 900; letter-spacing: -0.03em; line-height: 1.05;
	color: var(--d-text); margin: 0;
}
.cta-headline em { font-style: italic; color: var(--lime); }
.btn-lime-xl {
	display: inline-flex; align-items: center; gap: 10px;
	padding: 20px 40px; background: var(--lime); color: #0a0a0a;
	border-radius: 16px; font-size: 17px; font-weight: 700;
	font-family: var(--font-body); text-decoration: none; transition: all 0.2s;
}
.btn-lime-xl:hover { background: #f0ff70; transform: translateY(-2px); box-shadow: 0 16px 48px rgba(232,255,72,0.3); }
.cta-platforms { display: flex; align-items: center; gap: 12px; }
.cta-label { font-size: 12px; color: var(--d-dim); font-family: var(--font-mono); }
.cta-platform-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.cta-tag {
	font-size: 11px; font-family: var(--font-mono); padding: 4px 10px;
	border-radius: 6px; border: 1px solid var(--d-border); color: var(--d-dim);
}

/* ════════════════════════════════════════════════════════════
   FOOTER
════════════════════════════════════════════════════════════ */
.footer {
	background: var(--dark); border-top: 1px solid var(--d-border);
	padding: 64px 48px 32px;
}
.footer-inner {
	max-width: 1160px; margin: 0 auto;
	display: grid; grid-template-columns: 1.4fr 1fr;
	gap: 80px; margin-bottom: 48px;
}
.footer-brand { display: flex; flex-direction: column; gap: 16px; }
.footer-tag { font-size: 14px; color: var(--d-muted); max-width: 280px; line-height: 1.6; }
.footer-cols { display: grid; grid-template-columns: repeat(3,1fr); gap: 40px; }
.footer-col { display: flex; flex-direction: column; gap: 12px; }
.footer-col-title {
	font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em;
	text-transform: uppercase; color: var(--d-dim); margin-bottom: 4px;
}
.footer-col a { font-size: 14px; color: var(--d-muted); text-decoration: none; transition: color 0.2s; }
.footer-col a:hover { color: var(--d-text); }
.footer-bottom {
	max-width: 1160px; margin: 0 auto;
	display: flex; justify-content: space-between; align-items: center;
	padding-top: 24px; border-top: 1px solid var(--d-border);
	font-size: 12px; color: var(--d-dim); font-family: var(--font-mono);
}

/* ════════════════════════════════════════════════════════════
   RESPONSIVE
════════════════════════════════════════════════════════════ */
@media (max-width: 900px) {
	.nav-links { display: none; }
	.container { padding: 0 24px; }
	.section-pad { padding: 72px 24px; }
	.platforms-section { padding: 60px 24px; }

	.arc-stage { height: 480px; }
	.arc-pivot { top: 270px; }
	.arc-card { width: 118px; height: 156px; left: -59px; top: -156px; transform-origin: center calc(100% + 280px); border-radius: 20px; }
	.arc-copy { top: 280px; width: 90vw; }
	.arc-headline { font-size: 48px; }
	.arc-eyebrow { font-size: 14px; }
	.arc-cta { font-size: 15px; padding: 14px 28px; }

	.platforms-grid { grid-template-columns: repeat(3,1fr); }
	.bento-features { grid-template-columns: 1fr; }
	.bento-feat:nth-child(1) { grid-row: auto; }
	.bento-feat:nth-child(4) { grid-column: auto; }
	.stats-bento { grid-template-columns: 1fr 1fr; }
	.stat-quote-cell { grid-column: span 2; }
	.steps-row { grid-template-columns: 1fr; }
	.step-card { border-right: 1px solid var(--d-border); border-bottom: none; }
	.step-card:last-child { border-bottom: 1px solid var(--d-border); }
	.step-arrow { display: none; }
	.testimonials-grid { grid-template-columns: 1fr; }
	.pricing-grid { grid-template-columns: 1fr; }
	.footer-inner { grid-template-columns: 1fr; gap: 40px; }
}

@media (max-width: 600px) {
	.nav { padding: 16px 24px; }
	.btn-cta-nav { display: none; }
	.hero-white { padding-top: 60px; }

	.arc-stage { height: 400px; }
	.arc-pivot { top: 220px; }
	.arc-card { width: 86px; height: 116px; left: -43px; top: -116px; transform-origin: center calc(100% + 200px); border-radius: 16px; }
	.arc-copy { top: 228px; gap: 10px; }
	.arc-headline { font-size: 38px; }
	.arc-eyebrow { display: none; }
	.arc-proof { display: none; }
	.arc-cta { font-size: 14px; padding: 12px 24px; }

	.platforms-grid { grid-template-columns: repeat(2,1fr); }
	.stats-bento { grid-template-columns: 1fr; }
	.stat-quote-cell { grid-column: auto; }
	.footer-bottom { flex-direction: column; gap: 8px; text-align: center; }
}
</style>
